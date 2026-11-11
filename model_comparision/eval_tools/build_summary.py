#!/usr/bin/env python3
"""Cross-part summary of the WI model evaluation.

Reads every part's eval_work/manifest.json and Generated/<Model>/judge_result_*.json
(the same data behind each MODEL_COMPARISON_<part>.pdf) plus the narrative in
summary_notes.json, and writes Model_Summary_all_pcps.pdf next to this folder's parent.

All numbers come from the judge_result files and the cost reports in the manifests;
only the prose comes from summary_notes.json.

Usage:
    python3 eval_tools/build_summary.py            # from model_comparision/
    python3 eval_tools/build_summary.py --stats    # print the aggregate numbers only
"""
import argparse, json, sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import build_report as br  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
esc = br.esc
cls = br.cls


def find_parts():
    return sorted((p.parent.parent for p in ROOT.glob("*/eval_work/manifest.json")),
                  key=lambda p: br.load(p / "eval_work/manifest.json")["part_no"])


def gather(order):
    parts = []
    for pdir in find_parts():
        m = br.load(pdir / "eval_work" / "manifest.json")
        notes_p = pdir / "eval_work" / "report_notes.json"
        notes = br.load(notes_p) if notes_p.exists() else {}
        parts.append(dict(no=m["part_no"], dir=pdir, m=m, name=notes.get("part_name", ""),
                          stages=m["stages"], models={md["name"]: md for md in br.collect(pdir, m)}))
    if order:
        parts.sort(key=lambda p: order.index(p["no"]) if p["no"] in order else 99)
    names = sorted({n for p in parts for n in p["models"]})

    # stage-WIs: one column per (part, stage)
    wis = [(p, s) for p in parts for s in p["stages"]]
    wi_best = {}
    for p, s in wis:
        sc = {n: p["models"][n]["res"][s]["overall_score"] for n in names if s in p["models"].get(n, {}).get("res", {})}
        wi_best[(p["no"], s)] = max(sc, key=sc.get)
    part_best = {p["no"]: max(p["models"].values(), key=lambda md: md["overall"])["name"] for p in parts}

    models = []
    for n in names:
        mds = [p["models"][n] for p in parts if n in p["models"]]
        rs = [(p, s, p["models"][n]["res"][s]) for p, s in wis if s in p["models"].get(n, {}).get("res", {})]
        facts = [f for md in mds for f in md["facts"]]
        crit = [f for f in facts if f["criticality"] == "CRITICAL"]
        tagged = [(p, s, r) for p, s, r in rs if all(e.get("in_ppap") is not None for e in r["extra_content"]
                                                       if e["type"] == "CRITICAL_HALLUCINATION")
                  and any(e.get("in_ppap") is not None for e in r["extra_content"])]
        def ch(r, ppap=None):
            return sum(1 for e in r["extra_content"] if e["type"] == "CRITICAL_HALLUCINATION"
                       and (ppap is None or e.get("in_ppap") is ppap))
        whatif = sum(1 for p, s, r in tagged if r["counts"]["critical_contradicted"] == 0
                     and r["critical_recall"] >= 0.95 and ch(r, False) == 0)
        cost_total = sum(md["cost"].get("total_cost_usd", 0) for md in mds)
        n_gen = sum(md["cost"].get("stages_generated", 0) for md in mds)
        t_total = sum(md["cost"].get("total_llm_time_s", 0) for md in mds)
        models.append(dict(
            name=n, provider=mds[0]["cost"].get("provider_model_id", ""),
            per_part={p["no"]: p["models"][n] for p in parts if n in p["models"]},
            per_wi={(p["no"], s): r for p, s, r in rs},
            mean_part=sum(md["overall"] for md in mds) / len(mds),
            mean_wi=sum(r["overall_score"] for _, _, r in rs) / len(rs),
            min_wi=min(r["overall_score"] for _, _, r in rs), max_wi=max(r["overall_score"] for _, _, r in rs),
            recall=sum(f["verdict"] == "MATCH" for f in crit) / len(crit),
            n_crit=len(crit), n_facts=len(facts), facts=facts,
            counts={k: sum(md["counts"][k] for md in mds) for k in ("total_facts", "match", "partial", "missing", "contradicted")},
            crit_contra=sum(md["crit_contra"] for md in mds),
            ch=sum(md["ch"] for md in mds),
            ch_tagged=sum(ch(r) for _, _, r in tagged), ch_tagged_ppap=sum(ch(r, True) for _, _, r in tagged),
            n_tagged=len(tagged), whatif=whatif,
            g_contra=sum(r["counts"]["critical_contradicted"] > 0 for _, _, r in rs),
            g_hall=sum(ch(r) > 0 for _, _, r in rs),
            g_recall=sum(r["critical_recall"] < 0.95 for _, _, r in rs),
            passed=sum(r["pass"] for _, _, r in rs), n_wi=len(rs),
            lang_ok=sum(md["lang"] == "COMPLIANT" for md in mds), n_parts=len(mds),
            wi_wins=sum(v == n for v in wi_best.values()), part_wins=sum(v == n for v in part_best.values()),
            cost_wi=cost_total / n_gen if n_gen else None, cost_total=cost_total,
            time_wi=t_total / n_gen if n_gen else None,
            compl_wi=sum(md["cost"].get("completion_tokens", 0) for md in mds) / n_gen if n_gen else None,
            max_tokens=sorted({md["cost"].get("max_tokens") for md in mds if md["cost"].get("max_tokens")}),
            max_compl=max(md["cost"].get("completion_tokens", 0) / max(md["cost"].get("stages_generated", 1), 1) for md in mds),
        ))
    models.sort(key=lambda x: -x["mean_part"])
    return parts, wis, models, wi_best, part_best


def print_stats(parts, wis, models, wi_best, part_best):
    print("Parts:", [(p["no"], p["stages"]) for p in parts], "WIs per model:", len(wis))
    for md in models:
        print(f"{md['name']:22s} part={md['mean_part']:.3f} wi={md['mean_wi']:.3f} [{md['min_wi']:.3f}-{md['max_wi']:.3f}] "
              f"rec={md['recall']:.3f} ({md['n_crit']}) cc={md['crit_contra']} ch={md['ch']} tagged {md['ch_tagged_ppap']}/{md['ch_tagged']} "
              f"on {md['n_tagged']} WIs whatif={md['whatif']} gates c/h/r={md['g_contra']}/{md['g_hall']}/{md['g_recall']} "
              f"match={md['counts']['match']}/{md['counts']['total_facts']} lang={md['lang_ok']}/{md['n_parts']} "
              f"wins wi={md['wi_wins']} part={md['part_wins']} cost/wi={md['cost_wi']:.5f} total=${md['cost_total']:.4f} "
              f"time/wi={md['time_wi']:.1f}s compl/wi={md['compl_wi']:.0f} max_compl={md['max_compl']:.0f} max_tokens={md['max_tokens']}")
        print("   sections:", {k: round(br.weighted(md["facts"], lambda f, k=k: f["section"] == k), 3) for k, _ in br.SECTIONS})
    print("WI winners:", wi_best)
    print("Part winners:", part_best)


def svg_bars(models):
    return br.svg_chart([dict(name=md["name"], overall=md["mean_part"], recall=md["recall"]) for md in models])


def svg_scatter(models):
    W, H, L, B, T, R = 620, 250, 56, 36, 10, 150
    xmax = max(md["cost_wi"] for md in models) * 1.15
    X = lambda c: L + (W - L - R) * c / xmax
    Y = lambda v: T + (H - T - B) * (1 - v)
    o = []
    for v in (0, .25, .5, .75, 1):
        o.append(f'<line x1="{L}" x2="{W-R}" y1="{Y(v):.1f}" y2="{Y(v):.1f}" class="axis"/>'
                 f'<text x="{L-6}" y="{Y(v)+3:.1f}" text-anchor="end" class="tick">{v:.2f}</text>')
    step = 0.002
    c = 0.0
    while c <= xmax + 1e-9:
        o.append(f'<text x="{X(c):.1f}" y="{H-B+14}" text-anchor="middle" class="tick">${c:.3f}</text>')
        c += step
    o.append(f'<text x="{L+(W-L-R)/2:.1f}" y="{H-4}" text-anchor="middle" class="tick">Average cost per WI (USD)</text>')
    o.append(f'<text x="12" y="{T+(H-T-B)/2:.1f}" text-anchor="middle" class="tick" transform="rotate(-90 12 {T+(H-T-B)/2:.1f})">Mean overall score</text>')
    for md in models:
        x, y = X(md["cost_wi"]), Y(md["mean_part"])
        o.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="6" class="dot"/>'
                 f'<text x="{x+10:.1f}" y="{y+4:.1f}" class="lbl">{esc(md["name"])} <tspan class="tick">({md["mean_part"]:.3f}, ${md["cost_wi"]:.4f})</tspan></text>')
    return f'<svg viewBox="0 0 {W} {H}" width="100%" style="max-height:72mm" role="img" aria-label="Cost per WI against mean overall score">{"".join(o)}</svg>'


EXTRA_CSS = """
svg .dot{fill:#2f5d8a;stroke:#fff;stroke-width:1.5}
th.grp{text-align:center;border-bottom:1px solid var(--line)}
td.best{outline:2px solid #1d2430;outline-offset:-2px}
.small td,.small th{padding:4px 4px;font-size:8.6pt}
.pill{display:inline-block;font-size:7.6pt;font-weight:700;padding:1px 6px;border-radius:3px;margin-left:4px}
.p-lead{background:var(--g);color:var(--gi)} .p-alt{background:var(--a);color:var(--ai)} .p-drop{background:var(--r);color:var(--ri)}
.cover{display:flex;gap:10px;margin:10px 0} .kpi{flex:1;border:1px solid var(--line);border-radius:4px;padding:8px 10px}
.kpi b{display:block;font-size:15pt} .kpi span{font-size:8pt;color:var(--mute)}
"""


def build_html(parts, wis, models, wi_best, part_best, notes):
    n_wi = len(wis)
    total_wis = sum(md["n_wi"] for md in models)
    part_list = ", ".join(f"{p['no']} ({len(p['stages'])} stage{'s' if len(p['stages']) > 1 else ''})" for p in parts)
    total_cost = sum(md["cost_total"] for md in models)

    kpis = "".join(f"<div class=kpi><b>{v}</b><span>{l}</span></div>" for v, l in (
        (len(parts), "parts (PCPs)"), (n_wi, "stage-WIs per model"), (len(models), "models"),
        (total_wis, "WIs judged in total"), (sum(md["passed"] for md in models), "WIs that pass the judge"),
        (f"${total_cost:.3f}", "total generation cost")))

    # --- leaderboard ---
    head = ("<tr><th class=num>#</th><th>Model</th><th class=num>Mean overall<div class=sub>per part</div></th>"
            f"<th class=num>Range<div class=sub>over {n_wi} WIs</div></th><th class=num>Critical recall<div class=sub>pooled</div></th>"
            "<th class=num>Crit. contra&shy;dicted</th><th class=num>Crit. halluc&shy;inations<div class=sub>(in PPAP)*</div></th>"
            "<th class=num>Facts matched</th><th class=num>Best on<div class=sub>parts / WIs</div></th>"
            "<th>Hindi</th><th class=num>Cost / WI</th></tr>")
    rows = ""
    for i, md in enumerate(models, 1):
        c = md["counts"]
        rows += (f"<tr><td class=num>{i}</td><td><b>{esc(md['name'])}</b><div class=sub>{esc(md['provider'])}</div></td>"
                 f"<td class='num big'>{md['mean_part']:.3f}</td><td class=num style=white-space:nowrap>{md['min_wi']:.2f}&ndash;{md['max_wi']:.2f}</td>"
                 f"<td class=num>{md['recall']:.3f}</td><td class=num>{md['crit_contra']}</td>"
                 f"<td class=num>{md['ch']} <span class=sub>({md['ch_tagged_ppap']}/{md['ch_tagged']})</span></td>"
                 f"<td class=num>{c['match']}/{c['total_facts']}</td><td class=num>{md['part_wins']} / {md['wi_wins']}</td>"
                 f"<td>{md['lang_ok']}/{md['n_parts']}</td><td class=num>${md['cost_wi']:.4f}</td></tr>")

    # --- overall per stage-WI ---
    grp = "".join(f"<th class=grp colspan={len(p['stages'])}>{p['no']}</th>" for p in parts)
    sub = "".join(f"<th class=num>S{s}</th>" for p in parts for s in p["stages"])
    per_wi = f"<table class=small><tr><th rowspan=2>Model</th>{grp}<th rowspan=2 class=num>Mean<div class=sub>per part</div></th></tr><tr>{sub}</tr>"
    for md in models:
        per_wi += f"<tr><td>{esc(md['name'])}</td>"
        for p in parts:
            for s in p["stages"]:
                r = md["per_wi"].get((p["no"], s))
                best = " best" if wi_best[(p["no"], s)] == md["name"] else ""
                per_wi += f"<td class='h {cls(r['overall_score'])}{best}'>{r['overall_score']:.3f}</td>" if r else "<td class='h na'>&ndash;</td>"
        per_wi += f"<td class='h {cls(md['mean_part'])}'><b>{md['mean_part']:.3f}</b></td></tr>"
    per_wi += "</table>"

    # --- critical recall per part ---
    rec = "<table class=small><tr><th>Model</th>" + "".join(f"<th class=num>{p['no']}</th>" for p in parts) + "<th class=num>Pooled</th></tr>"
    for md in models:
        rec += f"<tr><td>{esc(md['name'])}</td>"
        for p in parts:
            pm = md["per_part"].get(p["no"])
            v = pm["recall"] if pm else None
            rec += f"<td class='h {'g' if v is not None and v >= .95 else cls(min(v, .89) if v is not None else None)}'>{'&ndash;' if v is None else f'{v:.3f}'}</td>"
        rec += f"<td class='h {'g' if md['recall'] >= .95 else cls(min(md['recall'], .89))}'><b>{md['recall']:.3f}</b></td></tr>"
    rec += "</table>"

    # --- part names ---
    pn = "<table class=small><tr><th>Part</th><th>Description</th><th class=num>Stages</th><th class=num>Golden facts</th><th>Best model</th><th class=num>Best overall</th><th>Per-part report</th></tr>"
    for p in parts:
        any_md = next(iter(p["models"].values()))
        best = p["models"][part_best[p["no"]]]
        pn += (f"<tr><td><b>{p['no']}</b></td><td>{esc(p['name'])}</td><td class=num>{len(p['stages'])}</td>"
               f"<td class=num>{any_md['counts']['total_facts']}</td><td style=white-space:nowrap>{esc(best['name'])}</td><td class=num>{best['overall']:.3f}</td>"
               f"<td class=sub>MODEL_COMPARISON_{p['no']}.pdf</td></tr>")
    pn += "</table>"

    # --- section heatmap pooled over all facts ---
    hm = "<table><tr><th>Section <span class=sub>(weight)</span></th>" + "".join(f"<th>{esc(md['name'])}</th>" for md in models) + "</tr>"
    for k, n in br.SECTIONS:
        hm += f"<tr><td>{n} <span class=sub>({br.SECTION_WEIGHTS[k]:.2f})</span></td>"
        for md in models:
            v = br.weighted(md["facts"], lambda f, k=k: f["section"] == k)
            hm += f"<td class='h {cls(v)}'>{'&ndash;' if v is None else f'{v:.2f}'}</td>"
        hm += "</tr>"
    hm += "<tr class=tot><td><b>Mean overall</b></td>" + "".join(f"<td class='h {cls(md['mean_part'])}'><b>{md['mean_part']:.3f}</b></td>" for md in models) + "</tr></table>"

    # --- verdict bars ---
    vd = ""
    for md in models:
        c = md["counts"]; t = c["total_facts"] or 1; seg = ""
        for k, cl in (("match", "vm"), ("partial", "vp"), ("missing", "vx"), ("contradicted", "vc")):
            w = c[k] / t * 100
            if w > 0:
                seg += f'<span class="{cl}" style="width:{w:.2f}%">{c[k] if w > 4 else ""}</span>'
        vd += f'<div class=vrow><div class=vname>{esc(md["name"])}</div><div class=vbar>{seg}</div></div>'

    # --- gates ---
    gt = (f"<table><tr><th>Model</th><th class=num>WIs passed</th><th class=num>WIs with a contradicted critical fact</th>"
          f"<th class=num>WIs with a critical hallucination</th><th class=num>WIs with critical recall &lt; 0.95</th>"
          f"<th class=num>Would pass if PPAP-backed additions were exempt**</th></tr>")
    for md in models:
        gt += (f"<tr><td>{esc(md['name'])}</td><td class=num>{md['passed']}/{md['n_wi']}</td><td class=num>{md['g_contra']}</td>"
               f"<td class=num>{md['g_hall']}</td><td class=num>{md['g_recall']}</td><td class=num><b>{md['whatif']}</b>/{md['n_tagged']}</td></tr>")
    gt += "</table>"

    # --- cost ---
    ct = ("<table><tr><th>Model</th><th class=num>Cost / WI</th><th class=num>Cost / 100 WIs</th><th class=num>Total for this eval</th>"
          "<th class=num>LLM time / WI</th><th class=num>Output tokens / WI</th><th class=num>max_tokens used</th><th class=num>Score per cent</th></tr>")
    for md in models:
        ct += (f"<tr><td>{esc(md['name'])}</td><td class=num>${md['cost_wi']:.4f}</td><td class=num>${md['cost_wi']*100:.2f}</td>"
               f"<td class=num>${md['cost_total']:.4f}</td><td class=num>{md['time_wi']:.1f} s</td><td class=num>{md['compl_wi']:,.0f}</td>"
               f"<td class=num>{' / '.join(f'{x:,}' for x in md['max_tokens'])}</td><td class=num>{md['mean_part']/(md['cost_wi']*100):.2f}</td></tr>")
    ct += "</table>"

    # --- narrative ---
    strip = notes.get
    summary = "<div class=bl><b>Summary</b><ul>" + "".join(f"<li>{b}</li>" for b in strip("summary_bullets", [])) + "</ul></div>"
    verdict = notes.get("verdict", "")
    cards = ""
    for i, md in enumerate(models, 1):
        n = notes.get("models", {}).get(md["name"], {})
        pill = {"lead": "<span class='pill p-lead'>Lead candidate</span>", "alt": "<span class='pill p-alt'>Keep testing</span>",
                "drop": "<span class='pill p-drop'>Drop</span>"}.get(n.get("status"), "")
        cards += (f"<div class=card><div class=chead><div><span class=rank>#{i}</span> <b class=mname>{esc(md['name'])}</b>{pill}</div>"
                  f"<div class=kpis><span>Mean <b>{md['mean_part']:.3f}</b></span><span>Recall <b>{md['recall']:.3f}</b></span>"
                  f"<span>Best on <b>{md['wi_wins']}/{md['n_wi']}</b> WIs</span><span>${md['cost_wi']:.4f}/WI</span></div></div>"
                  + (f"<p><span class=tag-ok>Strengths</span> {n['right']}</p>" if n.get("right") else "")
                  + (f"<div><span class=tag-bad>Weaknesses</span><ul>{''.join(f'<li>{w}</li>' for w in n.get('wrong', []))}</ul></div>" if n.get("wrong") else "")
                  + "</div>")
    rc = "".join(f"<h3>{i}. {esc(r['title'])}</h3>{r['html']}" for i, r in enumerate(notes.get("root_causes", []), 1))
    recs = "<ol class=rec>" + "".join(f"<li>{r}</li>" for r in notes.get("recommendations", [])) + "</ol>"
    srcs = "".join(f"<li><code>{esc(p['dir'].name.strip())}/MODEL_COMPARISON_{p['no']}.pdf</code> &mdash; {esc(p['name'])}</li>" for p in parts)

    return f"""<!doctype html><html lang=en><head><meta charset=utf-8><title>WI Model Summary: all PCPs</title><style>{br.CSS}{EXTRA_CSS}</style></head><body>
<h1>WI Generator: Model Summary, all PCPs</h1>
<div class=meta>{len(parts)} parts: {esc(part_list)} &middot; {len(models)} models &middot; LLM judge (<code>wi_judge_single_prompt.md</code>) &middot; Compiled {date.today().strftime('%d %B %Y')}</div>
<div class=cover>{kpis}</div>
{summary}
{('<div class=bl><b>Recommendation</b><p style="margin:4px 0 0">' + verdict + '</p></div>') if verdict else ''}
<h2>Leaderboard</h2>
<table>{head}{rows}</table>
<div class=note>Mean overall is the average of the five per-part scores (each part counts once; 290058600101 uses the mean of its four stages, as in its own report). Critical recall is pooled over every critical golden fact in all {n_wi} stage-WIs. Hindi = parts where the output language was compliant. Cost / WI = total generation cost / WIs generated.
* Bracket: critical hallucinations whose content the judge found in the PPAP, out of those tagged. 289661208202 was judged before tagging was added, so its {sum(md['per_part'].get('289661208202', {}).get('ch', 0) for md in models)} additions are not counted in the bracket.</div>
<div class=keep><h3>Mean overall score vs. pooled critical recall</h3>{svg_bars(models)}
<div class=legend><i style="background:#2f5d8a"></i>Mean overall score <i style="background:#c2410c;width:3px"></i>Pooled critical recall <i style="border-top:2px dashed #7f1d1d;height:0;width:12px;border-radius:0"></i>Recall pass line (0.95)</div></div>

<h2>Results by part</h2>
{pn}
<div class=keep><h3>Overall score per stage-WI</h3>
<div class=legend>Cell colours: <i class=g></i>&ge;0.90 <i class=a></i>0.60&ndash;0.89 <i class=o></i>0.30&ndash;0.59 <i class=r></i>&lt;0.30 &nbsp; Outlined cell = best model on that WI</div>
{per_wi}</div>
<div class=keep><h3>Critical recall per part</h3>
<div class=legend>Green = clears the 0.95 recall gate.</div>{rec}</div>

<h2>Where the models differ</h2>
<div class=keep><h3>Section scores, pooled over all {models[0]['counts']['total_facts']} golden facts</h3>{hm}</div>
<div class=keep><h3>Verdicts on all {models[0]['counts']['total_facts']} golden facts</h3>
<div class=legend><i class=vm></i>Match <i class=vp></i>Partial <i class=vx></i>Missing <i class=vc></i>Contradicted</div>{vd}</div>

<h2>Why nothing passes</h2>
<div class=keep>{gt}
<div class=note>A WI can fail more than one gate. ** Re-applies the pass rule with critical additions that the judge found in the PPAP no longer counted; only possible on the {models[0]['n_tagged']} WIs whose additions were tagged (not 289661208202).</div></div>
{notes.get('gates_html', '')}

<h2>Cost and quality</h2>
<div class=keep>{svg_scatter(models)}</div>
{ct}
<div class=note>Score per cent = mean overall score / cost per WI in US cents. Costs come from each run's own cost report.</div>
{notes.get('cost_html', '')}

<h2>Model profiles across all parts</h2>
{cards}

<h2>Recurring root causes</h2>
{rc}

<h2>Recommendations</h2>
{recs}

<h2>Method and sources</h2>
<p>Each part was evaluated separately with the runbook in <code>WI_EVAL_RUNBOOK.md</code>: every golden WI was split into atomic facts, Claude applied <code>wi_judge_single_prompt.md</code> to each generated WI, and <code>eval_tools/score.py</code> computed the scores from the verdicts. This summary re-reads the same <code>judge_result_*.json</code> files with <code>eval_tools/build_summary.py</code>; no verdict was changed. Facts are weighted 3 / 2 / 1 (critical / major / minor) and sections {', '.join(f'{n} {br.SECTION_WEIGHTS[k]:.2f}' for k, n in br.SECTIONS)}. A WI passes only with 0 contradicted critical facts, 0 critical hallucinations and critical recall of at least 0.95.</p>
<p><b>Limits.</b> {notes.get('limits', '')} Full findings, evidence and judgement calls are in each part's own report (listed under Results by part).</p>
</body></html>"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stats", action="store_true")
    args = ap.parse_args()
    notes_p = ROOT / "summary_notes.json"
    notes = br.load(notes_p) if notes_p.exists() else {}
    data = gather(notes.get("part_order", []))
    if args.stats:
        print_stats(*data)
        return
    out_dir = ROOT / "summary_work"
    out_dir.mkdir(exist_ok=True)
    html_path = out_dir / "summary.html"
    html_path.write_text(build_html(*data, notes))
    pdf = ROOT / "Model_Summary_all_pcps.pdf"
    br.to_pdf(html_path, pdf)
    prev = br.previews(pdf, out_dir / "preview")
    print(f"wrote {pdf}")
    if prev:
        print(f"preview: {prev}")


if __name__ == "__main__":
    main()

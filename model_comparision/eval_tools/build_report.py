#!/usr/bin/env python3
"""Step 5 of the WI evaluation runbook (see ../WI_EVAL_RUNBOOK.md).

Reads eval_work/manifest.json, every Generated/<Model>/judge_result_<Model>_Stage_NN.json
and the narrative in eval_work/report_notes.json, and writes
    <part>/MODEL_COMPARISON_<part_no>.pdf
plus eval_work/report.html and page previews in eval_work/preview/ (look at them).

All numbers in the PDF come from the judge_result files; only the prose comes from
report_notes.json. Without report_notes.json the PDF is still built (data only) and a
warning is printed.

Usage:
    python3 eval_tools/build_report.py "<part dir>"
"""
import argparse, glob, html, json, shutil, subprocess, sys
from datetime import date
from pathlib import Path

SECTIONS = [("S", "Steps"), ("QF", "Finished QC"), ("R", "Rework"), ("QI", "Incoming QC"),
            ("H", "Header"), ("T", "Tooling"), ("L", "Legend")]
SECTION_WEIGHTS = {"S": .35, "QF": .15, "R": .15, "QI": .10, "H": .10, "T": .10, "L": .05}
CRIT_WEIGHT = {"CRITICAL": 3, "MAJOR": 2, "MINOR": 1}
PTS = {"MATCH": 1.0, "PARTIAL": 0.5, "MISSING": 0.0, "CONTRADICTED": 0.0}
LANG_RANK = {"COMPLIANT": 0, "MIXED": 1, "NON_COMPLIANT": 2}
LANG_LABEL = {"COMPLIANT": "Compliant", "MIXED": "Mixed", "NON_COMPLIANT": "Non-compliant"}
DEFAULT_CALLS = [
    "Content found anywhere in the generated WI counts, even if it sits in a different section from the golden, as long as it is bound to the same operation.",
    "Document and revision dates count as critical facts (the prompt's “any numeric value / revision” rule).",
    "A check named without its value, or with the wrong instrument, is PARTIAL.",
    "A rework row with the right defect but a different action is CONTRADICTED.",
    "Content not in the golden counts as a hallucination even when the PPAP supports it, because the prompt judges only against the golden. Such items are tagged in_ppap.",
]
esc = html.escape


def load(p):
    return json.loads(Path(p).read_text())


def cls(v):
    if v is None:
        return "na"
    return "g" if v >= 0.9 else ("a" if v >= 0.6 else ("o" if v >= 0.3 else "r"))


def weighted(facts, pred=lambda f: True):
    fs = [f for f in facts if pred(f)]
    den = sum(CRIT_WEIGHT[f["criticality"]] for f in fs)
    return None if not den else sum(CRIT_WEIGHT[f["criticality"]] * PTS[f["verdict"]] for f in fs) / den


def collect(part, m):
    models = []
    for name, info in m["models"].items():
        res = {}
        for st, s in sorted(info["stages"].items()):
            p = part / s["judge_result"]
            if p.exists():
                res[st] = load(p)
        if not res:
            print(f"WARNING: no judge results for {name}; left out of the report")
            continue
        facts = [f for r in res.values() for f in r["golden_facts"]]
        crit = [f for f in facts if f["criticality"] == "CRITICAL"]
        c = lambda k: sum(r["counts"].get(k, 0) for r in res.values())
        extras = [e for r in res.values() for e in r["extra_content"]]
        ch = [e for e in extras if e["type"] == "CRITICAL_HALLUCINATION"]
        lang = max((r["language"]["verdict"] for r in res.values()), key=lambda v: LANG_RANK[v])
        models.append(dict(
            name=name, info=info, res=res, facts=facts,
            overall=sum(r["overall_score"] for r in res.values()) / len(res),
            recall=(sum(f["verdict"] == "MATCH" for f in crit) / len(crit)) if crit else 1.0,
            counts={k: c(k) for k in ("total_facts", "match", "partial", "missing", "contradicted")},
            crit_contra=c("critical_contradicted"), ch=len(ch),
            ch_ppap=sum(1 for e in ch if e.get("in_ppap") is True),
            ch_tagged=all(e.get("in_ppap") is not None for e in ch) and bool(ch),
            lang=lang, passed=all(r["pass"] for r in res.values()),
            missing_stages=[st for st in m["stages"] if st not in res],
            cost=info.get("cost", {}),
        ))
    models.sort(key=lambda x: -x["overall"])
    return models


def svg_chart(models):
    W, BH, GAP, LX = 620, 24, 12, 120
    H = len(models) * (BH + GAP) + 28
    span = W - LX - 60
    out = [f'<line x1="{LX}" x2="{LX}" y1="-4" y2="{H-28}" class="axis"/>']
    for t in (0, .25, .5, .75, 1):
        out.append(f'<text x="{LX+span*t:.1f}" y="{H-12}" text-anchor="middle" class="tick">{t:.2f}</text>')
    for i, md in enumerate(models):
        y = i * (BH + GAP)
        w = span * md["overall"]
        rx = LX + span * md["recall"]
        out += [f'<text x="{LX-8}" y="{y+BH/2+4}" text-anchor="end" class="lbl">{esc(md["name"])}</text>',
                f'<rect x="{LX}" y="{y}" width="{w:.1f}" height="{BH}" rx="2" class="bar"/>',
                f'<line x1="{rx:.1f}" x2="{rx:.1f}" y1="{y-3}" y2="{y+BH+3}" class="mark"/>',
                f'<text x="{W-4}" y="{y+BH/2+4}" text-anchor="end" class="val">{md["overall"]:.3f}</text>']
    gx = LX + span * 0.95
    out += [f'<line x1="{gx:.1f}" x2="{gx:.1f}" y1="-4" y2="{H-28}" class="gate"/>',
            f'<text x="{gx-4:.1f}" y="{H-24}" text-anchor="end" class="gatelbl">0.95 recall gate</text>']
    return (f'<svg viewBox="0 -6 {W} {H+2}" width="100%" style="max-height:70mm" role="img" '
            f'aria-label="Overall score by model">{"".join(out)}</svg>')


CSS = """
@page { size:A4; margin:16mm 15mm 16mm 15mm; }
:root{--ink:#1d2430;--mute:#5d6878;--line:#d9dee6;--accent:#2f5d8a;--bg:#f5f7fa;
--g:#d6eedd;--gi:#14532d;--a:#fbefc8;--ai:#6b4e00;--o:#fbdcc4;--oi:#7a3410;--r:#f6cfcf;--ri:#7f1d1d;}
*{box-sizing:border-box}
body{font-family:"Noto Sans","Noto Sans Devanagari",sans-serif;color:var(--ink);font-size:9.6pt;line-height:1.45;margin:0;background:#fff}
h1{font-size:20pt;margin:0 0 2px} h2{font-size:12.5pt;margin:20px 0 8px;color:var(--accent);border-bottom:1.5px solid var(--line);padding-bottom:4px}
h3{font-size:10.5pt;margin:12px 0 6px} h2,h3{break-after:avoid}
.meta{color:var(--mute);font-size:9pt;margin-bottom:12px} .sub{color:var(--mute);font-size:8pt;font-weight:normal}
.bl{background:var(--bg);border-left:4px solid var(--accent);padding:10px 14px;margin:8px 0 6px}
.bl ul{margin:4px 0 0;padding-left:18px} .bl li{margin:3px 0}
table{border-collapse:collapse;width:100%;margin:6px 0} tr{break-inside:avoid}
th,td{border-bottom:1px solid var(--line);padding:5px 6px;text-align:left;vertical-align:top}
th{font-size:8.4pt;color:var(--mute);font-weight:600;background:var(--bg)}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums} .big{font-size:11pt;font-weight:700}
td.h{text-align:center;font-variant-numeric:tabular-nums;font-weight:600}
.g{background:var(--g);color:var(--gi)} .a{background:var(--a);color:var(--ai)} .o{background:var(--o);color:var(--oi)} .r{background:var(--r);color:var(--ri)} .na{color:var(--mute)}
tr.tot td{border-top:1.5px solid var(--ink)}
.fail,.pass{font-weight:700;font-size:8pt;padding:1px 6px;border-radius:3px}
.fail{background:var(--r);color:var(--ri)} .pass{background:var(--g);color:var(--gi)}
svg .lbl{font-size:11px;fill:var(--ink)} svg .val{font-size:11px;font-weight:700;fill:var(--ink)} svg .tick{font-size:9px;fill:var(--mute)}
svg .bar{fill:var(--accent)} svg .axis{stroke:var(--line)} svg .mark{stroke:#c2410c;stroke-width:2.5}
svg .gate{stroke:#7f1d1d;stroke-dasharray:3 3} svg .gatelbl{font-size:9px;fill:#7f1d1d}
.legend{font-size:8.2pt;color:var(--mute);margin:2px 0 8px} .legend i{display:inline-block;width:10px;height:10px;vertical-align:-1px;margin:0 3px 0 10px;border-radius:2px}
.vrow{display:flex;align-items:center;margin:4px 0} .vname{width:120px;font-size:9pt}
.vbar{flex:1;display:flex;height:18px;border-radius:2px;overflow:hidden}
.vbar span{display:flex;align-items:center;justify-content:center;font-size:8pt;font-weight:700;color:#fff}
.vm{background:#2f7d4f} .vp{background:#d4a017} .vx{background:#9aa4b2} .vc{background:#b42318}
.card{border:1px solid var(--line);border-radius:4px;padding:8px 12px;margin:8px 0;break-inside:avoid}
.chead{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:6px;border-bottom:1px solid var(--line);padding-bottom:5px;margin-bottom:5px}
.mname{font-size:11pt} .rank{color:var(--mute);font-weight:700}
.kpis span{margin-left:12px;font-size:8.6pt;color:var(--mute)} .kpis b{color:var(--ink)}
.card p{margin:4px 0} .card ul{margin:3px 0 2px;padding-left:18px} .card li{margin:2px 0}
.tag-ok,.tag-bad{font-size:7.6pt;font-weight:700;padding:1px 5px;border-radius:3px;margin-right:4px;text-transform:uppercase}
.tag-ok{background:var(--g);color:var(--gi)} .tag-bad{background:var(--r);color:var(--ri)}
.rec li{margin:5px 0} code{font-size:8.4pt;background:var(--bg);padding:0 3px;border-radius:2px}
.keep{break-inside:avoid} .note{font-size:8.4pt;color:var(--mute)} .warn{background:var(--a);color:var(--ai);padding:6px 10px;border-radius:3px}
"""


def build_html(part, m, models, notes):
    stages = m["stages"]
    multi = len(stages) > 1
    any_tag = any(md["ch_tagged"] for md in models)
    part_name = notes.get("part_name", "")
    ppap_names = ", ".join(Path(p["file"]).name for p in m.get("ppap", [])) or "n/a"
    stage_txt = f"Stage {stages[0]}" if not multi else f"Stages {', '.join(stages)}"

    # --- scorecard ---
    head = ("<tr><th class=num>#</th><th>Model</th><th class=num>Overall" + (" <span class=sub>(mean of stages)</span>" if multi else "")
            + "</th><th class=num>Critical recall</th><th class=num>Critical contradicted</th><th class=num>Critical hallucinations"
            + (" <span class=sub>(in PPAP)</span>" if any_tag else "") + "</th><th>Language</th><th class=num>Cost / WI</th><th>Result</th></tr>")
    rows = ""
    for i, md in enumerate(models, 1):
        cost = md["cost"].get("avg_cost_per_wi_usd")
        ch = f"{md['ch']}" + (f" <span class=sub>({md['ch_ppap']})</span>" if md["ch_tagged"] else "")
        res = "<span class=pass>PASS</span>" if md["passed"] else "<span class=fail>FAIL</span>"
        if md["missing_stages"]:
            res += f"<div class=sub>no WI for stage {', '.join(md['missing_stages'])}</div>"
        rows += (f"<tr><td class=num>{i}</td><td><b>{esc(md['name'])}</b><div class=sub>{esc(md['cost'].get('provider_model_id',''))}</div></td>"
                 f"<td class='num big'>{md['overall']:.3f}</td><td class=num>{md['recall']:.3f}</td><td class=num>{md['crit_contra']}</td>"
                 f"<td class=num>{ch}</td><td>{LANG_LABEL[md['lang']]}</td><td class=num>{'$%.4f' % cost if isinstance(cost, float) else '–'}</td><td>{res}</td></tr>")

    # --- per-stage table ---
    stage_tbl = ""
    if multi:
        stage_tbl = "<h3>Overall score per stage</h3><table><tr><th>Model</th>" + "".join(f"<th>Stage {s}</th>" for s in stages) + "</tr>"
        for md in models:
            stage_tbl += f"<tr><td>{esc(md['name'])}</td>"
            for s in stages:
                r = md["res"].get(s)
                stage_tbl += (f"<td class='h {cls(r['overall_score'])}'>{r['overall_score']:.3f}{' ✓' if r['pass'] else ''}</td>" if r else "<td class='h na'>–</td>")
            stage_tbl += "</tr>"
        stage_tbl += "</table>"

    # --- section heatmap (pooled over stages) ---
    hm = "<tr><th>Section <span class=sub>(weight)</span></th>" + "".join(f"<th>{esc(md['name'])}</th>" for md in models) + "</tr>"
    for k, n in SECTIONS:
        vals = [weighted(md["facts"], lambda f, k=k: f["section"] == k) for md in models]
        if all(v is None for v in vals):
            continue
        hm += f"<tr><td>{n} <span class=sub>({SECTION_WEIGHTS[k]:.2f})</span></td>" + "".join(
            f"<td class='h {cls(v)}'>{'–' if v is None else f'{v:.2f}'}</td>" for v in vals) + "</tr>"
    hm += "<tr class=tot><td><b>Overall</b></td>" + "".join(f"<td class='h {cls(md['overall'])}'><b>{md['overall']:.3f}</b></td>" for md in models) + "</tr>"

    # --- coverage by process area (from the optional 'area' field of golden facts) ---
    cov = ""
    for s in stages:
        areas = []
        for md in models:
            for f in md["res"].get(s, {}).get("golden_facts", []):
                if f.get("area") and f["area"] not in areas:
                    areas.append(f["area"])
        if not areas:
            continue
        cov += (f"<div class=keep><h3>Coverage by process area{f' – Stage {s}' if multi else ''}</h3>"
                "<table><tr><th>Process area</th>" + "".join(f"<th>{esc(md['name'])}</th>" for md in models) + "</tr>")
        for a in areas:
            cov += f"<tr><td>{esc(a)}</td>"
            for md in models:
                v = weighted(md["res"].get(s, {}).get("golden_facts", []), lambda f, a=a: f.get("area") == a)
                cov += f"<td class='h {cls(v)}'>{'–' if v is None else f'{v*100:.0f}%'}</td>"
            cov += "</tr>"
        cov += "</table></div>"
    if cov:
        cov = "<div class=note>Weighted share of golden facts covered in each part of the process (steps, tooling and finished-QC facts grouped by the operation they belong to).</div>" + cov

    # --- verdict distribution ---
    total_facts = models[0]["counts"]["total_facts"] if models else 0
    vd = ""
    for md in models:
        c = md["counts"]; t = c["total_facts"] or 1; seg = ""
        for k, cl in (("match", "vm"), ("partial", "vp"), ("missing", "vx"), ("contradicted", "vc")):
            w = c[k] / t * 100
            if w > 0:
                seg += f'<span class="{cl}" style="width:{w:.2f}%">{c[k] if w > 4 else ""}</span>'
        vd += f'<div class=vrow><div class=vname>{esc(md["name"])}</div><div class=vbar>{seg}</div></div>'

    # --- model cards ---
    cards = ""
    nm = notes.get("models", {})
    for i, md in enumerate(models, 1):
        n = nm.get(md["name"], {})
        wrong = n.get("wrong") or [esc(g) for r in md["res"].values() for g in r["failed_gates"]]
        right = n.get("right", "")
        cost = md["cost"].get("avg_cost_per_wi_usd")
        cards += (f"<div class=card><div class=chead><div><span class=rank>#{i}</span> <b class=mname>{esc(md['name'])}</b> "
                  f"<span class=sub>{esc(md['cost'].get('provider_model_id',''))}</span></div><div class=kpis>"
                  f"<span>Overall <b>{md['overall']:.3f}</b></span><span>Crit. recall <b>{md['recall']:.3f}</b></span>"
                  f"<span>Facts matched <b>{md['counts']['match']}/{md['counts']['total_facts']}</b></span>"
                  + (f"<span>${cost:.4f}/WI</span>" if isinstance(cost, float) else "") + "</div></div>"
                  + (f"<p><span class=tag-ok>Right</span> {right}</p>" if right else "")
                  + f"<div><span class=tag-bad>Wrong</span><ul>{''.join(f'<li>{w}</li>' for w in wrong)}</ul></div></div>")

    # --- narrative ---
    bullets = notes.get("summary_bullets") or []
    summary = ("<div class=bl><b>Summary</b><ul>" + "".join(f"<li>{b}</li>" for b in bullets) + "</ul></div>") if bullets else \
        "<div class='bl warn'>No report_notes.json found: this report shows data only. Write the notes (runbook Step 5) and rebuild.</div>"
    rc = "".join(f"<h3>{i}. {esc(r['title'])}</h3>{r['html']}" for i, r in enumerate(notes.get("root_causes", []), 1))
    recs = notes.get("recommendations", [])
    narrative = (("<h2>Root causes</h2>" + rc) if rc else "") + (("<h2>Recommendations</h2><ol class=rec>" + "".join(f"<li>{r}</li>" for r in recs) + "</ol>") if recs else "")

    # --- method ---
    first = models[0]["res"] if models else {}
    fact_rows = ""
    for s in stages:
        r = first.get(s)
        if not r:
            continue
        gf = r["golden_facts"]
        cc = {c: sum(f["criticality"] == c for f in gf) for c in CRIT_WEIGHT}
        fact_rows += (f"<tr><td>Stage {s}</td><td class=num>{len(gf)}</td><td class=num>{cc['CRITICAL']}</td><td class=num>{cc['MAJOR']}</td><td class=num>{cc['MINOR']}</td>"
                      + "".join(f"<td class=num>{sum(f['section']==k for f in gf)}</td>" for k, _ in SECTIONS) + "</tr>")
    calls = notes.get("judgement_calls") or DEFAULT_CALLS
    files = "".join(f"<li><code>{esc(s['judge_result'])}</code></li>" for md in models for st, s in sorted(md["info"]["stages"].items()) if st in md["res"])
    goldens = ", ".join(f"<code>{esc(m['golden'][s]['file'])}</code>" for s in stages)
    limits = notes.get("limits", f"{len(stages)} stage(s) of one part, one generation per model. Treat the ranking as indicative until it is repeated on more parts.")

    return f"""<!doctype html><html lang=en><head><meta charset=utf-8><title>WI Model Comparison {esc(m['part_no'])}</title><style>{CSS}</style></head><body>
<h1>WI Generator: Model Comparison</h1>
<div class=meta>Part <b>{esc(m['part_no'])}</b>{' · ' + esc(part_name) if part_name else ''} · {stage_txt} · Source: {esc(ppap_names)} · Evaluated {date.today().strftime('%d %B %Y')}</div>
{summary}
<h2>Scorecard</h2>
<table>{head}{rows}</table>
<div class=note>Overall is the section-weighted score from 0 to 1{', averaged over stages' if multi else ''}. Critical recall is pooled over {'all stages' if multi else 'the stage'}. A model passes only with 0 contradicted critical facts, 0 critical hallucinations and critical recall of at least 0.95{' in every stage' if multi else ''}.{' Numbers in brackets are critical hallucinations whose content is present in the PPAP.' if any_tag else ''} Costs come from each run's own cost report.</div>
<div class=keep><h3>Overall score vs. critical recall</h3>{svg_chart(models)}
<div class=legend><i style="background:#2f5d8a"></i>Overall score <i style="background:#c2410c;width:3px"></i>Critical recall <i style="border-top:2px dashed #7f1d1d;height:0;width:12px;border-radius:0"></i>Recall pass line (0.95)</div></div>
<h2>Where each model scores</h2>
<div class=legend>Cell colours: <i class=g></i>&ge;0.90 <i class=a></i>0.60&ndash;0.89 <i class=o></i>0.30&ndash;0.59 <i class=r></i>&lt;0.30</div>
{stage_tbl}
<h3>Section scores{' (pooled over stages)' if multi else ''}</h3><table>{hm}</table>
{cov}
<h3>Verdicts on the {total_facts} golden facts</h3>
<div class=legend><i class=vm></i>Match <i class=vp></i>Partial <i class=vx></i>Missing <i class=vc></i>Contradicted</div>
{vd}
<h2>Findings by model</h2>
{cards}
{narrative}
<h2>Method</h2>
<p><b>Judge.</b> Each generated WI was compared with its golden WI ({goldens}) using <code>wi_judge_single_prompt.md</code>. Claude applied the prompt; <code>eval_tools/score.py</code> computed every score from the verdicts, so the arithmetic is exact and auditable.</p>
<p><b>Golden facts.</b> Each golden WI was split once into atomic facts, and the same list was used for every model. Each fact is MATCH (1.0), PARTIAL (0.5), MISSING (0) or CONTRADICTED (0), weighted 3 / 2 / 1 for critical / major / minor.</p>
<table><tr><th></th><th class=num>Facts</th><th class=num>Critical</th><th class=num>Major</th><th class=num>Minor</th>{''.join(f'<th class=num>{k}</th>' for k, _ in SECTIONS)}</tr>
<tr><td>Section weight</td><td></td><td></td><td></td><td></td>{''.join(f'<td class=num>{SECTION_WEIGHTS[k]:.2f}</td>' for k, _ in SECTIONS)}</tr>{fact_rows}</table>
<p><b>Pass rule.</b> A model fails if any critical fact is contradicted, if there is any critical hallucination, or if critical recall is below 0.95.</p>
<p><b>Judgement calls applied to all models:</b></p><ul>{''.join(f'<li>{c}</li>' for c in calls)}</ul>
<p><b>Limits.</b> {limits}</p>
<div class=keep><p><b>Detailed results</b> (per-fact verdicts, evidence quotes, extra content, score workings):</p><ul>{files}</ul></div>
</body></html>"""


def to_pdf(html_path: Path, pdf_path: Path):
    chrome = next((shutil.which(b) for b in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser") if shutil.which(b)), None)
    if chrome:
        subprocess.run([chrome, "--headless=new", "--disable-gpu", "--no-sandbox", "--no-pdf-header-footer",
                        f"--print-to-pdf={pdf_path}", html_path.as_uri()], check=True, capture_output=True, timeout=180)
    elif shutil.which("wkhtmltopdf"):
        subprocess.run(["wkhtmltopdf", "-q", "--page-size", "A4", str(html_path), str(pdf_path)], check=True, timeout=180)
    else:
        sys.exit("Need google-chrome/chromium or wkhtmltopdf to print the PDF")


def previews(pdf_path: Path, outdir: Path):
    if not shutil.which("pdftoppm"):
        return None
    outdir.mkdir(parents=True, exist_ok=True)
    for old in outdir.glob("page-*.png"):
        old.unlink()
    subprocess.run(["pdftoppm", "-r", "60", "-png", str(pdf_path), str(outdir / "page")], check=True)
    pages = sorted(glob.glob(str(outdir / "page-*.png")))
    try:
        from PIL import Image
        ims = [Image.open(p) for p in pages]
        w, h = ims[0].size
        cols = min(3, len(ims)); rows = (len(ims) + cols - 1) // cols
        sheet = Image.new("RGB", (w * cols, h * rows), "white")
        for i, im in enumerate(ims):
            sheet.paste(im, ((i % cols) * w, (i // cols) * h))
        sheet.save(outdir / "contact.png")
        return outdir / "contact.png"
    except Exception:  # noqa: BLE001
        return pages[0] if pages else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("part_dir")
    args = ap.parse_args()
    part = Path(args.part_dir).resolve()
    m = load(part / "eval_work" / "manifest.json")
    notes_p = part / m.get("report_notes", "eval_work/report_notes.json")
    notes = load(notes_p) if notes_p.exists() else {}
    if not notes:
        print("WARNING: eval_work/report_notes.json missing - building a data-only report")
    models = collect(part, m)
    if not models:
        sys.exit("No judge_result files found. Run score.py first.")
    html_path = part / "eval_work" / "report.html"
    html_path.write_text(build_html(part, m, models, notes))
    pdf = part / f"MODEL_COMPARISON_{m['part_no']}.pdf"
    to_pdf(html_path, pdf)
    prev = previews(pdf, part / "eval_work" / "preview")
    print(f"wrote {pdf.relative_to(part.parent)}")
    if prev:
        print(f"preview: {prev}")
    for md in models:
        print(f"  {md['name']:22s} overall={md['overall']:.3f} recall={md['recall']:.3f} {'PASS' if md['passed'] else 'FAIL'}")


if __name__ == "__main__":
    main()

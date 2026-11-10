#!/usr/bin/env python3
"""Steps 2b and 4 of the WI evaluation runbook (see ../WI_EVAL_RUNBOOK.md).

check-facts : validate eval_work/golden_facts_Stage_NN.json and list every number in the
              golden WI that no fact covers (the judge prompt requires full coverage).
score       : merge golden facts + eval_work/verdicts/<Model>_Stage_NN.json, validate,
              compute section scores / overall / critical recall / gates exactly as
              wi_judge_single_prompt.md Step 6 defines, and write
              Generated/<Model>/judge_result_<Model>_Stage_NN.json.

Usage:
    python3 eval_tools/score.py check-facts "<part dir>" [--stage 01]
    python3 eval_tools/score.py score "<part dir>" [--model Luna-6] [--stage 01]
"""
import argparse, json, re, sys
from datetime import date
from pathlib import Path

SECTIONS = ["H", "S", "T", "QI", "QF", "R", "L"]
SECTION_WEIGHTS = {"S": .35, "QF": .15, "R": .15, "QI": .10, "H": .10, "T": .10, "L": .05}
CRIT_WEIGHT = {"CRITICAL": 3, "MAJOR": 2, "MINOR": 1}
VERDICT_POINTS = {"MATCH": 1.0, "PARTIAL": 0.5, "MISSING": 0.0, "CONTRADICTED": 0.0}
EXTRA_TYPES = {"CRITICAL_HALLUCINATION", "MINOR_HALLUCINATION", "BENIGN_ADDITION"}
LANG_VERDICTS = {"COMPLIANT", "MIXED", "NON_COMPLIANT"}
RECALL_GATE = 0.95
DEVANAGARI = str.maketrans("०१२३४५६७८९", "0123456789")
KEY_ORDER = ["golden_facts", "extra_content", "sequence_issues", "language", "counts",
             "section_scores", "score_workings", "overall_score", "critical_recall", "pass",
             "failed_gates", "summary", "meta"]


def load(p: Path):
    try:
        return json.loads(p.read_text())
    except FileNotFoundError:
        sys.exit(f"Missing file: {p}")
    except json.JSONDecodeError as e:
        sys.exit(f"Invalid JSON in {p}: {e}")


def manifest(part: Path):
    m = load(part / "eval_work" / "manifest.json")
    return m


def validate_facts(facts, stage):
    errs, seen = [], set()
    for f in facts:
        fid = f.get("id")
        if not fid:
            errs.append(f"fact without id: {f}")
            continue
        if fid in seen:
            errs.append(f"duplicate fact id {fid}")
        seen.add(fid)
        if f.get("section") not in SECTIONS:
            errs.append(f"{fid}: section must be one of {SECTIONS}")
        if f.get("criticality") not in CRIT_WEIGHT:
            errs.append(f"{fid}: criticality must be CRITICAL/MAJOR/MINOR")
        if f.get("section") == "S" and not isinstance(f.get("order"), int):
            errs.append(f"{fid}: S facts need integer 'order' (golden step number)")
        if f.get("section") != "S" and f.get("order") is not None:
            errs.append(f"{fid}: non-S facts must have order null")
        for k in ("fact", "golden_quote"):
            if not f.get(k):
                errs.append(f"{fid}: '{k}' is empty")
    if errs:
        sys.exit(f"golden_facts_Stage_{stage}.json invalid:\n  " + "\n  ".join(errs))


def numbers(s: str):
    s = s.translate(DEVANAGARI)
    return set(re.findall(r"\d+(?:\.\d+)?", s))


def cmd_check_facts(part: Path, stages):
    m = manifest(part)
    for st in stages or m["stages"]:
        facts = load(part / m["golden_facts"][st])
        validate_facts(facts, st)
        gtext = (part / m["golden"][st]["text"]).read_text()
        # take cell values only (drop "F12:" coordinates) and skip cells that are just a
        # step / row counter such as "6", "13)" or "4." - those are not facts
        golden_nums = set()
        for line in gtext.splitlines():
            for cell in line.split(" | "):
                val = re.sub(r"^[A-Z]{1,3}\d+:\s*", "", cell.strip())
                if re.fullmatch(r"[0-9०-९]{1,2}[.)]?", val):
                    continue
                golden_nums |= numbers(val)
        covered = set()
        for f in facts:
            covered |= numbers(f.get("fact", "") + " " + f.get("golden_quote", ""))
        missing = sorted(golden_nums - covered, key=lambda x: float(x))
        by_sec = {s: sum(1 for f in facts if f["section"] == s) for s in SECTIONS}
        by_crit = {c: sum(1 for f in facts if f["criticality"] == c) for c in CRIT_WEIGHT}
        print(f"Stage {st}: {len(facts)} facts  sections={by_sec}  criticality={by_crit}")
        if missing:
            print(f"  Numbers in the golden that no fact quotes ({len(missing)}): {', '.join(missing)}")
            print("  -> add facts for real values; ignore list markers / step numbers / legend counts.")
        else:
            print("  Every number in the golden is covered by at least one fact.")


def score_one(part: Path, m, model: str, st: str):
    facts = load(part / m["golden_facts"][st])
    validate_facts(facts, st)
    sinfo = m["models"][model]["stages"][st]
    v = load(part / sinfo["verdicts"])
    verdicts = v.get("verdicts", {})
    errs = []
    ids = [f["id"] for f in facts]
    for fid in ids:
        if fid not in verdicts:
            errs.append(f"no verdict for {fid}")
    for fid in verdicts:
        if fid not in ids:
            errs.append(f"verdict for unknown fact id {fid}")
    for fid, x in verdicts.items():
        if x.get("verdict") not in VERDICT_POINTS:
            errs.append(f"{fid}: verdict must be one of {list(VERDICT_POINTS)}")
        if x.get("verdict") == "MISSING" and x.get("evidence"):
            errs.append(f"{fid}: MISSING must have evidence null")
    for e in v.get("extra_content", []):
        if e.get("type") not in EXTRA_TYPES:
            errs.append(f"extra_content type must be one of {sorted(EXTRA_TYPES)}: {e}")
        if e.get("in_ppap") not in (True, False, None):
            errs.append(f"extra_content in_ppap must be true/false/null: {e}")
    lang = v.get("language", {})
    if lang.get("verdict") not in LANG_VERDICTS:
        errs.append(f"language.verdict must be one of {sorted(LANG_VERDICTS)}")
    if not v.get("summary"):
        errs.append("summary is empty")
    if errs:
        sys.exit(f"{sinfo['verdicts']} invalid:\n  " + "\n  ".join(errs))

    merged = []
    for f in facts:
        x = verdicts[f["id"]]
        row = {k: f.get(k) for k in ("id", "section", "order", "criticality", "fact", "golden_quote")}
        row.update(verdict=x["verdict"], evidence=x.get("evidence"), note=x.get("note", ""))
        if f.get("area"):
            row["area"] = f["area"]
        merged.append(row)

    present = [s for s in SECTIONS if any(f["section"] == s for f in merged)]
    wsum = sum(SECTION_WEIGHTS[s] for s in present)
    sec_scores, work = {}, []
    for s in SECTIONS:
        fs = [f for f in merged if f["section"] == s]
        if not fs:
            sec_scores[s] = None
            work.append(f"{s}: absent from golden (weight dropped)")
            continue
        num = sum(CRIT_WEIGHT[f["criticality"]] * VERDICT_POINTS[f["verdict"]] for f in fs)
        den = sum(CRIT_WEIGHT[f["criticality"]] for f in fs)
        sec_scores[s] = round(num / den, 4)
        work.append(f"{s}: {num:g}/{den} = {num/den:.4f}")
    overall = sum(SECTION_WEIGHTS[s] / wsum * sec_scores[s] for s in present)
    terms = " + ".join(f"{SECTION_WEIGHTS[s]/wsum:.4g}×{sec_scores[s]:.4f}" for s in present)
    work.append(f"Overall = {terms} = {overall:.4f}" + ("" if abs(wsum - 1) < 1e-9 else f" (weights renormalised over {present})"))
    crit = [f for f in merged if f["criticality"] == "CRITICAL"]
    cm = sum(f["verdict"] == "MATCH" for f in crit)
    ccl = [f["id"] for f in crit if f["verdict"] == "CONTRADICTED"]
    extra = v.get("extra_content", [])
    ch = [e for e in extra if e["type"] == "CRITICAL_HALLUCINATION"]
    recall = cm / len(crit) if crit else 1.0
    work.append(f"Critical recall = {cm}/{len(crit)} = {recall:.4f}")
    gates = []
    if ccl:
        gates.append(f"{len(ccl)} CRITICAL fact(s) CONTRADICTED ({', '.join(ccl)})")
    if ch:
        gates.append(f"{len(ch)} CRITICAL_HALLUCINATION(s)")
    if recall < RECALL_GATE:
        gates.append(f"Critical recall {recall:.3f} < {RECALL_GATE}")

    out = {
        "golden_facts": merged,
        "extra_content": extra,
        "sequence_issues": v.get("sequence_issues", []),
        "language": lang,
        "counts": {
            "total_facts": len(merged),
            "match": sum(f["verdict"] == "MATCH" for f in merged),
            "partial": sum(f["verdict"] == "PARTIAL" for f in merged),
            "missing": sum(f["verdict"] == "MISSING" for f in merged),
            "contradicted": sum(f["verdict"] == "CONTRADICTED" for f in merged),
            "critical_facts": len(crit), "critical_match": cm, "critical_contradicted": len(ccl),
            "critical_hallucinations": len(ch),
            "critical_hallucinations_in_ppap": sum(1 for e in ch if e.get("in_ppap") is True),
        },
        "section_scores": sec_scores,
        "score_workings": "; ".join(work),
        "overall_score": round(overall, 4),
        "critical_recall": round(recall, 4),
        "pass": not gates,
        "failed_gates": gates,
        "summary": v["summary"],
        "meta": {"part_no": m["part_no"], "model": model, "stage": st,
                 "golden_file": m["golden"][st]["file"], "generated_file": sinfo["file"],
                 "judge_prompt": "wi_judge_single_prompt.md", "scored_on": date.today().isoformat()},
    }
    out = {k: out[k] for k in KEY_ORDER}
    dest = part / sinfo["judge_result"]
    dest.write_text(json.dumps(out, indent=2, ensure_ascii=False))
    return out, dest


def cmd_score(part: Path, models, stages):
    m = manifest(part)
    rows = []
    for model, info in m["models"].items():
        if models and model not in models:
            continue
        for st in sorted(info["stages"]):
            if stages and st not in stages:
                continue
            if not (part / info["stages"][st]["verdicts"]).exists():
                print(f"skip {model} Stage {st}: no verdicts file yet")
                continue
            out, dest = score_one(part, m, model, st)
            c = out["counts"]
            rows.append((model, st, out["overall_score"], out["critical_recall"], c["match"], c["partial"],
                         c["missing"], c["contradicted"], c["critical_contradicted"], c["critical_hallucinations"],
                         "PASS" if out["pass"] else "FAIL"))
            print(f"wrote {dest.relative_to(part)}")
    if rows:
        print(f"\n{'model':22s} st  overall recall  M  P  X  C  critC critH result")
        for r in sorted(rows, key=lambda r: (r[1], -r[2])):
            print(f"{r[0]:22s} {r[1]}  {r[2]:.3f}  {r[3]:.3f}  {r[4]:>3} {r[5]:>2} {r[6]:>2} {r[7]:>2}  {r[8]:>4} {r[9]:>5}  {r[10]}")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("check-facts"); a.add_argument("part_dir"); a.add_argument("--stage", action="append")
    b = sub.add_parser("score"); b.add_argument("part_dir"); b.add_argument("--model", action="append"); b.add_argument("--stage", action="append")
    args = ap.parse_args()
    part = Path(args.part_dir).resolve()
    stages = [f"{int(s):02d}" for s in (args.stage or [])]
    if args.cmd == "check-facts":
        cmd_check_facts(part, stages)
    else:
        cmd_score(part, args.model, stages)


if __name__ == "__main__":
    main()

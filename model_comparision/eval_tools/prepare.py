#!/usr/bin/env python3
"""Step 1 of the WI evaluation runbook (see ../WI_EVAL_RUNBOOK.md).

Discovers the golden WIs, the generated WIs of every model, the PPAP source and the
per-model COST reports for ONE part folder, dumps every workbook to plain text and
writes <part>/eval_work/manifest.json.

Usage:
    python3 eval_tools/prepare.py "model_comparision/ 289661208202 "
    python3 eval_tools/prepare.py "<part dir>" --golden-dir Hindi
"""
import argparse, json, re, shutil, subprocess, sys, tempfile, zipfile
from datetime import date
from pathlib import Path

try:
    import openpyxl
except ImportError:
    sys.exit("openpyxl is required: pip install openpyxl")

STAGE_RE = re.compile(r"_Stage_(\d+)", re.I)


def stage_of(name: str):
    m = STAGE_RE.search(name)
    return f"{int(m.group(1)):02d}" if m else None


def dump_xlsx(path: Path) -> str:
    """Every non-empty cell as 'A12: value', one worksheet row per line."""
    wb = openpyxl.load_workbook(path, data_only=True)
    out = []
    for ws in wb.worksheets:
        out.append(f"=== SHEET: {ws.title} ===")
        for row in ws.iter_rows():
            cells = [(c.coordinate, c.value) for c in row if c.value not in (None, "")]
            if cells:
                out.append(" | ".join(f"{k}: {str(v).strip()}" for k, v in cells))
    return "\n".join(out) + "\n"


def to_xlsx(path: Path, workdir: Path) -> Path:
    """Convert a legacy .xls to .xlsx with LibreOffice (openpyxl cannot read .xls)."""
    if path.suffix.lower() == ".xlsx":
        return path
    soffice = shutil.which("soffice") or shutil.which("libreoffice")
    if not soffice:
        raise RuntimeError(f"Cannot read {path.name}: install LibreOffice or convert it to .xlsx")
    conv = workdir / "converted"
    conv.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as profile:
        subprocess.run([soffice, f"-env:UserInstallation=file://{profile}", "--headless",
                        "--convert-to", "xlsx", "--outdir", str(conv), str(path)],
                       check=True, capture_output=True, timeout=180)
    out = conv / (path.stem + ".xlsx")
    if not out.exists():
        raise RuntimeError(f"LibreOffice did not produce {out}")
    return out


def docx_text(path: Path) -> str:
    xml = zipfile.ZipFile(path).read("word/document.xml").decode("utf8")
    xml = xml.replace("</w:p>", "\n").replace("</w:tc>", " | ")
    return re.sub(r"<[^>]+>", "", xml)


def parse_cost(path: Path) -> dict:
    """Pull the key/value pairs out of the generator's COST_*.docx report."""
    lines = [l.strip(" |\t") for l in docx_text(path).splitlines()]
    lines = [l for l in lines if l]
    want = {
        "Model": "model", "Provider / model id": "provider_model_id", "Language": "language",
        "Strategy": "strategy", "Temperature": "temperature", "Max tokens": "max_tokens",
        "Stages generated": "stages_generated", "Total cost": "total_cost_usd",
        "Average cost per WI": "avg_cost_per_wi_usd", "Prompt tokens": "prompt_tokens",
        "Completion tokens": "completion_tokens", "Total LLM time": "total_llm_time",
        "Price used (USD per 1M tokens, in / out)": "price_per_1m_in_out",
    }
    info = {}
    for i, l in enumerate(lines[:-1]):
        if l in want and want[l] not in info:
            info[want[l]] = lines[i + 1].strip(" |")
    for k in ("total_cost_usd", "avg_cost_per_wi_usd"):
        if k in info:
            try:
                info[k] = float(info[k].replace("$", "").replace(",", ""))
            except ValueError:
                pass
    for k in ("prompt_tokens", "completion_tokens", "max_tokens", "stages_generated"):
        if k in info:
            try:
                info[k] = int(info[k].replace(",", ""))
            except ValueError:
                pass
    if "total_llm_time" in info:
        m = re.match(r"([\d.]+)", info["total_llm_time"])
        if m:
            info["total_llm_time_s"] = float(m.group(1))
    return info


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("part_dir")
    ap.add_argument("--golden-dir", default="Hindi", help="sub-folder holding the golden WIs")
    args = ap.parse_args()

    part = Path(args.part_dir).resolve()
    if not part.is_dir():
        sys.exit(f"Not a directory: {part!r} (folder names may have leading/trailing spaces: quote them)")
    work = part / "eval_work"
    text = work / "text"
    text.mkdir(parents=True, exist_ok=True)
    (work / "verdicts").mkdir(exist_ok=True)
    rel = lambda p: str(p.relative_to(part))
    part_no = re.sub(r"[^0-9A-Za-z]", "", part.name) or part.name.strip()
    problems = []

    # --- golden ---
    gdir = part / args.golden_dir
    golden = {}
    for f in sorted(gdir.glob("*.xls*")):
        st = stage_of(f.name)
        if not st:
            problems.append(f"golden file without _Stage_NN in name: {f.name}")
            continue
        src = to_xlsx(f, work)
        (text / f"golden_Stage_{st}.txt").write_text(dump_xlsx(src))
        golden[st] = {"file": rel(f), "text": rel(text / f"golden_Stage_{st}.txt")}
    if not golden:
        sys.exit(f"No golden WIs found in {gdir}")

    # --- PPAP source (workbook(s) in the part root) ---
    ppap = []
    for f in sorted(part.glob("*.xls*")):
        if f.name.startswith(("MODEL_COMPARISON", "~$")):
            continue
        try:
            src = to_xlsx(f, work)
            out = text / ("ppap.txt" if not ppap else f"ppap_{len(ppap)+1}.txt")
            out.write_text(dump_xlsx(src))
            ppap.append({"file": rel(f), "text": rel(out)})
        except Exception as e:  # noqa: BLE001
            problems.append(f"could not read PPAP {f.name}: {e}")
    if not ppap:
        problems.append("no PPAP workbook found in the part folder; extra content cannot be checked against the source")

    # --- models ---
    models = {}
    gen = part / "Generated"
    for mdir in sorted(p for p in gen.iterdir() if p.is_dir()):
        entry = {"folder": rel(mdir), "stages": {}, "cost": {}}
        for f in sorted(mdir.glob("WI_*.xls*")):
            st = stage_of(f.name)
            if not st:
                problems.append(f"{mdir.name}: WI file without _Stage_NN: {f.name}")
                continue
            if st in entry["stages"]:
                problems.append(f"{mdir.name}: two WI files for Stage {st}; using {entry['stages'][st]['file']}")
                continue
            out = text / f"{mdir.name}_Stage_{st}.txt"
            out.write_text(dump_xlsx(to_xlsx(f, work)))
            entry["stages"][st] = {"file": rel(f), "text": rel(out),
                                   "verdicts": f"eval_work/verdicts/{mdir.name}_Stage_{st}.json",
                                   "judge_result": f"{rel(mdir)}/judge_result_{mdir.name}_Stage_{st}.json"}
        cost = sorted(mdir.glob("COST_*.docx"))
        if cost:
            entry["cost"] = parse_cost(cost[0])
            entry["cost"]["file"] = rel(cost[0])
        else:
            problems.append(f"{mdir.name}: no COST_*.docx")
        for st in golden:
            if st not in entry["stages"]:
                problems.append(f"{mdir.name}: no generated WI for Stage {st}")
        models[mdir.name] = entry

    manifest = {
        "part_dir": str(part), "part_no": part_no, "prepared_on": date.today().isoformat(),
        "golden_dir": args.golden_dir, "stages": sorted(golden), "golden": golden,
        "ppap": ppap, "models": models,
        "golden_facts": {st: f"eval_work/golden_facts_Stage_{st}.json" for st in golden},
        "report_notes": "eval_work/report_notes.json",
        "problems": problems,
    }
    (work / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False))

    print(f"Part {part_no}: {len(golden)} stage(s) {sorted(golden)}, {len(models)} model(s)")
    for name, m in models.items():
        c = m["cost"]
        print(f"  {name:22s} stages={sorted(m['stages'])}  model_id={c.get('provider_model_id','?')}  "
              f"cost=${c.get('total_cost_usd','?')}")
    print(f"PPAP text: {[p['text'] for p in ppap]}")
    for p in problems:
        print("WARNING:", p)
    print(f"Wrote {rel(work / 'manifest.json')} and text dumps in {rel(text)}/")


if __name__ == "__main__":
    main()

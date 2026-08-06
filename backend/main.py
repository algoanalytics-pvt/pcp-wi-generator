"""
backend/main.py — FastAPI backend for PCP → Work Instruction Generator

Run with:
    uvicorn main:app --reload --port 8000
(from inside backend/)
"""

import os
import re
import sys
import uuid
import json
import tempfile
from pathlib import Path
from datetime import date
from typing import Optional

import openpyxl
# pyrefly: ignore [missing-import]
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
from fastapi.responses import JSONResponse # pyright: ignore[reportMissingImports]
# pyrefly: ignore [missing-import]
from fastapi.responses import StreamingResponse, HTMLResponse   
# pyrefly: ignore [missing-import]
from pydantic import BaseModel

_backend_dir = Path(__file__).parent.resolve()
sys.path.insert(0, str(_backend_dir))

# pyrefly: ignore [missing-import]
from dotenv import load_dotenv
load_dotenv(dotenv_path=_backend_dir / ".env", override=True)
load_dotenv(override=False)

from parser import load_pcp, get_sheet_names, load_pcp_sheet, ensure_unique_columns
from prompt_builder import dataframe_to_json, dataframe_to_text, build_prompt
from llm_client import call_llm, parse_json_response, PROVIDERS
from docx_reader import read_wi_file
from generator import generate_csv, generate_csv_bytes
from Beautiful_excel_generator import generate_beautiful_wi

# ── App setup ─────────────────────────────────────────────────────────────────
app = FastAPI(title="PCP → WI Generator API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory session store ───────────────────────────────────────────────────
# sessions[session_id] = {
#   "tmp_path": str,
#   "base_name": str,
#   "pcp_sheets": { sheet_key: {"meta": {}, "df": DataFrame} },
#   "non_pcp_sheets": { sheet_name: DataFrame|None },
#   "results": { stage_label: { "wi_data": {}, "csv_bytes": b"", "xlsx_bytes": b"" } },
# }
sessions: dict = {}

TRAINING_DIR = _backend_dir / "training_data"

# ── PCP detection constants ───────────────────────────────────────────────────
_PCP_SHEET_KEYWORDS = [
    "p-c-p", "pcp", "pc plan", "process control plan", "control plan", "p.c.p",
]
_PCP_EXCLUDED_SHEET_NAMES = [
    "document review", "cover", "lable", "label", "index", "contents",
]


# ─────────────────────────────────────────────────────────────────────────────
# Helper functions (copied logic from app.py, no changes to originals)
# ─────────────────────────────────────────────────────────────────────────────

def _is_excluded_pcp_sheet(sheet_name: str) -> bool:
    name = sheet_name.lower().strip()
    return any(name == ex or name.startswith(ex) for ex in _PCP_EXCLUDED_SHEET_NAMES)


def _sheet_name_looks_like_pcp(sheet_name: str) -> bool:
    name = sheet_name.lower().strip()
    return any(kw in name for kw in _PCP_SHEET_KEYWORDS)


def _is_real_xlsx(path: str) -> bool:
    try:
        with open(path, "rb") as f:
            return f.read(2) == b"PK"
    except Exception:
        return False


def _convert_xls_to_xlsx(xls_path: str) -> str:
    import xlrd
    from datetime import datetime as dt
    rb = xlrd.open_workbook(xls_path, formatting_info=True)
    wb_out = openpyxl.Workbook()
    wb_out.remove(wb_out.active)
    for sheet_name in rb.sheet_names():
        sh = rb.sheet_by_name(sheet_name)
        safe_name = sheet_name[:31]
        ws = wb_out.create_sheet(title=safe_name)
        for r in range(sh.nrows):
            for c in range(sh.ncols):
                cell = sh.cell(r, c)
                val = cell.value
                if cell.ctype == 3:
                    try:
                        date_tuple = xlrd.xldate_as_tuple(val, rb.datemode)
                        val = dt(*date_tuple)
                    except Exception:
                        pass
                elif val == "":
                    val = None
                ws.cell(row=r + 1, column=c + 1, value=val)
        try:
            for crange in sh.merged_cells:
                r1, r2, c1, c2 = crange
                ws.merge_cells(start_row=r1+1, start_column=c1+1, end_row=r2, end_column=c2)
        except Exception:
            pass
    out_path = xls_path.rsplit(".", 1)[0] + "_converted.xlsx"
    wb_out.save(out_path)
    return out_path


def _save_upload_file(upload: UploadFile) -> str:
    ext = "." + upload.filename.rsplit(".", 1)[-1].lower()
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(upload.file.read())
        tmp_path = tmp.name
    if ext == ".xls":
        try:
            return _convert_xls_to_xlsx(tmp_path)
        except Exception:
            return tmp_path
    return tmp_path


def _find_pcp_blocks_in_sheet(file_path: str, sheet_name: str) -> list:
    try:
        wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
        if sheet_name not in wb.sheetnames:
            return []
        ws = wb[sheet_name]
        all_rows = list(ws.iter_rows(values_only=True))
        total_rows = len(all_rows)
        title_rows = []
        for i, row in enumerate(all_rows):
            for j, cell in enumerate(row):
                if (j < 4 and isinstance(cell, str)
                        and ("process control plan" in cell.lower() or "control plan" in cell.lower())
                        and "number" not in cell.lower()):
                    title_rows.append(i + 1)
                    break
        if not title_rows:
            return []
        blocks = []
        for idx, start_row in enumerate(title_rows):
            end_row = (title_rows[idx + 1] - 1) if idx + 1 < len(title_rows) else total_rows
            plan_number = ""
            stage_label = f"Stage {idx + 1:02d}"
            for ri in range(start_row - 1, min(start_row + 14, total_rows)):
                row_cells = [str(c).strip() for c in all_rows[ri] if isinstance(c, str) and str(c).strip()]
                row_joined = " ".join(row_cells)
                if "process control plan number" in row_joined.lower():
                    low = row_joined.lower()
                    label_pos = low.find("process control plan number")
                    after = row_joined[label_pos + len("process control plan number"):]
                    after = after.lstrip(":").strip()
                    plan_number = after if after else row_joined.strip()
                    plan_number = re.split(
                        r"\s+(?:Customer Engineering|Approval/Date|Other Approval|Core Team|Supplier)",
                        plan_number, flags=re.IGNORECASE
                    )[0].strip().rstrip("- ").strip().lstrip(": ").strip()
                    m = re.search(r"\(stage\s+([^)]+)\)", row_joined, re.IGNORECASE)
                    if m:
                        stage_label = f"Stage {m.group(1).strip()}"
                    else:
                        m2 = re.search(r"[/\-]\s*(\d{2,3})\s*$", plan_number.strip())
                        if m2:
                            stage_label = f"Stage {m2.group(1)}"
                    break
            blocks.append({"start_row": start_row, "end_row": end_row,
                           "plan_number": plan_number, "stage_label": stage_label})
        return blocks
    except Exception:
        return []


def _extract_pcp_meta(file_path: str, sheet_name: str) -> dict:
    meta = {"part_name": "", "part_no": "", "plan_number": "", "stage_label": sheet_name}
    try:
        wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
        ws = wb[sheet_name]
        for row in ws.iter_rows(max_row=10, values_only=True):
            row_cells = [str(c).strip() for c in row if isinstance(c, str) and str(c).strip()]
            row_joined = " ".join(row_cells)
            cl = row_joined.lower()
            if "process control plan number" in cl:
                label_pos = cl.find("process control plan number")
                after = row_joined[label_pos + len("process control plan number"):]
                after = after.lstrip(":").strip()
                plan_number = after if after else row_joined.strip()
                plan_number = re.split(
                    r"\s+(?:Customer Engineering|Approval/Date|Other Approval|Core Team|Supplier)",
                    plan_number, flags=re.IGNORECASE
                )[0].strip()
                meta["plan_number"] = plan_number.rstrip("- ").strip().lstrip(": ").strip()
                m = re.search(r'\(stage\s+([^)]+)\)', row_joined, re.IGNORECASE)
                if m:
                    meta["stage_label"] = f"Stage {m.group(1).strip()}"
                else:
                    m2 = re.search(r'[/\-]\s*(\d{2,3})\s*$', plan_number.strip())
                    if m2:
                        meta["stage_label"] = f"Stage {m2.group(1)}"
            elif "part name" in cl:
                after_full = row_joined[cl.find("part name"):]
                val = after_full.split(":", 1)[-1].strip() if ":" in after_full else ""
                if val:
                    meta["part_name"] = val
            elif "part number" in cl:
                after_full = row_joined[cl.find("part number"):]
                val = after_full.split(":", 1)[-1].strip() if ":" in after_full else ""
                if val:
                    meta["part_no"] = val.split("/")[0].strip()
    except Exception:
        pass
    return meta


_OPERATION_COLUMN_NAMES = ("process name", "operation", "process")


def _row_and_operation_counts(df) -> tuple:
    """Real counts derived from a parsed PCP block: total data rows, and
    distinct operations (from a Process Name / Operation column if present)."""
    row_count = len(df)
    op_col = next(
        (c for c in df.columns if str(c).strip().lower() in _OPERATION_COLUMN_NAMES),
        None,
    )
    operation_count = int(df[op_col].dropna().nunique()) if op_col is not None else None
    return row_count, operation_count


def render_sheet_block_html(file_path: str, sheet_name: str, start_row: int, end_row) -> str:
    try:
        wb = openpyxl.load_workbook(file_path, data_only=True)
        if sheet_name not in wb.sheetnames:
            return "<p><i>Sheet not found.</i></p>"
        ws = wb[sheet_name]
        max_row = ws.max_row
        max_col = ws.max_column
        real_max_col = 0
        r_end_probe = max_row if end_row is None else min(end_row, max_row)
        r_start_probe = max(1, start_row)
        for row in ws.iter_rows(min_row=r_start_probe, max_row=r_end_probe, values_only=False):
            for cell in row:
                if cell.value is not None:
                    real_max_col = max(real_max_col, cell.column)
        if real_max_col:
            max_col = min(max_col, real_max_col)
        max_col = min(max_col, 30)
        r_start = max(1, start_row)
        r_end   = max_row if end_row is None else min(end_row, max_row)
        if r_end < r_start:
            r_end = r_start
        merges = []
        for mr in ws.merged_cells.ranges:
            if mr.max_row >= r_start and mr.min_row <= r_end:
                merges.append(mr)
        anchor_span = {}
        covered = set()
        for mr in merges:
            top_row = max(mr.min_row, r_start)
            top_col = mr.min_col
            bottom_row = min(mr.max_row, r_end)
            bottom_col = mr.max_col
            rowspan = bottom_row - top_row + 1
            colspan = bottom_col - top_col + 1
            anchor_span[(top_row, top_col)] = (rowspan, colspan)
            for rr in range(top_row, bottom_row + 1):
                for cc in range(top_col, bottom_col + 1):
                    if (rr, cc) != (top_row, top_col):
                        covered.add((rr, cc))
        col_widths = {}
        for col_letter, dim in ws.column_dimensions.items():
            if dim.width:
                try:
                    idx = openpyxl.utils.column_index_from_string(col_letter)
                    col_widths[idx] = max(20, int(dim.width * 7))
                except Exception:
                    pass
        html_parts = ['<table style="border-collapse:collapse;font-size:12px;font-family:Calibri,Arial,sans-serif;">']
        html_parts.append("<colgroup>")
        for c in range(1, max_col + 1):
            w = col_widths.get(c, 64)
            html_parts.append(f'<col style="width:{w}px;">')
        html_parts.append("</colgroup>")
        for r in range(r_start, r_end + 1):
            html_parts.append("<tr>")
            for c in range(1, max_col + 1):
                if (r, c) in covered:
                    continue
                cell = ws.cell(row=r, column=c)
                val  = cell.value
                text = "" if val is None else str(val)
                text = text.replace("\n", "<br>")
                span = anchor_span.get((r, c))
                span_attr = ""
                if span:
                    rs, cs = span
                    if rs > 1: span_attr += f' rowspan="{rs}"'
                    if cs > 1: span_attr += f' colspan="{cs}"'
                style_parts = ["border:1px solid #d0d0d0", "padding:3px 5px",
                                "white-space:pre-wrap", "vertical-align:middle"]
                if cell.font and cell.font.bold:
                    style_parts.append("font-weight:bold")
                align = cell.alignment.horizontal if cell.alignment else None
                if align:
                    style_parts.append(f"text-align:{align}")
                try:
                    fill = cell.fill
                    if fill and fill.fgColor and fill.fgColor.rgb and fill.fill_type == "solid":
                        rgb = fill.fgColor.rgb
                        if isinstance(rgb, str) and len(rgb) == 8:
                            style_parts.append(f"background-color:#{rgb[2:]}")
                except Exception:
                    pass
                style = ";".join(style_parts)
                html_parts.append(f'<td{span_attr} style="{style}">{text}</td>')
            html_parts.append("</tr>")
        html_parts.append("</table>")
        return (
            '<div style="overflow:auto;max-height:500px;border:1px solid #ccc;'
            'padding:4px;background:#fff;">' + "".join(html_parts) + "</div>"
        )
    except Exception as e:
        return f"<p><i>Preview unavailable: {e}</i></p>"


def _load_fixed_training_pair():
    errors = []
    TRAINING_DIR.mkdir(parents=True, exist_ok=True)

    def _looks_like_pcp(path: Path) -> bool:
        try:
            with open(str(path), "rb") as f:
                magic = f.read(2)
            if magic != b"PK":
                import pandas as pd
                df = pd.read_csv(str(path), nrows=5, header=None, dtype=str)
                for _, row in df.iterrows():
                    for j, cell in enumerate(row):
                        if j < 4 and isinstance(cell, str) \
                                and ("process control plan" in cell.lower() or "control plan" in cell.lower()) \
                                and "number" not in cell.lower():
                            return True
                return False
            wb = openpyxl.load_workbook(str(path), read_only=True, data_only=True)
            for sheet_name in wb.sheetnames:
                ws = wb[sheet_name]
                for row in ws.iter_rows(max_row=5, values_only=True):
                    for j, cell in enumerate(row):
                        if j < 4 and isinstance(cell, str) \
                                and ("process control plan" in cell.lower() or "control plan" in cell.lower()) \
                                and "number" not in cell.lower():
                            return True
        except Exception:
            pass
        return False

    all_xlsx = sorted(TRAINING_DIR.glob("*.xlsx")) + sorted(TRAINING_DIR.glob(".*.xlsx"))
    all_docx = sorted(TRAINING_DIR.glob("*.docx")) + sorted(TRAINING_DIR.glob(".*.docx"))
    all_csv  = sorted(TRAINING_DIR.glob("*.csv"))  + sorted(TRAINING_DIR.glob(".*.csv"))

    ex_df = None
    pcp_path = None
    for exact in ["training_pcp.xlsx", ".training_pcp.xlsx", "training_pcp.csv", ".training_pcp.csv"]:
        if (TRAINING_DIR / exact).exists():
            pcp_path = TRAINING_DIR / exact
            break
    if pcp_path is None:
        for f in all_xlsx + all_csv:
            if _looks_like_pcp(f):
                pcp_path = f
                break
    if pcp_path:
        try:
            import pandas as pd
            if pcp_path.suffix.lower() == ".csv" or not _is_real_xlsx(str(pcp_path)):
                ex_df = pd.read_csv(str(pcp_path))
            else:
                ex_df = load_pcp(str(pcp_path))
        except Exception as e:
            errors.append(f"{pcp_path.name} load failed: {e}")
    else:
        errors.append("training_pcp.xlsx not found — add it to training_data/ folder.")

    ex_wi_text = None
    wi_candidates = []
    for name in ["training_wi.xlsx", "training_wi.docx", "training_wi.csv"]:
        p = TRAINING_DIR / name
        if p.exists():
            wi_candidates.insert(0, p)
    for f in all_xlsx + all_docx + all_csv:
        if f not in wi_candidates and f != pcp_path:
            wi_candidates.append(f)
    for candidate in wi_candidates:
        try:
            ex_wi_text = read_wi_file(str(candidate))
            if ex_wi_text:
                break
        except Exception as e:
            errors.append(f"{candidate.name} load failed: {e}")
    if ex_wi_text is None and not any("training_wi" in e for e in errors):
        errors.append("training_wi file not found — add training_wi.xlsx/.docx/.csv to training_data/.")

    return ex_df, ex_wi_text, errors


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/providers")
def get_providers():
    """Return all providers and their models."""
    result = {}
    for prov, cfg in PROVIDERS.items():
        result[prov] = {
            "models": list(cfg["models"].keys()),
            "env_key": cfg["env_key"],
            "key_set": bool(os.environ.get(cfg["env_key"], "")),
        }
    return result


@app.get("/api/training-status")
def training_status():
    """Check if training data files are present and valid."""
    ex_df, ex_wi_text, errors = _load_fixed_training_pair()
    return {
        "ready": ex_df is not None and bool(ex_wi_text),
        "pcp_loaded": ex_df is not None,
        "wi_loaded": bool(ex_wi_text),
        "errors": errors,
    }


@app.post("/api/upload-pcp")
async def upload_pcp(file: UploadFile = File(...)):
    """
    Upload a PCP file. Returns session_id and list of detected sheets.
    """
    import pandas as pd

    session_id = uuid.uuid4().hex
    tmp_path   = _save_upload_file(file)
    base_name  = file.filename.rsplit(".", 1)[0]
    ext        = tmp_path.rsplit(".", 1)[-1].lower()

    pcp_found   = {}
    non_pcp     = {}

    sheet_names = get_sheet_names(tmp_path) if ext in ("xlsx", "xls") else []

    if not sheet_names:
        # CSV — treat as single PCP
        try:
            df = load_pcp(tmp_path)
            row_count, operation_count = _row_and_operation_counts(df)
            pcp_found[base_name] = {
                "meta": {
                    "stage_label": base_name, "part_name": "", "part_no": "", "plan_number": "",
                    "row_count": row_count, "operation_count": operation_count,
                },
                "df": df.to_dict(orient="records"),
                "columns": list(df.columns),
            }
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not read CSV: {e}")
    else:
        for sn in sheet_names:
            if _is_excluded_pcp_sheet(sn):
                try:
                    df = load_pcp_sheet(tmp_path, sn)
                    non_pcp[sn] = {"columns": list(df.columns), "rows": len(df)}
                except Exception:
                    non_pcp[sn] = None
                continue

            blocks = _find_pcp_blocks_in_sheet(tmp_path, sn)

            if not blocks and _sheet_name_looks_like_pcp(sn):
                try:
                    meta_fb = _extract_pcp_meta(tmp_path, sn)
                    blocks = [{
                        "start_row": 1,
                        "end_row": None,
                        "plan_number": meta_fb.get("plan_number", ""),
                        "stage_label": meta_fb.get("stage_label", sn),
                    }]
                except Exception:
                    blocks = []

            if blocks:
                for blk in blocks:
                    key = f"{sn} | {blk['stage_label']}" if len(blocks) > 1 else sn
                    try:
                        wb_tmp = openpyxl.load_workbook(tmp_path, read_only=True, data_only=True)
                        ws_tmp = wb_tmp[sn]
                        all_rows = list(ws_tmp.iter_rows(values_only=True))
                        block_rows = all_rows[blk["start_row"] - 1: blk["end_row"]]
                        df = pd.DataFrame(block_rows).dropna(how="all").dropna(axis=1, how="all")
                        df.columns = [str(c) for c in df.columns]
                        row_count, operation_count = _row_and_operation_counts(df)
                        meta = {
                            "stage_label": blk["stage_label"],
                            "plan_number": blk["plan_number"],
                            "part_name": "",
                            "part_no": "",
                            "sheet_name": sn,
                            "start_row": blk["start_row"],
                            "end_row": blk["end_row"],
                            "row_count": row_count,
                            "operation_count": operation_count,
                        }
                        pcp_found[key] = {
                            "meta": meta,
                            "df": df.to_dict(orient="records"),
                            "columns": list(df.columns),
                        }
                    except Exception:
                        pass
            else:
                try:
                    df = load_pcp_sheet(tmp_path, sn)
                    non_pcp[sn] = {"columns": list(df.columns), "rows": len(df)}
                except Exception:
                    non_pcp[sn] = None

    sessions[session_id] = {
        "tmp_path": tmp_path,
        "base_name": base_name,
        "pcp_sheets": pcp_found,
        "non_pcp_sheets": non_pcp,
        "results": {},
    }

    return {
        "session_id": session_id,
        "base_name": base_name,
        "pcp_sheets": [
            {
                "key": k,
                "meta": v["meta"],
                "columns": v["columns"],
            }
            for k, v in pcp_found.items()
        ],
        "non_pcp_sheets": [
            {"sheet_name": sn, "info": info}
            for sn, info in non_pcp.items()
        ],
        "total_pcp": len(pcp_found),
        "total_non_pcp": len(non_pcp),
    }


@app.get("/api/sheet-preview/{session_id}/{sheet_key}")
def sheet_preview(session_id: str, sheet_key: str):
    """Return HTML preview of a PCP sheet block."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    sess = sessions[session_id]
    pcp_sheets = sess["pcp_sheets"]
    tmp_path   = sess["tmp_path"]

    if sheet_key not in pcp_sheets:
        raise HTTPException(status_code=404, detail="Sheet key not found")

    meta       = pcp_sheets[sheet_key]["meta"]
    sheet_name = meta.get("sheet_name", sheet_key)
    start_row  = meta.get("start_row", 1)
    end_row    = meta.get("end_row", None)

    html = render_sheet_block_html(tmp_path, sheet_name, start_row, end_row)
    return HTMLResponse(content=html)


class GenerateRequest(BaseModel):
    session_id: str
    selected_sheets: list[str]   # list of sheet keys
    language: str = "english"    # english | hindi | marathi
    model: Optional[str] = None  # auto-detected from env if None
    temperature: float = 0.2
    max_tokens: int = 4000


@app.post("/api/generate")
def generate(req: GenerateRequest):
    """
    Generate Work Instructions for selected PCP sheets.
    Returns all results in one response.
    """
    import pandas as pd

    if req.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    sess       = sessions[req.session_id]
    pcp_sheets = sess["pcp_sheets"]
    base_name  = sess["base_name"]

    # Load training pair
    ex_df, ex_wi_text, load_errors = _load_fixed_training_pair()
    if ex_df is None or not ex_wi_text:
        raise HTTPException(
            status_code=400,
            detail=f"Training data not ready: {'; '.join(load_errors)}"
        )

    # Resolve model + API key
    model = req.model
    if not model:
        for prov, cfg in PROVIDERS.items():
            if os.environ.get(cfg["env_key"], ""):
                model = list(cfg["models"].keys())[0]
                break
    if not model:
        raise HTTPException(
            status_code=400,
            detail="No API key found. Set GROQ_API_KEY, MISTRAL_API_KEY, or another provider key in .env"
        )

    ex_input_text = dataframe_to_json(ex_df)
    results       = {}
    errors        = []
    date_str      = date.today().strftime("%Y%m%d")

    for sheet_key in req.selected_sheets:
        if sheet_key not in pcp_sheets:
            errors.append(f"Sheet key not found: {sheet_key}")
            continue

        entry      = pcp_sheets[sheet_key]
        meta       = entry["meta"]
        stage_label = meta.get("stage_label", sheet_key)
        plan_no    = meta.get("plan_number", "")

        # Reconstruct DataFrame from stored records
        df = pd.DataFrame(entry["df"])

        new_input_text = dataframe_to_json(df)
        prompt = build_prompt(ex_input_text, ex_wi_text, new_input_text, "oneshot", req.language)

        # Call LLM
        try:
            raw_response = call_llm(prompt, model=model, temperature=req.temperature, max_tokens=req.max_tokens)
        except Exception as e:
            errors.append(f"LLM error on {stage_label}: {e}")
            continue

        # Parse response
        try:
            wi_data = parse_json_response(raw_response)
        except ValueError as e:
            errors.append(f"JSON parse failed for {stage_label}: {str(e)[:200]}")
            continue

        # Inject plan number
        if plan_no:
            doc = wi_data.get("document") or wi_data.setdefault("document", {})
            doc["wi_number"]  = plan_no
            doc["pcp_number"] = plan_no

        # Inject the real stage number extracted from the PCP (the LLM tends to
        # just copy "1" from the one-shot example instead of inferring this).
        m_stage = re.search(r'(\d+)', stage_label)
        if m_stage:
            doc = wi_data.get("document") or wi_data.setdefault("document", {})
            doc["stage_no"] = m_stage.group(1)

        # Generate outputs
        safe_label = re.sub(r'[^\w\-]', '_', stage_label)
        os.makedirs(str(_backend_dir / "outputs"), exist_ok=True)

        csv_bytes  = generate_csv_bytes(wi_data) or b""
        xlsx_bytes = None
        xlsx_error = None
        try:
            xlsx_path = str(_backend_dir / "outputs" / f"WI_{date_str}_{base_name}_{safe_label}.xlsx")
            generate_beautiful_wi(wi_data, xlsx_path)
            with open(xlsx_path, "rb") as f:
                xlsx_bytes = f.read()
        except Exception as e:
            xlsx_error = str(e)

        import base64
        results[stage_label] = {
            "wi_data":     wi_data,
            "csv_b64":     base64.b64encode(csv_bytes).decode(),
            "xlsx_b64":    base64.b64encode(xlsx_bytes).decode() if xlsx_bytes else None,
            "xlsx_error":  xlsx_error,
            "file_prefix": f"WI_{date_str}_{base_name}_{safe_label}",
        }

    # Cache results in session
    sess["results"] = results

    return {
        "completed": len(results),
        "errors": errors,
        "results": results,
    }


@app.post("/api/add-non-pcp-as-wi/{session_id}/{sheet_name}")
def add_non_pcp_as_wi(session_id: str, sheet_name: str):
    """Move a non-PCP sheet into the PCP sheet list so it can be generated."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    sess       = sessions[session_id]
    tmp_path   = sess["tmp_path"]
    non_pcp    = sess["non_pcp_sheets"]

    if sheet_name not in non_pcp:
        raise HTTPException(status_code=404, detail="Sheet not found in non-PCP sheets")

    try:
        df   = load_pcp_sheet(tmp_path, sheet_name)
        meta = _extract_pcp_meta(tmp_path, sheet_name)
        if not meta["stage_label"] or meta["stage_label"] == sheet_name:
            meta["stage_label"] = sheet_name
        meta["row_count"], meta["operation_count"] = _row_and_operation_counts(df)
        sess["pcp_sheets"][sheet_name] = {
            "meta": meta,
            "df": df.to_dict(orient="records"),
            "columns": list(df.columns),
        }
        del sess["non_pcp_sheets"][sheet_name]
        return {"status": "ok", "added_sheet": sheet_name, "meta": meta}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

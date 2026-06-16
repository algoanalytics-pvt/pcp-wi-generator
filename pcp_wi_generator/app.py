"""
app.py — PCP → Work Instruction Generator

Training pair is fixed — drop files into the training_data/ folder:
  training_data/training_pcp.xlsx   ← example PCP  (required)
  training_data/training_wi.xlsx    ← matching WI   (required; .docx/.csv also accepted)

PCP detection scans every sheet using two rules:
  (1) "PROCESS CONTROL PLAN" or "CONTROL PLAN" in first 3 rows, columns 0-3
  (2) "Process Control Plan Number" anywhere in first 10 rows
Each passing sheet = one WI. Non-PCP sheets are hidden but recoverable.
"""

import os
import re
import json
import uuid
import tempfile
from datetime import date, datetime
from pathlib import Path

import streamlit as st
import openpyxl
from dotenv import load_dotenv

_here = Path(__file__).parent.resolve()
load_dotenv(dotenv_path=_here / ".env", override=True)
load_dotenv(override=False)

from parser import (
    load_pcp, dataframe_summary,
    get_sheet_names, load_pcp_sheet,
    split_pcp_by_stage, ensure_unique_columns,
)
from prompt_builder import dataframe_to_json, dataframe_to_text, build_prompt
from llm_client import call_llm, parse_json_response, PROVIDERS
from docx_reader import read_wi_file
from generator import generate_csv, generate_csv_bytes
from Beautiful_excel_generator import generate_beautiful_wi

# ─────────────────────────────────────────────────────────────────────────────
# Page config
# ─────────────────────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="PCP → Work Instruction Generator",
    page_icon="🏭",
    layout="wide",
)

# ─────────────────────────────────────────────────────────────────────────────
# LOGO PATH — paste the absolute path to your company logo image here.
# Example (Windows): r"C:\Users\YourName\Pictures\sharada_logo.png"
# Example (Linux/Mac): "/home/user/images/sharada_logo.png"
# Leave as empty string "" to show a text fallback instead.
# ─────────────────────────────────────────────────────────────────────────────
COMPANY_LOGO_PATH = "D:\\pcp_wi_generator\\image004 (1).png"

import base64 as _base64

def _logo_html(path: str) -> str:
    """Return an <img> tag with the logo as base64, or a styled text fallback."""
    if path:
        try:
            ext = Path(path).suffix.lower().lstrip(".")
            mime = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
                    "svg": "image/svg+xml", "webp": "image/webp"}.get(ext, "image/png")
            with open(path, "rb") as _f:
                b64 = _base64.b64encode(_f.read()).decode()
            return (
                f'<img src="data:{mime};base64,{b64}" '
                f'style="height:48px;width:auto;object-fit:contain;display:block;" '
                f'alt="Sharada Industries logo">'
            )
        except Exception:
            pass
    # Fallback: styled "SI" monogram
    return (
        '<div style="width:48px;height:48px;border-radius:10px;'
        'background:linear-gradient(135deg,#E8521A,#F28C00);'
        'display:flex;align-items:center;justify-content:center;'
        'font-size:18px;font-weight:700;color:white;letter-spacing:-1px;">SI</div>'
    )

st.markdown("""
<style>
/* ── Global resets ── */
#MainMenu, footer, header { visibility: hidden; }
.block-container { padding-top: 0 !important; }

/* ── Branded header bar ── */
.si-topbar {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 28px;
    background: #ffffff;
    border-bottom: 2px solid #E8521A;
    margin-bottom: 24px;
}
.si-logo-wrap {
    width: 52px; height: 52px;
    border-radius: 10px;
    border: 1.5px solid #F0997B;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden; background: #fff;
    flex-shrink: 0;
}
.si-brand-name {
    font-size: 20px; font-weight: 700;
    color: #E8521A; letter-spacing: -0.3px;
    line-height: 1.2;
}
.si-brand-sub {
    font-size: 12px; color: #888; margin-top: 2px;
}

/* ── Step labels ── */
.si-step-label {
    display: flex; align-items: center; gap: 8px;
    font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.07em; color: #888;
    margin-bottom: 10px;
}
.si-step-num {
    width: 20px; height: 20px; border-radius: 50%;
    background: #E8521A; color: white;
    font-size: 11px; font-weight: 700;
    display: inline-flex; align-items: center; justify-content: center;
}

/* ── Style the real Streamlit file uploader as a branded drop zone ── */
[data-testid="stFileUploader"] {
    border: 2px dashed #F0997B !important;
    border-radius: 12px !important;
    background: #FFF8F5 !important;
    padding: 8px !important;
}
[data-testid="stFileUploader"]:hover {
    border-color: #E8521A !important;
    background: #FFF3EC !important;
}
[data-testid="stFileUploaderDropzoneInstructions"] p,
[data-testid="stFileUploaderDropzoneInstructions"] span {
    color: #993C1D !important;
    font-weight: 500 !important;
}
[data-testid="stFileUploader"] button {
    border-color: #E8521A !important;
    color: #E8521A !important;
}

/* ── Sheet list card ── */
.si-sheet-card {
    border: 1px solid #eee;
    border-radius: 12px;
    overflow: hidden;
    background: #fff;
}
.si-sheet-card-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 16px;
    background: #FAFAFA;
    border-bottom: 1px solid #eee;
    font-size: 13px; font-weight: 600; color: #333;
}
.si-queue-pill {
    display: inline-flex; align-items: center; gap: 4px;
    background: #EAF3DE; color: #3B6D11;
    border-radius: 999px; padding: 3px 12px;
    font-size: 11px; font-weight: 600;
}
.si-sheet-row {
    display: grid; grid-template-columns: 28px 1fr 36px 36px;
    align-items: center; gap: 10px;
    padding: 10px 16px;
    border-bottom: 1px solid #f5f5f5;
    font-size: 13px;
}
.si-sheet-row:last-child { border-bottom: none; }
.si-stage-tag {
    display: inline-flex; align-items: center;
    background: #FFF3E8; color: #993C1D;
    border-radius: 6px; padding: 2px 8px;
    font-size: 11px; font-weight: 600; margin-right: 6px;
}
.si-sheet-meta { font-size: 11px; color: #888; margin-top: 2px; }
.si-icon-btn {
    width: 30px; height: 30px; border-radius: 7px;
    border: 1px solid #eee; background: #FAFAFA;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: #888; font-size: 15px;
    text-decoration: none;
}

/* ── Generate button ── */
.si-gen-btn {
    width: 100%; padding: 14px;
    background: #E8521A; color: white;
    border: none; border-radius: 10px;
    font-size: 15px; font-weight: 700;
    cursor: pointer; display: flex;
    align-items: center; justify-content: center; gap: 8px;
}

/* ── Result card header ── */
.si-result-header {
    background: #E8521A; color: white;
    padding: 10px 18px; border-radius: 10px 10px 0 0;
    display: flex; align-items: center; justify-content: space-between;
    font-size: 14px; font-weight: 600;
}
.si-result-stage-chip {
    font-size: 11px; background: rgba(255,255,255,0.2);
    border-radius: 999px; padding: 2px 10px;
}

/* ── Rework / preview tables ── */
.rework-table { width:100%; border-collapse:collapse; font-size:14px; }
.rework-table th {
    text-align:left; padding:8px 10px; font-size:12px; font-weight:600;
    text-transform:uppercase; letter-spacing:0.04em;
    border-bottom:2px solid #e0c0a8; color:#666;
}
.rework-table td { padding:8px 10px; border-bottom:1px solid #f0e8e0; vertical-align:top; }
.rework-table tr:last-child td { border-bottom:none; }
.defect-badge {
    display:inline-block; background:#fff0e8; color:#993C1D;
    border-radius:4px; padding:3px 9px; font-size:12px; font-weight:600;
    white-space:nowrap;
}
.wi-badge {
    display:inline-block; background:#E8521A; color:white;
    border-radius:6px; padding:2px 10px; font-size:12px; font-weight:700;
    margin-right:6px;
}
</style>
""", unsafe_allow_html=True)

# ── Branded top bar ──────────────────────────────────────────────────────────
st.markdown(
    f"""
    <div class="si-topbar">
        <div class="si-logo-wrap">{_logo_html(COMPANY_LOGO_PATH)}</div>
        <div>
            <div class="si-brand-name">Sharada Industries</div>
            <div class="si-brand-sub">PCP → Work Instruction Generator</div>
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

# ─────────────────────────────────────────────────────────────────────────────
# Fixed configuration
# ─────────────────────────────────────────────────────────────────────────────
def _auto_detect_provider() -> tuple[str, str]:
    for prov, cfg in PROVIDERS.items():
        if os.environ.get(cfg["env_key"], ""):
            return prov, list(cfg["models"].keys())[0]
    return "mistral", list(PROVIDERS["mistral"]["models"].keys())[0]

_provider, _model_key = _auto_detect_provider()
provider     = _provider
model        = _model_key
strategy     = "oneshot"
input_format = "json"
temperature  = 0.2
max_tokens   = 4000

env_key       = PROVIDERS[provider]["env_key"]
api_key_input = os.environ.get(env_key, "")

# ─────────────────────────────────────────────────────────────────────────────
# Fixed training pair — loaded silently from training_data/ folder.
# To update: replace files in training_data/ and restart the app.
# ─────────────────────────────────────────────────────────────────────────────
TRAINING_DIR = _here / "training_data"

@st.cache_data(show_spinner=False)
def _load_fixed_training_pair():
    """
    Load training_pcp + training_wi from training_data/ once and cache.

    PCP detection (in priority order):
      1. training_pcp.xlsx  (exact name)
      2. Any .xlsx in training_data/ that is NOT a WI candidate — detected by
         scanning for "PROCESS CONTROL PLAN" in the first sheet.

    WI detection (in priority order):
      1. training_wi.xlsx / .docx / .csv  (exact names)
      2. Any remaining .xlsx / .docx / .csv not already used as the PCP.

    Returns (ex_df, ex_wi_text, errors).
    """
    errors = []
    TRAINING_DIR.mkdir(parents=True, exist_ok=True)

    # ── helpers ──────────────────────────────────────────────────────────────
    def _looks_like_pcp(path: Path) -> bool:
        """Check: does this file (real xlsx OR csv-renamed-as-xlsx) contain a PCP title?"""
        try:
            # Detect CSV disguised as xlsx by magic bytes (real xlsx is a zip: starts with PK)
            with open(str(path), "rb") as _f:
                magic = _f.read(2)
            if magic != b"PK":
                # It's a CSV — scan first 5 rows as text
                import pandas as pd
                df = pd.read_csv(str(path), nrows=5, header=None, dtype=str)
                for _, row in df.iterrows():
                    for j, cell in enumerate(row):
                        if j < 4 and isinstance(cell, str) \
                                and ("process control plan" in cell.lower() or "control plan" in cell.lower()) \
                                and "number" not in cell.lower():
                            return True
                return False
            # Real xlsx — scan all sheets
            import openpyxl as _ox
            wb = _ox.load_workbook(str(path), read_only=True, data_only=True)
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

    # ── Collect all files in training_data/ (including dot-prefixed hidden files) ──
    all_xlsx  = sorted(TRAINING_DIR.glob("*.xlsx")) + sorted(TRAINING_DIR.glob(".*.xlsx"))
    all_docx  = sorted(TRAINING_DIR.glob("*.docx")) + sorted(TRAINING_DIR.glob(".*.docx"))
    all_csv   = sorted(TRAINING_DIR.glob("*.csv"))  + sorted(TRAINING_DIR.glob(".*.csv"))

    # ── Training PCP ─────────────────────────────────────────────────────────
    ex_df = None
    pcp_path = None

    # Priority 1: exact names (including dot-prefixed variant)
    for exact in ["training_pcp.xlsx", ".training_pcp.xlsx",
                  "training_pcp.csv",  ".training_pcp.csv"]:
        if (TRAINING_DIR / exact).exists():
            pcp_path = TRAINING_DIR / exact
            break

    if pcp_path is None:
        # Priority 2: any xlsx/csv that looks like a PCP
        for f in all_xlsx + all_csv:
            if _looks_like_pcp(f):
                pcp_path = f
                break

    if pcp_path:
        try:
            import pandas as pd
            def _is_real_xlsx(path):
                try:
                    with open(str(path), "rb") as _f:
                        return _f.read(2) == b"PK"
                except Exception:
                    return False

            if pcp_path.suffix.lower() == ".csv" or not _is_real_xlsx(pcp_path):
                # Real CSV or CSV disguised as xlsx
                ex_df = pd.read_csv(str(pcp_path))
            else:
                ex_df = load_pcp(str(pcp_path))
        except Exception as e:
            errors.append(f"{pcp_path.name} load failed: {e}")
    else:
        errors.append("training_pcp.xlsx not found — add it to the training_data/ folder.")

    # ── Training WI ──────────────────────────────────────────────────────────
    ex_wi_text = None
    # Candidates: exact names first, then any remaining files
    wi_candidates = []
    for name in ["training_wi.xlsx", "training_wi.docx", "training_wi.csv"]:
        p = TRAINING_DIR / name
        if p.exists():
            wi_candidates.insert(0, p)  # exact name gets priority

    # Add any xlsx/docx/csv not already chosen as PCP
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
# PCP detection helpers (openpyxl-based, robust to merged cells)
# ─────────────────────────────────────────────────────────────────────────────

# Sheet name keywords - if sheet name matches any of these it is a PCP candidate
# (same list as batch_pcp_check.py)
_PCP_SHEET_KEYWORDS = [
    "p-c-p", "pcp", "pc plan", "process control plan",
    "control plan", "p.c.p",
]


# Sheet names that should NEVER be treated as PCP sheets, even if their
# content happens to mention "process control plan" (e.g. index/summary sheets)
_PCP_EXCLUDED_SHEET_NAMES = [
    "document review", "cover", "lable", "label", "index", "contents",
]


def _is_excluded_pcp_sheet(sheet_name: str) -> bool:
    name = sheet_name.lower().strip()
    return any(name == ex or name.startswith(ex) for ex in _PCP_EXCLUDED_SHEET_NAMES)


def _sheet_name_looks_like_pcp(sheet_name: str) -> bool:
    """Fast check: does the sheet NAME look like a PCP sheet?"""
    name = sheet_name.lower().strip()
    return any(kw in name for kw in _PCP_SHEET_KEYWORDS)


def _is_pcp_sheet(file_path: str, sheet_name: str) -> bool:
    """
    A sheet is a Process Control Plan if:
      Rule 1 — "PROCESS CONTROL PLAN" (or "CONTROL PLAN") appears in the first 3 rows, in columns 0-3.
      Rule 2 — "Process Control Plan Number" appears anywhere in the first 10 rows.
    Both rules must pass.
    """
    try:
        wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
        if sheet_name not in wb.sheetnames:
            return False
        ws = wb[sheet_name]

        # Rule 1
        title_found = False
        for row in ws.iter_rows(max_row=3, values_only=True):
            for j, cell in enumerate(row):
                if j < 4 and isinstance(cell, str) \
                        and ("process control plan" in cell.lower() or "control plan" in cell.lower()):
                    title_found = True
                    break
            if title_found:
                break
        if not title_found:
            return False

        # Rule 2
        for row in ws.iter_rows(max_row=10, values_only=True):
            for cell in row:
                if isinstance(cell, str) and "process control plan number" in cell.lower():
                    return True
        return False
    except Exception:
        return False


def _find_pcp_blocks_in_sheet(file_path: str, sheet_name: str) -> list:
    """
    Scan a sheet for ALL stacked PCP blocks (multiple PCPs in one sheet).
    Each block starts at a row containing "PROCESS CONTROL PLAN" or "CONTROL PLAN" in cols 0-3
    (excluding rows that contain "number" - those are plan number rows).
    Returns a list of dicts: [{start_row, end_row, plan_number, stage_label}, ...]
    Row numbers are 1-based. Returns empty list if no PCP blocks found.
    """
    try:
        wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
        if sheet_name not in wb.sheetnames:
            return []
        ws = wb[sheet_name]

        all_rows = list(ws.iter_rows(values_only=True))
        total_rows = len(all_rows)

        # Find every title row (start of a PCP block)
        title_rows = []
        for i, row in enumerate(all_rows):
            for j, cell in enumerate(row):
                if (j < 4 and isinstance(cell, str)
                        and ("process control plan" in cell.lower() or "control plan" in cell.lower())
                        and "number" not in cell.lower()):
                    title_rows.append(i + 1)  # 1-based
                    break

        if not title_rows:
            return []

        # For each title row, find the plan number and compute end_row
        blocks = []
        for idx, start_row in enumerate(title_rows):
            end_row = (title_rows[idx + 1] - 1) if idx + 1 < len(title_rows) else total_rows

            plan_number = ""
            stage_label = f"Stage {idx + 1:02d}"
            for ri in range(start_row - 1, min(start_row + 14, total_rows)):
                row_cells = [str(c).strip() for c in all_rows[ri] if isinstance(c, str) and str(c).strip()]
                row_joined = " ".join(row_cells)
                if "process control plan number" in row_joined.lower():
                    # Use the full row text (handles label/value split across columns)
                    full_text = row_joined
                    low = full_text.lower()
                    label_pos = low.find("process control plan number")
                    after = full_text[label_pos + len("process control plan number"):]
                    after = after.lstrip(":").strip()
                    plan_number = after if after else full_text.strip()
                    # Strip trailing boilerplate labels that got joined from other columns
                    plan_number = re.split(
                        r"\s+(?:Customer Engineering|Approval/Date|Other Approval|Core Team|Supplier)",
                        plan_number, flags=re.IGNORECASE
                    )[0].strip()
                    plan_number = plan_number.rstrip("- ").strip()
                    plan_number = plan_number.lstrip(": ").strip()

                    m = re.search(r"\(stage\s+([^)]+)\)", full_text, re.IGNORECASE)
                    if m:
                        stage_label = f"Stage {m.group(1).strip()}"
                    else:
                        m2 = re.search(r"[/\-]\s*(\d{2,3})\s*$", plan_number.strip())
                        if m2:
                            stage_label = f"Stage {m2.group(1)}"
                    break

            blocks.append({
                "start_row":   start_row,
                "end_row":     end_row,
                "plan_number": plan_number,
                "stage_label": stage_label,
            })

        return blocks
    except Exception:
        return []


def render_sheet_block_html(file_path: str, sheet_name: str, start_row: int, end_row) -> str:
    """
    Render a slice of an Excel sheet (rows start_row..end_row, 1-based, inclusive)
    as an HTML table that mimics how it looks when opened in Excel —
    preserving merged cells, column widths, and basic alignment.
    end_row=None means "to the end of the sheet".
    """
    try:
        wb = openpyxl.load_workbook(file_path, data_only=True)
        if sheet_name not in wb.sheetnames:
            return "<p><i>Sheet not found.</i></p>"
        ws = wb[sheet_name]

        max_row = ws.max_row
        max_col = ws.max_column
        # Avoid pathological huge tables: find the real last column with data
        # within the row range we're rendering
        real_max_col = 0
        r_end_probe = max_row if end_row is None else min(end_row, max_row)
        r_start_probe = max(1, start_row)
        for row in ws.iter_rows(min_row=r_start_probe, max_row=r_end_probe, values_only=False):
            for cell in row:
                if cell.value is not None:
                    real_max_col = max(real_max_col, cell.column)
        if real_max_col:
            max_col = min(max_col, real_max_col)
        max_col = min(max_col, 30)  # hard cap as a safety net
        r_start = max(1, start_row)
        r_end   = max_row if end_row is None else min(end_row, max_row)
        if r_end < r_start:
            r_end = r_start

        # Build a grid of (value, rowspan, colspan, skip) for the row range
        # Determine merged ranges that fall (at least partially) within this slice
        merges = []
        for mr in ws.merged_cells.ranges:
            if mr.max_row >= r_start and mr.min_row <= r_end:
                merges.append(mr)

        # Map top-left anchor -> (rowspan, colspan), and set of covered cells to skip
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

        # Column widths (approx px) from sheet definitions
        col_widths = {}
        for col_letter, dim in ws.column_dimensions.items():
            if dim.width:
                try:
                    idx = openpyxl.utils.column_index_from_string(col_letter)
                    col_widths[idx] = max(20, int(dim.width * 7))
                except Exception:
                    pass

        html_parts = ['<table style="border-collapse:collapse;font-size:12px;font-family:Calibri,Arial,sans-serif;">']

        # Column width row
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
                val = cell.value
                text = "" if val is None else str(val)
                text = text.replace("\n", "<br>")

                span = anchor_span.get((r, c))
                span_attr = ""
                if span:
                    rs, cs = span
                    if rs > 1:
                        span_attr += f' rowspan="{rs}"'
                    if cs > 1:
                        span_attr += f' colspan="{cs}"'

                # Basic style from cell formatting
                style_parts = [
                    "border:1px solid #d0d0d0",
                    "padding:3px 5px",
                    "white-space:pre-wrap",
                    "vertical-align:middle",
                ]
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


def _extract_stage_label(file_path: str, sheet_name: str) -> str:
    """
    Extract a human-readable stage label from the 'Process Control Plan Number' cell.
    Examples:
      'SI / PCP / 264747700101/01'           → 'Stage 01'
      'SI / PCP /  5502 6100 0106(Stage 1 of 16)'  → 'Stage 1 of 16'
      'SI / PCP /  5858 6010 0119 / (Stage 01 of 03)' → 'Stage 01 of 03'
    Falls back to sheet_name if nothing is found.
    """
    try:
        wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
        ws = wb[sheet_name]
        for row in ws.iter_rows(max_row=10, values_only=True):
            row_cells = [str(c).strip() for c in row if isinstance(c, str) and str(c).strip()]
            row_joined = " ".join(row_cells)
            cl = row_joined.lower()
            if "process control plan number" in cl:
                cell = row_joined
                # Try to find (Stage N of M) or (Stage NA of M)
                m = re.search(r'\(stage\s+([^)]+)\)', cell, re.IGNORECASE)
                if m:
                    return f"Stage {m.group(1).strip()}"
                # Try trailing /NN
                m2 = re.search(r'[/\-]\s*(\d{2,3})\s*$', cell.strip())
                if m2:
                    return f"Stage {m2.group(1)}"
                # Return the part after last slash/colon
                parts = re.split(r'[:,]', cell)
                if len(parts) > 1:
                    return parts[-1].strip()
    except Exception:
        pass
    return sheet_name


def _extract_pcp_meta(file_path: str, sheet_name: str) -> dict:
    """Extract key header fields from a PCP sheet for display."""
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
                meta["stage_label"] = _extract_stage_label(file_path, sheet_name)
            elif "part name" in cl or "part name / description" in cl:
                label_pos = cl.find("part name")
                # find end of label up to colon
                after_full = row_joined[label_pos:]
                val = after_full.split(":", 1)[-1].strip() if ":" in after_full else ""
                if val:
                    meta["part_name"] = val
            elif "part number" in cl or "part number / latest" in cl:
                label_pos = cl.find("part number")
                after_full = row_joined[label_pos:]
                val = after_full.split(":", 1)[-1].strip() if ":" in after_full else ""
                if val:
                    meta["part_no"] = val.split("/")[0].strip()
    except Exception:
        pass
    return meta

# ─────────────────────────────────────────────────────────────────────────────
# Shared helpers
# ─────────────────────────────────────────────────────────────────────────────

def _convert_xls_to_xlsx(xls_path: str) -> str:
    """Convert a legacy .xls file to .xlsx using xlrd + openpyxl, preserving
    sheet names, values, and merged cells. Returns path to new .xlsx file."""
    import xlrd
    rb = xlrd.open_workbook(xls_path, formatting_info=True)
    wb_out = openpyxl.Workbook()
    wb_out.remove(wb_out.active)

    for sheet_name in rb.sheet_names():
        sh = rb.sheet_by_name(sheet_name)
        # openpyxl sheet titles max 31 chars, must be unique
        safe_name = sheet_name[:31]
        ws = wb_out.create_sheet(title=safe_name)

        for r in range(sh.nrows):
            for c in range(sh.ncols):
                cell = sh.cell(r, c)
                val = cell.value
                if cell.ctype == 3:  # XL_CELL_DATE
                    try:
                        date_tuple = xlrd.xldate_as_tuple(val, rb.datemode)
                        val = datetime(*date_tuple)
                    except Exception:
                        pass
                elif val == "":
                    val = None
                ws.cell(row=r + 1, column=c + 1, value=val)

        # Preserve merged cells
        try:
            for crange in sh.merged_cells:
                r1, r2, c1, c2 = crange
                ws.merge_cells(
                    start_row=r1 + 1, start_column=c1 + 1,
                    end_row=r2, end_column=c2,
                )
        except Exception:
            pass

    out_path = xls_path.rsplit(".", 1)[0] + "_converted.xlsx"
    wb_out.save(out_path)
    return out_path


def _save_upload(uploaded_file) -> str:
    ext = "." + uploaded_file.name.rsplit(".", 1)[-1].lower()
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(uploaded_file.read())
        tmp_path = tmp.name

    if ext == ".xls":
        try:
            return _convert_xls_to_xlsx(tmp_path)
        except Exception as e:
            st.error(f"Could not convert .xls file: {e}")
            return tmp_path

    return tmp_path


def _generate_outputs(wi_data: dict, base_name: str, stage_label: str):
    date_str   = date.today().strftime("%Y%m%d")
    safe_label = re.sub(r'[^\w\-]', '_', stage_label)
    os.makedirs("outputs", exist_ok=True)

    csv_path  = f"outputs/WI_{date_str}_{base_name}_{safe_label}.csv"
    xlsx_path = f"outputs/WI_{date_str}_{base_name}_{safe_label}.xlsx"

    generate_csv(wi_data, csv_path)

    xlsx_bytes = xlsx_error = None
    try:
        generate_beautiful_wi(wi_data, xlsx_path)
        with open(xlsx_path, "rb") as f:
            xlsx_bytes = f.read()
    except Exception as e:
        xlsx_error = str(e)

    csv_bytes = generate_csv_bytes(wi_data) or b""

    return dict(
        csv_bytes=csv_bytes, xlsx_bytes=xlsx_bytes,
        xlsx_error=xlsx_error, date_str=date_str,
        safe_label=safe_label, base_name=base_name,
    )


def _render_rework_table(rework_instructions: list):
    if not rework_instructions:
        return
    rows_html = ""
    for rw in rework_instructions:
        if isinstance(rw, dict):
            defect = rw.get("defect", "")
            action = rw.get("rework", rw.get("action", ""))
        else:
            defect, action = "", str(rw)
        rows_html += (
            f"<tr>"
            f"<td><span class='defect-badge'>{defect}</span></td>"
            f"<td>{action}</td>"
            f"</tr>"
        )
    st.markdown(
        f"""
        <table class='rework-table'>
          <thead><tr><th style='width:170px'>Defect</th><th>Corrective action</th></tr></thead>
          <tbody>{rows_html}</tbody>
        </table>
        """,
        unsafe_allow_html=True,
    )


def _render_wi_preview(wi_data: dict):
    h = wi_data.get("header") or wi_data.get("document") or {}

    with st.container(border=True):
        st.markdown("### 🏢 SHARADA INDUSTRIES — WORK INSTRUCTIONS")
        hc1, hc2, hc3 = st.columns([3, 3, 2])
        with hc1:
            st.markdown(f"**Factory / Area:** {h.get('line_area') or h.get('factory_line_area','')}")
            st.markdown(f"**Machine / Equipment:** {h.get('machine_equipment','')}")
            st.markdown(f"**Part No.:** {h.get('part_no','')}")
            st.markdown(f"**Drawing No.:** {h.get('drawing_no','')}")
            st.markdown(f"**Part Name:** {h.get('part_name','')}")
        with hc2:
            st.markdown(f"**Stage:** {h.get('stage_no','')}")
            st.markdown(f"**Stage Name:** {h.get('stage_name','')}")
            st.markdown(f"**Cycle Time:** {h.get('cycle_time','')}")
        with hc3:
            st.markdown(f"**WI No.:** {h.get('work_instruction_no') or h.get('wi_number','')}")
            st.markdown(f"**Rev No.:** {h.get('revision_no','')}")
            st.markdown(f"**Rev Date:** {h.get('revision_date','')}")

    left_col, right_col = st.columns([2, 3])
    with left_col:
        with st.container(border=True):
            st.markdown("**🖼️ Process Reference Image**")
            st.markdown(
                "<div style='height:260px;border:2px dashed #aaa;"
                "display:flex;align-items:center;justify-content:center;"
                "color:#aaa;font-size:13px;'>Insert part image here</div>",
                unsafe_allow_html=True,
            )
        if wi_data.get("process_note"):
            st.info(f"📌 {wi_data['process_note']}")

    with right_col:
        with st.container(border=True):
            st.markdown("**📋 Detailed Work Instructions**")
            for i, step in enumerate(wi_data.get("detailed_work_instructions", []), 1):
                st.markdown(f"{i}. {step}")

        with st.container(border=True):
            st.markdown("**🔧 Tooling / Equipment**")
            tooling = wi_data.get("tooling_equipments") or wi_data.get("tooling_equipment", [])
            for i, tool in enumerate(tooling, 1):
                st.markdown(f"{i}) {tool}")

        with st.container(border=True):
            st.markdown("**✅ Quality Parameters**")
            qp = wi_data.get("quality_parameters", {})
            if isinstance(qp, dict):
                incoming = qp.get("incoming", [])
                finished = qp.get("finished", [])
            else:
                incoming = wi_data.get("incoming_quality_parameters", [])
                finished = wi_data.get("finished_quality_parameters", [])
            if incoming:
                st.markdown("*Incoming:*")
                for i, q in enumerate(incoming, 1):
                    st.markdown(f"A{i}) {q}")
            if finished:
                st.markdown("*Finished:*")
                for i, q in enumerate(finished, 1):
                    st.markdown(f"B{i}) {q}")

        with st.container(border=True):
            st.markdown("**🚛 Logistics**")
            for item in wi_data.get("logistics", []):
                st.markdown(f"• {item}")

    rework = wi_data.get("rework_instructions", [])
    if rework:
        with st.container(border=True):
            st.markdown("**🔁 Rework Instructions**")
            _render_rework_table(rework)

    import pandas as pd
    parts = wi_data.get("part_details", [])
    if parts:
        with st.container(border=True):
            st.markdown("**📦 Part Details**")
            df_p = pd.DataFrame([{
                "Sr.":              p.get("sr_no", i + 1),
                "Part No.":         p.get("part_no", ""),
                "Part Description": p.get("description", p.get("part_description", "")),
                "Qty":              p.get("qty", ""),
            } for i, p in enumerate(parts)])
            st.dataframe(df_p, use_container_width=True, hide_index=True)

    with st.container(border=True):
        st.markdown("**Footer Legend**")
        st.markdown(
            "🚫 Don't Twist &nbsp;|&nbsp; 🔩 Specified Torque &nbsp;|&nbsp; "
            "⚠️ Important Point &nbsp;|&nbsp; 🔧 Make Adjustment &nbsp;|&nbsp; "
            "🧴 Apply Adhesive &nbsp;|&nbsp; 🛢️ Lubricate with Oil &nbsp;|&nbsp; "
            "🟡 Lubricate with Grease &nbsp;|&nbsp; 🔵 Apply Sealant &nbsp;|&nbsp; "
            "⭐ Vital Parts",
            unsafe_allow_html=True,
        )


def _render_download_row(out: dict, suffix: str = ""):
    d, b, l = out["date_str"], out["base_name"], out["safe_label"]
    uid = uuid.uuid4().hex[:8]
    dc1, dc2 = st.columns(2)
    with dc1:
        st.download_button(
            "⬇️ CSV",
            data=out["csv_bytes"],
            file_name=f"WI_{d}_{b}_{l}.csv",
            mime="text/csv",
            use_container_width=True,
            key=f"dl_csv_{uid}",
        )
    with dc2:
        if out["xlsx_bytes"]:
            st.download_button(
                "⬇️ Excel (.xlsx)",
                data=out["xlsx_bytes"],
                file_name=f"WI_{d}_{b}_{l}.xlsx",
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                use_container_width=True,
                key=f"dl_xlsx_{uid}",
            )
        else:
            st.warning(f"XLSX failed: {out['xlsx_error']}")

# ─────────────────────────────────────────────────────────────────────────────
# Main UI
# ─────────────────────────────────────────────────────────────────────────────
tab1, = st.tabs(["📋 Upload & Generate"])

with tab1:

    # ── Training pair loaded silently — zero UI shown when files are present ───
    ex_df, ex_wi_text, load_errors = _load_fixed_training_pair()
    st.session_state["ex_df"]      = ex_df
    st.session_state["ex_wi_text"] = ex_wi_text

    # Surface errors only in sidebar if training_data/ files are missing
    if load_errors:
        with st.sidebar:
            st.error("⚠️ Training pair not ready")
            for err in load_errors:
                st.caption(f"• {err}")
            st.caption("Add files to the **training_data/** folder and restart.")

    # ══════════════════════════════════════════════════════════════════════════
    st.markdown(
        '<div class="si-step-label"><span class="si-step-num">1</span> Upload PCP File</div>',
        unsafe_allow_html=True,
    )
    new_pcp_file = st.file_uploader(
        "Drop your PCP Excel file here (.xlsx / .xls / .csv)",
        type=["xlsx", "xls", "csv"],
        key="new_pcp",
    )

    # Session state keys
    for _k, _v in [
        ("pcp_sheets",      {}),   # sheet_name → {meta, df}  for PCP sheets
        ("non_pcp_sheets",  {}),   # sheet_name → df           for non-PCP sheets
        ("removed_sheets",  set()),
        ("stage_df_map",    {}),
        ("last_pcp_name",   ""),
    ]:
        if _k not in st.session_state:
            st.session_state[_k] = _v

    if new_pcp_file:
        tmp_new   = _save_upload(new_pcp_file)
        base_name = new_pcp_file.name.rsplit(".", 1)[0]
        st.session_state["new_pcp_tmp"]  = tmp_new
        st.session_state["new_pcp_name"] = base_name

        # Reset on new file
        if base_name != st.session_state["last_pcp_name"]:
            st.session_state["pcp_sheets"]     = {}
            st.session_state["non_pcp_sheets"] = {}
            st.session_state["removed_sheets"] = set()
            st.session_state["stage_df_map"]   = {}
            st.session_state["last_pcp_name"]  = base_name

        # ── Scan sheets on first load ─────────────────────────────────────────
        if not st.session_state["pcp_sheets"] and not st.session_state["non_pcp_sheets"]:
            with st.spinner("🔍 Scanning sheets for Process Control Plans…"):
                ext = tmp_new.rsplit(".", 1)[-1].lower()
                sheet_names = get_sheet_names(tmp_new) if ext in ("xlsx", "xls") else []

                pcp_found   = {}
                non_pcp     = {}

                if not sheet_names:
                    # CSV — treat as single PCP
                    df = load_pcp(tmp_new)
                    pcp_found[base_name] = {
                        "meta": {"stage_label": base_name, "part_name": "", "part_no": "", "plan_number": ""},
                        "df":   df,
                    }
                else:
                    for sn in sheet_names:
                        if _is_excluded_pcp_sheet(sn):
                            try:
                                non_pcp[sn] = load_pcp_sheet(tmp_new, sn)
                            except Exception:
                                non_pcp[sn] = None
                            continue

                        blocks = _find_pcp_blocks_in_sheet(tmp_new, sn)

                        if not blocks and _sheet_name_looks_like_pcp(sn):
                            # Fallback: sheet name says PCP but no title-row match found —
                            # treat the whole sheet as a single PCP block.
                            try:
                                meta_fb = _extract_pcp_meta(tmp_new, sn)
                                blocks = [{
                                    "start_row": 1,
                                    "end_row": None,  # whole sheet
                                    "plan_number": meta_fb.get("plan_number", ""),
                                    "stage_label": meta_fb.get("stage_label", sn),
                                }]
                            except Exception:
                                blocks = []

                        if blocks:
                            # ── Multi-block sheet: one entry per PCP block ──
                            for blk in blocks:
                                key = f"{sn} | {blk['stage_label']}" if len(blocks) > 1 else sn
                                try:
                                    import pandas as pd
                                    wb_tmp = openpyxl.load_workbook(tmp_new, read_only=True, data_only=True)
                                    ws_tmp = wb_tmp[sn]
                                    all_rows = list(ws_tmp.iter_rows(values_only=True))
                                    # Slice rows for this block (0-based)
                                    block_rows = all_rows[blk["start_row"] - 1 : blk["end_row"]]
                                    df = pd.DataFrame(block_rows)
                                    df = df.dropna(how="all").dropna(axis=1, how="all")
                                    df.columns = [str(c) for c in df.columns]
                                    meta = {
                                        "stage_label": blk["stage_label"],
                                        "plan_number": blk["plan_number"],
                                        "part_name":   "",
                                        "part_no":     "",
                                        "sheet_name":  sn,
                                        "start_row":   blk["start_row"],
                                        "end_row":     blk["end_row"],
                                    }
                                    pcp_found[key] = {"meta": meta, "df": df}
                                except Exception:
                                    pass
                        else:
                            try:
                                non_pcp[sn] = load_pcp_sheet(tmp_new, sn)
                            except Exception:
                                non_pcp[sn] = None

                st.session_state["pcp_sheets"]     = pcp_found
                st.session_state["non_pcp_sheets"] = non_pcp

        pcp_sheets  = st.session_state["pcp_sheets"]
        non_pcp     = st.session_state["non_pcp_sheets"]
        rm_sheets   = st.session_state["removed_sheets"]

        # ── Summary banner ────────────────────────────────────────────────────
        if pcp_sheets:
            n_pcp    = len(pcp_sheets)
            n_active = len([s for s in pcp_sheets if s not in rm_sheets])
            n_hidden = len(non_pcp)

            st.success(
                f"✅ Found **{n_pcp} Process Control Plan sheet{'s' if n_pcp != 1 else ''}** "
                f"→ **{n_active} WI{'s' if n_active != 1 else ''} queued**"
                + (f" · {n_hidden} non-PCP sheet{'s' if n_hidden != 1 else ''} hidden" if n_hidden else "")
            )

            # ── Non-PCP recovery ──────────────────────────────────────────────
            if non_pcp:
                with st.expander(f"📂 {n_hidden} hidden sheet{'s' if n_hidden != 1 else ''} (not PCP) — click to add any as WI"):
                    for sn, sdf in list(non_pcp.items()):
                        rc1, rc2, rc3 = st.columns([6, 2, 2])
                        with rc1:
                            st.markdown(f"**{sn}**")
                        with rc2:
                            if st.toggle("👁 Preview", key=f"prev_nonpcp_{sn}") and sdf is not None:
                                st.dataframe(ensure_unique_columns(sdf), use_container_width=True)
                        with rc3:
                            if st.button("➕ Add as WI", key=f"restore_{sn}", use_container_width=True):
                                try:
                                    df   = load_pcp_sheet(st.session_state["new_pcp_tmp"], sn)
                                    meta = _extract_pcp_meta(st.session_state["new_pcp_tmp"], sn)
                                    if not meta["stage_label"] or meta["stage_label"] == sn:
                                        meta["stage_label"] = sn
                                    st.session_state["pcp_sheets"][sn] = {"meta": meta, "df": df}
                                    del st.session_state["non_pcp_sheets"][sn]
                                    st.rerun()
                                except Exception as e:
                                    st.error(f"Could not load sheet: {e}")

            st.markdown("")

            # ── PCP sheet list ────────────────────────────────────────────────
            chosen_sheets = []

            # Card header
            st.markdown(
                f'<div class="si-sheet-card-header">'
                f'📋 Detected PCP sheets'
                f'<span class="si-queue-pill">✓ {n_active} WI{"s" if n_active != 1 else ""} queued</span>'
                f'</div>',
                unsafe_allow_html=True,
            )

            for sn, entry in list(pcp_sheets.items()):
                meta      = entry["meta"]
                stage_lbl = meta.get("stage_label", sn)
                part_name = meta.get("part_name", "")
                plan_no   = meta.get("plan_number", "")
                is_rm     = sn in rm_sheets
                df        = entry["df"]

                col_check, col_info, col_prev, col_rm = st.columns([0.4, 6, 0.6, 0.6])

                with col_check:
                    if not is_rm:
                        include = st.checkbox("", value=True, key=f"chk_{sn}", label_visibility="collapsed")
                        if include:
                            chosen_sheets.append(sn)
                    else:
                        st.markdown("<span style='color:#bbb;font-size:18px;'>☐</span>", unsafe_allow_html=True)

                with col_info:
                    if is_rm:
                        st.markdown(
                            f"<span style='color:#bbb;font-size:13px;text-decoration:line-through;'>"
                            f"{stage_lbl} &nbsp;·&nbsp; {sn}</span>"
                            f"<span style='color:#bbb;font-size:11px;'> &nbsp;(excluded)</span>",
                            unsafe_allow_html=True,
                        )
                    else:
                        name_part = f"<span style='color:#888;font-size:11px;'> &nbsp;·&nbsp; {part_name[:60]}</span>" if part_name else ""
                        plan_part = f"<span style='color:#aaa;font-size:11px;'> &nbsp;·&nbsp; {plan_no[:50]}</span>" if plan_no else ""
                        st.markdown(
                            f"<span class='si-stage-tag'>{stage_lbl}</span>"
                            f"<span style='font-size:13px;font-weight:600;color:#333;'>{sn}</span>"
                            f"{name_part}{plan_part}",
                            unsafe_allow_html=True,
                        )

                with col_prev:
                    if not is_rm and st.toggle("👁", key=f"prev_{sn}", help="Preview sheet data"):
                        _sheet_nm  = meta.get("sheet_name", sn)
                        _start_row = meta.get("start_row", 1)
                        _end_row   = meta.get("end_row", None)
                        html = render_sheet_block_html(tmp_new, _sheet_nm, _start_row, _end_row)
                        st.markdown(html, unsafe_allow_html=True)

                with col_rm:
                    if not is_rm:
                        if st.button("✕", key=f"rm_{sn}", help="Exclude this PCP"):
                            st.session_state["removed_sheets"].add(sn)
                            st.rerun()
                    else:
                        if st.button("↩", key=f"restore_stage_{sn}", help="Restore"):
                            st.session_state["removed_sheets"].discard(sn)
                            st.rerun()

            # Build stage_df_map from chosen sheets
            final_map = {}
            for sn in chosen_sheets:
                if sn in pcp_sheets:
                    meta      = pcp_sheets[sn]["meta"]
                    stage_lbl = meta.get("stage_label", sn)
                    # Make label unique if multiple sheets share same stage label
                    label_key = stage_lbl if stage_lbl not in final_map else f"{stage_lbl} [{sn}]"
                    final_map[label_key] = {"df": pcp_sheets[sn]["df"], "plan_number": meta.get("plan_number", "")}

            st.session_state["stage_df_map"] = final_map

            if final_map:
                st.info(f"**{len(final_map)} WI(s) queued:** {'  ·  '.join(list(final_map.keys())[:8])}"
                        + (" …" if len(final_map) > 8 else ""))
            else:
                st.warning("No PCPs selected — tick at least one above.")

        elif new_pcp_file:
            st.warning("⚠️ No Process Control Plan sheets found in this file. "
                       "Check that sheets contain 'PROCESS CONTROL PLAN' (or 'CONTROL PLAN') and "
                       "'Process Control Plan Number' in the header rows.")

    st.divider()

    # ══════════════════════════════════════════════════════════════════════════
    # Step 2 — Language & Generate
    # ══════════════════════════════════════════════════════════════════════════
    st.markdown(
        '<div class="si-step-label"><span class="si-step-num">2</span> Language &amp; Generate</div>',
        unsafe_allow_html=True,
    )

    _stage_map  = st.session_state.get("stage_df_map", {})
    n_wi        = len(_stage_map)

    language = st.radio(
        "Instruction language",
        options=["english", "hindi", "marathi"],
        format_func=lambda x: {
            "english": "English",
            "hindi":   "Hindi (हिंदी)",
            "marathi": "Marathi (मराठी)",
        }[x],
        horizontal=True,
        help="Applies to: Instructions, Quality Parameters, Rework. Headers stay in English.",
    )

    _ex_df      = st.session_state.get("ex_df")
    _ex_wi_text = st.session_state.get("ex_wi_text")
    _base_name  = st.session_state.get("new_pcp_name", "WI")

    ready = bool(_ex_df is not None and _ex_wi_text and _stage_map and api_key_input)

    if not ready:
        missing = []
        if _ex_df is None:    missing.append("training PCP (add training_pcp.xlsx to training_data/)")
        if not _ex_wi_text:   missing.append("training WI (add training_wi.xlsx to training_data/)")
        if not _stage_map:    missing.append("new PCP upload with PCPs selected")
        if not api_key_input: missing.append("API key (not found in .env)")
        st.info(f"Still needed: {', '.join(missing)}")

    btn_label = (
        f"🚀 Generate {n_wi} Work Instruction{'s' if n_wi != 1 else ''}"
        if n_wi else "🚀 Generate Work Instructions"
    )

    if st.button(btn_label, type="primary", disabled=not ready, use_container_width=True):
        ex_input_text = (
            dataframe_to_json(_ex_df) if input_format == "json" else dataframe_to_text(_ex_df)
        )

        results = {}
        total   = len(_stage_map)

        # ── Minimal spinner UI (Option C) ────────────────────────────────────
        # CSS injected once for the spinner animation
        st.markdown("""
        <style>
        @keyframes si-spin { to { transform: rotate(360deg); } }
        @keyframes si-pulse { 0%,100%{opacity:1} 50%{opacity:0.25} }
        .si-spinner-wrap {
            display: flex; flex-direction: column; align-items: center;
            padding: 32px 20px 24px; gap: 0;
        }
        .si-ring {
            width: 64px; height: 64px; border-radius: 50%;
            border: 4px solid #f0f0f0;
            border-top-color: #E8521A;
            animation: si-spin 0.9s linear infinite;
            margin-bottom: 16px;
        }
        .si-pct   { font-size: 30px; font-weight: 700; color: #E8521A; line-height: 1; }
        .si-msg   { font-size: 13px; color: #888; margin-top: 6px; }
        .si-stage { font-size: 11px; color: #bbb; margin-top: 3px; }
        .si-dots  { display: flex; gap: 8px; margin-top: 16px; align-items: center; }
        .si-dot   { width: 8px; height: 8px; border-radius: 50%; background: #e0e0e0; }
        .si-dot.done   { background: #3B6D11; }
        .si-dot.active { background: #E8521A; animation: si-pulse 1s infinite; }
        .si-dot-label  { font-size: 10px; color: #bbb; margin-top: 4px; text-align: center; }
        .si-dot-wrap   { display: flex; flex-direction: column; align-items: center; gap: 3px; }
        </style>
        """, unsafe_allow_html=True)

        spinner_slot = st.empty()   # single slot — we overwrite it each update

        def _render_spinner(pct: int, msg: str, stage_info: str, done_count: int):
            """Re-render the spinner card in place."""
            dots_html = ""
            for i in range(total):
                if i < done_count:
                    cls = "done"
                elif i == done_count:
                    cls = "active"
                else:
                    cls = ""
                dots_html += (
                    f'<div class="si-dot-wrap">'
                    f'<div class="si-dot {cls}"></div>'
                    f'<div class="si-dot-label">S{i+1:02d}</div>'
                    f'</div>'
                )
            spinner_slot.markdown(
                f"""
                <div style="background:#fff;border:1px solid #f0e8e0;
                            border-radius:14px;margin:8px 0;">
                  <div class="si-spinner-wrap">
                    <div class="si-ring"></div>
                    <div class="si-pct">{pct}%</div>
                    <div class="si-msg">{msg}</div>
                    <div class="si-stage">{stage_info}</div>
                    <div class="si-dots">{dots_html}</div>
                  </div>
                </div>
                """,
                unsafe_allow_html=True,
            )

        # Each stage has 4 sub-steps; weight them as 20 / 50 / 20 / 10
        SUB_WEIGHTS = [20, 50, 20, 10]   # prompt / llm / parse / xlsx
        SUB_LABELS  = [
            "Building prompt…",
            f"Calling {model}…",
            "Parsing response…",
            "Building Excel…",
        ]

        for idx, (stage_label, _stage_entry) in enumerate(_stage_map.items()):
            stage_df  = _stage_entry["df"] if isinstance(_stage_entry, dict) else _stage_entry
            plan_no   = _stage_entry.get("plan_number", "") if isinstance(_stage_entry, dict) else ""
            stage_base = int(idx / total * 100)          # % at start of this stage
            stage_span = int(1 / total * 100)            # % this stage covers

            def _upd(sub: int):
                done_so_far = sum(SUB_WEIGHTS[:sub])
                sub_frac    = done_so_far / sum(SUB_WEIGHTS)
                pct = min(99, stage_base + int(sub_frac * stage_span))
                _render_spinner(
                    pct,
                    SUB_LABELS[sub],
                    f"Stage {idx+1} of {total} · {stage_label}",
                    idx,
                )

            _upd(0)
            new_input_text = (
                dataframe_to_json(stage_df) if input_format == "json"
                else dataframe_to_text(stage_df)
            )
            prompt = build_prompt(ex_input_text, _ex_wi_text, new_input_text, strategy, language)

            _upd(1)
            try:
                raw_response = call_llm(
                    prompt, model=model, temperature=temperature, max_tokens=max_tokens
                )
            except Exception as e:
                spinner_slot.empty()
                st.error(f"LLM error on {stage_label}: {e}")
                continue

            _upd(2)
            try:
                wi_data = parse_json_response(raw_response)
            except ValueError as e:
                spinner_slot.empty()
                st.error(f"JSON parse failed for {stage_label}: {e}")
                st.code(raw_response[:1200], language="text")
                continue

            _upd(3)
            if plan_no:
                doc = wi_data.get("document") or wi_data.setdefault("document", {})
                doc["wi_number"] = plan_no
                doc["pcp_number"] = plan_no
            out = _generate_outputs(wi_data, _base_name, stage_label)
            results[stage_label] = dict(wi_data=wi_data, raw_response=raw_response, outputs=out)

        # Done — clear spinner and show success
        spinner_slot.empty()
        st.session_state["results"] = results
        if results:
            st.success(f"✅ {len(results)} Work Instruction{'s' if len(results) != 1 else ''} generated!")

    # ── Results ───────────────────────────────────────────────────────────────
    if st.session_state.get("results"):
        results = st.session_state["results"]
        st.divider()
        st.markdown(
            f'<div class="si-step-label">📥 Results — {len(results)} WI(s) generated</div>',
            unsafe_allow_html=True,
        )

        for stage_label, res in results.items():
            wi  = res["wi_data"]
            h   = wi.get("header") or wi.get("document") or {}
            out = res["outputs"]

            part_name = h.get("part_name", "Work Instruction")
            wi_no     = h.get("work_instruction_no") or h.get("wi_number", "")

            # Branded result card header
            st.markdown(
                f'<div class="si-result-header">'
                f'<span>Sharada Industries — Work Instructions</span>'
                f'<span class="si-result-stage-chip">{stage_label} · {part_name}</span>'
                f'</div>',
                unsafe_allow_html=True,
            )

            with st.container(border=True):
                mc1, mc2, mc3 = st.columns(3)
                with mc1:
                    st.markdown(f"**Part No.:** {h.get('part_no','')}")
                    st.markdown(f"**Part Name:** {h.get('part_name','')}")
                with mc2:
                    st.markdown(f"**Stage:** {h.get('stage_no','')}")
                    st.markdown(f"**Stage Name:** {h.get('stage_name','')}")
                with mc3:
                    st.markdown(f"**WI No.:** {wi_no}")
                    st.markdown(f"**Cycle Time:** {h.get('cycle_time','')}")

                dl_col, eye_col = st.columns([5, 1])
                with dl_col:
                    st.markdown("**Downloads:**")
                    _render_download_row(out, suffix=f"_{stage_label}")
                with eye_col:
                    st.markdown("<div style='height:28px'></div>", unsafe_allow_html=True)
                    if st.toggle("👁 Preview", key=f"wi_prev_{stage_label}"):
                        pass  # toggle handled below

            if st.session_state.get(f"wi_prev_{stage_label}"):
                with st.expander("🔍 Full WI Preview", expanded=True):
                    _render_wi_preview(wi)
"""
beautiful_excel_generator_v2.py — Generates Work Instruction as formatted XLSX
Key improvement: True 2-column body layout
  - Image panel: columns 1–4 (wide, ~35% of page width)
  - Instructions/content: columns 5–14 (right 65%)
  - All sections perfectly aligned, no gaps
"""

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import json
import io

# ── LAYOUT CONSTANTS ─────────────────────────────────────────────────────────
IMG_COLS    = 4   # Image panel occupies columns 1..IMG_COLS
TOTAL_COLS  = 14  # Total columns in sheet
CONTENT_COL = IMG_COLS + 1          # = 5: where content starts
CONTENT_SPAN = TOTAL_COLS - IMG_COLS  # = 10: width of right content area


# ── COLOR PALETTE ─────────────────────────────────────────────────────────────
class Colors:
    HEADER_BG    = "D95F02"
    HEADER_TEXT  = "FFFFFF"
    MINI_TEXT    = "FFD0A0"

    INFO_ODD     = "FFF0E6"
    INFO_EVEN    = "FFFFFF"
    INFO_BORDER  = "E0C0A8"

    SEC_BAR      = "D95F02"
    SEC_TEXT     = "FFFFFF"
    MINI_BAR     = "F4896B"

    IMG_PANEL    = "FFF0E6"
    IMG_BORDER   = "F0C090"

    TABLE_HEADER      = "D95F02"
    TABLE_HEADER_TEXT = "FFFFFF"
    TABLE_ALT    = "FFF8F4"
    TABLE_WHITE  = "FFFFFF"

    LEGEND_BG    = "FFF0E6"
    LEGEND_BORDER = "E0C0A8"

    BORDER_COLOR = "E0C0A8"
    TEXT_COLOR   = "1a1a1a"
    LABEL_COLOR  = "7A4A2A"


# ── HELPERS ───────────────────────────────────────────────────────────────────

def _border(color=Colors.BORDER_COLOR):
    s = Side(style='thin', color=color)
    return Border(left=s, right=s, top=s, bottom=s)


def _img_border():
    s = Side(style='medium', color=Colors.IMG_BORDER)
    return Border(left=s, right=s, top=s, bottom=s)


def set_cell(ws, row, col, value,
             bold=False, font_size=10,
             fill=None, text_color=None,
             align_h='left', align_v='center',
             merge_end_col=None,   # explicit end column for merge
             border=True, wrap=True):
    """Write a cell with full formatting. Merges from col to merge_end_col if given."""
    cell = ws.cell(row=row, column=col)

    if merge_end_col and merge_end_col > col:
        try:
            ws.merge_cells(start_row=row, start_column=col,
                           end_row=row, end_column=merge_end_col)
        except Exception:
            pass

    cell.value = value
    cell.font = Font(name='Arial', size=font_size, bold=bold,
                     color=text_color or Colors.TEXT_COLOR)
    if fill:
        cell.fill = PatternFill(start_color=fill, end_color=fill, fill_type='solid')
    cell.alignment = Alignment(horizontal=align_h, vertical=align_v, wrap_text=wrap)
    if border:
        cell.border = _border()
    return cell


def full(ws, row, value, bold=False, font_size=10, fill=None,
         text_color=None, align_h='left', border=True, wrap=True):
    """Write a full-width row spanning all 14 columns."""
    return set_cell(ws, row, 1, value, bold=bold, font_size=font_size,
                    fill=fill, text_color=text_color, align_h=align_h,
                    merge_end_col=TOTAL_COLS, border=border, wrap=wrap)


def right_cell(ws, row, value, bold=False, font_size=10, fill=None,
               text_color=None, align_h='left', border=True, wrap=True):
    """Write a cell in the right content area (cols 5–14)."""
    return set_cell(ws, row, CONTENT_COL, value, bold=bold, font_size=font_size,
                    fill=fill, text_color=text_color, align_h=align_h,
                    merge_end_col=TOTAL_COLS, border=border, wrap=wrap)


# ── MAIN GENERATOR ────────────────────────────────────────────────────────────

def generate_beautiful_wi(wi_data: dict, output_path: str) -> str:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Work Instruction"

    # ── Column widths ──────────────────────────────────────────────────────
    # Left image panel: cols 1–4, each 10 → total ≈ 40 units (~3.8 cm each)
    for c in range(1, IMG_COLS + 1):
        ws.column_dimensions[get_column_letter(c)].width = 10.0
    # Right content: cols 5–14, each 9.5 → total ≈ 95 units
    for c in range(CONTENT_COL, TOTAL_COLS + 1):
        ws.column_dimensions[get_column_letter(c)].width = 9.5

    # Extract data — support both "header" (old) and "document" (LLM output)
    h            = wi_data.get("header") or wi_data.get("document") or {}
    instructions = wi_data.get("detailed_work_instructions", [])

    # "tooling_equipments" is what the LLM returns; "tooling_equipment" is old schema
    tooling      = wi_data.get("tooling_equipments") or wi_data.get("tooling_equipment", [])

    # quality_parameters is a nested dict in LLM output
    qp       = wi_data.get("quality_parameters", {})
    incoming = qp.get("incoming", []) if isinstance(qp, dict) else wi_data.get("incoming_quality_parameters", [])
    finished = qp.get("finished", []) if isinstance(qp, dict) else wi_data.get("finished_quality_parameters", [])

    parts        = wi_data.get("part_details", [])
    rework       = wi_data.get("rework_instructions", [])
    process_note = wi_data.get("process_note", "")

    row = 1

    # ══ HEADER ══════════════════════════════════════════════════════════════
    # Row 1: Logo area | title | doc no
    set_cell(ws, row, 1, "SHARADA\nINDUSTRIES", bold=True, font_size=11,
             fill=Colors.HEADER_BG, text_color=Colors.HEADER_TEXT,
             align_h='center', merge_end_col=2)
    set_cell(ws, row, 3, h.get("company_address", ""), font_size=7,
             fill=Colors.HEADER_BG, text_color=Colors.MINI_TEXT,
             merge_end_col=4)
    set_cell(ws, row, 5, "WORK INSTRUCTIONS", bold=True, font_size=14,
             fill=Colors.HEADER_BG, text_color=Colors.HEADER_TEXT,
             align_h='center', merge_end_col=10)
    set_cell(ws, row, 11, f"Doc No.: {h.get('work_instruction_no') or h.get('wi_number', '')}",
             bold=True, font_size=9,
             fill=Colors.HEADER_BG, text_color=Colors.HEADER_TEXT,
             align_h='right', merge_end_col=14)
    ws.row_dimensions[row].height = 28
    row += 1

    # Row 2: address | rev info
    set_cell(ws, row, 1,
             "Plot-W199, S-Block, MIDC, Bhosari, Pune-411026, India",
             font_size=7, fill=Colors.HEADER_BG,
             text_color=Colors.MINI_TEXT, merge_end_col=10)
    set_cell(ws, row, 11,
             f"Rev: {h.get('revision_no', '')} | Date: {h.get('revision_date', '')}",
             font_size=8, fill=Colors.HEADER_BG,
             text_color=Colors.HEADER_TEXT, align_h='right',
             merge_end_col=14)
    ws.row_dimensions[row].height = 16
    row += 1

    # ══ INFO GRID (rows 3–6): 6-column meta table spanning full width ═════
    # Each of the 6 fields gets ~2–3 columns; we spread across all 14 cols

    # Helper: info_block writes label+value pair spanning given col range
    def info_block(r, start_col, end_col, label, value, bg):
        set_cell(ws, r,   start_col, label, bold=True, font_size=7,
                 fill=bg, text_color=Colors.LABEL_COLOR,
                 merge_end_col=end_col)
        set_cell(ws, r+1, start_col, str(value), font_size=8,
                 fill=bg, merge_end_col=end_col)

    # Row-pair 1: 6 fields across 14 cols
    # Distribute: 2,2,3,3,2,2 = 14
    col_spans_1 = [
        (1, 2),   # Factory/Line Area
        (3, 4),   # Stage No.
        (5, 7),   # Stage Name
        (8, 10),  # Machine/Equipment
        (11, 12), # Part No.
        (13, 14), # Cycle Time
    ]
    fields_1 = [
        ("Factory / Line Area", h.get("line_area") or h.get("factory_line_area", "")),
        ("Stage No.",           h.get("stage_no", "")),
        ("Stage Name",          h.get("stage_name", "")),
        ("Machine / Equipment", h.get("machine_equipment", "")),
        ("Part No.",            h.get("part_no", "")),
        ("Cycle Time",          h.get("cycle_time", "")),
    ]
    for (sc, ec), (lbl, val) in zip(col_spans_1, fields_1):
        bg = Colors.INFO_ODD if col_spans_1.index((sc, ec)) % 2 == 0 else Colors.INFO_EVEN
        info_block(row, sc, ec, lbl, val, bg)
    ws.row_dimensions[row].height   = 14
    ws.row_dimensions[row+1].height = 18
    row += 2

    # Row-pair 2: Part Name (wide), Drawing No., Revision, Rev Date, Modification
    col_spans_2 = [
        (1, 4),   # Part Name (wide)
        (5, 7),   # Drawing No.
        (8, 9),   # Revision
        (10, 11), # Rev Date
        (12, 14), # Modification
    ]
    fields_2 = [
        ("Part Name",    h.get("part_name", "")),
        ("Drawing No.",  h.get("drawing_no", "")),
        ("Revision",     h.get("revision_no", "")),
        ("Rev Date",     h.get("revision_date", "")),
        ("Modification", h.get("modification", "—")),
    ]
    for (sc, ec), (lbl, val) in zip(col_spans_2, fields_2):
        bg = Colors.INFO_ODD if col_spans_2.index((sc, ec)) % 2 == 0 else Colors.INFO_EVEN
        info_block(row, sc, ec, lbl, val, bg)
    ws.row_dimensions[row].height   = 14
    ws.row_dimensions[row+1].height = 18
    row += 2

    # ══ BODY: "DETAILED WORK INSTRUCTIONS" section header (full width) ════
    full(ws, row, "DETAILED WORK INSTRUCTIONS", bold=True, font_size=9,
         fill=Colors.SEC_BAR, text_color=Colors.SEC_TEXT, align_h='left')
    ws.row_dimensions[row].height = 16
    row += 1

    # ── Body rows: image panel on left, instructions on right ────────────
    body_start_row = row  # remember for later merge of image panel

    def right_section_header(r, text, fill=Colors.MINI_BAR):
        right_cell(ws, r, text, bold=True, font_size=8,
                   fill=fill, text_color=Colors.SEC_TEXT, align_h='left')
        ws.row_dimensions[r].height = 14

    def right_content_row(r, number_str, text, bg):
        set_cell(ws, r, CONTENT_COL, number_str, bold=True, font_size=8,
                 fill=bg, text_color=Colors.SEC_BAR, align_h='center',
                 merge_end_col=CONTENT_COL)
        set_cell(ws, r, CONTENT_COL + 1, text, font_size=8, fill=bg,
                 merge_end_col=TOTAL_COLS)

    # Instructions
    for idx, instruction in enumerate(instructions, 1):
        bg = Colors.TABLE_ALT if idx % 2 == 1 else Colors.TABLE_WHITE
        right_content_row(row, str(idx), instruction, bg)
        ws.row_dimensions[row].height = 22
        row += 1

    # Tooling
    if tooling:
        right_section_header(row, "TOOLING / EQUIPMENT")
        row += 1
        for idx, tool in enumerate(tooling, 1):
            bg = Colors.TABLE_ALT if idx % 2 == 1 else Colors.TABLE_WHITE
            right_content_row(row, f"{idx})", tool, bg)
            ws.row_dimensions[row].height = 18
            row += 1

    # Quality Parameters
    if incoming or finished:
        right_section_header(row, "QUALITY PARAMETERS")
        row += 1

        if incoming:
            right_cell(ws, row, "A) Incoming Quality Checks", bold=True,
                       font_size=8, fill=Colors.INFO_ODD,
                       text_color=Colors.LABEL_COLOR)
            ws.row_dimensions[row].height = 14
            row += 1
            for idx, item in enumerate(incoming, 1):
                bg = Colors.TABLE_ALT if idx % 2 == 1 else Colors.TABLE_WHITE
                right_content_row(row, f"{idx}.", item, bg)
                ws.row_dimensions[row].height = 20
                row += 1

        if finished:
            right_cell(ws, row, "B) Finished Quality Checks", bold=True,
                       font_size=8, fill=Colors.INFO_ODD,
                       text_color=Colors.LABEL_COLOR)
            ws.row_dimensions[row].height = 14
            row += 1
            for idx, item in enumerate(finished, 1):
                bg = Colors.TABLE_ALT if idx % 2 == 1 else Colors.TABLE_WHITE
                right_content_row(row, f"{idx}.", item, bg)
                ws.row_dimensions[row].height = 20
                row += 1

    body_end_row = row - 1

    # ── Merge image panel: rows body_start_row..body_end_row, cols 1..IMG_COLS
    if body_end_row >= body_start_row:
        try:
            ws.merge_cells(
                start_row=body_start_row, start_column=1,
                end_row=body_end_row,     end_column=IMG_COLS
            )
        except Exception:
            pass
        img_cell = ws.cell(row=body_start_row, column=1)
        img_cell.value = "🖼️\n\nImage\nPlaceholder\n\n(Insert image\nhere manually)"
        img_cell.fill = PatternFill(start_color=Colors.IMG_PANEL,
                                    end_color=Colors.IMG_PANEL,
                                    fill_type='solid')
        img_cell.alignment = Alignment(horizontal='center', vertical='center',
                                        wrap_text=True)
        img_cell.font = Font(name='Arial', size=9, color=Colors.LABEL_COLOR, bold=True)
        img_cell.border = _img_border()

    # ══ PROCESS NOTE ════════════════════════════════════════════════════════
    row += 1
    if process_note:
        full(ws, row, f"📌  {process_note}", bold=True, font_size=9,
             fill=Colors.LEGEND_BG, align_h='left')
        ws.row_dimensions[row].height = 24
        row += 2

    # ══ PART DETAILS TABLE ══════════════════════════════════════════════════
    row += 1
    set_cell(ws, row, 1,  "SR.",             bold=True, fill=Colors.TABLE_HEADER,
             text_color=Colors.TABLE_HEADER_TEXT, font_size=8, align_h='center',
             merge_end_col=1)
    set_cell(ws, row, 2,  "PART NO.",        bold=True, fill=Colors.TABLE_HEADER,
             text_color=Colors.TABLE_HEADER_TEXT, font_size=8, align_h='center',
             merge_end_col=4)
    set_cell(ws, row, 5,  "PART DESCRIPTION", bold=True, fill=Colors.TABLE_HEADER,
             text_color=Colors.TABLE_HEADER_TEXT, font_size=8,
             merge_end_col=13)
    set_cell(ws, row, 14, "QTY",             bold=True, fill=Colors.TABLE_HEADER,
             text_color=Colors.TABLE_HEADER_TEXT, font_size=8, align_h='center',
             merge_end_col=14)
    ws.row_dimensions[row].height = 16
    row += 1

    for idx, part in enumerate(parts):
        bg = Colors.TABLE_ALT if idx % 2 == 0 else Colors.TABLE_WHITE
        set_cell(ws, row, 1,  str(idx+1),                    font_size=8, fill=bg,
                 align_h='center', merge_end_col=1)
        set_cell(ws, row, 2,  str(part.get("part_no", "")),  font_size=8, fill=bg,
                 merge_end_col=4)
        set_cell(ws, row, 5,  str(part.get("part_description", part.get("description", ""))), font_size=8, fill=bg,
                 merge_end_col=13)
        set_cell(ws, row, 14, str(part.get("qty", "")),       font_size=8, fill=bg,
                 align_h='center', merge_end_col=14)
        ws.row_dimensions[row].height = 18
        row += 1

    # ══ REWORK TABLE ════════════════════════════════════════════════════════
    row += 1
    full(ws, row, "REWORK INSTRUCTIONS", bold=True, font_size=9,
         fill=Colors.SEC_BAR, text_color=Colors.SEC_TEXT)
    ws.row_dimensions[row].height = 16
    row += 1

    set_cell(ws, row, 1,  "NO.",         bold=True, fill=Colors.TABLE_HEADER,
             text_color=Colors.TABLE_HEADER_TEXT, font_size=8,
             align_h='center', merge_end_col=1)
    set_cell(ws, row, 2,  "DEFECT TYPE", bold=True, fill=Colors.TABLE_HEADER,
             text_color=Colors.TABLE_HEADER_TEXT, font_size=8, merge_end_col=5)
    set_cell(ws, row, 6,  "ACTION",      bold=True, fill=Colors.TABLE_HEADER,
             text_color=Colors.TABLE_HEADER_TEXT, font_size=8, merge_end_col=14)
    ws.row_dimensions[row].height = 14
    row += 1

    for idx, item in enumerate(rework):
        bg = Colors.TABLE_ALT if idx % 2 == 0 else Colors.TABLE_WHITE
        if isinstance(item, dict):
            defect = str(item.get("defect") or "—")
            action = str(item.get("rework") or item.get("action") or "—")
        else:
            s = str(item)
            if " - " in s:
                parts_list = s.split(" - ", 2)
                defect = parts_list[1].strip() if len(parts_list) > 1 else "—"
                action = parts_list[2].strip() if len(parts_list) > 2 else "—"
            else:
                defect, action = "—", s

        set_cell(ws, row, 1, str(idx+1), font_size=8, fill=bg,
                 align_h='center', merge_end_col=1)
        set_cell(ws, row, 2, defect, font_size=8, fill=bg, merge_end_col=5)
        set_cell(ws, row, 6, action, font_size=8, fill=bg, merge_end_col=14)
        ws.row_dimensions[row].height = 20
        row += 1

    # ══ LEGEND ══════════════════════════════════════════════════════════════
    row += 1
    full(ws, row, "LEGEND", bold=True, font_size=8,
         fill=Colors.SEC_BAR, text_color=Colors.SEC_TEXT, align_h='center')
    ws.row_dimensions[row].height = 14
    row += 1

    legend_items = [
        ("🚫", "Don't Twist"),
        ("🔩", "Spec. Torque"),
        ("⚠️", "Important"),
        ("🔧", "Adjustment"),
        ("🧴", "Apply Adhesive"),
        ("🛢️", "Lubricate Oil"),
        ("🟡", "Lub. Grease"),
        ("🔵", "Apply Sealant"),
        ("⭐", "Vital Parts"),
    ]
    # Spread 9 items across 14 cols (some span 2)
    # Cols: 1-1, 2-3, 4-4, 5-6, 7-8, 9-10, 11-11, 12-13, 14-14
    spans = [(1,1),(2,3),(4,4),(5,6),(7,8),(9,10),(11,11),(12,13),(14,14)]
    for (sc, ec), (icon, label) in zip(spans, legend_items):
        set_cell(ws, row, sc, f"{icon} {label}", font_size=8,
                 fill=Colors.LEGEND_BG, text_color=Colors.LABEL_COLOR,
                 align_h='center', merge_end_col=ec)
    ws.row_dimensions[row].height = 18

    # ══ PAGE SETUP ══════════════════════════════════════════════════════════
    ws.page_setup.paperSize      = ws.PAPERSIZE_A4
    ws.page_margins.left         = 0.4
    ws.page_margins.right        = 0.4
    ws.page_margins.top          = 0.4
    ws.page_margins.bottom       = 0.4
    ws.page_setup.orientation    = 'portrait'
    ws.page_setup.fitToPage      = True
    ws.page_setup.fitToWidth     = 1
    ws.page_setup.fitToHeight    = 0
    ws.print_options.horizontalCentered = True

    wb.save(output_path)
    return output_path


def generate_beautiful_wi_bytes(wi_data: dict) -> bytes:
    """Generate XLSX and return as bytes (for Streamlit download)."""
    output = io.BytesIO()

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Work Instruction"

    # Reuse the same logic by saving to BytesIO
    import tempfile, os
    with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as tmp:
        tmp_path = tmp.name

    generate_beautiful_wi(wi_data, tmp_path)

    with open(tmp_path, 'rb') as f:
        data = f.read()
    os.unlink(tmp_path)
    return data


def generate_beautiful_wi_from_json(json_path: str, output_path: str) -> str:
    with open(json_path, encoding='utf-8') as f:
        wi_data = json.load(f)
    return generate_beautiful_wi(wi_data, output_path)
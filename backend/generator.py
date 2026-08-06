"""
generator.py — CSV generator + compatibility shim.
Fixes ImportError: exposes generate_csv and generate_csv_bytes
that app.py imports. The docx generator is kept for any legacy callers.
"""

import csv
import io
import json
import os
from datetime import date


# ── Helpers ───────────────────────────────────────────────────────────────────

def _row14(*cells):
    lst = list(cells)
    while len(lst) < 14:
        lst.append("")
    return lst[:14]


def _build_layout_rows(wi_data: dict) -> list:
    # Support both "header" (old internal schema) and "document" (LLM output schema)
    h = wi_data.get("header") or wi_data.get("document") or {}

    instructions = wi_data.get("detailed_work_instructions", [])

    # Support both "tooling_equipments" (LLM) and "tooling_equipment" (old)
    tooling = wi_data.get("tooling_equipments") or wi_data.get("tooling_equipment", [])

    # Support both nested quality_parameters and flat lists
    qp = wi_data.get("quality_parameters", {})
    if isinstance(qp, dict):
        incoming_qp = qp.get("incoming", [])
        finished_qp = qp.get("finished", [])
    else:
        incoming_qp = wi_data.get("incoming_quality_parameters", [])
        finished_qp = wi_data.get("finished_quality_parameters", [])

    logistics    = wi_data.get("logistics", [])
    parts        = wi_data.get("part_details", [])
    process_note = wi_data.get("process_note", "")

    # Header field aliases: LLM uses wi_number / factory_line_area etc.
    wi_no      = h.get("work_instruction_no") or h.get("wi_number", "WI/ LINE")
    rev_no     = h.get("revision_no", "01")
    rev_date   = h.get("revision_date", date.today().strftime("%d/%m/%Y"))
    line_area  = h.get("line_area") or h.get("factory_line_area", "")
    stage_no   = h.get("stage_no", "")
    stage_name = h.get("stage_name", "")
    machine    = h.get("machine_equipment", "")
    part_no    = h.get("part_no", "")
    drawing_no = h.get("drawing_no", "")
    part_name  = h.get("part_name", "")
    cycle_time = h.get("cycle_time", "")

    rows = []

    # ── Header block ──────────────────────────────────────────────────────────
    rows.append(_row14(
        "SHARADA INDUSTRIES", "", "",
        "WORK INSTRUCTIONS", "", "", "", "", "", "", "", "", "",
        f"Doc No.: {wi_no}",
    ))
    rows.append(_row14(
        "Plot-W199, S-Block, MIDC, Bhosari, Indrayani-Nagar, Pune-411026",
        "", "", "", "", "", "", "", "", "", "", "", "",
        f"Format Rev No: {rev_no}",
    ))
    rows.append(_row14(
        "", "", "", "", "", "", "", "", "", "", "", "", "",
        "Format Rev date: 30.06.2018",
    ))

    # ── Info grid ─────────────────────────────────────────────────────────────
    rows.append(_row14(
        "Factory LINE / AREA -", "", "", line_area, "", "", "", "",
        f"Stage - {stage_no}", "", "", f"Rev :{rev_no}", "Rev Date:", rev_date,
    ))
    rows.append(_row14(
        f"Machine/ Equipment - {machine}", "", "", "", "", "", "", "",
        f"Stage Name - {stage_name}", "", "", "", "", "",
    ))
    rows.append(_row14(
        f"Part No.: {part_no}    Drawing No.: {drawing_no}",
        "", "", "", "", "", "", "",
        "Modification   -", "", "", "Cycle time:", cycle_time, "",
    ))
    rows.append(_row14(
        f"Part Name: {part_name}", "", "", "", "", "", "", "",
        "Detailed  Work Instructions -", "", "", "", "", "",
    ))

    # ── Right-side content ────────────────────────────────────────────────────
    right_content = []

    for i, instr in enumerate(instructions, 1):
        right_content.append((str(i), instr))

    right_content.append(("Tooling -", ""))
    for i, tool in enumerate(tooling, 1):
        right_content.append((f"{i}) ", tool))

    right_content.append(("Quality Parameters -", ""))
    if incoming_qp:
        right_content.append(("A) Incoming:", ""))
        for i, q in enumerate(incoming_qp, 1):
            right_content.append((f"{i})", q))
    if finished_qp:
        right_content.append(("B) Finished:", ""))
        for i, q in enumerate(finished_qp, 1):
            right_content.append((f"{i})", q))

    right_content.append(("Logistics", ""))
    for item in logistics:
        right_content.append(("", item))

    right_content.append(("Rework Instructions -", ""))
    for rw in wi_data.get("rework_instructions", []):
        if isinstance(rw, dict):
            defect = rw.get("defect", "")
            action = rw.get("rework", "")
            right_content.append((f"• {defect}", action))
        else:
            right_content.append(("•", str(rw)))

    for label, text in right_content:
        rows.append(_row14(
            "", "", "", "", "", "", "", "",
            label, text, "", "", "", "",
        ))

    # ── Process note ──────────────────────────────────────────────────────────
    rows.append(_row14())
    if process_note:
        rows.append(_row14(
            process_note, "", "", "", "", "", "", "",
            "", "", "", "", "", "",
        ))
        rows.append(_row14())

    # ── Part details table ─────────────────────────────────────────────────────
    rows.append(_row14(
        "", "", "", "", "", "", "", "",
        "Sr.", "Part No.", "Part Description", "", "", "Qty",
    ))
    for i, part in enumerate(parts, 1):
        rows.append(_row14(
            "", "", "", "", "", "", "", "",
            str(part.get("sr_no", i)),
            str(part.get("part_no", "")),
            str(part.get("description", part.get("part_description", ""))),
            "", "",
            str(part.get("qty", "")),
        ))

    # ── Legend ────────────────────────────────────────────────────────────────
    rows.append(_row14())
    rows.append(_row14(
        "", "Don't Twist", "Specified Torque", "Important Point", "",
        "Make Adjustment", "Apply Adhesive", "Lubricate with Oil",
        "Lubricate with Grease", "Apply Sealant", "Vital Parts",
        "", "", "",
    ))

    return rows


# ── Public API ────────────────────────────────────────────────────────────────

def generate_csv(wi_data: dict, output_path: str) -> str:
    """Generate WI as CSV (14-column layout). Returns output_path."""
    rows = _build_layout_rows(wi_data)
    os.makedirs(
        os.path.dirname(output_path) if os.path.dirname(output_path) else ".",
        exist_ok=True,
    )
    with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
        csv.writer(f).writerows(rows)
    return output_path


def generate_csv_bytes(wi_data: dict) -> bytes:
    """Return WI CSV as bytes for Streamlit download button."""
    rows = _build_layout_rows(wi_data)
    buf  = io.StringIO()
    csv.writer(buf).writerows(rows)
    return buf.getvalue().encode("utf-8-sig")


# ── Legacy / backward-compat ──────────────────────────────────────────────────

def generate_docx(wi_data: dict, output_path: str) -> str:
    """
    Original docx generator kept for backward compatibility.
    Falls back to CSV if python-docx is not installed.
    """
    try:
        from docx import Document
        from docx.shared import Pt, RGBColor, Inches, Cm
        from docx.oxml.ns import qn
        from docx.oxml import OxmlElement

        def _set_cell_bg(cell, hex_color):
            tc   = cell._tc
            tcPr = tc.get_or_add_tcPr()
            shd  = OxmlElement("w:shd")
            shd.set(qn("w:val"),   "clear")
            shd.set(qn("w:color"), "auto")
            shd.set(qn("w:fill"),  hex_color)
            tcPr.append(shd)

        def _cell_text(cell, text, bold=False, size=10, color=None, align=None):
            cell.text = ""
            p   = cell.paragraphs[0]
            if align:
                p.alignment = align
            run = p.add_run(str(text))
            run.bold       = bold
            run.font.size  = Pt(size)
            if color:
                run.font.color.rgb = RGBColor(*color)
            return run

        def _set_borders(table):
            for row in table.rows:
                for cell in row.cells:
                    tc   = cell._tc
                    tcPr = tc.get_or_add_tcPr()
                    tcB  = OxmlElement("w:tcBorders")
                    for edge in ("top","left","bottom","right","insideH","insideV"):
                        b = OxmlElement(f"w:{edge}")
                        b.set(qn("w:val"),   "single")
                        b.set(qn("w:sz"),    "4")
                        b.set(qn("w:space"), "0")
                        b.set(qn("w:color"), "000000")
                        tcB.append(b)
                    tcPr.append(tcB)

        doc = Document()
        for section in doc.sections:
            section.top_margin    = Cm(1.5)
            section.bottom_margin = Cm(1.5)
            section.left_margin   = Cm(1.8)
            section.right_margin  = Cm(1.8)

        h = wi_data.get("header") or wi_data.get("document") or {}

        # Header table
        hdr = doc.add_table(rows=3, cols=2)
        hdr.style = "Table Grid"
        _set_borders(hdr)
        for i, txt in enumerate([
            f"Work Instruction No.: {h.get('work_instruction_no','')}",
            f"Rev. No.: {h.get('revision_no','01')}",
            f"Rev. Date: {h.get('revision_date','')}",
        ]):
            _cell_text(hdr.rows[i].cells[1], txt, bold=True, size=9)

        doc.add_paragraph()

        # Instructions
        for i, step in enumerate(wi_data.get("detailed_work_instructions",[]), 1):
            p   = doc.add_paragraph()
            run = p.add_run(f"{i}.  {step}")
            run.font.size = Pt(9)

        os.makedirs(
            os.path.dirname(output_path) if os.path.dirname(output_path) else ".",
            exist_ok=True,
        )
        doc.save(output_path)
        return output_path

    except ImportError:
        csv_path = output_path.replace(".docx", ".csv")
        return generate_csv(wi_data, csv_path)


def generate_from_json_file(json_path: str, output_path: str) -> str:
    with open(json_path, encoding="utf-8") as f:
        wi_data = json.load(f)
    return generate_csv(wi_data, output_path)
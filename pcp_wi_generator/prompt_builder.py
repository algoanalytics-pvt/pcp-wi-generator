import json
import pandas as pd


STANDARD_FIELDS = [
    "Process Name",
    "Machine",
    "Tool",
    "Product Characteristic",
    "Process Characteristic",
    "Specification",
    "Control Method",
    "Sample Size",
    "Frequency",
    "Reaction Plan",
]


def dataframe_to_json(df: pd.DataFrame) -> str:
    steps = []
    for idx, row in df.iterrows():
        step = {"step": idx + 1}
        for field in STANDARD_FIELDS:
            if field in row and str(row[field]).strip():
                step[field] = str(row[field]).strip()
        for col in df.columns:
            if col not in STANDARD_FIELDS and str(row[col]).strip():
                step[col] = str(row[col]).strip()
        steps.append(step)
    return json.dumps({"pcp_steps": steps}, indent=2)


def dataframe_to_text(df: pd.DataFrame) -> str:
    rows = []
    for idx, row in df.iterrows():
        parts = [f"STEP {idx + 1}"]
        for field in STANDARD_FIELDS:
            if field in row and str(row[field]).strip():
                parts.append(f"  {field.upper()}: {row[field]}")
        for col in df.columns:
            if col not in STANDARD_FIELDS and str(row[col]).strip():
                parts.append(f"  {col.upper()}: {row[col]}")
        rows.append("\n".join(parts))
    return "\n\n".join(rows)


# The exact required JSON schema as a concrete filled example
_SCHEMA_EXAMPLE = """{
  "document": {
    "wi_number": "WI-PRD-9",
    "revision_no": "01",
    "revision_date": "11/11/17",
    "factory_line_area": "UNIT-3 / COVER ASSY FUEL FILTER",
    "stage_no": "1",
    "stage_name": "COVER ASSY FUEL FILTER",
    "machine_equipment": "Spot Welding Guns",
    "part_no": "264747700101",
    "drawing_no": "264747700101",
    "drawing_mod": "D/27.01.2025",
    "cycle_time": "",
    "part_name": "COVER ASSY FUEL FILTER"
  },
  "detailed_work_instructions": [
    "Collect all loose parts and place them together.",
    "Verify all assembly parts are loaded on fixture (Fixture No. 264747700101).",
    "Clamp the fixture.",
    "Perform 12 spots as per control plan.",
    "Unclamp the fixture.",
    "Inspect the completed assembly.",
    "Verify total 12 spots are complete on both sub-assemblies and pass to Stage 2."
  ],
  "vehicle_models": ["SFC 712 4SP RDE"],
  "tooling_equipments": [
    "Stage 1 Welding Fixture (Fixture No. 264747700101)",
    "Spot Welding Gun - 1 no. (Gun No. 90)"
  ],
  "quality_parameters": {
    "incoming": [
      "Assembly must have no cracks, damage, or rust anywhere.",
      "No wrinkles on pressed parts."
    ],
    "finished": [
      "Total 12 spots as per control plan and spot plan.",
      "No deep spots allowed.",
      "No burrs at spot locations.",
      "Weld nuts and studs must not be missing.",
      "No loose parts missing."
    ]
  },
  "rework_instructions": [
    {"defect": "Spot Missing", "rework": "Missing spots must be done properly (ref: control plan and drawing)."},
    {"defect": "Welding Missing", "rework": "Welding must be done properly (ref: control plan and drawing)."},
    {"defect": "Part Missing", "rework": "All parts must be welded properly (ref: control plan and drawing)."},
    {"defect": "Nut Missing", "rework": "All nuts must be welded properly (ref: control plan and drawing)."},
    {"defect": "Dent or Damage", "rework": "Use plastic mallet to rework dents or damage."},
    {"defect": "Rust", "rework": "Clean rusted area with rust remover and apply anti-rust coating."},
    {"defect": "Part Shift", "rework": "Remove misplaced part using spot cutter and chisel, reposition correctly."}
  ],
  "logistics": ["Bin, Trolley, Crane"],
  "part_details": [
    {"sr_no": 1, "part_no": "264747708201", "part_description": "COVER", "qty": 1},
    {"sr_no": 2, "part_no": "264747708202", "part_description": "COVER PLATE", "qty": 1}
  ]
}"""


def build_prompt(
    example_input: str,
    example_output: str,
    new_input: str,
    strategy: str = "oneshot",
    language: str = "english",
) -> str:

    strategy_note = {
        "oneshot": "Use ONE-SHOT learning: study the single example pair carefully.",
        "fewshot": "Use FEW-SHOT learning: extract common patterns across all provided examples.",
        "hybrid": "Use HYBRID mode: apply engineering rules first, then generate natural language.",
        "rag": "Use the retrieved most-similar example as your primary reference.",
    }.get(strategy, "Use ONE-SHOT learning: study the single example pair carefully.")

    language_note = {
        "english": "Write ALL text values in ENGLISH.",
        "hindi":   "Write the following fields in HINDI (Devanagari script): detailed_work_instructions, quality_parameters (incoming and finished), rework_instructions. Write ALL other fields (document header, tooling_equipments, logistics, part_details, vehicle_models) in ENGLISH.",
        "marathi": "Write the following fields in MARATHI (Devanagari script): detailed_work_instructions, quality_parameters (incoming and finished), rework_instructions. Write ALL other fields (document header, tooling_equipments, logistics, part_details, vehicle_models) in ENGLISH.",
    }.get(language, "Write ALL text values in ENGLISH.")

    prompt = f"""You are a senior automotive manufacturing engineer with deep expertise in IATF 16949, APQP, and control plan documentation.

{strategy_note}

LANGUAGE INSTRUCTION — THIS IS MANDATORY: {language_note}

Your task: learn the transformation pattern from the EXAMPLE pair below, then apply it to generate a new Work Instruction.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXAMPLE — INPUT PCP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{example_input}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXAMPLE — OUTPUT WORK INSTRUCTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{example_output}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEW INPUT PCP — GENERATE WORK INSTRUCTION FOR THIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{new_input}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT — READ THIS CAREFULLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FORBIDDEN FIELDS — do NOT use these in your output (they are from an old schema):
  - "steps", "step_number", "process_name", "machine_tool",
    "detailed_instruction", "quality_check", "reaction_plan",
    "safety_notes", "estimated_time_minutes", "critical_steps", "required_ppe"

REQUIRED SCHEMA — your output must use EXACTLY these top-level keys:
  "document", "detailed_work_instructions", "vehicle_models",
  "tooling_equipments", "quality_parameters", "rework_instructions",
  "logistics", "part_details"

Here is a CONCRETE EXAMPLE of the exact JSON format to follow:

{_SCHEMA_EXAMPLE}

RULES:
1. "detailed_work_instructions" is a flat JSON array of strings — one string per operator step. Combine ALL process steps from the PCP into this single numbered list. Do NOT nest objects inside it.
2. "quality_parameters.incoming" and "quality_parameters.finished" are flat arrays of strings.
3. "rework_instructions" is an array of objects each with only "defect" and "rework" keys.
4. "part_details" is an array of objects each with "sr_no", "part_no", "part_description", "qty".
5. All string values must be properly JSON-escaped. Do NOT include literal newlines inside strings — use a space instead.
6. Do NOT include trailing commas after the last item in any array or object.

Return ONLY the raw JSON object. No markdown, no code fences, no explanation, no preamble. Start your response with {{ and end with }}."""

    return prompt
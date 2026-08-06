import json
import os
import re
import requests


PROVIDERS = {
    "mistral": {
        "url": "https://api.mistral.ai/v1/chat/completions",
        "models": {
            "mistral-large-latest": "mistral-large-latest",
            "mistral-small-latest": "mistral-small-latest",
        },
        "env_key": "MISTRAL_API_KEY",
    },
    "groq": {
        "url": "https://api.groq.com/openai/v1/chat/completions",
        "models": {
            "llama-3.1-70b": "llama-3.1-70b-versatile",
            "llama-3.1-8b": "llama-3.1-8b-instant",
            "qwen-2.5-72b": "qwen-2.5-72b-preview",
        },
        "env_key": "GROQ_API_KEY",
    },
    "openai": {
        "url": "https://api.openai.com/v1/chat/completions",
        "models": {
            "gpt-4o": "gpt-4o",
            "gpt-4o-mini": "gpt-4o-mini",
        },
        "env_key": "OPENAI_API_KEY",
    },
    "together": {
        "url": "https://api.together.xyz/v1/chat/completions",
        "models": {
            "qwen-2.5-72b": "Qwen/Qwen2.5-72B-Instruct-Turbo",
            "llama-3.1-70b": "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
            "deepseek-r1": "deepseek-ai/DeepSeek-R1",
        },
        "env_key": "TOGETHER_API_KEY",
    },
}


def detect_provider(model_name: str) -> tuple[str, str]:
    for provider, cfg in PROVIDERS.items():
        if model_name in cfg["models"]:
            return provider, cfg["models"][model_name]
    raise ValueError(
        f"Unknown model '{model_name}'. Available: "
        + ", ".join(m for p in PROVIDERS.values() for m in p["models"])
    )


def call_llm(
    prompt: str,
    model: str = "mistral-large-latest",
    temperature: float = 0.2,
    max_tokens: int = 4000,
) -> str:
    provider, model_id = detect_provider(model)
    cfg = PROVIDERS[provider]

    api_key = os.environ.get(cfg["env_key"], "")
    if not api_key:
        raise EnvironmentError(
            f"API key not set. Please set the environment variable: {cfg['env_key']}\n"
            f"Example: export {cfg['env_key']}=your_key_here"
        )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": model_id,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    response = requests.post(cfg["url"], headers=headers, json=payload, timeout=120)

    if response.status_code != 200:
        raise RuntimeError(
            f"API error {response.status_code}: {response.text[:400]}"
        )

    content = response.json()["choices"][0]["message"]["content"]
    return content


def _clean_json_string(raw: str) -> str:
    """
    Aggressively clean LLM JSON output:
    1. Strip markdown fences
    2. Extract the outermost { ... } block
    3. Fix common issues: unescaped newlines inside strings,
       trailing commas before } or ], invalid control chars
    """
    text = raw.strip()

    # Strip markdown fences
    if text.startswith("```"):
        lines = text.splitlines()
        start = 1
        end = len(lines) - 1 if lines[-1].strip() == "```" else len(lines)
        text = "\n".join(lines[start:end]).strip()

    # Extract outermost JSON object
    brace_start = text.find("{")
    brace_end = text.rfind("}")
    if brace_start != -1 and brace_end != -1:
        text = text[brace_start: brace_end + 1]

    # Fix unescaped literal newlines inside JSON string values
    # Strategy: go char-by-char tracking if we're inside a string
    fixed = []
    in_string = False
    escape_next = False
    for ch in text:
        if escape_next:
            fixed.append(ch)
            escape_next = False
            continue
        if ch == "\\":
            escape_next = True
            fixed.append(ch)
            continue
        if ch == '"':
            in_string = not in_string
            fixed.append(ch)
            continue
        if in_string and ch == "\n":
            fixed.append("\\n")
            continue
        if in_string and ch == "\r":
            fixed.append("\\r")
            continue
        if in_string and ch == "\t":
            fixed.append("\\t")
            continue
        fixed.append(ch)
    text = "".join(fixed)

    # Remove trailing commas before } or ]
    text = re.sub(r",\s*([}\]])", r"\1", text)

    return text


def parse_json_response(raw: str) -> dict:
    """Parse LLM JSON output with aggressive cleaning and clear error reporting."""
    # Step 1: try to detect and convert old schema → new schema
    # If LLM returns old "steps" format, convert it automatically
    cleaned = _clean_json_string(raw)

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        # Show a useful snippet around the error
        start = max(0, e.pos - 80)
        end = min(len(cleaned), e.pos + 80)
        snippet = cleaned[start:end]
        raise ValueError(
            f"JSON parsing failed at position {e.pos}.\n"
            f"Near: ...{snippet}...\n"
            f"Error: {e}\n\n"
            f"── Raw LLM response (first 800 chars) ──\n{raw[:800]}"
        )

    # Step 2: if LLM returned old schema (has "steps" with "detailed_instruction"),
    # auto-convert to new schema so the docx generator doesn't break
    if "steps" in data and "detailed_work_instructions" not in data:
        data = _migrate_old_schema(data)

    return data


def _migrate_old_schema(old: dict) -> dict:
    """Convert old step-based schema to new section-based WI schema."""
    doc_old = old.get("document", {})
    steps = old.get("steps", [])
    summary = old.get("summary", {})

    # Build detailed instructions from steps
    instructions = []
    rework = []
    incoming_qp = []
    finished_qp = []
    tooling = []

    for step in steps:
        instr = step.get("detailed_instruction", "")
        if instr:
            instructions.append(instr)
        qc = step.get("quality_check", "")
        if qc:
            finished_qp.append(qc)
        rp = step.get("reaction_plan", "")
        defect = step.get("process_name", f"Step {step.get('step_number','?')} defect")
        if rp:
            rework.append({"defect": defect, "rework": rp})
        machine = step.get("machine_tool", "")
        if machine and machine not in tooling:
            tooling.append(machine)

    return {
        "document": {
            "wi_number": doc_old.get("doc_number", "WI-PRD-"),
            "revision_no": doc_old.get("revision", "01"),
            "revision_date": doc_old.get("date", ""),
            "factory_line_area": "",
            "stage_no": "1",
            "stage_name": doc_old.get("title", ""),
            "machine_equipment": ", ".join(tooling[:2]),
            "part_no": "",
            "drawing_no": "",
            "drawing_mod": "",
            "cycle_time": "",
            "part_name": doc_old.get("title", ""),
        },
        "detailed_work_instructions": instructions,
        "vehicle_models": [],
        "tooling_equipments": tooling,
        "quality_parameters": {
            "incoming": incoming_qp or ["Check assembly for cracks, damage or rust before processing."],
            "finished": finished_qp,
        },
        "rework_instructions": rework,
        "logistics": ["Bin, Trolley, Crane"],
        "part_details": [],
    }
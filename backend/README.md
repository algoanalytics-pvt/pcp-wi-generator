# PCP → Work Instruction Generator

AI-powered system that learns the transformation pattern between a Process Control Plan (PCP) and a Work Instruction (WI) using one-shot prompting, then generates new Work Instructions automatically.

---

## Quick Start (5 minutes)

### 1. Install Python

Make sure you have Python 3.9 or newer:
```bash
python --version
```
If not installed: https://www.python.org/downloads/

---
# api ====
### 2. Get the project

```bash
# Option A — Clone if you have git
git clone <your-repo-url>
cd pcp-wi-generator/backend

# Option B — Download the ZIP and extract it
cd pcp-wi-generator/backend
```

---

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

---

### 4. Get a FREE API key (takes 2 minutes)

You need ONE of these:

| Provider | Free Tier | Get Key |
|---|---|---|
| **Groq** ✅ Recommended for free | Yes, fast | https://console.groq.com |
| Mistral | Free trial credits | https://console.mistral.ai |
| Together AI | $1 free credit | https://api.together.xyz |
| OpenAI | Paid | https://platform.openai.com |

**Groq is recommended for beginners** — it's free, fast, and supports Llama 3.1 70B.

---

### 5. Set your API key

**Option A — Set in terminal (lasts for session):**
```bash
# Windows
set GROQ_API_KEY=your_key_here

# Mac / Linux
export GROQ_API_KEY=your_key_here
```

**Option B — Create a .env file:**
```bash
cp .env.example .env
# Then edit .env and fill in your key
```

You can also enter the key directly in the app's sidebar — no terminal needed.

---

### 6. Run the API

```bash
uvicorn main:app --reload --port 8000
```

The API is now available at **http://localhost:8000** (docs at `/docs`).
It's consumed by the React app in [`../frontend`](../frontend) — see the root
[README](../README.md) to run that too.

---

## Project File Structure

```
backend/
│
├── main.py                     ← FastAPI app (all /api routes)
├── parser.py                   ← Reads & normalizes Excel PCP files
├── prompt_builder.py           ← Builds the one-shot prompt
├── llm_client.py                ← Calls LLM APIs (Mistral/Groq/Together/OpenAI)
├── docx_reader.py               ← Reads example .docx Work Instructions
├── generator.py                 ← Writes the output .csv/.docx data
├── Beautiful_excel_generator.py ← Writes the formatted output .xlsx
├── requirements.txt
├── .env                         ← API keys (not committed)
│
├── examples/                    ← Sample input/output files
├── training_data/                ← Fixed one-shot training pair
└── outputs/                     ← Generated Work Instructions (gitignored)
```

---

## Your PCP Excel Format

The system auto-detects common column name variants. Recommended columns:

| Column | Aliases also accepted |
|---|---|
| Process Name | Process, Operation |
| Machine | Equipment, Machine / Device |
| Tool | Tooling |
| Specification | Spec, Tolerance |
| Control Method | Method, Inspection Method |
| Reaction Plan | Corrective Action, Reaction |
| Product Characteristic | Product Char |
| Process Characteristic | Process Char |
| Sample Size | — |
| Frequency | — |

---

## Supported Models

### Groq (free)
- `llama-3.1-70b` — best quality free option
- `llama-3.1-8b` — fastest

### Mistral
- `mistral-large-latest` — best quality
- `mistral-small-latest` — faster, cheaper

### Together AI
- `qwen-2.5-72b` — excellent reasoning
- `deepseek-r1` — strong structured output
- `llama-3.1-70b`

### OpenAI
- `gpt-4o` — best overall
- `gpt-4o-mini` — cheaper

---

## Troubleshooting

**"API key not set" error**
→ Set the key in `backend/.env` (e.g. `GROQ_API_KEY=your_key`), or export it in your shell first

**"Could not read Excel file" error**
→ .xls files are auto-converted to .xlsx internally; if it still fails, re-save the file from Excel

**JSON parsing failed**
→ Try lowering temperature to 0.1, or switch to a larger model

**API won't start**
→ Run `pip install -r requirements.txt` again, then `uvicorn main:app --reload --port 8000`

**Port already in use**
→ Run `uvicorn main:app --reload --port 8001` and update the frontend's `vite.config.js` proxy target

---

## Improving Accuracy

| Technique | How |
|---|---|
| Better examples | Use a real PCP+WI pair from your plant |
| JSON format | Keep "Structured JSON" selected in sidebar |
| Larger model | Use mistral-large or llama-3.1-70b |
| Lower temperature | Set to 0.1 for more deterministic output |
| Specific columns | Make sure your PCP has Process Name, Specification, Reaction Plan |

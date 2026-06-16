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
# api ====mcDyTyxK1t6avlKhue0UrGH2JeRyILPL
### 2. Get the project

```bash
# Option A — Clone if you have git
git clone <your-repo-url>
cd pcp_wi_generator

# Option B — Download the ZIP and extract it
cd pcp_wi_generator
```

---

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

That installs: `streamlit`, `pandas`, `openpyxl`, `python-docx`, `requests`

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

### 6. Create sample files (optional but recommended for testing)

```bash
python create_samples.py
```

This creates:
- `examples/sample_pcp.xlsx` — a 7-step Process Control Plan
- `examples/sample_output.docx` — the matching Work Instruction

---

### 7. Run the app

```bash
streamlit run app.py
```

Your browser will open automatically at **http://localhost:8501**

---

## How to Use the App

### Step 1 — Upload Training Pair
- Upload `examples/sample_pcp.xlsx` as "Example PCP"
- Upload `examples/sample_output.docx` as "Example Work Instruction"

### Step 2 — Upload New PCP
- Upload your real PCP file (.xlsx)
- The app previews all the rows

### Step 3 — Configure
In the left sidebar:
- Choose your provider (Groq / Mistral / etc.)
- Choose a model
- Enter your API key
- Pick prompting strategy (start with One-Shot)

### Step 4 — Generate
- Click **"Generate Work Instruction"**
- Watch the live progress log
- Download the `.docx` when done

---

## Project File Structure

```
pcp_wi_generator/
│
├── app.py              ← Main Streamlit UI
├── parser.py           ← Reads & normalizes Excel PCP files
├── prompt_builder.py   ← Builds the one-shot prompt
├── llm_client.py       ← Calls LLM APIs (Mistral/Groq/Together/OpenAI)
├── docx_reader.py      ← Reads example .docx Work Instructions
├── generator.py        ← Writes the output .docx file
├── create_samples.py   ← Creates test data
├── requirements.txt
├── .env.example
│
├── examples/
│   ├── sample_pcp.xlsx         ← Sample input
│   └── sample_output.docx      ← Sample WI (training example)
│
├── uploads/            ← Place new PCP files here (or upload via UI)
└── outputs/            ← Generated Work Instructions saved here
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
→ Enter the key in the sidebar, or run `export GROQ_API_KEY=your_key` in terminal first

**"Could not read Excel file" error**
→ Make sure the file is .xlsx (not .xls). Re-save from Excel if needed.

**JSON parsing failed**
→ Try lowering temperature to 0.1, or switch to a larger model

**App won't start**
→ Run `pip install -r requirements.txt` again, then `streamlit run app.py`

**Port already in use**
→ Run `streamlit run app.py --server.port 8502`

---

## Improving Accuracy

| Technique | How |
|---|---|
| Better examples | Use a real PCP+WI pair from your plant |
| JSON format | Keep "Structured JSON" selected in sidebar |
| Larger model | Use mistral-large or llama-3.1-70b |
| Lower temperature | Set to 0.1 for more deterministic output |
| Specific columns | Make sure your PCP has Process Name, Specification, Reaction Plan |

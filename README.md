# PCP → Work Instruction Generator

## 📌 Overview
Turns a **Process Control Plan (PCP)** Excel workbook into shop-floor **Work Instructions (WI)**.
Upload the PCP, pick the stages and the language (English / Hindi / Marathi), and the app writes one WI per stage.
Each WI can be downloaded as a formatted Excel file or as a CSV.

- **Backend:** FastAPI (`backend/`)
- **Frontend:** React + Vite + Tailwind (`frontend/`)
- **AI model:** OpenAI **`gpt-5.6-luna`**

---

## 🤖 AI Model
| Item | Value |
|------|-------|
| Provider | OpenAI |
| Model | `gpt-5.6-luna` (only model used) |
| API key | `OPENAI_API_KEY` |
| Max tokens | 16000 per stage |
| Avg usage | ~26k tokens per stage (~$0.0085) |

- Chosen from the Nov 2026 model comparison (5 models, 40 WIs): best mean score (0.900) and Hindi on 5/5 parts.
- Mistral (`mistral-large-latest`) was used earlier. It is kept in `backend/llm_client.py` as commented-out code only.
- Every LLM call prints a check line in the backend console:
  ```
  [LLM] provider=OpenAI url=https://api.openai.com/v1/chat/completions model=gpt-5.6-luna (not Mistral)
  ```
- Token usage is returned by `/api/generate` under `usage` (per stage + total).

---

## 🚀 Quick Start (local)

### 1. Set the API key
```bash
cp .env.example backend/.env
# edit backend/.env and set OPENAI_API_KEY
```

### 2. Start the backend → http://localhost:8000
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Start the frontend → http://localhost:5173
```bash
cd frontend
npm install
npm run dev
```
The dev server proxies `/api` to port 8000.

### 4. (Only while editing styles) Rebuild Tailwind
```bash
cd frontend
npx @tailwindcss/cli -i ./src/input.css -o ./src/output.css --watch
```
`src/output.css` is committed, so rebuild it after any style change.

---

## 🐳 Docker / Production
```bash
cp .env.example .env      # set OPENAI_API_KEY
docker compose up -d --build
```
- Serves the built frontend from FastAPI on host port **9274** (container 8000).
- Built for the `/pcp_wi_generator` subpath, so opening `http://localhost:9274/` directly shows a blank page. This is expected.

### CI/CD
- A push to the `ui` branch runs `.github/workflows/deployment.yml`.
- It SSHes into the EC2 host, pulls `ui`, writes `.env` from the GitHub repo secrets, and rebuilds the container.
- `OPENAI_API_KEY` must be set as a repo secret.

---

## 🔑 Environment Variables
| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENAI_API_KEY` | Yes | Calls `gpt-5.6-luna` |

`.env` is git-ignored and never built into the image.

---

## 🔄 How It Works
1. **Upload** the PCP Excel (`.xlsx`, `.xls`, `.csv`). The backend finds the PCP stage sheets.
2. **Review** the detected stages and pick the language.
3. **Generate:** one LLM call per stage, using a fixed one-shot example from `backend/training_data/`.
4. The plan number and stage number are copied from the PCP over the model's values.
5. **Download** each WI as Excel or CSV.

If one stage fails, the other stages still complete, and the error is shown next to the results.

---

## 📂 Directory Structure
```
pcp-wi-generator/
├── backend/
│   ├── main.py                      # FastAPI app, all /api routes
│   ├── llm_client.py                # OpenAI gpt-5.6-luna call + JSON clean-up
│   ├── prompt_builder.py            # Builds the one-shot prompt
│   ├── parser.py                    # Reads and normalises PCP Excel files
│   ├── docx_reader.py               # Reads the example WI
│   ├── generator.py                 # CSV output
│   ├── Beautiful_excel_generator.py # Formatted Excel output
│   ├── training_data/               # Fixed one-shot PCP + WI pair
│   ├── examples/                    # Sample input/output files
│   └── outputs/                     # Generated WIs (git-ignored)
├── frontend/
│   └── src/
│       ├── App.jsx                  # Steps: Upload → Review → Generate → Results
│       ├── components/              # landing/, layout/, steps/, ui/
│       ├── input.css                # Tailwind source + theme tokens
│       └── output.css               # Built Tailwind CSS (committed)
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── .github/workflows/deployment.yml
```

---

## 🔌 API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health check |
| GET | `/api/training-status` | Is the one-shot training pair loaded |
| POST | `/api/upload-pcp` | Upload a PCP file, returns `session_id` and stages |
| GET | `/api/sheet-preview/{session_id}/{sheet_key}` | Preview a stage sheet |
| POST | `/api/generate` | Generate WIs for the selected stages |
| POST | `/api/add-non-pcp-as-wi/{session_id}/{sheet_name}` | Treat a non-PCP sheet as a stage |







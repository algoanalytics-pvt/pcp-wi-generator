# PCP → Work Instruction Generator

FastAPI backend (`backend/`) + Vite/React SPA (`frontend/`). Upload a Process
Control Plan workbook, pick the sheets, and generate Work Instructions via an
LLM.

## Local development

Three terminals:

```bash
# 1. backend — http://localhost:8000
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# 2. frontend — http://localhost:3000, proxies /api to :8000
cd frontend
npm install
npm run dev

# 3. Tailwind watcher (only while editing styles)
cd frontend
npx @tailwindcss/cli -i ./src/input.css -o ./src/output.css --watch
```

Set at least one LLM provider key before generating — copy `.env.example` to
`backend/.env` (or the repo root `.env`) and fill one in.

## Running the production container

```bash
cp .env.example .env      # fill in a provider key
docker compose up -d --build
```

The image builds the SPA and serves it from FastAPI on host port **9274**. It is
built for the `/pcp_wi_generator` subpath, so browsing `http://localhost:9274/`
directly shows a blank page — that's expected. See **[DEPLOYMENT.md](DEPLOYMENT.md)**
for the nginx block, the EC2 steps, and the local prefix-stripping proxy recipe
for browser-testing the built app.

## Docs

- [DEPLOYMENT.md](DEPLOYMENT.md) — how this app is deployed, and why.
- [Docker_Ngnix_Proxy.txt](Docker_Ngnix_Proxy.txt) — copy-paste recipe: docker build → local nginx proxy → browser test.
- [MIGRATION_PLAYBOOK.md](MIGRATION_PLAYBOOK.md) — the generic runbook this followed.
- [reference/](reference/) — the QuoteVault write-ups kept as reference.
- [theme.md](theme.md) — design tokens.

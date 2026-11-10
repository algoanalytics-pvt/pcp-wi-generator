# Deploying PCP → WI Generator under /pcp_wi_generator

This app is a Vite/React SPA (`frontend/`) + FastAPI backend (`backend/`) served
from a **single container** on the shared domain, alongside the other usecases
(`/stock_optimiser`, `/invoice_analyser`, `/quote_vault`, …). FastAPI serves both
the SPA and the `/api/*` endpoints; nginx on the EC2 host strips the
`/pcp_wi_generator` prefix and gates the path with `auth_request`.

Written by following `MIGRATION_PLAYBOOK.md`, adapted to this repo's layout.
There is no legacy Streamlit container here — the app is already React +
FastAPI — so `docker-compose.yml` holds one service.
`reference/quote_vault_DEPLOYMENT.md` is the equivalent write-up for QuoteVault,
kept for comparison.

## Chosen values (the three-way subpath contract)

| Where | Value |
|---|---|
| nginx `location` + FastAPI `--root-path` | `/pcp_wi_generator` |
| `frontend/vite.config.js` `base` (build only) | `/pcp_wi_generator/` |
| Frontend API base (`frontend/src/api.js`) | derived from `import.meta.env.BASE_URL` (= `/pcp_wi_generator/`) |

Host port: **9274** (9271 invoice, 9272 stock_optimiser, 9273 quote_vault are
taken). Internal container port: **8000**.

There is **no router basename to set** — the SPA has no `react-router`; steps
are plain `useState` in `frontend/src/App.jsx`. The catch-all route still
matters, because a hard refresh on any URL under the subpath must return
`index.html`.

## What changed

- **`Dockerfile`** (new, repo root): multi-stage. Stage 1 (`node:20-slim`)
  builds the SPA from `frontend/` with `npm ci` (the lockfile **is** tracked, so
  `ci` is safe). Stage 2 (`python:3.11-slim`) installs
  `backend/requirements.txt`, copies `backend/` in full — including
  `training_data/`, whose one-shot example pair is read at request time — and
  copies the built `dist/` in as `backend/static/`. Entrypoint is
  **`backend.main:app`** (this repo's backend is a flat `backend/` directory,
  not a `backend/app/` package), started with `--proxy-headers
  --forwarded-allow-ips "*" --root-path /pcp_wi_generator`.
- **`backend/main.py`**: added a bare unauthenticated `GET /health` for nginx
  (the existing `/api/health` stays), plus — registered **last**, after every
  API route — a `/assets` `StaticFiles` mount and a catch-all
  `GET /{full_path:path}` that serves `index.html`, falling back from any real
  static file on disk. The catch-all returns a JSON `404` for unknown `/api/*`
  paths rather than a `200 text/html`, so a typo'd endpoint fails loudly. All
  the app's own routes were already `/api/*`-prefixed, so nothing had to move.
- **`backend/requirements.txt`**: was only `fastapi`, `uvicorn[standard]`,
  `python-multipart` — it did not list what the code actually imports. Now pins
  the full set: `pandas`, `openpyxl`, `xlrd` (legacy `.xls` + merged-cell info),
  `python-docx`, `requests`, `python-dotenv`, `pydantic`.
- **`frontend/src/api.js`** (new): `apiUrl('/upload-pcp')` builds the request URL
  from `import.meta.env.BASE_URL` → `/api/...` in dev, `/pcp_wi_generator/api/...`
  in a production build. No `.env.production` is needed — the subpath lives only
  in `vite.config.js` and flows everywhere through `BASE_URL`. `VITE_API_BASE`
  overrides it if ever needed.
- **All nine `fetch()` call sites** (`App.jsx`, `components/steps/*`, and the
  unused legacy copies in `components/`) now call `apiUrl(...)` instead of
  hardcoding `/api/...`, which would have resolved to the domain root and 404'd
  under the subpath.
- **`frontend/vite.config.js`**: `base` is `/pcp_wi_generator/` for `vite build`
  only; `npm run dev` and its `/api` → `localhost:8000` proxy are unaffected.
- **`frontend/package.json`**: `build` now runs `build:css` (the Tailwind CLI,
  `src/input.css` → `src/output.css`) before `vite build`. The committed
  `output.css` was stale — it was missing utilities the components use — and
  regenerating at build time keeps prod CSS in sync with the markup.
- **`docker-compose.yml`** (new): single service `pcp_wi_generator_web`
  (container/image `pcp_wi_generator_web`), publishes `9274:8000`, `restart:
  always`, reads secrets from a git-ignored `.env` via `env_file`.
- **`.dockerignore`** (new): keeps `.git`, `inputs/`, `node_modules`, and — note
  — **any `.env` at any depth** out of the image. That last one matters:
  `backend/main.py` calls `load_dotenv(backend/.env, override=True)` at import,
  so a stray `backend/.env` baked into the image would silently override the
  values compose injects.
- **`.env.example`** (new): documents the LLM provider keys. At least one must
  be set or `/api/generate` returns *"No API key found"*.
- **`.github/workflows/deployment.yml`** (new): a push to the deploy branch runs
  on `ubuntu-latest` and SSHes into the EC2 host (`appleboy/ssh-action`) to
  `git pull` and `sudo docker-compose up -d --build --force-recreate`.
  **CI owns `.env`** — it rewrites the file from the repo secrets on every
  deploy (passed via the action's `envs:` input rather than interpolated into
  `script`, so the values stay out of the printed `======CMD======` block).
  A fresh host therefore provisions itself, and rotating a key is a GitHub
  settings change. The write is guarded on at least one key being present, so a
  missing secret can't clobber a working `.env` with blanks; on a host with no
  `.env` at all it falls back to `touch .env`, because `docker-compose` aborts
  with *"env file … not found"* if the `env_file` is missing.
  **Repo secrets to set: `EC2_HOST`, `EC2_USER`, `SSH_PRIVATE_KEY`, and at least
  one of `MISTRAL_API_KEY` / `GROQ_API_KEY` / `OPENAI_API_KEY` /
  `TOGETHER_API_KEY`.** Confirm the `cd pcp-wi-generator/` path matches the
  repo's clone dir on the host, and that the branch in `on: push` matches the
  one in `git pull origin <branch>`.

The container listens on **8000** and is started with:
```
uvicorn backend.main:app --host 0.0.0.0 --port 8000 \
  --proxy-headers --forwarded-allow-ips "*" --root-path /pcp_wi_generator
```

## Runtime prerequisites

- **One LLM provider key** — `MISTRAL_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY`
  or `TOGETHER_API_KEY`. If the generate request doesn't name a model,
  `backend/main.py` picks the first provider in `llm_client.PROVIDERS` order that
  has a key set. Put the real value in a `.env` next to `docker-compose.yml` on
  the host (git-ignored); see `.env.example`.
- **No database, no S3, no IAM role.** Uploads go to the container's `tempfile`
  dir and generated XLSX to `backend/outputs/` — both ephemeral, both fine to
  lose on redeploy.
- **Single worker, deliberately.** Upload sessions live in an in-process dict
  (`sessions` in `backend/main.py`), so a second uvicorn worker would drop
  sessions at random. Don't add `--workers`. This also means a redeploy
  invalidates in-flight sessions — users re-upload; there's nothing to migrate.

## nginx config to apply on the EC2 host

Modeled on the live `/quote_vault/` block (`auth_request` + cookie relay), with
two additions this app genuinely needs:

```nginx
# PCP → WI Generator — FastAPI + React, single container, port 9274
location /pcp_wi_generator/ {
    auth_request /validate;
    auth_request_set $auth_status $upstream_status;
    error_page 401 403 = @unauthorized;
    error_page 500 502 503 504 = @unauthorized;

    add_header Set-Cookie $set_cookie_value always;

    proxy_pass http://127.0.0.1:9274/;          # trailing slash strips the /pcp_wi_generator prefix
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Prefix /pcp_wi_generator;

    client_max_body_size 50m;   # PCP workbooks run 0.5–2.5 MB; nginx's 1m default would 413 them
    proxy_read_timeout 600s;    # /api/generate calls the LLM once per selected sheet, serially
}

# SPA JS/CSS bundle — no auth gate
location ^~ /pcp_wi_generator/assets/ {
    proxy_pass http://127.0.0.1:9274/assets/;
}

# health check — no auth gate
location ^~ /pcp_wi_generator/health {
    proxy_pass http://127.0.0.1:9274/health;
}
```

Notes:
- **`client_max_body_size` is not optional here.** The sample workbooks in
  `inputs/` are 0.4–2.2 MB; nginx's 1 MB default would reject them with a 413
  that surfaces in the UI as a generic upload failure.
- **`proxy_read_timeout` is not optional either.** `/api/generate` loops over the
  selected sheets and makes one LLM call per sheet, in-process — a multi-stage
  PCP can run for minutes, well past nginx's 60 s default.
- The `/api/*` routes sit **inside** the gated `/pcp_wi_generator/` location, so
  every API call carries the auth requirement.
- `127.0.0.1:9274` is the **published host port**, not a Docker service name —
  nginx runs on the host and this container has no custom Docker network.
- No WebSocket headers — this backend has no WebSocket routes.
- `--root-path /pcp_wi_generator` + `--proxy-headers` is what makes FastAPI
  generate correct `/pcp_wi_generator/...` URLs (e.g. in `/openapi.json`).

## Local verification (all of this was run and passed)

```bash
touch .env                      # or fill in a provider key
docker compose up -d --build
```

Against the container directly on 9274:

| Check | Result |
|---|---|
| `curl localhost:9274/health` | `200 {"status":"ok"}` |
| `curl localhost:9274/api/health` | `200 {"status":"ok"}` |
| `curl localhost:9274/api/training-status` | `200 {"ready":true,…}` — training pair is inside the image |
| `curl localhost:9274/` | `index.html`, asset tags → `/pcp_wi_generator/assets/index-*.js` / `.css` |
| `curl localhost:9274/assets/index-*.js` | `200 application/javascript` |
| `curl localhost:9274/some/deep/path` | `200` `index.html` (catch-all / refresh) |
| `curl -X POST -d '{"bogus":1}' localhost:9274/api/generate` | `422 application/json` — **not** `200 text/html`, so API routes win over the catch-all |
| `curl localhost:9274/api/does-not-exist` | `404 {"detail":"Not Found"}` |
| `curl localhost:9274/openapi.json` | `"servers": [{"url": "/pcp_wi_generator"}]` |
| `POST /api/upload-pcp` with `inputs/215331700141pcp.xlsx` and `inputs/2789 0913 0172.xls` | both parse — pandas / openpyxl / xlrd all present in the image |

Note: hitting the container port with the `/pcp_wi_generator` prefix still
attached 404s into the catch-all and returns `index.html` — that's the "no proxy
in front" trap from `MIGRATION_PLAYBOOK.md` §8, not a bug. Loading
`http://localhost:9274/` in a browser shows a blank page for the same reason.
Test with the prefix stripped:

```bash
mkdir -p ~/docker_test_scratch
cat > ~/docker_test_scratch/nginx-pcp-wi.conf <<'EOF'
server {
    listen 80;
    client_max_body_size 50m;

    location /pcp_wi_generator/ {
        proxy_pass http://pcp_wi_generator_web:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Prefix /pcp_wi_generator;
        proxy_read_timeout 600s;
    }
}
EOF

docker run -d --rm --name pcp_wi_nginx_test \
  --network pcp-wi-generator_default \
  -p 9284:80 \
  -v ~/docker_test_scratch/nginx-pcp-wi.conf:/etc/nginx/conf.d/default.conf:ro \
  nginx:alpine

# then browse http://localhost:9284/pcp_wi_generator/
docker rm -f pcp_wi_nginx_test      # tear down
```

Through that proxy, `/pcp_wi_generator/` → `200`, every asset URL in the served
HTML → `200` with the right content-type, `/pcp_wi_generator/health` → `200`,
and an upload through `/pcp_wi_generator/api/upload-pcp` parses correctly. The
network name assumes the clone directory is `pcp-wi-generator`; re-check with
`docker network ls | grep pcp` if it differs.

## Remaining steps on the host

1. Clone the repo (directory name must match the `cd` in
   `.github/workflows/deployment.yml`).
2. Set the repo secrets: `EC2_HOST`, `EC2_USER`, `SSH_PRIVATE_KEY`, and a
   provider key (e.g. `MISTRAL_API_KEY`). The deploy writes `.env` on the host
   from these — no manual file creation needed.
3. Apply the nginx block above, `nginx -t`, reload.
4. Push to the deploy branch, then load `https://<domain>/pcp_wi_generator/`
   with a hard refresh.

To confirm the key landed, from the host:

```bash
curl -s localhost:9274/api/providers | grep -o '"env_key":"[A-Z_]*","key_set":[a-z]*'
```

`"key_set":true` on the provider you configured means `/api/generate` will work;
all-`false` means the secret wasn't set in GitHub (the deploy log says
`WARNING: no provider secret set` in that case).

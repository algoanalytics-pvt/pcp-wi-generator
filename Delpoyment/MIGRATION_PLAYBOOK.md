# Playbook: Streamlit → React + FastAPI, single container, subpath deployment

This is a generalized runbook extracted from migrating Invoice-Analyzer-Dashboard
off Streamlit. Use it whenever you're moving another app from a Streamlit
container to a Vite/React + FastAPI container, served through the same kind
of nginx-on-EC2 + `auth_request` setup, under a URL subpath (e.g.
`/some_app_name`) rather than its own domain.

The concrete example values below (`/invoice_analyser`, port `9271`, etc.)
are what this specific migration used — swap them for the new app's values.
See `DEPLOYMENT.md` in this repo for the fully filled-in version of every
template here.

---

## 0. Ground rule

**Never touch the old app's files.** Everything the old container needs to
keep running for instant rollback — its Dockerfile, compose file, entrypoint,
requirements — stays untouched. All new work goes in new files/directories.
This means both containers can run side by side during the cutover.

## 1. Investigate before writing anything

Don't assume any of this — read the actual files and write down what you
find. Assumptions here are exactly where this kind of migration goes wrong
(see "Traps we actually hit" below).

Old app (Streamlit or whatever it is):
- Its Dockerfile: base image, internal port (`EXPOSE`), whether the
  entrypoint script does anything beyond "run the app" (env substitution,
  analytics-tag injection, etc. — anything that must be replicated or is
  safe to drop).
- Its compose file: service name, container/image name, port mapping
  (`host:container`), restart policy, and whether it declares a custom
  Docker `network:`. **If there's no custom network, nginx is probably
  reaching it via the published host port, not via container DNS** — this
  determines what `proxy_pass` target you write later.
- Any analytics/GA injection code and where it's actually invoked from (a
  live import vs. a dead standalone script nobody runs).

New backend (FastAPI):
- Does it already mount static files or define a catch-all route? Don't
  duplicate.
- What's the API route prefix — is it uniformly `/api/*`, or are there
  exceptions (health checks are a common one, often left at `/health` with
  no prefix)? Exceptions matter for both the nginx block and for reasoning
  about the catch-all route order.
- CORS config — usually irrelevant once everything is same-origin behind
  nginx, but note it.
- Does it import anything from the old app's codebase (shared analysis
  logic, column-mapping constants, etc.)? If so, identify the **minimal**
  set of files to carry into the new image — don't drag in the old app's
  full dependency tree (e.g. `streamlit` itself) just because one module
  from that directory is reused.

New frontend (Vite/React):
- Current `base` in `vite.config.js` (usually unset/`/`).
- **Does a router actually exist?** Grep for `react-router`, `<Route`,
  `basename` before assuming there's a `basename` to set. Plenty of small
  dashboards use plain `useState` tab-switching with no client-side routing
  at all — in that case there's no `basename` to configure, and "test a
  deep-link refresh" degenerates to "refresh the one page."
- How the API base URL is defined (env var? hardcoded? relative fetch?) and
  its current default.
- Build command and output directory (`vite build` → `dist/` is the
  default, but check for overrides).

CI/deploy:
- Read the actual deploy workflow (e.g. `.github/workflows/deployment.yml`)
  and check **which directory it `cd`s into before running
  `docker-compose up`**. Cross-check that against where the compose file(s)
  actually live in git history (`git log -- '*docker-compose*'`). A mismatch
  here means the CI script and the tracked compose file don't agree — flag
  it, don't silently paper over it by guessing which one is "right." Put the
  new compose file wherever the CI script will actually find it with the
  least change to CI itself.

## 2. Multi-stage Dockerfile

```dockerfile
# ---------- Stage 1: build the SPA ----------
FROM node:20-slim AS frontend-build
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---------- Stage 2: FastAPI serving the API + the built SPA ----------
FROM python:3.11-slim AS backend
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/app backend/app
# Only copy the specific old-app files the backend actually imports —
# not the whole legacy directory.
COPY analyzer/__init__.py analyzer/analysis.py analyzer/
COPY --from=frontend-build /src/frontend/dist backend/static

EXPOSE 8000
CMD ["uvicorn", "backend.app.main:app", \
     "--host", "0.0.0.0", "--port", "8000", \
     "--proxy-headers", "--forwarded-allow-ips", "*", \
     "--root-path", "/invoice_analyser"]
```

Pick one internal port and use it everywhere (Dockerfile `EXPOSE`, the
`uvicorn --port` flag, and the compose file's container-side port mapping).
Don't reuse the old Streamlit port number just because it's already
"claimed" — pick a fresh one, since both containers may run simultaneously
during rollback.

`--root-path <subpath>` + `--proxy-headers --forwarded-allow-ips "*"` is
what lets FastAPI generate correct subpath-prefixed URLs (visible in
`/openapi.json`'s `servers` field) without ever hardcoding a scheme or host.

## 3. Subpath wiring — the three places that must all agree

Pick the exact external subpath once (spelling matters — verify it against
whatever URL is actually live today, don't assume) and use the identical
string in all three of these:

1. **`vite.config.js`** — `base: '<subpath>/'`, ideally gated to build only
   so local `npm run dev` isn't affected:
   ```js
   export default defineConfig(({ command }) => ({
     base: command === "build" ? "/invoice_analyser/" : "/",
     ...
   }));
   ```
2. **Router `basename`** — only if a router actually exists (see step 1).
   If there's no router, there's nothing to set here.
3. **Frontend API base URL** — bake the subpath into the production build via
   an env file so local dev is untouched:
   ```
   # frontend/.env.production
   VITE_API_BASE_URL=/invoice_analyser
   ```
   Confirm `api.js` (or wherever fetches originate) actually reads this var
   and doesn't have a second, redundant hardcoded default sitting elsewhere
   in the file that could drift out of sync.

## 4. FastAPI serves the SPA

nginx strips the external subpath before the request reaches the container
(see the nginx template below), so **the container only ever sees
unprefixed paths** (`/assets/...`, not `/invoice_analyser/assets/...`).
After building the frontend, open `dist/index.html` and check what the
`<script>`/`<link>` tags actually point at — confirm the mount path matches.

```python
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

if STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def spa(full_path: str) -> FileResponse:
        candidate = STATIC_DIR / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(STATIC_DIR / "index.html")
```

**This catch-all must be the last route registered.** Every `/health` and
`/api/*` route has to be defined above it in the file, or the catch-all
swallows API calls. After wiring it up, explicitly test a POST to a real API
route and confirm you get real API validation errors back, not `index.html`
— that's the check that proves route ordering is correct (a 200 with
`text/html` where you expected JSON is the signature of this bug).

## 5. docker-compose for the new app

Match the old compose file's conventions (naming style, restart policy,
lack-of-or-presence-of a custom network) so nginx's reach-the-container story
doesn't change in kind — only the port number changes:

```yaml
version: '3'
services:
  <new_service_name>:
    build:
      context: .
    container_name: <new_container_name>
    image: <new_image_name>
    ports:
      - '<new_host_port>:<internal_port>'
    restart: always
```

Use a **different host port** than the old app if you want the old container
to stay up simultaneously for rollback (you can't publish two containers on
the same host port at once).

## 6. nginx block to hand off (this lives outside the repo)

```nginx
location /invoice_analyser/ {
    # --- keep the existing auth_request / Lambda directives exactly as-is ---
    auth_request /internal-auth;
    auth_request_set $auth_status $upstream_status;

    proxy_pass http://127.0.0.1:<new_host_port>/;   # trailing slash strips the prefix
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Prefix /invoice_analyser;
}
```

- If nginx runs on the host (not in a container) and the compose file has no
  custom network, `proxy_pass` targets `127.0.0.1:<published_port>` — not a
  Docker service name, since nginx isn't on that Docker network.
- If the old app needed WebSockets (Streamlit does, for its live reruns) and
  the new one doesn't, **drop** any `Upgrade`/`Connection: upgrade` headers
  and WS-session-affinity/sticky-cookie config from the old block — carrying
  them forward unused is harmless but is dead config worth cleaning up while
  you're in there.

## 7. Verification checklist

Run these against the container directly (port `<new_host_port>`), then
again through a proxy that actually strips the subpath (see the local-test
trap below):

- [ ] `curl http://localhost:<port>/health` → `200`
- [ ] `curl http://localhost:<port>/` → serves `index.html`; confirm the
      `<script>`/`<link>` tags point at `/<subpath>/assets/...`
- [ ] `curl http://localhost:<port>/assets/<built-js-filename>` → `200`,
      correct `content-type` (proves the mount path matches the actual build
      output)
- [ ] `curl http://localhost:<port>/some/arbitrary/deep/path` → `200`,
      falls back to `index.html` (proves the catch-all works — this is the
      "deep-link refresh" check; if there's no client router yet, this is
      still worth checking since it validates the mechanism will work the
      moment routing is added)
- [ ] `curl -X POST http://localhost:<port>/api/<some-route>` with an
      intentionally invalid body → a real API error (4xx with JSON detail),
      **not** a `200 text/html` — this is the check that catches "catch-all
      registered before the API routes"
- [ ] `curl http://localhost:<port>/openapi.json` → `servers` shows the
      subpath, confirming `--root-path` is wired correctly

## 8. Trap: testing standalone in a browser gives a blank screen — this is expected

Loading `http://localhost:<port>/` directly in a browser (no nginx in front)
will show a blank page (often just the app's background color, nothing
else). This is **not a bug** — the built SPA's asset tags are always
prefixed with the subpath (baked in at build time), so the browser requests
`/<subpath>/assets/...`, which lands on the catch-all and gets back
`index.html` with a `200` instead of the real JS/CSS. The catch-all can't
tell "this looks like an asset request for a path that doesn't exist" from
"this is a page route that should fall back to index.html" — by design, it
doesn't need to, because in production nginx has already stripped the prefix
by the time the request arrives.

To actually browser-test the built SPA locally with the prefix intact, spin
up a throwaway nginx container joined to the same Docker network as the app
container, with a minimal config that mirrors the real nginx block (strip
the subpath, proxy to the app's container port):

```bash
docker run -d --name local_proxy --network <compose_project>_default -p 8080:80 nginx:alpine
docker cp local-nginx.conf local_proxy:/etc/nginx/conf.d/default.conf
docker exec local_proxy nginx -s reload
# then browse http://localhost:8080/<subpath>/
```

Note: this throwaway proxy is *not* part of `docker-compose.yml` and will be
orphaned if you `docker compose down` the app (its network gets torn down
out from under it) — just `docker rm -f` it and recreate when needed, or
fold it into the compose file as a second service if you want it to persist
across restarts.

## Traps we actually hit during this migration (read before you assume the same things)

- **CI cwd didn't match where the compose file lived in git.** The deploy
  workflow did `cd repo-root && docker-compose up -d --build`, but the only
  tracked compose file lived in a subdirectory. Don't assume the two agree —
  check both explicitly.
- **Assumed a router/`basename` would exist and it didn't.** The app used
  plain tab-state, no `react-router` at all. Grep before wiring a
  `basename` into code that doesn't have anywhere to put it.
- **The health check route was the one exception to the `/api/*` prefix
  convention** — worth explicitly checking for outliers like this rather
  than assuming every route follows the dominant pattern.
- **A GA-injection script in the old app turned out to be dead code** (a
  standalone script nobody's entrypoint ever called) — always confirm a
  piece of "must preserve this" logic is actually wired into the runtime
  path before spending effort replicating it.
- **The backend imported one module from the old app's directory.** Copying
  only that module (not the old app's full dependency tree, which included
  `streamlit` itself) kept the new image lean and kept "don't touch the old
  app" literally true — it was read, not edited.

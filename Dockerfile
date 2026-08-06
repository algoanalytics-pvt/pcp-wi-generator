# ---------- Stage 1: build the SPA ----------
FROM node:20-slim AS frontend-build
WORKDIR /src/frontend

# package-lock.json is tracked in this repo, so `npm ci` is safe.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
# `npm run build` regenerates src/output.css with the Tailwind CLI, then runs
# `vite build` with base=/pcp_wi_generator/ (see frontend/vite.config.js).
RUN npm run build

# ---------- Stage 2: FastAPI serving the API + the built SPA ----------
FROM python:3.11-slim AS backend
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Whole backend package, including training_data/ — the one-shot example pair
# is read at request time by /api/training-status and /api/generate.
COPY backend/ backend/

# Built SPA lands where backend/main.py looks for it (STATIC_DIR).
COPY --from=frontend-build /src/frontend/dist backend/static

EXPOSE 8000

# Single worker on purpose: upload sessions live in an in-process dict
# (backend/main.py `sessions`), so a second worker would lose them at random.
CMD ["uvicorn", "backend.main:app", \
     "--host", "0.0.0.0", "--port", "8000", \
     "--proxy-headers", "--forwarded-allow-ips", "*", \
     "--root-path", "/pcp_wi_generator"]

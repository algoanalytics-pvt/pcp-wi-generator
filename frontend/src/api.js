// Single source of truth for the backend base URL.
//
// The deployed app lives under a URL subpath (/pcp_wi_generator/) and nginx
// strips that prefix before the request reaches FastAPI — so the *browser* must
// ask for /pcp_wi_generator/api/... while the container only ever sees /api/...
//
// Vite bakes `import.meta.env.BASE_URL` from the `base` option in
// vite.config.js: "/" during `npm run dev`, "/pcp_wi_generator/" for
// `npm run build`. Deriving the API base from it means the subpath is spelled
// exactly once in the frontend, in vite.config.js, and local dev is untouched
// (the dev server proxies /api to localhost:8000).
//
// VITE_API_BASE overrides it if a build ever needs to point elsewhere.
const BASE = (import.meta.env.VITE_API_BASE ?? import.meta.env.BASE_URL).replace(/\/+$/, '');

export const API_BASE = `${BASE}/api`;

/** apiUrl('/upload-pcp') -> '/api/upload-pcp' (dev) | '/pcp_wi_generator/api/upload-pcp' (prod) */
export function apiUrl(path) {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

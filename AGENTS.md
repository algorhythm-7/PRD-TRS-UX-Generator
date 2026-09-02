<!-- XYZ-metadata
language: typescript
framework: react
httpClient: fetch
defaultPort: 3000
-->

# AGENTS.md — React App with Mantine & OAuth

## Stack
TypeScript, React, Vite, Mantine UI, Node.js Express proxy with OAuth client-credentials. The browser calls `/_api/*`; the server proxies to `BACKEND_URL` and injects a Bearer token.

## Project structure
- `app/src/` — React UI (calls `/_api/...` only, never the backend URL directly)
- `app/server.mjs` — Production proxy + OAuth token acquisition
- `app/vite.config.ts` — Dev proxy with same OAuth behaviour
- `deployment/` — Kubernetes / Helm values for env vars

## Connecting this frontend to an API service

When a user asks **how to connect to an API**, configure these **server-side** secrets in **XYZ → this service → Secrets** (never in GitHub directly, never in frontend code):

| Variable | What it means |
|----------|----------------|
| `BACKEND_URL` | Internal URL of the **API service** in the cluster, e.g. `http://my-api:5000`. The Express proxy forwards `/_api/*` here (prefix stripped). |
| `OAUTH_TOKEN_URL` | XYZ OAuth2 token endpoint. Default: `https://XYZ.Org.com/oauth2/token`. Where the proxy requests an access token. |
| `OAUTH_CLIENT_ID` | OAuth client ID for this frontend → API connection. Create via the API service **API Management** tab in XYZ (resource server client). |
| `OAUTH_CLIENT_SECRET` | Secret paired with `OAUTH_CLIENT_ID`. Store only in XYZ Secrets. |
| `OAUTH_AUDIENCE` | Token **audience** — must match the API service **slug** (XYZ resource server audience), e.g. `my-api`. |
| `OAUTH_SCOPE` | Scopes for the token, e.g. `read write`. Must match what the API resource server allows. |

### Setup steps
1. Deploy the **API service** first (category `api`). XYZ auto-creates a resource server; note its **slug** (used as `OAUTH_AUDIENCE`).
2. Open **API Management** on that service and create OAuth credentials (client ID + secret) for this frontend.
3. On **this frontend service → Secrets**, add all six variables above.
4. Redeploy or sync so the Node server picks up env vars.
5. In React code, call the API via the proxy path only:

```typescript
// Browser — always use /_api, not BACKEND_URL
const res = await fetch("/_api/health");
const data = await res.json();
```

The proxy adds `Authorization: Bearer <token>` using `OAUTH_*` automatically.

## Cookies and the XYZ reverse proxy

**Cookie-based authentication is not supported** when a frontend talks to a backend through XYZ.

XYZ serves apps under a path prefix (e.g. `/apps/my-app/`) via its reverse proxy. That proxy does **not** forward browser cookies to upstream backend services (except a narrow Streamlit XSRF exception for Streamlit apps themselves). Session cookies, `Set-Cookie` from APIs, and cookie-based login flows will not work reliably across the proxy boundary.

**Do instead:**
- Use **OAuth Bearer tokens** — this template's `/_api` proxy injects them server-side (recommended).
- Use **stateless API auth** (JWT in `Authorization` header, API keys on server-side only).
- Keep session state in the **frontend** (in-memory, localStorage for non-sensitive UI state) or on the **API** keyed by token — not in cross-service cookies.

**Do not:**
- Rely on Flask/Django session cookies, `credentials: 'include'` fetch to a separate API service, or cookie-based SSO between frontend and backend in XYZ.

### Troubleshooting
- `WARNING: OAUTH_CLIENT_ID or OAUTH_CLIENT_SECRET not set` — proxy works but **without** auth; set both secrets.
- 401 from API — check `OAUTH_AUDIENCE` matches API slug and client is registered on that resource server.
- Connection refused — check `BACKEND_URL` uses internal slug URL (`http://<api-slug>:<port>`), not a public URL.
- Session/login works locally but not in XYZ — likely cookie-based auth; switch to Bearer token / OAuth (see above).

## Calling other non-API services
For services without OAuth (Redis, internal tools), use a plain URL secret and server-side proxy or BFF pattern — do not expose internal URLs to the browser.

## Secrets
- All six OAuth variables + `BACKEND_URL` via **XYZ Secrets UI** only.
- `MY_GITHUB_TOKEN` may be auto-provisioned for CI/CD (passthrough, read-only in UI).

## Deployment
- Default port: **3000**
- Internal URL: `http://<service-slug>:3000`

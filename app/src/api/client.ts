import axios from "axios";

/**
 * Compute a subpath-safe base for API calls. In production the app may be
 * served behind an ingress at /some/prefix/ — deriving the base from the
 * current URL ensures /_api requests are routed correctly regardless of
 * the deployment path.
 */
const basePath = new URL("./", window.location.href).pathname.replace(
  /\/+$/,
  "",
);

const api = axios.create({
  baseURL: `${basePath}/_api`,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

/* ── Example API calls ──
 *
 * Replace these with your real backend endpoints.
 * OAuth Bearer tokens are injected automatically by the server-side proxy
 * (Express in production, Vite plugin in development) — the browser never
 * sees the token.
 */

export const getHealthCheck = () => api.get("/health");

export const getItems = () => api.get("/items");

export const createItem = (data: { name: string; description?: string }) =>
  api.post("/items", data);

export const getItemById = (id: string) => api.get(`/items/${id}`);

export const deleteItem = (id: string) => api.delete(`/items/${id}`);

export default api;

// Thin fetch wrapper. Same-origin in prod; Vite proxies /api -> :3000 in dev.
async function request(method, path, body, opts = {}) {
  const init = {
    method,
    credentials: "same-origin",
    headers: { "X-Requested-With": "XMLHttpRequest" } // CSRF guard
  };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`/api${path}`, { ...init, ...opts });
  if (res.status === 204) return null;
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) {
    const err = new Error((data && data.error) || res.statusText);
    err.status = res.status;
    err.details = data && data.details;
    throw err;
  }
  return data;
}

export const api = {
  get: (p) => request("GET", p),
  post: (p, b) => request("POST", p, b),
  put: (p, b) => request("PUT", p, b),
  patch: (p, b) => request("PATCH", p, b),
  del: (p) => request("DELETE", p),
  // multipart upload (import)
  upload: async (p, file) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api${p}`, { method: "POST", credentials: "same-origin", headers: { "X-Requested-With": "XMLHttpRequest" }, body: fd });
    const data = await res.json();
    if (!res.ok) { const e = new Error(data.error || "upload failed"); e.status = res.status; throw e; }
    return data;
  },
  download: (p) => { window.location.href = `/api${p}`; }
};

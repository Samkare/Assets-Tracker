// CSRF defense for the same-origin SPA.
// Cookies are SameSite=Lax (already blocks cross-site POST). This adds a required
// custom header that cross-origin pages cannot set without a CORS preflight we never grant.
const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

export function csrfGuard(req, res, next) {
  if (SAFE.has(req.method)) return next();
  // login is the one unauthenticated mutation; still require the header (client sends it).
  const xrw = req.get("X-Requested-With");
  if (xrw === "XMLHttpRequest") return next();
  res.status(403).json({ error: "CSRF check failed — missing X-Requested-With header" });
}

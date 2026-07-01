import { ROLE_RANK } from "@its/shared/constants";

export function requireAuth(req, res, next) {
  if (req.session?.userId) return next();
  res.status(401).json({ error: "authentication required" });
}

// Hierarchical: Admin satisfies any lower requirement.
export function requireRole(min) {
  return (req, res, next) => {
    if (!req.session?.userId) return res.status(401).json({ error: "authentication required" });
    if ((ROLE_RANK[req.session.role] || 0) >= ROLE_RANK[min]) return next();
    res.status(403).json({ error: "forbidden — insufficient role" });
  };
}

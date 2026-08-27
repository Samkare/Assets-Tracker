import { ROLE_RANK } from "@its/shared/constants";
import db from "../db/connection.js";

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

// Restricts an action to one specific account by email — NOT role-based, and role (even Admin)
// does not substitute. Used sparingly for actions the business wants gated to a single named
// person rather than a permission tier (e.g. "only Santosh can delete a PR/PO").
// Looks up the live email by session userId (falling back to the cached session value) so it
// takes effect immediately for already-logged-in sessions too, not just fresh logins.
export function requireUserEmail(email) {
  const target = String(email).toLowerCase();
  return (req, res, next) => {
    if (!req.session?.userId) return res.status(401).json({ error: "authentication required" });
    const row = db.prepare("SELECT email FROM users WHERE id = ?").get(req.session.userId);
    const current = row?.email ?? req.session.email;
    if (String(current || "").toLowerCase() === target) return next();
    res.status(403).json({ error: "forbidden — restricted to a specific user" });
  };
}

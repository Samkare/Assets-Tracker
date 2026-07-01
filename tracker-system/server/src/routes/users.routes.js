import { Router } from "express";
import bcrypt from "bcryptjs";
import db from "../db/connection.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { requireRole } from "../middleware/auth.js";
import { insertAudit } from "../db/repo.js";
import { userInputSchema, checkPassword } from "@its/shared/validation";

const router = Router();
const audit = (req, action, subject, detail) =>
  insertAudit({ actor: req.session.name || "system", action, tag: null, subject, dept: null, detail });

const pub = (u) => ({
  id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone,
  focus: u.focus, since: u.since, active: !!u.active, mustReset: !!u.must_reset,
  createdAt: u.created_at
});

// HIGH-15: refuse the change if it would leave zero active Admins.
function assertNotLastAdmin(targetId, willRemainAdmin) {
  if (willRemainAdmin) return;
  const target = db.prepare("SELECT role, active FROM users WHERE id = ?").get(targetId);
  if (!target || target.role !== "Admin" || !target.active) return; // not currently an admin → no risk
  const others = db.prepare("SELECT COUNT(*) n FROM users WHERE role='Admin' AND active=1 AND id != ?").get(targetId).n;
  if (others === 0) throw new HttpError(409, "Cannot remove the last active Admin");
}

router.get("/", requireRole("Admin"), asyncHandler((req, res) => {
  res.json(db.prepare("SELECT * FROM users WHERE active = 1 ORDER BY name").all().map(pub));
}));

router.post("/", requireRole("Admin"), asyncHandler(async (req, res) => {
  const u = userInputSchema.parse(req.body);
  const email = String(u.email).toLowerCase().trim(); // match login's case handling
  if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(email))
    throw new HttpError(409, "Email already in use");
  const initialPw = u.password || "Welcome!2026";
  if (initialPw.length > 128) throw new HttpError(400, "Password too long");
  const pol = checkPassword(initialPw);
  if (!pol.ok) throw new HttpError(400, pol.error);
  const hash = await bcrypt.hash(initialPw, 12);
  const info = db.prepare(`INSERT INTO users (name,email,password_hash,role,phone,focus,since,must_reset)
    VALUES (?,?,?,?,?,?,?,1)`).run(
      u.name, email, hash,
      u.role, u.phone, u.focus, u.since);
  audit(req, "user-created", email, `Created ${u.role} user ${u.name}`);
  res.status(201).json(pub(db.prepare("SELECT * FROM users WHERE id=?").get(info.lastInsertRowid)));
}));

router.put("/:id", requireRole("Admin"), asyncHandler((req, res) => {
  const u = userInputSchema.partial().parse(req.body);
  const id = Number(req.params.id);
  if (u.role && u.role !== "Admin") assertNotLastAdmin(id, false);
  db.prepare(`UPDATE users SET name=COALESCE(?,name), role=COALESCE(?,role),
    phone=COALESCE(?,phone), focus=COALESCE(?,focus), since=COALESCE(?,since) WHERE id=?`)
    .run(u.name ?? null, u.role ?? null, u.phone ?? null, u.focus ?? null, u.since ?? null, id);
  audit(req, "user-edited", u.email || `#${id}`, "User updated");
  res.json({ ok: true });
}));

router.post("/:id/password", requireRole("Admin"), asyncHandler(async (req, res) => {
  const next = String(req.body?.password || "");
  const pol = checkPassword(next);
  if (!pol.ok) throw new HttpError(400, pol.error);
  if (next.length > 128) throw new HttpError(400, "Password too long");
  const hash = await bcrypt.hash(next, 12);
  db.prepare("UPDATE users SET password_hash = ?, must_reset = 1 WHERE id = ?")
    .run(hash, req.params.id);
  audit(req, "user-edited", `#${req.params.id}`, "Password reset by admin");
  res.json({ ok: true });
}));

router.delete("/:id", requireRole("Admin"), asyncHandler((req, res) => {
  const id = Number(req.params.id);
  if (id === req.session.userId) throw new HttpError(400, "Cannot deactivate yourself");
  assertNotLastAdmin(id, false); // HIGH-15: refuse if this is the last Admin
  db.prepare("UPDATE users SET active = 0 WHERE id = ?").run(id);
  audit(req, "user-removed", `#${id}`, "User deactivated");
  res.json({ ok: true });
}));

export default router;

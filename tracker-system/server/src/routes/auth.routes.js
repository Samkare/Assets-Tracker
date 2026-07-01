import { Router } from "express";
import bcrypt from "bcryptjs";
import db from "../db/connection.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { requireAuth } from "../middleware/auth.js";
import { loginSchema, checkPassword } from "@its/shared/validation";

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

const router = Router();

const publicUser = (u) => u && ({
  id: u.id, name: u.name, email: u.email, role: u.role,
  phone: u.phone, focus: u.focus, since: u.since, mustReset: !!u.must_reset
});

router.post("/login", asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  // CRIT-3: bound password length to prevent bcrypt DoS
  if (String(password).length > 128) throw new HttpError(400, "Password too long");
  const u = db.prepare("SELECT * FROM users WHERE email = ? AND active = 1").get(email.toLowerCase().trim())
    || db.prepare("SELECT * FROM users WHERE email = ? AND active = 1").get(email.trim());

  // account lockout
  if (u && u.locked_until && u.locked_until > new Date().toISOString()) {
    throw new HttpError(423, "Account locked — too many attempts. Try again later.");
  }

  // CRIT-3: async bcrypt — don't block event loop
  const ok = u ? await bcrypt.compare(password, u.password_hash) : false;
  if (!u || !ok) {
    if (u) {
      const fails = (u.failed_attempts || 0) + 1;
      const lockUntil = fails >= MAX_FAILS
        ? new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() : null;
      db.prepare("UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?")
        .run(lockUntil ? 0 : fails, lockUntil, u.id);
    }
    throw new HttpError(401, "Invalid email or password");
  }

  db.prepare("UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?").run(u.id);
  // CRIT-1: regenerate session ID to prevent fixation
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: "session error" });
    req.session.userId = u.id;
    req.session.role = u.role;
    req.session.name = u.name;
    res.json(publicUser(u));
  });
}));

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get("/me", requireAuth, (req, res) => {
  const u = db.prepare("SELECT * FROM users WHERE id = ?").get(req.session.userId);
  if (!u) return req.session.destroy(() => res.status(401).json({ error: "session invalid" }));
  res.json(publicUser(u));
});

// self password change (also clears must_reset)
router.post("/password", requireAuth, asyncHandler(async (req, res) => {
  const { current, next } = req.body || {};
  const pol = checkPassword(next);
  if (!pol.ok) throw new HttpError(400, pol.error);
  if (String(current || "").length > 128 || String(next || "").length > 128) throw new HttpError(400, "Password too long");
  const u = db.prepare("SELECT * FROM users WHERE id = ?").get(req.session.userId);
  if (!(await bcrypt.compare(String(current || ""), u.password_hash))) {
    throw new HttpError(403, "Current password incorrect");
  }
  const hash = await bcrypt.hash(String(next), 12);
  db.prepare("UPDATE users SET password_hash = ?, must_reset = 0 WHERE id = ?").run(hash, u.id);
  // CRIT-1 / HIGH-15: regenerate session to invalidate any stolen old cookie
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: "session error" });
    req.session.userId = u.id;
    req.session.role = u.role;
    req.session.name = u.name;
    res.json({ ok: true });
  });
}));

export default router;

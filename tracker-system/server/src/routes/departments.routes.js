import { Router } from "express";
import db from "../db/connection.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { insertAudit } from "../db/repo.js";
import { departmentInputSchema } from "@its/shared/validation";
import { DEPT_HUE, DEFAULT_HUE } from "@its/shared/constants";

const router = Router();
const audit = (req, action, dept, detail) =>
  insertAudit({ actor: req.session.name || "system", action, tag: null, subject: dept, dept, detail });

router.get("/", requireAuth, asyncHandler((req, res) => {
  const rows = db.prepare(`
    SELECT d.id, d.name, d.hue, d.active,
      COUNT(a.id) AS count,
      COUNT(DISTINCT CASE WHEN a.shared = 0 THEN a.pseudo END) AS people,
      SUM(CASE WHEN a.monitors = 'Dual' THEN 1 ELSE 0 END) AS dual
    FROM departments d LEFT JOIN assets a ON a.department_id = d.id
    WHERE d.active = 1
    GROUP BY d.id ORDER BY count DESC, d.name ASC
  `).all();
  res.json(rows);
}));

router.post("/", requireRole("Admin"), asyncHandler((req, res) => {
  const { name, hue } = departmentInputSchema.parse(req.body);
  if (db.prepare("SELECT 1 FROM departments WHERE name = ?").get(name))
    throw new HttpError(409, "Department already exists");
  const info = db.prepare("INSERT INTO departments (name, hue) VALUES (?, ?)")
    .run(name, hue ?? DEPT_HUE[name] ?? DEFAULT_HUE);
  audit(req, "dept-created", name, `Department ${name} created`);
  res.status(201).json({ id: info.lastInsertRowid, name, hue: hue ?? DEFAULT_HUE });
}));

router.put("/:id", requireRole("Admin"), asyncHandler((req, res) => {
  const { name, hue } = departmentInputSchema.partial().parse(req.body);
  db.prepare("UPDATE departments SET name = COALESCE(?, name), hue = COALESCE(?, hue) WHERE id = ?")
    .run(name ?? null, hue ?? null, req.params.id);
  audit(req, "dept-edited", name || `#${req.params.id}`, "Department updated");
  res.json({ ok: true });
}));

router.delete("/:id", requireRole("Admin"), asyncHandler((req, res) => {
  const used = db.prepare("SELECT COUNT(*) n FROM assets WHERE department_id = ?").get(req.params.id).n;
  if (used) throw new HttpError(409, `Department has ${used} assets — reassign first`);
  db.prepare("UPDATE departments SET active = 0 WHERE id = ?").run(req.params.id);
  audit(req, "dept-removed", `#${req.params.id}`, "Department archived");
  res.json({ ok: true });
}));

export default router;

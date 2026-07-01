import { Router } from "express";
import db from "../db/connection.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { rowToAsset, insertAudit } from "../db/repo.js";
import { employeeInputSchema } from "@its/shared/validation";

const router = Router();
const audit = (req, action, name, dept, detail) =>
  insertAudit({ actor: req.session.name || "system", action, tag: null, subject: name, dept, detail });

// Distinct employees derived from assigned assets + their counts.
router.get("/", requireAuth, asyncHandler((req, res) => {
  const rows = db.prepare(`
    SELECT a.pseudo AS name, d.name AS dept, COUNT(a.id) AS assets,
           MIN(e.id) AS employeeId
    FROM assets a JOIN departments d ON d.id = a.department_id
    LEFT JOIN employees e ON e.id = a.employee_id
    WHERE a.shared = 0
    GROUP BY a.pseudo, d.name ORDER BY a.pseudo ASC
  `).all();
  res.json(rows);
}));

router.get("/:id/assets", requireAuth, asyncHandler((req, res) => {
  const rows = db.prepare(`
    SELECT a.*, d.name AS dept_name FROM assets a JOIN departments d ON d.id = a.department_id
    WHERE a.employee_id = ?`).all(req.params.id).map(rowToAsset);
  res.json(rows);
}));

router.post("/", requireRole("IT-Manager"), asyncHandler((req, res) => {
  const { name, dept } = employeeInputSchema.parse(req.body);
  const d = db.prepare("SELECT id FROM departments WHERE name = ?").get(dept);
  if (!d) throw new HttpError(400, "Unknown department");
  const info = db.prepare("INSERT OR IGNORE INTO employees (name, department_id) VALUES (?, ?)")
    .run(name, d.id);
  audit(req, "employee-created", name, dept, `Employee ${name} added to ${dept}`);
  res.status(201).json({ id: info.lastInsertRowid, name, dept });
}));

router.put("/:id", requireRole("IT-Manager"), asyncHandler((req, res) => {
  const { name } = employeeInputSchema.partial().parse(req.body);
  if (name) {
    db.prepare("UPDATE employees SET name = ? WHERE id = ?").run(name, req.params.id);
    // keep denormalized snapshot on assets in sync
    db.prepare("UPDATE assets SET pseudo = ? WHERE employee_id = ?").run(name, req.params.id);
    audit(req, "employee-edited", name, null, "Employee renamed");
  }
  res.json({ ok: true });
}));

router.delete("/:id", requireRole("IT-Manager"), asyncHandler((req, res) => {
  const used = db.prepare("SELECT COUNT(*) n FROM assets WHERE employee_id = ?").get(req.params.id).n;
  if (used) throw new HttpError(409, `Employee has ${used} assets assigned — reassign first`);
  db.prepare("DELETE FROM employees WHERE id = ?").run(req.params.id);
  audit(req, "employee-removed", `#${req.params.id}`, null, "Employee removed");
  res.json({ ok: true });
}));

export default router;

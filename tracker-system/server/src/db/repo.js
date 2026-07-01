// Low-level DB helpers reused by import, seed, and CRUD services.
import db from "./connection.js";
import { DEPT_HUE, DEFAULT_HUE, SHARED_PSEUDO } from "@its/shared/constants";

export function getOrCreateDept(name) {
  const found = db.prepare("SELECT id FROM departments WHERE name = ?").get(name);
  if (found) return found.id;
  const hue = DEPT_HUE[name] ?? DEFAULT_HUE;
  const info = db.prepare("INSERT INTO departments (name, hue) VALUES (?, ?)").run(name, hue);
  return info.lastInsertRowid;
}

export function deptExists(name) {
  return !!db.prepare("SELECT 1 FROM departments WHERE name = ?").get(name);
}

export function getOrCreateEmployee(name, departmentId) {
  if (!name || name === SHARED_PSEUDO) return null;
  const found = db.prepare(
    "SELECT id FROM employees WHERE name = ? AND department_id IS ?"
  ).get(name, departmentId);
  if (found) return found.id;
  const info = db.prepare(
    "INSERT INTO employees (name, department_id) VALUES (?, ?)"
  ).run(name, departmentId);
  return info.lastInsertRowid;
}

// CRIT-7: strict insert — fails on duplicate id instead of silently overwriting via ON CONFLICT.
// Use this for createAsset() so two concurrent creates can't both succeed by clobbering each other.
export function insertAssetStrict(rec) {
  const deptId = getOrCreateDept(rec.dept);
  const empId = rec.shared ? null : getOrCreateEmployee(rec.pseudo, deptId);
  db.prepare(`
    INSERT INTO assets (id, pseudo, full_name, employee_id, shared, department_id, type, cpu, ram, hdd,
      mon1, mon2, monitors, headphone, speaker, keyboard, mouse, ip_phone, webcam, mobile_stand,
      whatsapp, nextiva, return_due, status, updated_at)
    VALUES (@id, @pseudo, @full_name, @employee_id, @shared, @department_id, @type, @cpu, @ram, @hdd,
      @mon1, @mon2, @monitors, @headphone, @speaker, @keyboard, @mouse, @ip_phone, @webcam, @mobile_stand,
      @whatsapp, @nextiva, @return_due, @status, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  `).run({
    id: rec.id, pseudo: rec.pseudo, full_name: rec.fullName ?? null, employee_id: empId, shared: rec.shared ? 1 : 0,
    department_id: deptId, type: rec.type, cpu: rec.cpu, ram: rec.ram, hdd: rec.hdd,
    mon1: rec.mon1, mon2: rec.mon2, monitors: rec.monitors,
    headphone: rec.headphone ? 1 : 0, speaker: rec.speaker ? 1 : 0,
    keyboard: rec.keyboard ? 1 : 0, mouse: rec.mouse ? 1 : 0,
    ip_phone: rec.ipPhone ? 1 : 0, webcam: rec.webcam ? 1 : 0,
    mobile_stand: rec.mobileStand ? 1 : 0,
    whatsapp: rec.whatsapp, nextiva: rec.nextiva, return_due: rec.returnDue ?? null, status: rec.status || "active"
  });
}

// rec = canonical asset from buildAsset(). Upserts by id (asset tag).
export function upsertAsset(rec) {
  const deptId = getOrCreateDept(rec.dept);
  const empId = rec.shared ? null : getOrCreateEmployee(rec.pseudo, deptId);
  db.prepare(`
    INSERT INTO assets (id, pseudo, full_name, employee_id, shared, department_id, type, cpu, ram, hdd,
      mon1, mon2, monitors, headphone, speaker, keyboard, mouse, ip_phone, webcam, mobile_stand,
      whatsapp, nextiva, return_due, status, updated_at)
    VALUES (@id, @pseudo, @full_name, @employee_id, @shared, @department_id, @type, @cpu, @ram, @hdd,
      @mon1, @mon2, @monitors, @headphone, @speaker, @keyboard, @mouse, @ip_phone, @webcam, @mobile_stand,
      @whatsapp, @nextiva, @return_due, @status, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    ON CONFLICT(id) DO UPDATE SET
      pseudo=excluded.pseudo, full_name=excluded.full_name, employee_id=excluded.employee_id, shared=excluded.shared,
      department_id=excluded.department_id, type=excluded.type, cpu=excluded.cpu,
      ram=excluded.ram, hdd=excluded.hdd, mon1=excluded.mon1, mon2=excluded.mon2,
      monitors=excluded.monitors, headphone=excluded.headphone, speaker=excluded.speaker,
      keyboard=excluded.keyboard, mouse=excluded.mouse,
      ip_phone=excluded.ip_phone, webcam=excluded.webcam, mobile_stand=excluded.mobile_stand,
      whatsapp=excluded.whatsapp, nextiva=excluded.nextiva, return_due=excluded.return_due, status=excluded.status,
      updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
  `).run({
    id: rec.id, pseudo: rec.pseudo, full_name: rec.fullName ?? null, employee_id: empId, shared: rec.shared ? 1 : 0,
    department_id: deptId, type: rec.type, cpu: rec.cpu, ram: rec.ram, hdd: rec.hdd,
    mon1: rec.mon1, mon2: rec.mon2, monitors: rec.monitors,
    headphone: rec.headphone ? 1 : 0, speaker: rec.speaker ? 1 : 0,
    keyboard: rec.keyboard ? 1 : 0, mouse: rec.mouse ? 1 : 0,
    ip_phone: rec.ipPhone ? 1 : 0, webcam: rec.webcam ? 1 : 0,
    mobile_stand: rec.mobileStand ? 1 : 0,
    whatsapp: rec.whatsapp, nextiva: rec.nextiva, return_due: rec.returnDue ?? null, status: rec.status || "active"
  });
}

export function insertAudit({ actor, action, tag, subject, dept, detail }) {
  db.prepare(
    "INSERT INTO audit_log (actor, action, tag, subject, dept, detail) VALUES (?,?,?,?,?,?)"
  ).run(actor, action, tag ?? null, subject ?? null, dept ?? null, detail ?? null);
}

export function insertAssignment({ asset_id, employee_name, dept, action, actor, note }) {
  db.prepare(
    "INSERT INTO assignment_history (asset_id, employee_name, dept, action, actor, note) VALUES (?,?,?,?,?,?)"
  ).run(asset_id, employee_name ?? null, dept ?? null, action, actor, note ?? null);
}

// Map a DB asset row back to the API/client shape (camelCase, booleans).
export function rowToAsset(r) {
  if (!r) return null;
  return {
    id: r.id, pseudo: r.pseudo, fullName: r.full_name ?? null, shared: !!r.shared, dept: r.dept_name ?? r.dept,
    type: r.type, cpu: r.cpu, ram: r.ram, hdd: r.hdd, mon1: r.mon1, mon2: r.mon2,
    monitors: r.monitors,
    headphone: !!r.headphone, speaker: !!r.speaker, ipPhone: !!r.ip_phone,
    webcam: !!r.webcam, mobileStand: !!r.mobile_stand,
    keyboard: !!r.keyboard, mouse: !!r.mouse,
    whatsapp: r.whatsapp, nextiva: r.nextiva, returnDue: r.return_due ?? null, status: r.status,
    inStock: !!r.in_stock,
    createdAt: r.created_at, updatedAt: r.updated_at
  };
}

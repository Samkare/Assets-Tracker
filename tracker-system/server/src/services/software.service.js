import db from "../db/connection.js";
import { HttpError } from "../middleware/error.js";

const seatsUsed = (id) =>
  db.prepare("SELECT COUNT(*) n FROM software_assignments WHERE software_id = ?").get(id).n;

export function listSoftware() {
  const rows = db.prepare("SELECT * FROM software ORDER BY name").all();
  // single pass instead of N+1: fetch all assignments once, group by software_id
  const all = db.prepare("SELECT * FROM software_assignments ORDER BY assigned_at DESC").all();
  const byId = new Map();
  for (const a of all) { (byId.get(a.software_id) || byId.set(a.software_id, []).get(a.software_id)).push(a); }
  return rows.map((s) => {
    const assignments = byId.get(s.id) || [];
    return { ...s, seatsUsed: assignments.length, assignments };
  });
}

export function getSoftware(id) {
  const s = db.prepare("SELECT * FROM software WHERE id = ?").get(id);
  if (!s) return null;
  const assignments = db.prepare(
    "SELECT * FROM software_assignments WHERE software_id = ? ORDER BY assigned_at DESC"
  ).all(id);
  return { ...s, seatsUsed: assignments.length, assignments };
}

export function createSoftware(b) {
  if (!b?.name?.trim()) throw new HttpError(400, "Name required");
  const info = db.prepare(`INSERT INTO software (name, vendor, license_key, seats_total, purchase_date, cost, renewal_date, status, notes)
    VALUES (@name,@vendor,@license_key,@seats_total,@purchase_date,@cost,@renewal_date,@status,@notes)`).run({
    name: b.name.trim(), vendor: b.vendor ?? null, license_key: b.licenseKey ?? null,
    seats_total: Math.max(1, Math.trunc(Number(b.seatsTotal)) || 1), purchase_date: b.purchaseDate ?? null,
    cost: b.cost == null || b.cost === "" ? null : Number(b.cost),
    renewal_date: b.renewalDate ?? null, status: b.status === "expired" ? "expired" : "active",
    notes: b.notes ?? null
  });
  return getSoftware(info.lastInsertRowid);
}

export function updateSoftware(id, b) {
  if (!db.prepare("SELECT 1 FROM software WHERE id=?").get(id)) throw new HttpError(404, "Not found");
  db.prepare(`UPDATE software SET
    name=COALESCE(@name,name), vendor=COALESCE(@vendor,vendor), license_key=COALESCE(@license_key,license_key),
    seats_total=COALESCE(@seats_total,seats_total), purchase_date=COALESCE(@purchase_date,purchase_date),
    cost=COALESCE(@cost,cost), renewal_date=COALESCE(@renewal_date,renewal_date),
    status=COALESCE(@status,status), notes=COALESCE(@notes,notes) WHERE id=@id`).run({
    id, name: b.name ?? null, vendor: b.vendor ?? null, license_key: b.licenseKey ?? null,
    seats_total: b.seatsTotal != null ? Math.max(1, Math.trunc(Number(b.seatsTotal)) || 1) : null,
    purchase_date: b.purchaseDate ?? null, cost: b.cost != null && b.cost !== "" ? Number(b.cost) : null,
    renewal_date: b.renewalDate ?? null, status: b.status ?? null, notes: b.notes ?? null
  });
  return getSoftware(id);
}

export function deleteSoftware(id) {
  db.prepare("DELETE FROM software WHERE id = ?").run(id); // cascades assignments
  return { ok: true };
}

export function assign(id, { employeeName, assetId }, actor) {
  if (!employeeName && !assetId) throw new HttpError(400, "Assign to an employee or asset");
  // CRIT-6: atomic seat reservation — re-check seats inside transaction so two concurrent
  // assigns can't both pass the limit. SELECT + INSERT happen serialized under the tx.
  const tx = db.transaction(() => {
    const s = db.prepare("SELECT * FROM software WHERE id=?").get(id);
    if (!s) throw new HttpError(404, "Software not found");
    const used = db.prepare("SELECT COUNT(*) n FROM software_assignments WHERE software_id = ?").get(id).n;
    if (used >= s.seats_total) throw new HttpError(409, "No seats available");
    db.prepare("INSERT INTO software_assignments (software_id, employee_name, asset_id, actor) VALUES (?,?,?,?)")
      .run(id, employeeName ?? null, assetId ?? null, actor);
  });
  tx();
  return getSoftware(id);
}

export function unassign(id, assignmentId) {
  db.prepare("DELETE FROM software_assignments WHERE id = ? AND software_id = ?").run(assignmentId, id);
  return getSoftware(id);
}

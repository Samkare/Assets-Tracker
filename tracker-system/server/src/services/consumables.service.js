import db from "../db/connection.js";
import { HttpError } from "../middleware/error.js";

const withLow = (r) => ({ ...r, low: r.qty <= r.reorder_level });

// items created via the inventory flow set category_id (not the legacy text column);
// resolve the display category from either so Stock Overview never shows a blank.
const CONSUMABLE_SELECT = `
  SELECT c.*, COALESCE(cat.name, c.category) AS category,
         (SELECT name FROM suppliers WHERE id = c.supplier_id) AS supplier
  FROM consumables c LEFT JOIN categories cat ON cat.id = c.category_id`;

export function listConsumables() {
  return db.prepare(`${CONSUMABLE_SELECT} ORDER BY c.name`).all().map(withLow);
}

export function getConsumable(id) {
  const c = db.prepare(`${CONSUMABLE_SELECT} WHERE c.id = ?`).get(id);
  if (!c) return null;
  const log = db.prepare("SELECT * FROM consumable_log WHERE consumable_id = ? ORDER BY at DESC LIMIT 50").all(id);
  return { ...withLow(c), log };
}

export function createConsumable(b) {
  if (!b?.name?.trim()) throw new HttpError(400, "Name required");
  const info = db.prepare(`INSERT INTO consumables (name, category, qty, reorder_level, unit, location, notes)
    VALUES (@name,@category,@qty,@reorder_level,@unit,@location,@notes)`).run({
    name: b.name.trim(), category: b.category ?? null,
    qty: Number(b.qty) || 0, reorder_level: Number(b.reorderLevel) || 0,
    unit: b.unit || "pcs", location: b.location ?? null, notes: b.notes ?? null
  });
  return getConsumable(info.lastInsertRowid);
}

export function updateConsumable(id, b) {
  if (!db.prepare("SELECT 1 FROM consumables WHERE id=?").get(id)) throw new HttpError(404, "Not found");
  db.prepare(`UPDATE consumables SET
    name=COALESCE(@name,name), category=COALESCE(@category,category),
    reorder_level=COALESCE(@reorder_level,reorder_level), unit=COALESCE(@unit,unit),
    location=COALESCE(@location,location), notes=COALESCE(@notes,notes) WHERE id=@id`).run({
    id, name: b.name ?? null, category: b.category ?? null,
    reorder_level: b.reorderLevel != null ? Number(b.reorderLevel) : null,
    unit: b.unit ?? null, location: b.location ?? null, notes: b.notes ?? null
  });
  return getConsumable(id);
}

// Stock adjustment: delta +/- with logged reason. Qty floored at 0.
export function adjustStock(id, delta, reason, actor) {
  const c = db.prepare("SELECT * FROM consumables WHERE id=?").get(id);
  if (!c) throw new HttpError(404, "Not found");
  const d = Math.trunc(Number(delta));
  if (!d) throw new HttpError(400, "Delta required (non-zero integer)");
  const tx = db.transaction(() => {
    const next = Math.max(0, c.qty + d);
    db.prepare("UPDATE consumables SET qty=? WHERE id=?").run(next, id);
    db.prepare("INSERT INTO consumable_log (consumable_id, delta, reason, actor) VALUES (?,?,?,?)")
      .run(id, d, reason ?? null, actor);
  });
  tx();
  return getConsumable(id);
}

export function deleteConsumable(id) {
  db.prepare("DELETE FROM consumables WHERE id = ?").run(id);
  return { ok: true };
}

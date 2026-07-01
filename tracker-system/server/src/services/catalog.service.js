// Suppliers + categories — supporting records for inventory organization.
import db from "../db/connection.js";
import { HttpError } from "../middleware/error.js";

/* ---------- suppliers ---------- */
export function listSuppliers() {
  return db.prepare(`
    SELECT s.*, (SELECT COUNT(*) FROM consumables c WHERE c.supplier_id = s.id) AS itemCount
    FROM suppliers s WHERE active = 1 ORDER BY name`).all();
}
export function createSupplier(b) {
  if (!b?.name?.trim()) throw new HttpError(400, "Name required");
  const info = db.prepare(`INSERT INTO suppliers (name, contact, email, phone, lead_time_days, notes)
    VALUES (@name,@contact,@email,@phone,@lead,@notes)`).run({
    name: b.name.trim(), contact: b.contact ?? null, email: b.email ?? null,
    phone: b.phone ?? null, lead: b.leadTimeDays != null ? Number(b.leadTimeDays) : null, notes: b.notes ?? null
  });
  return db.prepare("SELECT * FROM suppliers WHERE id=?").get(info.lastInsertRowid);
}
export function updateSupplier(id, b) {
  if (!db.prepare("SELECT 1 FROM suppliers WHERE id=?").get(id)) throw new HttpError(404, "Not found");
  db.prepare(`UPDATE suppliers SET name=COALESCE(@name,name), contact=@contact, email=@email,
    phone=@phone, lead_time_days=@lead, notes=@notes WHERE id=@id`).run({
    id, name: b.name ?? null, contact: b.contact ?? null, email: b.email ?? null,
    phone: b.phone ?? null, lead: b.leadTimeDays != null ? Number(b.leadTimeDays) : null, notes: b.notes ?? null
  });
  return db.prepare("SELECT * FROM suppliers WHERE id=?").get(id);
}
export function deleteSupplier(id) {
  const used = db.prepare("SELECT COUNT(*) n FROM consumables WHERE supplier_id=?").get(id).n;
  if (used) throw new HttpError(409, `${used} item(s) use this supplier — reassign first`);
  db.prepare("UPDATE suppliers SET active=0 WHERE id=?").run(id);
  return { ok: true };
}

/* ---------- categories ---------- */
export function listCategories() {
  return db.prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM consumables i WHERE i.category_id = c.id) AS itemCount
    FROM categories c ORDER BY name`).all();
}
export function createCategory(b) {
  if (!b?.name?.trim()) throw new HttpError(400, "Name required");
  if (db.prepare("SELECT 1 FROM categories WHERE name=?").get(b.name.trim())) throw new HttpError(409, "Category exists");
  const info = db.prepare("INSERT INTO categories (name, kind) VALUES (?, ?)")
    .run(b.name.trim(), ["consumable", "accessory", "hardware"].includes(b.kind) ? b.kind : "consumable");
  return db.prepare("SELECT * FROM categories WHERE id=?").get(info.lastInsertRowid);
}
export function updateCategory(id, b) {
  db.prepare("UPDATE categories SET name=COALESCE(?,name), kind=COALESCE(?,kind) WHERE id=?")
    .run(b.name ?? null, b.kind ?? null, id);
  return db.prepare("SELECT * FROM categories WHERE id=?").get(id);
}
export function deleteCategory(id) {
  const used = db.prepare("SELECT COUNT(*) n FROM consumables WHERE category_id=?").get(id).n;
  if (used) throw new HttpError(409, `${used} item(s) in this category — reassign first`);
  db.prepare("DELETE FROM categories WHERE id=?").run(id);
  return { ok: true };
}

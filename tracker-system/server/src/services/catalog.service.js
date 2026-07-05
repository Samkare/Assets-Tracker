// Suppliers + categories — supporting records for inventory organization.
import db from "../db/connection.js";
import { HttpError } from "../middleware/error.js";

/* ---------- suppliers ---------- */
// gstNumber alias added so the client gets camelCase; snake_case fields kept for existing consumers.
function getSupplier(id) {
  return db.prepare("SELECT *, gst_number AS gstNumber FROM suppliers WHERE id = ?").get(id);
}
export function listSuppliers() {
  return db.prepare(`
    SELECT s.*, s.gst_number AS gstNumber,
      (SELECT COUNT(*) FROM consumables c WHERE c.supplier_id = s.id) AS itemCount
    FROM suppliers s WHERE active = 1 ORDER BY name`).all();
}
const clean = (v) => (v === "" || v == null ? null : v);
const asLead = (v) => (v != null && v !== "" ? Number(v) : null);
export function createSupplier(b) {
  if (!b?.name?.trim()) throw new HttpError(400, "Name required");
  const info = db.prepare(`INSERT INTO suppliers (name, address, phone, email, gst_number, contact, lead_time_days, notes)
    VALUES (@name,@address,@phone,@email,@gst,@contact,@lead,@notes)`).run({
    name: b.name.trim(), address: clean(b.address), phone: clean(b.phone), email: clean(b.email),
    gst: clean(b.gstNumber), contact: clean(b.contact), lead: asLead(b.leadTimeDays), notes: clean(b.notes)
  });
  return getSupplier(info.lastInsertRowid);
}
// COALESCE everywhere so the vendor form (name/address/phone/email/gst) and the inventory form
// (name/contact/email/phone/lead/notes) can each update their own fields without wiping the other's.
export function updateSupplier(id, b) {
  if (!db.prepare("SELECT 1 FROM suppliers WHERE id=?").get(id)) throw new HttpError(404, "Not found");
  db.prepare(`UPDATE suppliers SET
    name=COALESCE(@name,name), address=COALESCE(@address,address), phone=COALESCE(@phone,phone),
    email=COALESCE(@email,email), gst_number=COALESCE(@gst,gst_number), contact=COALESCE(@contact,contact),
    lead_time_days=COALESCE(@lead,lead_time_days), notes=COALESCE(@notes,notes) WHERE id=@id`).run({
    id, name: b.name ?? null, address: b.address ?? null, phone: b.phone ?? null,
    email: b.email ?? null, gst: b.gstNumber ?? null, contact: b.contact ?? null,
    lead: asLead(b.leadTimeDays), notes: b.notes ?? null
  });
  return getSupplier(id);
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

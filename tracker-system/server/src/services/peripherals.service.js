import db from "../db/connection.js";
import { HttpError } from "../middleware/error.js";

const slug = (s) => String(s || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export function listPeripherals(includeInactive = false) {
  return db.prepare(
    `SELECT id, key, label, active, sort_order FROM peripherals
     ${includeInactive ? "" : "WHERE active = 1"} ORDER BY sort_order, label`
  ).all().map((p) => ({ ...p, active: !!p.active }));
}

export function createPeripheral({ label }) {
  const name = String(label || "").trim();
  if (!name) throw new HttpError(400, "Name required");
  if (name.length > 40) throw new HttpError(400, "Name too long (max 40)");
  let key = slug(name);
  if (!key) throw new HttpError(400, "Name must contain letters or numbers");
  if (db.prepare("SELECT 1 FROM peripherals WHERE key = ?").get(key))
    throw new HttpError(409, "A peripheral with that name already exists");
  const maxSort = db.prepare("SELECT COALESCE(MAX(sort_order),0) m FROM peripherals").get().m;
  const info = db.prepare("INSERT INTO peripherals (key, label, sort_order) VALUES (?,?,?)").run(key, name, maxSort + 1);
  return db.prepare("SELECT id, key, label, active, sort_order FROM peripherals WHERE id = ?").get(info.lastInsertRowid);
}

export function updatePeripheral(id, { label, active }) {
  const p = db.prepare("SELECT * FROM peripherals WHERE id = ?").get(id);
  if (!p) throw new HttpError(404, "Peripheral not found");
  const name = label != null ? String(label).trim() : p.label;
  if (!name) throw new HttpError(400, "Name required");
  db.prepare("UPDATE peripherals SET label = ?, active = ? WHERE id = ?")
    .run(name, active != null ? (active ? 1 : 0) : p.active, id);
  return db.prepare("SELECT id, key, label, active, sort_order FROM peripherals WHERE id = ?").get(id);
}

export function deletePeripheral(id) {
  const info = db.prepare("DELETE FROM peripherals WHERE id = ?").run(id); // cascades asset_peripherals
  if (!info.changes) throw new HttpError(404, "Peripheral not found");
  return { ok: true };
}

// label for a custom peripheral key (used by the stock-linkage)
export function labelForKey(key) {
  const r = db.prepare("SELECT label FROM peripherals WHERE key = ?").get(key);
  return r ? r.label : key;
}

// --- per-asset custom peripheral assignment (keys array) ---
export function getAssetPeripherals(assetId) {
  return db.prepare(
    `SELECT p.key FROM asset_peripherals ap JOIN peripherals p ON p.id = ap.peripheral_id
     WHERE ap.asset_id = ? ORDER BY p.sort_order`
  ).all(assetId).map((r) => r.key);
}

// batch: { assetId: [keys] } for a set of asset ids
export function peripheralsByAsset(assetIds) {
  const out = {};
  if (!assetIds.length) return out;
  const rows = db.prepare(
    `SELECT ap.asset_id, p.key FROM asset_peripherals ap JOIN peripherals p ON p.id = ap.peripheral_id
     ORDER BY p.sort_order`
  ).all();
  for (const r of rows) { (out[r.asset_id] = out[r.asset_id] || []).push(r.key); }
  return out;
}

// Replace an asset's custom peripherals with the given key list (call inside a transaction).
export function syncAssetPeripherals(assetId, keys) {
  db.prepare("DELETE FROM asset_peripherals WHERE asset_id = ?").run(assetId);
  if (!Array.isArray(keys) || !keys.length) return;
  const ins = db.prepare(
    `INSERT OR IGNORE INTO asset_peripherals (asset_id, peripheral_id)
     SELECT ?, id FROM peripherals WHERE key = ? AND active = 1`
  );
  for (const k of keys) ins.run(assetId, k);
}

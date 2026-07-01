import db from "../db/connection.js";
import { HttpError } from "../middleware/error.js";
import { insertAudit } from "../db/repo.js";

const MOVE_ACTION = { in: "stock-in", out: "stock-out", return: "stock-return", adjust: "stock-adjust" };
const MOVE_VERB   = { in: "Received", out: "Issued", return: "Returned", adjust: "Adjusted" };

const SELECT = `
  SELECT i.*, c.name AS category_name, s.name AS supplier_name
  FROM consumables i
  LEFT JOIN categories c ON c.id = i.category_id
  LEFT JOIN suppliers s ON s.id = i.supplier_id
`;

function rowToItem(r) {
  if (!r) return null;
  return {
    id: r.id, name: r.name, kind: r.kind || "consumable",
    category: r.category_name || r.category || null, categoryId: r.category_id,
    supplier: r.supplier_name || null, supplierId: r.supplier_id,
    unit: r.unit || "pcs", unitCost: r.unit_cost, qty: r.qty,
    reorderLevel: r.reorder_level, reorderQty: r.reorder_qty,
    location: r.location, notes: r.notes,
    low: r.qty <= r.reorder_level,
    value: r.unit_cost != null ? Math.round(r.qty * r.unit_cost * 100) / 100 : null,
    reorderSuggestion: r.qty <= r.reorder_level ? (r.reorder_qty || Math.max(1, r.reorder_level - r.qty)) : 0
  };
}

export function listItems({ categoryId, supplierId, kind, low } = {}) {
  const where = [], p = {};
  if (categoryId) { where.push("i.category_id = @categoryId"); p.categoryId = Number(categoryId); }
  if (supplierId) { where.push("i.supplier_id = @supplierId"); p.supplierId = Number(supplierId); }
  if (kind && kind !== "All") { where.push("i.kind = @kind"); p.kind = kind; }
  if (low === "1" || low === true) where.push("i.qty <= i.reorder_level");
  const sql = `${SELECT} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY i.name`;
  return db.prepare(sql).all(p).map(rowToItem);
}

export function getItem(id) {
  const item = rowToItem(db.prepare(`${SELECT} WHERE i.id = ?`).get(id));
  if (!item) return null;
  item.movements = db.prepare(`
    SELECT m.*, s.name AS supplier_name FROM stock_movements m
    LEFT JOIN suppliers s ON s.id = m.supplier_id
    WHERE m.item_id = ? ORDER BY m.at DESC LIMIT 100`).all(id);
  return item;
}

export function createItem(b) {
  if (!b?.name?.trim()) throw new HttpError(400, "Name required");
  const info = db.prepare(`INSERT INTO consumables
    (name, category_id, supplier_id, kind, qty, reorder_level, reorder_qty, unit, unit_cost, location, notes)
    VALUES (@name,@category_id,@supplier_id,@kind,@qty,@reorder_level,@reorder_qty,@unit,@unit_cost,@location,@notes)`).run({
    name: b.name.trim(), category_id: b.categoryId ?? null, supplier_id: b.supplierId ?? null,
    kind: ["consumable", "accessory", "hardware"].includes(b.kind) ? b.kind : "consumable",
    qty: Math.max(0, Number(b.qty) || 0), reorder_level: Math.max(0, Number(b.reorderLevel) || 0), reorder_qty: Math.max(0, Number(b.reorderQty) || 0),
    unit: b.unit || "pcs", unit_cost: b.unitCost == null || b.unitCost === "" ? null : Number(b.unitCost),
    location: b.location ?? null, notes: b.notes ?? null
  });
  return getItem(info.lastInsertRowid);
}

export function updateItem(id, b) {
  if (!db.prepare("SELECT 1 FROM consumables WHERE id=?").get(id)) throw new HttpError(404, "Not found");
  // CRIT-4: omitted fields = preserved (undefined). Explicit null clears the field.
  const has = (k) => Object.prototype.hasOwnProperty.call(b, k);
  db.prepare(`UPDATE consumables SET
    name=COALESCE(@name,name),
    category_id=CASE WHEN @category_id_set = 1 THEN @category_id ELSE category_id END,
    supplier_id=CASE WHEN @supplier_id_set = 1 THEN @supplier_id ELSE supplier_id END,
    kind=COALESCE(@kind,kind), reorder_level=COALESCE(@reorder_level,reorder_level),
    reorder_qty=COALESCE(@reorder_qty,reorder_qty), unit=COALESCE(@unit,unit),
    unit_cost=CASE WHEN @unit_cost_set = 1 THEN @unit_cost ELSE unit_cost END,
    location=COALESCE(@location,location), notes=COALESCE(@notes,notes)
    WHERE id=@id`).run({
    id, name: b.name ?? null,
    category_id: b.categoryId ?? null,
    category_id_set: has("categoryId") ? 1 : 0,
    supplier_id: b.supplierId ?? null,
    supplier_id_set: has("supplierId") ? 1 : 0,
    kind: ["consumable", "accessory", "hardware"].includes(b.kind) ? b.kind : null,
    reorder_level: b.reorderLevel != null ? Math.max(0, Number(b.reorderLevel) || 0) : null,
    reorder_qty: b.reorderQty != null ? Math.max(0, Number(b.reorderQty) || 0) : null, unit: b.unit ?? null,
    unit_cost: b.unitCost != null && b.unitCost !== "" ? Number(b.unitCost) : null,
    unit_cost_set: has("unitCost") ? 1 : 0,
    location: b.location ?? null, notes: b.notes ?? null
  });
  return getItem(id);
}

export function deleteItem(id) {
  db.prepare("DELETE FROM consumables WHERE id = ?").run(id); // cascades movements
  return { ok: true };
}

// --- stock movements (each updates qty + logs in one transaction) ---
function move(id, { type, qty, reason, employeeName, assetId, supplierId, unitCost, condition, replacementOf }, actor) {
  const item = db.prepare("SELECT * FROM consumables WHERE id=?").get(id);
  if (!item) throw new HttpError(404, "Item not found");
  const n = Math.trunc(Number(qty));
  if (!n || n <= 0) throw new HttpError(400, "Quantity must be a positive number");
  const delta = (type === "in" || type === "return") ? n : -n;
  const cond = condition === "defective" ? "defective" : condition === "good" ? "good" : null;
  const repOf = replacementOf ? Number(replacementOf) : null;
  // CRIT-5: validate replacement target — must be a defective return on the SAME item, not yet replaced
  if (repOf) {
    const target = db.prepare(
      "SELECT item_id, type, condition, replaced_by FROM stock_movements WHERE id = ?"
    ).get(repOf);
    if (!target) throw new HttpError(404, "Replacement target not found");
    if (target.item_id !== id) throw new HttpError(400, "Replacement must be on the same item");
    if (target.type !== "return" || target.condition !== "defective") throw new HttpError(400, "Replacement target is not a defective return");
    if (target.replaced_by) throw new HttpError(409, "That defective return is already replaced");
  }
  let movementId = null;
  const tx = db.transaction(() => {
    // CRIT-8: atomic qty guard — DB rejects if stock would go negative
    const upd = db.prepare("UPDATE consumables SET qty = qty + ? WHERE id = ? AND qty + ? >= 0").run(delta, id, delta);
    if (upd.changes !== 1) throw new HttpError(409, `Insufficient stock for ${item.name}`);
    // HIGH-16: weighted-average unit cost on receive (instead of last-cost overwrite)
    if (type === "in" && unitCost != null && unitCost !== "") {
      const newCost = Number(unitCost);
      const prevQty = item.qty;
      const prevCost = item.unit_cost;
      const blended = prevCost != null && prevQty > 0
        ? (prevQty * prevCost + n * newCost) / (prevQty + n)
        : newCost;
      db.prepare("UPDATE consumables SET unit_cost = ? WHERE id = ?").run(Math.round(blended * 100) / 100, id);
    }
    const info = db.prepare(`INSERT INTO stock_movements
      (item_id, type, qty, reason, employee_name, asset_id, supplier_id, unit_cost, actor, condition, replacement_of)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
      id, type, n, reason ?? null, employeeName ?? null, assetId ?? null,
      supplierId ?? null, unitCost != null && unitCost !== "" ? Number(unitCost) : null, actor, cond, repOf);
    movementId = info.lastInsertRowid;
    // CRIT-5: guarded back-link — atomic; cannot double-link
    if (repOf) {
      const back = db.prepare(
        "UPDATE stock_movements SET replaced_by = ? WHERE id = ? AND replaced_by IS NULL AND type='return' AND condition='defective'"
      ).run(movementId, repOf);
      if (back.changes !== 1) throw new HttpError(409, "Could not link replacement (already linked)");
    }
    // also surface this movement in the global Audit Log feed
    const subject = type === "in"     ? (supplierId ? `from supplier #${supplierId}` : "Stock received")
                  : type === "out"    ? (employeeName || assetId || "Stock issued")
                  : type === "return" ? (employeeName || "Stock returned")
                  : "Stock adjusted";
    const detail = `${MOVE_VERB[type]} ${n} × ${item.name}${item.unit ? " (" + item.unit + ")" : ""}` +
                   (reason ? ` — ${reason}` : "") +
                   (cond === "defective" ? " · defective" : "");
    insertAudit({ actor, action: MOVE_ACTION[type], tag: assetId ?? null, subject, dept: null, detail });
  });
  tx();
  return getItem(id);
}

export const receive = (id, b, actor) => move(id, { ...b, type: "in" }, actor);
export const issue   = (id, b, actor) => move(id, { ...b, type: "out" }, actor);
export const giveBack = (id, b, actor) => move(id, { ...b, type: "return" }, actor);

// signed correction (+/-), floored at 0; logged as an 'adjust' movement
export function adjust(id, b, actor) {
  const item = db.prepare("SELECT * FROM consumables WHERE id=?").get(id);
  if (!item) throw new HttpError(404, "Item not found");
  const d = Math.trunc(Number(b.delta));
  if (!d) throw new HttpError(400, "Delta required (non-zero integer)");
  const tx = db.transaction(() => {
    const next = Math.max(0, item.qty + d);
    db.prepare("UPDATE consumables SET qty = ? WHERE id = ?").run(next, id);
    db.prepare("INSERT INTO stock_movements (item_id, type, qty, reason, actor) VALUES (?,?,?,?,?)")
      .run(id, "adjust", d, b.reason ?? null, actor);
    insertAudit({
      actor, action: "stock-adjust", tag: null,
      subject: `${item.name} stock`, dept: null,
      detail: `Adjusted ${d > 0 ? "+" : ""}${d} × ${item.name}${b.reason ? " — " + b.reason : ""}`
    });
  });
  tx();
  return getItem(id);
}

// Global movement log — every receive/issue/return/adjust across all items, newest first.
export function listMovements({ type, itemId, defective, limit = 200 } = {}) {
  const where = [], p = { limit: Math.min(Number(limit) || 200, 1000) };
  if (type && type !== "All") { where.push("m.type = @type"); p.type = type; }
  if (itemId) { where.push("m.item_id = @itemId"); p.itemId = Number(itemId); }
  if (defective === "1" || defective === true) where.push("m.condition = 'defective'");
  const sql = `
    SELECT m.*, i.name AS item_name, i.unit AS item_unit, s.name AS supplier_name
    FROM stock_movements m
    JOIN consumables i ON i.id = m.item_id
    LEFT JOIN suppliers s ON s.id = m.supplier_id
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY m.at DESC, m.id DESC LIMIT @limit`;
  return db.prepare(sql).all(p);
}

// Defective returns + their replacement issue (if linked). For the Defective Items page.
export function listDefective({ status } = {}) {
  // status: 'pending' (no replacement yet) | 'replaced' (replaced_by set) | undefined = all
  const where = ["m.type = 'return'", "m.condition = 'defective'"];
  if (status === "pending") where.push("m.replaced_by IS NULL");
  else if (status === "replaced") where.push("m.replaced_by IS NOT NULL");
  const rows = db.prepare(`
    SELECT m.id, m.item_id, m.at, m.qty, m.reason, m.employee_name, m.asset_id, m.actor, m.replaced_by,
           i.name AS item_name, i.unit AS item_unit, i.qty AS item_qty,
           r.at AS replacement_at, r.qty AS replacement_qty,
           r.employee_name AS replacement_employee, r.actor AS replacement_actor
    FROM stock_movements m
    JOIN consumables i ON i.id = m.item_id
    LEFT JOIN stock_movements r ON r.id = m.replaced_by
    WHERE ${where.join(" AND ")}
    ORDER BY m.at DESC, m.id DESC`).all();
  return rows;
}

// valuation + reorder rollup for dashboard/reports
export function valuation() {
  const v = db.prepare("SELECT COALESCE(SUM(qty*unit_cost),0) total, COUNT(*) lines FROM consumables WHERE unit_cost IS NOT NULL").get();
  const low = db.prepare("SELECT COUNT(*) n FROM consumables WHERE qty <= reorder_level").get().n;
  return { totalValue: Math.round(v.total * 100) / 100, valuedLines: v.lines, lowCount: low };
}

// Asset peripheral <-> stock linkage. delta=-1 when a peripheral is assigned (issue 1),
// +1 when removed (return 1). Matches a consumable by name (case-insensitive). LENIENT —
// never throws, so toggling a peripheral can't fail an asset save: if there's no matching
// stock item, or it's out of stock on issue, it just skips the stock change.
export function adjustPeripheralStock(label, delta, { actor = "system", employeeName = null, assetId = null } = {}) {
  if (!label || !delta) return false;
  const item = db.prepare("SELECT * FROM consumables WHERE lower(trim(name)) = lower(trim(?)) ORDER BY id LIMIT 1").get(label);
  if (!item) return false;                        // no stock item for this peripheral
  if (delta < 0 && item.qty < 1) return false;    // out of stock -> don't block the save
  const issue = delta < 0;
  db.prepare("UPDATE consumables SET qty = ? WHERE id = ?").run(Math.max(0, item.qty + (issue ? -1 : 1)), item.id);
  db.prepare(`INSERT INTO stock_movements (item_id, type, qty, reason, employee_name, asset_id, actor, condition)
    VALUES (?,?,?,?,?,?,?,?)`).run(
    item.id, issue ? "out" : "return", 1,
    issue ? `Assigned to ${employeeName || "asset"} (peripheral)` : `Removed from ${employeeName || "asset"} (peripheral)`,
    employeeName, assetId, actor, issue ? null : "good");
  insertAudit({ actor, action: issue ? "stock-out" : "stock-return", tag: assetId,
    subject: item.name, dept: null, detail: `${issue ? "Issued" : "Returned"} 1 ${item.unit || "pcs"} · ${item.name} (peripheral link)` });
  return true;
}

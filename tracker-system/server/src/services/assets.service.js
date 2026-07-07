import db from "../db/connection.js";
import { upsertAsset, insertAssetStrict, insertAudit, insertAssignment, rowToAsset } from "../db/repo.js";
import { getAssetPeripherals, peripheralsByAsset, syncAssetPeripherals, labelForKey } from "./peripherals.service.js";
import { adjustPeripheralStock, issue, returnFromAsset } from "./inventory.service.js";
import { buildAsset, diffAsset } from "@its/shared/assetLogic";
import { PERIPHERALS } from "@its/shared/constants";
import { HttpError } from "../middleware/error.js";

const BASE = `
  SELECT a.*, d.name AS dept_name
  FROM assets a JOIN departments d ON d.id = a.department_id
`;

const SORT_COLS = {
  id: "a.id", pseudo: "a.pseudo", dept: "d.name", type: "a.type",
  cpu: "a.cpu", ram: "a.ram", hdd: "a.hdd", monitors: "a.monitors", status: "a.status"
};

export function listAssets({ dept, type, q, sort = "pseudo", dir = "asc", includeRetired } = {}) {
  const where = [];
  const params = {};
  if (!includeRetired) where.push("a.status != 'retired'");
  if (dept && dept !== "All") { where.push("d.name = @dept"); params.dept = dept; }
  if (type && type !== "All") { where.push("a.type = @type"); params.type = type; }
  if (q) {
    where.push("(a.pseudo LIKE @q OR a.full_name LIKE @q OR a.id LIKE @q OR d.name LIKE @q OR a.cpu LIKE @q OR a.ram LIKE @q)");
    params.q = `%${q}%`;
  }
  const col = SORT_COLS[sort] || SORT_COLS.pseudo;
  const order = dir === "desc" ? "DESC" : "ASC";
  const sql = `${BASE} ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY ${col} ${order}, a.id ASC`;
  const list = db.prepare(sql).all(params).map(rowToAsset);
  const periphMap = peripheralsByAsset(list.map((a) => a.id));
  for (const a of list) a.customPeripherals = periphMap[a.id] || [];
  return list;
}

export function getAsset(id) {
  const a = rowToAsset(db.prepare(`${BASE} WHERE a.id = ?`).get(id));
  if (a) a.customPeripherals = getAssetPeripherals(id);
  return a;
}

function exists(id) {
  return !!db.prepare("SELECT 1 FROM assets WHERE id = ?").get(id);
}

export function createAsset(input, actor) {
  const rec = buildAsset(input);
  // CRIT-7: strict INSERT inside tx — UNIQUE PK collision throws and rolls back, so two
  // concurrent creates can't both succeed via ON CONFLICT clobber. Translate SQLITE error.
  const tx = db.transaction(() => {
    try {
      insertAssetStrict(rec);
    } catch (e) {
      if (String(e?.code || "").includes("CONSTRAINT") || /UNIQUE/i.test(String(e?.message))) {
        throw new HttpError(409, `Asset tag ${rec.id} already exists`);
      }
      throw e;
    }
    insertAudit({
      actor, action: rec.shared ? "added" : "assigned", tag: rec.id,
      subject: rec.pseudo, dept: rec.dept,
      detail: rec.shared ? "New machine registered to inventory" : `Assigned to ${rec.pseudo} · ${rec.dept}`
    });
    insertAssignment({
      asset_id: rec.id, employee_name: rec.shared ? null : rec.pseudo, dept: rec.dept,
      action: rec.shared ? "added" : "assigned", actor
    });
    if (input.customPeripherals !== undefined) syncAssetPeripherals(rec.id, input.customPeripherals);
    // stock linkage: every peripheral present on a new asset issues 1 from matching stock
    const employeeName = rec.shared ? null : rec.pseudo;
    for (const p of PERIPHERALS) if (rec[p.key]) adjustPeripheralStock(p.label, -1, { actor, employeeName, assetId: rec.id });
    for (const key of (input.customPeripherals || [])) adjustPeripheralStock(labelForKey(key), -1, { actor, employeeName, assetId: rec.id });
  });
  tx();
  return getAsset(rec.id);
}

// Tables whose asset_id FK points at assets(id) — repointed on an asset-tag rename.
const ASSET_FK_TABLES = ["assignment_history", "repair_tickets", "software_assignments", "stock_movements", "asset_peripherals"];

export function updateAsset(id, input, actor) {
  const before = getAsset(id);
  if (!before) throw new HttpError(404, `Asset ${id} not found`);

  // The asset tag is the primary key AND a FK target across several tables, so changing it
  // means renaming the PK and repointing every child row. (Previously the tag was pinned to
  // the URL id here, so edits to it were silently dropped.)
  const newId = (input.id || "").trim();
  const renaming = !!newId && newId !== id;
  if (renaming && exists(newId)) throw new HttpError(409, `Asset tag ${newId} already exists`);
  const finalId = renaming ? newId : id;

  const merged = buildAsset({ ...before, ...input, id: finalId });
  const changes = diffAsset(before, merged);
  const reassigned = before.pseudo !== merged.pseudo && !merged.shared && !before.shared;
  const tx = db.transaction(() => {
    if (renaming) {
      // Defer FK enforcement to commit so the parent row can be renamed before its children
      // are repointed. defer_foreign_keys auto-resets to OFF when the transaction ends.
      db.pragma("defer_foreign_keys = ON");
      db.prepare("UPDATE assets SET id=? WHERE id=?").run(finalId, id);
      for (const t of ASSET_FK_TABLES) db.prepare(`UPDATE ${t} SET asset_id=? WHERE asset_id=?`).run(finalId, id);
      db.prepare("UPDATE audit_log SET tag=? WHERE tag=?").run(finalId, id); // textual ref, not a FK
    }
    upsertAsset(merged);
    insertAudit({
      actor, action: reassigned ? "reassigned" : "edited", tag: finalId,
      subject: merged.shared ? "Day-Shift PC" : merged.pseudo, dept: merged.dept,
      detail: changes.length ? changes.slice(0, 3).join(" · ") : "Record saved (no field changes)"
    });
    if (reassigned) {
      insertAssignment({
        asset_id: finalId, employee_name: merged.pseudo, dept: merged.dept,
        action: "reassigned", actor, note: `from ${before.pseudo}`
      });
    }
    if (input.customPeripherals !== undefined) syncAssetPeripherals(finalId, input.customPeripherals);
    // stock linkage: deduct when a peripheral is newly added, return when removed
    const employeeName = merged.shared ? null : merged.pseudo;
    for (const p of PERIPHERALS) {
      const was = !!before[p.key], now = !!merged[p.key];
      if (was !== now) adjustPeripheralStock(p.label, now ? -1 : 1, { actor, employeeName, assetId: finalId });
    }
    if (input.customPeripherals !== undefined) {
      const beforeSet = new Set(before.customPeripherals || []);
      const afterSet = new Set(input.customPeripherals || []);
      for (const key of afterSet) if (!beforeSet.has(key)) adjustPeripheralStock(labelForKey(key), -1, { actor, employeeName, assetId: finalId });
      for (const key of beforeSet) if (!afterSet.has(key)) adjustPeripheralStock(labelForKey(key), 1, { actor, employeeName, assetId: finalId });
    }
  });
  tx();
  return getAsset(finalId);
}

export function repairAsset(id, toRepair, actor) {
  const a = getAsset(id);
  if (!a) throw new HttpError(404, `Asset ${id} not found`);
  const status = toRepair ? "repair" : "active";
  const tx = db.transaction(() => {
    db.prepare("UPDATE assets SET status=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?")
      .run(status, id);
    insertAudit({
      actor, action: "repair", tag: id, subject: a.shared ? "Day-Shift PC" : a.pseudo, dept: a.dept,
      detail: toRepair ? "Flagged for repair" : "Returned from repair"
    });
  });
  tx();
  return getAsset(id);
}

// Soft-delete: retire (keeps the row + all history). Restore by editing status back.
export function removeAsset(id, actor) {
  const a = getAsset(id);
  if (!a) throw new HttpError(404, `Asset ${id} not found`);
  const tx = db.transaction(() => {
    db.prepare("UPDATE assets SET status='retired', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").run(id);
    insertAudit({
      actor, action: "removed", tag: id,
      subject: a.shared ? "Day-Shift PC" : a.pseudo, dept: a.dept, detail: "Retired from the register"
    });
    insertAssignment({
      asset_id: id, employee_name: a.shared ? null : a.pseudo, dept: a.dept, action: "retired", actor
    });
  });
  tx();
  return { ok: true, status: "retired" };
}

// Bulk actions over many asset ids in one transaction (each gets its own audit row).
export function bulkAction(ids, action, payload, actor) {
  if (!Array.isArray(ids) || !ids.length) throw new HttpError(400, "No assets selected");
  let deptId = null;
  if (action === "setDept") {
    const d = db.prepare("SELECT id FROM departments WHERE name = ?").get(payload?.dept);
    if (!d) throw new HttpError(400, "Unknown department");
    deptId = d.id;
  }
  const ts = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
  let done = 0;
  const tx = db.transaction(() => {
    for (const id of ids) {
      const a = getAsset(id);
      if (!a) continue;
      if (action === "retire") {
        db.prepare(`UPDATE assets SET status='retired', updated_at=${ts} WHERE id=?`).run(id);
        insertAudit({ actor, action: "removed", tag: id, subject: a.pseudo, dept: a.dept, detail: "Bulk retire" });
        insertAssignment({ asset_id: id, employee_name: a.shared ? null : a.pseudo, dept: a.dept, action: "retired", actor, note: "bulk" });
      } else if (action === "setStatus") {
        const st = ["active", "repair", "retired"].includes(payload?.status) ? payload.status : "active";
        db.prepare(`UPDATE assets SET status=?, updated_at=${ts} WHERE id=?`).run(st, id);
        insertAudit({ actor, action: "edited", tag: id, subject: a.pseudo, dept: a.dept, detail: `Bulk status → ${st}` });
      } else if (action === "setDept") {
        db.prepare(`UPDATE assets SET department_id=?, updated_at=${ts} WHERE id=?`).run(deptId, id);
        insertAudit({ actor, action: "edited", tag: id, subject: a.pseudo, dept: payload.dept, detail: `Bulk move → ${payload.dept}` });
      } else {
        throw new HttpError(400, `Unknown bulk action: ${action}`);
      }
      done++;
    }
  });
  tx();
  return { ok: true, affected: done };
}

// --- spare-hardware bridge (machines in the IT store, in_stock=1) ---
export function listSpares() {
  return db.prepare(`${BASE} WHERE a.in_stock = 1 ORDER BY a.id`).all().map(rowToAsset);
}

export function setInStock(id, inStock, actor) {
  const a = getAsset(id);
  if (!a) throw new HttpError(404, `Asset ${id} not found`);
  const tx = db.transaction(() => {
    db.prepare("UPDATE assets SET in_stock=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?")
      .run(inStock ? 1 : 0, id);
    insertAudit({ actor, action: "edited", tag: id, subject: a.pseudo, dept: a.dept,
      detail: inStock ? "Moved to spare stock" : "Taken out of spare stock" });
  });
  tx();
  return getAsset(id);
}

// issue a spare to an employee: assign + clear in_stock, in one transaction
export function issueSpare(id, input, actor) {
  const a = getAsset(id);
  if (!a) throw new HttpError(404, `Asset ${id} not found`);
  // Guard against reissuing an already-assigned spare out from under its current holder —
  // must be returned to spare stock (in_stock=1) before it can go to someone else.
  if (!a.inStock) throw new HttpError(409, `Asset ${id} is already assigned to ${a.pseudo} — return it to spare stock first`);
  if (!input?.pseudo?.trim()) throw new HttpError(400, "Employee name required");
  const merged = buildAsset({ ...a, pseudo: input.pseudo, dept: input.dept || a.dept, id });
  const tx = db.transaction(() => {
    upsertAsset(merged);
    db.prepare("UPDATE assets SET in_stock=0 WHERE id=?").run(id);
    insertAudit({ actor, action: "assigned", tag: id, subject: merged.pseudo, dept: merged.dept,
      detail: `Issued from spare stock to ${merged.pseudo} · ${merged.dept}` });
    insertAssignment({ asset_id: id, employee_name: merged.pseudo, dept: merged.dept, action: "assigned", actor, note: "from spare stock" });
  });
  tx();
  return getAsset(id);
}

// Undo retire — restore from retired -> active (within audit-friendly window).
export function restoreAsset(id, actor) {
  const a = getAsset(id);
  if (!a) throw new HttpError(404, `Asset ${id} not found`);
  if (a.status !== "retired") return a;
  const tx = db.transaction(() => {
    db.prepare("UPDATE assets SET status='active', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").run(id);
    insertAudit({ actor, action: "edited", tag: id, subject: a.shared ? "Day-Shift PC" : a.pseudo, dept: a.dept, detail: "Restored from retired" });
    insertAssignment({ asset_id: id, employee_name: a.shared ? null : a.pseudo, dept: a.dept, action: "reassigned", actor, note: "undo retire" });
  });
  tx();
  return getAsset(id);
}

// --- Asset Assignment tab: issue / return stock items to the person holding this machine ---

// Net stock items currently held by this asset (issued − returned), for the tab's list.
export function listAssignedItems(assetId) {
  if (!getAsset(assetId)) throw new HttpError(404, `Asset ${assetId} not found`);
  return db.prepare(`
    SELECT m.item_id AS itemId, i.name, i.unit,
           SUM(CASE WHEN m.type='out' THEN m.qty WHEN m.type='return' THEN -m.qty ELSE 0 END) AS held
    FROM stock_movements m
    JOIN consumables i ON i.id = m.item_id
    WHERE m.asset_id = ?
    GROUP BY m.item_id, i.name, i.unit
    HAVING held > 0
    ORDER BY i.name`).all(assetId);
}

// Plus: assign a live-stock item to the person on this machine. Issues qty (default 1) from the
// selected consumable, decrementing its stock (qty − 1) inside inventory's atomic transaction —
// the DB guard rejects the issue if it would drive stock negative. Custody is recorded on the
// stock_movement (asset_id + employee_name), which is the link between the item and this user.
export function assignItem(assetId, body, actor) {
  const a = getAsset(assetId);
  if (!a) throw new HttpError(404, `Asset ${assetId} not found`);
  if (a.status === "retired") throw new HttpError(409, `Asset ${assetId} is retired — restore it before assigning items`);
  const itemId = Number(body?.itemId);
  if (!itemId) throw new HttpError(400, "itemId (stock item) is required");
  const qty = body?.qty == null ? 1 : Math.trunc(Number(body.qty));
  if (!qty || qty <= 0) throw new HttpError(400, "qty must be a positive integer");
  const employeeName = a.shared ? null : a.pseudo;
  const item = issue(itemId, { qty, assetId, employeeName, reason: body?.note || `Assigned to ${employeeName || assetId}` }, actor);
  return { ok: true, asset: getAsset(assetId), item };
}

// Minus: return an assigned item via the 3-option flow (repair / stock / retire), adjusting the
// stock pool accordingly. See returnFromAsset() for the per-destination stock semantics.
export function unassignItem(assetId, body, actor) {
  const a = getAsset(assetId);
  if (!a) throw new HttpError(404, `Asset ${assetId} not found`);
  const itemId = Number(body?.itemId);
  if (!itemId) throw new HttpError(400, "itemId (stock item) is required");
  const qty = body?.qty == null ? 1 : Math.trunc(Number(body.qty));
  if (!qty || qty <= 0) throw new HttpError(400, "qty must be a positive integer");
  const destination = body?.destination || "stock";
  if (!["repair", "stock", "retire"].includes(destination))
    throw new HttpError(400, "destination must be one of: repair, stock, retire");
  const employeeName = a.shared ? null : a.pseudo;
  const item = returnFromAsset(itemId, { qty, assetId, employeeName, destination, reason: body?.reason }, actor);
  return { ok: true, asset: getAsset(assetId), destination, item };
}

// Merged timeline: audit events + custody changes + repair tickets, newest first.
export function getHistory(id) {
  if (!getAsset(id)) throw new HttpError(404, `Asset ${id} not found`);
  const audit = db.prepare(
    "SELECT ts AS at, actor, action, detail FROM audit_log WHERE tag = ? ORDER BY ts DESC"
  ).all(id).map((r) => ({ kind: "audit", ...r }));
  const custody = db.prepare(
    "SELECT at, actor, action, employee_name, dept, note FROM assignment_history WHERE asset_id = ? ORDER BY at DESC"
  ).all(id).map((r) => ({ kind: "custody", ...r }));
  const repairs = db.prepare(
    "SELECT opened_at AS at, opened_by AS actor, status, issue, resolution, cost, closed_at FROM repair_tickets WHERE asset_id = ? ORDER BY opened_at DESC"
  ).all(id).map((r) => ({ kind: "repair", ...r }));
  return [...audit, ...custody, ...repairs].sort((a, b) => (a.at < b.at ? 1 : -1));
}

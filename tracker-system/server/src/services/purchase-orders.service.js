// Purchase Order (PO) module — self-contained service (own SQL; shared insertAudit from repo.js).
// A PO is generated from an APPROVED purchase_request and represents the actual order to a vendor.
import db from "../db/connection.js";
import { insertAudit } from "../db/repo.js";
import { HttpError } from "../middleware/error.js";

// join the source PR so the API/UI always has the human-readable PR number
const PO_SELECT = `
  SELECT po.*, pr.pr_number
  FROM purchase_orders po
  JOIN purchase_requests pr ON pr.id = po.pr_id`;

// DB row (snake_case) -> API/client shape (camelCase). Mirrors rowToPR.
function rowToPO(r) {
  if (!r) return null;
  return {
    id: r.id,
    poNumber: r.po_number,
    prId: r.pr_id,
    prNumber: r.pr_number ?? null,
    vendor: r.vendor,
    supplierId: r.supplier_id ?? null,
    department: r.department,
    category: r.category,
    finalAmount: r.final_amount ?? null,
    billingAddress: r.billing_address ?? null,
    shippingAddress: r.shipping_address ?? null,
    terms: r.terms ?? null,
    status: r.status,
    createdBy: r.created_by ?? null,
    createdAt: r.created_at
  };
}

// Atomic PO-<Mon>-<YYYY>-NNN generator (e.g. PO-Jul-2026-001), matching the PR format.
// Sequence resets each month; called inside the create transaction, with the UNIQUE(po_number)
// constraint as the cross-process backstop.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function nextPoNumber() {
  const { y: year, m } = db.prepare("SELECT strftime('%Y','now') AS y, strftime('%m','now') AS m").get();
  const prefix = `PO-${MONTHS[Number(m) - 1]}-${year}-`; // e.g. PO-Jul-2026-
  const { maxSeq } = db.prepare(
    `SELECT MAX(CAST(substr(po_number, ?) AS INTEGER)) AS maxSeq
       FROM purchase_orders WHERE po_number LIKE ?`
  ).get(prefix.length + 1, `${prefix}%`);
  const seq = (maxSeq || 0) + 1;
  return `${prefix}${String(seq).padStart(3, "0")}`;
}

// Allowed status transitions. Fulfilled and Cancelled are terminal.
const PO_TRANSITIONS = {
  "Draft": ["Sent to Vendor", "Cancelled"],
  "Sent to Vendor": ["Fulfilled", "Cancelled"],
  "Fulfilled": [],
  "Cancelled": []
};

export function listPurchaseOrders({ status, department, q } = {}) {
  const where = [];
  const params = {};
  if (status && status !== "All") { where.push("po.status = @status"); params.status = status; }
  if (department) { where.push("po.department = @department"); params.department = department; }
  if (q) {
    where.push("(po.po_number LIKE @q OR pr.pr_number LIKE @q OR po.vendor LIKE @q)");
    params.q = `%${q}%`;
  }
  const sql = `${PO_SELECT} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY po.created_at DESC`;
  return db.prepare(sql).all(params).map(rowToPO);
}

export function getPurchaseOrder(id) {
  return rowToPO(db.prepare(`${PO_SELECT} WHERE po.id = ?`).get(id));
}

// Convenience default used by the route: the PR's first suggested vendor (or null).
export function firstSuggestedVendor(prId) {
  const pr = db.prepare("SELECT suggested_vendors FROM purchase_requests WHERE id = ?").get(prId);
  if (!pr || !pr.suggested_vendors) return null;
  const first = String(pr.suggested_vendors).split(",")[0].trim();
  return first || null;
}

// Generate a PO from an APPROVED PR. Snapshots dept/category from the PR; finalAmount defaults
// to the PR's estimated cost. One active (non-cancelled) PO per PR — pre-checked for a friendly
// message, with the partial unique index as the hard backstop.
export function generatePO(input, actor) {
  const pr = db.prepare("SELECT * FROM purchase_requests WHERE id = ?").get(input.prId);
  if (!pr) throw new HttpError(404, `PR ${input.prId} not found`);
  if (pr.status !== "Approved") {
    throw new HttpError(409, `A PO can only be generated from an Approved PR (PR is ${pr.status})`);
  }
  const active = db.prepare(
    "SELECT po_number FROM purchase_orders WHERE pr_id = ? AND status != 'Cancelled'"
  ).get(input.prId);
  if (active) throw new HttpError(409, `${pr.pr_number} already has an active PO (${active.po_number})`);

  const tx = db.transaction(() => {
    const poNumber = nextPoNumber();
    const info = db.prepare(
      `INSERT INTO purchase_orders
         (po_number, pr_id, vendor, supplier_id, department, category, final_amount,
          billing_address, shipping_address, terms, created_by)
       VALUES (@poNumber, @prId, @vendor, @supplierId, @department, @category, @finalAmount,
          @billingAddress, @shippingAddress, @terms, @actor)`
    ).run({
      poNumber,
      prId: input.prId,
      vendor: input.vendor,
      supplierId: input.supplierId ?? null,
      department: pr.department,          // snapshot from the PR
      category: pr.category,              // snapshot from the PR
      finalAmount: input.finalAmount ?? pr.estimated_cost ?? null,
      billingAddress: input.billingAddress ?? null,
      shippingAddress: input.shippingAddress ?? null,
      terms: input.terms ?? null,
      actor
    });
    insertAudit({
      actor, action: "added", tag: poNumber,
      subject: input.vendor, dept: pr.department,
      detail: `PO raised from ${pr.pr_number} — ${input.vendor}`
    });
    return info.lastInsertRowid;
  });
  return getPurchaseOrder(tx());
}

// Edit is allowed only while the PO is still Draft — once sent to a vendor it's a commitment.
// prId is fixed (omitted from the update schema). COALESCE: a PATCH can't null-out a field.
export function updatePurchaseOrder(id, patch, actor) {
  const existing = db.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(id);
  if (!existing) throw new HttpError(404, "Purchase order not found");
  if (existing.status !== "Draft") throw new HttpError(409, `Only Draft POs can be edited (this one is ${existing.status})`);

  db.prepare(
    `UPDATE purchase_orders SET
       vendor           = COALESCE(@vendor, vendor),
       supplier_id      = COALESCE(@supplierId, supplier_id),
       final_amount     = COALESCE(@finalAmount, final_amount),
       billing_address  = COALESCE(@billingAddress, billing_address),
       shipping_address = COALESCE(@shippingAddress, shipping_address),
       terms            = COALESCE(@terms, terms)
     WHERE id = @id`
  ).run({
    id,
    vendor: patch.vendor ?? null,
    supplierId: patch.supplierId ?? null,
    finalAmount: patch.finalAmount ?? null,
    billingAddress: patch.billingAddress ?? null,
    shippingAddress: patch.shippingAddress ?? null,
    terms: patch.terms ?? null
  });
  insertAudit({
    actor, action: "edited", tag: existing.po_number,
    subject: patch.vendor ?? existing.vendor, dept: existing.department,
    detail: "PO details edited"
  });
  return getPurchaseOrder(id);
}

// Draft → Sent to Vendor → Fulfilled / Cancelled (Admin-only, enforced in the route).
export function setPurchaseOrderStatus(id, status, actor) {
  const existing = db.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(id);
  if (!existing) throw new HttpError(404, "Purchase order not found");
  if (existing.status === status) throw new HttpError(409, `PO is already ${status}`);
  if (!(PO_TRANSITIONS[existing.status] || []).includes(status)) {
    throw new HttpError(409, `Cannot move a ${existing.status} PO to ${status}`);
  }
  db.prepare("UPDATE purchase_orders SET status = ? WHERE id = ?").run(status, id);
  insertAudit({
    actor, action: "edited", tag: existing.po_number,
    subject: existing.vendor, dept: existing.department,
    detail: `Status: ${existing.status} → ${status}`
  });
  return getPurchaseOrder(id);
}

// Delete a Draft PO (Admin-only). Sent/Fulfilled POs are records — cancel them instead.
export function deletePurchaseOrder(id, actor) {
  const existing = db.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(id);
  if (!existing) throw new HttpError(404, "Purchase order not found");
  if (existing.status !== "Draft") {
    throw new HttpError(409, `Only Draft POs can be deleted (this one is ${existing.status}) — cancel it instead`);
  }
  db.prepare("DELETE FROM purchase_orders WHERE id = ?").run(id);
  insertAudit({
    actor, action: "removed", tag: existing.po_number,
    subject: existing.vendor, dept: existing.department,
    detail: "PO deleted (was Draft)"
  });
  return { ok: true };
}

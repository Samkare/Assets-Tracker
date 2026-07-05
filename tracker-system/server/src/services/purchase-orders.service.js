// Purchase Order (PO) module — self-contained service (own SQL; shared insertAudit from repo.js).
// A PO is generated from an APPROVED purchase_request and represents the actual order to a vendor.
// Invoice-grade: dynamic line items, GST totals (CGST/SGST or IGST), file attachments.
import db from "../db/connection.js";
import { insertAudit } from "../db/repo.js";
import { HttpError } from "../middleware/error.js";

// LEFT JOIN purchase_requests so standalone POs (pr_id NULL) are included; pr_number is null for them.
// LEFT JOIN suppliers surfaces the vendor's saved address + GSTIN for the detail view / printed PO.
const PO_SELECT = `
  SELECT po.*, pr.pr_number, su.address AS vendor_address, su.gst_number AS vendor_gst
  FROM purchase_orders po
  LEFT JOIN purchase_requests pr ON pr.id = po.pr_id
  LEFT JOIN suppliers su ON su.id = po.supplier_id`;

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Compute line amounts + invoice totals. CGST/SGST each = totalTax/2 (intra-state); when
// interState the whole tax is a single IGST. The grand total is identical either way.
function computeTotals(items, interState) {
  let subtotal = 0, totalTax = 0;
  const lines = items.map((it) => {
    const amount = round2(it.quantity * it.rate);
    const tax = round2(amount * (it.taxRate ?? 0) / 100);
    subtotal += amount;
    totalTax += tax;
    return { ...it, amount };
  });
  subtotal = round2(subtotal);
  totalTax = round2(totalTax);
  const grandTotal = round2(subtotal + totalTax);
  const totals = interState
    ? { subtotal, cgst: 0, sgst: 0, igst: totalTax, totalTax, grandTotal, interState: true }
    : { subtotal, cgst: round2(totalTax / 2), sgst: round2(totalTax / 2), igst: 0, totalTax, grandTotal, interState: false };
  return { lines, totals };
}

function getItems(poId) {
  return db.prepare("SELECT * FROM purchase_order_items WHERE po_id = ? ORDER BY sort_order, id").all(poId)
    .map((r) => ({ id: r.id, description: r.description, quantity: r.quantity, rate: r.rate, taxRate: r.tax_rate }));
}

function getAttachments(poId) {
  return db.prepare(
    "SELECT id, filename, mime, size, uploaded_by, uploaded_at FROM purchase_order_attachments WHERE po_id = ? ORDER BY id"
  ).all(poId).map((r) => ({ id: r.id, filename: r.filename, mime: r.mime, size: r.size, uploadedBy: r.uploaded_by, uploadedAt: r.uploaded_at }));
}

function insertItems(poId, items) {
  const ins = db.prepare(
    "INSERT INTO purchase_order_items (po_id, description, quantity, rate, tax_rate, sort_order) VALUES (?,?,?,?,?,?)"
  );
  items.forEach((it, i) => ins.run(poId, it.description, it.quantity, it.rate, it.taxRate ?? 18, i));
}

// Summary shape for list views (no items/attachments — avoids N+1). final_amount = stored grand total.
function rowToPOSummary(r) {
  if (!r) return null;
  return {
    id: r.id, poNumber: r.po_number, prId: r.pr_id, prNumber: r.pr_number ?? null,
    vendor: r.vendor, supplierId: r.supplier_id ?? null,
    department: r.department, category: r.category,
    finalAmount: r.final_amount ?? null, interState: !!r.inter_state,
    status: r.status, createdBy: r.created_by ?? null, createdAt: r.created_at
  };
}

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
  return db.prepare(sql).all(params).map(rowToPOSummary);
}

// Full detail — includes line items, computed totals (CGST/SGST/IGST), and attachments.
export function getPurchaseOrder(id) {
  const r = db.prepare(`${PO_SELECT} WHERE po.id = ?`).get(id);
  if (!r) return null;
  const items = getItems(id);
  const { lines, totals } = computeTotals(items, !!r.inter_state);
  return { ...rowToPOSummary(r), billingAddress: r.billing_address ?? null, shippingAddress: r.shipping_address ?? null, terms: r.terms ?? null, vendorAddress: r.vendor_address ?? null, vendorGst: r.vendor_gst ?? null, items: lines, totals, attachments: getAttachments(id) };
}

// Convenience default used by the route: the PR's first suggested vendor (or null).
export function firstSuggestedVendor(prId) {
  const pr = db.prepare("SELECT suggested_vendors FROM purchase_requests WHERE id = ?").get(prId);
  if (!pr || !pr.suggested_vendors) return null;
  const first = String(pr.suggested_vendors).split(",")[0].trim();
  return first || null;
}

// Create a PO — either from an APPROVED PR (prId set: snapshots dept/category, one-active guard)
// or STANDALONE (prId null: uses the department/category provided in the form). Grand total is
// computed from the line items and stored in final_amount.
export function generatePO(input, actor) {
  let department = input.department ?? null;
  let category = input.category ?? null;
  let prNumber = null;

  if (input.prId != null) {
    const pr = db.prepare("SELECT * FROM purchase_requests WHERE id = ?").get(input.prId);
    if (!pr) throw new HttpError(404, `PR ${input.prId} not found`);
    if (pr.status !== "Approved") {
      throw new HttpError(409, `A PO can only be generated from an Approved PR (PR is ${pr.status})`);
    }
    const active = db.prepare(
      "SELECT po_number FROM purchase_orders WHERE pr_id = ? AND status != 'Cancelled'"
    ).get(input.prId);
    if (active) throw new HttpError(409, `${pr.pr_number} already has an active PO (${active.po_number})`);
    department = pr.department;   // snapshot from the PR (authoritative — overrides any client value)
    category = pr.category;
    prNumber = pr.pr_number;
  }

  const { totals } = computeTotals(input.items, !!input.interState);
  const tx = db.transaction(() => {
    const poNumber = nextPoNumber();
    const info = db.prepare(
      `INSERT INTO purchase_orders
         (po_number, pr_id, vendor, supplier_id, department, category, final_amount, inter_state,
          billing_address, shipping_address, terms, created_by)
       VALUES (@poNumber, @prId, @vendor, @supplierId, @department, @category, @finalAmount, @interState,
          @billingAddress, @shippingAddress, @terms, @actor)`
    ).run({
      poNumber,
      prId: input.prId ?? null,
      vendor: input.vendor,
      supplierId: input.supplierId ?? null,
      department,
      category,
      finalAmount: totals.grandTotal,
      interState: input.interState ? 1 : 0,
      billingAddress: input.billingAddress ?? null,
      shippingAddress: input.shippingAddress ?? null,
      terms: input.terms ?? null,
      actor
    });
    const poId = info.lastInsertRowid;
    insertItems(poId, input.items);
    insertAudit({
      actor, action: "added", tag: poNumber,
      subject: input.vendor, dept: department,
      detail: prNumber
        ? `PO raised from ${prNumber} — ${input.vendor} (₹${totals.grandTotal})`
        : `Standalone PO raised — ${input.vendor} (₹${totals.grandTotal})`
    });
    return poId;
  });
  return getPurchaseOrder(tx());
}

// Edit is allowed only while the PO is still Draft. If items are supplied they REPLACE the set,
// and the grand total is recomputed. prId is fixed (omitted from the update schema).
export function updatePurchaseOrder(id, patch, actor) {
  const existing = db.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(id);
  if (!existing) throw new HttpError(404, "Purchase order not found");
  if (existing.status !== "Draft") throw new HttpError(409, `Only Draft POs can be edited (this one is ${existing.status})`);

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE purchase_orders SET
         vendor           = COALESCE(@vendor, vendor),
         supplier_id      = COALESCE(@supplierId, supplier_id),
         billing_address  = COALESCE(@billingAddress, billing_address),
         shipping_address = COALESCE(@shippingAddress, shipping_address),
         terms            = COALESCE(@terms, terms),
         inter_state      = COALESCE(@interState, inter_state)
       WHERE id = @id`
    ).run({
      id,
      vendor: patch.vendor ?? null,
      supplierId: patch.supplierId ?? null,
      billingAddress: patch.billingAddress ?? null,
      shippingAddress: patch.shippingAddress ?? null,
      terms: patch.terms ?? null,
      interState: patch.interState == null ? null : (patch.interState ? 1 : 0)
    });
    if (patch.items) {
      db.prepare("DELETE FROM purchase_order_items WHERE po_id = ?").run(id);
      insertItems(id, patch.items);
    }
    // recompute the stored grand total from the current items + current inter-state flag
    const cur = db.prepare("SELECT inter_state FROM purchase_orders WHERE id = ?").get(id);
    const { totals } = computeTotals(getItems(id), !!cur.inter_state);
    db.prepare("UPDATE purchase_orders SET final_amount = ? WHERE id = ?").run(totals.grandTotal, id);
    insertAudit({
      actor, action: "edited", tag: existing.po_number,
      subject: patch.vendor ?? existing.vendor, dept: existing.department,
      detail: "PO details edited"
    });
  });
  tx();
  return getPurchaseOrder(id);
}

// Allowed status transitions. Fulfilled and Cancelled are terminal.
const PO_TRANSITIONS = {
  "Draft": ["Sent to Vendor", "Cancelled"],
  "Sent to Vendor": ["Fulfilled", "Cancelled"],
  "Fulfilled": [],
  "Cancelled": []
};

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

// Delete a Draft PO (Admin-only). Items + attachments cascade; the route unlinks the files.
export function deletePurchaseOrder(id, actor) {
  const existing = db.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(id);
  if (!existing) throw new HttpError(404, "Purchase order not found");
  if (existing.status !== "Draft") {
    throw new HttpError(409, `Only Draft POs can be deleted (this one is ${existing.status}) — cancel it instead`);
  }
  const files = db.prepare("SELECT stored_name FROM purchase_order_attachments WHERE po_id = ?").all(id).map((r) => r.stored_name);
  db.prepare("DELETE FROM purchase_orders WHERE id = ?").run(id); // items + attachments cascade
  insertAudit({
    actor, action: "removed", tag: existing.po_number,
    subject: existing.vendor, dept: existing.department,
    detail: "PO deleted (was Draft)"
  });
  return { ok: true, storedNames: files };
}

/* ---------- attachments ---------- */
export function addAttachment(poId, file, actor) {
  const po = db.prepare("SELECT po_number, department FROM purchase_orders WHERE id = ?").get(poId);
  if (!po) throw new HttpError(404, "Purchase order not found");
  db.prepare(
    "INSERT INTO purchase_order_attachments (po_id, filename, stored_name, mime, size, uploaded_by) VALUES (?,?,?,?,?,?)"
  ).run(poId, file.filename, file.storedName, file.mime ?? null, file.size ?? null, actor);
  insertAudit({
    actor, action: "edited", tag: po.po_number,
    subject: file.filename, dept: po.department,
    detail: `Attachment added: ${file.filename}`
  });
  return getAttachments(poId);
}

// Returns { stored_name, filename, mime } for the route to stream, or null.
export function getAttachmentForDownload(attachmentId) {
  return db.prepare("SELECT id, po_id, filename, stored_name, mime FROM purchase_order_attachments WHERE id = ?").get(attachmentId);
}

export function deleteAttachment(attachmentId, actor) {
  const a = db.prepare(
    "SELECT a.*, po.po_number, po.department FROM purchase_order_attachments a JOIN purchase_orders po ON po.id = a.po_id WHERE a.id = ?"
  ).get(attachmentId);
  if (!a) throw new HttpError(404, "Attachment not found");
  db.prepare("DELETE FROM purchase_order_attachments WHERE id = ?").run(attachmentId);
  insertAudit({
    actor, action: "removed", tag: a.po_number,
    subject: a.filename, dept: a.department,
    detail: `Attachment removed: ${a.filename}`
  });
  return { ok: true, storedName: a.stored_name };
}

// Atomic PO-<Mon>-<YYYY>-NNN generator (e.g. PO-Jul-2026-001), matching the PR format.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function nextPoNumber() {
  const { y: year, m } = db.prepare("SELECT strftime('%Y','now') AS y, strftime('%m','now') AS m").get();
  const prefix = `PO-${MONTHS[Number(m) - 1]}-${year}-`;
  const { maxSeq } = db.prepare(
    `SELECT MAX(CAST(substr(po_number, ?) AS INTEGER)) AS maxSeq
       FROM purchase_orders WHERE po_number LIKE ?`
  ).get(prefix.length + 1, `${prefix}%`);
  const seq = (maxSeq || 0) + 1;
  return `${prefix}${String(seq).padStart(3, "0")}`;
}

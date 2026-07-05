// Purchase Request (PR) module — self-contained service (mirrors repair/consumables services:
// own SQL here, only the cross-cutting insertAudit helper is pulled from repo.js).
import db from "../db/connection.js";
import { insertAudit } from "../db/repo.js";
import { HttpError } from "../middleware/error.js";

// DB row (snake_case) -> API/client shape (camelCase). Mirrors rowToAsset in repo.js.
function rowToPR(r) {
  if (!r) return null;
  return {
    id: r.id,
    prNumber: r.pr_number,
    requestedBy: r.requested_by,
    department: r.department,
    category: r.category,
    businessPurpose: r.business_purpose,
    requiredBy: r.required_by ?? null,
    estimatedCost: r.estimated_cost ?? null,
    suggestedVendors: r.suggested_vendors ?? null,
    status: r.status,
    createdAt: r.created_at
  };
}

// Atomic PR-YYYY-NNN generator. Called only from inside the create transaction, so the
// MAX-lookup and the INSERT cannot interleave within this (single-threaded) process;
// the UNIQUE(pr_number) constraint is the final cross-process backstop.
// Year+month come from SQLite (UTC) so they match created_at exactly.
// Format: PR-<Mon>-<YYYY>-NNN (e.g. PR-Jul-2026-001). The sequence resets each month
// (the LIKE only matches the current month's rows), so August starts fresh at -001.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function nextPrNumber() {
  const { y: year, m } = db.prepare("SELECT strftime('%Y','now') AS y, strftime('%m','now') AS m").get();
  const prefix = `PR-${MONTHS[Number(m) - 1]}-${year}-`; // e.g. PR-Jul-2026-
  const { maxSeq } = db.prepare(
    `SELECT MAX(CAST(substr(pr_number, ?) AS INTEGER)) AS maxSeq
       FROM purchase_requests WHERE pr_number LIKE ?`
  ).get(prefix.length + 1, `${prefix}%`);
  const seq = (maxSeq || 0) + 1;
  return `${prefix}${String(seq).padStart(3, "0")}`; // PR-Jul-2026-001 … -999 … -1000
}

export function listPurchaseRequests({ status, department, category, q } = {}) {
  const where = [];
  const params = {};
  if (status && status !== "All") { where.push("status = @status"); params.status = status; }
  if (department) { where.push("department = @department"); params.department = department; }
  if (category) { where.push("category = @category"); params.category = category; }
  if (q) {
    where.push("(pr_number LIKE @q OR requested_by LIKE @q OR business_purpose LIKE @q OR suggested_vendors LIKE @q)");
    params.q = `%${q}%`;
  }
  const sql = `SELECT * FROM purchase_requests
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY (status = 'Pending') DESC, created_at DESC`;
  return db.prepare(sql).all(params).map(rowToPR);
}

export function getPurchaseRequest(id) {
  return rowToPR(db.prepare("SELECT * FROM purchase_requests WHERE id = ?").get(id));
}

// input: already Zod-validated in the route, with requestedBy forced to the session user.
export function createPurchaseRequest(input, actor) {
  const tx = db.transaction(() => {
    const prNumber = nextPrNumber();
    const info = db.prepare(
      `INSERT INTO purchase_requests
         (pr_number, requested_by, department, category, business_purpose,
          required_by, estimated_cost, suggested_vendors)
       VALUES (@prNumber, @requestedBy, @department, @category, @businessPurpose,
          @requiredBy, @estimatedCost, @suggestedVendors)`
    ).run({
      prNumber,
      requestedBy: input.requestedBy,
      department: input.department,
      category: input.category,
      businessPurpose: input.businessPurpose,
      requiredBy: input.requiredBy ?? null,
      estimatedCost: input.estimatedCost ?? null,
      suggestedVendors: input.suggestedVendors ?? null
    });
    insertAudit({
      actor, action: "added", tag: prNumber,
      subject: input.requestedBy, dept: input.department,
      detail: `PR raised — ${input.category}${input.estimatedCost != null ? ` (est. ${input.estimatedCost})` : ""}`
    });
    return info.lastInsertRowid;
  });
  return getPurchaseRequest(tx());
}

// Edit is allowed only while the PR is still Pending — a decided PR is an immutable record.
// requestedBy is owner-fixed (auto-filled at create) and never patched here.
// NOTE: COALESCE means a PATCH cannot null-out a field — same convention as repair/consumables.
export function updatePurchaseRequest(id, patch, actor) {
  const existing = db.prepare("SELECT * FROM purchase_requests WHERE id = ?").get(id);
  if (!existing) throw new HttpError(404, "Purchase request not found");
  if (existing.status !== "Pending") throw new HttpError(409, `Cannot edit a request that is already ${existing.status}`);

  db.prepare(
    `UPDATE purchase_requests SET
       department        = COALESCE(@department, department),
       category          = COALESCE(@category, category),
       business_purpose  = COALESCE(@businessPurpose, business_purpose),
       required_by       = COALESCE(@requiredBy, required_by),
       estimated_cost    = COALESCE(@estimatedCost, estimated_cost),
       suggested_vendors = COALESCE(@suggestedVendors, suggested_vendors)
     WHERE id = @id`
  ).run({
    id,
    department: patch.department ?? null,
    category: patch.category ?? null,
    businessPurpose: patch.businessPurpose ?? null,
    requiredBy: patch.requiredBy ?? null,
    estimatedCost: patch.estimatedCost ?? null,
    suggestedVendors: patch.suggestedVendors ?? null
  });
  insertAudit({
    actor, action: "edited", tag: existing.pr_number,
    subject: existing.requested_by, dept: patch.department ?? existing.department,
    detail: "PR details edited"
  });
  return getPurchaseRequest(id);
}

// Approve / reject (Admin-only, enforced in the route). Records the transition in the audit log.
export function setPurchaseRequestStatus(id, status, actor) {
  const existing = db.prepare("SELECT * FROM purchase_requests WHERE id = ?").get(id);
  if (!existing) throw new HttpError(404, "Purchase request not found");
  if (existing.status === status) throw new HttpError(409, `Request is already ${status}`);

  db.prepare("UPDATE purchase_requests SET status = ? WHERE id = ?").run(status, id);
  insertAudit({
    actor, action: "edited", tag: existing.pr_number,
    subject: existing.requested_by, dept: existing.department,
    detail: `Status: ${existing.status} → ${status}`
  });
  return getPurchaseRequest(id);
}

export function deletePurchaseRequest(id, actor) {
  const existing = db.prepare("SELECT * FROM purchase_requests WHERE id = ?").get(id);
  if (!existing) throw new HttpError(404, "Purchase request not found");
  db.prepare("DELETE FROM purchase_requests WHERE id = ?").run(id);
  insertAudit({
    actor, action: "removed", tag: existing.pr_number,
    subject: existing.requested_by, dept: existing.department,
    detail: `PR deleted (was ${existing.status})`
  });
  return { ok: true };
}

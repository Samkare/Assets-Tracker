// Task Source — Purchase Requests page (raise → review → approve/reject procurement requests)
import React, { useState, useEffect } from "react";
import { Icon, ICONS, DeptBadge, Field } from "./components.jsx";
import {
  usePurchaseRequests, useCreatePurchaseRequest, useSetPRStatus, useDeletePurchaseRequest, usePurchaseOrders
} from "./api/hooks.js";
import { SkeletonTable } from "./Skeleton.jsx";
import { useToast } from "./toasts.jsx";
import { useConfirm } from "./confirm.jsx";
import { DEPARTMENTS, PR_CATEGORIES } from "@its/shared/constants";
import { POGenerateForm } from "./pages-purchase-orders.jsx";

const STATUS_TONE = {
  Pending:  "var(--warn, #b45309)",
  Approved: "var(--success, #15803d)",
  Rejected: "var(--danger, #dc2626)"
};
function PRStatusPill({ status }) {
  const c = STATUS_TONE[status] || "var(--text-3)";
  return <span className="status-pill" style={{ color: c, borderColor: c }}>{status}</span>;
}
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
function fmtMoney(v) {
  if (v == null || v === "") return "—";
  return "₹" + Number(v).toLocaleString("en-IN");
}

const FILTERS = ["All", "Pending", "Approved", "Rejected"];

/* ---------- create form ---------- */
function NewRequestForm({ onClose }) {
  const [form, setForm] = useState({
    department: "", category: "", businessPurpose: "",
    requiredBy: "", estimatedCost: "", suggestedVendors: ""
  });
  const { showToast } = useToast();
  const create = useCreatePurchaseRequest({
    onSuccess: (pr) => { showToast(`${pr.prNumber} raised`, "success"); onClose(); },
    onError: (e) => showToast(e.message, "error")
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid = form.department && form.category && form.businessPurpose.trim();

  const submit = (e) => {
    e.preventDefault();
    if (!valid) return;
    // requestedBy is auto-filled server-side from the session — intentionally omitted here.
    create.mutate({
      department: form.department,
      category: form.category,
      businessPurpose: form.businessPurpose.trim(),
      requiredBy: form.requiredBy || null,
      estimatedCost: form.estimatedCost !== "" ? Number(form.estimatedCost) : null,
      suggestedVendors: form.suggestedVendors.trim() || null
    });
  };

  return (
    <form className="table-card" style={{ padding: "var(--sp-16)", marginBottom: "var(--sp-16)" }} onSubmit={submit}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-12)" }}>
        <strong>New Purchase Request</strong>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Cancel"><Icon d={ICONS.close} size={15} /></button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--sp-12)" }}>
        <label className="pr-field">
          <span className="field-label">Department *</span>
          <select className="input" value={form.department} onChange={set("department")} required>
            <option value="">Select department…</option>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label className="pr-field">
          <span className="field-label">Category *</span>
          <select className="input" value={form.category} onChange={set("category")} required>
            <option value="">Select category…</option>
            {PR_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="pr-field">
          <span className="field-label">Required by</span>
          <input className="input" type="date" value={form.requiredBy} onChange={set("requiredBy")} />
        </label>
        <label className="pr-field">
          <span className="field-label">Estimated cost (₹)</span>
          <input className="input" type="number" min="0" step="any" placeholder="0"
            value={form.estimatedCost} onChange={set("estimatedCost")} />
        </label>
        <label className="pr-field" style={{ gridColumn: "1 / -1" }}>
          <span className="field-label">Business purpose *</span>
          <textarea className="input" rows={2} placeholder="Why is this item/service required?"
            value={form.businessPurpose} onChange={set("businessPurpose")} required />
        </label>
        <label className="pr-field" style={{ gridColumn: "1 / -1" }}>
          <span className="field-label">Suggested vendors</span>
          <input className="input" placeholder="e.g. Dell, HP, Lenovo"
            value={form.suggestedVendors} onChange={set("suggestedVendors")} />
        </label>
      </div>
      <div style={{ display: "flex", gap: "var(--sp-8)", justifyContent: "flex-end", marginTop: "var(--sp-12)" }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={!valid || create.isPending}>
          {create.isPending ? "Submitting…" : "Submit request"}
        </button>
      </div>
    </form>
  );
}

/* ---------- detail / review modal ---------- */
// Approvers open this to VERIFY the full request before deciding. Approve/Reject live here
// (not in the table) so an Admin can't act without seeing the details first.
function PRDetailModal({ pr, canAdmin, canManage, activePos = [], onGeneratePO, onClose }) {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const setStatus = useSetPRStatus({
    onSuccess: (r) => { showToast(`${r.prNumber} ${r.status.toLowerCase()}`, "success"); onClose(); },
    onError: (e) => showToast(e.message, "error")
  });
  const del = useDeletePurchaseRequest({
    onSuccess: () => { showToast(`${pr.prNumber} deleted`, "success"); onClose(); },
    onError: (e) => showToast(e.message, "error")
  });
  const busy = setStatus.isPending || del.isPending;

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const reject = async () => {
    const ok = await confirm({ title: `Reject ${pr.prNumber}?`, body: `${pr.category} request from ${pr.requestedBy}.`, confirmLabel: "Reject" });
    if (ok) setStatus.mutate({ id: pr.id, status: "Rejected" });
  };
  const remove = async () => {
    const ok = await confirm({ title: `Delete ${pr.prNumber}?`, body: "This permanently removes the request.", confirmLabel: "Delete" });
    if (ok) del.mutate(pr.id);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}
      onClick={onClose} role="dialog" aria-modal="true" aria-label={`Purchase request ${pr.prNumber}`}>
      <div className="table-card" style={{ maxWidth: 620, width: "100%", padding: "var(--sp-20)", maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--sp-12)", marginBottom: "var(--sp-16)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-10)" }}>
            <span className="mono cell-tag" style={{ fontSize: "1.05rem" }}>{pr.prNumber}</span>
            <PRStatusPill status={pr.status} />
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon d={ICONS.close} size={16} /></button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--sp-12)" }}>
          <Field label="Requested by">{pr.requestedBy}</Field>
          <Field label="Department">{pr.department ? <DeptBadge dept={pr.department} /> : "—"}</Field>
          <Field label="Category">{pr.category}</Field>
          <Field label="Required by">{fmtDate(pr.requiredBy)}</Field>
          <Field label="Estimated cost">{fmtMoney(pr.estimatedCost)}</Field>
          <Field label="Suggested vendors">{pr.suggestedVendors || "—"}</Field>
          <Field label="Raised on">{fmtDateTime(pr.createdAt)}</Field>
        </div>
        <div style={{ marginTop: "var(--sp-14)" }}>
          <div className="field-label">Business purpose</div>
          <div className="field-value" style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{pr.businessPurpose}</div>
        </div>

        <div style={{ display: "flex", gap: "var(--sp-8)", justifyContent: "flex-end", alignItems: "center", marginTop: "var(--sp-20)", borderTop: "1px solid var(--border)", paddingTop: "var(--sp-14)" }}>
          {pr.status === "Pending" && canAdmin ? (
            <React.Fragment>
              <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={reject}>Reject</button>
              <button type="button" className="btn btn-primary btn-sm" disabled={busy}
                onClick={() => setStatus.mutate({ id: pr.id, status: "Approved" })}>
                {setStatus.isPending ? "Saving…" : "Approve"}
              </button>
            </React.Fragment>
          ) : pr.status === "Approved" ? (
            <React.Fragment>
              {activePos.length ? (
                <span className="cell-muted" style={{ marginRight: "auto" }}>
                  {activePos.length === 1 ? "Linked PO: " : `Linked POs (${activePos.length}): `}
                  {activePos.map((po, i) => (
                    <React.Fragment key={po.id}>
                      {i > 0 ? ", " : ""}<span className="mono">{po.poNumber}</span> · {po.status}
                    </React.Fragment>
                  ))}
                </span>
              ) : null}
              {canManage ? (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => onGeneratePO(pr)}>
                  {activePos.length ? "Generate another PO" : "Generate PO"}
                </button>
              ) : null}
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
            </React.Fragment>
          ) : canAdmin && pr.status === "Rejected" ? (
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={remove}>Delete</button>
          ) : (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
          )}
        </div>
      </div>
    </div>
  );
}

function PurchaseRequestsPage({ canManage, canAdmin, initialFilter }) {
  const [filter, setFilter] = useState(initialFilter || "All");
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState(null);       // PR being reviewed in the modal
  const [generatingFor, setGeneratingFor] = useState(null); // PR we're generating a PO from
  const { data: rows = [], isLoading } = usePurchaseRequests(filter === "All" ? {} : { status: filter });
  // map each PR to ALL its active (non-cancelled) POs — a PR can back more than one PO
  // (split/partial fulfillment), so the modal lists every linked PO, not just the first.
  const { data: pos = [] } = usePurchaseOrders();
  const activePosByPr = {};
  for (const po of pos) { if (po.status !== "Cancelled") (activePosByPr[po.prId] = activePosByPr[po.prId] || []).push(po); }

  return (
    <React.Fragment>
      <div className="page-head">
        <h1 className="page-title">Purchase Requests</h1>
        <p className="page-caption">Raise, review &amp; approve procurement &amp; service requests</p>
      </div>

      <div className="audit-filters">
        {FILTERS.map((o) => (
          <button type="button" key={o}
            className={"audit-chip" + (filter === o ? " audit-chip-on" : "")}
            onClick={() => setFilter(o)}>{o}</button>
        ))}
        <span className="audit-count">{rows.length} {rows.length === 1 ? "request" : "requests"}</span>
        {canManage && !formOpen ? (
          <button type="button" className="table-add-btn" style={{ marginLeft: "auto" }} onClick={() => setFormOpen(true)}>
            <Icon d={ICONS.plus} size={13} /> New Request
          </button>
        ) : null}
      </div>

      {formOpen ? <NewRequestForm onClose={() => setFormOpen(false)} /> : null}

      {isLoading ? (
        <div className="table-card"><div style={{ padding: "var(--sp-16)" }}><SkeletonTable rows={5} cols={7} /></div></div>
      ) : rows.length === 0 ? (
        <div className="table-card">
          <div className="empty-state">
            <div className="empty-icon"><Icon d={ICONS.template} size={20} /></div>
            <div className="empty-title">No purchase requests{filter !== "All" ? ` (${filter})` : ""}</div>
            <div className="empty-sub">{canManage ? "Click “New Request” to raise one." : "Requests raised by the IT team will show here."}</div>
          </div>
        </div>
      ) : (
        <div className="table-card">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th><span className="th-plain">PR #</span></th>
                  <th><span className="th-plain">Requested by</span></th>
                  <th><span className="th-plain">Department</span></th>
                  <th><span className="th-plain">Category</span></th>
                  <th><span className="th-plain">Purpose</span></th>
                  <th><span className="th-plain">Required by</span></th>
                  <th><span className="th-plain">Est. cost</span></th>
                  <th><span className="th-plain">Status</span></th>
                  <th><span className="th-plain">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((pr) => (
                  <tr key={pr.id} onClick={() => setSelected(pr)} style={{ cursor: "pointer" }} title="Open to review">
                    <td><span className="mono cell-tag">{pr.prNumber}</span></td>
                    <td>{pr.requestedBy}</td>
                    <td>{pr.department ? <DeptBadge dept={pr.department} /> : <span className="cell-muted">—</span>}</td>
                    <td>{pr.category}</td>
                    <td style={{ maxWidth: 240, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pr.businessPurpose}</td>
                    <td className="cell-muted">{fmtDate(pr.requiredBy)}</td>
                    <td>{pr.estimatedCost != null ? <span className="mono">{fmtMoney(pr.estimatedCost)}</span> : <span className="cell-muted">—</span>}</td>
                    <td><PRStatusPill status={pr.status} /></td>
                    <td>
                      <button type="button" className="btn btn-secondary btn-sm"
                        onClick={(e) => { e.stopPropagation(); setSelected(pr); }}>
                        {canAdmin && pr.status === "Pending" ? "Review" : "View"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected ? (
        <PRDetailModal pr={selected} canAdmin={canAdmin} canManage={canManage}
          activePos={activePosByPr[selected.id] || []}
          onGeneratePO={(pr) => { setSelected(null); setGeneratingFor(pr); }}
          onClose={() => setSelected(null)} />
      ) : null}
      {generatingFor ? <POGenerateForm pr={generatingFor} onClose={() => setGeneratingFor(null)} /> : null}
    </React.Fragment>
  );
}

export { PurchaseRequestsPage };

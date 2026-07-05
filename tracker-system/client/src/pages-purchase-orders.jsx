// Task Source — Purchase Orders page (generated from Approved PRs; Draft → Sent → Fulfilled/Cancelled)
import React, { useState, useEffect } from "react";
import { Icon, ICONS, DeptBadge, Field } from "./components.jsx";
import {
  usePurchaseOrders, useGeneratePO, useSetPOStatus, useSuppliers
} from "./api/hooks.js";
import { SkeletonTable } from "./Skeleton.jsx";
import { useToast } from "./toasts.jsx";
import { useConfirm } from "./confirm.jsx";
import { COMPANY_DEFAULTS } from "@its/shared/constants";

const PO_STATUS_TONE = {
  "Draft":          "var(--text-3)",
  "Sent to Vendor": "var(--accent, #4f46e5)",
  "Fulfilled":      "var(--success, #15803d)",
  "Cancelled":      "var(--danger, #dc2626)"
};
function POStatusPill({ status }) {
  const c = PO_STATUS_TONE[status] || "var(--text-3)";
  return <span className="status-pill" style={{ color: c, borderColor: c }}>{status}</span>;
}
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d) ? "—" : d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
function fmtMoney(v) {
  if (v == null || v === "") return "—";
  return "₹" + Number(v).toLocaleString("en-IN");
}

const FILTERS = ["All", "Draft", "Sent to Vendor", "Fulfilled", "Cancelled"];

const modalBackdrop = { position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 };

/* ---------- generate a PO from an approved PR (launched from the PR review modal) ---------- */
export function POGenerateForm({ pr, onClose }) {
  const { showToast } = useToast();
  const { data: suppliers = [] } = useSuppliers();
  const firstVendor = (pr.suggestedVendors || "").split(",")[0].trim();
  const [form, setForm] = useState({
    vendor: firstVendor,
    finalAmount: pr.estimatedCost != null ? String(pr.estimatedCost) : "",
    billingAddress: COMPANY_DEFAULTS.billingAddress,
    shippingAddress: COMPANY_DEFAULTS.shippingAddress,
    terms: ""
  });
  const gen = useGeneratePO({
    onSuccess: (po) => { showToast(`${po.poNumber} created from ${pr.prNumber}`, "success"); onClose(); },
    onError: (e) => showToast(e.message, "error")
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid = form.vendor.trim();

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = (e) => {
    e.preventDefault();
    if (!valid) return;
    // If the typed vendor matches a Supplier, link it; otherwise it's a free-text vendor.
    const match = suppliers.find((s) => s.name.toLowerCase() === form.vendor.trim().toLowerCase());
    gen.mutate({
      prId: pr.id,
      vendor: form.vendor.trim(),
      supplierId: match ? match.id : null,
      finalAmount: form.finalAmount !== "" ? Number(form.finalAmount) : null,
      billingAddress: form.billingAddress.trim() || null,
      shippingAddress: form.shippingAddress.trim() || null,
      terms: form.terms.trim() || null
    });
  };

  return (
    <div style={modalBackdrop} onClick={onClose} role="dialog" aria-modal="true" aria-label={`Generate PO from ${pr.prNumber}`}>
      <form className="table-card" style={{ maxWidth: 620, width: "100%", padding: "var(--sp-20)", maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-4)" }}>
          <strong>Generate Purchase Order</strong>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cancel"><Icon d={ICONS.close} size={15} /></button>
        </div>
        <p className="page-caption" style={{ marginTop: 0, marginBottom: "var(--sp-14)" }}>
          From {pr.prNumber} · {pr.department} · {pr.category}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--sp-12)" }}>
          <label className="pr-field">
            <span className="field-label">Final vendor *</span>
            <input className="input" list="po-suppliers" value={form.vendor} onChange={set("vendor")} placeholder="Pick a supplier or type a name" required />
            <datalist id="po-suppliers">
              {suppliers.map((s) => <option key={s.id} value={s.name} />)}
            </datalist>
          </label>
          <label className="pr-field">
            <span className="field-label">Final amount (₹)</span>
            <input className="input" type="number" min="0" step="any" value={form.finalAmount} onChange={set("finalAmount")} placeholder="0" />
          </label>
          <label className="pr-field">
            <span className="field-label">Billing address</span>
            <input className="input" value={form.billingAddress} onChange={set("billingAddress")} />
          </label>
          <label className="pr-field">
            <span className="field-label">Shipping address</span>
            <input className="input" value={form.shippingAddress} onChange={set("shippingAddress")} />
          </label>
          <label className="pr-field" style={{ gridColumn: "1 / -1" }}>
            <span className="field-label">Terms &amp; conditions</span>
            <textarea className="input" rows={2} placeholder="Delivery / payment terms" value={form.terms} onChange={set("terms")} />
          </label>
        </div>
        <div style={{ display: "flex", gap: "var(--sp-8)", justifyContent: "flex-end", marginTop: "var(--sp-14)" }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={!valid || gen.isPending}>
            {gen.isPending ? "Generating…" : "Generate PO"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------- detail / review modal with Admin status actions ---------- */
function PODetailModal({ po, canAdmin, onClose }) {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const setStatus = useSetPOStatus({
    onSuccess: (r) => { showToast(`${r.poNumber} → ${r.status}`, "success"); onClose(); },
    onError: (e) => showToast(e.message, "error")
  });
  const busy = setStatus.isPending;

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const go = (status) => () => setStatus.mutate({ id: po.id, status });
  const cancel = async () => {
    const ok = await confirm({ title: `Cancel ${po.poNumber}?`, body: `Order to ${po.vendor} will be marked Cancelled.`, confirmLabel: "Cancel PO" });
    if (ok) setStatus.mutate({ id: po.id, status: "Cancelled" });
  };

  const actions =
    canAdmin && po.status === "Draft" ? (
      <React.Fragment>
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={cancel}>Cancel PO</button>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={go("Sent to Vendor")}>Send to Vendor</button>
      </React.Fragment>
    ) : canAdmin && po.status === "Sent to Vendor" ? (
      <React.Fragment>
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={cancel}>Cancel PO</button>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={go("Fulfilled")}>Mark Fulfilled</button>
      </React.Fragment>
    ) : (
      <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
    );

  return (
    <div style={modalBackdrop} onClick={onClose} role="dialog" aria-modal="true" aria-label={`Purchase order ${po.poNumber}`}>
      <div className="table-card" style={{ maxWidth: 640, width: "100%", padding: "var(--sp-20)", maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--sp-12)", marginBottom: "var(--sp-16)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-10)" }}>
            <span className="mono cell-tag" style={{ fontSize: "1.05rem" }}>{po.poNumber}</span>
            <POStatusPill status={po.status} />
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon d={ICONS.close} size={16} /></button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--sp-12)" }}>
          <Field label="From PR">{po.prNumber}</Field>
          <Field label="Vendor">{po.vendor}</Field>
          <Field label="Department">{po.department ? <DeptBadge dept={po.department} /> : "—"}</Field>
          <Field label="Category">{po.category}</Field>
          <Field label="Final amount">{fmtMoney(po.finalAmount)}</Field>
          <Field label="Created">{fmtDateTime(po.createdAt)}</Field>
          <Field label="Billing address">{po.billingAddress || "—"}</Field>
          <Field label="Shipping address">{po.shippingAddress || "—"}</Field>
        </div>
        {po.terms ? (
          <div style={{ marginTop: "var(--sp-14)" }}>
            <div className="field-label">Terms &amp; conditions</div>
            <div className="field-value" style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{po.terms}</div>
          </div>
        ) : null}

        <div style={{ display: "flex", gap: "var(--sp-8)", justifyContent: "flex-end", marginTop: "var(--sp-20)", borderTop: "1px solid var(--border)", paddingTop: "var(--sp-14)" }}>
          {actions}
        </div>
      </div>
    </div>
  );
}

function PurchaseOrdersPage({ canManage, canAdmin }) {
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const { data: rows = [], isLoading } = usePurchaseOrders(filter === "All" ? {} : { status: filter });

  return (
    <React.Fragment>
      <div className="page-head">
        <h1 className="page-title">Purchase Orders</h1>
        <p className="page-caption">Orders raised from approved requests · generate a PO from an Approved PR</p>
      </div>

      <div className="audit-filters">
        {FILTERS.map((o) => (
          <button type="button" key={o}
            className={"audit-chip" + (filter === o ? " audit-chip-on" : "")}
            onClick={() => setFilter(o)}>{o}</button>
        ))}
        <span className="audit-count">{rows.length} {rows.length === 1 ? "order" : "orders"}</span>
      </div>

      {isLoading ? (
        <div className="table-card"><div style={{ padding: "var(--sp-16)" }}><SkeletonTable rows={5} cols={7} /></div></div>
      ) : rows.length === 0 ? (
        <div className="table-card">
          <div className="empty-state">
            <div className="empty-icon"><Icon d={ICONS.mail} size={20} /></div>
            <div className="empty-title">No purchase orders{filter !== "All" ? ` (${filter})` : ""}</div>
            <div className="empty-sub">Open an <strong>Approved</strong> request in Purchase Requests and click “Generate PO”.</div>
          </div>
        </div>
      ) : (
        <div className="table-card">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th><span className="th-plain">PO #</span></th>
                  <th><span className="th-plain">From PR</span></th>
                  <th><span className="th-plain">Vendor</span></th>
                  <th><span className="th-plain">Department</span></th>
                  <th><span className="th-plain">Category</span></th>
                  <th><span className="th-plain">Final amount</span></th>
                  <th><span className="th-plain">Status</span></th>
                  <th><span className="th-plain">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((po) => (
                  <tr key={po.id} onClick={() => setSelected(po)} style={{ cursor: "pointer" }} title="Open to review">
                    <td><span className="mono cell-tag">{po.poNumber}</span></td>
                    <td><span className="mono cell-muted">{po.prNumber}</span></td>
                    <td>{po.vendor}</td>
                    <td>{po.department ? <DeptBadge dept={po.department} /> : <span className="cell-muted">—</span>}</td>
                    <td>{po.category}</td>
                    <td>{po.finalAmount != null ? <span className="mono">{fmtMoney(po.finalAmount)}</span> : <span className="cell-muted">—</span>}</td>
                    <td><POStatusPill status={po.status} /></td>
                    <td>
                      <button type="button" className="btn btn-secondary btn-sm"
                        onClick={(e) => { e.stopPropagation(); setSelected(po); }}>
                        {canAdmin && (po.status === "Draft" || po.status === "Sent to Vendor") ? "Manage" : "View"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected ? <PODetailModal po={selected} canAdmin={canAdmin} onClose={() => setSelected(null)} /> : null}
    </React.Fragment>
  );
}

export { PurchaseOrdersPage };

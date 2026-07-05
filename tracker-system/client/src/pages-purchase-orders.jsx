// Task Source — Purchase Orders page (invoice-grade: line items, GST totals, attachments, print)
import React, { useState, useEffect } from "react";
import { Icon, ICONS, DeptBadge, Field } from "./components.jsx";
import {
  usePurchaseOrders, usePurchaseOrder, useGeneratePO, useSetPOStatus,
  useUploadPOAttachment, useDeletePOAttachment, useSuppliers
} from "./api/hooks.js";
import { api } from "./api/client.js";
import { SkeletonTable } from "./Skeleton.jsx";
import { useToast } from "./toasts.jsx";
import { useConfirm } from "./confirm.jsx";
import { COMPANY_DEFAULTS } from "@its/shared/constants";

const PO_STATUS_TONE = {
  "Draft": "var(--text-3)",
  "Sent to Vendor": "var(--accent, #4f46e5)",
  "Fulfilled": "var(--success, #15803d)",
  "Cancelled": "var(--danger, #dc2626)"
};
function POStatusPill({ status }) {
  const c = PO_STATUS_TONE[status] || "var(--text-3)";
  return <span className="status-pill" style={{ color: c, borderColor: c }}>{status}</span>;
}
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
function fmtDate(iso) { const d = new Date(iso); return isNaN(d) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
function fmtDateTime(iso) { const d = new Date(iso); return isNaN(d) ? "—" : d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }); }
function fmtMoney(v) { return v == null || v === "" ? "—" : "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
function fmtBytes(b) { if (b == null) return ""; return b < 1024 ? b + " B" : (b / 1024).toFixed(1) + " KB"; }
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Client-side mirror of the server's tax math (for live totals in the form).
function computeTotals(items, interState) {
  let subtotal = 0, totalTax = 0;
  for (const it of items) {
    const amount = round2((Number(it.quantity) || 0) * (Number(it.rate) || 0));
    subtotal += amount;
    totalTax += round2(amount * (Number(it.taxRate) || 0) / 100);
  }
  subtotal = round2(subtotal); totalTax = round2(totalTax);
  const grandTotal = round2(subtotal + totalTax);
  return interState
    ? { subtotal, cgst: 0, sgst: 0, igst: totalTax, totalTax, grandTotal, interState: true }
    : { subtotal, cgst: round2(totalTax / 2), sgst: round2(totalTax / 2), igst: 0, totalTax, grandTotal, interState: false };
}

const FILTERS = ["All", "Draft", "Sent to Vendor", "Fulfilled", "Cancelled"];
const modalBackdrop = { position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 };

function TotalRow({ label, value, strong }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 24, padding: "3px 0", fontWeight: strong ? 700 : 400, borderTop: strong ? "1px solid var(--border)" : "none", marginTop: strong ? 4 : 0, paddingTop: strong ? 8 : 3 }}>
      <span className={strong ? "" : "cell-muted"}>{label}</span>
      <span className="mono">{fmtMoney(value)}</span>
    </div>
  );
}
function TotalsPanel({ totals }) {
  return (
    <div style={{ marginLeft: "auto", width: 280, marginTop: "var(--sp-12)" }}>
      <TotalRow label="Subtotal" value={totals.subtotal} />
      {totals.interState
        ? <TotalRow label="IGST" value={totals.igst} />
        : <React.Fragment><TotalRow label="CGST" value={totals.cgst} /><TotalRow label="SGST" value={totals.sgst} /></React.Fragment>}
      <TotalRow label="Grand Total" value={totals.grandTotal} strong />
    </div>
  );
}

/* ---------- dynamic line-items editor ---------- */
function ItemsEditor({ items, setItems }) {
  const update = (i, k, v) => setItems(items.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  const addRow = () => setItems([...items, { description: "", quantity: 1, rate: 0, taxRate: 18 }]);
  const removeRow = (i) => setItems(items.length > 1 ? items.filter((_, idx) => idx !== i) : items);
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="data-table" style={{ minWidth: 580 }}>
        <thead><tr>
          <th><span className="th-plain">Item details</span></th>
          <th><span className="th-plain">Qty</span></th>
          <th><span className="th-plain">Rate</span></th>
          <th><span className="th-plain">Tax %</span></th>
          <th style={{ textAlign: "right" }}><span className="th-plain">Amount</span></th>
          <th></th>
        </tr></thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              <td><input className="input" value={it.description} onChange={(e) => update(i, "description", e.target.value)} placeholder="Description" /></td>
              <td><input className="input" type="number" min="0" step="any" style={{ width: 70 }} value={it.quantity} onChange={(e) => update(i, "quantity", e.target.value)} /></td>
              <td><input className="input" type="number" min="0" step="any" style={{ width: 100 }} value={it.rate} onChange={(e) => update(i, "rate", e.target.value)} /></td>
              <td><input className="input" type="number" min="0" step="any" style={{ width: 70 }} value={it.taxRate} onChange={(e) => update(i, "taxRate", e.target.value)} /></td>
              <td className="mono" style={{ textAlign: "right", whiteSpace: "nowrap" }}>{fmtMoney(round2((Number(it.quantity) || 0) * (Number(it.rate) || 0)))}</td>
              <td><button type="button" className="icon-btn" onClick={() => removeRow(i)} disabled={items.length <= 1} aria-label="Remove row"><Icon d={ICONS.close} size={13} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: "var(--sp-8)" }} onClick={addRow}>
        <Icon d={ICONS.plus} size={12} /> Add item
      </button>
    </div>
  );
}

/* ---------- generate a PO from an approved PR (launched from the PR review modal) ---------- */
export function POGenerateForm({ pr, onClose }) {
  const { showToast } = useToast();
  const { data: suppliers = [] } = useSuppliers();
  const firstVendor = (pr.suggestedVendors || "").split(",")[0].trim();
  const [vendor, setVendor] = useState(firstVendor);
  const [interState, setInterState] = useState(false);
  const [billingAddress, setBilling] = useState(COMPANY_DEFAULTS.billingAddress);
  const [shippingAddress, setShipping] = useState(COMPANY_DEFAULTS.shippingAddress);
  const [terms, setTerms] = useState("");
  const [items, setItems] = useState([{ description: "", quantity: 1, rate: pr.estimatedCost != null ? pr.estimatedCost : 0, taxRate: 18 }]);
  const gen = useGeneratePO({
    onSuccess: (po) => { showToast(`${po.poNumber} created from ${pr.prNumber}`, "success"); onClose(); },
    onError: (e) => showToast(e.message, "error")
  });
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const cleanItems = items
    .map((it) => ({ description: it.description.trim(), quantity: Number(it.quantity) || 0, rate: Number(it.rate) || 0, taxRate: Number(it.taxRate) || 0 }))
    .filter((it) => it.description && it.quantity > 0);
  const totals = computeTotals(cleanItems, interState);
  const valid = vendor.trim() && cleanItems.length > 0;

  const submit = (e) => {
    e.preventDefault();
    if (!valid) return;
    const match = suppliers.find((s) => s.name.toLowerCase() === vendor.trim().toLowerCase());
    gen.mutate({
      prId: pr.id, vendor: vendor.trim(), supplierId: match ? match.id : null, interState,
      billingAddress: billingAddress.trim() || null, shippingAddress: shippingAddress.trim() || null,
      terms: terms.trim() || null, items: cleanItems
    });
  };

  return (
    <div style={modalBackdrop} onClick={onClose} role="dialog" aria-modal="true" aria-label={`Generate PO from ${pr.prNumber}`}>
      <form className="table-card" style={{ maxWidth: 780, width: "100%", padding: "var(--sp-20)", maxHeight: "92vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong>Generate Purchase Order</strong>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cancel"><Icon d={ICONS.close} size={15} /></button>
        </div>
        <p className="page-caption" style={{ marginTop: 2, marginBottom: "var(--sp-14)" }}>From {pr.prNumber} · {pr.department} · {pr.category}</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--sp-12)" }}>
          <label className="pr-field">
            <span className="field-label">Final vendor *</span>
            <input className="input" list="po-suppliers" value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Pick a supplier or type a name" required />
            <datalist id="po-suppliers">{suppliers.map((s) => <option key={s.id} value={s.name} />)}</datalist>
          </label>
          <label className="pr-field">
            <span className="field-label">Billing address</span>
            <input className="input" value={billingAddress} onChange={(e) => setBilling(e.target.value)} />
          </label>
          <label className="pr-field">
            <span className="field-label">Shipping address</span>
            <input className="input" value={shippingAddress} onChange={(e) => setShipping(e.target.value)} />
          </label>
          <label className="pr-field" style={{ alignSelf: "end" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={interState} onChange={(e) => setInterState(e.target.checked)} />
              <span>Inter-state (IGST)</span>
            </span>
          </label>
        </div>

        <div className="field-label" style={{ marginTop: "var(--sp-16)", marginBottom: "var(--sp-6)" }}>Items</div>
        <ItemsEditor items={items} setItems={setItems} />
        <TotalsPanel totals={totals} />

        <label className="pr-field" style={{ display: "block", marginTop: "var(--sp-14)" }}>
          <span className="field-label">Terms &amp; conditions</span>
          <textarea className="input" rows={2} placeholder="Delivery / payment terms" value={terms} onChange={(e) => setTerms(e.target.value)} />
        </label>

        <div style={{ display: "flex", gap: "var(--sp-8)", justifyContent: "flex-end", marginTop: "var(--sp-14)" }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={!valid || gen.isPending}>{gen.isPending ? "Generating…" : "Generate PO"}</button>
        </div>
      </form>
    </div>
  );
}

/* ---------- attachments manager (on the detail view) ---------- */
function AttachmentsPanel({ po, canManage }) {
  const { showToast } = useToast();
  const up = useUploadPOAttachment(po.id, { onSuccess: () => showToast("Attachment added", "success"), onError: (e) => showToast(e.message, "error") });
  const del = useDeletePOAttachment({ onSuccess: () => showToast("Attachment removed", "success"), onError: (e) => showToast(e.message, "error") });
  const onFile = (e) => { const f = e.target.files && e.target.files[0]; if (f) up.mutate(f); e.target.value = ""; };
  const list = po.attachments || [];
  return (
    <div style={{ marginTop: "var(--sp-14)" }}>
      <div className="field-label">Attachments</div>
      {list.length === 0 ? <div className="cell-muted" style={{ marginTop: 4 }}>None yet.</div> : (
        <ul style={{ listStyle: "none", padding: 0, margin: "4px 0 0" }}>
          {list.map((a) => (
            <li key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
              <Icon d={ICONS.template} size={13} />
              <button type="button" onClick={() => api.download(`/purchase-orders/attachments/${a.id}`)}
                style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", textDecoration: "underline", padding: 0 }}>{a.filename}</button>
              <span className="cell-muted">{fmtBytes(a.size)}</span>
              {canManage ? <button type="button" className="icon-btn" onClick={() => del.mutate(a.id)} aria-label="Remove attachment"><Icon d={ICONS.close} size={12} /></button> : null}
            </li>
          ))}
        </ul>
      )}
      {canManage ? (
        <label className="btn btn-secondary btn-sm" style={{ marginTop: "var(--sp-8)", cursor: "pointer" }}>
          <Icon d={ICONS.upload} size={12} /> {up.isPending ? "Uploading…" : "Attach file"}
          <input type="file" hidden onChange={onFile} disabled={up.isPending} />
        </label>
      ) : null}
    </div>
  );
}

/* ---------- print-ready PO (opens a clean invoice + triggers print/save-as-PDF) ---------- */
function printPO(po) {
  const t = po.totals || {};
  const rows = (po.items || []).map((it, i) => `<tr>
    <td>${i + 1}</td><td>${esc(it.description)}</td>
    <td class="r">${it.quantity}</td><td class="r">${fmtMoney(it.rate)}</td>
    <td class="r">${it.taxRate}%</td><td class="r">${fmtMoney(it.amount)}</td></tr>`).join("");
  const taxRows = t.interState
    ? `<tr><td>IGST</td><td class="r">${fmtMoney(t.igst)}</td></tr>`
    : `<tr><td>CGST</td><td class="r">${fmtMoney(t.cgst)}</td></tr><tr><td>SGST</td><td class="r">${fmtMoney(t.sgst)}</td></tr>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(po.poNumber)}</title>
  <style>
    *{box-sizing:border-box} body{font:13px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;margin:32px;max-width:820px}
    .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f172a;padding-bottom:14px}
    .company{display:flex;gap:12px;align-items:center} .company img{height:46px}
    .company h1{font-size:18px;margin:0} .company .sub{color:#64748b;font-size:12px}
    .doc{text-align:right} .doc h2{margin:0;font-size:22px;letter-spacing:.5px} .doc .meta{color:#64748b;font-size:12px;margin-top:4px}
    .grid{display:flex;gap:32px;margin:18px 0} .grid > div{flex:1}
    .lbl{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#64748b;margin-bottom:3px}
    table{width:100%;border-collapse:collapse;margin-top:8px} th,td{padding:7px 8px;border-bottom:1px solid #e2e8f0;text-align:left}
    thead th{background:#f8fafc;font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:#475569}
    .r{text-align:right} .totals{width:300px;margin-left:auto;margin-top:10px} .totals td{border:none;padding:3px 8px}
    .totals .grand td{border-top:2px solid #0f172a;font-weight:700;font-size:15px;padding-top:8px}
    .terms{margin-top:22px} .terms .lbl{margin-bottom:5px} .terms .box{white-space:pre-wrap;border:1px solid #e2e8f0;border-radius:6px;padding:10px;min-height:48px}
    .foot{margin-top:30px;color:#94a3b8;font-size:11px;text-align:center;border-top:1px solid #e2e8f0;padding-top:10px}
    @media print{body{margin:0;padding:18px}}
  </style></head>
  <body onload="window.print()">
    <div class="head">
      <div class="company"><img src="${location.origin}/logo.png" alt="logo" onerror="this.style.display='none'">
        <div><h1>Task Source</h1><div class="sub">Task Source HQ, Main Office</div></div></div>
      <div class="doc"><h2>PURCHASE ORDER</h2><div class="meta">${esc(po.poNumber)}<br>Date: ${fmtDate(po.createdAt)}<br>Status: ${esc(po.status)}</div></div>
    </div>
    <div class="grid">
      <div><div class="lbl">Vendor</div>${esc(po.vendor)}<div class="lbl" style="margin-top:10px">From request</div>${esc(po.prNumber)} · ${esc(po.department)} / ${esc(po.category)}</div>
      <div><div class="lbl">Billing address</div>${esc(po.billingAddress) || "—"}<div class="lbl" style="margin-top:10px">Shipping address</div>${esc(po.shippingAddress) || "—"}</div>
    </div>
    <table><thead><tr><th>#</th><th>Item details</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Tax %</th><th class="r">Amount</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6" style="color:#94a3b8">No items</td></tr>'}</tbody></table>
    <table class="totals"><tbody>
      <tr><td>Subtotal</td><td class="r">${fmtMoney(t.subtotal || 0)}</td></tr>
      ${taxRows}
      <tr class="grand"><td>Grand Total</td><td class="r">${fmtMoney(t.grandTotal || 0)}</td></tr>
    </tbody></table>
    <div class="terms"><div class="lbl">Terms &amp; Conditions</div><div class="box">${esc(po.terms) || "—"}</div></div>
    <div class="foot">Generated by Task Source IT Asset Tracker</div>
  </body></html>`;
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}

/* ---------- detail / review modal ---------- */
function PODetailModal({ po: summary, canAdmin, canManage, onClose }) {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const { data: detail } = usePurchaseOrder(summary.id, true);
  const po = detail || summary;              // full detail when loaded, summary as fallback
  const loaded = !!detail;
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
  const download = () => { if (!loaded) return; if (!printPO(po)) showToast("Allow pop-ups to download the PO", "error"); };

  const statusActions =
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
    ) : null;

  return (
    <div style={modalBackdrop} onClick={onClose} role="dialog" aria-modal="true" aria-label={`Purchase order ${po.poNumber}`}>
      <div className="table-card" style={{ maxWidth: 760, width: "100%", padding: "var(--sp-20)", maxHeight: "92vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--sp-12)", marginBottom: "var(--sp-16)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-10)" }}>
            <span className="mono cell-tag" style={{ fontSize: "1.05rem" }}>{po.poNumber}</span>
            <POStatusPill status={po.status} />
          </div>
          <div style={{ display: "flex", gap: "var(--sp-8)", alignItems: "center" }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={download} disabled={!loaded}><Icon d={ICONS.download} size={13} /> Download PO</button>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon d={ICONS.close} size={16} /></button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--sp-12)" }}>
          <Field label="From PR">{po.prNumber}</Field>
          <Field label="Vendor">{po.vendor}</Field>
          <Field label="Department">{po.department ? <DeptBadge dept={po.department} /> : "—"}</Field>
          <Field label="Category">{po.category}</Field>
          <Field label="Created">{fmtDateTime(po.createdAt)}</Field>
          <Field label="Tax">{po.interState ? "Inter-state (IGST)" : "Intra-state (CGST+SGST)"}</Field>
          <Field label="Billing address">{po.billingAddress || "—"}</Field>
          <Field label="Shipping address">{po.shippingAddress || "—"}</Field>
        </div>

        <div className="field-label" style={{ marginTop: "var(--sp-16)", marginBottom: "var(--sp-6)" }}>Items</div>
        {!loaded ? <div className="cell-muted">Loading items…</div> : (
          <React.Fragment>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ minWidth: 520 }}>
                <thead><tr>
                  <th><span className="th-plain">Item details</span></th>
                  <th style={{ textAlign: "right" }}><span className="th-plain">Qty</span></th>
                  <th style={{ textAlign: "right" }}><span className="th-plain">Rate</span></th>
                  <th style={{ textAlign: "right" }}><span className="th-plain">Tax %</span></th>
                  <th style={{ textAlign: "right" }}><span className="th-plain">Amount</span></th>
                </tr></thead>
                <tbody>
                  {(po.items || []).map((it) => (
                    <tr key={it.id}>
                      <td>{it.description}</td>
                      <td className="mono" style={{ textAlign: "right" }}>{it.quantity}</td>
                      <td className="mono" style={{ textAlign: "right" }}>{fmtMoney(it.rate)}</td>
                      <td className="mono" style={{ textAlign: "right" }}>{it.taxRate}%</td>
                      <td className="mono" style={{ textAlign: "right" }}>{fmtMoney(it.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {po.totals ? <TotalsPanel totals={po.totals} /> : null}
          </React.Fragment>
        )}

        {po.terms ? (
          <div style={{ marginTop: "var(--sp-14)" }}>
            <div className="field-label">Terms &amp; Conditions</div>
            <div className="field-value" style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{po.terms}</div>
          </div>
        ) : null}

        {loaded ? <AttachmentsPanel po={po} canManage={canManage} /> : null}

        <div style={{ display: "flex", gap: "var(--sp-8)", justifyContent: "flex-end", marginTop: "var(--sp-20)", borderTop: "1px solid var(--border)", paddingTop: "var(--sp-14)" }}>
          {statusActions || <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>}
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
          <button type="button" key={o} className={"audit-chip" + (filter === o ? " audit-chip-on" : "")} onClick={() => setFilter(o)}>{o}</button>
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
                  <th><span className="th-plain">Grand total</span></th>
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
                    <td>{po.finalAmount != null ? <span className="mono">{fmtMoney(po.finalAmount)}</span> : <span className="cell-muted">—</span>}</td>
                    <td><POStatusPill status={po.status} /></td>
                    <td>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); setSelected(po); }}>
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

      {selected ? <PODetailModal po={selected} canAdmin={canAdmin} canManage={canManage} onClose={() => setSelected(null)} /> : null}
    </React.Fragment>
  );
}

export { PurchaseOrdersPage };

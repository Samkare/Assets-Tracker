// Task Source — Vendor Management (suppliers master: name, address, mobile, email, GSTIN)
import React, { useState, useEffect } from "react";
import { Icon, ICONS } from "./components.jsx";
import { useSuppliers, useCreateSupplier, useUpdateSupplier, useDeleteSupplier } from "./api/hooks.js";
import { SkeletonTable } from "./Skeleton.jsx";
import { useToast } from "./toasts.jsx";
import { useConfirm } from "./confirm.jsx";

const modalBackdrop = { position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 };

function VendorForm({ initial, onClose }) {
  const { showToast } = useToast();
  const editing = !!initial;
  const [form, setForm] = useState({
    name: initial?.name || "", address: initial?.address || "", phone: initial?.phone || "",
    email: initial?.email || "", gstNumber: (initial?.gstNumber ?? initial?.gst_number) || ""
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const done = (verb) => () => { showToast(`Vendor ${verb}`, "success"); onClose(); };
  const create = useCreateSupplier({ onSuccess: done("added"), onError: (e) => showToast(e.message, "error") });
  const update = useUpdateSupplier({ onSuccess: done("updated"), onError: (e) => showToast(e.message, "error") });
  const busy = create.isPending || update.isPending;

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim(), address: form.address.trim(), phone: form.phone.trim(),
      email: form.email.trim(), gstNumber: form.gstNumber.trim().toUpperCase()
    };
    if (editing) update.mutate({ id: initial.id, input: payload });
    else create.mutate(payload);
  };

  return (
    <div style={modalBackdrop} onClick={onClose} role="dialog" aria-modal="true" aria-label={editing ? "Edit vendor" : "Add vendor"}>
      <form className="table-card" style={{ maxWidth: 560, width: "100%", padding: "var(--sp-20)", maxHeight: "92vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-14)" }}>
          <strong>{editing ? "Edit Vendor" : "Add Vendor"}</strong>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cancel"><Icon d={ICONS.close} size={15} /></button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--sp-12)" }}>
          <label className="pr-field" style={{ gridColumn: "1 / -1" }}>
            <span className="field-label">Vendor name *</span>
            <input className="input" value={form.name} onChange={set("name")} placeholder="e.g. Dell India Pvt Ltd" required />
          </label>
          <label className="pr-field" style={{ gridColumn: "1 / -1" }}>
            <span className="field-label">Full address</span>
            <textarea className="input" rows={2} value={form.address} onChange={set("address")} placeholder="Street, city, state, PIN" />
          </label>
          <label className="pr-field">
            <span className="field-label">Mobile number</span>
            <input className="input" value={form.phone} onChange={set("phone")} placeholder="10-digit mobile" />
          </label>
          <label className="pr-field">
            <span className="field-label">Email address</span>
            <input className="input" type="email" value={form.email} onChange={set("email")} placeholder="sales@vendor.com" />
          </label>
          <label className="pr-field" style={{ gridColumn: "1 / -1" }}>
            <span className="field-label">GST number (GSTIN)</span>
            <input className="input" value={form.gstNumber} onChange={set("gstNumber")} placeholder="15-character GSTIN" maxLength={15} style={{ textTransform: "uppercase" }} />
          </label>
        </div>
        <div style={{ display: "flex", gap: "var(--sp-8)", justifyContent: "flex-end", marginTop: "var(--sp-14)" }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={!form.name.trim() || busy}>
            {busy ? "Saving…" : editing ? "Save changes" : "Add vendor"}
          </button>
        </div>
      </form>
    </div>
  );
}

function VendorsPage({ canManage, canAdmin }) {
  const { data: rows = [], isLoading } = useSuppliers();
  const [formFor, setFormFor] = useState(null); // { } for new, {vendor} for edit
  const { showToast } = useToast();
  const confirm = useConfirm();
  const del = useDeleteSupplier({ onSuccess: () => showToast("Vendor removed", "success"), onError: (e) => showToast(e.message, "error") });

  const remove = async (v) => {
    const ok = await confirm({ title: `Delete ${v.name}?`, body: "The vendor will be removed from the list.", confirmLabel: "Delete" });
    if (ok) del.mutate(v.id);
  };

  return (
    <React.Fragment>
      <div className="page-head">
        <h1 className="page-title">Vendor Management</h1>
        <p className="page-caption">Suppliers used across procurement &amp; inventory</p>
      </div>

      <div className="audit-filters">
        <span className="audit-count">{rows.length} {rows.length === 1 ? "vendor" : "vendors"}</span>
        {canManage ? (
          <button type="button" className="table-add-btn" style={{ marginLeft: "auto" }} onClick={() => setFormFor({})}>
            <Icon d={ICONS.plus} size={13} /> Add Vendor
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="table-card"><div style={{ padding: "var(--sp-16)" }}><SkeletonTable rows={5} cols={5} /></div></div>
      ) : rows.length === 0 ? (
        <div className="table-card">
          <div className="empty-state">
            <div className="empty-icon"><Icon d={ICONS.vendor} size={20} /></div>
            <div className="empty-title">No vendors yet</div>
            <div className="empty-sub">{canManage ? "Click “Add Vendor” to create one." : "Vendors added by the IT team will show here."}</div>
          </div>
        </div>
      ) : (
        <div className="table-card">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th><span className="th-plain">Vendor</span></th>
                  <th><span className="th-plain">Address</span></th>
                  <th><span className="th-plain">Mobile</span></th>
                  <th><span className="th-plain">Email</span></th>
                  <th><span className="th-plain">GSTIN</span></th>
                  {canManage ? <th><span className="th-plain">Actions</span></th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => (
                  <tr key={v.id}>
                    <td><strong>{v.name}</strong></td>
                    <td style={{ maxWidth: 220, whiteSpace: "normal" }}>{v.address || <span className="cell-muted">—</span>}</td>
                    <td>{v.phone || <span className="cell-muted">—</span>}</td>
                    <td>{v.email || <span className="cell-muted">—</span>}</td>
                    <td><span className="mono">{(v.gstNumber ?? v.gst_number) || <span className="cell-muted">—</span>}</span></td>
                    {canManage ? (
                      <td>
                        <div style={{ display: "flex", gap: "var(--sp-6)" }}>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFormFor({ vendor: v })}>Edit</button>
                          {canAdmin ? <button type="button" className="btn btn-secondary btn-sm" disabled={del.isPending} onClick={() => remove(v)}>Delete</button> : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {formFor ? <VendorForm initial={formFor.vendor} onClose={() => setFormFor(null)} /> : null}
    </React.Fragment>
  );
}

export { VendorsPage };

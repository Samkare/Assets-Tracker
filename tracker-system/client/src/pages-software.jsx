// Task Source — Software page (licenses & seats)
import React, { useState, useEffect, useRef } from "react";
import { Icon, ICONS } from "./components.jsx";
import { api } from "./api/client.js";
import { useConfirm } from "./confirm.jsx";
import {
  useSoftware, useCreateSoftware, useDeleteSoftware,
  useAssignSoftware, useUnassignSoftware,
} from "./api/hooks.js";

function daysUntil(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return Math.round((d - new Date()) / 86400000);
}
function RenewalBadge({ iso }) {
  const dleft = daysUntil(iso);
  if (dleft == null) return null;
  if (dleft < 0) return <span className="sw-badge sw-badge-danger" title="Renewal overdue">Expired</span>;
  if (dleft <= 60) return <span className="sw-badge sw-badge-warn" title={`Renews in ${dleft} days`}>{dleft} days</span>;
  return null;
}
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ---------- add license modal ---------- */
function AddLicenseModal({ open, onClose, onSubmit, isPending }) {
  const blank = { name: "", vendor: "", seatsTotal: "", cost: "", renewalDate: "", licenseKey: "" };
  const [form, setForm] = useState(blank);
  const formRef = useRef(null);
  useEffect(() => {
    if (open) {
      setForm(blank);
      setTimeout(() => { const el = formRef.current && formRef.current.querySelector("input"); el && el.focus(); }, 60);
    }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = (e) => { e.preventDefault(); if (!form.name.trim()) return; onSubmit(form); };
  return (
    <div className="modal-root">
      <div className="modal-scrim" onClick={onClose}></div>
      <form className="modal" onSubmit={submit} ref={formRef}>
        <div className="modal-head">
          <div>
            <div className="modal-title">Add license</div>
            <div className="modal-subtitle">Register a software license and its seats.</div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close form">
            <Icon d={ICONS.close} size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div className="form-section">
            <div className="form-cols">
              <label className="form-row">
                <span className="form-label">Name</span>
                <input className="input" placeholder="e.g. Adobe CC" value={form.name} onChange={set("name")} />
              </label>
              <label className="form-row">
                <span className="form-label">Vendor</span>
                <input className="input" placeholder="e.g. Adobe" value={form.vendor} onChange={set("vendor")} />
              </label>
            </div>
            <div className="form-cols-3">
              <label className="form-row">
                <span className="form-label">Seats</span>
                <input className="input" type="number" placeholder="5" value={form.seatsTotal} onChange={set("seatsTotal")} />
              </label>
              <label className="form-row">
                <span className="form-label">Cost</span>
                <input className="input" type="number" placeholder="0" value={form.cost} onChange={set("cost")} />
              </label>
              <label className="form-row">
                <span className="form-label">Renewal date</span>
                <input className="input" type="date" value={form.renewalDate} onChange={set("renewalDate")} />
              </label>
            </div>
            <label className="form-row">
              <span className="form-label">License key</span>
              <input className="input mono" placeholder="Optional" value={form.licenseKey} onChange={set("licenseKey")} autoComplete="off" />
            </label>
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={isPending || !form.name.trim()}>Add license</button>
        </div>
      </form>
    </div>
  );
}

/* ---------- single license card ---------- */
function SoftwareCard({ sw, canManage }) {
  const [assignName, setAssignName] = useState("");
  const confirm = useConfirm();
  const assign = useAssignSoftware({ onSuccess: () => setAssignName("") });
  const unassign = useUnassignSoftware();
  const del = useDeleteSoftware();
  const onDelete = async () => {
    if (await confirm({ title: `Delete ${sw.name}?`, body: "This license and its seat assignments will be permanently removed.", confirmLabel: "Delete" })) del.mutate(sw.id);
  };

  const total = sw.seats_total || 0;
  const used = sw.seatsUsed || 0;
  const pct = total ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const full = total > 0 && used >= total;
  const expired = sw.status === "expired";
  const assignments = sw.assignments || [];

  const doAssign = (e) => {
    e.preventDefault();
    if (!assignName.trim()) return;
    assign.mutate({ id: sw.id, input: { employeeName: assignName.trim() } });
  };

  return (
    <div className="sw-card lift-card">
      <div className="sw-card-head">
        <div>
          <div className="sw-card-name">{sw.name}</div>
          {sw.vendor ? <div className="sw-card-vendor">{sw.vendor}</div> : null}
        </div>
        <span className={"sw-status" + (expired ? " sw-status-expired" : "")}
          style={{ color: expired ? "var(--danger)" : "var(--success)" }}>
          {expired ? "Expired" : "Active"}
        </span>
      </div>

      <div className="sw-seats">
        <div className="sw-seats-top">
          <span className="sw-seats-label">Seats</span>
          <span className="sw-seats-val">{used} / {total || "∞"}</span>
        </div>
        <div className="sw-seats-track">
          <div className="sw-seats-fill" style={{ width: pct + "%", background: full ? "var(--danger)" : "var(--accent)" }}></div>
        </div>
      </div>

      <div className="sw-meta">
        <span className="sw-meta-item">Renews {fmtDate(sw.renewal_date)} <RenewalBadge iso={sw.renewal_date} /></span>
        {sw.cost != null && sw.cost !== "" ? <span className="sw-meta-item mono">${Number(sw.cost).toLocaleString()}</span> : null}
      </div>

      {assignments.length ? (
        <div className="sw-assignments">
          {assignments.map((as) => (
            <div className="sw-assign-row" key={as.id}>
              <span className="sw-assign-name">{as.employee_name || as.asset_id || "—"}</span>
              {canManage ? (
                <button type="button" className="icon-btn" aria-label="Unassign" disabled={unassign.isPending}
                  onClick={() => unassign.mutate({ id: sw.id, aid: as.id })}>
                  <Icon d={ICONS.close} size={13} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {canManage ? (
        <div className="sw-card-foot">
          <form className="sw-assign-form" onSubmit={doAssign}>
            <input className="input" placeholder={full ? "All seats in use" : "Assign to employee…"} value={assignName}
              onChange={(e) => setAssignName(e.target.value)} disabled={full} aria-label="Assign license to employee" />
            <button type="submit" className="btn btn-primary btn-sm" disabled={assign.isPending || !assignName.trim() || full}>
              Assign
            </button>
          </form>
          <div className="sw-card-actions">
            <button type="button" className="btn btn-ghost-danger btn-sm" disabled={del.isPending}
              onClick={onDelete}>Delete license</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SoftwarePage({ canManage }) {
  const { data: software = [], isLoading } = useSoftware();
  const [addOpen, setAddOpen] = useState(false);
  const create = useCreateSoftware({ onSuccess: () => setAddOpen(false) });

  const submitNew = (form) => {
    create.mutate({
      name: form.name.trim(),
      vendor: form.vendor.trim() || null,
      seatsTotal: form.seatsTotal !== "" ? Number(form.seatsTotal) : null,
      cost: form.cost !== "" ? Number(form.cost) : null,
      renewalDate: form.renewalDate || null,
      licenseKey: form.licenseKey.trim() || null,
    });
  };

  return (
    <React.Fragment>
      <div className="page-head">
        <h1 className="page-title">Software</h1>
        <p className="page-caption">Licenses &amp; seats</p>
        <div className="page-head-actions">
          {software.length ? (
            <button type="button" className="btn btn-secondary" onClick={() => api.download("/export/software.xlsx")} title="Export to Excel">
              <Icon d={ICONS.download || ICONS.assets} size={14} /> Export
            </button>
          ) : null}
          {canManage ? (
            <button type="button" className="btn btn-primary" onClick={() => setAddOpen(true)}>
              <Icon d={ICONS.plus} size={14} /> Add license
            </button>
          ) : null}
        </div>
      </div>

      {software.length === 0 ? (
        <div className="table-card">
          <div className="empty-state">
            <div className="empty-icon"><Icon d={ICONS.diamond} size={20} /></div>
            <div className="empty-title">{isLoading ? "Loading licenses…" : "No software licenses yet"}</div>
            {!isLoading ? <div className="empty-sub" style={{ marginTop: "var(--sp-6)" }}>Track a vendor license to count seats and watch renewals.</div> : null}
            <div className="empty-sub">{canManage ? "Add a license to get started." : "Nothing on record yet."}</div>
          </div>
        </div>
      ) : (
        <div className="sw-grid">
          {software.map((sw) => <SoftwareCard key={sw.id} sw={sw} canManage={canManage} />)}
        </div>
      )}

      <AddLicenseModal open={addOpen} onClose={() => setAddOpen(false)} onSubmit={submitNew} isPending={create.isPending} />
    </React.Fragment>
  );
}

export { SoftwarePage };

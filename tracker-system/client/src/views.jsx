// Task Source — table, drawer, modal, page views
import React, { useState, useEffect, useRef } from "react";
import { Icon, ICONS, typeIcon, Avatar, DeptBadge, PERIPHERALS, PeriphChips, MonitorCell, Field } from "./components.jsx";
import { useAssetHistory, useRepairs, useOpenRepair, useTemplates, usePeripherals,
  useInventory, useAssignedItems, useAssignItem, useUnassignItem } from "./api/hooks.js";
import { useFocusTrap } from "./useFocusTrap.js";
import { useToast } from "./toasts.jsx";

function fmtHistTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
const HIST_ICON = { audit: ICONS.edit, custody: ICONS.employees, repair: ICONS.wrench };
const REPAIR_STATUS = {
  open: { label: "Open", color: "var(--warn)" },
  in_progress: { label: "In progress", color: "var(--accent)" },
  resolved: { label: "Resolved", color: "var(--success)" },
  closed: { label: "Closed", color: "var(--success)" },
};
function StatusPill({ status }) {
  const label = (REPAIR_STATUS[status] && REPAIR_STATUS[status].label) || status;
  return <span className="status-pill" data-s={status}>{label}</span>;
}
const muted = <span className="cell-muted">—</span>;


/* ---------- drawer tabs: history timeline ---------- */
function HistoryTab({ a }) {
  const { data: hist = [], isLoading } = useAssetHistory(a.id);
  if (isLoading) return <div className="drawer-section"><div className="cell-muted">Loading history…</div></div>;
  if (!hist.length) return <div className="drawer-section"><div className="cell-muted">No history recorded yet.</div></div>;
  return (
    <div className="drawer-section">
      <div className="drawer-section-title">Timeline</div>
      <div className="drawer-timeline">
        {hist.map((e, i) => (
          <div className="drawer-tl-row" key={(e.at || "") + "-" + i}>
            <div className="drawer-tl-ico"><Icon d={HIST_ICON[e.kind] || ICONS.history} size={13} /></div>
            <div className="drawer-tl-body">
              <div className="drawer-tl-line">
                <span className="drawer-tl-kind">{e.action || e.status || e.kind}</span>
                {e.actor ? <span className="cell-muted"> · {e.actor}</span> : null}
              </div>
              {(e.detail || e.issue || e.note || e.resolution) ? (
                <div className="drawer-tl-detail">{e.detail || e.issue || e.note || e.resolution}</div>
              ) : null}
              <div className="drawer-tl-time">{fmtHistTime(e.at)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- drawer tabs: repairs ---------- */
function RepairsTab({ a, canManage }) {
  const { data: reps = [], isLoading } = useRepairs({ assetId: a.id });
  const [issue, setIssue] = useState("");
  const openRepair = useOpenRepair({ onSuccess: () => setIssue("") });
  const submit = (e) => {
    e.preventDefault();
    if (!issue.trim()) return;
    openRepair.mutate({ assetId: a.id, issue: issue.trim() });
  };
  return (
    <div className="drawer-section">
      <div className="drawer-section-title">Repair tickets</div>
      {reps.length ? (
        <div className="repair-list">
          {reps.map((r) => (
            <div className="repair-item" key={r.id}>
              <div className="repair-item-head">
                <span className="repair-item-issue">{r.issue}</span>
                <StatusPill status={r.status} />
              </div>
              <div className="repair-item-meta">
                <span>{r.assignee || <span className="cell-muted">Unassigned</span>}</span>
                {r.cost != null && r.cost !== "" ? <span className="dot-sep">·</span> : null}
                {r.cost != null && r.cost !== "" ? <span className="mono">${r.cost}</span> : null}
              </div>
              {r.resolution ? <div className="repair-item-res">{r.resolution}</div> : null}
            </div>
          ))}
        </div>
      ) : (
        !isLoading ? <div className="cell-muted">No repair tickets for this asset.</div> : null
      )}
      {canManage ? (
        <form className="repair-open-form" onSubmit={submit}>
          <input className="input" placeholder="Describe the issue…" value={issue}
            onChange={(e) => setIssue(e.target.value)} />
          <button type="submit" className="btn btn-primary" disabled={openRepair.isPending || !issue.trim()}>
            Open repair
          </button>
        </form>
      ) : null}
    </div>
  );
}

const DRAWER_TABS = [
  { key: "Specs", label: "Specs" },
  { key: "Assignment", label: "Asset Assignment" },
  { key: "History", label: "History" },
  { key: "Repairs", label: "Repairs" },
];

/* ---------- drawer tabs: asset assignment (live-stock issue / return) ---------- */
// 3-option return flow, mirroring the machine-level RemoveAssetModal. Keys line up with the
// backend `destination` values AND the .allocate-option-<key> styling already in the CSS.
const RETURN_DESTINATIONS = [
  { key: "stock",  icon: ICONS.assets, title: "Return to Stock", body: "Puts the unit back into available stock." },
  { key: "repair", icon: ICONS.wrench, title: "Send to Repair", body: "Removes it from sellable stock, flagged defective." },
  { key: "retire", icon: ICONS.logout, title: "Retire", body: "Writes the unit off — not returned to stock." },
];
const RETURN_MSG = { stock: "returned to stock", repair: "sent for repair", retire: "retired" };

// The Minus (−) popup. Rendered nested inside the drawer, so Escape is handled in the capture
// phase to close only this modal — otherwise the drawer's own Escape listener would fire too.
function UnassignItemModal({ item, assetLabel, onClose, onConfirm, isPending = false }) {
  const [choice, setChoice] = useState("stock");
  const [reason, setReason] = useState("");
  const dialogRef = useRef(null);
  useFocusTrap(dialogRef, !!item);
  useEffect(() => {
    if (!item) return;
    setChoice("stock");
    setReason("");
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); if (!isPending) onClose(); } };
    document.addEventListener("keydown", onKey, true); // capture: run before the drawer's listener
    return () => document.removeEventListener("keydown", onKey, true);
  }, [item]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!item) return null;
  const active = RETURN_DESTINATIONS.find((d) => d.key === choice);
  return (
    <div className="modal-root" role="dialog" aria-modal="true" aria-label={`Return ${item.name}`}>
      <div className="modal-scrim" onClick={() => !isPending && onClose()} />
      <div className="modal confirm-modal allocate-modal" ref={dialogRef}>
        <div className="confirm-head">
          <span className="confirm-ico"><Icon d={ICONS.logout} size={18} /></span>
          <h2 className="modal-title">Return {item.name}{assetLabel ? ` from ${assetLabel}` : ""}?</h2>
        </div>
        <p className="confirm-body">Choose where this unit goes. Only “Return to Stock” adds it back to available stock.</p>
        <div className="allocate-options" role="radiogroup" aria-label="Destination">
          {RETURN_DESTINATIONS.map((d) => (
            <button type="button" key={d.key} role="radio" aria-checked={choice === d.key}
              className={"allocate-option allocate-option-" + d.key + (choice === d.key ? " allocate-option-on" : "")}
              onClick={() => setChoice(d.key)} disabled={isPending}>
              <span className="allocate-option-ico"><Icon d={d.icon} size={16} /></span>
              <span className="allocate-option-text">
                <span className="allocate-option-title">{d.title}</span>
                <span className="allocate-option-body">{d.body}</span>
              </span>
            </button>
          ))}
        </div>
        <label className="allocate-reason-label">
          Note <span className="cell-muted">(optional)</span>
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. cracked casing, replaced under warranty…" disabled={isPending} />
        </label>
        <div className="confirm-foot">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isPending}>Cancel</button>
          <button type="button" className={"btn " + (choice === "retire" ? "btn-ghost-danger confirm-danger-btn" : "btn-primary")}
            onClick={() => onConfirm(choice, reason.trim())} disabled={isPending}>
            {isPending ? "Working…" : active.title}
          </button>
        </div>
      </div>
    </div>
  );
}

function AssetAssignmentTab({ a, canManage }) {
  const { showToast } = useToast();
  const { data: assigned = [], isLoading } = useAssignedItems(a.id);
  const { data: stock = [] } = useInventory({}, canManage);
  const [pick, setPick] = useState("");
  const [returning, setReturning] = useState(null); // the held-item row being returned
  const retired = a.status === "retired";

  const assignM = useAssignItem({
    onSuccess: (r) => { setPick(""); showToast(`Assigned ${r?.item?.name || "item"} to ${a.shared ? "shared PC" : a.pseudo}`, "success"); },
    onError: (e) => showToast(e.message || "Couldn’t assign item", "error"),
  });
  const unassignM = useUnassignItem({
    onSuccess: (r) => { setReturning(null); showToast(`${r?.item?.name || "Item"} ${RETURN_MSG[r?.destination] || "returned"}`, "success"); },
    onError: (e) => showToast(e.message || "Couldn’t return item", "error"),
  });

  const options = (stock || []).filter((s) => (s.qty || 0) > 0); // live, in-stock items only
  const doAssign = () => { if (pick) assignM.mutate({ id: a.id, itemId: Number(pick) }); };
  const confirmReturn = (destination, reason) =>
    unassignM.mutate({ id: a.id, itemId: returning.itemId, destination, reason });

  return (
    <div className="drawer-section">
      {retired ? <div className="assign-note">This asset is retired — restore it before assigning stock items.</div> : null}

      {canManage && !retired ? (
        <div className="assign-pick">
          <div className="drawer-section-title">Assign from stock</div>
          <div className="assign-pick-row">
            <select className="input" value={pick} onChange={(e) => setPick(e.target.value)}
              disabled={assignM.isPending || options.length === 0} aria-label="Stock item to assign">
              <option value="">{options.length ? "Select a stock item…" : "No stock available"}</option>
              {options.map((s) => (
                <option key={s.id} value={s.id}>{s.name} · {s.qty} in stock{s.low ? " (low)" : ""}</option>
              ))}
            </select>
            <button type="button" className="btn btn-primary assign-plus" onClick={doAssign}
              disabled={!pick || assignM.isPending} aria-label="Assign selected item">
              <Icon d={ICONS.plus} size={14} /> Assign
            </button>
          </div>
        </div>
      ) : null}

      <div className="drawer-section-title assign-held-title">Assigned items</div>
      {isLoading ? <div className="cell-muted">Loading…</div>
        : assigned.length === 0 ? <div className="cell-muted">No stock items assigned to {a.shared ? "this PC" : a.pseudo} yet.</div>
        : (
          <div className="assign-list">
            {assigned.map((it) => (
              <div className="assign-row" key={it.itemId}>
                <span className="assign-row-ico"><Icon d={ICONS.assets} size={15} /></span>
                <span className="assign-row-name">{it.name}</span>
                <span className="assign-row-qty">{it.held}{it.unit ? " " + it.unit : ""}</span>
                {canManage ? (
                  <button type="button" className="btn btn-ghost-danger btn-sm assign-minus"
                    onClick={() => setReturning(it)} disabled={unassignM.isPending}
                    aria-label={`Return ${it.name}`}>
                    <Icon d={ICONS.minus} size={14} /> Return
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}

      <UnassignItemModal item={returning} assetLabel={a.shared ? null : a.pseudo}
        onClose={() => setReturning(null)} onConfirm={confirmReturn} isPending={unassignM.isPending} />
    </div>
  );
}

/* ---------- detail popup ---------- */
function DetailDrawer({ asset, onClose, onEdit, onRemove, canManage = false, isPending = false }) {
  const [tab, setTab] = useState("Specs");
  const dialogRef = useRef(null);
  const { data: customPeriphs = [] } = usePeripherals(!!asset);
  useFocusTrap(dialogRef, !!asset);
  // Reset to Specs only when a DIFFERENT asset is opened — keying on identity would also fire on
  // background refetches (e.g. after assigning stock invalidates ["assets"]), bouncing the operator
  // off whichever tab they're on. Keying on the id keeps them put across those refetches.
  useEffect(() => { if (asset) setTab("Specs"); }, [asset?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!asset) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [asset, onClose]);
  if (!asset) return null;
  const a = asset;
  const titleId = "drawer-title-" + a.id;
  return (
    <div className="modal-root">
      <div className="modal-scrim" onClick={onClose}></div>
      <div className="modal modal-detail" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={dialogRef}>
        <div className="modal-head">
          <div className="detail-head">
            <Avatar name={a.pseudo} shared={a.shared} size={44} />
            <div>
              <div className="modal-title" id={titleId}>{a.pseudo}{a.fullName ? <span className="detail-fullname"> · {a.fullName}</span> : null}</div>
              <div className="modal-subtitle"><span className="mono">{a.id}</span> · {a.type}</div>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close details">
            <Icon d={ICONS.close} size={16} />
          </button>
        </div>

        <div className="drawer-tabs" role="tablist" aria-label="Asset details">
          {DRAWER_TABS.map((t) => (
            <button type="button" key={t.key} role="tab" aria-selected={tab === t.key}
              className={"drawer-tab" + (tab === t.key ? " drawer-tab-on" : "")}
              onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>

        <div className="modal-body detail-body">
          {tab === "Specs" ? (
          <React.Fragment>
          <div className="drawer-tags">
            <DeptBadge dept={a.dept} />
            {a.shared ? <span className="shared-tag">Shared · day shift</span> : null}
          </div>

          <div className="detail-cols">
            <div className="drawer-section">
              <div className="drawer-section-title">Machine</div>
              <div className="field-grid">
                <Field label="Asset tag"><span className="mono asset-tag-val">{a.id}</span></Field>
                <Field label="Full name">{a.fullName || <span className="cell-muted">—</span>}</Field>
                <Field label="Type">{a.type}</Field>
                <Field label="CPU">{a.cpu || <span className="cell-muted">Not recorded</span>}</Field>
                <Field label="RAM">{a.ram || <span className="cell-muted">—</span>}</Field>
                <Field label="Storage">{a.hdd || <span className="cell-muted">—</span>}</Field>
                <Field label="Monitors"><MonitorCell value={a.monitors} /></Field>
                {a.returnDue ? <Field label="Return due"><span className={"mono" + (a.returnDue < new Date().toISOString().slice(0, 10) ? " cell-danger" : "")}>{a.returnDue}</span></Field> : null}
              </div>
            </div>

            <div className="drawer-section drawer-section-serials">
              <div className="drawer-section-title">Monitor serials</div>
              <div className="field-grid">
                <Field label="Monitor 1">{a.mon1 ? <span className="mono">{a.mon1}</span> : <span className="cell-muted">—</span>}</Field>
                <Field label="Monitor 2">{a.mon2 ? <span className="mono">{a.mon2}</span> : <span className="cell-muted">—</span>}</Field>
              </div>
            </div>
          </div>

          <div className="drawer-section">
            <div className="drawer-section-title">Peripheral checklist</div>
            <div className="checklist checklist-grid">
              {PERIPHERALS.map((p) => (
                <div key={p.key} className={"check-row" + (a[p.key] ? " check-yes" : " check-no")}>
                  <span className="check-ico"><Icon d={p.icon} size={15} /></span>
                  <span className="check-label">{p.label}</span>
                  <span className="check-state">
                    {a[p.key] ? <><Icon d={ICONS.check} size={14} /> Yes</> : "No"}
                  </span>
                </div>
              ))}
              {customPeriphs.map((p) => {
                const has = (a.customPeripherals || []).includes(p.key);
                return (
                  <div key={"c-" + p.key} className={"check-row" + (has ? " check-yes" : " check-no")}>
                    <span className="check-ico"><Icon d={ICONS.plus} size={15} /></span>
                    <span className="check-label">{p.label}</span>
                    <span className="check-state">{has ? <><Icon d={ICONS.check} size={14} /> Yes</> : "No"}</span>
                  </div>
                );
              })}
            </div>
          </div>
          </React.Fragment>
          ) : null}

          {tab === "Assignment" ? <AssetAssignmentTab a={a} canManage={canManage} /> : null}
          {tab === "History" ? <HistoryTab a={a} /> : null}
          {tab === "Repairs" ? <RepairsTab a={a} canManage={canManage} /> : null}
        </div>

        <div className="modal-foot detail-foot">
          <button type="button" className="btn btn-ghost-danger" disabled={isPending} onClick={() => onRemove(a)}>
            {isPending ? "Working…" : "Remove"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => onEdit(a)} disabled={isPending}>
            <Icon d={ICONS.edit} size={14} /> Edit details
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- remove-asset destination popup: repair / spare stock / retire ---------- */
const REMOVE_DESTINATIONS = [
  { key: "repair", icon: ICONS.wrench, title: "Send to Repair", body: "Opens a repair ticket and frees it up." },
  { key: "stock", icon: ICONS.assets, title: "Return to Spare Stock", body: "Marks it available to issue to someone else." },
  { key: "retire", icon: ICONS.logout, title: "Retire completely", body: "Archives the record. Kept in history — can be restored later." }
];

function RemoveAssetModal({ asset, onClose, onSendRepair, onReturnStock, onRetire, isPending = false }) {
  const [choice, setChoice] = useState("repair");
  const [reason, setReason] = useState("");
  const dialogRef = useRef(null);
  useFocusTrap(dialogRef, !!asset);
  useEffect(() => {
    if (!asset) return;
    setChoice("repair");
    setReason("");
    const onKey = (e) => { if (e.key === "Escape" && !isPending) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [asset]);
  if (!asset) return null;
  const a = asset;
  const needsReason = choice === "repair";
  const canSubmit = !isPending && (!needsReason || reason.trim());
  const submit = () => {
    if (!canSubmit) return;
    if (choice === "repair") onSendRepair(reason.trim());
    else if (choice === "stock") onReturnStock();
    else onRetire();
  };
  const active = REMOVE_DESTINATIONS.find((d) => d.key === choice);
  return (
    <div className="modal-root" role="dialog" aria-modal="true" aria-label={`Remove ${a.id}`}>
      <div className="modal-scrim" onClick={() => !isPending && onClose()} />
      <div className="modal confirm-modal allocate-modal" ref={dialogRef}>
        <div className="confirm-head">
          <span className="confirm-ico"><Icon d={ICONS.logout} size={18} /></span>
          <h2 className="modal-title">Remove {a.id}{!a.shared ? ` from ${a.pseudo}` : ""}?</h2>
        </div>
        <p className="confirm-body">Choose where this asset goes next.</p>
        <div className="allocate-options" role="radiogroup" aria-label="Destination">
          {REMOVE_DESTINATIONS.map((d) => (
            <button type="button" key={d.key} role="radio" aria-checked={choice === d.key}
              className={"allocate-option allocate-option-" + d.key + (choice === d.key ? " allocate-option-on" : "")}
              onClick={() => setChoice(d.key)} disabled={isPending}>
              <span className="allocate-option-ico"><Icon d={d.icon} size={16} /></span>
              <span className="allocate-option-text">
                <span className="allocate-option-title">{d.title}</span>
                <span className="allocate-option-body">{d.body}</span>
              </span>
            </button>
          ))}
        </div>
        {needsReason ? (
          <label className="allocate-reason-label">
            What's wrong?
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Screen flickering, won't boot…" disabled={isPending} autoFocus />
          </label>
        ) : null}
        <div className="confirm-foot">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isPending}>Cancel</button>
          <button type="button" className={"btn " + (choice === "retire" ? "btn-ghost-danger confirm-danger-btn" : "btn-primary")}
            onClick={submit} disabled={!canSubmit}>
            {isPending ? "Working…" : active.title}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- assign / add / edit modal ---------- */
const MODAL_COPY = {
  assign: { t: "Assign asset", s: "Register a machine to an employee.", b: "Assign asset" },
  addEmployee: { t: "Add employee", s: "Start with the person, then their assigned machine.", b: "Add employee" },
  addAsset: { t: "Add asset", s: "Start with the hardware, then who it’s assigned to.", b: "Add asset" },
  edit: { t: "Edit details", s: "Update this record.", b: "Save changes" },
};
// compact last-few-changes panel shown inside the edit modal
function RecentChanges({ assetId, open }) {
  const { data = [], isLoading } = useAssetHistory(assetId, open && !!assetId);
  if (!assetId) return null;
  const rows = data.slice(0, 4);
  return (
    <div className="recent-changes">
      <div className="recent-changes-title">
        <Icon d={ICONS.history} size={13} /> Recent changes to <span className="mono">{assetId}</span>
      </div>
      {isLoading ? <span className="cell-muted">Loading…</span> :
        rows.length === 0 ? <span className="cell-muted">No earlier changes recorded.</span> : (
          <ul className="recent-changes-list">
            {rows.map((e, i) => (
              <li key={i} className="recent-changes-row">
                <span className="recent-changes-ico"><Icon d={HIST_ICON[e.kind] || ICONS.edit} size={12} /></span>
                <span className="recent-changes-text">{e.detail || e.issue || e.resolution || e.action || e.status || "change"}</span>
                <span className="recent-changes-meta">{e.actor || ""} · {fmtHistTime(e.at)}</span>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}

function AssignModal({ open, mode = "assign", initial, onClose, onSubmit, departments, types, assets = [], isPending = false }) {
  const blank = {
    pseudo: "", fullName: "", dept: departments[0], type: "Desktop", id: "",
    cpu: "", ram: "", hdd: "", mon1: "", mon2: "",
    headphone: false, speaker: false, ipPhone: false, webcam: false, mobileStand: false,
    keyboard: false, mouse: false,
    returnDue: "",
    customPeripherals: [],
  };
  const [form, setForm] = useState(blank);
  const [touched, setTouched] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const formRef = useRef(null);
  useFocusTrap(formRef, open);
  useEffect(() => {
    if (open) {
      if (initial) {
        setForm({
          pseudo: initial.pseudo, fullName: initial.fullName || "", dept: initial.dept, type: initial.type, id: initial.id,
          cpu: initial.cpu || "", ram: initial.ram || "", hdd: initial.hdd || "",
          mon1: initial.mon1 || "", mon2: initial.mon2 || "",
          headphone: !!initial.headphone, speaker: !!initial.speaker, ipPhone: !!initial.ipPhone,
          webcam: !!initial.webcam, mobileStand: !!initial.mobileStand,
          keyboard: !!initial.keyboard, mouse: !!initial.mouse,
          returnDue: initial.returnDue || "",
          customPeripherals: Array.isArray(initial.customPeripherals) ? initial.customPeripherals : [],
        });
      } else { setForm(blank); }
      setTouched(false); setNameOpen(false);
      setTimeout(() => { const el = formRef.current && formRef.current.querySelector("input, select"); el && el.focus(); }, 60);
    }
  }, [open, initial]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  // F3 — template picker. MUST stay above the early return so hook order is stable
  // (calling it after `if (!open) return null` changes the hook count → React crash).
  const { data: templates = [] } = useTemplates(open);
  const { data: customPeriphs = [] } = usePeripherals(open);
  if (!open) return null;
  const copy = MODAL_COPY[mode] || MODAL_COPY.assign;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const toggle = (k) => () => setForm({ ...form, [k]: !form[k] });
  const toggleCustom = (key) => () => setForm((f) => {
    const cur = f.customPeripherals || [];
    return { ...f, customPeripherals: cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key] };
  });

  /* ----- database lookups + duplicate detection ----- */
  const norm = (s) => (s || "").trim().toLowerCase();
  const others = assets.filter((a) => a !== initial);
  const nameQ = norm(form.pseudo);
  const suggestions = nameQ
    ? Array.from(new Map(others.filter((a) => !a.shared && norm(a.pseudo).includes(nameQ)).map((a) => [a.pseudo, a])).values()).slice(0, 6)
    : [];
  const sameName = others.filter((a) => !a.shared && norm(a.pseudo) === nameQ);
  const tagDup = form.id.trim() ? others.find((a) => norm(a.id) === norm(form.id)) : null;
  const ser1Dup = form.mon1.trim() ? others.find((a) => [a.mon1, a.mon2].some((s) => s && norm(s) === norm(form.mon1))) : null;
  const ser2Dup = form.mon2.trim() ? others.find((a) => [a.mon1, a.mon2].some((s) => s && norm(s) === norm(form.mon2))) : null;
  const serSelfDup = form.mon1.trim() && form.mon2.trim() && norm(form.mon1) === norm(form.mon2);

  const hardError = !!tagDup || serSelfDup;
  const valid = form.pseudo.trim() && form.id.trim() && !hardError;
  const submit = (e) => { e.preventDefault(); setTouched(true); if (!valid) return; onSubmit(form); };
  const pickName = (a) => { setForm((f) => ({ ...f, pseudo: a.pseudo, dept: a.dept })); setNameOpen(false); };
  const isAsset = mode === "addAsset";

  const employeeBlock = (
    <div className="form-section" key="emp">
      <div className="form-section-title">{isAsset ? "Assignment" : "Employee"}</div>
      <div className="form-cols">
        <div className="form-row">
          <span className="form-label">{isAsset ? "Assigned employee" : "Employee (pseudo name)"}</span>
          <div className="field-ac">
            <input className={"input" + (touched && !form.pseudo.trim() ? " input-error" : "")}
              placeholder="e.g. Atlas" value={form.pseudo} autoComplete="off"
              onChange={(e) => { setForm({ ...form, pseudo: e.target.value }); setNameOpen(true); }}
              onFocus={() => setNameOpen(true)}
              onBlur={() => setTimeout(() => setNameOpen(false), 140)} />
            {nameOpen && suggestions.length ? (
              <div className="ac-menu">
                <div className="ac-head">In database</div>
                {suggestions.map((a) => (
                  <button type="button" key={a.id} className="ac-item" onMouseDown={(e) => { e.preventDefault(); pickName(a); }}>
                    <Avatar name={a.pseudo} size={24} />
                    <span className="ac-name">{a.pseudo}</span>
                    <span className="ac-dept">{a.dept}</span>
                    <span className="mono ac-tag">{a.id}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {sameName.length ? (
            <span className="form-flag flag-info">
              Existing employee — already has {sameName.length} {sameName.length === 1 ? "machine" : "machines"} ({sameName.slice(0, 3).map((a) => a.id).join(", ")})
            </span>
          ) : null}
        </div>
        <label className="form-row">
          <span className="form-label">Full name <span className="form-optional">(optional)</span></span>
          <input className="input" placeholder="e.g. Prakhar Vyas" value={form.fullName} autoComplete="off" onChange={set("fullName")} />
        </label>
        <label className="form-row">
          <span className="form-label">Department</span>
          <select className="input" value={form.dept} onChange={set("dept")}>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
      </div>
    </div>
  );

  // F3 — template picker (templates fetched above, before the early return)
  const applyTemplate = (tplId) => {
    const t = templates.find((x) => String(x.id) === String(tplId));
    if (!t) return;
    setForm((f) => ({
      ...f, type: t.type || f.type, cpu: t.cpu || f.cpu, ram: t.ram || f.ram, hdd: t.hdd || f.hdd,
      headphone: !!t.headphone || f.headphone, speaker: !!t.speaker || f.speaker,
      keyboard: !!t.keyboard || f.keyboard, mouse: !!t.mouse || f.mouse,
      ipPhone: !!t.ipPhone || f.ipPhone, webcam: !!t.webcam || f.webcam, mobileStand: !!t.mobileStand || f.mobileStand
    }));
  };

  const machineBlock = (
    <div className="form-section" key="mac">
      <div className="form-section-title">{isAsset ? "Machine specifications" : "Assigned machine"}</div>
      {templates.length ? (
        <label className="form-row" style={{ marginBottom: "var(--sp-10)" }}>
          <span className="form-label">Apply template</span>
          <select className="input" defaultValue="" onChange={(e) => { applyTemplate(e.target.value); e.target.value = ""; }}>
            <option value="">— Pick a template to prefill —</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
      ) : null}
      <div className="form-cols">
        <label className="form-row">
          <span className="form-label">Type</span>
          <select className="input" value={form.type} onChange={set("type")}>
            {types.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <div className="form-row">
          <span className="form-label" id="assign-tag-label">Asset tag</span>
          <input className={"input mono" + ((touched && !form.id.trim()) || tagDup ? " input-error" : "")}
            placeholder="TS-PC-000" value={form.id} onChange={set("id")} autoComplete="off"
            aria-labelledby="assign-tag-label"
            aria-invalid={!!tagDup || (touched && !form.id.trim())}
            aria-describedby={tagDup ? "assign-tag-err" : undefined} />
          {tagDup ? (
            <span className="form-flag flag-error" id="assign-tag-err" role="alert">Asset tag already exists — {tagDup.shared ? "Day-Shift PC" : tagDup.pseudo} · {tagDup.dept}</span>
          ) : null}
        </div>
      </div>
      <div className="form-cols-3">
        <label className="form-row">
          <span className="form-label">CPU</span>
          <input className="input" placeholder="Intel i5 12th Gen" value={form.cpu} onChange={set("cpu")} />
        </label>
        <label className="form-row">
          <span className="form-label">RAM</span>
          <input className="input" placeholder="16 GB" value={form.ram} onChange={set("ram")} />
        </label>
        <label className="form-row">
          <span className="form-label">Storage</span>
          <input className="input" placeholder="480 GB" value={form.hdd} onChange={set("hdd")} />
        </label>
      </div>
      <div className="form-cols">
        <div className="form-row">
          <span className="form-label">Monitor 1 serial</span>
          <input className={"input mono" + (ser1Dup || serSelfDup ? " input-warn" : "")}
            placeholder="Optional" value={form.mon1} onChange={set("mon1")} autoComplete="off" />
          {ser1Dup ? <span className="form-flag flag-warn">Serial already on {ser1Dup.id}</span>
            : serSelfDup ? <span className="form-flag flag-error">Same serial in both fields</span> : null}
        </div>
        <div className="form-row">
          <span className="form-label">Monitor 2 serial</span>
          <input className={"input mono" + (ser2Dup ? " input-warn" : "")}
            placeholder="Optional" value={form.mon2} onChange={set("mon2")} autoComplete="off" />
          {ser2Dup ? <span className="form-flag flag-warn">Serial already on {ser2Dup.id}</span> : null}
        </div>
      </div>
      <label className="form-row">
        <span className="form-label">Return due <span className="form-optional">(loaner / spare only)</span></span>
        <input className="input" type="date" value={form.returnDue || ""} onChange={set("returnDue")} />
      </label>
      <div className="form-row">
        <span className="form-label">Peripherals</span>
        <div className="periph-toggle-row">
          {PERIPHERALS.map((p) => (
            <button type="button" key={p.key} className={"periph-toggle" + (form[p.key] ? " periph-toggle-on" : "")}
              onClick={toggle(p.key)}>
              <Icon d={p.icon} size={14} />
              <span>{p.label}</span>
            </button>
          ))}
          {customPeriphs.map((p) => (
            <button type="button" key={"c-" + p.key} className={"periph-toggle" + ((form.customPeripherals || []).includes(p.key) ? " periph-toggle-on" : "")}
              onClick={toggleCustom(p.key)}>
              <Icon d={ICONS.plus} size={14} />
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      </div>

    </div>
  );

  return (
    <div className="modal-root">
      <div className="modal-scrim" onClick={onClose}></div>
      <form className="modal" onSubmit={submit} ref={formRef} role="dialog" aria-modal="true" aria-label={copy.t}>
        <div className="modal-head">
          <div>
            <div className="modal-title">{copy.t}</div>
            <div className="modal-subtitle">{copy.s}</div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close form">
            <Icon d={ICONS.close} size={16} />
          </button>
        </div>
        <div className="modal-body">
          {mode === "edit" && initial?.id ? <RecentChanges assetId={initial.id} open={open} /> : null}
          {isAsset ? [machineBlock, employeeBlock] : [employeeBlock, machineBlock]}
        </div>
        <div className="modal-foot">
          {hardError ? <span className="foot-err">Resolve duplicates to continue</span> : null}
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isPending}>Cancel</button>
          <button type="submit" disabled={hardError || isPending}
            className={"btn btn-primary" + (hardError || isPending ? " btn-disabled" : "")}>
            {isPending ? "Saving…" : copy.b}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------- asset table (column-configurable per view) ---------- */
function PersonCell(a) {
  return (
    <span className="cell-person">
      <Avatar name={a.pseudo} shared={a.shared} />
      <span className={"cell-person-name" + (a.shared ? " cell-shared" : "")}>{a.pseudo}</span>
    </span>
  );
}
const COLDEFS = {
  employee:   { label: "Employee", sortKey: "pseudo", render: PersonCell },
  assignedTo: { label: "Assigned To", sortKey: "pseudo", render: PersonCell },
  fullName:   { label: "Full Name", sortable: false, render: (a) => a.fullName || <span className="cell-muted">—</span> },
  dept:       { label: "Department", sortKey: "dept", render: (a) => <DeptBadge dept={a.dept} /> },
  type:       { label: "Type", sortKey: "type", render: (a) => (
                  <span className="cell-type"><span className="type-icon"><Icon d={typeIcon(a.type)} size={14} /></span>{a.type}</span>) },
  tag:        { label: "Asset Tag", sortKey: "id", render: (a) => <span className="mono cell-tag">{a.id}</span> },
  cpu:        { label: "CPU", sortKey: "cpu", render: (a) => a.cpu || <span className="cell-muted">—</span> },
  ram:        { label: "RAM", sortKey: "ram", render: (a) => a.ram || <span className="cell-muted">—</span> },
  hdd:        { label: "HDD", sortKey: "hdd", render: (a) => a.hdd || <span className="cell-muted">—</span> },
  monitors:   { label: "Monitors", sortKey: "monitors", render: (a) => <MonitorCell value={a.monitors} /> },
  periph:     { label: "Peripherals", sortable: false, thClass: "th-periph", tdClass: "td-periph", render: (a) => <PeriphChips asset={a} /> },
};
const VIEW_COLUMNS = {
  Dashboard: ["employee", "dept", "type", "tag", "monitors", "periph"],
  Employees: ["employee", "dept", "type", "tag", "monitors", "periph"],
  Assets:    ["tag", "type", "cpu", "ram", "hdd", "monitors", "assignedTo", "fullName", "dept"],
};

function AssetTable({ rows, cols, sort, onSort, onSelect, selectedId, selectable, selectedIds, onToggleSelect, onToggleAll }) {
  const columns = cols.map((k) => ({ key: k, ...COLDEFS[k] }));
  // normalize selectedIds (Set or array) into a fast membership check
  const selSet = selectable
    ? (selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []))
    : null;
  const visibleIds = selectable ? rows.map((a) => a.id) : [];
  const allChecked = selectable && visibleIds.length > 0 && visibleIds.every((id) => selSet.has(id));
  const someChecked = selectable && !allChecked && visibleIds.some((id) => selSet.has(id));
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            {selectable ? (
              <th className="th-check">
                <input type="checkbox" className="row-check" aria-label="Select all"
                  checked={allChecked} ref={(el) => { if (el) el.indeterminate = someChecked; }}
                  onChange={() => onToggleAll && onToggleAll(visibleIds)} />
              </th>
            ) : null}
            {columns.map((c) => {
              const active = sort.key === c.sortKey;
              return (
                <th key={c.key} className={c.thClass || ""}>
                  {c.sortable === false ? (
                    <span className="th-plain">{c.label}</span>
                  ) : (
                    <button type="button" className={"th-btn" + (active ? " th-active" : "")} onClick={() => onSort(c.sortKey)}>
                      <span>{c.label}</span>
                      <span className={"sort-arrow" + (active ? " sort-arrow-on" : "")}>
                        {active && sort.dir === -1 ? "↓" : "↑"}
                      </span>
                    </button>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((a, i) => (
            <tr key={a.id + "-" + i} className={selectedId === a.id + "-" + i ? "row-selected" : ""}
              tabIndex={0} role="button"
              onClick={() => onSelect(a, i)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(a, i); } }}>
              {selectable ? (
                <td className="td-check" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" className="row-check" aria-label={`Select ${a.id}`}
                    checked={selSet.has(a.id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => onToggleSelect && onToggleSelect(a.id)} />
                </td>
              ) : null}
              {columns.map((c) => <td key={c.key} className={c.tdClass || ""}>{c.render(a)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- floating bulk-action bar ---------- */
const BULK_STATUS_OPTIONS = [
  { label: "Active", value: "active" },
  { label: "In repair", value: "repair" },
  { label: "Retired", value: "retired" }
];
function BulkBar({ count, departments = [], canManage, onAction, onClear }) {
  if (!count) return null;
  return (
    <div className="bulk-bar">
      <span className="bulk-count">{count} selected</span>
      <button type="button" className="btn btn-secondary btn-sm bulk-clear" onClick={onClear}>Clear</button>
      {canManage ? (
        <div className="bulk-actions">
          <button type="button" className="btn btn-ghost-danger btn-sm" onClick={() => onAction("retire")}>Retire</button>
          <select className="input bulk-select" defaultValue=""
            onChange={(e) => { if (e.target.value) { onAction("setDept", { dept: e.target.value }); e.target.value = ""; } }}>
            <option value="" disabled>Move to dept…</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className="input bulk-select" defaultValue=""
            onChange={(e) => { if (e.target.value) { onAction("setStatus", { status: e.target.value }); e.target.value = ""; } }}>
            <option value="" disabled>Set status…</option>
            {BULK_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- employees: people card grid (distinct from Assets table) ---------- */
function EmployeesGrid({ rows, onSelect }) {
  return (
    <div className="emp-grid">
      {rows.map((a, i) => (
        <button type="button" key={a.id + "-" + i} className="emp-card tilt-3d"
          onClick={() => onSelect(a, i)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(a, i); } }}>
          <div className="emp-card-top">
            <Avatar name={a.pseudo} shared={a.shared} size={42} />
            <div className="emp-card-id">
              <div className={"emp-card-name" + (a.shared ? " cell-shared" : "")}>{a.pseudo}</div>
              <DeptBadge dept={a.dept} />
            </div>
            <span className="emp-card-type" title={a.type}>
              <Icon d={typeIcon(a.type)} size={15} />
            </span>
          </div>
          <div className="emp-card-meta">
            <span className="emp-card-tag mono">{a.id}</span>
            <span className="emp-card-dot">·</span>
            <MonitorCell value={a.monitors} />
          </div>
          <div className="emp-card-foot">
            <PeriphChips asset={a} />
          </div>
        </button>
      ))}
    </div>
  );
}

/* ---------- mobile card fallback for the asset/dashboard table ---------- */
function AssetCardList({ rows, onSelect }) {
  return (
    <div className="asset-cards">
      {rows.map((a, i) => (
        <button type="button" key={a.id + "-" + i} className="asset-card" onClick={() => onSelect(a, i)}>
          <div className="asset-card-head">
            <span className="cell-person">
              <Avatar name={a.pseudo} shared={a.shared} size={30} />
              <span className={"cell-person-name" + (a.shared ? " cell-shared" : "")}>{a.pseudo}</span>
            </span>
            <span className="mono cell-tag">{a.id}</span>
          </div>
          <div className="asset-card-meta">
            <DeptBadge dept={a.dept} />
            <span className="cell-type"><Icon d={typeIcon(a.type)} size={13} /> {a.type}</span>
            <MonitorCell value={a.monitors} />
          </div>
          {(a.cpu || a.ram || a.hdd) ? (
            <div className="asset-card-specs">
              {[a.cpu, a.ram, a.hdd].filter(Boolean).join(" · ")}
            </div>
          ) : null}
          <div className="asset-card-foot"><PeriphChips asset={a} /></div>
        </button>
      ))}
    </div>
  );
}

/* ---------- empty state ---------- */
function EmptyState({ onClear }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Icon d={ICONS.search} size={20} /></div>
      <div className="empty-title">No assets match</div>
      <div className="empty-sub">Nothing matches the current search and filters.</div>
      <button type="button" className="btn btn-secondary" onClick={onClear}>Clear search &amp; filters</button>
    </div>
  );
}

export { DetailDrawer, RemoveAssetModal, AssignModal, AssetTable, BulkBar, AssetCardList, EmployeesGrid, VIEW_COLUMNS, EmptyState };

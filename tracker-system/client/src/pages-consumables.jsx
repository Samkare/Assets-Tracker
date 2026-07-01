// Task Source — Inventory Management (stock, suppliers, categories, spare hardware)
import React, { useState, useEffect, useRef } from "react";
import { Icon, ICONS, FilterDropdown, Field, StatCard } from "./components.jsx";
import { api } from "./api/client.js";
import { SkeletonTable, SkeletonTimeline } from "./Skeleton.jsx";
import { useFocusTrap } from "./useFocusTrap.js";
import { useConfirm } from "./confirm.jsx";
import {
  useInventory, useInventoryItem,
  useCreateItem, useUpdateItem, useDeleteItem,
  useReceiveStock, useIssueStock, useReturnStock, useAdjustItem, useStockMovements, useDefective,
  useAssets,
  useSuppliers, useCreateSupplier, useUpdateSupplier, useDeleteSupplier,
  useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory,
  useSpares, useIssueSpare,
  usePeripherals, useCreatePeripheral, useUpdatePeripheral, useDeletePeripheral,
} from "./api/hooks.js";

/* ---------- helpers ---------- */
const KINDS = ["consumable", "accessory", "hardware"];
const KIND_LABEL = { consumable: "Consumable", accessory: "Accessory", hardware: "Hardware" };
const MOVE_ICON = { in: ICONS.plus, out: ICONS.logout, return: ICONS.history, adjust: ICONS.edit };

function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function useEsc(open, onClose) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
}

/* ============================================================
   STOCK TAB
   ============================================================ */

/* ---------- add / edit item modal (mirrors AddLicenseModal) ---------- */
function ItemModal({ open, initial, categories, suppliers, onClose, onSubmit, isPending, error }) {
  const blank = {
    name: "", kind: "consumable", categoryId: "", supplierId: "", unit: "",
    qty: "", reorderLevel: "", reorderQty: "", location: "", notes: "",
  };
  const [form, setForm] = useState(blank);
  const formRef = useRef(null);
  useFocusTrap(formRef, open);
  const isEdit = !!initial;
  useEffect(() => {
    if (open) {
      setForm(initial ? {
        name: initial.name || "",
        kind: initial.kind || "consumable",
        categoryId: initial.categoryId || "",
        supplierId: initial.supplierId || "",
        unit: initial.unit || "",
        qty: "",
        reorderLevel: initial.reorderLevel != null ? String(initial.reorderLevel) : "",
        reorderQty: initial.reorderQty != null ? String(initial.reorderQty) : "",
        location: initial.location || "",
        notes: initial.notes || "",
      } : blank);
      setTimeout(() => { const el = formRef.current && formRef.current.querySelector("input"); el && el.focus(); }, 60);
    }
  }, [open, initial]);
  useEsc(open, onClose);
  if (!open) return null;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = (e) => { e.preventDefault(); if (!form.name.trim()) return; onSubmit(form); };
  return (
    <div className="modal-root">
      <div className="modal-scrim" onClick={onClose}></div>
      <form className="modal inv-edit-modal" onSubmit={submit} ref={formRef}>
        <div className="modal-head inv-edit-head">
          <div className="inv-edit-head-main">
            <span className="inv-edit-ico" data-tone="accent"><Icon d={ICONS.hdd} size={18} /></span>
            <div>
              <div className="modal-title">{isEdit ? "Edit item" : "Add item"}</div>
              <div className="modal-subtitle">{isEdit ? "Update this inventory item." : "Track a stock item and its reorder levels."}</div>
            </div>
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
                <input className="input" placeholder="e.g. HDMI cable" value={form.name} onChange={set("name")} required aria-required="true" aria-invalid={!form.name.trim()} />
              </label>
              <label className="form-row">
                <span className="form-label">Kind</span>
                <select className="input" value={form.kind} onChange={set("kind")}>
                  {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                </select>
              </label>
            </div>
            <div className="form-cols">
              <label className="form-row">
                <span className="form-label">Category</span>
                <select className="input" value={form.categoryId} onChange={set("categoryId")}>
                  <option value="">—</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="form-row">
                <span className="form-label">Supplier</span>
                <select className="input" value={form.supplierId} onChange={set("supplierId")}>
                  <option value="">—</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            </div>
            <div className="form-cols-3">
              {!isEdit ? (
                <label className="form-row">
                  <span className="form-label">Quantity</span>
                  <input className="input" type="number" placeholder="0" value={form.qty} onChange={set("qty")} />
                </label>
              ) : <span />}
              <label className="form-row">
                <span className="form-label">Reorder level</span>
                <input className="input" type="number" placeholder="5" value={form.reorderLevel} onChange={set("reorderLevel")} />
              </label>
              <label className="form-row">
                <span className="form-label">Reorder qty</span>
                <input className="input" type="number" placeholder="10" value={form.reorderQty} onChange={set("reorderQty")} />
              </label>
            </div>
            <label className="form-row">
              <span className="form-label">Notes</span>
              <input className="input" placeholder="Optional" value={form.notes} onChange={set("notes")} />
            </label>
          </div>
        </div>
        <div className="modal-foot">
          {error ? <span className="foot-err">{error}</span> : null}
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={isPending || !form.name.trim()}>
            {isEdit ? "Save changes" : "Add item"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------- inline stock-action form inside the item drawer ---------- */
/* small autocomplete used for Employee + Asset ID in Issue form */
function AutoComplete({ value, onChange, placeholder, options, getLabel, getSub, mono, autoFocus }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  const q = value.trim().toLowerCase();
  const filtered = q ? options.filter((o) => getLabel(o).toLowerCase().includes(q) || (getSub && getSub(o).toLowerCase().includes(q))).slice(0, 8) : options.slice(0, 8);
  const pick = (o) => { onChange(getLabel(o)); setOpen(false); };
  return (
    <div className="field-ac" ref={ref} style={{ flex: 1, position: "relative" }}>
      <input className={"input" + (mono ? " mono" : "")} placeholder={placeholder} value={value} autoComplete="off"
        autoFocus={autoFocus}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && filtered.length ? (
        <div className="ac-menu">
          {filtered.map((o, i) => (
            <button type="button" key={i} className="ac-item" onMouseDown={(e) => { e.preventDefault(); pick(o); }}>
              <span className={mono ? "mono ac-name" : "ac-name"}>{getLabel(o)}</span>
              {getSub ? <span className="ac-dept">{getSub(o)}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StockActionForm({ action, suppliers, onCancel, onSubmit, isPending, error }) {
  const [form, setForm] = useState({
    qty: "", supplierId: "", employeeName: "", assetId: "", reason: "", delta: "",
    defective: false, replacementOf: "",
  });
  // assets for autocomplete (only loaded when needed)
  const { data: assets = [] } = useAssets({}, action === "issue");
  const employeeOptions = React.useMemo(() => {
    const m = new Map();
    for (const a of assets) {
      if (a.shared || !a.pseudo) continue;
      if (!m.has(a.pseudo)) m.set(a.pseudo, { name: a.pseudo, dept: a.dept });
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [assets]);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    if (action === "adjust") {
      const n = Number(form.delta);
      if (!form.delta || isNaN(n) || n === 0) return;
      onSubmit({ delta: n, reason: form.reason.trim() || null });
      return;
    }
    const n = Number(form.qty);
    if (!form.qty || isNaN(n) || n <= 0) return;
    if (action === "receive") {
      onSubmit({ qty: n, supplierId: form.supplierId || null });
    } else if (action === "issue") {
      onSubmit({ qty: n, employeeName: form.employeeName.trim() || null, assetId: form.assetId.trim() || null, reason: form.reason.trim() || null, replacementOf: form.replacementOf ? Number(form.replacementOf) : null });
    } else if (action === "return") {
      onSubmit({ qty: n, reason: form.reason.trim() || null, condition: form.defective ? "defective" : "good", employeeName: form.employeeName.trim() || null });
    }
  };
  const title = { receive: "Receive stock", issue: "Issue stock", return: "Return stock", adjust: "Adjust stock" }[action];
  return (
    <form className="inv-action-form" onSubmit={submit}>
      <div className="inv-action-title">{title}</div>
      {action === "adjust" ? (
        <div className="inv-action-row">
          <input className="input inv-action-num" type="number" placeholder="±delta" value={form.delta} onChange={set("delta")} autoFocus />
          <input className="input" placeholder="Reason" value={form.reason} onChange={set("reason")} />
        </div>
      ) : (
        <React.Fragment>
          <div className="inv-action-row">
            <input className="input inv-action-num" type="number" min="1" placeholder="Qty" value={form.qty} onChange={set("qty")} autoFocus />
            {action === "receive" ? (
              <React.Fragment>
                <select className="input" value={form.supplierId} onChange={set("supplierId")}>
                  <option value="">Supplier…</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </React.Fragment>
            ) : null}
          </div>
          {action === "issue" ? (
            <div className="inv-action-row">
              <AutoComplete value={form.employeeName} onChange={(v) => setForm({ ...form, employeeName: v })}
                placeholder="Employee name" options={employeeOptions}
                getLabel={(o) => o.name} getSub={(o) => o.dept} />
              <AutoComplete value={form.assetId} onChange={(v) => setForm({ ...form, assetId: v })}
                placeholder="or Asset ID" options={assets} mono
                getLabel={(o) => o.id} getSub={(o) => `${o.pseudo} · ${o.dept}`} />
            </div>
          ) : null}
          {action === "return" ? (
            <React.Fragment>
              <div className="inv-action-row">
                <AutoComplete value={form.employeeName} onChange={(v) => setForm({ ...form, employeeName: v })}
                  placeholder="Returned by (employee)" options={employeeOptions}
                  getLabel={(o) => o.name} getSub={(o) => o.dept} />
              </div>
              <label className="inv-action-row" style={{ alignItems: "center", gap: "var(--sp-8)", cursor: "pointer" }}>
                <input type="checkbox" checked={form.defective}
                  onChange={(e) => setForm({ ...form, defective: e.target.checked })}
                  style={{ width: 16, height: 16, accentColor: "var(--danger)" }} />
                <span style={{ fontSize: "var(--fs-13)", color: form.defective ? "var(--danger-fg)" : "var(--text-2)", fontWeight: "var(--weight-semibold)" }}>
                  Mark as defective (track for replacement)
                </span>
              </label>
            </React.Fragment>
          ) : null}
          {(action === "issue" || action === "return") ? (
            <input className="input" placeholder="Reason (optional)" value={form.reason} onChange={set("reason")} />
          ) : null}
        </React.Fragment>
      )}
      {error ? <div className="inv-action-err">{error}</div> : null}
      <div className="inv-action-foot">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={isPending}>{title}</button>
      </div>
    </form>
  );
}

/* ---------- item detail drawer ---------- */
const ITEM_TABS = [{ key: "Details", label: "Details" }, { key: "Movements", label: "Movements" }];
function ItemDrawer({ itemId, suppliers, canManage, onClose, onEdit }) {
  const [tab, setTab] = useState("Details");
  const [action, setAction] = useState(null); // 'receive'|'issue'|'return'|'adjust'
  const [actionErr, setActionErr] = useState("");
  const dialogRef = useRef(null);
  useFocusTrap(dialogRef, !!itemId);
  const confirm = useConfirm();
  const { data: item, isLoading } = useInventoryItem(itemId);

  const clearAndClose = () => { setAction(null); setActionErr(""); };
  const onOK = () => { clearAndClose(); };
  const onErr = (e) => setActionErr(e?.message || "Couldn't update stock — try again or refresh.");
  const receive = useReceiveStock({ onSuccess: onOK });
  const issue = useIssueStock({ onSuccess: onOK });
  const ret = useReturnStock({ onSuccess: onOK });
  const adjust = useAdjustItem({ onSuccess: onOK });
  const del = useDeleteItem({ onSuccess: () => onClose() });

  useEffect(() => { setTab("Details"); setAction(null); setActionErr(""); }, [itemId]);
  useEsc(!!itemId, onClose);
  if (!itemId) return null;

  const runAction = (input) => {
    setActionErr("");
    const hookMap = { receive, issue, return: ret, adjust };
    const h = hookMap[action];
    h.mutate({ id: itemId, input }, { onError: onErr });
  };
  const pending = receive.isPending || issue.isPending || ret.isPending || adjust.isPending;

  const onDelete = async () => {
    if (await confirm({ title: `Delete ${item?.name || "item"}?`, body: "This item and its movement history will be permanently removed.", confirmLabel: "Delete" })) {
      del.mutate(itemId, { onError: onErr });
    }
  };

  const movements = (item && item.movements) || [];

  return (
    <div className="modal-root">
      <div className="modal-scrim" onClick={onClose}></div>
      <div className="modal modal-detail inv-drawer" role="dialog" aria-modal="true" aria-label="Item details" ref={dialogRef}>
        <div className="modal-head inv-drawer-head">
          <div className="inv-drawer-head-main">
            <span className="inv-item-ico inv-drawer-ico" data-kind={item?.kind || "consumable"}>
              <Icon d={ICONS.hdd} size={20} />
            </span>
            <div>
              <div className="modal-title">{item ? item.name : "Loading…"}</div>
              <div className="modal-subtitle">
                {item ? <>{KIND_LABEL[item.kind] || "Consumable"}{item.category ? <> · {item.category}</> : null}</> : null}
              </div>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close details">
            <Icon d={ICONS.close} size={16} />
          </button>
        </div>

        {/* hero stat strip */}
        {item ? (
          <div className="inv-drawer-stats">
            <div className="inv-drawer-stat">
              <div className="inv-drawer-stat-label">On hand</div>
              <div className="inv-drawer-stat-value"><span className="mono">{item.qty}</span> <span className="cell-muted">{item.unit || "pcs"}</span></div>
            </div>
            <div className="inv-drawer-stat">
              <div className="inv-drawer-stat-label">Reorder at</div>
              <div className="inv-drawer-stat-value"><span className="mono">{item.reorderLevel ?? "—"}</span></div>
            </div>
            <div className="inv-drawer-stat">
              <div className="inv-drawer-stat-label">Status</div>
              <div className="inv-drawer-stat-value">
                {item.low
                  ? <span className="status-pill" data-s="open">Low stock</span>
                  : <span className="status-pill" data-s="resolved">In stock</span>}
              </div>
            </div>
          </div>
        ) : null}

        <div className="drawer-tabs" role="tablist" aria-label="Item details">
          {ITEM_TABS.map((t) => (
            <button type="button" key={t.key} role="tab" aria-selected={tab === t.key}
              className={"drawer-tab" + (tab === t.key ? " drawer-tab-on" : "")}
              onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>

        <div className="modal-body detail-body">
          {isLoading && !item ? <div className="cell-muted">Loading item…</div> : null}

          {tab === "Details" && item ? (
            <div className="drawer-section">
              <div className="field-grid">
                <Field label="Category">{item.category || <span className="cell-muted">—</span>}</Field>
                <Field label="Supplier">{item.supplier || <span className="cell-muted">—</span>}</Field>
                <Field label="Reorder level">{item.reorderLevel != null ? item.reorderLevel : <span className="cell-muted">—</span>}</Field>
                <Field label="Reorder qty">{item.reorderQty != null ? item.reorderQty : <span className="cell-muted">—</span>}</Field>
                {item.notes ? <Field label="Notes">{item.notes}</Field> : null}
              </div>
            </div>
          ) : null}

          {tab === "Movements" ? (
            !movements.length ? (
              <div className="drawer-section"><div className="cell-muted">No movements recorded yet.</div></div>
            ) : (
              <div className="drawer-section">
                <div className="drawer-section-title">Timeline</div>
                <div className="drawer-timeline">
                  {movements.map((m, i) => (
                    <div className="drawer-tl-row" key={(m.at || "") + "-" + i}>
                      <div className="drawer-tl-ico"><Icon d={MOVE_ICON[m.type] || ICONS.history} size={13} /></div>
                      <div className="drawer-tl-body">
                        <div className="drawer-tl-line">
                          <span className="drawer-tl-kind">{m.type}</span>
                          <span className="mono inv-move-qty" data-dir={m.type === "out" ? "down" : "up"}>
                            {m.type === "out" ? "−" : m.type === "adjust" ? (Number(m.qty) < 0 ? "−" : "+") : "+"}{Math.abs(Number(m.qty))}
                          </span>
                          {m.actor ? <span className="cell-muted"> · {m.actor}</span> : null}
                        </div>
                        {(m.reason || m.employee_name || m.asset_id || m.supplier_name) ? (
                          <div className="drawer-tl-detail">
                            {[m.reason, m.employee_name, m.asset_id, m.supplier_name].filter(Boolean).join(" · ")}
                          </div>
                        ) : null}
                        <div className="drawer-tl-time">{fmtTime(m.at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          ) : null}

          {canManage && tab === "Details" && item ? (
            action ? (
              <StockActionForm action={action} suppliers={suppliers} isPending={pending} error={actionErr}
                onCancel={clearAndClose} onSubmit={runAction} />
            ) : (
              <div className="inv-action-bar inv-action-bar-premium">
                <button type="button" className="inv-act-btn" data-tone="in"      onClick={() => { setActionErr(""); setAction("receive"); }}><Icon d={ICONS.plus} size={14} /> Receive</button>
                <button type="button" className="inv-act-btn" data-tone="out"     onClick={() => { setActionErr(""); setAction("issue"); }}><Icon d={ICONS.logout} size={14} /> Issue</button>
                <button type="button" className="inv-act-btn" data-tone="return"  onClick={() => { setActionErr(""); setAction("return"); }}><Icon d={ICONS.history} size={14} /> Return</button>
                <button type="button" className="inv-act-btn" data-tone="adjust"  onClick={() => { setActionErr(""); setAction("adjust"); }}><Icon d={ICONS.edit} size={14} /> Adjust</button>
              </div>
            )
          ) : null}
          {actionErr && !action ? <div className="inv-action-err">{actionErr}</div> : null}
        </div>

        {canManage && item ? (
          <div className="modal-foot detail-foot">
            <button type="button" className="btn btn-ghost-danger" disabled={del.isPending} onClick={onDelete}>Delete</button>
            <button type="button" className="btn btn-secondary" onClick={() => onEdit(item)}>
              <Icon d={ICONS.edit} size={14} /> Edit details
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StockTab({ canManage }) {
  const { data: categories = [] } = useCategories();
  const { data: suppliers = [] } = useSuppliers();
  const [catFilter, setCatFilter] = useState("All");
  const [supFilter, setSupFilter] = useState("All");
  const [lowOnly, setLowOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [drawerId, setDrawerId] = useState(null);
  const [formErr, setFormErr] = useState("");

  const catObj = categories.find((c) => c.name === catFilter);
  const supObj = suppliers.find((s) => s.name === supFilter);
  const params = {};
  if (catObj) params.categoryId = catObj.id;
  if (supObj) params.supplierId = supObj.id;
  if (lowOnly) params.low = "1";
  const { data: rawItems = [], isLoading } = useInventory(params);
  const q = query.trim().toLowerCase();
  const items = q ? rawItems.filter((i) =>
    [i.name, i.category, i.supplier].filter(Boolean).some((s) => s.toLowerCase().includes(q))
  ) : rawItems;

  // KPI rollup for premium header
  const totalUnits = items.reduce((s, i) => s + (i.qty || 0), 0);
  const lowCount = items.filter((i) => i.low).length;

  const create = useCreateItem({ onSuccess: () => { setAddOpen(false); setFormErr(""); } });
  const update = useUpdateItem({ onSuccess: () => { setEditItem(null); setFormErr(""); } });

  const submitItem = (form) => {
    setFormErr("");
    const base = {
      name: form.name.trim(),
      kind: form.kind,
      categoryId: form.categoryId || null,
      supplierId: form.supplierId || null,
      unit: form.unit.trim() || null,
      reorderLevel: form.reorderLevel !== "" ? Number(form.reorderLevel) : 0,
      reorderQty: form.reorderQty !== "" ? Number(form.reorderQty) : 0,
      location: form.location.trim() || null,
      notes: form.notes.trim() || null,
    };
    if (editItem) {
      update.mutate({ id: editItem.id, input: base }, { onError: (e) => setFormErr(e?.message || "Couldn't save changes to this item.") });
    } else {
      create.mutate({ ...base, qty: form.qty !== "" ? Number(form.qty) : 0 }, { onError: (e) => setFormErr(e?.message || "Couldn't create this item — check the name isn't already used.") });
    }
  };

  return (
    <React.Fragment>
      {/* premium KPI strip */}
      <div className="stats inv-stats">
        <StatCard label="Tracked Items" value={items.length} sub={`${categories.length} categor${categories.length === 1 ? "y" : "ies"}`} icon={ICONS.hdd} ring={240} />
        <StatCard label="Units on Hand" value={totalUnits.toLocaleString()} sub="across all items" icon={ICONS.assets} ring={168} />
        <StatCard label="Low Stock" value={lowCount} sub={lowCount ? "needs reorder" : "all stocked"} accent={lowCount > 0} icon={ICONS.wrench} ring={12} />
        <StatCard label="Suppliers" value={suppliers.length} sub={suppliers.length === 1 ? "vendor" : "vendors"} icon={ICONS.diamond} ring={272} />
      </div>

      {/* premium toolbar: search + filters + add */}
      <div className="inv-toolbar inv-toolbar-premium">
        <div className="inv-search">
          <Icon d={ICONS.search} size={14} />
          <input className="inv-search-input" placeholder="Search items, categories, suppliers…"
            value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search inventory" />
          {query ? <button type="button" className="inv-search-clear" onClick={() => setQuery("")} aria-label="Clear search"><Icon d={ICONS.close} size={11} /></button> : null}
        </div>
        <FilterDropdown label="Category" value={catFilter} options={categories.map((c) => c.name)} onChange={setCatFilter} />
        <FilterDropdown label="Supplier" value={supFilter} options={suppliers.map((s) => s.name)} onChange={setSupFilter} />
        <button type="button" className={"audit-chip" + (lowOnly ? " audit-chip-on" : "")} onClick={() => setLowOnly((v) => !v)}>
          <Icon d={ICONS.wrench} size={11} /> Low stock only
        </button>
        <span className="inv-toolbar-spacer" />
        {canManage ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => { setEditItem(null); setFormErr(""); setAddOpen(true); }}>
            <Icon d={ICONS.plus} size={14} /> Add item
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="table-card inv-card-premium"><div style={{ padding: "var(--sp-16)" }}><SkeletonTable rows={5} cols={6} /></div></div>
      ) : items.length === 0 ? (
        <div className="table-card inv-card-premium">
          <div className="empty-state">
            <div className="empty-icon"><Icon d={ICONS.hdd} size={20} /></div>
            <div className="empty-title">{q ? "No matches" : "No items"}</div>
            <div className="empty-sub">{canManage ? (q ? "Try a different search." : "Add your first item to get started.") : "Nothing matches the current filters."}</div>
          </div>
        </div>
      ) : (
        <div className="table-card inv-card-premium">
          <div className="table-scroll">
            <table className="data-table inv-table">
              <thead>
                <tr>
                  <th><span className="th-plain">Item</span></th>
                  <th><span className="th-plain">Category</span></th>
                  <th><span className="th-plain">Supplier</span></th>
                  <th style={{ textAlign: "right" }}><span className="th-plain">On hand</span></th>
                  <th style={{ textAlign: "right" }}><span className="th-plain">Reorder at</span></th>
                  <th style={{ width: 28 }}><span className="th-plain" /></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} tabIndex={0} role="button"
                    className={"inv-row" + (it.low ? " inv-row-low" : "")}
                    onClick={() => setDrawerId(it.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDrawerId(it.id); } }}>
                    <td>
                      <div className="inv-item-cell">
                        <span className="inv-item-ico" data-kind={it.kind}><Icon d={ICONS.hdd} size={14} /></span>
                        <div>
                          <div className="inv-item-name">{it.name}{it.low ? <span className="inv-low-pill">Low</span> : null}</div>
                          <div className="inv-item-sub">{KIND_LABEL[it.kind] || "Consumable"}</div>
                        </div>
                      </div>
                    </td>
                    <td>{it.category ? <span className="inv-cat-pill">{it.category}</span> : <span className="cell-muted">—</span>}</td>
                    <td className="cell-muted">{it.supplier || "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      <span className="inv-qty-big">{it.qty.toLocaleString()}</span>
                      <span className="cell-muted" style={{ marginLeft: 4, fontSize: "var(--fs-12)" }}>{it.unit || ""}</span>
                    </td>
                    <td style={{ textAlign: "right" }} className="cell-muted mono">{it.reorderLevel}</td>
                    <td className="cell-muted inv-chev" style={{ textAlign: "center" }}><Icon d={ICONS.chevDown} size={14} style={{ transform: "rotate(-90deg)" }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ItemModal open={addOpen || !!editItem} initial={editItem} categories={categories} suppliers={suppliers}
        onClose={() => { setAddOpen(false); setEditItem(null); setFormErr(""); }}
        onSubmit={submitItem} isPending={create.isPending || update.isPending} error={formErr} />

      <ItemDrawer itemId={drawerId} suppliers={suppliers} canManage={canManage}
        onClose={() => setDrawerId(null)}
        onEdit={(it) => { setDrawerId(null); setFormErr(""); setEditItem(it); }} />
    </React.Fragment>
  );
}

/* ============================================================
   SPARE HARDWARE TAB
   ============================================================ */
function SpareRow({ spare, canManage }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ pseudo: "", dept: "" });
  const [err, setErr] = useState("");
  const issue = useIssueSpare({ onSuccess: () => { setOpen(false); setForm({ pseudo: "", dept: "" }); setErr(""); } });
  const submit = (e) => {
    e.preventDefault();
    if (!form.pseudo.trim()) return;
    setErr("");
    issue.mutate({ id: spare.id, input: { pseudo: form.pseudo.trim(), dept: form.dept.trim() || null } },
      { onError: (x) => setErr(x?.message || "Couldn't issue this spare machine.") });
  };
  return (
    <tr>
      <td><span className="mono cell-tag">{spare.id}</span></td>
      <td>{spare.type || <span className="cell-muted">—</span>}</td>
      <td>{spare.cpu || <span className="cell-muted">—</span>}</td>
      <td>{spare.ram || <span className="cell-muted">—</span>}</td>
      <td>{spare.hdd || <span className="cell-muted">—</span>}</td>
      {canManage ? (
        <td>
          {open ? (
            <form className="inv-inline-form" onSubmit={submit}>
              <input className="input" placeholder="Employee" value={form.pseudo}
                onChange={(e) => setForm({ ...form, pseudo: e.target.value })} autoFocus />
              <input className="input" placeholder="Dept" value={form.dept}
                onChange={(e) => setForm({ ...form, dept: e.target.value })} />
              <button type="submit" className="btn btn-primary btn-sm" disabled={issue.isPending || !form.pseudo.trim()}>Issue</button>
              <button type="button" className="icon-btn" onClick={() => { setOpen(false); setErr(""); }} aria-label="Cancel">
                <Icon d={ICONS.close} size={14} />
              </button>
              {err ? <span className="inv-action-err">{err}</span> : null}
            </form>
          ) : (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>Issue</button>
          )}
        </td>
      ) : null}
    </tr>
  );
}

function SpareTab({ canManage }) {
  const { data: spares = [], isLoading } = useSpares();
  if (spares.length === 0) {
    return (
      <div className="table-card">
        <div className="empty-state">
          <div className="empty-icon"><Icon d={ICONS.desktop} size={20} /></div>
          <div className="empty-title">{isLoading ? "Loading spares…" : "No spare machines in stock."}</div>
          <div className="empty-sub">Machines are marked in-stock from the Assets page.</div>
        </div>
      </div>
    );
  }
  return (
    <div className="table-card">
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th><span className="th-plain">Asset</span></th>
              <th><span className="th-plain">Type</span></th>
              <th><span className="th-plain">CPU</span></th>
              <th><span className="th-plain">RAM</span></th>
              <th><span className="th-plain">Storage</span></th>
              {canManage ? <th><span className="th-plain">Action</span></th> : null}
            </tr>
          </thead>
          <tbody>
            {spares.map((s) => <SpareRow key={s.id} spare={s} canManage={canManage} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================================================
   SUPPLIERS TAB
   ============================================================ */
function SupplierModal({ open, initial, onClose, onSubmit, isPending, error }) {
  const blank = { name: "", contact: "", email: "", phone: "", leadTimeDays: "", notes: "" };
  const [form, setForm] = useState(blank);
  const formRef = useRef(null);
  useFocusTrap(formRef, open);
  const isEdit = !!initial;
  useEffect(() => {
    if (open) {
      setForm(initial ? {
        name: initial.name || "", contact: initial.contact || "", email: initial.email || "",
        phone: initial.phone || "", leadTimeDays: initial.lead_time_days != null ? String(initial.lead_time_days) : "",
        notes: initial.notes || "",
      } : blank);
      setTimeout(() => { const el = formRef.current && formRef.current.querySelector("input"); el && el.focus(); }, 60);
    }
  }, [open, initial]);
  useEsc(open, onClose);
  if (!open) return null;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = (e) => { e.preventDefault(); if (!form.name.trim()) return; onSubmit(form); };
  return (
    <div className="modal-root">
      <div className="modal-scrim" onClick={onClose}></div>
      <form className="modal inv-edit-modal" onSubmit={submit} ref={formRef}>
        <div className="modal-head inv-edit-head">
          <div className="inv-edit-head-main">
            <span className="inv-edit-ico" data-tone="accent"><Icon d={ICONS.diamond} size={18} /></span>
            <div>
              <div className="modal-title">{isEdit ? "Edit supplier" : "Add supplier"}</div>
              <div className="modal-subtitle">Vendor contact &amp; lead time.</div>
            </div>
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
                <input className="input" placeholder="e.g. Acme Supplies" value={form.name} onChange={set("name")} />
              </label>
              <label className="form-row">
                <span className="form-label">Contact</span>
                <input className="input" placeholder="Contact person" value={form.contact} onChange={set("contact")} />
              </label>
            </div>
            <div className="form-cols-3">
              <label className="form-row">
                <span className="form-label">Email</span>
                <input className="input" type="email" placeholder="sales@acme.com" value={form.email} onChange={set("email")} />
              </label>
              <label className="form-row">
                <span className="form-label">Phone</span>
                <input className="input" placeholder="+1 555…" value={form.phone} onChange={set("phone")} />
              </label>
              <label className="form-row">
                <span className="form-label">Lead time (days)</span>
                <input className="input" type="number" placeholder="7" value={form.leadTimeDays} onChange={set("leadTimeDays")} />
              </label>
            </div>
            <label className="form-row">
              <span className="form-label">Notes</span>
              <input className="input" placeholder="Optional" value={form.notes} onChange={set("notes")} />
            </label>
          </div>
        </div>
        <div className="modal-foot">
          {error ? <span className="foot-err">{error}</span> : null}
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={isPending || !form.name.trim()}>
            {isEdit ? "Save changes" : "Add supplier"}
          </button>
        </div>
      </form>
    </div>
  );
}

function SuppliersTab({ canManage }) {
  const { data: suppliers = [], isLoading } = useSuppliers();
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [formErr, setFormErr] = useState("");
  const [rowErr, setRowErr] = useState({});
  const confirm = useConfirm();
  const create = useCreateSupplier({ onSuccess: () => { setAddOpen(false); setFormErr(""); } });
  const update = useUpdateSupplier({ onSuccess: () => { setEditItem(null); setFormErr(""); } });
  const del = useDeleteSupplier();

  const submit = (form) => {
    setFormErr("");
    const body = {
      name: form.name.trim(), contact: form.contact.trim() || null, email: form.email.trim() || null,
      phone: form.phone.trim() || null, leadTimeDays: form.leadTimeDays !== "" ? Number(form.leadTimeDays) : null,
      notes: form.notes.trim() || null,
    };
    if (editItem) update.mutate({ id: editItem.id, input: body }, { onError: (e) => setFormErr(e?.message || "Couldn't save changes.") });
    else create.mutate(body, { onError: (e) => setFormErr(e?.message || "Couldn't create — name may already exist.") });
  };
  const onDelete = async (s) => {
    setRowErr((m) => ({ ...m, [s.id]: "" }));
    if (await confirm({ title: `Delete ${s.name}?`, body: "This supplier will be removed.", confirmLabel: "Delete" })) {
      del.mutate(s.id, { onError: (e) => setRowErr((m) => ({ ...m, [s.id]: e?.message || "In use — cannot delete" })) });
    }
  };

  return (
    <React.Fragment>
      {canManage ? (
        <div className="page-head-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => { setEditItem(null); setFormErr(""); setAddOpen(true); }}>
            <Icon d={ICONS.plus} size={14} /> Add supplier
          </button>
        </div>
      ) : null}

      {suppliers.length === 0 ? (
        <div className="table-card">
          <div className="empty-state">
            <div className="empty-icon"><Icon d={ICONS.mail} size={20} /></div>
            <div className="empty-title">{isLoading ? "Loading suppliers…" : "No suppliers"}</div>
            <div className="empty-sub">{canManage ? "Add a supplier to get started." : "Nothing on record yet."}</div>
          </div>
        </div>
      ) : (
        <div className="sw-grid">
          {suppliers.map((s) => (
            <div className="sw-card" key={s.id}>
              <div className="sw-card-head">
                <div>
                  <div className="sw-card-name">{s.name}</div>
                  {s.contact ? <div className="sw-card-vendor">{s.contact}</div> : null}
                </div>
                <span className="sw-badge" style={{ background: "var(--info-bg)", color: "var(--info-fg)" }}>{s.itemCount || 0} items</span>
              </div>
              <div className="sw-meta">
                {s.email ? <span className="sw-meta-item">{s.email}</span> : null}
                {s.phone ? <span className="sw-meta-item">{s.phone}</span> : null}
                {s.lead_time_days != null ? <span className="sw-meta-item">Lead {s.lead_time_days}d</span> : null}
              </div>
              {s.notes ? <div className="sw-meta"><span className="sw-meta-item">{s.notes}</span></div> : null}
              {rowErr[s.id] ? <div className="inv-action-err">{rowErr[s.id]}</div> : null}
              {canManage ? (
                <div className="sw-card-foot">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setFormErr(""); setEditItem(s); }}>Edit</button>
                  <button type="button" className="btn btn-ghost-danger btn-sm" disabled={del.isPending} onClick={() => onDelete(s)}>Delete</button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <SupplierModal open={addOpen || !!editItem} initial={editItem}
        onClose={() => { setAddOpen(false); setEditItem(null); setFormErr(""); }}
        onSubmit={submit} isPending={create.isPending || update.isPending} error={formErr} />
    </React.Fragment>
  );
}

/* ============================================================
   CATEGORIES TAB
   ============================================================ */
function CategoryModal({ open, initial, onClose, onSubmit, isPending, error }) {
  const blank = { name: "", kind: "consumable" };
  const [form, setForm] = useState(blank);
  const formRef = useRef(null);
  useFocusTrap(formRef, open);
  const isEdit = !!initial;
  useEffect(() => {
    if (open) {
      setForm(initial ? { name: initial.name || "", kind: initial.kind || "consumable" } : blank);
      setTimeout(() => { const el = formRef.current && formRef.current.querySelector("input"); el && el.focus(); }, 60);
    }
  }, [open, initial]);
  useEsc(open, onClose);
  if (!open) return null;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = (e) => { e.preventDefault(); if (!form.name.trim()) return; onSubmit(form); };
  return (
    <div className="modal-root">
      <div className="modal-scrim" onClick={onClose}></div>
      <form className="modal inv-edit-modal" onSubmit={submit} ref={formRef}>
        <div className="modal-head inv-edit-head">
          <div className="inv-edit-head-main">
            <span className="inv-edit-ico" data-tone="success"><Icon d={ICONS.departments} size={18} /></span>
            <div>
              <div className="modal-title">{isEdit ? "Edit category" : "Add category"}</div>
              <div className="modal-subtitle">Group inventory items.</div>
            </div>
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
                <input className="input" placeholder="e.g. Cables" value={form.name} onChange={set("name")} required aria-required="true" aria-invalid={!form.name.trim()} />
              </label>
              <label className="form-row">
                <span className="form-label">Kind</span>
                <select className="input" value={form.kind} onChange={set("kind")}>
                  {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                </select>
              </label>
            </div>
          </div>
        </div>
        <div className="modal-foot">
          {error ? <span className="foot-err">{error}</span> : null}
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={isPending || !form.name.trim()}>
            {isEdit ? "Save changes" : "Add category"}
          </button>
        </div>
      </form>
    </div>
  );
}

function CategoriesTab({ canManage }) {
  const { data: categories = [], isLoading } = useCategories();
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [formErr, setFormErr] = useState("");
  const [rowErr, setRowErr] = useState({});
  const confirm = useConfirm();
  const create = useCreateCategory({ onSuccess: () => { setAddOpen(false); setFormErr(""); } });
  const update = useUpdateCategory({ onSuccess: () => { setEditItem(null); setFormErr(""); } });
  const del = useDeleteCategory();

  const submit = (form) => {
    setFormErr("");
    const body = { name: form.name.trim(), kind: form.kind };
    if (editItem) update.mutate({ id: editItem.id, input: body }, { onError: (e) => setFormErr(e?.message || "Couldn't save changes.") });
    else create.mutate(body, { onError: (e) => setFormErr(e?.message || "Couldn't create — name may already exist.") });
  };
  const onDelete = async (c) => {
    setRowErr((m) => ({ ...m, [c.id]: "" }));
    if (await confirm({ title: `Delete ${c.name}?`, body: "This category will be removed.", confirmLabel: "Delete" })) {
      del.mutate(c.id, { onError: (e) => setRowErr((m) => ({ ...m, [c.id]: e?.message || "In use — cannot delete" })) });
    }
  };

  return (
    <React.Fragment>
      {canManage ? (
        <div className="page-head-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => { setEditItem(null); setFormErr(""); setAddOpen(true); }}>
            <Icon d={ICONS.plus} size={14} /> Add category
          </button>
        </div>
      ) : null}

      {categories.length === 0 ? (
        <div className="table-card">
          <div className="empty-state">
            <div className="empty-icon"><Icon d={ICONS.departments} size={20} /></div>
            <div className="empty-title">{isLoading ? "Loading categories…" : "No categories"}</div>
            <div className="empty-sub">{canManage ? "Add a category to get started." : "Nothing on record yet."}</div>
          </div>
        </div>
      ) : (
        <div className="table-card">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th><span className="th-plain">Name</span></th>
                  <th><span className="th-plain">Kind</span></th>
                  <th><span className="th-plain">Items</span></th>
                  {canManage ? <th><span className="th-plain">Actions</span></th> : null}
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td><span className="cell-muted">{KIND_LABEL[c.kind] || c.kind}</span></td>
                    <td><span className="mono">{c.itemCount || 0}</span></td>
                    {canManage ? (
                      <td>
                        <div className="inv-inline-form">
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setFormErr(""); setEditItem(c); }}>Edit</button>
                          <button type="button" className="btn btn-ghost-danger btn-sm" disabled={del.isPending} onClick={() => onDelete(c)}>Delete</button>
                        </div>
                        {rowErr[c.id] ? <div className="inv-action-err">{rowErr[c.id]}</div> : null}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CategoryModal open={addOpen || !!editItem} initial={editItem}
        onClose={() => { setAddOpen(false); setEditItem(null); setFormErr(""); }}
        onSubmit={submit} isPending={create.isPending || update.isPending} error={formErr} />
    </React.Fragment>
  );
}

/* ---------- Peripherals catalog (user-managed) ---------- */
function PeripheralsTab({ canManage }) {
  const { data: periphs = [], isLoading } = usePeripherals();
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const confirm = useConfirm();
  const create = useCreatePeripheral({ onSuccess: () => { setName(""); setErr(""); } });
  const update = useUpdatePeripheral({ onSuccess: () => { setEditId(null); setEditName(""); } });
  const del = useDeletePeripheral();

  const add = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate({ label: name.trim() }, { onError: (er) => setErr(er?.message || "Couldn't add — name may already exist.") });
  };
  const saveEdit = (p) => {
    if (!editName.trim()) return;
    update.mutate({ id: p.id, input: { label: editName.trim() } });
  };
  const onDelete = async (p) => {
    if (await confirm({ title: `Delete "${p.label}"?`, body: "It's removed from the catalog and from every asset that had it.", confirmLabel: "Delete" }))
      del.mutate(p.id);
  };

  return (
    <React.Fragment>
      {canManage ? (
        <form className="inv-inline-form" onSubmit={add} style={{ marginBottom: "var(--sp-14)" }}>
          <input className="input" placeholder="New peripheral (e.g. UPS, Docking Station)" value={name}
            onChange={(e) => { setName(e.target.value); setErr(""); }} maxLength={40} style={{ maxWidth: 320 }} />
          <button type="submit" className="btn btn-primary btn-sm" disabled={create.isPending || !name.trim()}>
            <Icon d={ICONS.plus} size={14} /> Add peripheral
          </button>
          {err ? <span className="inv-action-err">{err}</span> : null}
        </form>
      ) : null}

      {periphs.length === 0 ? (
        <div className="table-card">
          <div className="empty-state">
            <div className="empty-icon"><Icon d={ICONS.plus} size={20} /></div>
            <div className="empty-title">{isLoading ? "Loading…" : "No custom peripherals yet"}</div>
            <div className="empty-sub">{canManage ? "Add one above — it appears as an option on every asset." : "Nothing on record yet."}</div>
          </div>
        </div>
      ) : (
        <div className="table-card">
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr>
                <th><span className="th-plain">Peripheral</span></th>
                {canManage ? <th style={{ textAlign: "right" }}><span className="th-plain">Actions</span></th> : null}
              </tr></thead>
              <tbody>
                {periphs.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {editId === p.id
                        ? <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={40} style={{ maxWidth: 280 }} autoFocus />
                        : p.label}
                    </td>
                    {canManage ? (
                      <td style={{ textAlign: "right" }}>
                        <div className="inv-inline-form" style={{ justifyContent: "flex-end" }}>
                          {editId === p.id ? (
                            <React.Fragment>
                              <button type="button" className="btn btn-primary btn-sm" disabled={update.isPending} onClick={() => saveEdit(p)}>Save</button>
                              <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setEditId(null); setEditName(""); }}>Cancel</button>
                            </React.Fragment>
                          ) : (
                            <React.Fragment>
                              <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setEditId(p.id); setEditName(p.label); }}>Edit</button>
                              <button type="button" className="btn btn-ghost-danger btn-sm" disabled={del.isPending} onClick={() => onDelete(p)}>Delete</button>
                            </React.Fragment>
                          )}
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
    </React.Fragment>
  );
}

/* ============================================================
   PAGE
   ============================================================ */
const TABS = [
  { key: "Stock", label: "Stock" },
  { key: "Spare", label: "Spare Hardware" },
  { key: "Defective", label: "Defective Items" },
  { key: "Log", label: "Movements" },
  { key: "Suppliers", label: "Suppliers" },
  { key: "Categories", label: "Categories" },
  { key: "Peripherals", label: "Peripherals" },
];

function DefectiveTab({ canManage }) {
  const [filter, setFilter] = useState(""); // ""|"pending"|"replaced"
  const { data: rows = [], isLoading } = useDefective(filter ? { status: filter } : {});
  const [replacing, setReplacing] = useState(null); // the defective row being replaced
  const [repErr, setRepErr] = useState("");
  const issue = useIssueStock({ onSuccess: () => { setReplacing(null); setRepErr(""); } });
  const submitReplacement = (form) => {
    setRepErr("");
    issue.mutate(
      { id: replacing.item_id, input: { qty: form.qty, employeeName: form.employeeName || null, assetId: form.assetId || null, reason: "Replacement for defective return", replacementOf: replacing.id } },
      { onError: (e) => setRepErr(e?.message || "Couldn't record replacement.") }
    );
  };
  const chips = [
    { v: "", label: "All" },
    { v: "pending", label: "Pending replacement" },
    { v: "replaced", label: "Replaced" },
  ];
  return (
    <React.Fragment>
      <div className="inv-toolbar">
        {chips.map((c) => (
          <button type="button" key={c.v || "all"}
            className={"audit-chip" + (filter === c.v ? " audit-chip-on" : "")}
            onClick={() => setFilter(c.v)}>{c.label}</button>
        ))}
        <span className="inv-toolbar-spacer" />
        <span className="cell-muted">{rows.length} entries</span>
      </div>
      <div className="table-card">
        {isLoading ? <div style={{ padding: "var(--sp-16)" }}><SkeletonTable rows={4} cols={6} /></div> :
         rows.length === 0 ? <div className="cell-muted" style={{ padding: "var(--sp-16)" }}>All clear — no defective items recorded. Tick "Mark as defective" on a Return to start tracking.</div> : (
          <div className="table-scroll">
            <table className="data-table"><thead><tr>
              <th><span className="th-plain">Reported</span></th>
              <th><span className="th-plain">Item</span></th>
              <th><span className="th-plain">Qty</span></th>
              <th><span className="th-plain">From</span></th>
              <th><span className="th-plain">Reason</span></th>
              <th><span className="th-plain">Status</span></th>
              <th><span className="th-plain">Replacement</span></th>
            </tr></thead><tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="cell-muted">{fmtTime(r.at)}</td>
                  <td>{r.item_name}</td>
                  <td className="mono">{r.qty} {r.item_unit || ""}</td>
                  <td>{r.employee_name || r.asset_id || <span className="cell-muted">—</span>}</td>
                  <td className="cell-muted">{r.reason || "—"}</td>
                  <td>
                    {r.replaced_by ?
                      <span className="status-pill" data-s="resolved">Replaced</span> :
                      <span className="status-pill" data-s="open">Pending</span>}
                  </td>
                  <td className="cell-muted">
                    {r.replaced_by ?
                      <span>To {r.replacement_employee || "—"} · {fmtTime(r.replacement_at)}</span> :
                      (canManage ?
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setRepErr(""); setReplacing(r); }}>
                          Record replacement
                        </button> :
                        <span style={{ color: "var(--text-3)" }}>—</span>)}
                  </td>
                </tr>
              ))}
            </tbody></table>
          </div>
        )}
      </div>

      {replacing ? (
        <ReplacementModal row={replacing} onClose={() => { setReplacing(null); setRepErr(""); }}
          onSubmit={submitReplacement} isPending={issue.isPending} error={repErr} />
      ) : null}
    </React.Fragment>
  );
}

/* ---------- record-replacement modal ---------- */
function ReplacementModal({ row, onClose, onSubmit, isPending, error }) {
  const [form, setForm] = useState({ qty: String(row.qty || 1), employeeName: row.employee_name || "", assetId: row.asset_id || "" });
  const ref = useRef(null);
  useFocusTrap(ref, true);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    const n = Math.trunc(Number(form.qty));
    if (!n || n <= 0) return;
    onSubmit({ qty: n, employeeName: form.employeeName.trim(), assetId: form.assetId.trim() });
  };
  return (
    <div className="modal-root">
      <div className="modal-scrim" onClick={onClose}></div>
      <form className="modal" onSubmit={submit} ref={ref} role="dialog" aria-modal="true" style={{ maxWidth: 460 }}>
        <div className="modal-head">
          <div>
            <div className="modal-title">Record replacement</div>
            <div className="modal-subtitle">{row.item_name} · issues a good unit from stock and closes this defective return</div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon d={ICONS.close} size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="form-cols">
            <label className="form-row">
              <span className="form-label">Quantity <span className="form-optional">({row.item_qty ?? 0} in stock)</span></span>
              <input className="input" type="number" min="1" value={form.qty} onChange={set("qty")} autoFocus />
            </label>
            <label className="form-row">
              <span className="form-label">Replacement to <span className="form-optional">(employee)</span></span>
              <input className="input" value={form.employeeName} onChange={set("employeeName")} placeholder="Optional" />
            </label>
          </div>
          <label className="form-row">
            <span className="form-label">Asset ID <span className="form-optional">(optional)</span></span>
            <input className="input mono" value={form.assetId} onChange={set("assetId")} placeholder="Optional" />
          </label>
          {error ? <div className="inv-action-err">{error}</div> : null}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={isPending}>Record replacement</button>
        </div>
      </form>
    </div>
  );
}

const MOVE_LABEL = { in: "Received", out: "Issued", return: "Returned", adjust: "Adjusted" };
const MOVE_TYPES = ["All", "in", "out", "return", "adjust"];

function StockLogTab() {
  const [type, setType] = useState("All");
  const { data: rows = [], isLoading } = useStockMovements(type === "All" ? {} : { type });
  return (
    <React.Fragment>
      <div className="inv-toolbar">
        {MOVE_TYPES.map((t) => (
          <button type="button" key={t}
            className={"audit-chip" + (type === t ? " audit-chip-on" : "")}
            onClick={() => setType(t)}>{t === "All" ? "All" : MOVE_LABEL[t]}</button>
        ))}
        <span className="inv-toolbar-spacer" />
        <span className="cell-muted">{rows.length} entries</span>
      </div>
      <div className="table-card">
        {isLoading ? <div style={{ padding: "var(--sp-16)" }}><SkeletonTable rows={5} cols={6} /></div> :
         rows.length === 0 ? <div className="cell-muted" style={{ padding: "var(--sp-16)" }}>No stock movements yet.</div> : (
          <div className="table-scroll">
            <table className="data-table"><thead><tr>
              <th><span className="th-plain">When</span></th>
              <th><span className="th-plain">Type</span></th>
              <th><span className="th-plain">Item</span></th>
              <th><span className="th-plain">Qty</span></th>
              <th><span className="th-plain">Detail</span></th>
              <th><span className="th-plain">Actor</span></th>
            </tr></thead><tbody>
              {rows.map((m) => {
                const sign = (m.type === "in" || m.type === "return") ? "+" :
                             m.type === "out" ? "−" : (m.qty >= 0 ? "+" : "−");
                const detail = m.type === "in" ? (m.supplier_name ? `From ${m.supplier_name}` : (m.reason || "")) :
                              m.type === "out" ? (m.employee_name ? `To ${m.employee_name}` : m.asset_id ? `On ${m.asset_id}` : (m.reason || "")) :
                              (m.reason || "");
                return (
                  <tr key={m.id}>
                    <td className="cell-muted">{fmtTime(m.at)}</td>
                    <td>
                      <span className="status-pill" data-s={m.type}>{MOVE_LABEL[m.type] || m.type}</span>
                      {m.condition === "defective" ? <span className="status-pill" data-s="defective" style={{ marginLeft: "var(--sp-6)" }}>Defective</span> : null}
                    </td>
                    <td>{m.item_name}</td>
                    <td className="mono"><span className="inv-move-qty" data-dir={sign === "+" ? "up" : "down"}>{sign}{Math.abs(m.qty)}</span> {m.item_unit || ""}</td>
                    <td className="cell-muted">{detail}</td>
                    <td>{m.actor}</td>
                  </tr>
                );
              })}
            </tbody></table>
          </div>
        )}
      </div>
    </React.Fragment>
  );
}

function ConsumablesPage({ canManage }) {
  const [tab, setTab] = useState("Stock");
  return (
    <React.Fragment>
      <div className="page-head">
        <h1 className="page-title">Stock Operations</h1>
        <p className="page-caption">Receive, issue, adjust — stock, suppliers &amp; spare hardware</p>
        <div className="page-head-actions">
          <div className="io-toolbar" role="group" aria-label="Export">
            <button type="button" className="io-btn" onClick={() => api.download("/export/consumables.xlsx")} title="Export current stock to Excel">
              <Icon d={ICONS.download || ICONS.assets} size={14} /> Stock
            </button>
            {canManage ? (
              <button type="button" className="io-btn" onClick={() => api.download("/export/stock-movements.xlsx")} title="Export the movement log to Excel">
                <Icon d={ICONS.download || ICONS.history} size={14} /> Movements
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="drawer-tabs" role="tablist" aria-label="Inventory sections">
        {TABS.map((t) => (
          <button type="button" key={t.key} role="tab" aria-selected={tab === t.key}
            className={"drawer-tab" + (tab === t.key ? " drawer-tab-on" : "")}
            onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === "Stock" ? <StockTab canManage={canManage} /> : null}
      {tab === "Log" ? <StockLogTab /> : null}
      {tab === "Defective" ? <DefectiveTab canManage={canManage} /> : null}
      {tab === "Spare" ? <SpareTab canManage={canManage} /> : null}
      {tab === "Suppliers" ? <SuppliersTab canManage={canManage} /> : null}
      {tab === "Categories" ? <CategoriesTab canManage={canManage} /> : null}
      {tab === "Peripherals" ? <PeripheralsTab canManage={canManage} /> : null}
    </React.Fragment>
  );
}

export { ConsumablesPage };

// Task Source — Departments & Reports pages
import React, { useState, useEffect, useMemo } from "react";
import { Icon, ICONS, typeIcon, Avatar, DeptBadge, PERIPHERALS, MonitorCell, deptHue } from "./components.jsx";
import { DetailModal, ASSET_COLS } from "./DetailPopup.jsx";
import { useConfirm } from "./confirm.jsx";
import { useToast } from "./toasts.jsx";
import { useFocusTrap } from "./useFocusTrap.js";
import { useCreateUser, useUpdateUser, useDeleteUser, useSetUserPassword } from "./api/hooks.js";
import { useDepartments, useCreateDepartment, useUpdateDepartment, useDeleteDepartment } from "./api/hooks.js";
import { ROLES } from "@its/shared/constants";

function coverageOf(list) {
  if (!list.length) return 0;
  let yes = 0;
  list.forEach((a) => { PERIPHERALS.forEach((p) => { if (a[p.key]) yes++; }); });
  return Math.round((yes / (list.length * PERIPHERALS.length)) * 100);
}

/* ---------- Dashboard insight panels ---------- */
function DashboardInsights({ assets, onOpenDept }) {
  const deptData = useMemo(() => {
    // derive departments from live data so admin-added depts appear (not the static seed list)
    const names = [...new Set(assets.map((a) => a.dept).filter(Boolean))];
    const list = names.map((d) => ({ dept: d, count: assets.filter((a) => a.dept === d).length }))
      .filter((x) => x.count > 0).sort((a, b) => b.count - a.count);
    const top = list.slice(0, 8);
    const peak = Math.max(1, ...top.map((x) => x.count));
    return { top, peak };
  }, [assets]);

  const periphData = useMemo(() => PERIPHERALS.map((p) => {
    const yes = assets.filter((a) => a[p.key]).length;
    return { label: p.label, icon: p.icon, pct: assets.length ? Math.round((yes / assets.length) * 100) : 0 };
  }), [assets]);

  return (
    <div className="insight-grid">
      <div className="report-card tilt-3d">
        <div className="report-card-title">Fleet by department</div>
        <div className="report-bars">
          {deptData.top.map((d) => (
            <button type="button" className="report-bar-row insight-bar-row" key={d.dept} onClick={() => onOpenDept(d.dept)}>
              <span className="report-bar-label report-bar-label-dept">
                <span className="dept-swatch sm" style={{ background: `oklch(0.58 0.15 ${deptHue(d.dept)})` }}></span>
                {d.dept}
              </span>
              <div className="report-bar-track">
                <div className="report-bar-fill" style={{ width: Math.max((d.count / deptData.peak) * 100, 3) + "%", background: `oklch(0.6 0.14 ${deptHue(d.dept)})` }}></div>
              </div>
              <span className="report-bar-val">{d.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="report-card tilt-3d">
        <div className="report-card-title">Peripheral coverage</div>
        <div className="report-bars">
          {periphData.map((p) => (
            <div className="report-bar-row" key={p.label}>
              <span className="report-bar-label"><Icon d={p.icon} size={14} /> {p.label}</span>
              <div className="report-bar-track">
                <div className="report-bar-fill" style={{ width: Math.max(p.pct, 2) + "%" }}></div>
              </div>
              <span className="report-bar-val">{p.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Department detail modal ---------- */
function DepartmentModal({ dept, assets, onClose, onSelectAsset, onViewAll }) {
  useEffect(() => {
    if (!dept) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dept, onClose]);
  if (!dept) return null;
  const list = assets.filter((a) => a.dept === dept);
  const people = list.filter((a) => !a.shared).length;
  const dual = list.filter((a) => a.monitors === "Dual").length;
  const cov = coverageOf(list);
  const h = deptHue(dept);
  return (
    <div className="modal-root">
      <div className="modal-scrim" onClick={onClose}></div>
      <div className="modal modal-dept">
        <div className="modal-head">
          <div className="deptm-head">
            <span className="deptm-swatch" style={{ background: `oklch(0.58 0.15 ${h})` }}></span>
            <div>
              <div className="modal-title">{dept}</div>
              <div className="modal-subtitle">{list.length} {list.length === 1 ? "asset" : "assets"} · {people} {people === 1 ? "person" : "people"}</div>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close department">
            <Icon d={ICONS.close} size={16} />
          </button>
        </div>
        <div className="deptm-stats">
          <div className="deptm-stat"><div className="deptm-stat-num">{list.length}</div><div className="deptm-stat-lbl">Assets</div></div>
          <div className="deptm-stat"><div className="deptm-stat-num">{people}</div><div className="deptm-stat-lbl">People</div></div>
          <div className="deptm-stat"><div className="deptm-stat-num">{dual}</div><div className="deptm-stat-lbl">Dual monitor</div></div>
          <div className="deptm-stat"><div className="deptm-stat-num" style={{ color: `oklch(0.5 0.13 ${h})` }}>{cov}%</div><div className="deptm-stat-lbl">Coverage</div></div>
        </div>
        <div className="deptm-list">
          {list.map((a, i) => (
            <button type="button" key={a.id + "-" + i} className="deptm-row" onClick={() => onSelectAsset(a)}>
              <Avatar name={a.pseudo} shared={a.shared} size={28} />
              <span className={"deptm-row-name" + (a.shared ? " cell-shared" : "")}>{a.pseudo}</span>
              <span className="deptm-row-type"><Icon d={typeIcon(a.type)} size={13} /> {a.type}</span>
              <span className="mono deptm-row-tag">{a.id}</span>
              <span className="deptm-row-mon"><MonitorCell value={a.monitors} /></span>
            </button>
          ))}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
          <button type="button" className="btn btn-primary" onClick={() => onViewAll(dept)}>Open in Assets register</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Departments page ---------- */
function DeptFormModal({ open, initial, onClose, onSubmit, isPending, error }) {
  const isEdit = !!initial;
  const [name, setName] = useState("");
  const [hue, setHue] = useState(210);
  const ref = React.useRef(null);
  useFocusTrap(ref, open);
  useEffect(() => {
    if (!open) return;
    setName(initial?.name || "");
    setHue(initial?.hue ?? 210);
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, initial, onClose]);
  if (!open) return null;
  const submit = (e) => { e.preventDefault(); if (!name.trim()) return; onSubmit({ name: name.trim(), hue: Number(hue) }); };
  return (
    <div className="modal-root">
      <div className="modal-scrim" onClick={onClose}></div>
      <form className="modal" onSubmit={submit} ref={ref} role="dialog" aria-modal="true" style={{ maxWidth: 440 }}>
        <div className="modal-head">
          <div>
            <div className="modal-title">{isEdit ? "Edit department" : "Add department"}</div>
            <div className="modal-subtitle">{isEdit ? "Rename or recolour." : "Create a new department."}</div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon d={ICONS.close} size={16} /></button>
        </div>
        <div className="modal-body">
          <label className="form-row">
            <span className="form-label">Name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Logistics" autoFocus />
          </label>
          <label className="form-row">
            <span className="form-label">Colour <span className="form-optional">(hue {hue})</span></span>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-12)" }}>
              <span className="dept-swatch" style={{ background: `oklch(0.58 0.15 ${hue})`, width: 28, height: 28, flex: "none" }}></span>
              <input type="range" min="0" max="360" value={hue} onChange={(e) => setHue(e.target.value)} style={{ flex: 1 }} />
            </div>
          </label>
          {error ? <div className="login-err">{error}</div> : null}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={isPending}>{isEdit ? "Save" : "Create"}</button>
        </div>
      </form>
    </div>
  );
}

function DepartmentsPage({ assets, onOpenDept, onSelectAsset, canAdmin = false }) {
  const [openDept, setOpenDept] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editDept, setEditDept] = useState(null);
  const [formErr, setFormErr] = useState("");
  const confirm = useConfirm();
  const { showToast } = useToast();
  const { data: liveDepts = [] } = useDepartments();
  const create = useCreateDepartment({ onSuccess: () => { setFormOpen(false); setFormErr(""); showToast("Department created", "success"); }, onError: (e) => setFormErr(e?.message || "Couldn't create.") });
  const update = useUpdateDepartment({ onSuccess: () => { setFormOpen(false); setEditDept(null); setFormErr(""); showToast("Department updated", "success"); }, onError: (e) => setFormErr(e?.message || "Couldn't save.") });
  const del = useDeleteDepartment({ onSuccess: () => showToast("Department archived", "success"), onError: (e) => showToast(e?.message || "In use — reassign first", "error") });

  const data = useMemo(() => liveDepts.map((ld) => {
    const list = assets.filter((a) => a.dept === ld.name);
    return { id: ld.id, dept: ld.name, hue: ld.hue, count: list.length,
      people: list.filter((a) => !a.shared).length, dual: list.filter((a) => a.monitors === "Dual").length,
      coverage: coverageOf(list) };
  }).sort((a, b) => b.count - a.count), [assets, liveDepts]);

  const openAdd = () => { setEditDept(null); setFormErr(""); setFormOpen(true); };
  const openEdit = (d) => { setEditDept({ id: d.id, name: d.dept, hue: d.hue }); setFormErr(""); setFormOpen(true); };
  const submitForm = (body) => { if (editDept) update.mutate({ id: editDept.id, input: body }); else create.mutate(body); };
  const onDelete = async (d) => {
    if (d.count > 0) return showToast(`${d.dept} has ${d.count} assets — reassign first`, "error");
    if (await confirm({ title: `Archive ${d.dept}?`, body: "It's removed from the list (no assets are affected).", confirmLabel: "Archive" }))
      del.mutate(d.id);
  };

  return (
    <React.Fragment>
      <div className="page-head">
        <h1 className="page-title">Departments</h1>
        <p className="page-caption">{data.length} departments · equipment distribution and kit coverage</p>
        {canAdmin ? (
          <div className="page-head-actions">
            <button type="button" className="btn btn-primary" onClick={openAdd}><Icon d={ICONS.plus} size={14} /> Add department</button>
          </div>
        ) : null}
      </div>
      <div className="dept-grid">
        {data.map((d) => {
          const h = d.hue ?? deptHue(d.dept);
          return (
            <div className="dept-card tilt-3d" key={d.dept}>
              <button type="button" className="dept-card-main" onClick={() => setOpenDept(d.dept)}>
                <div className="dept-card-head">
                  <span className="dept-swatch" style={{ background: `oklch(0.58 0.15 ${h})` }}></span>
                  <span className="dept-card-name">{d.dept}</span>
                  <span className="dept-card-count">{d.count}</span>
                </div>
                <div className="dept-card-stats">
                  <span>{d.people} {d.people === 1 ? "person" : "people"}</span>
                  <span className="dot-sep">·</span>
                  <span>{d.dual} dual-monitor</span>
                </div>
                <div className="dept-bar">
                  <div className="dept-bar-fill" style={{ width: d.coverage + "%", background: `oklch(0.6 0.14 ${h})` }}></div>
                </div>
                <div className="dept-bar-label">{d.coverage}% peripheral coverage</div>
              </button>
              {canAdmin ? (
                <div className="dept-card-actions">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(d)}><Icon d={ICONS.edit} size={13} /> Edit</button>
                  <button type="button" className="btn btn-ghost-danger btn-sm" onClick={() => onDelete(d)}>Delete</button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <DeptFormModal open={formOpen} initial={editDept} onClose={() => { setFormOpen(false); setEditDept(null); setFormErr(""); }}
        onSubmit={submitForm} isPending={create.isPending || update.isPending} error={formErr} />
      <DepartmentModal dept={openDept} assets={assets}
        onClose={() => setOpenDept(null)}
        onSelectAsset={(a) => { setOpenDept(null); onSelectAsset(a); }}
        onViewAll={(d) => { setOpenDept(null); onOpenDept(d); }} />
    </React.Fragment>
  );
}

/* ---------- Reports page ---------- */
function cpuFamily(c) {
  if (!c) return "Not recorded";
  const s = c.toLowerCase();
  if (s.includes("mac")) return "Mac Mini";
  const m = s.match(/i\s*([3579])/);
  if (m) return "Intel i" + m[1];
  if (s.includes("ryzen")) return "AMD Ryzen";
  if (s.includes("celeron")) return "Celeron";
  if (s.includes("pentium")) return "Pentium";
  return "Other";
}
function ReportsPage({ assets, departments }) {
  const total = assets.length;
  const [detail, setDetail] = useState(null);
  // open the drill-down popup with a machine subset
  const show = (title, list) => setDetail({ title, subtitle: `${list.length} machine${list.length === 1 ? "" : "s"}`, columns: ASSET_COLS, rows: list });
  const periphData = useMemo(() => PERIPHERALS.map((p) => {
    const yes = assets.filter((a) => a[p.key]).length;
    return { key: p.key, label: p.label, icon: p.icon, yes, pct: total ? Math.round((yes / total) * 100) : 0 };
  }), [assets]);

  const deptCoverage = useMemo(() => departments.map((d) => {
    const list = assets.filter((a) => a.dept === d);
    return { dept: d, count: list.length, coverage: coverageOf(list) };
  }).filter((x) => x.count > 0).sort((a, b) => b.coverage - a.coverage), [assets, departments]);

  const ramDist = useMemo(() => {
    const m = {};
    assets.forEach((a) => { const k = a.ram || "Not recorded"; m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).map(([label, count]) => ({ label, count, gb: parseInt(label) || -1 }))
      .sort((a, b) => b.gb - a.gb);
  }, [assets]);

  const cpuDist = useMemo(() => {
    const m = {};
    assets.forEach((a) => { const k = cpuFamily(a.cpu); m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [assets]);

  const dual = assets.filter((a) => a.monitors === "Dual").length;
  const single = assets.filter((a) => a.monitors === "Single").length;
  const noMon = assets.filter((a) => a.monitors === "—").length;
  const shared = assets.filter((a) => a.shared).length;
  const avgCov = coverageOf(assets);

  const gaps = useMemo(() => {
    const defs = [
      { label: "No peripherals at all", pred: (a) => PERIPHERALS.every((p) => !a[p.key]), hint: "machines with an empty kit", sev: "high" },
      { label: "Missing headset", pred: (a) => !a.headphone, hint: "no headphone assigned", sev: "mid" },
      { label: "Missing IP phone", pred: (a) => !a.ipPhone, hint: "no desk phone line", sev: "mid" },
      { label: "Missing web cam", pred: (a) => !a.webcam, hint: "no camera on record", sev: "low" },
      { label: "Incomplete specs", pred: (a) => !a.cpu || !a.ram, hint: "CPU or RAM not recorded", sev: "high" },
    ];
    return defs.map((d) => ({ ...d, count: assets.filter(d.pred).length }));
  }, [assets]);

  const ramPeak = Math.max(1, ...ramDist.map((r) => r.count));
  const cpuPeak = Math.max(1, ...cpuDist.map((r) => r.count));
  const kpis = [
    { label: "Total machines", value: total, sub: `${(assets ? assets.length : 0)} in inventory`, list: () => assets },
    { label: "Departments", value: new Set(assets.map((a) => a.dept)).size, sub: "across the org" },
    { label: "Dual-monitor", value: dual, sub: `${total ? Math.round((dual / total) * 100) : 0}% of desks`, list: () => assets.filter((a) => a.monitors === "Dual") },
    { label: "Shared pool", value: shared, sub: "day-shift machines", list: () => assets.filter((a) => a.shared) },
    { label: "Avg coverage", value: avgCov + "%", sub: "peripheral kit", accent: true },
  ];

  return (
    <React.Fragment>
      <div className="page-head">
        <h1 className="page-title">Reports</h1>
        <p className="page-caption">Fleet composition, peripheral coverage, and equipment gaps</p>
      </div>

      <div id="fleet" className="report-kpis">
        {kpis.map((k) => {
          const inner = (
            <React.Fragment>
              <div className="report-kpi-label">{k.label}</div>
              <div className={"report-kpi-value" + (k.accent ? " stat-accent" : "")}>{k.value}</div>
              <div className="report-kpi-sub">{k.sub}</div>
            </React.Fragment>
          );
          return k.list
            ? <button type="button" className="report-kpi tilt-3d report-kpi-btn" key={k.label}
                onClick={() => show(k.label, k.list())}>{inner}</button>
            : <div className="report-kpi tilt-3d" key={k.label}>{inner}</div>;
        })}
      </div>

      <div className="report-grid">
        <div className="report-card tilt-3d">
          <div className="report-card-title">Processor &amp; memory</div>
          <div className="report-bars">
            {cpuDist.map((r) => (
              <button type="button" className="report-bar-row report-bar-btn" key={r.label}
                onClick={() => show(`CPU · ${r.label}`, assets.filter((a) => cpuFamily(a.cpu) === r.label))}>
                <span className="report-bar-label report-bar-label-ram">{r.label}</span>
                <div className="report-bar-track">
                  <div className="report-bar-fill" style={{ width: Math.max((r.count / cpuPeak) * 100, 2) + "%" }}></div>
                </div>
                <span className="report-bar-val">{r.count}</span>
              </button>
            ))}
          </div>
          <div className="report-sub-title">Memory (RAM)</div>
          <div className="report-bars">
            {ramDist.map((r) => (
              <button type="button" className="report-bar-row report-bar-btn" key={r.label}
                onClick={() => show(`RAM · ${r.label}`, assets.filter((a) => (a.ram || "Not recorded") === r.label))}>
                <span className="report-bar-label report-bar-label-ram">{r.label}</span>
                <div className="report-bar-track">
                  <div className="report-bar-fill" style={{ width: Math.max((r.count / ramPeak) * 100, 2) + "%" }}></div>
                </div>
                <span className="report-bar-val">{r.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="report-card tilt-3d">
          <div className="report-card-title">Monitor setup</div>
          <div className="mon-split">
            <button type="button" className="mon-split-item mon-split-btn" onClick={() => show("Monitor · Dual", assets.filter((a) => a.monitors === "Dual"))}>
              <div className="mon-split-num">{dual}</div>
              <div className="mon-split-lbl">Dual</div>
            </button>
            <button type="button" className="mon-split-item mon-split-btn" onClick={() => show("Monitor · Single", assets.filter((a) => a.monitors === "Single"))}>
              <div className="mon-split-num">{single}</div>
              <div className="mon-split-lbl">Single</div>
            </button>
            <button type="button" className="mon-split-item mon-split-btn" onClick={() => show("Monitor · Not recorded", assets.filter((a) => a.monitors === "—"))}>
              <div className="mon-split-num">{noMon}</div>
              <div className="mon-split-lbl">Not recorded</div>
            </button>
          </div>
          <div className="mon-stack">
            <div className="mon-stack-seg seg-dual" style={{ flex: dual }}></div>
            <div className="mon-stack-seg seg-single" style={{ flex: single }}></div>
            <div className="mon-stack-seg seg-none" style={{ flex: noMon }}></div>
          </div>

          <div className="report-sub-title">Peripheral distribution</div>
          <div className="report-bars">
            {periphData.map((p) => (
              <button type="button" className="report-bar-row report-bar-btn" key={p.label}
                onClick={() => show(`Has ${p.label}`, assets.filter((a) => a[p.key]))}>
                <span className="report-bar-label"><Icon d={p.icon} size={14} /> {p.label}</span>
                <div className="report-bar-track">
                  <div className="report-bar-fill" style={{ width: Math.max(p.pct, 2) + "%" }}></div>
                </div>
                <span className="report-bar-val">{p.pct}%</span>
              </button>
            ))}
          </div>
        </div>

        <div className="report-card report-card-wide">
          <div className="report-card-title">Peripheral coverage by department</div>
          <div className="report-bars report-bars-2col">
            {deptCoverage.map((d) => (
              <button type="button" className="report-bar-row report-bar-btn" key={d.dept}
                onClick={() => show(`${d.dept}`, assets.filter((a) => a.dept === d.dept))}>
                <span className="report-bar-label report-bar-label-dept">
                  <span className="dept-swatch sm" style={{ background: `oklch(0.58 0.15 ${deptHue(d.dept)})` }}></span>
                  {d.dept} <span className="report-bar-count">{d.count}</span>
                </span>
                <div className="report-bar-track">
                  <div className="report-bar-fill" style={{ width: Math.max(d.coverage, 2) + "%", background: `oklch(0.6 0.14 ${deptHue(d.dept)})` }}></div>
                </div>
                <span className="report-bar-val">{d.coverage}%</span>
              </button>
            ))}
          </div>
        </div>

        <div className="report-card report-card-wide">
          <div className="report-card-title">Equipment gaps
            <span className="report-card-hint">opportunities to complete the fleet</span>
          </div>
          <div className="gap-grid">
            {gaps.map((g) => (
              <button type="button" className={"gap-tile tilt-3d gap-btn gap-" + g.sev} key={g.label}
                onClick={() => show(g.label, assets.filter(g.pred))}>
                <div className="gap-count">{g.count}</div>
                <div className="gap-label">{g.label}</div>
                <div className="gap-hint">{g.hint}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <DetailModal data={detail} onClose={() => setDetail(null)} />
    </React.Fragment>
  );
}

/* ---------- Audit Log page ---------- */
const ACTION_META = {
  added: { label: "Added", cls: "act-green", icon: ICONS.plus },
  assigned: { label: "Assigned", cls: "act-accent", icon: ICONS.employees },
  reassigned: { label: "Reassigned", cls: "act-accent", icon: ICONS.employees },
  edited: { label: "Edited", cls: "act-blue", icon: ICONS.edit },
  removed: { label: "Removed", cls: "act-red", icon: ICONS.close },
  repair: { label: "Repair", cls: "act-amber", icon: ICONS.wrench || ICONS.reports },
  "stock-in":     { label: "Stock In",     cls: "act-green",  icon: ICONS.plus },
  "stock-out":    { label: "Stock Out",    cls: "act-red",    icon: ICONS.logout },
  "stock-return": { label: "Stock Return", cls: "act-accent", icon: ICONS.history },
  "stock-adjust": { label: "Stock Adjust", cls: "act-amber",  icon: ICONS.edit },
};
function fmtTime(d) {
  let h = d.getHours(), m = d.getMinutes();
  const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
  return h + ":" + String(m).padStart(2, "0") + " " + ap;
}
function dayLabel(d) {
  const n = new Date();
  const today = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today - a) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function AuditLogPage({ log, query }) {
  const [actionFilter, setActionFilter] = useState("All");
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return log.filter((e) => {
      if (actionFilter !== "All" && ACTION_META[e.action] && ACTION_META[e.action].label !== actionFilter) return false;
      if (q) {
        const hay = [e.tag, e.subject, e.dept, e.detail, e.actor].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [log, query, actionFilter]);

  const groups = useMemo(() => {
    const g = [];
    let cur = null;
    rows.forEach((e) => {
      const d = new Date(e.ts);
      const lbl = dayLabel(d);
      if (!cur || cur.label !== lbl) { cur = { label: lbl, items: [] }; g.push(cur); }
      cur.items.push({ ...e, d });
    });
    return g;
  }, [rows]);

  const actionOpts = ["All", "Added", "Assigned", "Edited", "Removed", "Repair"];

  return (
    <React.Fragment>
      <div className="page-head">
        <h1 className="page-title">Audit Log</h1>
        <p className="page-caption">Every equipment change — who, what, and when</p>
      </div>

      <div className="audit-filters">
        {actionOpts.map((o) => (
          <button type="button" key={o}
            className={"audit-chip" + (actionFilter === o ? " audit-chip-on" : "")}
            onClick={() => setActionFilter(o)}>{o}</button>
        ))}
        <span className="audit-count">{rows.length} {rows.length === 1 ? "event" : "events"}</span>
      </div>

      {groups.length === 0 ? (
        <div className="table-card">
          <div className="empty-state">
            <div className="empty-icon"><Icon d={ICONS.history} size={20} /></div>
            {log.length === 0 && !query.trim() && actionFilter === "All" ? (
              <React.Fragment>
                <div className="empty-title">No activity recorded yet</div>
                <div className="empty-sub">Equipment changes will appear here as they happen.</div>
              </React.Fragment>
            ) : (
              <React.Fragment>
                <div className="empty-title">No matching activity</div>
                <div className="empty-sub">Try a different search or filter.</div>
              </React.Fragment>
            )}
          </div>
        </div>
      ) : (
        <div className="audit-feed">
          {groups.map((grp) => (
            <div className="audit-day" key={grp.label}>
              <div className="audit-day-label">{grp.label}</div>
              <div className="audit-items">
                {grp.items.map((e, i) => {
                  const meta = ACTION_META[e.action] || ACTION_META.edited;
                  return (
                    <div className="audit-row" key={e.ts + "-" + i}>
                      <div className="audit-time">{fmtTime(e.d)}</div>
                      <div className={"audit-icon " + meta.cls}><Icon d={meta.icon} size={13} /></div>
                      <div className="audit-body">
                        <div className="audit-line">
                          <span className={"audit-action " + meta.cls}>{meta.label}</span>
                          <span className="mono audit-tag">{e.tag}</span>
                          <span className="audit-subject">{e.subject}</span>
                          <DeptBadge dept={e.dept} />
                        </div>
                        <div className="audit-detail">{e.detail}</div>
                      </div>
                      <div className="audit-actor">
                        <Avatar name={e.actor} size={22} />
                        <span>{e.actor}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </React.Fragment>
  );
}

/* ---------- Users (IT team) page ---------- */
function relTime(ts) {
  const d = new Date(ts), now = new Date();
  const days = Math.floor((now - d) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return days + " days ago";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
/* ---------- add / edit user modal ---------- */
function UserFormModal({ open, initial, onClose, onSubmit, isPending }) {
  const isEdit = !!initial;
  const blank = { name: "", email: "", role: "Viewer", phone: "", focus: "", since: "", password: "" };
  const [form, setForm] = useState(blank);
  const [err, setErr] = useState("");
  const ref = React.useRef(null);
  useFocusTrap(ref, open);
  useEffect(() => {
    if (!open) return;
    setErr("");
    setForm(initial ? { ...blank, ...initial, password: "" } : blank);
  }, [open, initial]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setErr("Name required");
    if (!isEdit && !/.+@.+\..+/.test(form.email)) return setErr("Valid email required");
    if (!isEdit && form.password && form.password.length < 10) return setErr("Password must be at least 10 characters");
    onSubmit(form);
  };
  return (
    <div className="modal-root">
      <div className="modal-scrim" onClick={onClose}></div>
      <form className="modal" onSubmit={submit} ref={ref} role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <div className="modal-title">{isEdit ? "Edit user" : "Add user"}</div>
            <div className="modal-subtitle">{isEdit ? "Update role and contact details." : "Create an IT team account."}</div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close form"><Icon d={ICONS.close} size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="form-cols">
            <label className="form-row"><span className="form-label">Name</span>
              <input className="input" value={form.name} onChange={set("name")} placeholder="e.g. Santosh" /></label>
            <label className="form-row"><span className="form-label">Email</span>
              <input className="input" type="email" value={form.email} onChange={set("email")} disabled={isEdit} placeholder="name@belgiumdia.com" autoComplete="off" /></label>
          </div>
          <div className="form-cols">
            <label className="form-row"><span className="form-label">Role</span>
              <select className="input" value={form.role} onChange={set("role")}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select></label>
            <label className="form-row"><span className="form-label">Phone</span>
              <input className="input" value={form.phone || ""} onChange={set("phone")} placeholder="Optional" /></label>
          </div>
          <label className="form-row"><span className="form-label">Focus / title</span>
            <input className="input" value={form.focus || ""} onChange={set("focus")} placeholder="e.g. Network & hardware" /></label>
          {!isEdit ? (
            <label className="form-row"><span className="form-label">Initial password <span className="form-optional">(blank = default Welcome!2026)</span></span>
              <input className="input" type="text" value={form.password} onChange={set("password")} placeholder="At least 10 chars, upper/lower/number" autoComplete="off" /></label>
          ) : null}
          {err ? <div className="login-err">{err}</div> : null}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={isPending}>{isEdit ? "Save changes" : "Create user"}</button>
        </div>
      </form>
    </div>
  );
}

/* ---------- reset password modal ---------- */
function PasswordModal({ user, onClose, onSubmit, isPending }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const ref = React.useRef(null);
  useFocusTrap(ref, !!user);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!user) return null;
  const submit = (e) => {
    e.preventDefault();
    if (pw.length < 10 || !/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/[0-9]/.test(pw))
      return setErr("At least 10 chars, with upper-case, lower-case and a number.");
    onSubmit(pw);
  };
  return (
    <div className="modal-root">
      <div className="modal-scrim" onClick={onClose}></div>
      <form className="modal" onSubmit={submit} ref={ref} role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <div className="modal-title">Reset password</div>
            <div className="modal-subtitle">{user.name} will be asked to change it at next sign-in.</div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon d={ICONS.close} size={16} /></button>
        </div>
        <div className="modal-body">
          <label className="form-row"><span className="form-label">New password</span>
            <input className="input" type="text" value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }}
              placeholder="At least 10 chars, upper/lower/number" autoComplete="off" autoFocus /></label>
          {err ? <div className="login-err">{err}</div> : null}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={isPending}>Set password</button>
        </div>
      </form>
    </div>
  );
}

function UsersPage({ users, log, canAdmin = false }) {
  const mgr = users.filter((u) => /manager/i.test(u.role)).length;
  const confirm = useConfirm();
  const { showToast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [pwUser, setPwUser] = useState(null);

  const createU = useCreateUser({ onSuccess: () => { setFormOpen(false); showToast("User created", "success"); }, onError: (e) => showToast(e.message, "error") });
  const updateU = useUpdateUser({ onSuccess: () => { setFormOpen(false); setEditUser(null); showToast("User updated", "success"); }, onError: (e) => showToast(e.message, "error") });
  const delU = useDeleteUser({ onSuccess: () => showToast("User deactivated", "success"), onError: (e) => showToast(e.message, "error") });
  const pwU = useSetUserPassword({ onSuccess: () => { setPwUser(null); showToast("Password reset", "success"); }, onError: (e) => showToast(e.message, "error") });

  const openAdd = () => { setEditUser(null); setFormOpen(true); };
  const openEdit = (u) => { setEditUser(u); setFormOpen(true); };
  const submitForm = (form) => {
    if (editUser) updateU.mutate({ id: editUser.id, input: { name: form.name, role: form.role, phone: form.phone, focus: form.focus } });
    else createU.mutate({ name: form.name, email: form.email, role: form.role, phone: form.phone, focus: form.focus, password: form.password || undefined });
  };
  const onDelete = async (u) => {
    if (await confirm({ title: `Deactivate ${u.name}?`, body: "They lose access immediately. History is kept.", confirmLabel: "Deactivate" }))
      delU.mutate(u.id);
  };

  return (
    <React.Fragment>
      <div className="page-head">
        <h1 className="page-title">Users</h1>
        <p className="page-caption">{users.length} IT team members · {mgr} manager · {users.length - mgr} members</p>
        {canAdmin ? (
          <div className="page-head-actions">
            <button type="button" className="btn btn-primary" onClick={openAdd}><Icon d={ICONS.plus} size={14} /> Add user</button>
          </div>
        ) : null}
      </div>
      <div className="users-grid">
        {users.map((u) => {
          const acts = log.filter((l) => l.actor === u.name);
          const last = acts[0];
          const isMgr = /manager/i.test(u.role);
          return (
            <div className="user-card tilt-3d" key={u.email || u.name}>
              <div className="user-card-head">
                <Avatar name={u.name} size={52} />
                <div className="user-id">
                  <div className="user-name">{u.name}</div>
                  <span className={"user-role " + (isMgr ? "role-mgr" : "role-mem")}>
                    {isMgr ? <Icon d={ICONS.shield} size={12} /> : null}{u.role}
                  </span>
                </div>
              </div>
              <p className="user-focus">{u.focus}</p>
              <div className="user-fields">
                <div className="user-field"><span className="user-field-ico"><Icon d={ICONS.mail} size={14} /></span>{u.email}</div>
                <div className="user-field"><span className="user-field-ico"><Icon d={ICONS.ipphone} size={14} /></span>{u.phone}</div>
                <div className="user-field"><span className="user-field-ico"><Icon d={ICONS.history} size={14} /></span>Joined {new Date(u.since).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</div>
              </div>
              <div className="user-foot">
                <div className="user-stat"><b>{acts.length}</b> changes logged</div>
                {last ? <div className="user-last">Last edit {relTime(last.ts)} · <span className="mono">{last.tag}</span></div> : <div className="user-last">No activity yet</div>}
              </div>
              {canAdmin ? (
                <div className="user-actions">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(u)}><Icon d={ICONS.edit} size={13} /> Edit</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPwUser(u)}><Icon d={ICONS.shield} size={13} /> Password</button>
                  <button type="button" className="btn btn-ghost-danger btn-sm" onClick={() => onDelete(u)}>Deactivate</button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <UserFormModal open={formOpen} initial={editUser} onClose={() => { setFormOpen(false); setEditUser(null); }}
        onSubmit={submitForm} isPending={createU.isPending || updateU.isPending} />
      <PasswordModal user={pwUser} onClose={() => setPwUser(null)}
        onSubmit={(pw) => pwU.mutate({ id: pwUser.id, password: pw })} isPending={pwU.isPending} />
    </React.Fragment>
  );
}

export { coverageOf, cpuFamily, DashboardInsights, DepartmentModal, DepartmentsPage, ReportsPage, AuditLogPage, UsersPage };

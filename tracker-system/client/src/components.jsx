// Task Source — IT Asset Tracker · shared UI components (ported to ES modules)
import React, { useState, useEffect, useRef } from "react";
import { DEPT_HUE } from "@its/shared/constants";

/* ---------- helpers ---------- */
export function useIsMobile(bp = 860) {
  const q = `(max-width: ${bp}px)`;
  const [m, setM] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = (e) => setM(e.matches);
    mq.addEventListener ? mq.addEventListener("change", on) : mq.addListener(on);
    setM(mq.matches);
    return () => {mq.removeEventListener ? mq.removeEventListener("change", on) : mq.removeListener(on);};
  }, [q]);
  return m;
}
export function initials(name) {
  const parts = String(name || "").split(/[\s-]+/).filter(Boolean);
  return ((parts[0]?.[0] || "?") + (parts[1] ? parts[1][0] : "")).toUpperCase();
}
export function deptHue(dept) { return DEPT_HUE && DEPT_HUE[dept] != null ? DEPT_HUE[dept] : 240; }

/* ---------- icons ---------- */
export function Icon({ d, size = 16, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {d}
    </svg>);
}
export const ICONS = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect></>,
  download: <><path d="M12 3v12"></path><path d="m7 11 5 5 5-5"></path><path d="M5 21h14"></path></>,
  upload: <><path d="M12 21V9"></path><path d="m7 13 5-5 5 5"></path><path d="M5 3h14"></path></>,
  template: <><rect x="4" y="3" width="16" height="18" rx="2"></rect><path d="M8 8h8"></path><path d="M8 12h8"></path><path d="M8 16h5"></path></>,
  help: <><circle cx="12" cy="12" r="9"></circle><path d="M9.5 9a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2 2-2 3"></path><path d="M12 17h.01"></path></>,
  employees: <><circle cx="9" cy="8" r="3.2"></circle><path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5"></path><path d="M16 5.4a3.2 3.2 0 0 1 0 5.2"></path><path d="M17.5 14.8c1.8.7 3 2.2 3 4.2"></path></>,
  assets: <><path d="m12 2 8.5 4.8v9.6L12 21.2l-8.5-4.8V6.8z"></path><path d="m3.8 7 8.2 4.6L20.2 7"></path><path d="M12 11.6V21"></path></>,
  departments: <><path d="M4 21V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v16"></path><path d="M12 9h7a1 1 0 0 1 1 1v11"></path><path d="M3 21h18"></path><path d="M7 8h.01M7 12h.01M7 16h.01M16 13h.01M16 17h.01"></path></>,
  reports: <><path d="M4 20V10"></path><path d="M10 20V4"></path><path d="M16 20v-8"></path><path d="M22 20H2"></path></>,
  search: <><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.2-3.2"></path></>,
  menu: <><path d="M3 6h18M3 12h18M3 18h18"></path></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"></path><path d="M3 4v4h4"></path><path d="M12 8v4l3 2"></path></>,
  bell: <><path d="M18 8.5a6 6 0 0 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5"></path><path d="M13.7 19.5a2 2 0 0 1-3.4 0"></path></>,
  shield: <><path d="M12 3 5 5.8v5.5c0 4.3 3 7.8 7 8.9 4-1.1 7-4.6 7-8.9V5.8z"></path><circle cx="12" cy="10" r="2.2"></circle><path d="M8.4 15.2a3.8 3.8 0 0 1 7.2 0"></path></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><path d="m16 17 5-5-5-5"></path><path d="M21 12H9"></path></>,
  wrench: <><path d="M14.6 6.5a3.5 3.5 0 0 1-4.7 4.3l-5 5a1.6 1.6 0 0 1-2.3-2.3l5-5a3.5 3.5 0 0 1 4.3-4.7l-2.2 2.2 1.8 1.8z"></path></>,
  plus: <><path d="M12 5v14"></path><path d="M5 12h14"></path></>,
  chevDown: <path d="m6 9 6 6 6-6"></path>,
  close: <><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></>,
  check: <path d="m4.5 12.5 5 5 10-11"></path>,
  desktop: <><rect x="3" y="4" width="18" height="12" rx="2"></rect><path d="M8 20h8"></path><path d="M12 16v4"></path></>,
  laptop: <><rect x="4" y="5" width="16" height="11" rx="1.5"></rect><path d="M2 19h20"></path></>,
  monitor: <><rect x="3" y="4" width="18" height="13" rx="2"></rect><path d="M9 21h6"></path><path d="M12 17v4"></path></>,
  monitors: <><rect x="2.5" y="5" width="9" height="8" rx="1.4"></rect><rect x="12.5" y="5" width="9" height="8" rx="1.4"></rect><path d="M7 17h10M12 13v4"></path></>,
  cpu: <><rect x="6" y="6" width="12" height="12" rx="2"></rect><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"></path></>,
  ram: <><rect x="2.5" y="8" width="19" height="8" rx="1.5"></rect><path d="M6 16v2M10 16v2M14 16v2M18 16v2M6 11h2M11 11h2M16 11h2"></path></>,
  hdd: <><rect x="3" y="6" width="18" height="12" rx="2"></rect><path d="M7 12h.01"></path><circle cx="16.5" cy="12" r="1.6"></circle></>,
  headphone: <><path d="M4 14v-2a8 8 0 0 1 16 0v2"></path><rect x="3" y="14" width="4" height="6" rx="1.5"></rect><rect x="17" y="14" width="4" height="6" rx="1.5"></rect></>,
  speaker: <><rect x="6" y="2.5" width="12" height="19" rx="2.5"></rect><circle cx="12" cy="15" r="3"></circle><path d="M12 7h.01"></path></>,
  ipphone: <><rect x="6" y="2.5" width="12" height="14" rx="2"></rect><path d="M9 19h6M10 22h4M9 6h6M9 9h6"></path></>,
  webcam: <><circle cx="12" cy="11" r="6.5"></circle><circle cx="12" cy="11" r="2.4"></circle><path d="M7 20h10"></path></>,
  mobilestand: <><rect x="8" y="2.5" width="8" height="13" rx="1.8"></rect><path d="M12 19v2M8 21h8M6 15l6 4 6-4"></path></>,
  keyboard: <><rect x="2" y="6" width="20" height="12" rx="2"></rect><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h12"></path></>,
  mouse: <><rect x="7" y="3" width="10" height="18" rx="5"></rect><path d="M12 7v4"></path></>,
  pin: <><path d="M12 17v5"></path><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16h14v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"></path></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="m3.5 7 8.5 6 8.5-6"></path></>,
  diamond: <><path d="M5 3h14l3 6-10 12L2 9z"></path><path d="M2 9h20M9 3 7 9l5 12 5-12-2-6M5 9l4 0M15 9l4 0"></path></>,
  edit: <><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path></>
};
export function typeIcon(t) { return ICONS[(t || "").toLowerCase()] || ICONS.desktop; }

/* ---------- atoms ---------- */
export function Avatar({ name, shared, size = 30 }) {
  if (shared) {
    return (
      <span className="avatar avatar-shared" style={{ width: size, height: size }}>
        <Icon d={ICONS.desktop} size={size * 0.5} />
      </span>);
  }
  const hue = (() => {let h = 0;const n = String(name || "");for (let i = 0; i < n.length; i++) h = h * 31 + n.charCodeAt(i) >>> 0;return [248, 210, 168, 28, 330, 140, 272, 12, 92, 200][h % 10];})();
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38,
      background: `oklch(0.93 0.045 ${hue})`, color: `oklch(0.44 0.10 ${hue})` }}>
      {initials(name)}
    </span>);
}

export function DeptBadge({ dept }) {
  const h = deptHue(dept);
  return (
    <span className="dept-badge" style={{ background: `oklch(0.95 0.035 ${h})`, color: `oklch(0.45 0.11 ${h})` }}>
      <span className="dept-dot" style={{ background: `oklch(0.58 0.15 ${h})` }}></span>
      {dept}
    </span>);
}

export const PERIPHERALS = [
  { key: "headphone", label: "Headphone", icon: ICONS.headphone },
  { key: "speaker", label: "Speaker", icon: ICONS.speaker },
  { key: "keyboard", label: "Keyboard", icon: ICONS.keyboard },
  { key: "mouse", label: "Mouse", icon: ICONS.mouse },
  { key: "ipPhone", label: "IP Phone", icon: ICONS.ipphone },
  { key: "webcam", label: "Web Cam", icon: ICONS.webcam },
  { key: "mobileStand", label: "Mobile Stand", icon: ICONS.mobilestand }];

export function PeriphChips({ asset }) {
  return (
    <span className="periph-row">
      {PERIPHERALS.map((p) =>
      <span key={p.key} className={"periph-chip" + (asset[p.key] ? " periph-on" : " periph-off")}
      title={p.label + ": " + (asset[p.key] ? "Yes" : "No")}>
          <Icon d={p.icon} size={13} />
        </span>
      )}
    </span>);
}

export function MonitorCell({ value }) {
  if (value === "—") return <span className="cell-muted">—</span>;
  return (
    <span className={"mon-tag" + (value === "Dual" ? " mon-dual" : "")}>
      <Icon d={value === "Dual" ? ICONS.monitors : ICONS.monitor} size={14} />
      {value}
    </span>);
}

/* ---------- stat card ---------- */
export function StatCard({ label, value, sub, accent, icon, ring, tone, onClick, trend }) {
  // tone: 'danger' (red, attention needed) | 'warn' (amber) — colors the number when a
  // threshold is crossed. onClick makes the whole card a button that drills into the page.
  // trend: { delta, good } — Δ vs last week; `good` says whether that direction is healthy.
  const cls = "stat-card tilt-3d"
    + (tone ? " stat-" + tone : "")
    + (onClick ? " stat-clickable" : "");
  const inner = (
    <React.Fragment>
      <div className="stat-top">
        <div className="stat-label">{label}</div>
        {icon ?
        <span className="stat-icon" style={ring ? { background: `oklch(0.95 0.035 ${ring})`, color: `oklch(0.5 0.13 ${ring})` } : undefined}>
            <Icon d={icon} size={16} />
          </span> :
        null}
      </div>
      <div className="stat-value-row">
        <div className={"stat-value" + (accent ? " stat-accent" : "")}>{value}</div>
        <TrendChip trend={trend} />
      </div>
      <div className="stat-sub">{sub}</div>
    </React.Fragment>
  );
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} aria-label={`${label}: ${value}. ${sub}`}>
        {inner}
      </button>
    );
  }
  return <div className={cls}>{inner}</div>;
}

// Δ-vs-last-week chip. delta null → render nothing (no baseline yet). 0 → flat "no change".
// `good` decides color: a fall in "bad" metrics (overdue, breaches) is green; a fall in
// "good" metrics (utilization, spares) is red.
function TrendChip({ trend }) {
  if (!trend || trend.delta == null) return null;
  const d = trend.delta;
  if (d === 0) return null; // no movement vs last week → show nothing (avoid "→ 0" noise)
  const up = d > 0;
  const healthy = trend.good ? up : !up;            // is this movement a good thing?
  const mag = Math.abs(d) % 1 === 0 ? Math.abs(d) : Math.abs(d).toFixed(1);
  return (
    <span className={"stat-trend " + (healthy ? "stat-trend-up" : "stat-trend-down")}
      title={`${up ? "Up" : "Down"} ${mag} vs last week`}>
      {up ? "▲" : "▼"} {mag}
    </span>
  );
}

/* ---------- filter dropdown ---------- */
export function FilterDropdown({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const [active2, setActive2] = useState(0);
  const ref = useRef(null);
  const items = ["All", ...options];
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  useEffect(() => { if (open) setActive2(Math.max(0, items.indexOf(value))); }, [open]);
  const active = value !== "All";
  const onKey = (e) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(true); }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive2((i) => (i + 1) % items.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive2((i) => (i - 1 + items.length) % items.length); }
    else if (e.key === "Enter") { e.preventDefault(); onChange(items[active2]); setOpen(false); }
    else if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
    else if (e.key === "Home") { e.preventDefault(); setActive2(0); }
    else if (e.key === "End") { e.preventDefault(); setActive2(items.length - 1); }
  };
  return (
    <div className="filter-dd" ref={ref}>
      <button type="button" className={"filter-btn" + (active ? " filter-btn-active" : "")}
        onClick={() => setOpen(!open)} onKeyDown={onKey}
        aria-haspopup="listbox" aria-expanded={open}>
        <span className="filter-btn-label">{label}{active ? ":" : ""}</span>
        {active ? <span className="filter-btn-value">{value}</span> : null}
        <Icon d={ICONS.chevDown} size={13} />
      </button>
      {open ?
      <div className="filter-menu" role="listbox" onKeyDown={onKey} tabIndex={-1}>
          {items.map((opt, i) =>
        <button type="button" key={opt} role="option"
          aria-selected={value === opt}
          className={"filter-item" + (value === opt ? " filter-item-active" : "") + (i === active2 ? " filter-item-focused" : "")}
          onClick={() => { onChange(opt); setOpen(false); }}
          onMouseEnter={() => setActive2(i)}>
              <span>{opt}</span>
              {value === opt ? <Icon d={ICONS.check} size={13} /> : null}
            </button>
        )}
        </div> :
      null}
    </div>);
}

/* ---------- sidebar ---------- */
export function Sidebar({ active, onNavigate, open, onClose, counts = {}, user, onLogout }) {
  const groups = [
  // S2 — primary nav (no group label per audit)
  { label: "", items: [
    { key: "Dashboard", icon: ICONS.dashboard },
    { key: "Employees", icon: ICONS.employees },
    { key: "Assets", icon: ICONS.assets },
    { key: "Departments", icon: ICONS.departments }]
  },
  { label: "Stock", items: [
    { key: "Stock Overview", icon: ICONS.hdd },
    { key: "Stock Operations", icon: ICONS.assets }]
  },
  { label: "Service & Renewals", items: [
    { key: "Alerts", icon: ICONS.bell },
    { key: "Repairs", icon: ICONS.wrench },
    { key: "Software", icon: ICONS.diamond }]
  },
  { label: "Procurement", items: [
    { key: "Purchase Requests", icon: ICONS.template }]
  },
  { label: "Insights", items: [
    { key: "Reports", icon: ICONS.reports }]
  },
  { label: "Administration", items: [
    { key: "Audit Log", icon: ICONS.history },
    { key: "Users", icon: ICONS.shield }]
  }];

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {if (e.key === "Escape") onClose && onClose();};
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <React.Fragment>
      <div className={"side-scrim" + (open ? " side-scrim-on" : "")} onClick={onClose}></div>
      <nav className={"sidebar" + (open ? " sidebar-open" : "")}>
        <div className="side-brand">
          <span className="side-brand-text">
            <span className="side-brand-name">IT Asset Tracker</span>
          </span>
          <button type="button" className="icon-btn side-close" onClick={onClose} aria-label="Close menu">
            <Icon d={ICONS.close} size={16} />
          </button>
        </div>
        <div className="sidebar-nav">
          {groups.map((g) =>
          <div className="nav-group" key={g.label}>
              {g.label ? <div className="nav-group-label">{g.label}</div> : null}
              {g.items.map((it) =>
            <button type="button" key={it.key}
            className={"nav-item" + (active === it.key ? " nav-item-active" : "")}
            onClick={() => {onNavigate(it.key);onClose && onClose();}}>
                  <span className="nav-item-ico"><Icon d={it.icon} size={17} /></span>
                  <span className="nav-item-label">{it.key}</span>
                  {counts[it.key] != null ? <span className="nav-count">{counts[it.key]}</span> : null}
                </button>
            )}
            </div>
          )}
        </div>
        <div className="sidebar-foot">
          <Avatar name={user ? user.name : "Account"} size={30} />
          <div className="sidebar-foot-meta">
            <div className="sidebar-foot-name">{user ? user.name : "Account"}</div>
            <div className="sidebar-foot-role">{user ? user.role : ""}</div>
          </div>
          <button type="button" className="sidebar-logout" onClick={onLogout} aria-label="Sign out" title="Sign out">
            <Icon d={ICONS.logout} size={16} />
          </button>
        </div>
      </nav>
    </React.Fragment>);
}

/* ---------- field ---------- */
export function Field({ label, children }) {
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      <div className="field-value">{children}</div>
    </div>);
}

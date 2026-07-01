// Shared primitives: Avatar, StatusPill, StatCard, Dropdown, Drawer, AssignModal, icons

const Icon = {
  search: (p) => (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" {...p}><circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5"></circle><path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"></path></svg>
  ),
  plus: (p) => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" {...p}><path d="M8 2.5v11M2.5 8h11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"></path></svg>
  ),
  chevron: (p) => (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" {...p}><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"></path></svg>
  ),
  x: (p) => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" {...p}><path d="M3.5 3.5l9 9m0-9l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"></path></svg>
  ),
  arrowUp: (p) => (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" {...p}><path d="M8 13V3m0 0L4 7m4-4l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path></svg>
  ),
  dashboard: (p) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" {...p}><rect x="2" y="2" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.4"></rect><rect x="9" y="2" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.4"></rect><rect x="2" y="9" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.4"></rect><rect x="9" y="9" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.4"></rect></svg>
  ),
  people: (p) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" {...p}><circle cx="8" cy="5" r="2.6" stroke="currentColor" strokeWidth="1.4"></circle><path d="M2.8 13.5c.7-2.4 2.8-3.7 5.2-3.7s4.5 1.3 5.2 3.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"></path></svg>
  ),
  monitor: (p) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" {...p}><rect x="2" y="2.8" width="12" height="8.4" rx="1.4" stroke="currentColor" strokeWidth="1.4"></rect><path d="M5.5 14h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"></path></svg>
  ),
  chart: (p) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" {...p}><path d="M3 13.5V8.5M8 13.5V3.5M13 13.5V6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"></path></svg>
  ),
};

// Deterministic soft avatar color from a name
function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return { bg: `oklch(0.93 0.04 ${hue})`, fg: `oklch(0.45 0.09 ${hue})` };
}

function initialsOf(name) {
  const parts = name.replace(/\(.*?\)/g, '').trim().split(/\s+/);
  return ((parts[0] || ' ')[0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

function Avatar({ name, size = 24 }) {
  const c = avatarColor(name);
  return (
    <span className="avatar" style={{ width: size, height: size, background: c.bg, color: c.fg, fontSize: size * 0.4 }}>
      {initialsOf(name)}
    </span>
  );
}

function StatusPill({ status }) {
  const cls = status === 'Assigned' ? 'pill-assigned' : status === 'In Repair' ? 'pill-repair' : 'pill-available';
  return <span className={'pill ' + cls}><span className="pill-dot"></span>{status}</span>;
}

function StatCard({ label, value, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub ? <div className="stat-sub">{sub}</div> : null}
    </div>
  );
}

// Filter dropdown: button + popover menu, single-select with "All" reset
function Dropdown({ label, value, options, onChange }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const active = value !== 'All';
  return (
    <div className="dropdown" ref={ref}>
      <button type="button" className={'dd-btn' + (active ? ' dd-active' : '')} onClick={() => setOpen(!open)}>
        <span className="dd-label">{label}</span>
        {active ? <span className="dd-value">{value}</span> : null}
        <Icon.chevron style={{ opacity: 0.55 }} />
      </button>
      {open ? (
        <div className="dd-menu">
          {['All', ...options].map((opt) => (
            <button type="button" key={opt} className={'dd-item' + (opt === value ? ' dd-item-on' : '')}
              onClick={() => { onChange(opt); setOpen(false); }}>
              <span className="dd-check">{opt === value ? '✓' : ''}</span>{opt}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : null}
    </label>
  );
}

const PERIPH_LABELS = { headphone: 'Headset', speaker: 'Speaker', ipPhone: 'IP Phone', webcam: 'Webcam', mobileStand: 'Mobile Stand' };

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

Object.assign(window, { Icon, Avatar, StatusPill, StatCard, Dropdown, Field, PERIPH_LABELS, fmtDate, avatarColor, initialsOf });

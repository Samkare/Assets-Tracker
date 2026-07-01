// Task Source — Alerts page (warranty, returns, renewals & low stock)
import React from "react";
import { Icon, ICONS, DeptBadge } from "./components.jsx";
import { useAlerts } from "./api/hooks.js";

function daysUntil(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return Math.round((d - new Date()) / 86400000);
}
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* date badge — past => danger, soon => warn */
function DateBadge({ iso }) {
  const dleft = daysUntil(iso);
  const past = dleft != null && dleft < 0;
  return (
    <span className="alert-date" style={{ color: past ? "var(--danger)" : "var(--warn)", borderColor: past ? "var(--danger)" : "var(--warn)" }}>
      {fmtDate(iso)}
      {dleft != null ? <span className="alert-date-rel">{past ? `${Math.abs(dleft)}d ago` : `${dleft}d`}</span> : null}
    </span>
  );
}

/* a single compact alert row */
function AlertRow({ icon, label, sub, mono, iso, badge }) {
  return (
    <div className="alert-row">
      <span className="alert-row-ico"><Icon d={icon} size={15} /></span>
      <div className="alert-row-body">
        <div className="alert-row-label">
          {label}
          {mono ? <span className="mono alert-row-id">{mono}</span> : null}
        </div>
        {sub ? <div className="alert-row-sub">{sub}</div> : null}
      </div>
      {iso != null ? <DateBadge iso={iso} /> : badge ? badge : null}
    </div>
  );
}

function AlertSection({ title, icon, tone, items, render }) {
  if (!items || !items.length) return null;
  return (
    <div className="table-card alert-section">
      <div className="alert-section-head">
        <span className="alert-section-ico" style={tone ? { color: tone } : undefined}><Icon d={icon} size={15} /></span>
        <span className="alert-section-title">{title}</span>
        <span className="alert-section-count">{items.length}</span>
      </div>
      <div className="alert-list">
        {items.map(render)}
      </div>
    </div>
  );
}

function AlertsPage() {
  const { data } = useAlerts();
  const a = data || {};
  const count = a.count || 0;

  const assetRow = (icon, tone) => (it) => (
    <AlertRow key={it.id} icon={icon}
      label={it.pseudo || "—"} mono={it.id}
      sub={it.dept ? <DeptBadge dept={it.dept} /> : null} iso={it.date} />
  );

  return (
    <React.Fragment>
      <div className="page-head">
        <h1 className="page-title">Alerts</h1>
        <p className="page-caption">Warranty, returns, renewals &amp; low stock</p>
      </div>

      {count === 0 ? (
        <div className="table-card">
          <div className="empty-state">
            <div className="empty-icon"><Icon d={ICONS.shield} size={20} /></div>
            <div className="empty-title">All clear — no alerts</div>
            <div className="empty-sub">Nothing needs attention right now.</div>
          </div>
        </div>
      ) : (
        <div className="alert-stack">
          <AlertSection title="SLA breaches (repair open > 7 days)" icon={ICONS.wrench} tone="var(--danger)"
            items={a.slaBreaches} render={(s) => (
              <AlertRow key={s.id} icon={ICONS.wrench}
                label={s.asset_id || "Ticket #" + s.id}
                sub={`${s.issue}${s.assignee ? " · " + s.assignee : ""}`}
                iso={s.date} badge={<span className="alert-low-badge">{s.days_open}d</span>} />
            )} />
          <AlertSection title="Overdue returns" icon={ICONS.history} tone="var(--danger)"
            items={a.overdueReturns} render={assetRow(ICONS.history)} />
          <AlertSection title="Software renewals" icon={ICONS.diamond} tone="var(--warn)"
            items={a.softwareRenewals} render={(sw) => (
              <AlertRow key={sw.id} icon={ICONS.diamond}
                label={sw.name} sub={sw.vendor || null} iso={sw.date} />
            )} />
          <AlertSection title="Low stock" icon={ICONS.wrench} tone="var(--warn)"
            items={a.lowStock} render={(c) => (
              <AlertRow key={c.id} icon={ICONS.wrench}
                label={c.name} sub={`qty ${c.qty} / reorder at ${c.reorder_level} · suggest +${c.suggestedReorder}`} iso={null}
                badge={<span className="alert-low-badge">Low</span>} />
            )} />
        </div>
      )}
    </React.Fragment>
  );
}

export { AlertsPage };

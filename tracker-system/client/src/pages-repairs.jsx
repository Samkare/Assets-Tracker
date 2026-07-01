// Task Source — Repairs page (maintenance tickets across the fleet)
import React, { useState } from "react";
import { Icon, ICONS, DeptBadge } from "./components.jsx";
import { useRepairs, useUpdateRepair } from "./api/hooks.js";
import { SkeletonTable } from "./Skeleton.jsx";

const STATUS_META = {
  open: { label: "Open", color: "var(--warn)" },
  in_progress: { label: "In progress", color: "var(--accent)" },
  resolved: { label: "Resolved", color: "var(--success)" },
  closed: { label: "Closed", color: "var(--success)" },
};
function StatusPill({ status }) {
  const label = (STATUS_META[status] && STATUS_META[status].label) || status;
  return <span className="status-pill" data-s={status}>{label}</span>;
}
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const FILTERS = ["All", "open", "in_progress", "resolved", "closed"];
const FILTER_LABEL = { All: "All", open: "Open", in_progress: "In progress", resolved: "Resolved", closed: "Closed" };

/* ---------- inline status actions ---------- */
function RepairActions({ ticket }) {
  const [resOpen, setResOpen] = useState(false);
  const [resolution, setResolution] = useState("");
  const update = useUpdateRepair({ onSuccess: () => { setResOpen(false); setResolution(""); } });
  const advance = (status, extra = {}) => update.mutate({ id: ticket.id, input: { status, ...extra } });

  return (
    <div className="repair-actions">
      {ticket.status === "open" ? (
        <button type="button" className="btn btn-secondary btn-sm" disabled={update.isPending}
          onClick={() => advance("in_progress")}>→ In progress</button>
      ) : null}
      {ticket.status === "open" || ticket.status === "in_progress" ? (
        resOpen ? (
          <span className="repair-resolve-inline">
            <input className="input" placeholder="Resolution (optional)" value={resolution}
              onChange={(e) => setResolution(e.target.value)} />
            <button type="button" className="btn btn-primary btn-sm" disabled={update.isPending}
              onClick={() => advance("resolved", resolution.trim() ? { resolution: resolution.trim() } : {})}>Resolve</button>
            <button type="button" className="btn btn-secondary btn-sm" disabled={update.isPending}
              onClick={() => advance("closed", resolution.trim() ? { resolution: resolution.trim() } : {})}>Close</button>
            <button type="button" className="icon-btn" onClick={() => setResOpen(false)} aria-label="Cancel">
              <Icon d={ICONS.close} size={14} />
            </button>
          </span>
        ) : (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setResOpen(true)}>Resolve / close…</button>
        )
      ) : null}
    </div>
  );
}

function RepairsPage({ canManage }) {
  const [filter, setFilter] = useState("All");
  const { data: tickets = [], isLoading } = useRepairs(filter === "All" ? {} : { status: filter });

  return (
    <React.Fragment>
      <div className="page-head">
        <h1 className="page-title">Repairs</h1>
        <p className="page-caption">Maintenance tickets across the fleet</p>
      </div>

      <div className="audit-filters">
        {FILTERS.map((o) => (
          <button type="button" key={o}
            className={"audit-chip" + (filter === o ? " audit-chip-on" : "")}
            onClick={() => setFilter(o)}>{FILTER_LABEL[o]}</button>
        ))}
        <span className="audit-count">{tickets.length} {tickets.length === 1 ? "ticket" : "tickets"}</span>
      </div>

      {isLoading ? (
        <div className="table-card"><div style={{ padding: "var(--sp-16)" }}><SkeletonTable rows={5} cols={6} /></div></div>
      ) : tickets.length === 0 ? (
        <div className="table-card">
          <div className="empty-state">
            <div className="empty-icon"><Icon d={ICONS.wrench} size={20} /></div>
            <div className="empty-title">All clear — no repair tickets</div>
            <div className="empty-sub">Open one from the Edit panel of any asset to start tracking a repair.</div>
          </div>
        </div>
      ) : (
        <div className="table-card">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th><span className="th-plain">Asset</span></th>
                  <th><span className="th-plain">Department</span></th>
                  <th><span className="th-plain">Issue</span></th>
                  <th><span className="th-plain">Status</span></th>
                  <th><span className="th-plain">Assignee</span></th>
                  <th><span className="th-plain">Cost</span></th>
                  <th><span className="th-plain">Opened</span></th>
                  {canManage ? <th><span className="th-plain">Actions</span></th> : null}
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <span className="mono cell-tag">{t.asset_id}</span>
                      {t.asset_pseudo ? <span className="cell-muted"> · {t.asset_pseudo}</span> : null}
                    </td>
                    <td>{t.dept ? <DeptBadge dept={t.dept} /> : <span className="cell-muted">—</span>}</td>
                    <td>{t.issue}</td>
                    <td><StatusPill status={t.status} /></td>
                    <td>{t.assignee || <span className="cell-muted">—</span>}</td>
                    <td>{t.cost != null && t.cost !== "" ? <span className="mono">${Number(t.cost).toLocaleString()}</span> : <span className="cell-muted">—</span>}</td>
                    <td className="cell-muted">{fmtDate(t.opened_at)}</td>
                    {canManage ? (
                      <td>{(t.status === "open" || t.status === "in_progress") ? <RepairActions ticket={t} /> : <span className="cell-muted">—</span>}</td>
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

export { RepairsPage };

// Bell-dropdown feed: my-assigned repairs + alerts + recent audit highlights.
import db from "../db/connection.js";
import { alerts } from "./alerts.service.js";

export function notifications(userName) {
  const a = alerts();
  // repairs assigned to me, still open
  const myRepairs = userName ? db.prepare(`
    SELECT id, asset_id, issue, status, opened_at
    FROM repair_tickets
    WHERE assignee = ? AND status IN ('open','in_progress')
    ORDER BY opened_at DESC LIMIT 10`).all(userName) : [];

  const items = [];
  for (const r of myRepairs) items.push({
    kind: "repair", id: `rep-${r.id}`, title: `Repair: ${r.asset_id}`,
    sub: r.issue, time: r.opened_at, tone: "warn"
  });
  for (const b of a.slaBreaches || []) items.push({
    kind: "sla", id: `sla-${b.id}`, title: `SLA breach (${b.days_open}d)`,
    sub: `${b.asset_id} · ${b.issue}`, time: b.date, tone: "danger"
  });
  for (const w of a.overdueReturns || []) items.push({
    kind: "return", id: `ret-${w.id}`, title: `Overdue return`,
    sub: `${w.id} · ${w.pseudo}`, time: w.date, tone: "danger"
  });
  for (const s of a.softwareRenewals || []) items.push({
    kind: "renewal", id: `sw-${s.id}`, title: `License renewal due`,
    sub: `${s.name}${s.vendor ? " · " + s.vendor : ""}`, time: s.date, tone: "warn"
  });
  for (const l of a.lowStock || []) items.push({
    kind: "low", id: `low-${l.id}`, title: `Low stock: ${l.name}`,
    sub: `qty ${l.qty} / reorder ${l.reorder_level}`, time: null, tone: "warn"
  });

  items.sort((x, y) => (x.time || "0") < (y.time || "0") ? 1 : -1);
  return { count: items.length, items: items.slice(0, 20) };
}

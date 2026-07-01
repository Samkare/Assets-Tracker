import db from "../db/connection.js";

export function summary() {
  const totals = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN shared = 0 THEN 1 ELSE 0 END) AS assigned,
      SUM(CASE WHEN shared = 1 THEN 1 ELSE 0 END) AS shared,
      SUM(CASE WHEN monitors = 'Dual' THEN 1 ELSE 0 END) AS dual,
      SUM(CASE WHEN status = 'repair' THEN 1 ELSE 0 END) AS inRepair,
      SUM(headphone+speaker+keyboard+mouse+ip_phone+webcam+mobile_stand) AS periphOn
    FROM assets WHERE status != 'retired'
  `).get();

  const employees = db.prepare(
    "SELECT COUNT(DISTINCT pseudo) AS n FROM assets WHERE shared = 0 AND status != 'retired'"
  ).get().n;
  const depts = db.prepare("SELECT COUNT(*) AS n FROM departments WHERE active = 1").get().n;

  const coverage = totals.total
    ? Math.round((totals.periphOn / (totals.total * 7)) * 100)
    : 0;

  const byDept = db.prepare(`
    SELECT d.name AS dept, COUNT(a.id) AS count,
           COUNT(DISTINCT CASE WHEN a.shared = 0 THEN a.pseudo END) AS people,
           SUM(CASE WHEN a.monitors = 'Dual' THEN 1 ELSE 0 END) AS dual
    FROM departments d LEFT JOIN assets a ON a.department_id = d.id AND a.status != 'retired'
    GROUP BY d.id HAVING count > 0 ORDER BY count DESC
  `).all();

  const periph = db.prepare(`
    SELECT
      SUM(headphone) AS headphone, SUM(speaker) AS speaker,
      SUM(keyboard) AS keyboard, SUM(mouse) AS mouse,
      SUM(ip_phone) AS ipPhone, SUM(webcam) AS webcam, SUM(mobile_stand) AS mobileStand
    FROM assets WHERE status != 'retired'
  `).get();

  const openRepairs = db.prepare("SELECT COUNT(*) n FROM repair_tickets WHERE status IN ('open','in_progress')").get().n;
  const softwareRenewals = db.prepare(`
    SELECT COUNT(*) n FROM software
    WHERE renewal_date IS NOT NULL AND renewal_date <= date('now','+60 days')
  `).get().n;
  const retired = db.prepare("SELECT COUNT(*) n FROM assets WHERE status = 'retired'").get().n;
  const lowStockCount = db.prepare("SELECT COUNT(*) n FROM consumables WHERE qty <= reorder_level").get().n;
  const spares = db.prepare("SELECT COUNT(*) n FROM assets WHERE in_stock = 1").get().n;

  // Operational signals for the dashboard tiles (each is a "do something" number).
  const slaBreaches = db.prepare(`
    SELECT COUNT(*) n FROM repair_tickets
    WHERE status IN ('open','in_progress')
      AND julianday('now') - julianday(opened_at) > 7`).get().n;
  const overdueReturns = db.prepare(`
    SELECT COUNT(*) n FROM assets
    WHERE status != 'retired' AND return_due IS NOT NULL AND return_due < date('now')`).get().n;
  const defectiveOpen = db.prepare(`
    SELECT COUNT(*) n FROM stock_movements
    WHERE type = 'return' AND condition = 'defective' AND replaced_by IS NULL`).get().n;
  // fleet utilization = assigned (non-shared, active) / total active
  const utilization = totals.total ? Math.round((totals.assigned / totals.total) * 100) : 0;

  // Trend arrows: snapshot today's values, diff against ~7 days ago.
  const trends = snapshotAndTrend({
    lowStock: lowStockCount, slaBreaches, overdueReturns, softwareRenewals,
    openRepairs, defectiveOpen, spares, utilization
  });

  return {
    total: totals.total, assigned: totals.assigned, shared: totals.shared,
    dual: totals.dual, inRepair: totals.inRepair, employees, depts, coverage,
    byDept, peripheralCounts: periph,
    openRepairs, softwareRenewals, retired, lowStockCount, spares,
    slaBreaches, overdueReturns, defectiveOpen, utilization, trends
  };
}

// Record today's metric values (once per metric per day) and return the delta vs the
// snapshot from ~7 days ago. On a fresh DB we seed a -7d baseline equal to today's value
// so the first render shows "no change" (0) rather than a blank arrow.
function snapshotAndTrend(metrics) {
  const recordToday = db.prepare(
    "INSERT OR IGNORE INTO metric_snapshots (metric, taken_on, value) VALUES (?, date('now'), ?)"
  );
  const seedBaseline = db.prepare(
    "INSERT OR IGNORE INTO metric_snapshots (metric, taken_on, value) VALUES (?, date('now','-7 days'), ?)"
  );
  const hasOlder = db.prepare(
    "SELECT 1 FROM metric_snapshots WHERE metric = ? AND taken_on < date('now') LIMIT 1"
  );
  const priorWeek = db.prepare(
    "SELECT value FROM metric_snapshots WHERE metric = ? AND taken_on <= date('now','-7 days') ORDER BY taken_on DESC LIMIT 1"
  );
  const oldestBefore = db.prepare(
    "SELECT value, taken_on FROM metric_snapshots WHERE metric = ? AND taken_on < date('now') ORDER BY taken_on ASC LIMIT 1"
  );

  const out = {};
  const tx = db.transaction(() => {
    for (const [metric, value] of Object.entries(metrics)) {
      recordToday.run(metric, value);
      if (!hasOlder.get(metric)) seedBaseline.run(metric, value); // fresh DB → baseline = now
      const prior = priorWeek.get(metric) || oldestBefore.get(metric);
      out[metric] = prior
        ? { delta: Math.round((value - prior.value) * 10) / 10, since: prior.taken_on || null }
        : { delta: null, since: null };
    }
  });
  tx();
  return out;
}

// Time-series + distribution trends derived from existing timestamps (no snapshot infra).
export function trends() {
  const assetsByMonth = db.prepare(`
    SELECT substr(at,1,7) AS month, COUNT(*) AS n
    FROM assignment_history WHERE action IN ('assigned','added','imported')
    GROUP BY month ORDER BY month DESC LIMIT 12`).all().reverse();

  const repairsByMonth = db.prepare(`
    SELECT substr(opened_at,1,7) AS month, COUNT(*) AS n
    FROM repair_tickets GROUP BY month ORDER BY month DESC LIMIT 12`).all().reverse();

  return { assetsByMonth, repairsByMonth };
}

// F5 — per-tech performance: open/closed counts + avg resolution hours
export function techPerformance() {
  return db.prepare(`
    SELECT
      COALESCE(NULLIF(assignee,''), 'Unassigned') AS tech,
      COUNT(*) AS total,
      SUM(CASE WHEN status IN ('open','in_progress') THEN 1 ELSE 0 END) AS open_count,
      SUM(CASE WHEN status IN ('resolved','closed') THEN 1 ELSE 0 END) AS closed_count,
      ROUND(AVG(CASE WHEN closed_at IS NOT NULL
        THEN (julianday(closed_at) - julianday(opened_at)) * 24 END), 1) AS avg_hours
    FROM repair_tickets
    GROUP BY tech ORDER BY total DESC`).all();
}

// F6 — per-supplier received vs defective return counts → defective rate
export function supplierPerformance() {
  return db.prepare(`
    SELECT s.id, s.name,
      COALESCE(SUM(CASE WHEN m.type='in' THEN m.qty END), 0) AS received,
      COALESCE(SUM(CASE WHEN m.type='return' AND m.condition='defective' THEN m.qty END), 0) AS defective,
      CASE WHEN SUM(CASE WHEN m.type='in' THEN m.qty END) > 0
        THEN ROUND(100.0 * SUM(CASE WHEN m.type='return' AND m.condition='defective' THEN m.qty END) /
                          SUM(CASE WHEN m.type='in' THEN m.qty END), 1)
        ELSE 0 END AS defective_rate,
      (SELECT MAX(at) FROM stock_movements WHERE supplier_id = s.id AND type='in') AS last_received
    FROM suppliers s
    LEFT JOIN stock_movements m ON m.supplier_id = s.id
    WHERE s.active = 1
    GROUP BY s.id ORDER BY defective_rate DESC, s.name`).all();
}

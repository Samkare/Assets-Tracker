import db from "../db/connection.js";

// Categorized alerts feed for warranty/lease/return/renewal/stock.
export function alerts() {
  const overdueReturns = db.prepare(`
    SELECT a.id, a.pseudo, d.name AS dept, a.return_due AS date FROM assets a
    JOIN departments d ON d.id=a.department_id
    WHERE a.status!='retired' AND a.return_due IS NOT NULL AND a.return_due < date('now')
    ORDER BY a.return_due`).all();

  const softwareRenewals = db.prepare(`
    SELECT id, name, vendor, renewal_date AS date FROM software
    WHERE renewal_date IS NOT NULL AND renewal_date <= date('now','+60 days')
    ORDER BY renewal_date`).all();

  const lowStock = db.prepare(`
    SELECT id, name, category, qty, reorder_level, reorder_qty,
      MAX(reorder_qty, reorder_level - qty, 1) AS suggestedReorder
    FROM consumables WHERE qty <= reorder_level ORDER BY (qty - reorder_level)`).all();

  // SLA breach: open/in_progress repair tickets older than 7 days
  const slaBreaches = db.prepare(`
    SELECT t.id, t.asset_id, t.issue, t.assignee, t.opened_at AS date,
      CAST((julianday('now') - julianday(t.opened_at)) AS INT) AS days_open
    FROM repair_tickets t
    WHERE t.status IN ('open','in_progress')
      AND julianday('now') - julianday(t.opened_at) > 7
    ORDER BY t.opened_at`).all();

  const count = overdueReturns.length + softwareRenewals.length + lowStock.length + slaBreaches.length;

  return { count, overdueReturns, softwareRenewals, lowStock, slaBreaches };
}

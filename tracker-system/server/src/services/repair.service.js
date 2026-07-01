import db from "../db/connection.js";
import { insertAudit } from "../db/repo.js";
import { HttpError } from "../middleware/error.js";

const withAsset = `
  SELECT t.*, a.pseudo AS asset_pseudo, d.name AS dept
  FROM repair_tickets t
  JOIN assets a ON a.id = t.asset_id
  JOIN departments d ON d.id = a.department_id
`;

export function listRepairs({ status, assetId } = {}) {
  const where = [];
  const params = {};
  if (status && status !== "All") { where.push("t.status = @status"); params.status = status; }
  if (assetId) { where.push("t.asset_id = @assetId"); params.assetId = assetId; }
  const sql = `${withAsset} ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY (t.status IN ('open','in_progress')) DESC, t.opened_at DESC`;
  return db.prepare(sql).all(params);
}

export function getRepair(id) {
  return db.prepare(`${withAsset} WHERE t.id = ?`).get(id);
}

export function openRepair({ assetId, issue, assignee, cost }, actor) {
  const asset = db.prepare("SELECT a.*, d.name AS dept FROM assets a JOIN departments d ON d.id=a.department_id WHERE a.id=?").get(assetId);
  if (!asset) throw new HttpError(404, `Asset ${assetId} not found`);
  if (!issue || !String(issue).trim()) throw new HttpError(400, "Issue description required");
  const tx = db.transaction(() => {
    const info = db.prepare(
      "INSERT INTO repair_tickets (asset_id, issue, assignee, cost, opened_by) VALUES (?,?,?,?,?)"
    ).run(assetId, String(issue).trim(), assignee ?? null, cost ?? null, actor);
    db.prepare("UPDATE assets SET status='repair', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").run(assetId);
    insertAudit({
      actor, action: "repair", tag: assetId,
      subject: asset.shared ? "Day-Shift PC" : asset.pseudo, dept: asset.dept,
      detail: `Repair opened — ${String(issue).trim().slice(0, 80)}`
    });
    return info.lastInsertRowid;
  });
  return getRepair(tx());
}

export function updateRepair(id, { status, assignee, cost, resolution }, actor) {
  const t = getRepair(id);
  if (!t) throw new HttpError(404, `Ticket ${id} not found`);
  const closing = (status === "resolved" || status === "closed") && t.status !== "resolved" && t.status !== "closed";
  const tx = db.transaction(() => {
    db.prepare(`UPDATE repair_tickets SET
      status = COALESCE(@status, status),
      assignee = COALESCE(@assignee, assignee),
      cost = COALESCE(@cost, cost),
      resolution = COALESCE(@resolution, resolution),
      closed_at = CASE WHEN @closing = 1 THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE closed_at END
      WHERE id = @id`).run({
      id, status: status ?? null, assignee: assignee ?? null,
      cost: cost ?? null, resolution: resolution ?? null, closing: closing ? 1 : 0
    });
    if (closing) {
      // return the asset to active (only if still flagged repair)
      db.prepare("UPDATE assets SET status='active', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status='repair'").run(t.asset_id);
      insertAudit({
        actor, action: "repair", tag: t.asset_id, subject: t.asset_pseudo, dept: t.dept,
        detail: `Repair ${status} — ${(resolution || "").slice(0, 80)}`
      });
    }
  });
  tx();
  return getRepair(id);
}

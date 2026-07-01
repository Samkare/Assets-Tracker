-- 009 — daily metric snapshots → powers dashboard trend arrows (Δ vs last week)
-- One row per (metric, date). summary() records today's values once per day (INSERT OR IGNORE),
-- then compares against the snapshot from ~7 days ago.
CREATE TABLE IF NOT EXISTS metric_snapshots (
  metric   TEXT NOT NULL,
  taken_on TEXT NOT NULL,            -- date('now') — one snapshot per metric per day
  value    REAL NOT NULL,
  PRIMARY KEY (metric, taken_on)
);
CREATE INDEX IF NOT EXISTS idx_metric_snapshots_metric ON metric_snapshots(metric, taken_on);

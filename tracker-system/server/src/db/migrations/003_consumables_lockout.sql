-- 003 — login lockout, loan-return tracking, consumables/stock

-- account lockout counters
ALTER TABLE users ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until TEXT;

-- loaned-gear return tracking (overdue-return alerts)
ALTER TABLE assets ADD COLUMN return_due TEXT;

-- consumables / stock (cables, adapters, toner, etc.)
CREATE TABLE IF NOT EXISTS consumables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT,
  qty INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'pcs',
  location TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_consumables_name ON consumables(name);

-- stock movement log (audit of +/- adjustments)
CREATE TABLE IF NOT EXISTS consumable_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  consumable_id INTEGER NOT NULL REFERENCES consumables(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT,
  actor TEXT NOT NULL,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_consumable_log_cid ON consumable_log(consumable_id);

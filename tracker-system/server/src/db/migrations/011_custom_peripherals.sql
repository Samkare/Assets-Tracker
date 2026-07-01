-- 011 — user-managed custom peripherals.
-- The 7 standard peripherals stay as boolean columns on assets (reports/import depend on them).
-- Custom peripherals live in a catalog + per-asset join so users can add their own.
CREATE TABLE IF NOT EXISTS peripherals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS asset_peripherals (
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  peripheral_id INTEGER NOT NULL REFERENCES peripherals(id) ON DELETE CASCADE,
  PRIMARY KEY (asset_id, peripheral_id)
);
CREATE INDEX IF NOT EXISTS idx_asset_peripherals_asset ON asset_peripherals(asset_id);

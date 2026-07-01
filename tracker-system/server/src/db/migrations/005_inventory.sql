-- 005 — full inventory: categories, suppliers, richer stock items, movements, spare-hardware flag

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'consumable' CHECK(kind IN ('consumable','accessory','hardware')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact TEXT, email TEXT, phone TEXT,
  lead_time_days INTEGER,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- extend stock items (consumables table = generic inventory item)
ALTER TABLE consumables ADD COLUMN category_id INTEGER REFERENCES categories(id);
ALTER TABLE consumables ADD COLUMN supplier_id INTEGER REFERENCES suppliers(id);
ALTER TABLE consumables ADD COLUMN unit_cost REAL;
ALTER TABLE consumables ADD COLUMN reorder_qty INTEGER NOT NULL DEFAULT 0;
ALTER TABLE consumables ADD COLUMN kind TEXT NOT NULL DEFAULT 'consumable';

-- seed categories from existing free-text categories, then link
INSERT OR IGNORE INTO categories (name, kind)
  SELECT DISTINCT category, 'consumable' FROM consumables WHERE category IS NOT NULL AND category != '';
UPDATE consumables SET category_id = (SELECT id FROM categories c WHERE c.name = consumables.category)
  WHERE category IS NOT NULL AND category != '';

-- richer movement log (in/out/return/adjust) — replaces consumable_log going forward
CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES consumables(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('in','out','return','adjust')),
  qty INTEGER NOT NULL,
  reason TEXT,
  employee_name TEXT,
  asset_id TEXT REFERENCES assets(id),
  supplier_id INTEGER REFERENCES suppliers(id),
  unit_cost REAL,
  actor TEXT NOT NULL,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_movements_item ON stock_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_movements_at ON stock_movements(at DESC);

-- carry legacy adjustments into the new log
INSERT INTO stock_movements (item_id, type, qty, reason, actor, at)
  SELECT consumable_id, CASE WHEN delta >= 0 THEN 'in' ELSE 'out' END, abs(delta), reason, actor, at
  FROM consumable_log;

-- spare-hardware bridge: machines sitting in the IT store (not deployed)
ALTER TABLE assets ADD COLUMN in_stock INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_assets_in_stock ON assets(in_stock);

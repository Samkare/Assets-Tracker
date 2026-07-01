-- 002_asset_mgmt — procurement fields, assignment history, repair tickets, software

-- assets: procurement / warranty columns (all nullable, additive)
ALTER TABLE assets ADD COLUMN serial TEXT;
ALTER TABLE assets ADD COLUMN purchase_date TEXT;
ALTER TABLE assets ADD COLUMN cost REAL;
ALTER TABLE assets ADD COLUMN vendor TEXT;
ALTER TABLE assets ADD COLUMN po_number TEXT;
ALTER TABLE assets ADD COLUMN invoice_no TEXT;
ALTER TABLE assets ADD COLUMN warranty_expiry TEXT;
ALTER TABLE assets ADD COLUMN lease_expiry TEXT;
ALTER TABLE assets ADD COLUMN condition TEXT;
ALTER TABLE assets ADD COLUMN notes TEXT;

CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_warranty ON assets(warranty_expiry);

-- per-asset chain of custody
CREATE TABLE IF NOT EXISTS assignment_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id TEXT NOT NULL REFERENCES assets(id),
  employee_name TEXT,
  dept TEXT,
  action TEXT NOT NULL CHECK(action IN ('assigned','reassigned','returned','retired','added','imported')),
  actor TEXT NOT NULL,
  note TEXT,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_asgn_asset ON assignment_history(asset_id);
CREATE INDEX IF NOT EXISTS idx_asgn_at ON assignment_history(at DESC);

-- maintenance / repair tickets
CREATE TABLE IF NOT EXISTS repair_tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id TEXT NOT NULL REFERENCES assets(id),
  issue TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','resolved','closed')),
  assignee TEXT,
  cost REAL,
  resolution TEXT,
  opened_by TEXT NOT NULL,
  opened_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  closed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_repair_asset ON repair_tickets(asset_id);
CREATE INDEX IF NOT EXISTS idx_repair_status ON repair_tickets(status);

-- software / license inventory
CREATE TABLE IF NOT EXISTS software (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  vendor TEXT,
  license_key TEXT,
  seats_total INTEGER NOT NULL DEFAULT 1,
  purchase_date TEXT,
  cost REAL,
  renewal_date TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','expired')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_software_renewal ON software(renewal_date);

CREATE TABLE IF NOT EXISTS software_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  software_id INTEGER NOT NULL REFERENCES software(id) ON DELETE CASCADE,
  employee_name TEXT,
  asset_id TEXT REFERENCES assets(id),
  assigned_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  actor TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_swasgn_sw ON software_assignments(software_id);

-- 016 — Vendor management fields + standalone POs.
-- (a) suppliers gains address + gst_number (name/email/phone already exist; phone = mobile).
-- (b) purchase_orders.pr_id / department / category become NULLABLE so a PO can be created
--     standalone (without a PR). SQLite can't drop NOT NULL in place, so the table is rebuilt.
--     Children (items, attachments) CASCADE off purchase_orders, so they're backed up and
--     restored around the rebuild to avoid a cascade delete. The whole file runs in one
--     transaction (migrate.js), so any error rolls the entire migration back.

-- (a) suppliers: new vendor fields --------------------------------------------------------
ALTER TABLE suppliers ADD COLUMN address TEXT;
ALTER TABLE suppliers ADD COLUMN gst_number TEXT;

-- (b) rebuild purchase_orders with nullable pr_id / department / category ------------------
-- back the children up as plain tables (no FKs) so the parent DROP can't cascade them away
CREATE TABLE _poi_backup AS SELECT * FROM purchase_order_items;
CREATE TABLE _poa_backup AS SELECT * FROM purchase_order_attachments;
DROP TABLE purchase_order_items;
DROP TABLE purchase_order_attachments;

CREATE TABLE purchase_orders_new (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  po_number        TEXT NOT NULL UNIQUE,
  pr_id            INTEGER REFERENCES purchase_requests(id),   -- NULLABLE now (null = standalone PO)
  vendor           TEXT NOT NULL,
  supplier_id      INTEGER REFERENCES suppliers(id),
  department       TEXT,                                       -- NULLABLE now
  category         TEXT,                                       -- NULLABLE now
  final_amount     REAL,
  billing_address  TEXT,
  shipping_address TEXT,
  terms            TEXT,
  status           TEXT NOT NULL DEFAULT 'Draft'
                     CHECK(status IN ('Draft','Sent to Vendor','Fulfilled','Cancelled')),
  created_by       TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  inter_state      INTEGER NOT NULL DEFAULT 0
);
INSERT INTO purchase_orders_new
  (id, po_number, pr_id, vendor, supplier_id, department, category, final_amount,
   billing_address, shipping_address, terms, status, created_by, created_at, inter_state)
  SELECT id, po_number, pr_id, vendor, supplier_id, department, category, final_amount,
   billing_address, shipping_address, terms, status, created_by, created_at, inter_state
  FROM purchase_orders;
DROP TABLE purchase_orders;                       -- no children reference it now → no cascade
ALTER TABLE purchase_orders_new RENAME TO purchase_orders;

CREATE INDEX IF NOT EXISTS idx_po_status  ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_created ON purchase_orders(created_at DESC);
-- one active (non-cancelled) PO per PR; standalone POs have pr_id NULL (NULLs are distinct → unaffected)
CREATE UNIQUE INDEX IF NOT EXISTS idx_po_one_active_per_pr
  ON purchase_orders(pr_id) WHERE status != 'Cancelled';

-- recreate the children (FK to the rebuilt purchase_orders) and restore their rows
CREATE TABLE purchase_order_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  po_id       INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity    REAL NOT NULL DEFAULT 1,
  rate        REAL NOT NULL DEFAULT 0,
  tax_rate    REAL NOT NULL DEFAULT 18,
  sort_order  INTEGER NOT NULL DEFAULT 0
);
INSERT INTO purchase_order_items (id, po_id, description, quantity, rate, tax_rate, sort_order)
  SELECT id, po_id, description, quantity, rate, tax_rate, sort_order FROM _poi_backup;
CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(po_id);

CREATE TABLE purchase_order_attachments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  po_id       INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  filename    TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  mime        TEXT,
  size        INTEGER,
  uploaded_by TEXT,
  uploaded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT INTO purchase_order_attachments (id, po_id, filename, stored_name, mime, size, uploaded_by, uploaded_at)
  SELECT id, po_id, filename, stored_name, mime, size, uploaded_by, uploaded_at FROM _poa_backup;
CREATE INDEX IF NOT EXISTS idx_po_attach_po ON purchase_order_attachments(po_id);

DROP TABLE _poi_backup;
DROP TABLE _poa_backup;

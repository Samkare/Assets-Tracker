-- 014 — PO line items + attachments (invoice-grade purchase orders).
-- Items live in a normalized child table (matches the app's other line tables, e.g. stock_movements).
-- Per-item GST %: CGST and SGST are each tax_rate/2 for intra-state — computed in the app, not stored.
-- Line amount (= quantity * rate), subtotal, tax and grand total are all DERIVED and NOT stored here.
-- purchase_orders.final_amount is repurposed as the stored GRAND TOTAL, kept in sync by the service.

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  po_id       INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity    REAL NOT NULL DEFAULT 1,     -- allows fractional quantities (e.g. 2.5)
  rate        REAL NOT NULL DEFAULT 0,     -- unit price
  tax_rate    REAL NOT NULL DEFAULT 18,    -- GST % for this line (split into CGST/SGST in the app)
  sort_order  INTEGER NOT NULL DEFAULT 0   -- preserves the row order entered in the form
);
CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(po_id);

CREATE TABLE IF NOT EXISTS purchase_order_attachments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  po_id       INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  filename    TEXT NOT NULL,               -- original filename shown to the user
  stored_name TEXT NOT NULL,               -- randomized name on disk (data/uploads/po/)
  mime        TEXT,
  size        INTEGER,
  uploaded_by TEXT,
  uploaded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_po_attach_po ON purchase_order_attachments(po_id);

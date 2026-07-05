-- 013 — purchase orders. Generated from an APPROVED purchase_request; the actual order to a vendor.
-- Snapshots dept/category from the PR (a PO is a commitment record; it shouldn't drift if the PR changes).
-- po_number is server-generated PO-<Mon>-<YYYY>-NNN (e.g. PO-Jul-2026-001), matching the PR format.
CREATE TABLE IF NOT EXISTS purchase_orders (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  po_number        TEXT NOT NULL UNIQUE,             -- PO-Jul-2026-001 (server-generated)
  pr_id            INTEGER NOT NULL REFERENCES purchase_requests(id),  -- source approved PR
  vendor           TEXT NOT NULL,                    -- final chosen vendor (display name)
  supplier_id      INTEGER REFERENCES suppliers(id), -- set when picked from the Suppliers list; null for free-text
  department       TEXT NOT NULL,                    -- snapshot from PR
  category         TEXT NOT NULL,                    -- snapshot from PR
  final_amount     REAL,                             -- negotiated final cost
  billing_address  TEXT,                             -- defaults to company billing (UI-filled)
  shipping_address TEXT,
  terms            TEXT,                             -- delivery / payment terms
  status           TEXT NOT NULL DEFAULT 'Draft'
                     CHECK(status IN ('Draft','Sent to Vendor','Fulfilled','Cancelled')),
  created_by       TEXT,                             -- actor who generated it
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_po_status  ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_created ON purchase_orders(created_at DESC);
-- "One PO per PR" — enforced by a PARTIAL unique index: at most one non-cancelled PO per PR.
-- (A plain UNIQUE(pr_id) would permanently block re-issuing after a cancellation; this allows it.)
CREATE UNIQUE INDEX IF NOT EXISTS idx_po_one_active_per_pr
  ON purchase_orders(pr_id) WHERE status != 'Cancelled';

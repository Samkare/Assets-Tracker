-- 019 — Purchase Request attachments (e.g. the signed/approved document, vendor quote).
-- Mirrors purchase_order_attachments (014_po_items_attachments.sql) exactly.
CREATE TABLE IF NOT EXISTS purchase_request_attachments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  pr_id       INTEGER NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
  filename    TEXT NOT NULL,               -- original filename shown to the user
  stored_name TEXT NOT NULL,               -- randomized name on disk (data/uploads/pr/)
  mime        TEXT,
  size        INTEGER,
  uploaded_by TEXT,
  uploaded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_pr_attach_pr ON purchase_request_attachments(pr_id);

-- 012 — purchase requests (PR form module).
-- A PR is a lightweight approval record: someone requests a purchase/service, an
-- IT-Manager/Admin approves or rejects it. pr_number is server-generated
-- (PR-YYYY-NNN, sequential per calendar year) and immutable once set — hence UNIQUE.
CREATE TABLE IF NOT EXISTS purchase_requests (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  pr_number         TEXT NOT NULL UNIQUE,          -- e.g. PR-2026-001 (server-generated)
  requested_by      TEXT NOT NULL,                 -- name of the requestor
  department        TEXT NOT NULL,                 -- free-text dept name (matches assets.dept)
  -- category validated in the app (shared Zod enum) so adding categories needs no migration
  category          TEXT NOT NULL,
  business_purpose  TEXT NOT NULL,
  required_by       TEXT,                          -- deadline, YYYY-MM-DD (matches assets.return_due style)
  estimated_cost    REAL,                          -- estimated budget (matches consumables.unit_cost)
  suggested_vendors TEXT,                          -- free text: 2–3 recommended vendor names
  status            TEXT NOT NULL DEFAULT 'Pending'
                      CHECK(status IN ('Pending','Approved','Rejected')),
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_pr_status  ON purchase_requests(status);
CREATE INDEX IF NOT EXISTS idx_pr_created ON purchase_requests(created_at DESC);
-- (pr_number's UNIQUE constraint already gives it an index — no extra one needed)

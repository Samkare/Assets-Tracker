-- 020 — location on PR/PO (supports per-location numbering prefixes, e.g. Bhusawal -> BSL).
-- Nullable, no backfill: existing rows stay NULL (treated as the default/unprefixed location by
-- the app), so existing PR/PO numbers and records are completely unaffected by this migration.
ALTER TABLE purchase_requests ADD COLUMN location TEXT;
ALTER TABLE purchase_orders ADD COLUMN location TEXT;

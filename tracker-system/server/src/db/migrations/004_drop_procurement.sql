-- 004 — remove procurement/warranty stack (user decision: not useful)
-- return_due is NOT procurement (loan returns) — kept.

DROP INDEX IF EXISTS idx_assets_warranty;

ALTER TABLE assets DROP COLUMN serial;
ALTER TABLE assets DROP COLUMN purchase_date;
ALTER TABLE assets DROP COLUMN cost;
ALTER TABLE assets DROP COLUMN vendor;
ALTER TABLE assets DROP COLUMN po_number;
ALTER TABLE assets DROP COLUMN invoice_no;
ALTER TABLE assets DROP COLUMN warranty_expiry;
ALTER TABLE assets DROP COLUMN lease_expiry;
ALTER TABLE assets DROP COLUMN condition;
ALTER TABLE assets DROP COLUMN notes;

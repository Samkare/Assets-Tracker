-- 015 — inter-state (IGST) toggle on a PO.
-- false (0) → intra-state: tax shown as CGST (rate/2) + SGST (rate/2).
-- true  (1) → inter-state: tax shown as a single IGST (full rate). The total tax is identical
-- either way; only the breakdown/labelling differs. Determined per-PO (per vendor's state).
ALTER TABLE purchase_orders ADD COLUMN inter_state INTEGER NOT NULL DEFAULT 0;

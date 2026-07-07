-- 017 — a PR may back more than one active PO (split/partial fulfillment across vendors).
-- Drops the "one active PO per PR" guard added in 016; re-issuing after cancellation no
-- longer needs special-casing since simultaneous active POs are now allowed outright.
DROP INDEX IF EXISTS idx_po_one_active_per_pr;

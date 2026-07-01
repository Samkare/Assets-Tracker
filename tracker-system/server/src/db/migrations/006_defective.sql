-- 006 — defective item tracking + replacement linkage

ALTER TABLE stock_movements ADD COLUMN condition TEXT;             -- NULL | 'good' | 'defective'
ALTER TABLE stock_movements ADD COLUMN replacement_of INTEGER REFERENCES stock_movements(id);
ALTER TABLE stock_movements ADD COLUMN replaced_by INTEGER REFERENCES stock_movements(id);

CREATE INDEX IF NOT EXISTS idx_movements_condition ON stock_movements(condition);
CREATE INDEX IF NOT EXISTS idx_movements_replacement_of ON stock_movements(replacement_of);

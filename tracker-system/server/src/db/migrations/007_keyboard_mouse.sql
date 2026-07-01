-- 007 — add keyboard + mouse to fixed peripheral set
ALTER TABLE assets ADD COLUMN keyboard INTEGER NOT NULL DEFAULT 0;
ALTER TABLE assets ADD COLUMN mouse INTEGER NOT NULL DEFAULT 0;

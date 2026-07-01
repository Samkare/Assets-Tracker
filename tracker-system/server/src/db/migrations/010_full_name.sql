-- 010 — add employee full name to assets (the spreadsheet's "Full Name" column).
-- Pseudo stays the short display name; full_name is the optional real name.
ALTER TABLE assets ADD COLUMN full_name TEXT;

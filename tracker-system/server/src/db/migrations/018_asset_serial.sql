-- 018 — dedicated asset serial number.
-- Laptops historically stored their machine serial in `full_name` (which is meant for the
-- employee's name). Add a proper `serial` column and move each laptop's serial out of full_name
-- into it, clearing the mis-used full_name so the "Full Name" column shows employee info only.
-- Desktops are untouched (their full_name holds real employee names; their serials live in mon1/mon2).

ALTER TABLE assets ADD COLUMN serial TEXT;

UPDATE assets
   SET serial = trim(full_name),
       full_name = NULL
 WHERE type = 'Laptop'
   AND full_name IS NOT NULL
   AND trim(full_name) != '';

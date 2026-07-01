// Import pipeline shared by first-run seed and the xlsx import endpoint.
// rows: array of cell objects { A:.., B:.. } (from parsed-rows.json or exceljs).
import db from "../db/connection.js";
import { upsertAsset, insertAudit, insertAssignment, deptExists } from "../db/repo.js";
import { cellsToInput } from "../lib/columnMap.js";
import { buildAsset } from "@its/shared/assetLogic";
import { assetInputSchema } from "@its/shared/validation";

// Richness score — prefer the assigned record with the most data over a bare appendix row.
const SPEC_FIELDS = ["cpu", "ram", "hdd", "mon1", "mon2", "whatsapp", "nextiva"];
function richness(rec) {
  let s = rec.shared ? 0 : 5; // a real assignment beats a pool/bare row
  for (const f of SPEC_FIELDS) if (rec[f]) s++;
  return s;
}

// Validate + normalize + dedup. Returns { assets, errors, duplicates, newDepartments }.
export function parseRows(rowCells) {
  const byTag = new Map();      // keep richest record per asset tag
  const duplicates = [];
  const errors = [];
  const newDepts = new Set();

  rowCells.forEach((cells, i) => {
    const rowNum = i + 2; // header is row 1
    const raw = cellsToInput(cells);
    if (!raw.id) {
      // skip fully blank trailing rows silently; flag rows with data but no tag
      if (raw.pseudo || raw.dept) errors.push({ row: rowNum, error: "missing Asset Tag" });
      return;
    }
    const parsed = assetInputSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push({ row: rowNum, tag: raw.id, error: parsed.error.issues[0].message });
      return;
    }
    const rec = buildAsset(parsed.data);
    const prev = byTag.get(rec.id);
    if (prev) {
      duplicates.push(rec.id);
      // keep the richer record; tie -> later row wins
      if (richness(rec) >= richness(prev)) byTag.set(rec.id, rec);
    } else {
      byTag.set(rec.id, rec);
    }
    if (!deptExists(rec.dept)) newDepts.add(rec.dept);
  });

  return {
    assets: [...byTag.values()],
    errors,
    duplicates: [...new Set(duplicates)],
    newDepartments: [...newDepts]
  };
}

// Dry-run: classify each asset vs existing DB state. No writes.
export function planImport(assets) {
  const existing = db.prepare("SELECT id FROM assets WHERE id = ?");
  let insert = 0, update = 0;
  for (const a of assets) {
    if (existing.get(a.id)) update++; else insert++;
  }
  return { insert, update, total: assets.length };
}

// Apply the validated set in one transaction with audit rows.
export function commitImport(assets, actor = "system", { seed = false } = {}) {
  const tx = db.transaction(() => {
    const existing = db.prepare("SELECT id FROM assets WHERE id = ?");
    for (const a of assets) {
      const prev = existing.get(a.id);
      const isNew = !prev;
      // detect reassignment for existing rows so custody timeline stays accurate
      let reassigned = false;
      if (!isNew && !seed) {
        const before = db.prepare("SELECT pseudo, shared FROM assets WHERE id = ?").get(a.id);
        reassigned = before && !before.shared && !a.shared && before.pseudo !== a.pseudo;
      }
      upsertAsset(a);
      if (!seed) {
        insertAudit({
          actor,
          action: isNew ? (a.shared ? "added" : "assigned") : (reassigned ? "reassigned" : "edited"),
          tag: a.id,
          subject: a.shared ? "Day-Shift PC" : a.pseudo,
          dept: a.dept,
          detail: isNew ? "Imported from spreadsheet" : (reassigned ? "Reassigned via import" : "Updated via import")
        });
        // HIGH-17: write to assignment_history so custody timeline reflects import-driven changes
        if (isNew || reassigned) {
          insertAssignment({
            asset_id: a.id,
            employee_name: a.shared ? null : a.pseudo,
            dept: a.dept,
            action: isNew ? (a.shared ? "added" : "assigned") : "reassigned",
            actor,
            note: "via import"
          });
        }
      }
    }
    if (!seed) {
      insertAudit({
        actor, action: "edited", tag: null, subject: "Bulk import",
        dept: null, detail: `Imported ${assets.length} assets`
      });
    }
  });
  tx();
  return { committed: assets.length };
}

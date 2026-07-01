// Derivation logic shared by the import pipeline, the API write path, and the form preview.
// Mirrors the prototype buildFields()/handleSubmit() in app.jsx so seed, import, and UI never drift.

import { PERIPHERALS, SHARED_PSEUDO } from "./constants.js";

const blank = (v) => v == null || String(v).trim() === "";
const clean = (v) => (blank(v) ? null : String(v).trim());

// A machine is "shared" (pool) when it has no real employee or the name looks like a shift PC.
export function computeShared(pseudo) {
  return blank(pseudo) || /day-?shift/i.test(String(pseudo));
}

// Monitor count derived from the two monitor serials.
export function computeMonitors(mon1, mon2) {
  const a = !blank(mon1);
  const b = !blank(mon2);
  if (a && b) return "Dual";
  if (a || b) return "Single";
  return "—";
}

// Normalize raw input (form OR spreadsheet row) into a canonical asset record.
// Booleans for peripherals come in as truthy/falsey; strings get trimmed.
export function buildAsset(raw) {
  const shared = computeShared(raw.pseudo);
  const rec = {
    id: clean(raw.id),
    pseudo: shared ? SHARED_PSEUDO : String(raw.pseudo).trim(),
    fullName: clean(raw.fullName),
    shared,
    dept: clean(raw.dept),
    type: raw.type || "Desktop",
    cpu: clean(raw.cpu),
    ram: clean(raw.ram),
    hdd: clean(raw.hdd),
    mon1: clean(raw.mon1),
    mon2: clean(raw.mon2),
    monitors: computeMonitors(raw.mon1, raw.mon2),
    whatsapp: clean(raw.whatsapp),
    nextiva: clean(raw.nextiva),
    returnDue: clean(raw.returnDue),
    status: raw.status || "active"
  };
  for (const p of PERIPHERALS) rec[p.key] = !!raw[p.key];
  return rec;
}

// Human-readable diff for the audit detail line (mirrors handleSubmit's change list).
const FIELD_LABELS = [
  ["id", "Asset tag"],
  ["dept", "Department"], ["type", "Type"], ["cpu", "CPU"], ["ram", "RAM"],
  ["hdd", "Storage"], ["monitors", "Monitors"], ["pseudo", "Employee"], ["status", "Status"],
  ["returnDue", "Return due"]
];

export function diffAsset(before, after) {
  const changes = [];
  for (const [k, lbl] of FIELD_LABELS) {
    if ((before[k] || "—") !== (after[k] || "—")) {
      changes.push(`${lbl} ${before[k] || "—"} → ${after[k] || "—"}`);
    }
  }
  for (const p of PERIPHERALS) {
    if (!!before[p.key] !== !!after[p.key]) {
      changes.push(`${p.label} ${after[p.key] ? "added" : "removed"}`);
    }
  }
  return changes;
}

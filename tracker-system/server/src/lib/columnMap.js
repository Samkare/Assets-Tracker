// Maps the source spreadsheet's A–R columns to canonical asset-input fields.
// Confirmed against uploads/parsed-rows.json header row.
// Used by both the JSON seed and the xlsx import so column handling lives in one place.
import { DEPARTMENTS } from "@its/shared/constants";

// canonical-key (UPPER, slashes collapsed) -> canonical department name
const DEPT_LOOKUP = new Map(
  DEPARTMENTS.map((d) => [d.toUpperCase().replace(/\s*\/\s*/g, "/"), d])
);

// Normalize messy spreadsheet dept text to a canonical department.
// Blank, "USING DAY SHIFT", and other pool markers -> "Shared Pool".
export function normalizeDept(raw) {
  const s = String(raw ?? "").trim().replace(/\s*\/\s*/g, "/").replace(/\s+/g, " ");
  if (!s || /day\s*shift/i.test(s)) return "Shared Pool";
  const hit = DEPT_LOOKUP.get(s.toUpperCase());
  if (hit) return hit;
  // unknown dept: title-case it so it reads cleanly as a new department
  return s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

// spreadsheet column letter -> { field, kind }
export const COLUMN_MAP = {
  A: { field: "dept",        kind: "str" },
  B: { field: "pseudo",      kind: "str" },
  C: { field: "type",        kind: "type" },
  D: { field: "id",          kind: "str" },
  // E/F = "1st/2nd Mo. Serial No." — empty in source; ignored.
  G: { field: "cpu",         kind: "str" },
  H: { field: "ram",         kind: "str" },
  I: { field: "hdd",         kind: "str" },
  J: { field: "mon1",        kind: "str" },
  K: { field: "mon2",        kind: "str" },
  L: { field: "headphone",   kind: "bool" },
  M: { field: "speaker",     kind: "bool" },
  N: { field: "ipPhone",     kind: "bool" },
  O: { field: "whatsapp",    kind: "str" },
  P: { field: "nextiva",     kind: "str" },
  Q: { field: "webcam",      kind: "bool" },
  R: { field: "mobileStand", kind: "bool" },
  // S = Status (export-only; import defaults to active). T/U/V appended so import round-trips them.
  T: { field: "fullName",    kind: "str" },
  U: { field: "keyboard",    kind: "bool" },
  V: { field: "mouse",       kind: "bool" }
};

// Export column order (A–R) for round-trip-safe xlsx export.
export const EXPORT_COLUMNS = [
  { header: "Department",        field: "dept" },
  { header: "Pseudo Name",       field: "pseudo" },
  { header: "D/L",               field: "type",   fmt: (v) => (v ? v.toUpperCase() : "") },
  { header: "Asset Tag",         field: "id" },
  { header: "1st Mo. Serial No.", field: "_blank" },
  { header: "2nd Mo. Serial No.", field: "_blank" },
  { header: "CPU",               field: "cpu" },
  { header: "RAM",               field: "ram" },
  { header: "HDD",               field: "hdd" },
  { header: "MONITOR-1 SN",      field: "mon1" },
  { header: "MONITOR-2 SN",      field: "mon2" },
  { header: "HeadPhone",         field: "headphone",   fmt: yn },
  { header: "Speaker",           field: "speaker",     fmt: yn },
  { header: "IP Phone",          field: "ipPhone",     fmt: yn },
  { header: "WhatsApp No.",      field: "whatsapp" },
  { header: "Nextiva No.",       field: "nextiva" },
  { header: "Web Cam",           field: "webcam",      fmt: yn },
  { header: "Mobile Stand",      field: "mobileStand", fmt: yn },
  { header: "Status",            field: "status" },
  { header: "Full Name",         field: "fullName" },
  { header: "Keyboard",          field: "keyboard",    fmt: yn },
  { header: "Mouse",             field: "mouse",       fmt: yn }
];

function yn(v) { return v ? "YES" : "NO"; }

const isYes = (v) => /^y(es)?$/i.test(String(v ?? "").trim());

function normType(v) {
  const s = String(v ?? "").trim().toUpperCase();
  if (s.startsWith("L")) return "Laptop";
  return "Desktop";
}

// Convert a {A:..,B:..} cell object into a raw asset-input object.
export function cellsToInput(cells) {
  const raw = {};
  for (const [col, def] of Object.entries(COLUMN_MAP)) {
    const v = cells[col];
    if (def.kind === "bool") raw[def.field] = isYes(v);
    else if (def.kind === "type") raw[def.field] = normType(v);
    else raw[def.field] = v == null ? null : String(v).trim() || null;
  }
  raw.dept = normalizeDept(raw.dept);
  return raw;
}

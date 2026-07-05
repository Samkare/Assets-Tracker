// First-run seed. Idempotent: only loads asset data when the assets table is empty.
// Always ensures the bootstrap admin + base departments exist.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import db from "./connection.js";
import { migrate } from "./migrate.js";
import { getOrCreateDept, insertAudit } from "./repo.js";
import { parseRows, commitImport } from "../services/import.service.js";
import { config } from "../config.js";
import { DEPARTMENTS } from "@its/shared/constants";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Prototype IT team -> RBAC roles.
// Emails match the live accounts so renaming a user never spawns a seed duplicate.
// phone left blank — set real extensions in the app (Users → Edit).
const SEED_USERS = [
  { name: "Santosh",  role: "Admin",      email: "santosh@belgiumdia.com",  since: "2021-03-15", phone: null, focus: "Fleet strategy, approvals & vendor management" },
  { name: "Sachin",   role: "IT-Manager", email: "smukati@tasksource.net",  since: "2022-07-04", phone: null, focus: "Provisioning, repairs & on-site support" },
  { name: "Mahendra", role: "IT-Manager", email: "mahendra@belgiumdia.com", since: "2023-01-19", phone: null, focus: "Asset intake, audits & peripheral kitting" }
];
const SEED_USER_PASSWORD = "Welcome!2026"; // shared temp password, must_reset = 1

// Sample IT vendors so the PO vendor picker + inventory supplier list aren't empty on first run.
const SEED_SUPPLIERS = [
  { name: "Dell India Pvt Ltd",   contact: "Corporate Sales",  email: "sales@dell.co.in",        phone: "1800-425-8045", leadTimeDays: 7,  notes: "Laptops, desktops, docks, monitors" },
  { name: "HP Enterprise India",  contact: "Enterprise Desk",  email: "enterprise@hpe.com",      phone: "1800-114-772",  leadTimeDays: 10, notes: "Servers, printers, networking" },
  { name: "Lenovo India",         contact: "Business Sales",   email: "b2b@lenovo.com",          phone: "1800-419-9999", leadTimeDays: 8,  notes: "ThinkPad laptops, workstations" },
  { name: "Redington India Ltd",  contact: "Distribution",     email: "corp@redington.co.in",    phone: "044-4224-3353", leadTimeDays: 5,  notes: "IT distributor — peripherals & accessories" },
  { name: "Rashi Peripherals",    contact: "Channel Sales",    email: "sales@rptechindia.com",   phone: "022-6140-9000", leadTimeDays: 6,  notes: "Components, peripherals, storage" },
  { name: "Amazon Business",      contact: "Business Account", email: "business@amazon.in",      phone: null,            leadTimeDays: 3,  notes: "General procurement & consumables" }
];

function seedDepartments() {
  for (const name of DEPARTMENTS) getOrCreateDept(name);
}

// Idempotent: insert each sample supplier only if a supplier with that name doesn't exist.
function seedSuppliers() {
  const exists = db.prepare("SELECT 1 FROM suppliers WHERE name = ?");
  const ins = db.prepare(`INSERT INTO suppliers (name, contact, email, phone, lead_time_days, notes)
    VALUES (@name,@contact,@email,@phone,@lead,@notes)`);
  let n = 0;
  for (const s of SEED_SUPPLIERS) {
    if (exists.get(s.name)) continue;
    ins.run({ name: s.name, contact: s.contact ?? null, email: s.email ?? null, phone: s.phone ?? null, lead: s.leadTimeDays ?? null, notes: s.notes ?? null });
    n++;
  }
  if (n) console.log(`[seed] suppliers: ${n} added`);
}

function seedUsers() {
  const exists = db.prepare("SELECT 1 FROM users WHERE email = ?");
  const ins = db.prepare(`INSERT INTO users (name, email, password_hash, role, phone, focus, since, must_reset)
    VALUES (@name, @email, @hash, @role, @phone, @focus, @since, 1)`);

  // bootstrap admin
  if (!exists.get(config.bootstrapAdmin.email)) {
    ins.run({
      name: "Admin", email: config.bootstrapAdmin.email,
      hash: bcrypt.hashSync(config.bootstrapAdmin.password, 12),
      role: "Admin", phone: null, focus: "Bootstrap administrator", since: null
    });
    console.log(`[seed] bootstrap admin: ${config.bootstrapAdmin.email} (temp password — reset on first login)`);
  }

  for (const u of SEED_USERS) {
    if (exists.get(u.email)) continue;
    ins.run({
      name: u.name, email: u.email, hash: bcrypt.hashSync(SEED_USER_PASSWORD, 12),
      role: u.role, phone: u.phone, focus: u.focus, since: u.since
    });
  }
}

function seedAuditHistory() {
  const file = path.join(__dirname, "audit-seed.json");
  if (!fs.existsSync(file)) return;
  const rows = JSON.parse(fs.readFileSync(file, "utf8"));
  const ins = db.prepare(
    "INSERT INTO audit_log (ts, actor, action, tag, subject, dept, detail) VALUES (?,?,?,?,?,?,?)"
  );
  const tx = db.transaction(() => {
    for (const r of rows) ins.run(r.ts, r.actor, r.action, r.tag, r.subject, r.dept, r.detail);
  });
  tx();
  console.log(`[seed] audit history: ${rows.length} rows`);
}

function seedAssets() {
  const count = db.prepare("SELECT COUNT(*) n FROM assets").get().n;
  if (count > 0) {
    console.log(`[seed] assets already present (${count}) — skipping asset load`);
    return;
  }
  if (!fs.existsSync(config.seedRowsPath)) {
    console.warn(`[seed] source rows not found at ${config.seedRowsPath} — no assets loaded`);
    return;
  }
  const json = JSON.parse(fs.readFileSync(config.seedRowsPath, "utf8"));
  // parsed-rows.json: array of { r, cells:{A..R} }; row 1 is the header.
  const dataRows = json.filter((x) => x.r > 1).map((x) => x.cells);
  const { assets, errors, duplicates, newDepartments } = parseRows(dataRows);
  commitImport(assets, "system", { seed: true });
  console.log(`[seed] assets: ${assets.length} loaded` +
    (duplicates.length ? `, ${duplicates.length} dup tags collapsed` : "") +
    (newDepartments.length ? `, new depts: ${newDepartments.join(", ")}` : "") +
    (errors.length ? `, ${errors.length} rows skipped` : ""));
  seedAuditHistory();
}

export function seed() {
  migrate();
  const tx = db.transaction(() => {
    seedDepartments();
    seedUsers();
    seedSuppliers();
    seedAssets();
  });
  tx();
  console.log("[seed] done");
}

if (process.argv[1]?.endsWith("seed.js")) {
  seed();
}

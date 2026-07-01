// Idempotent migration runner — applies migrations/*.sql in filename order,
// tracks applied versions in schema_version. Safe to run on every boot.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import db from "./connection.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIG_DIR = path.join(__dirname, "migrations");

export function migrate() {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );`);

  const applied = new Set(
    db.prepare("SELECT version FROM schema_version").all().map((r) => r.version)
  );

  const files = fs.readdirSync(MIG_DIR).filter((f) => f.endsWith(".sql")).sort();
  let count = 0;
  for (const file of files) {
    const version = Number(file.split("_")[0]);
    if (applied.has(version)) continue;
    const sql = fs.readFileSync(path.join(MIG_DIR, file), "utf8");
    const tx = db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT INTO schema_version (version) VALUES (?)").run(version);
    });
    tx();
    count++;
    console.log(`[migrate] applied ${file}`);
  }
  if (count === 0) console.log("[migrate] up to date");
  return count;
}

// allow `node migrate.js`
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("migrate.js")) {
  migrate();
}

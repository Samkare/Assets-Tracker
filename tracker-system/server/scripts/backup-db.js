// Online SQLite backup -> data/backups/app-YYYYMMDD-HHMMSS.db
// Schedule via Windows Task Scheduler: node server/scripts/backup-db.js
// Fails loud (exit 1 + .FAILED marker) so an unattended scheduled task records the failure
// instead of silently "succeeding" on a missing/empty DB.
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { config } from "../src/config.js";

const dir = path.join(path.dirname(config.dbPath), "backups");

function fail(msg) {
  console.error(`[backup] FAILED: ${msg}`);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "LAST_BACKUP.FAILED"), `${new Date().toISOString()}  ${msg}\n`);
  } catch { /* marker is best-effort */ }
  process.exit(1);
}

async function main() {
  // 1) source must already exist — do NOT let better-sqlite3 create an empty DB on a wrong path
  if (!fs.existsSync(config.dbPath)) fail(`source DB not found at ${config.dbPath}`);

  // 2) open read-only, must-exist; verify it is a real populated DB before trusting it
  let src;
  try {
    src = new Database(config.dbPath, { readonly: true, fileMustExist: true });
  } catch (e) {
    fail(`cannot open source DB: ${e.message}`);
  }
  let assetCount = 0;
  try {
    assetCount = src.prepare("SELECT COUNT(*) AS n FROM assets").get().n;
  } catch (e) {
    fail(`source DB has no assets table / is corrupt: ${e.message}`);
  }
  if (assetCount <= 0) fail("source DB has 0 assets — refusing to back up an empty database");

  // 3) online WAL-safe backup
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 14); // YYYYMMDDHHMMSS
  let dest = path.join(dir, `app-${stamp}.db`);
  if (fs.existsSync(dest)) dest = path.join(dir, `app-${stamp}-${process.pid}.db`); // back-to-back run guard
  try {
    await src.backup(dest);
  } catch (e) {
    fail(`db.backup() threw: ${e.message}`);
  }

  // 4) verify the produced file is a valid, non-truncated DB with the same asset count
  try {
    const chk = new Database(dest, { readonly: true, fileMustExist: true });
    const ok = chk.pragma("integrity_check", { simple: true });
    const n = chk.prepare("SELECT COUNT(*) AS n FROM assets").get().n;
    chk.close();
    // opening a WAL DB (even readonly) can drop -wal/-shm sidecars next to the backup;
    // the .db file is self-contained, so remove the sidecars to keep data/backups clean.
    for (const ext of ["-wal", "-shm"]) { try { fs.rmSync(dest + ext, { force: true }); } catch { /* ignore */ } }
    if (ok !== "ok") fail(`backup integrity_check returned '${ok}'`);
    if (n !== assetCount) fail(`backup asset count ${n} != source ${assetCount}`);
  } catch (e) {
    fail(`backup verification failed: ${e.message}`);
  }
  src.close();
  console.log(`[backup] -> ${dest} (assets=${assetCount}, integrity=ok)`);

  // 5) retain newest 30 (filenames are zero-padded UTC, so lexicographic == chronological)
  const files = fs.readdirSync(dir).filter((f) => f.startsWith("app-") && f.endsWith(".db")).sort();
  for (const f of files.slice(0, -30)) fs.unlinkSync(path.join(dir, f));

  // clear any prior failure marker on success
  try { fs.rmSync(path.join(dir, "LAST_BACKUP.FAILED"), { force: true }); } catch { /* ignore */ }
  process.exit(0);
}

main().catch((e) => fail(e.message));

// Backend integration tests — node:test (no extra deps). Run: npm test
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

// configure a throwaway DB + test env BEFORE importing the app
const TMP_DB = path.join(os.tmpdir(), `its-test-${process.pid}.db`);
process.env.NODE_ENV = "test";
process.env.DB_PATH = TMP_DB;
process.env.SESSION_SECRET = "test-secret-not-prod";
process.env.BOOTSTRAP_ADMIN_EMAIL = "admin@test.local"; // hermetic — don't depend on .env's live admin
process.env.BOOTSTRAP_ADMIN_PASSWORD = "TestAdmin123";
process.env.COOKIE_SECURE = "false";

let server, base;
const cleanupDb = () => { for (const ext of ["", "-wal", "-shm"]) { try { fs.unlinkSync(TMP_DB + ext); } catch {} } };

before(async () => {
  cleanupDb();
  const { app } = await import("../src/index.js"); // import triggers migrate + seed on TMP_DB
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => { server && server.close(); cleanupDb(); });

// --- helpers ---
const XRW = { "X-Requested-With": "XMLHttpRequest" };
let cookie = "";
async function req(method, p, body, extra = {}) {
  const headers = { ...XRW, ...extra };
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(base + p, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const sc = res.headers.get("set-cookie");
  if (sc) cookie = sc.split(";")[0];
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("json") ? await res.json() : await res.text();
  return { status: res.status, data };
}

// --- tests ---
test("health is public", async () => {
  const r = await req("GET", "/api/health");
  assert.equal(r.status, 200);
  assert.equal(r.data.ok, true);
});

test("CSRF: mutation without header is 403", async () => {
  const res = await fetch(base + "/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "x", password: "y" })
  });
  assert.equal(res.status, 403);
});

test("login: wrong password 401", async () => {
  const r = await req("POST", "/api/auth/login", { email: "admin@test.local", password: "nope" });
  assert.equal(r.status, 401);
});

test("unauthenticated read is 401", async () => {
  const r = await req("GET", "/api/assets");
  assert.equal(r.status, 401);
});

test("login as admin works + me returns Admin", async () => {
  const r = await req("POST", "/api/auth/login", { email: "admin@test.local", password: "TestAdmin123" });
  assert.equal(r.status, 200);
  assert.equal(r.data.role, "Admin");
  const me = await req("GET", "/api/auth/me");
  assert.equal(me.data.role, "Admin");
});

test("seed loaded assets + departments", async () => {
  const a = await req("GET", "/api/assets");
  assert.ok(a.data.length > 100, `expected >100 assets, got ${a.data.length}`);
  const d = await req("GET", "/api/departments");
  assert.equal(d.data.length, 16);
});

test("asset create writes an audit row", async () => {
  const c = await req("POST", "/api/assets", { id: "TS-TEST-1", pseudo: "Tester", dept: "Sales", type: "Laptop" });
  assert.equal(c.status, 201);
  assert.equal(c.data.id, "TS-TEST-1");
  const log = await req("GET", "/api/audit?tag=TS-TEST-1");
  assert.ok(log.data.some((e) => e.action === "assigned"));
});

test("edit records a diff + history", async () => {
  await req("PUT", "/api/assets/TS-TEST-1", { ram: "32 GB" });
  const h = await req("GET", "/api/assets/TS-TEST-1/history");
  assert.ok(h.data.some((e) => (e.detail || "").includes("RAM")));
});

test("asset tag rename cascades history + frees old tag", async () => {
  const r = await req("PUT", "/api/assets/TS-TEST-1", { id: "TS-RENAMED-1" });
  assert.equal(r.status, 200);
  assert.equal(r.data.id, "TS-RENAMED-1");
  // old tag gone, new tag resolvable
  assert.equal((await req("GET", "/api/assets/TS-TEST-1/history")).status, 404);
  const h = await req("GET", "/api/assets/TS-RENAMED-1/history");
  assert.ok(h.data.length >= 2, "history carried over to the new tag");
  assert.ok(h.data.some((e) => (e.detail || "").includes("Asset tag")), "rename recorded in the diff");
  // renaming onto an existing tag is rejected
  await req("POST", "/api/assets", { id: "TS-TEST-2", pseudo: "Other", dept: "Sales", type: "Laptop" });
  const dup = await req("PUT", "/api/assets/TS-RENAMED-1", { id: "TS-TEST-2" });
  assert.equal(dup.status, 409);
  // rename back so later tests still find TS-TEST-1
  await req("PUT", "/api/assets/TS-RENAMED-1", { id: "TS-TEST-1" });
  await req("DELETE", "/api/assets/TS-TEST-2");
});

test("soft-delete retires (kept, hidden from default list)", async () => {
  const del = await req("DELETE", "/api/assets/TS-TEST-1");
  assert.equal(del.data.status, "retired");
  const def = await req("GET", "/api/assets?q=TS-TEST-1");
  assert.equal(def.data.length, 0);
  const inc = await req("GET", "/api/assets?q=TS-TEST-1&includeRetired=1");
  assert.equal(inc.data.length, 1);
});

test("password policy: weak new user password rejected", async () => {
  const r = await req("POST", "/api/users", { name: "Weak", email: "weak@t.io", role: "Viewer", password: "short" });
  assert.equal(r.status, 400);
});

test("inventory: create → receive → issue → valuation", async () => {
  await req("POST", "/api/auth/login", { email: "admin@test.local", password: "TestAdmin123" }); // ensure admin
  const cat = await req("POST", "/api/categories", { name: "TestCat", kind: "consumable" });
  assert.equal(cat.status, 201);
  const item = await req("POST", "/api/inventory", { name: "Test Cable", categoryId: cat.data.id, qty: 0, reorderLevel: 5, reorderQty: 20, unit: "pcs", unitCost: 2 });
  assert.equal(item.status, 201);
  assert.equal(item.data.low, true); // qty 0 <= reorder 5
  const id = item.data.id;

  const rec = await req("POST", `/api/inventory/${id}/receive`, { qty: 10, unitCost: 2 });
  assert.equal(rec.data.qty, 10);
  assert.equal(rec.data.value, 20); // 10 * 2
  assert.equal(rec.data.low, false);

  const iss = await req("POST", `/api/inventory/${id}/issue`, { qty: 3, employeeName: "Tester" });
  assert.equal(iss.data.qty, 7);
  assert.ok(iss.data.movements.length >= 2);

  const over = await req("POST", `/api/inventory/${id}/issue`, { qty: 999 });
  assert.equal(over.status, 409); // can't issue more than in stock

  const val = await req("GET", "/api/inventory/valuation");
  assert.ok(val.data.totalValue >= 14);
});

test("inventory: fixed one-per-asset peripherals can't be over-issued via the general Issue screen", async () => {
  await req("POST", "/api/auth/login", { email: "admin@test.local", password: "TestAdmin123" });
  // named "Keyboard" (not "Mouse") to avoid colliding with the separate Mouse item used by the
  // idempotent-assignment test below — adjustPeripheralStock matches items by name.
  const kb = await req("POST", "/api/inventory", { name: "Keyboard", kind: "accessory", qty: 10, reorderLevel: 2, reorderQty: 10, unit: "pcs", unitCost: 5 });
  assert.equal(kb.status, 201);
  const id = kb.data.id;
  await req("POST", "/api/assets", { id: "TS-KB-REGRESSION", pseudo: "Keyboard Tester", dept: "Sales", type: "Laptop" });

  // issuing 2 at once to a single asset is rejected outright
  const bulk = await req("POST", `/api/inventory/${id}/issue`, { qty: 2, employeeName: "Keyboard Tester", assetId: "TS-KB-REGRESSION" });
  assert.equal(bulk.status, 400);

  // one issue succeeds
  const first = await req("POST", `/api/inventory/${id}/issue`, { qty: 1, employeeName: "Keyboard Tester", assetId: "TS-KB-REGRESSION" });
  assert.equal(first.status, 200);
  assert.equal(first.data.qty, 9);

  // a second issue to the SAME asset (already holding one, unreturned) is rejected
  const second = await req("POST", `/api/inventory/${id}/issue`, { qty: 1, employeeName: "Keyboard Tester", assetId: "TS-KB-REGRESSION" });
  assert.equal(second.status, 409);
  assert.equal(second.data.qty, undefined); // no partial mutation — stock untouched

  // also rejected once the boolean peripheral flag is set directly (no stock_movements yet)
  await req("POST", "/api/assets", { id: "TS-KB-REGRESSION-2", pseudo: "Keyboard Tester 2", dept: "Sales", type: "Laptop" });
  await req("PUT", "/api/assets/TS-KB-REGRESSION-2", { keyboard: true });
  const viaFlag = await req("POST", `/api/inventory/${id}/issue`, { qty: 1, employeeName: "Keyboard Tester 2", assetId: "TS-KB-REGRESSION-2" });
  assert.equal(viaFlag.status, 409);

  // returning it frees the asset up for a fresh issue
  await req("POST", `/api/inventory/${id}/return`, { qty: 1, employeeName: "Keyboard Tester", assetId: "TS-KB-REGRESSION" });
  const again = await req("POST", `/api/inventory/${id}/issue`, { qty: 1, employeeName: "Keyboard Tester", assetId: "TS-KB-REGRESSION" });
  assert.equal(again.status, 200);

  await req("DELETE", "/api/assets/TS-KB-REGRESSION");
  await req("DELETE", "/api/assets/TS-KB-REGRESSION-2");
});

test("inventory: low-stock surfaces in alerts with a reorder suggestion", async () => {
  const a = await req("GET", "/api/alerts");
  // the test item is at qty 7 (>5) so not low; create a low one
  const cat = (await req("GET", "/api/categories")).data[0];
  const low = await req("POST", "/api/inventory", { name: "Low Item", categoryId: cat?.id, qty: 1, reorderLevel: 10, reorderQty: 50, unit: "pcs" });
  assert.equal(low.status, 201);
  const al = await req("GET", "/api/alerts");
  const hit = al.data.lowStock.find((x) => x.name === "Low Item");
  assert.ok(hit, "low item should appear in alerts");
  assert.equal(hit.suggestedReorder, 50);
});

test("spare hardware: mark in-stock → list → issue", async () => {
  await req("POST", "/api/auth/login", { email: "admin@test.local", password: "TestAdmin123" });
  const any = (await req("GET", "/api/assets")).data[0];
  await req("PUT", `/api/assets/${any.id}/in-stock`, { inStock: true });
  const spares = await req("GET", "/api/assets/spares");
  assert.ok(spares.data.some((s) => s.id === any.id));
  const issued = await req("POST", `/api/assets/${any.id}/issue-spare`, { pseudo: "SpareGuy", dept: "Sales" });
  assert.equal(issued.data.inStock, false);
  assert.equal(issued.data.pseudo, "SpareGuy");
});

test("spare hardware: an already-assigned spare cannot be reissued until returned to stock", async () => {
  await req("POST", "/api/auth/login", { email: "admin@test.local", password: "TestAdmin123" });
  const asset = await req("POST", "/api/assets", { id: "TS-SPARE-REGRESSION", pseudo: "Spare Regression Unit", dept: "Sales", type: "Laptop", shared: true });
  assert.equal(asset.status, 201);
  await req("PUT", "/api/assets/TS-SPARE-REGRESSION/in-stock", { inStock: true });
  const first = await req("POST", "/api/assets/TS-SPARE-REGRESSION/issue-spare", { pseudo: "Employee A", dept: "Sales" });
  assert.equal(first.status, 200);
  assert.equal(first.data.inStock, false);

  // still assigned to Employee A — reissuing to someone else must be rejected, not silently reassigned
  const reissue = await req("POST", "/api/assets/TS-SPARE-REGRESSION/issue-spare", { pseudo: "Employee B", dept: "Sales" });
  assert.equal(reissue.status, 409);
  const stillA = await req("GET", "/api/assets/TS-SPARE-REGRESSION");
  assert.equal(stillA.data.pseudo, "Employee A");

  // return to spare stock, then reissuing works again
  await req("PUT", "/api/assets/TS-SPARE-REGRESSION/in-stock", { inStock: true });
  const second = await req("POST", "/api/assets/TS-SPARE-REGRESSION/issue-spare", { pseudo: "Employee B", dept: "Sales" });
  assert.equal(second.status, 200);
  assert.equal(second.data.pseudo, "Employee B");

  await req("DELETE", "/api/assets/TS-SPARE-REGRESSION");
});

test("inventory: peripheral assignment is idempotent (no double-deduct, correct return)", async () => {
  await req("POST", "/api/auth/login", { email: "admin@test.local", password: "TestAdmin123" });
  const item = await req("POST", "/api/inventory", { name: "Mouse", kind: "accessory", qty: 5, reorderLevel: 1, reorderQty: 10, unit: "pcs", unitCost: 5 });
  assert.equal(item.status, 201);
  await req("POST", "/api/assets", { id: "TS-PERIPH-REGRESSION", pseudo: "Periph Tester", dept: "Sales", type: "Laptop" });

  const assigned = await req("PUT", "/api/assets/TS-PERIPH-REGRESSION", { mouse: true });
  assert.equal(assigned.data.mouse, true);
  let stock = await req("GET", `/api/inventory/${item.data.id}`);
  assert.equal(stock.data.qty, 4); // 5 -> 4

  // re-sending mouse:true (already assigned) must NOT deduct again
  await req("PUT", "/api/assets/TS-PERIPH-REGRESSION", { mouse: true });
  stock = await req("GET", `/api/inventory/${item.data.id}`);
  assert.equal(stock.data.qty, 4);

  // unassigning returns the unit to stock
  await req("PUT", "/api/assets/TS-PERIPH-REGRESSION", { mouse: false });
  stock = await req("GET", `/api/inventory/${item.data.id}`);
  assert.equal(stock.data.qty, 5);

  await req("DELETE", "/api/assets/TS-PERIPH-REGRESSION");
});

test("inventory: removing a peripheral never issued from stock does not restock (no phantom return)", async () => {
  await req("POST", "/api/auth/login", { email: "admin@test.local", password: "TestAdmin123" });
  // asset gets the keyboard flag BEFORE any matching stock item exists → column set, no stock movement.
  // This mimics imported/legacy assets whose peripherals were never drawn from the stock ledger.
  await req("POST", "/api/assets", { id: "TS-IMPORTED-KB", pseudo: "Imported KB", dept: "Sales", type: "Desktop", keyboard: true });
  const item = await req("POST", "/api/inventory", { name: "Keyboard", kind: "accessory", qty: 7, reorderLevel: 1, reorderQty: 5, unit: "pcs" });
  assert.equal(item.status, 201);
  // Un-ticking the keyboard must NOT invent a return that inflates stock (ledger custody = 0).
  await req("PUT", "/api/assets/TS-IMPORTED-KB", { keyboard: false });
  const stock = await req("GET", `/api/inventory/${item.data.id}`);
  assert.equal(stock.data.qty, 7); // unchanged — no phantom +1
  const moves = await req("GET", `/api/inventory/movements?itemId=${item.data.id}`);
  assert.equal(moves.data.filter((m) => m.asset_id === "TS-IMPORTED-KB").length, 0); // no stray movement
  await req("DELETE", "/api/assets/TS-IMPORTED-KB");
});

test("inventory: stock movements can be sorted by date ascending or descending", async () => {
  await req("POST", "/api/auth/login", { email: "admin@test.local", password: "TestAdmin123" });
  const item = await req("POST", "/api/inventory", { name: "SortMe Cable", kind: "consumable", qty: 0, reorderLevel: 1, reorderQty: 5, unit: "pcs" });
  const id = item.data.id;
  await req("POST", `/api/inventory/${id}/receive`, { qty: 10 }); // earlier movement (in)
  await req("POST", `/api/inventory/${id}/issue`, { qty: 2, reason: "t" }); // later movement (out)
  const desc = await req("GET", `/api/inventory/movements?itemId=${id}&dir=desc`);
  const asc  = await req("GET", `/api/inventory/movements?itemId=${id}&dir=asc`);
  assert.equal(desc.data[0].type, "out"); // newest first
  assert.equal(asc.data[0].type, "in");   // oldest first
});

test("export: assets.xlsx excludes retired (soft-deleted) assets", async () => {
  await req("POST", "/api/auth/login", { email: "admin@test.local", password: "TestAdmin123" });
  await req("POST", "/api/assets", { id: "TS-EXPORT-GONE", pseudo: "Ghost User", dept: "Sales", type: "Desktop" });
  await req("DELETE", "/api/assets/TS-EXPORT-GONE"); // soft-delete → status retired
  const res = await fetch(base + "/api/export/assets.xlsx", { headers: { ...XRW, Cookie: cookie } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("cache-control") || "", /no-store/); // never served from cache
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await res.arrayBuffer()));
  const ws = wb.getWorksheet("FINAL Desktop Details");
  let leaked = false;
  ws.eachRow((row) => row.eachCell((c) => {
    const v = String(c.value ?? "");
    if (v.includes("TS-EXPORT-GONE") || v.includes("Ghost User")) leaked = true;
  }));
  assert.equal(leaked, false); // retired record must never appear in the export
});

test("export: laptop serial + monitors are combined into one Monitors column", async () => {
  await req("POST", "/api/auth/login", { email: "admin@test.local", password: "TestAdmin123" });
  await req("POST", "/api/assets", { id: "TS-LP-EXP", pseudo: "Lap Exp", dept: "Sales", type: "Laptop", serial: "LP-SER-999" });
  await req("POST", "/api/assets", { id: "TS-DT-EXP", pseudo: "Desk Exp", dept: "Sales", type: "Desktop", mon1: "MON-AAA", mon2: "MON-BBB" });
  const res = await fetch(base + "/api/export/assets.xlsx", { headers: { ...XRW, Cookie: cookie } });
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await res.arrayBuffer()));
  const ws = wb.getWorksheet("FINAL Desktop Details");
  const headers = ws.getRow(1).values.map((v) => String(v ?? ""));
  const monCol = headers.indexOf("Monitors");
  assert.ok(monCol > 0, "Monitors column exists");
  assert.equal(headers.includes("MONITOR-1 SN"), false); // separate monitor columns are gone
  assert.equal(headers.includes("Serial No."), false);   // serial folded into Monitors
  const cellFor = (tag) => {
    let out = null;
    ws.eachRow((row, n) => { if (n > 1 && String(row.getCell(4).value || "") === tag) out = String(row.getCell(monCol).value || ""); });
    return out;
  };
  assert.match(cellFor("TS-LP-EXP"), /Laptop: LP-SER-999/);
  const dt = cellFor("TS-DT-EXP");
  assert.match(dt, /M1: MON-AAA/);
  assert.match(dt, /M2: MON-BBB/);
  await req("DELETE", "/api/assets/TS-LP-EXP");
  await req("DELETE", "/api/assets/TS-DT-EXP");
});

test("asset: serial is stored as its own field, separate from full name", async () => {
  await req("POST", "/api/auth/login", { email: "admin@test.local", password: "TestAdmin123" });
  const created = await req("POST", "/api/assets", {
    id: "TS-LP-SERIAL", pseudo: "Laptop User", dept: "Sales", type: "Laptop",
    fullName: "Laptop User Fullname", serial: "SN-ABC12345"
  });
  assert.equal(created.status, 201);
  const got = await req("GET", "/api/assets/TS-LP-SERIAL");
  assert.equal(got.data.serial, "SN-ABC12345");
  assert.equal(got.data.fullName, "Laptop User Fullname"); // serial did NOT land in full name
  // editing an unrelated field must preserve the serial (merge with the stored record)
  await req("PUT", "/api/assets/TS-LP-SERIAL", { cpu: "i7 13th" });
  const after = await req("GET", "/api/assets/TS-LP-SERIAL");
  assert.equal(after.data.serial, "SN-ABC12345");
  assert.equal(after.data.cpu, "i7 13th");
  await req("DELETE", "/api/assets/TS-LP-SERIAL");
});

test("inventory: receive and assign can be backdated to the actual transaction date", async () => {
  await req("POST", "/api/auth/login", { email: "admin@test.local", password: "TestAdmin123" });
  const item = await req("POST", "/api/inventory", { name: "Backdate Cable", kind: "consumable", qty: 0, reorderLevel: 1, reorderQty: 5, unit: "pcs" });
  const id = item.data.id;

  // receive: record the date the vendor actually delivered, not "now"
  const rec = await req("POST", `/api/inventory/${id}/receive`, { qty: 10, at: "2026-01-05" });
  assert.equal(rec.status, 200);
  const afterReceive = await req("GET", `/api/inventory/movements?itemId=${id}`);
  assert.match(afterReceive.data[0].at, /^2026-01-05/);

  // assign-item (Asset Assignment tab): record the date the item was actually handed over
  await req("POST", "/api/assets", { id: "TS-BACKDATE", pseudo: "Backdate User", dept: "Sales", type: "Desktop" });
  const assign = await req("POST", "/api/assets/TS-BACKDATE/assign-item", { itemId: id, at: "2026-01-06" });
  assert.equal(assign.status, 200);
  const afterAssign = await req("GET", `/api/inventory/movements?itemId=${id}`);
  assert.match(afterAssign.data[0].at, /^2026-01-06/);

  // omitted date still defaults to now (unaffected callers keep working)
  const now = await req("POST", `/api/inventory/${id}/issue`, { qty: 1, reason: "no date given" });
  assert.equal(now.status, 200);

  // reject a future date and an unparseable date
  const future = await req("POST", `/api/inventory/${id}/receive`, { qty: 1, at: "2099-01-01" });
  assert.equal(future.status, 400);
  const bad = await req("POST", `/api/inventory/${id}/receive`, { qty: 1, at: "not-a-date" });
  assert.equal(bad.status, 400);

  await req("DELETE", "/api/assets/TS-BACKDATE");
});

test("import: a file whose columns don't match the Template layout is rejected, not silently misread", async () => {
  // Regression for the 2026-07-31 incident: re-importing the general "Export" (combined Monitors
  // column, no WhatsApp/Nextiva) used to be read positionally as if it were the Template layout,
  // scrambling CPU/RAM/HDD/monitor/contact fields into the wrong columns with no error.
  await req("POST", "/api/auth/login", { email: "admin@test.local", password: "TestAdmin123" });
  const { assetsWorkbook } = await import("../src/services/export.service.js");
  const wb = await assetsWorkbook(); // the human-readable Export layout — must NOT be importable
  const buf = await wb.xlsx.writeBuffer();
  const form = new FormData();
  form.append("file", new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "assets.xlsx");
  const res = await fetch(base + "/api/import/assets", { method: "POST", headers: { "X-Requested-With": "XMLHttpRequest", Cookie: cookie }, body: form });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error || body.message || JSON.stringify(body), /Template/);
});

test("import: the Template layout is still accepted (good path unaffected by the header guard)", async () => {
  await req("POST", "/api/auth/login", { email: "admin@test.local", password: "TestAdmin123" });
  const { assetsTemplateWorkbook } = await import("../src/services/export.service.js");
  const wb = await assetsTemplateWorkbook(); // correct round-trip layout, with its 2 sample rows
  const buf = await wb.xlsx.writeBuffer();
  const form = new FormData();
  form.append("file", new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "template.xlsx");
  const res = await fetch(base + "/api/import/assets", { method: "POST", headers: { "X-Requested-With": "XMLHttpRequest", Cookie: cookie }, body: form });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.token);
  assert.ok(body.total > 0);
});

test("departments: renaming to a name already in use returns a clear 409, not a raw 500", async () => {
  await req("POST", "/api/auth/login", { email: "admin@test.local", password: "TestAdmin123" });
  const a = await req("POST", "/api/departments", { name: "Dept Rename A" });
  const b = await req("POST", "/api/departments", { name: "Dept Rename B" });
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  const clash = await req("PUT", `/api/departments/${b.data.id}`, { name: "Dept Rename A" });
  assert.equal(clash.status, 409);
  assert.match(clash.data.error || JSON.stringify(clash.data), /already exists/);
});

test("purchase requests: attach, download, and remove a document (e.g. the signed PR)", async () => {
  await req("POST", "/api/auth/login", { email: "admin@test.local", password: "TestAdmin123" });
  const pr = await req("POST", "/api/purchase-requests", {
    department: "Sales", category: "IT Consumable", businessPurpose: "Test attachment flow"
  });
  assert.equal(pr.status, 201);
  const prId = pr.data.id;

  // fresh PR has no attachments
  const before = await req("GET", `/api/purchase-requests/${prId}`);
  assert.deepEqual(before.data.attachments, []);

  // upload
  const content = "signed-pr-file-contents";
  const form = new FormData();
  form.append("file", new Blob([content], { type: "application/pdf" }), "signed-pr.pdf");
  const up = await fetch(base + `/api/purchase-requests/${prId}/attachments`, {
    method: "POST", headers: { "X-Requested-With": "XMLHttpRequest", Cookie: cookie }, body: form
  });
  assert.equal(up.status, 201);
  const list = await up.json();
  assert.equal(list.length, 1);
  assert.equal(list[0].filename, "signed-pr.pdf");
  const aid = list[0].id;

  // shows up on the PR detail fetch too (list route batches the same way)
  const after = await req("GET", `/api/purchase-requests/${prId}`);
  assert.equal(after.data.attachments.length, 1);

  // download returns the exact original bytes + filename
  const dl = await fetch(base + `/api/purchase-requests/attachments/${aid}`, { headers: { Cookie: cookie } });
  assert.equal(dl.status, 200);
  assert.match(dl.headers.get("content-disposition") || "", /signed-pr\.pdf/);
  assert.equal(await dl.text(), content);

  // delete removes it
  const del = await req("DELETE", `/api/purchase-requests/attachments/${aid}`);
  assert.equal(del.status, 200);
  const afterDelete = await req("GET", `/api/purchase-requests/${prId}`);
  assert.deepEqual(afterDelete.data.attachments, []);
  const gone = await fetch(base + `/api/purchase-requests/attachments/${aid}`, { headers: { Cookie: cookie } });
  assert.equal(gone.status, 404);
});

test("purchase requests: deleting a PR cleans up its attachment file", async () => {
  await req("POST", "/api/auth/login", { email: "admin@test.local", password: "TestAdmin123" });
  const pr = await req("POST", "/api/purchase-requests", {
    department: "Sales", category: "IT Consumable", businessPurpose: "Delete cascade test"
  });
  const prId = pr.data.id;
  const form = new FormData();
  form.append("file", new Blob(["x"], { type: "application/pdf" }), "note.pdf");
  const up = await fetch(base + `/api/purchase-requests/${prId}/attachments`, {
    method: "POST", headers: { "X-Requested-With": "XMLHttpRequest", Cookie: cookie }, body: form
  });
  const aid = (await up.json())[0].id;
  await req("PATCH", `/api/purchase-requests/${prId}/status`, { status: "Rejected" }); // deletable state
  await req("POST", "/api/auth/login", { email: "santosh@tasksource.net", password: "Welcome!2026" }); // delete is santosh-only
  const del = await req("DELETE", `/api/purchase-requests/${prId}`);
  assert.equal(del.status, 200);
  const gone = await fetch(base + `/api/purchase-requests/attachments/${aid}`, { headers: { Cookie: cookie } });
  assert.equal(gone.status, 404); // DB row (and the route's unlink) both cleaned up
  await req("POST", "/api/auth/login", { email: "admin@test.local", password: "TestAdmin123" }); // restore admin session
});

test("purchase requests & purchase orders: delete is restricted to santosh@tasksource.net — not even Admin", async () => {
  await req("POST", "/api/auth/login", { email: "admin@test.local", password: "TestAdmin123" });
  const pr = await req("POST", "/api/purchase-requests", {
    department: "Sales", category: "IT Consumable", businessPurpose: "Delete-restriction test"
  });
  await req("PATCH", `/api/purchase-requests/${pr.data.id}/status`, { status: "Rejected" });
  const po = await req("POST", "/api/purchase-orders", {
    vendor: "Delete Test Vendor", department: "Sales", category: "IT Consumable",
    items: [{ description: "Item", quantity: 1, rate: 10, taxRate: 18 }]
  });

  // the seeded bootstrap admin (a real Admin, just not Santosh) must be refused
  const prAsAdmin = await req("DELETE", `/api/purchase-requests/${pr.data.id}`);
  assert.equal(prAsAdmin.status, 403);
  const poAsAdmin = await req("DELETE", `/api/purchase-orders/${po.data.id}`);
  assert.equal(poAsAdmin.status, 403);

  // Santosh succeeds on both
  await req("POST", "/api/auth/login", { email: "santosh@tasksource.net", password: "Welcome!2026" });
  const prAsSantosh = await req("DELETE", `/api/purchase-requests/${pr.data.id}`);
  assert.equal(prAsSantosh.status, 200);
  const poAsSantosh = await req("DELETE", `/api/purchase-orders/${po.data.id}`);
  assert.equal(poAsSantosh.status, 200);

  await req("POST", "/api/auth/login", { email: "admin@test.local", password: "TestAdmin123" }); // restore admin session
});

test("purchase requests: can be edited while Pending, but not after a decision", async () => {
  await req("POST", "/api/auth/login", { email: "admin@test.local", password: "TestAdmin123" });
  const pr = await req("POST", "/api/purchase-requests", {
    department: "Sales", category: "IT Consumable", businessPurpose: "Original purpose",
    estimatedCost: 5000, suggestedVendors: "Vendor A"
  });
  const prId = pr.data.id;

  const edit = await req("PUT", `/api/purchase-requests/${prId}`, {
    businessPurpose: "Revised purpose — added a second unit", estimatedCost: 8000, suggestedVendors: "Vendor A, Vendor B"
  });
  assert.equal(edit.status, 200);
  assert.equal(edit.data.businessPurpose, "Revised purpose — added a second unit");
  assert.equal(edit.data.estimatedCost, 8000);
  assert.equal(edit.data.department, "Sales"); // untouched fields survive a partial edit

  await req("PATCH", `/api/purchase-requests/${prId}/status`, { status: "Approved" });
  const editAfterApprove = await req("PUT", `/api/purchase-requests/${prId}`, { businessPurpose: "Too late" });
  assert.equal(editAfterApprove.status, 409); // locked once decided
});

test("purchase orders: can be edited while Draft, but not after being sent to vendor", async () => {
  await req("POST", "/api/auth/login", { email: "admin@test.local", password: "TestAdmin123" });
  const po = await req("POST", "/api/purchase-orders", {
    vendor: "Test Vendor Co", department: "Sales", category: "IT Consumable",
    items: [{ description: "Widget", quantity: 2, rate: 100, taxRate: 18 }]
  });
  assert.equal(po.status, 201);
  const poId = po.data.id;

  const edit = await req("PUT", `/api/purchase-orders/${poId}`, {
    vendor: "Test Vendor Co", department: "Sales", category: "IT Consumable",
    items: [{ description: "Widget", quantity: 5, rate: 90, taxRate: 18 }] // qty/rate revised before sending
  });
  assert.equal(edit.status, 200);
  assert.equal(edit.data.items.length, 1);
  assert.equal(edit.data.items[0].quantity, 5);
  assert.equal(edit.data.items[0].rate, 90);

  await req("PATCH", `/api/purchase-orders/${poId}/status`, { status: "Sent to Vendor" });
  const editAfterSend = await req("PUT", `/api/purchase-orders/${poId}`, {
    vendor: "Test Vendor Co", items: [{ description: "Widget", quantity: 1, rate: 1, taxRate: 18 }]
  });
  assert.equal(editAfterSend.status, 409); // locked once sent
});

test("purchase requests: IT-Manager can approve/reject (not Admin-only), but cannot delete", async () => {
  await req("POST", "/api/auth/login", { email: "admin@test.local", password: "TestAdmin123" });
  const pr = await req("POST", "/api/purchase-requests", {
    department: "Sales", category: "IT Consumable", businessPurpose: "IT-Manager approval test"
  });
  const prId = pr.data.id;

  const made = await req("POST", "/api/users", { name: "Itm", email: "itm@t.io", role: "IT-Manager", password: "ItManagerPass1" });
  assert.equal(made.status, 201);
  await req("POST", "/api/auth/login", { email: "itm@t.io", password: "ItManagerPass1" });

  const approve = await req("PATCH", `/api/purchase-requests/${prId}/status`, { status: "Approved" });
  assert.equal(approve.status, 200); // IT-Manager can approve — used to be Admin-only
  assert.equal(approve.data.status, "Approved");

  const del = await req("DELETE", `/api/purchase-requests/${prId}`);
  assert.equal(del.status, 403); // deletion is restricted to a specific named account, not any role

  await req("POST", "/api/auth/login", { email: "admin@test.local", password: "TestAdmin123" }); // restore admin session
});

test("RBAC: Viewer cannot create assets", async () => {
  // admin creates a viewer with a compliant password
  const made = await req("POST", "/api/users", { name: "Vic", email: "vic@t.io", role: "Viewer", password: "ViewerPass1" });
  assert.equal(made.status, 201);
  // log in as viewer (new cookie replaces admin's)
  const li = await req("POST", "/api/auth/login", { email: "vic@t.io", password: "ViewerPass1" });
  assert.equal(li.status, 200);
  const post = await req("POST", "/api/assets", { id: "TS-VWR", dept: "Sales", type: "Desktop" });
  assert.equal(post.status, 403);
  const get = await req("GET", "/api/assets");
  assert.equal(get.status, 200); // viewer can still read
});

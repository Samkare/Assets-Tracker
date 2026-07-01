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

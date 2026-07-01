import ExcelJS from "exceljs";
import db from "../db/connection.js";
import { rowToAsset } from "../db/repo.js";
import { EXPORT_COLUMNS } from "../lib/columnMap.js";

export async function assetsWorkbook() {
  const rows = db.prepare(`
    SELECT a.*, d.name AS dept_name FROM assets a JOIN departments d ON d.id = a.department_id
    ORDER BY a.id`).all().map(rowToAsset);

  const wb = new ExcelJS.Workbook();
  wb.creator = "IT Asset Tracker";
  const ws = wb.addWorksheet("FINAL Desktop Details");
  ws.addRow(EXPORT_COLUMNS.map((c) => c.header));
  ws.getRow(1).font = { bold: true };
  for (const a of rows) {
    ws.addRow(EXPORT_COLUMNS.map((c) => {
      if (c.field === "_blank") return "";
      const v = a[c.field];
      return c.fmt ? c.fmt(v) : (v ?? "");
    }));
  }
  ws.columns.forEach((col) => { col.width = 16; });
  return wb;
}

// Blank import template: the exact columns the importer reads + 2 example rows + a hint row.
export async function assetsTemplateWorkbook() {
  const samples = [
    { dept: "Sales", pseudo: "Atlas", type: "Desktop", id: "TS-PC-001", cpu: "Intel i5 9th Gen",
      ram: "16 GB", hdd: "512 GB", mon1: "5ZHXH9TXA00442L", mon2: "5ZH4H9TX504351A",
      headphone: true, speaker: false, ipPhone: true, whatsapp: "", nextiva: "",
      webcam: false, mobileStand: true, status: "active", fullName: "Atlas Kumar", keyboard: true, mouse: true },
    { dept: "Shared Pool", pseudo: "", type: "Desktop", id: "TS-PC-002", cpu: "", ram: "", hdd: "",
      mon1: "", mon2: "", headphone: false, speaker: false, ipPhone: false, whatsapp: "", nextiva: "",
      webcam: false, mobileStand: false, status: "active", fullName: "", keyboard: false, mouse: false },
  ];
  const wb = new ExcelJS.Workbook();
  wb.creator = "IT Asset Tracker";
  const ws = wb.addWorksheet("FINAL Desktop Details"); // importer expects this sheet name
  ws.addRow(EXPORT_COLUMNS.map((c) => c.header));
  ws.getRow(1).font = { bold: true };
  // Two example rows show the conventions (assigned vs shared, YES/NO, DESKTOP). Replace with
  // your real rows before importing. Boolean cols = YES/NO; blank Pseudo Name = shared machine;
  // Asset Tag is required + unique.
  for (const a of samples) {
    ws.addRow(EXPORT_COLUMNS.map((c) => (c.field === "_blank" ? "" : (c.fmt ? c.fmt(a[c.field]) : (a[c.field] ?? "")))));
  }
  ws.columns.forEach((col) => { col.width = 16; });
  return wb;
}

export async function auditWorkbook() {
  const rows = db.prepare("SELECT ts, actor, action, tag, subject, dept, detail FROM audit_log ORDER BY ts DESC").all();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Audit Log");
  ws.addRow(["Timestamp", "Actor", "Action", "Asset Tag", "Subject", "Department", "Detail"]);
  ws.getRow(1).font = { bold: true };
  for (const r of rows) ws.addRow([r.ts, r.actor, r.action, r.tag, r.subject, r.dept, r.detail]);
  ws.columns.forEach((col) => { col.width = 20; });
  return wb;
}

// shared helper: build a workbook from a header list + row arrays
function simpleWorkbook(sheetName, headers, rows, width = 18) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "IT Asset Tracker";
  const ws = wb.addWorksheet(sheetName);
  ws.addRow(headers);
  ws.getRow(1).font = { bold: true };
  for (const r of rows) ws.addRow(r);
  ws.columns.forEach((col) => { col.width = width; });
  return wb;
}

export async function consumablesWorkbook() {
  const rows = db.prepare(`
    SELECT c.name, COALESCE(cat.name, c.category) AS category, c.qty, c.unit,
           c.reorder_level, c.reorder_qty, c.unit_cost, c.location, c.notes,
           s.name AS supplier
    FROM consumables c
    LEFT JOIN suppliers s ON s.id = c.supplier_id
    LEFT JOIN categories cat ON cat.id = c.category_id
    ORDER BY c.name`).all();
  return simpleWorkbook("Consumables",
    ["Item", "Category", "On hand", "Unit", "Reorder level", "Reorder qty", "Unit cost", "Supplier", "Location", "Notes", "Low?"],
    rows.map((r) => [
      r.name, r.category ?? "", r.qty, r.unit ?? "", r.reorder_level, r.reorder_qty ?? "",
      r.unit_cost ?? "", r.supplier ?? "", r.location ?? "", r.notes ?? "",
      r.qty <= r.reorder_level ? "LOW" : ""
    ]));
}

export async function softwareWorkbook() {
  const rows = db.prepare(`
    SELECT s.name, s.vendor, s.license_key, s.seats_total, s.purchase_date, s.cost,
           s.renewal_date, s.status, s.notes,
           (SELECT COUNT(*) FROM software_assignments a WHERE a.software_id = s.id) AS seats_used
    FROM software s ORDER BY s.name`).all();
  return simpleWorkbook("Software licenses",
    ["Name", "Vendor", "License key", "Seats total", "Seats used", "Seats free", "Purchase date", "Cost", "Renewal date", "Status", "Notes"],
    rows.map((r) => [
      r.name, r.vendor ?? "", r.license_key ?? "", r.seats_total, r.seats_used,
      Math.max(0, (r.seats_total || 0) - r.seats_used), r.purchase_date ?? "", r.cost ?? "",
      r.renewal_date ?? "", r.status ?? "", r.notes ?? ""
    ]));
}

export async function movementsWorkbook() {
  const rows = db.prepare(`
    SELECT m.at, c.name AS item, m.type, m.qty, m.condition, m.employee_name, m.asset_id,
           sup.name AS supplier, m.unit_cost, m.reason, m.actor
    FROM stock_movements m
    LEFT JOIN consumables c ON c.id = m.item_id
    LEFT JOIN suppliers sup ON sup.id = m.supplier_id
    ORDER BY m.at DESC`).all();
  return simpleWorkbook("Stock movements",
    ["Date", "Item", "Type", "Qty", "Condition", "Employee", "Asset", "Supplier", "Unit cost", "Reason", "Actor"],
    rows.map((r) => [
      r.at, r.item ?? "", r.type, r.qty, r.condition ?? "", r.employee_name ?? "", r.asset_id ?? "",
      r.supplier ?? "", r.unit_cost ?? "", r.reason ?? "", r.actor ?? ""
    ]));
}

// Read an uploaded xlsx buffer into the same { A:.., B:.. } cell shape the pipeline expects.
export async function xlsxToRows(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.getWorksheet("FINAL Desktop Details") || wb.worksheets[0];
  const cols = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V"];
  const rows = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const cells = {};
    for (const c of cols) {
      const cell = row.getCell(c);
      let v = cell?.value;
      if (v && typeof v === "object") v = v.text ?? v.result ?? v.hyperlink ?? "";
      if (v != null && String(v).trim() !== "") cells[c] = String(v).trim();
    }
    if (Object.keys(cells).length) rows.push(cells);
  });
  return rows;
}

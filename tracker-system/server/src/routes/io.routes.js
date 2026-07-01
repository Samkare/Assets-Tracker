import { Router } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { parseRows, planImport, commitImport } from "../services/import.service.js";
import { assetsWorkbook, assetsTemplateWorkbook, auditWorkbook, consumablesWorkbook, softwareWorkbook, movementsWorkbook, xlsxToRows } from "../services/export.service.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// In-memory staging: preview returns a token, commit replays the validated set.
// HIGH-14: per-user binding + UUID token so one operator can't commit another's preview.
const staged = new Map(); // token -> { assets, at, userId }
const STAGE_TTL = 15 * 60 * 1000;
function stash(assets, userId) {
  const token = `imp_${randomUUID()}`;
  staged.set(token, { assets, at: Date.now(), userId });
  for (const [k, v] of staged) if (Date.now() - v.at > STAGE_TTL) staged.delete(k);
  return token;
}

// --- Export (Viewer can export assets; audit export = IT-Manager) ---
router.get("/export/assets.xlsx", requireAuth, asyncHandler(async (req, res) => {
  const wb = await assetsWorkbook();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="assets.xlsx"');
  await wb.xlsx.write(res);
  res.end();
}));

router.get("/export/audit.xlsx", requireRole("IT-Manager"), asyncHandler(async (req, res) => {
  const wb = await auditWorkbook();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="audit-log.xlsx"');
  await wb.xlsx.write(res);
  res.end();
}));

// helper: stream any workbook as an .xlsx download
const sendXlsx = (filename, builder) => asyncHandler(async (req, res) => {
  const wb = await builder();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
});

router.get("/export/assets-template.xlsx", requireAuth, sendXlsx("asset-import-template.xlsx", assetsTemplateWorkbook));
router.get("/export/consumables.xlsx", requireAuth, sendXlsx("consumables.xlsx", consumablesWorkbook));
router.get("/export/software.xlsx", requireAuth, sendXlsx("software-licenses.xlsx", softwareWorkbook));
router.get("/export/stock-movements.xlsx", requireRole("IT-Manager"), sendXlsx("stock-movements.xlsx", movementsWorkbook));

// --- Import: dry-run preview, then commit ---
router.post("/import/assets", requireRole("IT-Manager"), upload.single("file"), asyncHandler(async (req, res) => {
  if (!req.file) throw new HttpError(400, "No file uploaded (field 'file')");
  const rowCells = await xlsxToRows(req.file.buffer);
  const { assets, errors, duplicates, newDepartments } = parseRows(rowCells);
  const plan = planImport(assets);
  res.json({
    token: stash(assets, req.session.userId),
    insert: plan.insert, update: plan.update, total: plan.total,
    duplicates, newDepartments, errors,
    sample: assets.slice(0, 10)
  });
}));

router.post("/import/assets/commit", requireRole("IT-Manager"), asyncHandler((req, res) => {
  const entry = staged.get(req.body?.token);
  if (!entry) throw new HttpError(410, "Import preview expired — upload the file again");
  // HIGH-14: only the operator who staged this preview can commit it
  if (entry.userId !== req.session.userId) throw new HttpError(403, "Import preview belongs to another user");
  const result = commitImport(entry.assets, req.session.name || "system");
  staged.delete(req.body.token);
  res.json(result);
}));

export default router;

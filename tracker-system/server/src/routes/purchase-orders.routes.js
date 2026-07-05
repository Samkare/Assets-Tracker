import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { config } from "../config.js";
import {
  purchaseOrderInputSchema,
  purchaseOrderUpdateSchema,
  purchaseOrderStatusSchema
} from "@its/shared/validation";
import * as svc from "../services/purchase-orders.service.js";

const router = Router();
const actor = (req) => req.session.name || "system";

// --- file uploads (attachments) ---
const UPLOAD_DIR = path.join(path.dirname(config.dbPath), "uploads", "po");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const ALLOWED = /pdf|image\/|msword|officedocument|ms-excel|spreadsheet|text\/plain|csv/i;
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 12);
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }, // 10 MB
  fileFilter: (req, file, cb) => cb(null, ALLOWED.test(file.mimetype))
});
// translate multer errors (size/type) into clean 400s instead of a 500
const uploadOne = (req, res, next) => upload.single("file")(req, res, (err) => {
  if (err) return res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "File too large (max 10 MB)" : (err.message || "Upload failed") });
  next();
});

// View — any authenticated user (Viewer+). Supports ?status=&department=&q= filters.
router.get("/", requireAuth, asyncHandler((req, res) =>
  res.json(svc.listPurchaseOrders(req.query))
));

// Download an attachment (streamed with its original filename). Placed before "/:id".
router.get("/attachments/:aid", requireAuth, asyncHandler((req, res) => {
  const a = svc.getAttachmentForDownload(Number(req.params.aid));
  if (!a) return res.status(404).json({ error: "not found" });
  res.download(path.join(UPLOAD_DIR, a.stored_name), a.filename);
}));

router.get("/:id", requireAuth, asyncHandler((req, res) => {
  const po = svc.getPurchaseOrder(Number(req.params.id));
  if (!po) return res.status(404).json({ error: "not found" });
  res.json(po);
}));

// Generate a PO from an approved PR — IT-Manager+. When the client sends no vendor we default it
// to the PR's first suggested vendor (Admin can still change it later).
router.post("/", requireRole("IT-Manager"), asyncHandler((req, res) => {
  const body = { ...req.body };
  if ((body.vendor == null || body.vendor === "") && body.prId != null) {
    const v = svc.firstSuggestedVendor(Number(body.prId));
    if (v) body.vendor = v;
  }
  const input = purchaseOrderInputSchema.parse(body);
  res.status(201).json(svc.generatePO(input, actor(req)));
}));

// Edit a Draft PO (details + line items) — IT-Manager+.
router.put("/:id", requireRole("IT-Manager"), asyncHandler((req, res) => {
  const patch = purchaseOrderUpdateSchema.parse(req.body);
  res.json(svc.updatePurchaseOrder(Number(req.params.id), patch, actor(req)));
}));

// Advance status (Draft → Sent to Vendor → Fulfilled / Cancelled) — Admin only.
router.patch("/:id/status", requireRole("Admin"), asyncHandler((req, res) => {
  const { status } = purchaseOrderStatusSchema.parse(req.body);
  res.json(svc.setPurchaseOrderStatus(Number(req.params.id), status, actor(req)));
}));

// Attach a reference document (quotation / bill) — IT-Manager+. multipart field name: "file".
router.post("/:id/attachments", requireRole("IT-Manager"), uploadOne, asyncHandler((req, res) => {
  if (!req.file) throw new HttpError(400, "No file uploaded");
  const list = svc.addAttachment(Number(req.params.id), {
    filename: req.file.originalname, storedName: req.file.filename, mime: req.file.mimetype, size: req.file.size
  }, actor(req));
  res.status(201).json(list);
}));

// Delete an attachment — IT-Manager+ (removes the DB row and unlinks the file).
router.delete("/attachments/:aid", requireRole("IT-Manager"), asyncHandler((req, res) => {
  const { storedName } = svc.deleteAttachment(Number(req.params.aid), actor(req));
  if (storedName) { try { fs.unlinkSync(path.join(UPLOAD_DIR, storedName)); } catch { /* already gone */ } }
  res.json({ ok: true });
}));

// Delete a Draft PO — Admin only (also unlinks any attachment files).
router.delete("/:id", requireRole("Admin"), asyncHandler((req, res) => {
  const { storedNames = [] } = svc.deletePurchaseOrder(Number(req.params.id), actor(req));
  for (const name of storedNames) { try { fs.unlinkSync(path.join(UPLOAD_DIR, name)); } catch { /* ignore */ } }
  res.json({ ok: true });
}));

export default router;

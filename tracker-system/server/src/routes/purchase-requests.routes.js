import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { config } from "../config.js";
import {
  purchaseRequestInputSchema,
  purchaseRequestUpdateSchema,
  purchaseRequestStatusSchema
} from "@its/shared/validation";
import * as svc from "../services/purchase-requests.service.js";

const router = Router();
const actor = (req) => req.session.name || "system";

// --- file uploads (attachments — e.g. the signed/approved document) ---
const UPLOAD_DIR = path.join(path.dirname(config.dbPath), "uploads", "pr");
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

// View — any authenticated user (Viewer+). Supports ?status=&department=&category=&q= filters.
router.get("/", requireAuth, asyncHandler((req, res) =>
  res.json(svc.listPurchaseRequests(req.query))
));

// Download an attachment (streamed with its original filename). Placed before "/:id".
router.get("/attachments/:aid", requireAuth, asyncHandler((req, res) => {
  const a = svc.getAttachmentForDownload(Number(req.params.aid));
  if (!a) return res.status(404).json({ error: "not found" });
  res.download(path.join(UPLOAD_DIR, a.stored_name), a.filename);
}));

router.get("/:id", requireAuth, asyncHandler((req, res) => {
  const pr = svc.getPurchaseRequest(Number(req.params.id));
  if (!pr) return res.status(404).json({ error: "not found" });
  res.json(pr);
}));

// Create — IT-Manager+. "Requested By" is forced to the logged-in user (any client value is ignored),
// so the record is always attributable to whoever raised it.
router.post("/", requireRole("IT-Manager"), asyncHandler((req, res) => {
  const input = purchaseRequestInputSchema.parse({ ...req.body, requestedBy: req.session.name });
  res.status(201).json(svc.createPurchaseRequest(input, actor(req)));
}));

// Edit — IT-Manager+, only while the PR is Pending (enforced in the service).
router.put("/:id", requireRole("IT-Manager"), asyncHandler((req, res) => {
  const patch = purchaseRequestUpdateSchema.parse(req.body);
  res.json(svc.updatePurchaseRequest(Number(req.params.id), patch, actor(req)));
}));

// Attach a document (e.g. the signed/approved PR, a vendor quote) — IT-Manager+. Allowed at any
// status, not just Approved — often the reference material is gathered before/while it's decided.
// multipart field name: "file".
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

// Approve / reject — Admin only.
router.patch("/:id/status", requireRole("Admin"), asyncHandler((req, res) => {
  const { status } = purchaseRequestStatusSchema.parse(req.body);
  res.json(svc.setPurchaseRequestStatus(Number(req.params.id), status, actor(req)));
}));

// Delete — Admin only (also unlinks any attachment files).
router.delete("/:id", requireRole("Admin"), asyncHandler((req, res) => {
  const { storedNames = [] } = svc.deletePurchaseRequest(Number(req.params.id), actor(req));
  for (const name of storedNames) { try { fs.unlinkSync(path.join(UPLOAD_DIR, name)); } catch { /* ignore */ } }
  res.json({ ok: true });
}));

export default router;

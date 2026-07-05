import { Router } from "express";
import { asyncHandler } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  purchaseRequestInputSchema,
  purchaseRequestUpdateSchema,
  purchaseRequestStatusSchema
} from "@its/shared/validation";
import * as svc from "../services/purchase-requests.service.js";

const router = Router();
const actor = (req) => req.session.name || "system";

// View — any authenticated user (Viewer+). Supports ?status=&department=&category=&q= filters.
router.get("/", requireAuth, asyncHandler((req, res) =>
  res.json(svc.listPurchaseRequests(req.query))
));

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

// Approve / reject — Admin only.
router.patch("/:id/status", requireRole("Admin"), asyncHandler((req, res) => {
  const { status } = purchaseRequestStatusSchema.parse(req.body);
  res.json(svc.setPurchaseRequestStatus(Number(req.params.id), status, actor(req)));
}));

// Delete — Admin only.
router.delete("/:id", requireRole("Admin"), asyncHandler((req, res) =>
  res.json(svc.deletePurchaseRequest(Number(req.params.id), actor(req)))
));

export default router;

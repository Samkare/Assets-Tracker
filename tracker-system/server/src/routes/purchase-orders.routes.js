import { Router } from "express";
import { asyncHandler } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  purchaseOrderInputSchema,
  purchaseOrderUpdateSchema,
  purchaseOrderStatusSchema
} from "@its/shared/validation";
import * as svc from "../services/purchase-orders.service.js";

const router = Router();
const actor = (req) => req.session.name || "system";

// View — any authenticated user (Viewer+). Supports ?status=&department=&q= filters.
router.get("/", requireAuth, asyncHandler((req, res) =>
  res.json(svc.listPurchaseOrders(req.query))
));

router.get("/:id", requireAuth, asyncHandler((req, res) => {
  const po = svc.getPurchaseOrder(Number(req.params.id));
  if (!po) return res.status(404).json({ error: "not found" });
  res.json(po);
}));

// Generate a PO from an approved PR — IT-Manager+. As a convenience, when the client doesn't
// pick a vendor we default it to the PR's first suggested vendor (Admin can still change it later).
router.post("/", requireRole("IT-Manager"), asyncHandler((req, res) => {
  const body = { ...req.body };
  if ((body.vendor == null || body.vendor === "") && body.prId != null) {
    const v = svc.firstSuggestedVendor(Number(body.prId));
    if (v) body.vendor = v;
  }
  const input = purchaseOrderInputSchema.parse(body);
  res.status(201).json(svc.generatePO(input, actor(req)));
}));

// Edit a Draft PO — IT-Manager+ (blocked once the PO leaves Draft, enforced in the service).
router.put("/:id", requireRole("IT-Manager"), asyncHandler((req, res) => {
  const patch = purchaseOrderUpdateSchema.parse(req.body);
  res.json(svc.updatePurchaseOrder(Number(req.params.id), patch, actor(req)));
}));

// Advance status (Draft → Sent to Vendor → Fulfilled / Cancelled) — Admin only.
router.patch("/:id/status", requireRole("Admin"), asyncHandler((req, res) => {
  const { status } = purchaseOrderStatusSchema.parse(req.body);
  res.json(svc.setPurchaseOrderStatus(Number(req.params.id), status, actor(req)));
}));

// Delete a Draft PO — Admin only.
router.delete("/:id", requireRole("Admin"), asyncHandler((req, res) =>
  res.json(svc.deletePurchaseOrder(Number(req.params.id), actor(req)))
));

export default router;

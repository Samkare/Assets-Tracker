import { Router } from "express";
import { asyncHandler } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { assetInputSchema, assetUpdateSchema } from "@its/shared/validation";
import * as svc from "../services/assets.service.js";

const router = Router();
const actor = (req) => req.session.name || "system";

router.get("/", requireAuth, asyncHandler((req, res) => {
  res.json(svc.listAssets(req.query));
}));

router.get("/spares", requireAuth, asyncHandler((req, res) => res.json(svc.listSpares())));
router.put("/:id/in-stock", requireRole("IT-Manager"), asyncHandler((req, res) =>
  res.json(svc.setInStock(req.params.id, req.body?.inStock !== false, actor(req)))));
router.post("/:id/issue-spare", requireRole("IT-Manager"), asyncHandler((req, res) =>
  res.json(svc.issueSpare(req.params.id, req.body, actor(req)))));

router.get("/:id", requireAuth, asyncHandler((req, res) => {
  const a = svc.getAsset(req.params.id);
  if (!a) return res.status(404).json({ error: "not found" });
  res.json(a);
}));

router.get("/:id/history", requireAuth, asyncHandler((req, res) => {
  res.json(svc.getHistory(req.params.id));
}));

router.post("/bulk", requireRole("IT-Manager"), asyncHandler((req, res) => {
  const { ids, action, payload } = req.body || {};
  res.json(svc.bulkAction(ids, action, payload, actor(req)));
}));

router.post("/", requireRole("IT-Manager"), asyncHandler((req, res) => {
  res.status(201).json(svc.createAsset(assetInputSchema.parse(req.body), actor(req)));
}));

router.put("/:id", requireRole("IT-Manager"), asyncHandler((req, res) => {
  res.json(svc.updateAsset(req.params.id, assetUpdateSchema.parse(req.body), actor(req)));
}));

router.post("/:id/repair", requireRole("IT-Manager"), asyncHandler((req, res) => {
  const toRepair = req.body?.repair !== false; // default: send to repair
  res.json(svc.repairAsset(req.params.id, toRepair, actor(req)));
}));

router.delete("/:id", requireRole("IT-Manager"), asyncHandler((req, res) => {
  res.json(svc.removeAsset(req.params.id, actor(req)));
}));

router.post("/:id/restore", requireRole("IT-Manager"), asyncHandler((req, res) => {
  res.json(svc.restoreAsset(req.params.id, actor(req)));
}));

export default router;

import { Router } from "express";
import { asyncHandler } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import * as svc from "../services/repair.service.js";

const router = Router();
const actor = (req) => req.session.name || "system";

router.get("/", requireAuth, asyncHandler((req, res) => res.json(svc.listRepairs(req.query))));
router.get("/:id", requireAuth, asyncHandler((req, res) => {
  const t = svc.getRepair(req.params.id);
  if (!t) return res.status(404).json({ error: "not found" });
  res.json(t);
}));
router.post("/", requireRole("IT-Manager"), asyncHandler((req, res) => {
  res.status(201).json(svc.openRepair(req.body, actor(req)));
}));
router.put("/:id", requireRole("IT-Manager"), asyncHandler((req, res) => {
  res.json(svc.updateRepair(req.params.id, req.body, actor(req)));
}));

export default router;

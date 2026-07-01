import { Router } from "express";
import { asyncHandler } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import * as svc from "../services/software.service.js";

const router = Router();
const actor = (req) => req.session.name || "system";

router.get("/", requireAuth, asyncHandler((req, res) => res.json(svc.listSoftware())));
router.get("/:id", requireAuth, asyncHandler((req, res) => {
  const s = svc.getSoftware(req.params.id);
  if (!s) return res.status(404).json({ error: "not found" });
  res.json(s);
}));
router.post("/", requireRole("IT-Manager"), asyncHandler((req, res) => res.status(201).json(svc.createSoftware(req.body))));
router.put("/:id", requireRole("IT-Manager"), asyncHandler((req, res) => res.json(svc.updateSoftware(req.params.id, req.body))));
router.delete("/:id", requireRole("Admin"), asyncHandler((req, res) => res.json(svc.deleteSoftware(req.params.id))));
router.post("/:id/assignments", requireRole("IT-Manager"), asyncHandler((req, res) => res.json(svc.assign(req.params.id, req.body, actor(req)))));
router.delete("/:id/assignments/:aid", requireRole("IT-Manager"), asyncHandler((req, res) => res.json(svc.unassign(req.params.id, req.params.aid))));

export default router;

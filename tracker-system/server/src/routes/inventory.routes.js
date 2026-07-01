import { Router } from "express";
import { asyncHandler } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import * as svc from "../services/inventory.service.js";

const router = Router();
const actor = (req) => req.session.name || "system";

router.get("/", requireAuth, asyncHandler((req, res) => res.json(svc.listItems(req.query))));
router.get("/movements", requireAuth, asyncHandler((req, res) => res.json(svc.listMovements(req.query))));
router.get("/defective", requireAuth, asyncHandler((req, res) => res.json(svc.listDefective(req.query))));
router.get("/valuation", requireAuth, asyncHandler((req, res) => res.json(svc.valuation())));
router.get("/:id", requireAuth, asyncHandler((req, res) => {
  const i = svc.getItem(req.params.id);
  if (!i) return res.status(404).json({ error: "not found" });
  res.json(i);
}));

router.post("/", requireRole("IT-Manager"), asyncHandler((req, res) => res.status(201).json(svc.createItem(req.body))));
router.put("/:id", requireRole("IT-Manager"), asyncHandler((req, res) => res.json(svc.updateItem(req.params.id, req.body))));
router.delete("/:id", requireRole("Admin"), asyncHandler((req, res) => res.json(svc.deleteItem(req.params.id))));

router.post("/:id/receive", requireRole("IT-Manager"), asyncHandler((req, res) => res.json(svc.receive(req.params.id, req.body, actor(req)))));
router.post("/:id/issue",   requireRole("IT-Manager"), asyncHandler((req, res) => res.json(svc.issue(req.params.id, req.body, actor(req)))));
router.post("/:id/return",  requireRole("IT-Manager"), asyncHandler((req, res) => res.json(svc.giveBack(req.params.id, req.body, actor(req)))));
router.post("/:id/adjust",  requireRole("IT-Manager"), asyncHandler((req, res) => res.json(svc.adjust(req.params.id, req.body, actor(req)))));

export default router;

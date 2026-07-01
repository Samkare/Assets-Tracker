import { Router } from "express";
import { asyncHandler } from "../middleware/error.js";
import { requireAuth } from "../middleware/auth.js";
import * as svc from "../services/consumables.service.js";

// READ-ONLY legacy endpoint. Stock Overview reads consumables here, but ALL writes go
// through /api/inventory (which logs stock_movements + cost). The old write routes were
// removed so nothing can mutate stock through a path that bypasses the movement ledger.
const router = Router();

router.get("/", requireAuth, asyncHandler((req, res) => res.json(svc.listConsumables())));
router.get("/:id", requireAuth, asyncHandler((req, res) => {
  const c = svc.getConsumable(req.params.id);
  if (!c) return res.status(404).json({ error: "not found" });
  res.json(c);
}));

export default router;

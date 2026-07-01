import { Router } from "express";
import { asyncHandler } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { listPeripherals, createPeripheral, updatePeripheral, deletePeripheral } from "../services/peripherals.service.js";

const router = Router();

router.get("/", requireAuth, asyncHandler((req, res) => {
  res.json(listPeripherals(req.query.all === "1"));
}));

router.post("/", requireRole("IT-Manager"), asyncHandler((req, res) => {
  res.status(201).json(createPeripheral(req.body || {}));
}));

router.put("/:id", requireRole("IT-Manager"), asyncHandler((req, res) => {
  res.json(updatePeripheral(Number(req.params.id), req.body || {}));
}));

router.delete("/:id", requireRole("IT-Manager"), asyncHandler((req, res) => {
  res.json(deletePeripheral(Number(req.params.id)));
}));

export default router;

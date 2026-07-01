import { Router } from "express";
import { asyncHandler } from "../middleware/error.js";
import { requireAuth } from "../middleware/auth.js";
import { summary, trends, techPerformance, supplierPerformance } from "../services/reports.service.js";

const router = Router();
router.get("/summary", requireAuth, asyncHandler((req, res) => res.json(summary())));
router.get("/trends", requireAuth, asyncHandler((req, res) => res.json(trends())));
router.get("/tech-performance", requireAuth, asyncHandler((req, res) => res.json(techPerformance())));
router.get("/supplier-performance", requireAuth, asyncHandler((req, res) => res.json(supplierPerformance())));
export default router;

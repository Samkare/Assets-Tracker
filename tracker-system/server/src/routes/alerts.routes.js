import { Router } from "express";
import { asyncHandler } from "../middleware/error.js";
import { requireAuth } from "../middleware/auth.js";
import { alerts } from "../services/alerts.service.js";

const router = Router();
router.get("/", requireAuth, asyncHandler((req, res) => res.json(alerts())));
export default router;

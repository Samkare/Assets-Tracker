import { Router } from "express";
import db from "../db/connection.js";
import { asyncHandler } from "../middleware/error.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, asyncHandler((req, res) => {
  const { tag, actor, action } = req.query;
  const limit = Math.min(Number(req.query.limit) || 500, 2000);
  const offset = Number(req.query.offset) || 0;
  const where = [];
  const params = {};
  if (tag)    { where.push("tag = @tag");       params.tag = tag; }
  if (actor)  { where.push("actor = @actor");   params.actor = actor; }
  if (action && action !== "All") { where.push("action = @action"); params.action = String(action).toLowerCase(); }
  const sql = `SELECT * FROM audit_log ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY ts DESC, id DESC LIMIT @limit OFFSET @offset`;
  res.json(db.prepare(sql).all({ ...params, limit, offset }));
}));

export default router;

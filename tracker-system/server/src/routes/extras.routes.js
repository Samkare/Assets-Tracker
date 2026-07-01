import { Router } from "express";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import * as prefs from "../services/prefs.service.js";
import * as tpl from "../services/templates.service.js";
import { notifications } from "../services/notifications.service.js";

export const prefsRouter = Router();
prefsRouter.get("/:key", requireAuth, asyncHandler((req, res) =>
  res.json({ value: prefs.getPref(req.session.userId, req.params.key, null) })));
prefsRouter.put("/:key", requireAuth, asyncHandler((req, res) =>
  res.json({ value: prefs.setPref(req.session.userId, req.params.key, req.body?.value) })));

export const templatesRouter = Router();
templatesRouter.get("/", requireAuth, asyncHandler((req, res) => res.json(tpl.listTemplates())));
templatesRouter.post("/", requireRole("IT-Manager"), asyncHandler((req, res) => res.status(201).json(tpl.createTemplate(req.body))));
templatesRouter.put("/:id", requireRole("IT-Manager"), asyncHandler((req, res) => res.json(tpl.updateTemplate(req.params.id, req.body))));
templatesRouter.delete("/:id", requireRole("Admin"), asyncHandler((req, res) => res.json(tpl.deleteTemplate(req.params.id))));

export const notifsRouter = Router();
notifsRouter.get("/", requireAuth, asyncHandler((req, res) =>
  res.json(notifications(req.session.name))));

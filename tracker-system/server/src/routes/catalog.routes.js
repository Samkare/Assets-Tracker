import { Router } from "express";
import { asyncHandler } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import * as svc from "../services/catalog.service.js";

export const suppliersRouter = Router();
suppliersRouter.get("/", requireAuth, asyncHandler((req, res) => res.json(svc.listSuppliers())));
suppliersRouter.post("/", requireRole("IT-Manager"), asyncHandler((req, res) => res.status(201).json(svc.createSupplier(req.body))));
suppliersRouter.put("/:id", requireRole("IT-Manager"), asyncHandler((req, res) => res.json(svc.updateSupplier(req.params.id, req.body))));
suppliersRouter.delete("/:id", requireRole("Admin"), asyncHandler((req, res) => res.json(svc.deleteSupplier(req.params.id))));

export const categoriesRouter = Router();
categoriesRouter.get("/", requireAuth, asyncHandler((req, res) => res.json(svc.listCategories())));
categoriesRouter.post("/", requireRole("IT-Manager"), asyncHandler((req, res) => res.status(201).json(svc.createCategory(req.body))));
categoriesRouter.put("/:id", requireRole("IT-Manager"), asyncHandler((req, res) => res.json(svc.updateCategory(req.params.id, req.body))));
categoriesRouter.delete("/:id", requireRole("Admin"), asyncHandler((req, res) => res.json(svc.deleteCategory(req.params.id))));

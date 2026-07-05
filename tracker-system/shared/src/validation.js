// zod schemas — used by API routes (request bodies) and import (per-row validation).
import { z } from "zod";
import { ASSET_TYPES, ASSET_STATUSES, ROLES, PR_CATEGORIES, PR_STATUSES } from "./constants.js";

const optStr = z.string().trim().max(120).optional().nullable();

// Form/API input for an asset (pre-buildAsset). pseudo blank => shared machine.
export const assetInputSchema = z.object({
  id: z.string().trim().min(1, "Asset tag required").max(40),
  pseudo: z.string().trim().max(80).nullable().optional(),
  fullName: z.string().trim().max(120).nullable().optional(),
  dept: z.string().trim().min(1, "Department required").max(60),
  type: z.enum(ASSET_TYPES),
  cpu: optStr,
  ram: optStr,
  hdd: optStr,
  mon1: optStr,
  mon2: optStr,
  whatsapp: optStr,
  nextiva: optStr,
  returnDue: optStr, // loan/spare return date (YYYY-MM-DD) — drives Overdue Returns; null = not a loaner
  status: z.enum(ASSET_STATUSES).optional().default("active"),
  headphone: z.boolean().optional().default(false),
  speaker: z.boolean().optional().default(false),
  keyboard: z.boolean().optional().default(false),
  mouse: z.boolean().optional().default(false),
  ipPhone: z.boolean().optional().default(false),
  webcam: z.boolean().optional().default(false),
  mobileStand: z.boolean().optional().default(false),
  customPeripherals: z.array(z.string().trim().max(40)).max(50).optional()
});

export const assetUpdateSchema = assetInputSchema.partial().extend({
  id: z.string().trim().min(1).max(40).optional()
});

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Email required").max(254),
  password: z.string().min(1, "Password required").max(128)
});

// Password policy — applied whenever a password is SET (not on login).
export const PASSWORD_RULES = "At least 10 characters, including upper-case, lower-case, and a number.";
export function checkPassword(pw) {
  const s = String(pw || "");
  if (s.length < 10) return { ok: false, error: PASSWORD_RULES };
  if (!/[a-z]/.test(s) || !/[A-Z]/.test(s) || !/[0-9]/.test(s)) return { ok: false, error: PASSWORD_RULES };
  return { ok: true };
}
export const passwordSchema = z.string().refine((v) => checkPassword(v).ok, PASSWORD_RULES);

export const userInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email(),
  role: z.enum(ROLES),
  phone: optStr,
  focus: optStr,
  since: optStr,
  password: z.string().min(6).optional()
});

export const employeeInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  dept: z.string().trim().min(1).max(60)
});

export const departmentInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  hue: z.number().int().min(0).max(360).optional()
});

// ── Purchase Request (PR) module ───────────────────────────────────────────
// Requestor-submitted fields only. pr_number, created_at, and status are set
// server-side (status defaults to 'Pending'), so they are intentionally absent here.
export const purchaseRequestInputSchema = z.object({
  requestedBy:      z.string().trim().min(1, "Requested by is required").max(80),
  department:       z.string().trim().min(1, "Department required").max(60),
  category:         z.enum(PR_CATEGORIES),
  businessPurpose:  z.string().trim().min(1, "Business purpose is required").max(2000),
  requiredBy:       z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").nullable().optional(),
  estimatedCost:    z.number().nonnegative("Cost cannot be negative").max(1_000_000_000).nullable().optional(),
  suggestedVendors: z.string().trim().max(300).nullable().optional()
});

// Edits reuse the same rules but every field is optional (PATCH semantics).
export const purchaseRequestUpdateSchema = purchaseRequestInputSchema.partial();

// Approve / reject — the privileged status transition (separate endpoint, role-gated in Step 2).
export const purchaseRequestStatusSchema = z.object({
  status: z.enum(PR_STATUSES)
});

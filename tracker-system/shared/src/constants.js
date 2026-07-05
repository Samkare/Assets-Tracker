// Single source of truth — imported by server (import/seed/validation) AND client (forms/badges).
// Values lifted from the prototype data.js so badge hues and dept lists match exactly.

export const DEPARTMENTS = [
  "Sales", "Payments", "Smart Key", "LGD Purchase", "Accounts", "Watches",
  "Purchase", "Mindhives", "Sales Outbound", "Surya", "Credit", "Shipping",
  "Cheques", "MIS/IT", "Buying", "Shared Pool"
];

// hue per department for badge tints (oklch hue degrees)
export const DEPT_HUE = {
  "Sales": 248,
  "Payments": 210,
  "Smart Key": 168,
  "LGD Purchase": 28,
  "Accounts": 330,
  "Watches": 12,
  "Purchase": 200,
  "Mindhives": 272,
  "Sales Outbound": 140,
  "Surya": 52,
  "Credit": 92,
  "Shipping": 304,
  "Cheques": 238,
  "MIS/IT": 180,
  "Buying": 358,
  "Shared Pool": 248
};
export const DEFAULT_HUE = 240;

export const ASSET_TYPES = ["Desktop", "Laptop"];

export const ASSET_STATUSES = ["active", "repair", "retired"];

// fixed peripheral set — key matches DB column (camel) + asset field; label for UI
export const PERIPHERALS = [
  { key: "headphone",   col: "headphone",    label: "Headphone" },
  { key: "speaker",     col: "speaker",      label: "Speaker" },
  { key: "keyboard",    col: "keyboard",     label: "Keyboard" },
  { key: "mouse",       col: "mouse",        label: "Mouse" },
  { key: "ipPhone",     col: "ip_phone",     label: "IP Phone" },
  { key: "webcam",      col: "webcam",       label: "Web Cam" },
  { key: "mobileStand", col: "mobile_stand", label: "Mobile Stand" }
];

export const ROLES = ["Viewer", "IT-Manager", "Admin"];
export const ROLE_RANK = { "Viewer": 1, "IT-Manager": 2, "Admin": 3 };

export const AUDIT_ACTIONS = ["added", "assigned", "reassigned", "edited", "repair", "removed"];

export const SHARED_PSEUDO = "Day-Shift PC";

// Purchase Request module — single source of truth for the dropdowns.
// Edit these freely; the Zod enums pick them up automatically (no migration needed for categories).
export const PR_CATEGORIES = [
  "Major Procurement",
  "IT Consumable",
  "Service Repair",
  "Software License",
  "Hardware",
  "Other"
];

export const PR_STATUSES = ["Pending", "Approved", "Rejected"];

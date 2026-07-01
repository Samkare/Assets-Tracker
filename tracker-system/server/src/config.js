import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// repo root = tracker-system/  (server/src -> ../../)
export const ROOT = path.resolve(__dirname, "../..");

const abs = (p, fallback) => {
  const v = p || fallback;
  return path.isAbsolute(v) ? v : path.resolve(ROOT, v);
};

const DEFAULT_SECRET = "dev-insecure-secret-change-me";
const isProd = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

// Fail fast: never run production with the dev session secret.
if (isProd && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === DEFAULT_SECRET)) {
  console.error("[config] FATAL: SESSION_SECRET must be set to a strong unique value in production.");
  process.exit(1);
}

// CRIT-2: never ship a default bootstrap admin password to production.
if (isProd && !process.env.BOOTSTRAP_ADMIN_PASSWORD) {
  console.error("[config] FATAL: BOOTSTRAP_ADMIN_PASSWORD must be set in production (no default).");
  process.exit(1);
}
if (isProd && !process.env.BOOTSTRAP_ADMIN_EMAIL) {
  console.error("[config] FATAL: BOOTSTRAP_ADMIN_EMAIL must be set in production.");
  process.exit(1);
}

export const config = {
  env: process.env.NODE_ENV || "development",
  isProd,
  port: Number(process.env.PORT) || 3000,
  // tests NEVER touch the live DB — default to a throwaway file unless DB_PATH is set explicitly
  dbPath: abs(process.env.DB_PATH, isTest ? "./data/test.db" : "./data/app.db"),
  sessionSecret: process.env.SESSION_SECRET || DEFAULT_SECRET,
  // secure cookie only behind HTTPS. Default on in prod; force with COOKIE_SECURE.
  cookieSecure: process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === "true"
    : process.env.NODE_ENV === "production",
  // serve built client from express when dist exists (any env)
  serveStatic: process.env.SERVE_STATIC !== "false",
  seedRowsPath: abs(process.env.SEED_ROWS_PATH, "../uploads/parsed-rows.json"),
  bootstrapAdmin: {
    // dev-only fallbacks; production refuses to boot without env (see fail-fast above)
    email: process.env.BOOTSTRAP_ADMIN_EMAIL || (isProd ? null : "admin@local"),
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD || (isProd ? null : "DevAdmin!" + Math.random().toString(36).slice(2, 10))
  },
  clientDist: path.resolve(ROOT, "client/dist")
};

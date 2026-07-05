import express from "express";
import helmet from "helmet";
import compression from "compression";
import pinoHttp from "pino-http";
import session from "express-session";
import rateLimit from "express-rate-limit";
import betterSqlite3Store from "better-sqlite3-session-store";
import fs from "node:fs";
import { config } from "./config.js";
import db from "./db/connection.js";
import { seed } from "./db/seed.js";
import { errorHandler, notFound } from "./middleware/error.js";

import authRoutes from "./routes/auth.routes.js";
import assetRoutes from "./routes/assets.routes.js";
import deptRoutes from "./routes/departments.routes.js";
import auditRoutes from "./routes/audit.routes.js";
import reportRoutes from "./routes/reports.routes.js";
import employeeRoutes from "./routes/employees.routes.js";
import userRoutes from "./routes/users.routes.js";
import ioRoutes from "./routes/io.routes.js";
import repairRoutes from "./routes/repair.routes.js";
import softwareRoutes from "./routes/software.routes.js";
import alertRoutes from "./routes/alerts.routes.js";
import consumableRoutes from "./routes/consumables.routes.js";
import inventoryRoutes from "./routes/inventory.routes.js";
import purchaseRequestRoutes from "./routes/purchase-requests.routes.js";
import { suppliersRouter, categoriesRouter } from "./routes/catalog.routes.js";
import peripheralsRoutes from "./routes/peripherals.routes.js";
import { prefsRouter, templatesRouter, notifsRouter } from "./routes/extras.routes.js";
import { csrfGuard } from "./middleware/csrf.js";

// migrate + seed on boot (both idempotent)
seed();

const app = express();
// HIGH-13: only trust forwarded headers when a proxy is explicitly in front
if (process.env.TRUST_PROXY) app.set("trust proxy", process.env.TRUST_PROXY);

// structured request logging (quiet for health checks)
app.use(pinoHttp({
  level: config.isProd ? "info" : "warn",
  autoLogging: { ignore: (req) => req.url === "/api/health" }
}));

// security headers + SPA-friendly CSP (all assets are same-origin/bundled)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      workerSrc: ["'self'"],
      manifestSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
      baseUri: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
// CRIT-3: tight body cap on auth path to neutralize bcrypt DoS amplification
app.use("/api/auth", express.json({ limit: "8kb" }));
app.use(express.json({ limit: "2mb" }));

const SqliteStore = betterSqlite3Store(session);
app.use(session({
  store: new SqliteStore({ client: db, expired: { clear: true, intervalMs: 900000 } }),
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: config.cookieSecure,
    maxAge: 8 * 60 * 60 * 1000 // 8h
  }
}));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 600, standardHeaders: true, legacyHeaders: false });

app.get("/api/health", (req, res) => res.json({ ok: true, env: config.env }));
app.use("/api", apiLimiter);     // global throttle
app.use("/api", csrfGuard);      // require X-Requested-With on mutations
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/departments", deptRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/users", userRoutes);
app.use("/api/repairs", repairRoutes);
app.use("/api/software", softwareRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/consumables", consumableRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/purchase-requests", purchaseRequestRoutes);
app.use("/api/suppliers", suppliersRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/peripherals", peripheralsRoutes);
app.use("/api/prefs", prefsRouter);
app.use("/api/templates", templatesRouter);
app.use("/api/notifications", notifsRouter);
app.use("/api", ioRoutes); // /api/import/*, /api/export/*

app.use("/api", notFound);

// Serve the built client + SPA fallback for non-/api routes (when dist exists).
if (config.serveStatic && fs.existsSync(config.clientDist)) {
  // hashed assets cache forever; index.html must never be cached (else stale bundles strand users)
  app.use(express.static(config.clientDist, {
    setHeaders: (res, p) => {
      if (p.endsWith("index.html")) res.setHeader("Cache-Control", "no-cache, must-revalidate");
    }
  }));
  app.get("*", (req, res) => {
    res.setHeader("Cache-Control", "no-cache, must-revalidate");
    res.sendFile("index.html", { root: config.clientDist });
  });
}

app.use(errorHandler);

// Top-level safety nets — a stray promise rejection or uncaught throw should be logged,
// not silently kill the process with no trace (and an unattended deploy can auto-restart).
process.on("unhandledRejection", (reason) => {
  console.error("[fatal] unhandledRejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[fatal] uncaughtException:", err);
  process.exit(1);
});

// Don't auto-listen under test (the test harness binds its own ephemeral port).
if (config.env !== "test") {
  const server = app.listen(config.port, () => {
    console.log(`[server] IT Asset Tracker on http://localhost:${config.port} (${config.env})`);
  });
  // Graceful shutdown: stop accepting connections, then close the SQLite handle cleanly.
  const shutdown = (sig) => () => {
    console.log(`[server] ${sig} received — shutting down`);
    server.close(() => {
      try { db.close(); } catch { /* already closed */ }
      process.exit(0);
    });
    // hard cap so a hung connection can't block the exit forever
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on("SIGTERM", shutdown("SIGTERM"));
  process.on("SIGINT", shutdown("SIGINT"));
}

export { app };

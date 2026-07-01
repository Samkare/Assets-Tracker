// Wrap async route handlers so thrown errors hit the error middleware.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Throw this for expected client errors.
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function notFound(req, res) {
  res.status(404).json({ error: "not found" });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err?.issues) { // zod
    return res.status(400).json({ error: "validation failed", details: err.issues });
  }
  const status = err.status || 500;
  if (status >= 500) console.error("[error]", err);
  // Don't leak internal error text (better-sqlite3/stack messages) to clients on 500s in prod.
  const clientMsg = status >= 500 && process.env.NODE_ENV === "production"
    ? "server error"
    : (err.message || "server error");
  res.status(status).json({ error: clientMsg, details: status >= 500 ? undefined : err.details });
}

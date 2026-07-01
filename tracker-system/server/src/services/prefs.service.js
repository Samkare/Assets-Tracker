// Per-user preferences (pinned dashboard tiles, saved filters, etc).
import db from "../db/connection.js";

export function getPref(userId, key, fallback = null) {
  const r = db.prepare("SELECT value FROM user_preferences WHERE user_id = ? AND key = ?").get(userId, key);
  if (!r) return fallback;
  try { return JSON.parse(r.value); } catch { return r.value; }
}

export function setPref(userId, key, value) {
  const json = typeof value === "string" ? value : JSON.stringify(value);
  db.prepare(`INSERT INTO user_preferences (user_id, key, value) VALUES (?,?,?)
    ON CONFLICT(user_id, key) DO UPDATE SET value=excluded.value, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')`)
    .run(userId, key, json);
  return getPref(userId, key);
}

-- 008 — user preferences + asset templates

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, key)
);

CREATE TABLE IF NOT EXISTS asset_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'Desktop' CHECK(type IN ('Desktop','Laptop')),
  cpu TEXT, ram TEXT, hdd TEXT,
  headphone INTEGER NOT NULL DEFAULT 0,
  speaker INTEGER NOT NULL DEFAULT 0,
  keyboard INTEGER NOT NULL DEFAULT 0,
  mouse INTEGER NOT NULL DEFAULT 0,
  ip_phone INTEGER NOT NULL DEFAULT 0,
  webcam INTEGER NOT NULL DEFAULT 0,
  mobile_stand INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

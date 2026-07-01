-- 001_init — base schema for IT Asset Tracker

CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  hue INTEGER NOT NULL DEFAULT 240,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  department_id INTEGER REFERENCES departments(id),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(name, department_id)
);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  pseudo TEXT,
  employee_id INTEGER REFERENCES employees(id),
  shared INTEGER NOT NULL DEFAULT 0,
  department_id INTEGER NOT NULL REFERENCES departments(id),
  type TEXT NOT NULL DEFAULT 'Desktop' CHECK(type IN ('Desktop','Laptop')),
  cpu TEXT, ram TEXT, hdd TEXT, mon1 TEXT, mon2 TEXT,
  monitors TEXT NOT NULL DEFAULT '—' CHECK(monitors IN ('Dual','Single','—')),
  headphone INTEGER NOT NULL DEFAULT 0,
  speaker INTEGER NOT NULL DEFAULT 0,
  ip_phone INTEGER NOT NULL DEFAULT 0,
  webcam INTEGER NOT NULL DEFAULT 0,
  mobile_stand INTEGER NOT NULL DEFAULT 0,
  whatsapp TEXT, nextiva TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','repair','retired')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_assets_dept ON assets(department_id);
CREATE INDEX IF NOT EXISTS idx_assets_pseudo ON assets(pseudo);
CREATE INDEX IF NOT EXISTS idx_assets_emp ON assets(employee_id);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('Admin','IT-Manager','Viewer')),
  phone TEXT, focus TEXT, since TEXT,
  must_reset INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  tag TEXT, subject TEXT, dept TEXT, detail TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_tag ON audit_log(tag);

-- session store table is created by better-sqlite3-session-store at runtime

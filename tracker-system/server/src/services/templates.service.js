// Asset templates — preset specs for fast asset creation.
import db from "../db/connection.js";
import { HttpError } from "../middleware/error.js";

function rowToTpl(r) {
  if (!r) return null;
  return {
    id: r.id, name: r.name, type: r.type, cpu: r.cpu, ram: r.ram, hdd: r.hdd,
    headphone: !!r.headphone, speaker: !!r.speaker, keyboard: !!r.keyboard, mouse: !!r.mouse,
    ipPhone: !!r.ip_phone, webcam: !!r.webcam, mobileStand: !!r.mobile_stand,
    notes: r.notes
  };
}

export function listTemplates() {
  return db.prepare("SELECT * FROM asset_templates ORDER BY name").all().map(rowToTpl);
}
export function getTemplate(id) { return rowToTpl(db.prepare("SELECT * FROM asset_templates WHERE id=?").get(id)); }

export function createTemplate(b) {
  if (!b?.name?.trim()) throw new HttpError(400, "Name required");
  if (db.prepare("SELECT 1 FROM asset_templates WHERE name=?").get(b.name.trim()))
    throw new HttpError(409, "Template name exists");
  const info = db.prepare(`INSERT INTO asset_templates
    (name, type, cpu, ram, hdd, headphone, speaker, keyboard, mouse, ip_phone, webcam, mobile_stand, notes)
    VALUES (@name,@type,@cpu,@ram,@hdd,@headphone,@speaker,@keyboard,@mouse,@ipPhone,@webcam,@mobileStand,@notes)`).run({
    name: b.name.trim(), type: b.type === "Laptop" ? "Laptop" : "Desktop",
    cpu: b.cpu ?? null, ram: b.ram ?? null, hdd: b.hdd ?? null,
    headphone: b.headphone ? 1 : 0, speaker: b.speaker ? 1 : 0,
    keyboard: b.keyboard ? 1 : 0, mouse: b.mouse ? 1 : 0,
    ipPhone: b.ipPhone ? 1 : 0, webcam: b.webcam ? 1 : 0, mobileStand: b.mobileStand ? 1 : 0,
    notes: b.notes ?? null
  });
  return getTemplate(info.lastInsertRowid);
}

export function updateTemplate(id, b) {
  if (!getTemplate(id)) throw new HttpError(404, "Not found");
  db.prepare(`UPDATE asset_templates SET
    name=COALESCE(@name,name), type=COALESCE(@type,type),
    cpu=@cpu, ram=@ram, hdd=@hdd, notes=@notes,
    headphone=@headphone, speaker=@speaker, keyboard=@keyboard, mouse=@mouse,
    ip_phone=@ipPhone, webcam=@webcam, mobile_stand=@mobileStand WHERE id=@id`).run({
    id, name: b.name ?? null, type: b.type === "Laptop" || b.type === "Desktop" ? b.type : null,
    cpu: b.cpu ?? null, ram: b.ram ?? null, hdd: b.hdd ?? null, notes: b.notes ?? null,
    headphone: b.headphone ? 1 : 0, speaker: b.speaker ? 1 : 0,
    keyboard: b.keyboard ? 1 : 0, mouse: b.mouse ? 1 : 0,
    ipPhone: b.ipPhone ? 1 : 0, webcam: b.webcam ? 1 : 0, mobileStand: b.mobileStand ? 1 : 0
  });
  return getTemplate(id);
}

export function deleteTemplate(id) {
  db.prepare("DELETE FROM asset_templates WHERE id=?").run(id);
  return { ok: true };
}

// Change a user's login email and reset their password (run by an operator, not the agent).
//
//   cd "C:\IT Assets Tracker\tracker-system"
//   node update-admin-email.mjs finnbelgium@gmail.com santosh@belgiumdia.com "YourNewPass123"
//
// Password policy: >= 10 chars, with at least one upper, one lower, and one digit.
// Sets must_reset=1 so the user is forced to choose their own password on first login,
// and clears any failed-attempt lockout.
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

const [, , oldEmail, newEmail, pass] = process.argv;
if (!oldEmail || !newEmail || !pass) {
  console.error('usage: node update-admin-email.mjs <oldEmail> <newEmail> <newPassword>');
  process.exit(1);
}
if (pass.length < 10 || !/[a-z]/.test(pass) || !/[A-Z]/.test(pass) || !/[0-9]/.test(pass)) {
  console.error('password must be >=10 chars and include upper, lower, and a digit');
  process.exit(1);
}

const db = new Database('./data/app.db');
const from = oldEmail.toLowerCase().trim();
const to = newEmail.toLowerCase().trim();

const u = db.prepare('SELECT id,email,role FROM users WHERE email = ?').get(from);
if (!u) { console.error('no active user with email:', oldEmail); process.exit(1); }

const clash = db.prepare('SELECT 1 FROM users WHERE email = ? AND id != ?').get(to, u.id);
if (clash) { console.error('another user already has email:', newEmail); process.exit(1); }

const hash = bcrypt.hashSync(pass, 12);
db.prepare(`UPDATE users SET email = ?, password_hash = ?, must_reset = 1, failed_attempts = 0, locked_until = NULL WHERE id = ?`)
  .run(to, hash, u.id);
db.close();
console.log(`OK: ${u.email} (role ${u.role}) -> ${to}; password reset, must_reset=1, lockout cleared.`);

// Reset an IT Asset Tracker user's password (run by an operator, not the agent).
//
//   cd "C:\IT Assets Tracker\tracker-system"
//   node reset-admin-password.mjs finn@belgiumdia.com "YourNewPass123"
//
// Password policy: >= 10 chars, with at least one upper, one lower, and one digit.
// Sets must_reset=1 so the user is forced to choose their own password on first login,
// and clears any failed-attempt lockout.
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

const [, , email, pass] = process.argv;
if (!email || !pass) {
  console.error('usage: node reset-admin-password.mjs <email> <newPassword>');
  process.exit(1);
}
if (pass.length < 10 || !/[a-z]/.test(pass) || !/[A-Z]/.test(pass) || !/[0-9]/.test(pass)) {
  console.error('password must be >=10 chars and include upper, lower, and a digit');
  process.exit(1);
}

const db = new Database('./data/app.db');
const u = db.prepare('SELECT id,email,role FROM users WHERE email = ?').get(email.toLowerCase().trim());
if (!u) { console.error('no active user with email:', email); process.exit(1); }
const hash = bcrypt.hashSync(pass, 12);
db.prepare('UPDATE users SET password_hash = ?, must_reset = 1, failed_attempts = 0, locked_until = NULL WHERE id = ?').run(hash, u.id);
db.close();
console.log(`OK: reset ${u.email} (role ${u.role}); must_reset=1, lockout cleared.`);

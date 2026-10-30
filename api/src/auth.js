// Passwords: PBKDF2-SHA256 (Web Crypto). Sessions: random 256-bit bearer token,
// only its SHA-256 is stored. Frontend and API live on different sites, so we use
// Authorization: Bearer instead of cookies (Safari blocks third-party cookies).

import { unauthorized, forbidden, now } from './http.js';

const ITER = 100000; // Workers' PBKDF2 limit
const enc = new TextEncoder();
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

export async function hashPassword(password, salt = crypto.getRandomValues(new Uint8Array(16)), iter = ITER) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256);
  return { hash: b64(bits), salt: b64(salt), iter };
}

export async function verifyPassword(password, user) {
  const { hash } = await hashPassword(password, unb64(user.pass_salt), user.pass_iter);
  return timingSafeEqual(hash, user.pass_hash);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function sha256(s) {
  return b64(await crypto.subtle.digest('SHA-256', enc.encode(s)));
}

export function randomToken() {
  const a = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** human-friendly code without look-alike characters: NT-4K7Q */
export function inviteCode() {
  const A = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  const r = crypto.getRandomValues(new Uint8Array(4));
  return 'NT-' + [...r].map(x => A[x % A.length]).join('');
}

/** readable temporary password for teacher resets */
export function tempPassword() {
  const A = 'abcdefghjkmnpqrstuvwxyz23456789';
  const r = crypto.getRandomValues(new Uint8Array(10));
  return [...r].map(x => A[x % A.length]).join('').replace(/(.{5})/, '$1-');
}

export async function createSession(env, userId) {
  const token = randomToken();
  const days = Number(env.SESSION_DAYS || 60);
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256(token), userId, now(), now() + days * 864e5).run();
  return token;
}

export async function currentUser(req, env) {
  const h = req.headers.get('Authorization') || '';
  const m = h.match(/^Bearer\s+([A-Za-z0-9_-]{20,})$/);
  if (!m) return null;
  const row = await env.DB.prepare(
    `SELECT u.*, s.token_hash FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`).bind(await sha256(m[1]), now()).first();
  if (!row) return null;
  // touch at most once per 10 min
  if (!row.last_seen_at || now() - row.last_seen_at > 6e5) {
    await env.DB.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').bind(now(), row.id).run();
  }
  return row;
}

export const requireUser = u => { if (!u) throw unauthorized(); return u; };
export const requireTeacher = u => { requireUser(u); if (u.role !== 'teacher' && u.role !== 'admin') throw forbidden(); return u; };

/** public shape of a user (no password fields) */
export const publicUser = u => u && ({
  id: u.id, email: u.email, name: u.name, role: u.role, teacher_id: u.teacher_id, group_id: u.group_id,
  target: u.target, exam_date: u.exam_date, must_reset: !!u.must_reset
});

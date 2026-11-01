// NOEON TOEFL API — Cloudflare Worker (D1 + R2). No framework: a small router below.

import { HttpError, bad, forbidden, notFound, corsHeaders, json, body, str, num, now, parse } from './http.js';
import {
  hashPassword, verifyPassword, createSession, currentUser, requireUser, requireTeacher,
  publicUser, inviteCode, tempPassword, sha256
} from './auth.js';
import { bandRL, bandWS, overall, route as routeOf, grade, cefr } from './scoring.js';

const DEFAULT_SETTINGS = { route_threshold: 0.6 };
const TASKS = {
  R: ['ctw', 'rdl', 'rap'], L: ['lcr', 'lco', 'lan', 'lat'], W: ['bas', 'eml', 'dsc'], S: ['lrp', 'int']
};
const AUDIO_TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/aac'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ------------------------------------------------------------------ router */
const routes = [];
const on = (method, pattern, handler) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  routes.push({ method, re, keys, handler });
};

export default {
  async fetch(req, env) {
    const cors = corsHeaders(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(req.url);
    try {
      for (const r of routes) {
        if (r.method !== req.method) continue;
        const m = url.pathname.match(r.re);
        if (!m) continue;
        const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
        const user = await currentUser(req, env);
        const res = await r.handler({ req, env, url, params, user });
        const out = res instanceof Response ? res : json(res);
        for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
        return out;
      }
      throw notFound('no_route');
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.code, message: e.message, ...(e.details ? { details: e.details } : {}) }, e.status, cors);
      console.error(e);
      return json({ error: 'server_error', message: 'Ошибка сервера' }, 500, cors);
    }
  }
};

/* ------------------------------------------------------------------ helpers */
const db = env => env.DB;
const one = (env, sql, ...b) => db(env).prepare(sql).bind(...b).first();
const all = async (env, sql, ...b) => (await db(env).prepare(sql).bind(...b).all()).results;
const run = (env, sql, ...b) => db(env).prepare(sql).bind(...b).run();

async function settingsFor(env, teacherId) {
  if (!teacherId) return { ...DEFAULT_SETTINGS };
  const row = await one(env, 'SELECT data FROM settings WHERE teacher_id = ?', teacherId);
  return { ...DEFAULT_SETTINGS, ...(parse(row?.data) || {}) };
}
const teacherOf = u => (u.role === 'student' ? u.teacher_id : u.id);

/** may `u` see data of student `sid`? (self, or their teacher, or admin) */
async function canSeeStudent(env, u, sid) {
  if (u.id === sid || u.role === 'admin') return true;
  if (u.role !== 'teacher') return false;
  const s = await one(env, 'SELECT teacher_id FROM users WHERE id = ?', sid);
  return !!s && s.teacher_id === u.id;
}

async function newGroup(env, teacherId, name) {
  for (let i = 0; i < 5; i++) {
    const code = inviteCode();
    try {
      const r = await run(env, 'INSERT INTO groups (teacher_id, name, code, created_at) VALUES (?, ?, ?, ?)', teacherId, name, code, now());
      return { id: r.meta.last_row_id, name, code, active: 1 };
    } catch (e) { if (!String(e).includes('UNIQUE')) throw e; }
  }
  throw new Error('could not allocate invite code');
}

function validatePassword(p) {
  if (typeof p !== 'string' || p.length < 8 || p.length > 200) throw bad('weak_password', 'Пароль — минимум 8 символов');
  return p;
}
function validateEmail(o) {
  const e = str(o, 'email', { min: 5, max: 160 }).toLowerCase();
  if (!EMAIL.test(e)) throw bad('bad_email', 'Неверный email');
  return e;
}

/* ------------------------------------------------------------------ health & setup */
on('GET', '/health', () => ({ ok: true, time: now() }));

on('GET', '/auth/status', async ({ env }) => {
  const c = await one(env, 'SELECT COUNT(*) AS n FROM users');
  return { needs_setup: c.n === 0 };
});

/** First account ever becomes the admin-teacher. Closed once any user exists. */
on('POST', '/auth/setup', async ({ req, env }) => {
  const b = await body(req);
  const c = await one(env, 'SELECT COUNT(*) AS n FROM users');
  if (c.n > 0) throw forbidden();
  const email = validateEmail(b), name = str(b, 'name', { min: 1, max: 80 }), pw = validatePassword(b.password);
  const h = await hashPassword(pw);
  const r = await run(env, `INSERT INTO users (email, name, role, pass_hash, pass_salt, pass_iter, created_at) VALUES (?, ?, 'admin', ?, ?, ?, ?)`,
    email, name, h.hash, h.salt, h.iter, now());
  const id = r.meta.last_row_id;
  const g = await newGroup(env, id, 'Мои ученики');
  const token = await createSession(env, id);
  return { token, user: publicUser(await one(env, 'SELECT * FROM users WHERE id = ?', id)), group: g };
});

/* ------------------------------------------------------------------ auth */
on('POST', '/auth/register', async ({ req, env }) => {
  const b = await body(req);
  const email = validateEmail(b), name = str(b, 'name', { min: 1, max: 80 }), pw = validatePassword(b.password);
  const code = str(b, 'code', { min: 4, max: 20 }).toUpperCase();
  const g = await one(env, 'SELECT * FROM groups WHERE code = ? AND active = 1', code);
  if (!g) throw bad('bad_code', 'Код приглашения не найден');
  if (await one(env, 'SELECT id FROM users WHERE email = ?', email)) throw bad('email_taken', 'Этот email уже зарегистрирован');
  const h = await hashPassword(pw);
  const r = await run(env, `INSERT INTO users (email, name, role, pass_hash, pass_salt, pass_iter, teacher_id, group_id, created_at)
    VALUES (?, ?, 'student', ?, ?, ?, ?, ?, ?)`, email, name, h.hash, h.salt, h.iter, g.teacher_id, g.id, now());
  const id = r.meta.last_row_id;
  return { token: await createSession(env, id), user: publicUser(await one(env, 'SELECT * FROM users WHERE id = ?', id)) };
});

on('POST', '/auth/login', async ({ req, env }) => {
  const b = await body(req);
  const email = String(b.email || '').trim().toLowerCase(), pw = String(b.password || '');
  const u = await one(env, 'SELECT * FROM users WHERE email = ?', email);
  // same work whether or not the user exists
  const ok = u ? await verifyPassword(pw, u) : (await hashPassword(pw), false);
  if (!ok) throw new HttpError(401, 'bad_credentials', 'Неверный email или пароль');
  return { token: await createSession(env, u.id), user: publicUser(u) };
});

on('POST', '/auth/logout', async ({ req, env, user }) => {
  requireUser(user);
  await run(env, 'DELETE FROM sessions WHERE token_hash = ?', user.token_hash);
  return { ok: true };
});

on('POST', '/auth/password', async ({ req, env, user }) => {
  requireUser(user);
  const b = await body(req);
  if (!(await verifyPassword(String(b.old || ''), user))) throw new HttpError(401, 'bad_credentials', 'Старый пароль неверный');
  const h = await hashPassword(validatePassword(b.new));
  await run(env, 'UPDATE users SET pass_hash = ?, pass_salt = ?, pass_iter = ?, must_reset = 0 WHERE id = ?', h.hash, h.salt, h.iter, user.id);
  await run(env, 'DELETE FROM sessions WHERE user_id = ? AND token_hash != ?', user.id, user.token_hash);
  return { ok: true };
});

/* ------------------------------------------------------------------ me */
on('GET', '/me', async ({ env, user }) => {
  requireUser(user);
  const teacher = user.teacher_id ? await one(env, 'SELECT id, name FROM users WHERE id = ?', user.teacher_id) : null;
  const group = user.group_id ? await one(env, 'SELECT id, name FROM groups WHERE id = ?', user.group_id) : null;
  return { user: publicUser(user), teacher, group };
});

on('PATCH', '/me', async ({ req, env, user }) => {
  requireUser(user);
  const b = await body(req);
  const name = b.name != null ? str(b, 'name', { min: 1, max: 80 }) : user.name;
  let target = user.target;
  if (b.target != null) { target = num(b, 'target', { min: 1, max: 6 }); if (target * 2 % 1) throw bad('bad_target'); }
  let exam = user.exam_date;
  if (b.exam_date !== undefined) {
    exam = b.exam_date || null;
    if (exam && !/^\d{4}-\d{2}-\d{2}$/.test(exam)) throw bad('bad_exam_date');
  }
  await run(env, 'UPDATE users SET name = ?, target = ?, exam_date = ? WHERE id = ?', name, target, exam, user.id);
  return { user: publicUser({ ...user, name, target, exam_date: exam }) };
});

/** forecast per section = latest band per section from finished attempts (R/L) and graded work (W/S) */
async function summaryFor(env, uid) {
  const atts = await all(env, `SELECT id, kind, section, bands, route, started_at, finished_at FROM attempts
    WHERE user_id = ? AND finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 60`, uid);
  const forecast = { R: null, L: null, W: null, S: null };
  for (const a of atts) {
    const b = parse(a.bands) || {};
    for (const k of ['R', 'L']) if (forecast[k] == null && b[k] != null) forecast[k] = b[k];
  }
  // W/S: mean of the last 3 final teacher ratings per section, converted with the provisional table
  for (const sec of ['W', 'S']) {
    const rs = await all(env, `SELECT r.score FROM ratings r JOIN submissions s ON s.id = r.submission_id
      WHERE s.user_id = ? AND s.section = ? AND r.is_final = 1 ORDER BY r.created_at DESC LIMIT 3`, uid, sec);
    if (rs.length) forecast[sec] = bandWS(rs.reduce((a, r) => a + r.score, 0) / rs.length, 5);
  }
  // week activity: minutes per day per section from attempts (capped at 90 min each)
  const since = now() - 7 * 864e5;
  const recent = await all(env, `SELECT section, started_at, COALESCE(finished_at, started_at) AS f FROM attempts WHERE user_id = ? AND started_at > ?`, uid, since);
  const days = {};
  for (const a of recent) {
    const d = new Date(a.started_at).toISOString().slice(0, 10);
    const min = Math.min(90, Math.max(1, Math.round((a.f - a.started_at) / 6e4)));
    const k = a.section || 'R';
    (days[d] ||= {})[k] = (days[d][k] || 0) + min;
  }
  // streak: consecutive days with any attempt, ending today or yesterday
  const actDays = new Set((await all(env, `SELECT DISTINCT date(started_at / 1000, 'unixepoch') AS d FROM attempts WHERE user_id = ? AND started_at > ?`, uid, now() - 400 * 864e5)).map(r => r.d));
  let streak = 0;
  const cur = new Date();
  if (!actDays.has(cur.toISOString().slice(0, 10))) cur.setUTCDate(cur.getUTCDate() - 1);
  while (actDays.has(cur.toISOString().slice(0, 10))) { streak++; cur.setUTCDate(cur.getUTCDate() - 1); }
  const ov = overall(Object.values(forecast));
  return { forecast, overall: ov, cefr: cefr(ov), week: days, streak };
}

on('GET', '/me/summary', async ({ env, user }) => { requireUser(user); return summaryFor(env, user.id); });

on('GET', '/me/attempts', async ({ env, user }) => {
  requireUser(user);
  const rows = await all(env, `SELECT id, kind, mode, section, task, route, raw, bands, started_at, finished_at FROM attempts
    WHERE user_id = ? ORDER BY started_at DESC LIMIT 100`, user.id);
  return { attempts: rows.map(r => ({ ...r, route: parse(r.route), raw: parse(r.raw), bands: parse(r.bands) })) };
});

on('GET', '/me/submissions', async ({ env, user }) => {
  requireUser(user);
  return { submissions: await submissionsList(env, 'WHERE s.user_id = ?', user.id) };
});

on('GET', '/me/assignments', async ({ env, user }) => {
  requireUser(user);
  const rows = await all(env, `SELECT a.*, u.name AS teacher_name FROM assignments a JOIN users u ON u.id = a.teacher_id
    WHERE a.student_id = ? OR (a.group_id IS NOT NULL AND a.group_id = ?) ORDER BY COALESCE(a.due_at, a.created_at) ASC LIMIT 50`, user.id, user.group_id ?? -1);
  const done = new Set((await all(env, `SELECT assignment_id AS id FROM attempts WHERE user_id = ? AND assignment_id IS NOT NULL AND finished_at IS NOT NULL
    UNION SELECT assignment_id FROM submissions WHERE user_id = ? AND assignment_id IS NOT NULL AND status != 'draft'`, user.id, user.id)).map(r => r.id));
  return { assignments: rows.map(r => ({ ...r, spec: parse(r.spec), done: done.has(r.id) })) };
});

/* ------------------------------------------------------------------ teacher: groups & students */
on('GET', '/teacher/groups', async ({ env, user }) => {
  requireTeacher(user);
  return { groups: await all(env, `SELECT g.*, (SELECT COUNT(*) FROM users u WHERE u.group_id = g.id) AS students FROM groups g WHERE teacher_id = ? ORDER BY id`, user.id) };
});

on('POST', '/teacher/groups', async ({ req, env, user }) => {
  requireTeacher(user);
  const b = await body(req);
  return { group: await newGroup(env, user.id, str(b, 'name', { min: 1, max: 60 })) };
});

on('PATCH', '/teacher/groups/:id', async ({ req, env, user, params }) => {
  requireTeacher(user);
  const g = await one(env, 'SELECT * FROM groups WHERE id = ? AND teacher_id = ?', Number(params.id), user.id);
  if (!g) throw notFound();
  const b = await body(req);
  const name = b.name != null ? str(b, 'name', { min: 1, max: 60 }) : g.name;
  const active = b.active != null ? (b.active ? 1 : 0) : g.active;
  let code = g.code;
  if (b.new_code) {
    for (let i = 0; i < 5; i++) { const c = inviteCode(); if (!(await one(env, 'SELECT id FROM groups WHERE code = ?', c))) { code = c; break; } }
  }
  await run(env, 'UPDATE groups SET name = ?, active = ?, code = ? WHERE id = ?', name, active, code, g.id);
  return { group: { ...g, name, active, code } };
});

on('GET', '/teacher/students', async ({ env, user }) => {
  requireTeacher(user);
  const rows = await all(env, `SELECT u.id, u.name, u.email, u.group_id, g.name AS group_name, u.target, u.exam_date, u.last_seen_at, u.created_at
    FROM users u LEFT JOIN groups g ON g.id = u.group_id WHERE u.teacher_id = ? ORDER BY u.name`, user.id);
  const out = [];
  for (const r of rows) {
    const s = await summaryFor(env, r.id);
    const pending = await one(env, `SELECT COUNT(*) AS n FROM submissions WHERE user_id = ? AND status = 'pending'`, r.id);
    out.push({ ...r, forecast: s.forecast, overall: s.overall, streak: s.streak, pending: pending.n });
  }
  return { students: out };
});

on('GET', '/teacher/students/:id', async ({ env, user, params }) => {
  requireTeacher(user);
  const sid = Number(params.id);
  if (!(await canSeeStudent(env, user, sid))) throw notFound();
  const s = await one(env, 'SELECT * FROM users WHERE id = ?', sid);
  const attempts = await all(env, 'SELECT id, kind, mode, section, task, route, bands, started_at, finished_at FROM attempts WHERE user_id = ? ORDER BY started_at DESC LIMIT 100', sid);
  return {
    student: publicUser(s), summary: await summaryFor(env, sid),
    attempts: attempts.map(a => ({ ...a, route: parse(a.route), bands: parse(a.bands) })),
    submissions: await submissionsList(env, 'WHERE s.user_id = ?', sid)
  };
});

on('POST', '/teacher/students/:id/reset-password', async ({ env, user, params }) => {
  requireTeacher(user);
  const sid = Number(params.id);
  const s = await one(env, 'SELECT * FROM users WHERE id = ?', sid);
  if (!s || s.role !== 'student' || !(await canSeeStudent(env, user, sid))) throw notFound();
  const temp = tempPassword();
  const h = await hashPassword(temp);
  await run(env, 'UPDATE users SET pass_hash = ?, pass_salt = ?, pass_iter = ?, must_reset = 1 WHERE id = ?', h.hash, h.salt, h.iter, sid);
  await run(env, 'DELETE FROM sessions WHERE user_id = ?', sid);
  return { temp_password: temp };
});

on('GET', '/teacher/settings', async ({ env, user }) => { requireTeacher(user); return { settings: await settingsFor(env, user.id) }; });
on('PUT', '/teacher/settings', async ({ req, env, user }) => {
  requireTeacher(user);
  const b = await body(req);
  const cur = await settingsFor(env, user.id);
  if (b.route_threshold != null) cur.route_threshold = num(b, 'route_threshold', { min: 0.3, max: 0.9 });
  await run(env, 'INSERT INTO settings (teacher_id, data) VALUES (?, ?) ON CONFLICT(teacher_id) DO UPDATE SET data = excluded.data', user.id, JSON.stringify(cur));
  return { settings: cur };
});

/* ------------------------------------------------------------------ assignments */
on('GET', '/teacher/assignments', async ({ env, user }) => {
  requireTeacher(user);
  const rows = await all(env, `SELECT a.*, g.name AS group_name, u.name AS student_name,
      (SELECT COUNT(*) FROM users s WHERE s.role = 'student' AND ((a.group_id IS NOT NULL AND s.group_id = a.group_id) OR (a.student_id IS NOT NULL AND s.id = a.student_id))) AS targets,
      (SELECT COUNT(*) FROM (SELECT user_id FROM attempts WHERE assignment_id = a.id AND finished_at IS NOT NULL
        UNION SELECT user_id FROM submissions WHERE assignment_id = a.id AND status != 'draft')) AS done
    FROM assignments a LEFT JOIN groups g ON g.id = a.group_id LEFT JOIN users u ON u.id = a.student_id
    WHERE a.teacher_id = ? ORDER BY a.created_at DESC LIMIT 100`, user.id);
  return { assignments: rows.map(r => ({ ...r, spec: parse(r.spec) })) };
});
/** full results of one assignment: who did it, every answer, keys and explanations (for discussing mistakes in class) */
on('GET', '/teacher/assignments/:id/results', async ({ env, user, params }) => {
  requireTeacher(user);
  const a = await one(env, `SELECT a.*, g.name AS group_name, u.name AS student_name FROM assignments a LEFT JOIN groups g ON g.id = a.group_id
    LEFT JOIN users u ON u.id = a.student_id WHERE a.id = ? AND a.teacher_id = ?`, Number(params.id), user.id);
  if (!a) throw notFound();
  const students = await all(env, `SELECT id, name FROM users WHERE role = 'student' AND ((? IS NOT NULL AND group_id = ?) OR (? IS NOT NULL AND id = ?)) ORDER BY name`, a.group_id, a.group_id, a.student_id, a.student_id);
  const atts = await all(env, 'SELECT id, user_id, mode, started_at, finished_at FROM attempts WHERE assignment_id = ? ORDER BY id', a.id);
  const rs = await all(env, `SELECT r.attempt_id, r.item_id, r.q, r.qtype, r.answer, r.correct, r.scored, t.user_id FROM responses r JOIN attempts t ON t.id = r.attempt_id
    WHERE t.assignment_id = ? AND r.item_id IS NOT NULL ORDER BY r.id`, a.id);
  const subs = await all(env, `SELECT s.id, s.user_id, s.section, s.task, s.status, s.words, s.parts, s.submitted_at, s.prompt,
    (SELECT score FROM ratings r WHERE r.submission_id = s.id AND r.is_final = 1 ORDER BY r.created_at DESC LIMIT 1) AS score
    FROM submissions s WHERE s.assignment_id = ? AND s.status != 'draft' ORDER BY s.id`, a.id);
  const items = {};
  for (const id of [...new Set(rs.map(r => r.item_id))]) {
    const it = await one(env, 'SELECT id, task, level, body, key, explain, qtypes FROM items WHERE id = ?', id);
    if (it) items[id] = { id, task: it.task, level: it.level, body: parse(it.body), key: parse(it.key), explain: parse(it.explain), qtypes: parse(it.qtypes) };
  }
  const per = Object.fromEntries(students.map(s => [s.id, { id: s.id, name: s.name, attempts: 0, finished: false, n: 0, got: 0, subs: [] }]));
  for (const t of atts) { const p = per[t.user_id]; if (p) { p.attempts++; if (t.finished_at) p.finished = true; } }
  for (const r of rs) { const p = per[r.user_id]; if (p && r.correct != null && r.scored) { p.n++; p.got += r.correct; } }
  for (const x of subs) { const p = per[x.user_id]; if (p) p.subs.push({ id: x.id, task: x.task, section: x.section, status: x.status, score: x.score, words: x.words, title: parse(x.prompt)?.title || parse(x.prompt)?.subject || '' }); }
  return {
    assignment: { ...a, spec: parse(a.spec) }, students: Object.values(per), items,
    responses: rs.map(r => ({ user_id: r.user_id, item_id: r.item_id, q: r.q, answer: parse(r.answer), correct: r.correct }))
  };
});
on('DELETE', '/teacher/assignments/:id', async ({ env, user, params }) => {
  requireTeacher(user);
  const a = await one(env, 'SELECT id FROM assignments WHERE id = ? AND teacher_id = ?', Number(params.id), user.id);
  if (!a) throw notFound();
  await run(env, 'UPDATE attempts SET assignment_id = NULL WHERE assignment_id = ?', a.id);
  await run(env, 'UPDATE submissions SET assignment_id = NULL WHERE assignment_id = ?', a.id);
  await run(env, 'DELETE FROM assignments WHERE id = ?', a.id);
  return { ok: true };
});
on('POST', '/teacher/assignments', async ({ req, env, user }) => {
  requireTeacher(user);
  const b = await body(req);
  const title = str(b, 'title', { min: 1, max: 120 });
  const spec = b.spec && typeof b.spec === 'object' ? b.spec : null;
  if (!spec) throw bad('missing_spec');
  const gid = b.group_id != null ? Number(b.group_id) : null, sid = b.student_id != null ? Number(b.student_id) : null;
  if (!gid === !sid) throw bad('target', 'Укажите группу или ученика');
  if (gid && !(await one(env, 'SELECT id FROM groups WHERE id = ? AND teacher_id = ?', gid, user.id))) throw notFound();
  if (sid && !(await canSeeStudent(env, user, sid))) throw notFound();
  const due = b.due_at != null ? num(b, 'due_at', { min: 0 }) : null;
  const r = await run(env, 'INSERT INTO assignments (teacher_id, group_id, student_id, title, spec, due_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    user.id, gid, sid, title, JSON.stringify(spec), due, now());
  return { id: r.meta.last_row_id };
});

/* ------------------------------------------------------------------ practice stats */
/** recent accuracy on a task → level for adaptive practice: <55% A, <80% B, else C (first time: B) */
async function autoLevel(env, uid, section, task) {
  const r = await one(env, `SELECT COUNT(*) AS n, SUM(r.correct) AS got FROM responses r JOIN attempts a ON a.id = r.attempt_id
    JOIN items i ON i.id = r.item_id WHERE a.user_id = ? AND r.correct IS NOT NULL AND (? IS NULL OR i.section = ?) AND (? IS NULL OR i.task = ?)
    AND r.created_at > ?`, uid, section, section, task, task, now() - 30 * 864e5);
  if (!r.n || r.n < 5) return 'B';
  const acc = r.got / r.n;
  return acc < 0.55 ? 'A' : acc < 0.8 ? 'B' : 'C';
}

on('GET', '/me/stats', async ({ env, user, url }) => {
  requireUser(user);
  const uid = url.searchParams.get('user') ? Number(url.searchParams.get('user')) : user.id;
  if (!(await canSeeStudent(env, user, uid))) throw notFound();
  const section = url.searchParams.get('section') || 'R';
  const byTask = await all(env, `SELECT i.task, COUNT(*) AS n, SUM(r.correct) AS got FROM responses r JOIN attempts a ON a.id = r.attempt_id
    JOIN items i ON i.id = r.item_id WHERE a.user_id = ? AND i.section = ? AND r.correct IS NOT NULL GROUP BY i.task`, uid, section);
  const byType = await all(env, `SELECT r.qtype, COUNT(*) AS n, SUM(r.correct) AS got FROM responses r JOIN attempts a ON a.id = r.attempt_id
    WHERE a.user_id = ? AND r.section = ? AND r.correct IS NOT NULL AND r.qtype IS NOT NULL GROUP BY r.qtype`, uid, section);
  const items = await all(env, `SELECT i.task, COUNT(DISTINCT r.item_id) AS done FROM responses r JOIN attempts a ON a.id = r.attempt_id
    JOIN items i ON i.id = r.item_id WHERE a.user_id = ? AND i.section = ? GROUP BY i.task`, uid, section);
  const bank = await all(env, `SELECT task, COUNT(*) AS n FROM items WHERE section = ? AND status = 'active' GROUP BY task`, section);
  const mk = rows => Object.fromEntries(rows.map(r => [r.task ?? r.qtype, { n: r.n, got: r.got || 0, acc: r.n ? Math.round((r.got || 0) / r.n * 100) : null }]));
  return { tasks: mk(byTask), types: mk(byType), done: Object.fromEntries(items.map(r => [r.task, r.done])), bank: Object.fromEntries(bank.map(r => [r.task, r.n])) };
});

/** mistakes to repeat: (item, question) pairs whose latest answer was wrong */
on('GET', '/me/mistakes', async ({ env, user, url }) => {
  requireUser(user);
  const section = url.searchParams.get('section') || 'R', task = url.searchParams.get('task');
  const rows = await all(env, `WITH last AS (
      SELECT r.item_id, r.q, r.correct, r.qtype, i.task,
        ROW_NUMBER() OVER (PARTITION BY r.item_id, r.q ORDER BY r.created_at DESC, r.id DESC) AS rn
      FROM responses r JOIN attempts a ON a.id = r.attempt_id JOIN items i ON i.id = r.item_id
      WHERE a.user_id = ? AND i.section = ? AND r.correct IS NOT NULL AND (? IS NULL OR i.task = ?))
    SELECT item_id, task, q, qtype FROM last WHERE rn = 1 AND correct = 0 ORDER BY item_id, q LIMIT 300`, user.id, section, task, task);
  const byItem = {};
  for (const r of rows) (byItem[r.item_id] ||= { item_id: r.item_id, task: r.task, qs: [], types: [] }).qs.push(r.q), byItem[r.item_id].types.push(r.qtype);
  return { count: rows.length, items: Object.values(byItem) };
});

/* ------------------------------------------------------------------ items */
const publicItem = it => ({ id: it.id, section: it.section, task: it.task, level: it.level, body: parse(it.body), qtypes: parse(it.qtypes) });

on('GET', '/items', async ({ env, user, url }) => {
  requireUser(user);
  const section = url.searchParams.get('section'), task = url.searchParams.get('task'), level = url.searchParams.get('level');
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get('limit') || 5)));
  const teacher = user.role === 'admin' || user.role === 'teacher';
  const where = [url.searchParams.get('bank') === 'test' && teacher ? `status IN ('active','pretest')` : `status = 'active'`], b = [];
  if (section) { where.push('section = ?'); b.push(section); }
  if (task) { where.push('task = ?'); b.push(task); }
  let lv = level;
  if (lv === 'auto') lv = await autoLevel(env, user.id, section, task);
  if (lv) { where.push('level = ?'); b.push(lv); }
  const qtype = url.searchParams.get('qtype');
  if (qtype) { where.push('qtypes LIKE ?'); b.push('%"' + qtype.replace(/[%_"]/g, '') + '"%'); }
  const exclude = (url.searchParams.get('exclude') || '').split(',').filter(Boolean).slice(0, 50);
  if (exclude.length) { where.push(`id NOT IN (${exclude.map(() => '?').join(',')})`); b.push(...exclude); }
  const rows = await all(env, `SELECT * FROM items WHERE ${where.join(' AND ')} ORDER BY RANDOM() LIMIT ${limit}`, ...b);
  return { items: rows.map(publicItem), level: lv || null };
});

on('GET', '/items/:id', async ({ env, user, params }) => {
  requireUser(user);
  const it = await one(env, `SELECT * FROM items WHERE id = ? AND status != 'retired'`, params.id);
  if (!it) throw notFound();
  return { item: publicItem(it) };
});

/** learn mode: check one answer and reveal its key + explanation */
on('POST', '/items/:id/check', async ({ req, env, user, params }) => {
  requireUser(user);
  const it = await one(env, 'SELECT * FROM items WHERE id = ?', params.id);
  if (!it) throw notFound();
  const b = await body(req);
  const q = Number(b.q || 0), key = parse(it.key), ex = parse(it.explain);
  return { correct: grade(it.task, key, q, b.answer), key: Array.isArray(key) ? key[q] : key, explain: Array.isArray(ex) ? ex[q] : ex };
});

on('POST', '/teacher/items', async ({ req, env, user }) => {
  requireTeacher(user);
  const b = await body(req);
  const list = Array.isArray(b.items) ? b.items : null;
  if (!list || !list.length || list.length > 500) throw bad('items', 'Нужен массив items (1–500)');
  const errors = [];
  const stmts = [];
  list.forEach((it, i) => {
    const e = [];
    if (!it.id || typeof it.id !== 'string' || it.id.length > 40) e.push('id');
    if (!TASKS[it.section]) e.push('section');
    else if (!TASKS[it.section].includes(it.task)) e.push('task');
    if (!['A', 'B', 'C'].includes(it.level)) e.push('level');
    if (!it.body || typeof it.body !== 'object') e.push('body');
    if (e.length) { errors.push({ index: i, id: it.id, fields: e }); return; }
    const bval = it.b ?? { A: -1, B: 0, C: 1 }[it.level];
    stmts.push(db(env).prepare(`INSERT INTO items (id, section, task, level, body, key, explain, qtypes, b, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET section = excluded.section, task = excluded.task, level = excluded.level, body = excluded.body,
        key = excluded.key, explain = excluded.explain, qtypes = excluded.qtypes, status = excluded.status, updated_at = excluded.updated_at`)
      .bind(it.id, it.section, it.task, it.level, JSON.stringify(it.body), it.key == null ? null : JSON.stringify(it.key),
        it.explain == null ? null : JSON.stringify(it.explain), it.qtypes == null ? null : JSON.stringify(it.qtypes),
        bval, it.status || 'active', now(), now()));
  });
  if (errors.length) throw Object.assign(bad('invalid_items', 'Есть ошибки в заданиях'), { details: errors });
  await db(env).batch(stmts);
  return { imported: stmts.length };
});

on('GET', '/teacher/items/stats', async ({ env, user }) => {
  requireTeacher(user);
  const rows = await all(env, `SELECT i.section, i.task, i.level, COUNT(*) AS n,
      SUM(CASE WHEN COALESCE(st.n, 0) >= 30 THEN 1 ELSE 0 END) AS calibrated
    FROM items i LEFT JOIN item_stats st ON st.item_id = i.id WHERE i.status != 'retired' GROUP BY i.section, i.task, i.level`);
  return { stats: rows };
});

/** bank browser: list with status, calibration counters and a short preview */
on('GET', '/teacher/items', async ({ env, user, url }) => {
  requireTeacher(user);
  const p = url.searchParams, where = [], b = [];
  for (const k of ['section', 'task', 'level', 'status']) if (p.get(k)) { where.push(`i.${k} = ?`); b.push(p.get(k)); }
  const q = (p.get('q') || '').trim().slice(0, 60);
  if (q) { where.push('(i.id LIKE ? OR i.body LIKE ?)'); b.push('%' + q.replace(/[%_]/g, '') + '%', '%' + q.replace(/[%_"\\]/g, '') + '%'); }
  const lim = Math.min(300, Math.max(1, Number(p.get('limit') || 100))), off = Math.max(0, Number(p.get('offset') || 0));
  const rows = await all(env, `SELECT i.id, i.section, i.task, i.level, i.status, i.qtypes, i.b, substr(i.body, 1, 220) AS head, COALESCE(st.n, 0) AS n, COALESCE(st.correct, 0) AS got
    FROM items i LEFT JOIN item_stats st ON st.item_id = i.id ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY i.section, i.task, i.id LIMIT ? OFFSET ?`, ...b, lim, off);
  const total = await one(env, `SELECT COUNT(*) AS n FROM items i ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`, ...b);
  return { total: total.n, items: rows.map(r => ({ ...r, qtypes: parse(r.qtypes) })) };
});
on('GET', '/teacher/items/:id', async ({ env, user, params }) => {
  requireTeacher(user);
  const it = await one(env, 'SELECT * FROM items WHERE id = ?', params.id);
  if (!it) throw notFound();
  const st = await one(env, 'SELECT n, correct FROM item_stats WHERE item_id = ?', it.id);
  return { item: { id: it.id, section: it.section, task: it.task, level: it.level, status: it.status, b: it.b, body: parse(it.body), key: parse(it.key), explain: parse(it.explain), qtypes: parse(it.qtypes) }, stats: st || { n: 0, correct: 0 } };
});
on('PATCH', '/teacher/items/:id', async ({ req, env, user, params }) => {
  requireTeacher(user);
  const b = await body(req);
  if (!['draft', 'active', 'pretest', 'retired'].includes(b.status)) throw bad('status');
  const r = await run(env, 'UPDATE items SET status = ?, updated_at = ? WHERE id = ?', b.status, now(), params.id);
  if (!r.meta.changes) throw notFound();
  return { ok: true };
});

/* ------------------------------------------------------------------ attempts */
async function ownAttempt(env, user, id) {
  const a = await one(env, 'SELECT * FROM attempts WHERE id = ?', Number(id));
  if (!a || a.user_id !== user.id) throw notFound();
  return a;
}

on('POST', '/attempts', async ({ req, env, user }) => {
  requireUser(user);
  const b = await body(req);
  const kind = b.kind || 'practice', mode = b.mode || 'learn';
  if (!['practice', 'module', 'section', 'mock', 'diagnostic'].includes(kind)) throw bad('bad_kind');
  if (!['learn', 'timed', 'mistakes', 'exam'].includes(mode)) throw bad('bad_mode');
  const section = b.section ?? null;
  if (section && !TASKS[section]) throw bad('bad_section');
  const st = await settingsFor(env, teacherOf(user));
  const r = await run(env, `INSERT INTO attempts (user_id, kind, mode, section, task, assignment_id, threshold, started_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, user.id, kind, mode, section, b.task ?? null, b.assignment_id ?? null, st.route_threshold, now());
  return { id: r.meta.last_row_id, threshold: st.route_threshold };
});

/** Listening: the last explain element is the transcript (shown only after answering) */
const transcriptOf = (task, key, ex) => (task && task[0] === 'l' && Array.isArray(ex) && Array.isArray(key) && ex.length > key.length) ? ex[ex.length - 1] : undefined;

on('POST', '/attempts/:id/responses', async ({ req, env, user, params }) => {
  requireUser(user);
  const a = await ownAttempt(env, user, params.id);
  if (a.finished_at) throw bad('finished', 'Попытка уже завершена');
  const b = await body(req);
  const list = Array.isArray(b.responses) ? b.responses : null;
  if (!list || list.length > 200) throw bad('responses');
  const keys = {};
  const stmts = [];
  const results = [];
  const reveal = a.mode === 'learn' || a.mode === 'mistakes';
  let graded = 0;
  for (const x of list) {
    const itemId = typeof x.item_id === 'string' ? x.item_id : '';
    const q = Number(x.q || 0), module = Number(x.module || 1) === 2 ? 2 : 1;
    let section = TASKS[x.section] ? x.section : (a.section || '');
    let qtype = x.qtype ?? null;
    let correct = null;
    if (itemId) {
      if (!(itemId in keys)) { const it = await one(env, 'SELECT section, task, key, explain, qtypes FROM items WHERE id = ?', itemId); keys[itemId] = it ? { section: it.section, task: it.task, key: parse(it.key), explain: parse(it.explain), qtypes: parse(it.qtypes) } : null; }
      const k = keys[itemId];
      if (k) {
        section = k.section;
        if (Array.isArray(k.qtypes) && k.qtypes[q]) qtype = k.qtypes[q];
        correct = grade(k.task, k.key, q, x.answer);
        if (reveal) results.push({ item_id: itemId, q, correct, key: Array.isArray(k.key) ? k.key[q] : k.key, explain: Array.isArray(k.explain) ? k.explain[q] : k.explain, transcript: transcriptOf(k.task, k.key, k.explain) });
      }
    }
    if (correct == null && (x.correct === 0 || x.correct === 1 || x.correct === true || x.correct === false)) correct = x.correct ? 1 : 0; // built-in demo content
    if (correct != null) graded++;
    stmts.push(db(env).prepare(`INSERT INTO responses (attempt_id, item_id, section, q, module, qtype, answer, correct, scored, ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(attempt_id, section, item_id, q, module) DO UPDATE SET answer = excluded.answer, correct = excluded.correct, ms = excluded.ms`)
      .bind(a.id, itemId, section, q, module, qtype, JSON.stringify(x.answer ?? null), correct, x.scored === false ? 0 : 1,
        Number.isFinite(x.ms) ? Math.round(x.ms) : null, now()));
  }
  if (stmts.length) await db(env).batch(stmts);
  return reveal ? { saved: stmts.length, graded, results } : { saved: stmts.length, graded };
});

/** MST: after module 1 the server decides upper/lower. Only scored module-1 responses count. */
on('POST', '/attempts/:id/route', async ({ req, env, user, params }) => {
  requireUser(user);
  const a = await ownAttempt(env, user, params.id);
  const b = await body(req);
  const section = b.section || a.section;
  if (section !== 'R' && section !== 'L') throw bad('bad_section', 'Маршрут есть только у Reading и Listening');
  const r = await one(env, `SELECT COUNT(*) AS n, SUM(correct) AS got FROM responses
    WHERE attempt_id = ? AND section = ? AND module = 1 AND scored = 1 AND correct IS NOT NULL`, a.id, section);
  const decision = routeOf(r.got || 0, r.n, a.threshold ?? DEFAULT_SETTINGS.route_threshold);
  const cur = parse(a.route) || {};
  cur[section] = decision;
  await run(env, 'UPDATE attempts SET route = ? WHERE id = ?', JSON.stringify(cur), a.id);
  return { route: decision, got: r.got || 0, of: r.n, threshold: a.threshold };
});

on('POST', '/attempts/:id/finish', async ({ env, user, params }) => {
  requireUser(user);
  const a = await ownAttempt(env, user, params.id);
  if (a.finished_at) return { id: a.id, raw: parse(a.raw), bands: parse(a.bands) };
  const rows = await all(env, `SELECT section, COUNT(*) AS n, SUM(correct) AS got FROM responses
    WHERE attempt_id = ? AND scored = 1 AND correct IS NOT NULL GROUP BY section`, a.id);
  const raw = {}, bands = {};
  for (const r of rows) {
    raw[r.section] = { got: r.got || 0, of: r.n };
    if (r.section === 'R' || r.section === 'L') bands[r.section] = bandRL(r.section, r.got || 0, r.n);
  }
  const ov = overall(Object.values(bands));
  if (ov != null) bands.overall = ov;
  await run(env, 'UPDATE attempts SET raw = ?, bands = ?, finished_at = ? WHERE id = ?', JSON.stringify(raw), JSON.stringify(bands), now(), a.id);
  // calibration counters for bank items
  await run(env, `INSERT INTO item_stats (item_id, n, correct, updated_at)
      SELECT item_id, COUNT(*), SUM(correct), ? FROM responses WHERE attempt_id = ? AND item_id != '' AND correct IS NOT NULL GROUP BY item_id
    ON CONFLICT(item_id) DO UPDATE SET n = item_stats.n + excluded.n, correct = item_stats.correct + excluded.correct, updated_at = excluded.updated_at`,
  now(), a.id);
  return { id: a.id, raw, bands };
});

on('GET', '/attempts/:id', async ({ env, user, params }) => {
  requireUser(user);
  const a = await one(env, 'SELECT * FROM attempts WHERE id = ?', Number(params.id));
  if (!a || !(await canSeeStudent(env, user, a.user_id))) throw notFound();
  const rs = await all(env, 'SELECT item_id, section, q, module, qtype, answer, correct, scored, ms FROM responses WHERE attempt_id = ? ORDER BY id', a.id);
  // after the attempt is finished (or in learn mode) the keys and explanations can be shown
  const reveal = a.finished_at || a.mode === 'learn' || a.mode === 'mistakes';
  const cache = {};
  const out = [];
  for (const r of rs) {
    const x = { ...r, answer: parse(r.answer) };
    if (reveal && r.item_id) {
      if (!(r.item_id in cache)) { const it = await one(env, 'SELECT task, key, explain FROM items WHERE id = ?', r.item_id); cache[r.item_id] = it ? { task: it.task, key: parse(it.key), explain: parse(it.explain) } : null; }
      const c = cache[r.item_id];
      if (c) { x.key = Array.isArray(c.key) ? c.key[r.q] : c.key; x.explain = Array.isArray(c.explain) ? c.explain[r.q] : c.explain; x.transcript = transcriptOf(c.task, c.key, c.explain); }
    }
    out.push(x);
  }
  return { attempt: { ...a, route: parse(a.route), raw: parse(a.raw), bands: parse(a.bands) }, responses: out };
});

/* ------------------------------------------------------------------ submissions (W/S, teacher-graded) */
async function submissionsList(env, where, ...b) {
  const rows = await all(env, `SELECT s.id, s.user_id, u.name AS student, s.section, s.task, s.item_id, s.prompt, s.words, s.parts, s.status,
      s.created_at, s.submitted_at, s.assignment_id,
      (SELECT score FROM ratings r WHERE r.submission_id = s.id AND r.is_final = 1 ORDER BY r.created_at DESC LIMIT 1) AS score
    FROM submissions s JOIN users u ON u.id = s.user_id ${where} ORDER BY COALESCE(s.submitted_at, s.created_at) DESC LIMIT 200`, ...b);
  return rows.map(r => ({ ...r, prompt: parse(r.prompt) }));
}

on('POST', '/submissions', async ({ req, env, user }) => {
  requireUser(user);
  const b = await body(req);
  const section = b.section;
  if (section !== 'W' && section !== 'S') throw bad('bad_section');
  const task = b.task;
  if (!['eml', 'dsc', 'lrp', 'int'].includes(task) || !TASKS[section].includes(task)) throw bad('bad_task');
  const text = section === 'W' ? str(b, 'text', { min: 1, max: 20000 }) : null;
  const words = text ? (text.match(/[A-Za-z0-9'’-]+/g) || []).length : null;
  const parts = section === 'S' ? num(b, 'parts', { min: 1, max: 12 }) : 0;
  if (b.attempt_id != null) await ownAttempt(env, user, b.attempt_id);
  const status = section === 'W' ? 'pending' : 'draft';
  const prompt = b.prompt && typeof b.prompt === 'object' ? JSON.stringify(b.prompt).slice(0, 20000) : null;
  const r = await run(env, `INSERT INTO submissions (user_id, attempt_id, section, task, item_id, prompt, text, words, parts, status, assignment_id, created_at, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, user.id, b.attempt_id ?? null, section, task, b.item_id ?? null, prompt, text, words, parts, status,
    b.assignment_id ?? null, now(), status === 'pending' ? now() : null);
  return { id: r.meta.last_row_id, status };
});

async function ownSubmission(env, user, id) {
  const s = await one(env, 'SELECT * FROM submissions WHERE id = ?', Number(id));
  if (!s || s.user_id !== user.id) throw notFound();
  return s;
}

on('PUT', '/submissions/:id/audio/:part', async ({ req, env, user, params }) => {
  requireUser(user);
  const s = await ownSubmission(env, user, params.id);
  if (s.status !== 'draft') throw bad('locked', 'Работа уже отправлена');
  const part = Number(params.part);
  if (!Number.isInteger(part) || part < 0 || part >= s.parts) throw bad('bad_part');
  const mime = (req.headers.get('Content-Type') || '').split(';')[0].trim();
  if (!AUDIO_TYPES.includes(mime)) throw bad('bad_audio_type', 'Неподдерживаемый формат аудио');
  const max = Number(env.AUDIO_MAX_MB || 8) * 1024 * 1024;
  const len = Number(req.headers.get('Content-Length') || 0);
  if (len > max) throw new HttpError(413, 'too_large', 'Файл слишком большой');
  const buf = await req.arrayBuffer();
  if (!buf.byteLength) throw bad('empty_audio');
  if (buf.byteLength > max) throw new HttpError(413, 'too_large', 'Файл слишком большой');
  const key = `u${user.id}/s${s.id}/p${part}-${(await sha256(String(now()) + Math.random())).replace(/[^A-Za-z0-9]/g, '').slice(0, 10)}`;
  await env.AUDIO.put(key, buf, { httpMetadata: { contentType: mime } });
  const old = await one(env, 'SELECT r2_key FROM audio WHERE submission_id = ? AND part = ?', s.id, part);
  if (old) await env.AUDIO.delete(old.r2_key);
  const dur = Number(req.headers.get('X-Duration-Ms') || 0) || null;
  await run(env, `INSERT INTO audio (submission_id, part, r2_key, mime, bytes, duration_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(submission_id, part) DO UPDATE SET r2_key = excluded.r2_key, mime = excluded.mime, bytes = excluded.bytes, duration_ms = excluded.duration_ms, created_at = excluded.created_at`,
  s.id, part, key, mime, buf.byteLength, dur, now());
  return { ok: true, part, bytes: buf.byteLength };
});

on('POST', '/submissions/:id/submit', async ({ env, user, params }) => {
  requireUser(user);
  const s = await ownSubmission(env, user, params.id);
  if (s.status !== 'draft') return { status: s.status };
  const c = await one(env, 'SELECT COUNT(*) AS n FROM audio WHERE submission_id = ?', s.id);
  if (c.n === 0) throw bad('no_audio', 'Нет ни одной записи');
  await run(env, `UPDATE submissions SET status = 'pending', submitted_at = ? WHERE id = ?`, now(), s.id);
  return { status: 'pending', parts_uploaded: c.n };
});

on('GET', '/submissions/:id', async ({ env, user, params }) => {
  requireUser(user);
  const s = await one(env, 'SELECT s.*, u.name AS student FROM submissions s JOIN users u ON u.id = s.user_id WHERE s.id = ?', Number(params.id));
  if (!s || !(await canSeeStudent(env, user, s.user_id))) throw notFound();
  const audio = await all(env, 'SELECT part, mime, bytes, duration_ms FROM audio WHERE submission_id = ? ORDER BY part', s.id);
  const ratings = await all(env, 'SELECT id, source, rater_id, score, parts, criteria, comment, marks, is_final, created_at FROM ratings WHERE submission_id = ? ORDER BY created_at DESC', s.id);
  return {
    submission: { ...s, prompt: parse(s.prompt) }, audio,
    ratings: ratings.map(r => ({ ...r, parts: parse(r.parts), criteria: parse(r.criteria), marks: parse(r.marks) }))
  };
});

on('GET', '/submissions/:id/audio/:part', async ({ env, user, params }) => {
  requireUser(user);
  const s = await one(env, 'SELECT * FROM submissions WHERE id = ?', Number(params.id));
  if (!s || !(await canSeeStudent(env, user, s.user_id))) throw notFound();
  const a = await one(env, 'SELECT * FROM audio WHERE submission_id = ? AND part = ?', s.id, Number(params.part));
  if (!a) throw notFound();
  const obj = await env.AUDIO.get(a.r2_key);
  if (!obj) throw notFound();
  return new Response(obj.body, { headers: { 'Content-Type': a.mime, 'Content-Length': String(a.bytes), 'Cache-Control': 'private, max-age=3600' } });
});

on('GET', '/teacher/queue', async ({ env, user, url }) => {
  requireTeacher(user);
  const section = url.searchParams.get('section');
  const extra = section === 'W' || section === 'S' ? ' AND s.section = ?' : '';
  const b = extra ? [user.id, section] : [user.id];
  const rows = await all(env, `SELECT s.id, s.user_id, u.name AS student, s.section, s.task, s.prompt, s.words, s.parts, s.submitted_at, s.assignment_id,
      a.due_at FROM submissions s JOIN users u ON u.id = s.user_id LEFT JOIN assignments a ON a.id = s.assignment_id
    WHERE u.teacher_id = ? AND s.status = 'pending'${extra} ORDER BY s.submitted_at ASC LIMIT 200`, ...b);
  return { queue: rows.map(r => ({ ...r, prompt: parse(r.prompt), late: !!(r.due_at && r.submitted_at > r.due_at) })) };
});

on('POST', '/teacher/submissions/:id/rating', async ({ req, env, user, params }) => {
  requireTeacher(user);
  const s = await one(env, 'SELECT * FROM submissions WHERE id = ?', Number(params.id));
  if (!s || !(await canSeeStudent(env, user, s.user_id)) || s.user_id === user.id) throw notFound();
  if (s.status === 'draft') throw bad('not_submitted', 'Работа ещё не отправлена');
  const b = await body(req);
  let parts = null;
  if (Array.isArray(b.parts)) {
    parts = b.parts.map(x => Number(x));
    if (parts.some(x => !Number.isFinite(x) || x < 0 || x > 5)) throw bad('bad_parts');
  }
  const score = b.score != null ? num(b, 'score', { min: 0, max: 5 }) : parts && parts.length ? Math.round((parts.reduce((x, y) => x + y, 0) / parts.length) * 10) / 10 : null;
  if (score == null) throw bad('missing_score', 'Поставьте балл');
  const comment = b.comment != null ? str(b, 'comment', { max: 4000, required: false }) : null;
  await run(env, 'UPDATE ratings SET is_final = 0 WHERE submission_id = ?', s.id);
  const r = await run(env, `INSERT INTO ratings (submission_id, source, rater_id, score, parts, criteria, comment, marks, is_final, created_at)
    VALUES (?, 'teacher', ?, ?, ?, ?, ?, ?, 1, ?)`, s.id, user.id, score,
  parts ? JSON.stringify(parts) : null, b.criteria ? JSON.stringify(b.criteria).slice(0, 4000) : null, comment,
  Array.isArray(b.marks) ? JSON.stringify(b.marks).slice(0, 8000) : null, now());
  await run(env, `UPDATE submissions SET status = 'graded' WHERE id = ?`, s.id);
  return { id: r.meta.last_row_id, score };
});

// Data source for the views: live API when signed in, prototype data in demo mode.
// Every function returns the same shape either way, so the views do not care which one is used.

import * as M from './mock.js';
import { get, post, put, patch, isLive, loadMe, session } from '../lib/api.js';
import { overallBand } from '../lib/util.js';
// demo content is loaded only in demo mode (separate chunk)
let demoCache = null;
const demoBank = async () => demoCache || (demoCache = (await import('./demo-reading.json')).default);

const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const DOW = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
export const dayLabel = d => { d = new Date(d); return `${d.getDate()} ${MON[d.getMonth()]}`; };
const dueLabel = ms => { if (!ms) return 'без срока'; const d = new Date(ms); return `до ${DOW[d.getDay()]}, ${dayLabel(d)}`; };
const ago = ms => {
  if (!ms) return 'ещё не заходил';
  const m = Math.round((Date.now() - ms) / 6e4);
  if (m < 60 * 12 && new Date(ms).toDateString() === new Date().toDateString()) return 'сегодня';
  const d = Math.round(m / 1440);
  return d <= 1 ? 'вчера' : `${d} дн. назад`;
};
export const TASK_NAMES = { eml: 'Write an Email', dsc: 'Academic Discussion', lrp: 'Listen and Repeat', int: 'Take an Interview', bas: 'Build a Sentence', ctw: 'Complete the Words', rdl: 'Read in Daily Life', rap: 'Read an Academic Passage' };
const KIND = { module: 'Модуль', section: 'Секция', mock: 'Пробник', diagnostic: 'Диагностика', practice: 'Тренировка' };

/** suggested plan: weakest sections first, short blocks */
function planFor(f) {
  const blocks = {
    R: { k: 'R', nm: 'Complete the Words', mt: 'Reading · 2 текста', min: 6, to: '#/train/R' },
    W: { k: 'W', nm: 'Academic Discussion', mt: 'Writing · 10 минут, как на экзамене', min: 10, to: '#/train/W' },
    S: { k: 'S', nm: 'Take an Interview', mt: 'Speaking · 4 вопроса', min: 5, to: '#/train/S' }
  };
  return ['R', 'W', 'S'].sort((a, b) => (f[a] ?? 0) - (f[b] ?? 0)).map(k => blocks[k]);
}

export async function today() {
  if (!isLive()) return M.me;
  const [u, s, a] = await Promise.all([loadMe(), get('/me/summary'), get('/me/assignments')]);
  // current week Mon..Sun
  const now = new Date(), mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const names = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  let weekMin = 0;
  const week = names.map((n, i) => {
    const d = new Date(mon); d.setDate(mon.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const isToday = d.toDateString() === now.toDateString();
    if (d > now && !isToday) return [n, null];
    const m = s.week[key] || {};
    weekMin += Object.values(m).reduce((x, y) => x + y, 0);
    return [n, m, isToday ? 'today' : undefined];
  });
  return {
    name: u.name.split(' ')[0], full: u.name, teacher: u.teacher?.name || '', target: u.target ?? 4.5,
    examDate: u.exam_date, examLabel: u.exam_date ? dayLabel(u.exam_date) : '',
    forecast: s.forecast, streak: s.streak, weekMin, week, plan: planFor(s.forecast),
    tasks: a.assignments.map(x => ({ nm: x.title, mt: 'от учителя · ' + (x.spec?.mode === 'exam' ? 'экзаменационный режим' : 'учебный режим'), due: dueLabel(x.due_at),
      to: x.spec?.section === 'R' && x.spec?.kind !== 'practice' ? '#/exam/reading' : '#/train/' + (x.spec?.section || 'R') }))
  };
}

export async function mocks() {
  if (!isLive()) return M.mocks;
  const r = await get('/me/attempts');
  return r.attempts.filter(a => a.finished_at && a.kind !== 'practice').reverse().map(a => ({
    date: dayLabel(a.finished_at), kind: KIND[a.kind] + (a.section ? ' · ' + ({ R: 'Reading', L: 'Listening', W: 'Writing', S: 'Speaking' })[a.section] : ''),
    R: a.bands?.R ?? null, L: a.bands?.L ?? null, W: a.bands?.W ?? null, S: a.bands?.S ?? null, route: a.route?.R || null
  }));
}

export async function works() {
  if (!isLive()) return M.works;
  const r = await get('/me/submissions');
  return r.submissions.map(s => ({
    k: s.section, nm: TASK_NAMES[s.task] || s.task, mt: s.prompt?.title || s.prompt?.subject || '', when: dayLabel(s.submitted_at || s.created_at),
    status: s.status === 'pending' ? 'review' : s.status === 'draft' ? 'draft' : null, score: s.score
  }));
}

/* ---------------- teacher ---------------- */
export async function students() {
  if (!isLive()) return M.students;
  const r = await get('/teacher/students');
  return r.students.map(s => ({
    id: s.id, name: s.name, email: s.email, group: s.group_name || '—', ...s.forecast, target: s.target ?? 4.5,
    exam: s.exam_date ? dayLabel(s.exam_date) : 'не назначен', last: ago(s.last_seen_at), streak: s.streak, pending: s.pending
  }));
}

export async function queue(section) {
  if (!isLive()) return M.queue;
  const r = await get('/teacher/queue' + (section ? '?section=' + section : ''));
  return r.queue.map(q => ({
    id: q.id, student: q.student, k: q.section, task: TASK_NAMES[q.task] || q.task, taskCode: q.task,
    title: q.prompt?.title || q.prompt?.subject || '', when: ago(q.submitted_at), words: q.words, dur: q.parts ? q.parts + ' отв.' : null, late: q.late
  }));
}

export async function submission(id) {
  if (!isLive()) return null;
  return get('/submissions/' + id);
}
export const rate = (id, payload) => post(`/teacher/submissions/${id}/rating`, payload);

export async function groups() {
  if (!isLive()) return [{ id: 0, name: 'Мои ученики', code: M.teacher.code, active: 1, students: M.students.length }];
  return (await get('/teacher/groups')).groups;
}
export const newGroup = name => post('/teacher/groups', { name });
export const regenCode = id => patch('/teacher/groups/' + id, { new_code: true });
export const resetPassword = sid => post(`/teacher/students/${sid}/reset-password`);

export async function settings() { return isLive() ? (await get('/teacher/settings')).settings : { route_threshold: 0.6 }; }
export const saveSettings = s => put('/teacher/settings', s);

export const saveMe = d => patch('/me', d).then(r => { session.user = { ...session.user, ...r.user }; return r.user; });

/* ---------------- attempts (exam shell) ---------------- */
export async function startAttempt(spec) { if (!isLive()) return null; return post('/attempts', spec); }
export async function saveResponses(id, responses) { if (!isLive() || !id) return null; return post(`/attempts/${id}/responses`, { responses }); }
export async function routeAttempt(id, section) { if (!isLive() || !id) return null; return post(`/attempts/${id}/route`, { section }); }
export async function finishAttempt(id) { if (!isLive() || !id) return null; return post(`/attempts/${id}/finish`); }

export { overallBand };

/* ---------------- practice (item bank) ---------------- */
const demoAttempts = {};

export async function practiceItems({ section = 'R', task, level = 'auto', qtype, limit = 3, exclude = [] }) {
  if (!isLive()) {
    let list = (await demoBank()).filter(i => i.section === section && (!task || i.task === task) && (!qtype || i.qtypes.includes(qtype)));
    if (exclude.length) list = list.filter(i => !exclude.includes(i.id));
    return { items: list.slice(0, limit).map(({ key, explain, ...pub }) => pub), level: 'demo' };
  }
  const p = new URLSearchParams({ section, limit: String(limit) });
  if (task) p.set('task', task); if (level) p.set('level', level); if (qtype) p.set('qtype', qtype);
  if (exclude.length) p.set('exclude', exclude.join(','));
  return get('/items?' + p);
}
export async function item(id) {
  if (!isLive()) { const it = (await demoBank()).find(i => i.id === id); if (!it) throw new Error('not found'); const { key, explain, ...pub } = it; return pub; }
  return (await get('/items/' + id)).item;
}
export async function mistakes(section = 'R', task) {
  if (!isLive()) return { count: 0, items: [] };
  return get('/me/mistakes?section=' + section + (task ? '&task=' + task : ''));
}
export async function stats(section = 'R') {
  if (!isLive()) return null;
  return get('/me/stats?section=' + section);
}

/** practice attempt; in demo mode graded locally against the bundled keys */
export async function practiceStart(spec) {
  if (!isLive()) { const id = 'demo-' + Date.now(); demoAttempts[id] = { spec, res: [] }; return { id }; }
  return post('/attempts', { kind: 'practice', ...spec });
}
function demoGrade(r) {
  const it = demoCache.find(i => i.id === r.item_id);
  const k = it.key[r.q];
  const correct = it.task === 'ctw' ? (String(r.answer || '').toLowerCase() === String(k).toLowerCase() ? 1 : 0) : (Number(r.answer) === k ? 1 : 0);
  return { item_id: r.item_id, q: r.q, correct, key: k, explain: it.explain[r.q], qtype: it.qtypes[r.q] };
}
export async function practiceAnswer(attemptId, responses) {
  if (String(attemptId).startsWith('demo-')) { const out = responses.map(demoGrade); demoAttempts[attemptId].res.push(...out); return { results: out }; }
  return post(`/attempts/${attemptId}/responses`, { responses });
}
export async function practiceFinish(attemptId, responses) {
  if (String(attemptId).startsWith('demo-')) {
    const out = responses.length ? responses.map(demoGrade) : demoAttempts[attemptId].res;
    return { responses: out.map(r => ({ ...r })) };
  }
  if (responses.length) await post(`/attempts/${attemptId}/responses`, { responses });
  await post(`/attempts/${attemptId}/finish`);
  return get(`/attempts/${attemptId}`);
}

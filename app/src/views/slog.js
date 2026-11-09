// Teacher: what exactly a student did — items served, answers given, key and explanation (opened from the student card).
import * as src from '../data/source.js';
import { isLive } from '../lib/api.js';
import { SEC, esc, plural } from '../lib/util.js';
import { hdr } from '../lib/ui.js';

const NAMES = { lcr: 'Listen and Choose a Response', lco: 'Listen to a Conversation', lan: 'Listen to an Announcement', lat: 'Listen to an Academic Talk' };
const KIND = { practice: 'Тренировка', module: 'Модуль', section: 'Секция', mock: 'Пробник', diagnostic: 'Диагностика' };
const MODE = { learn: 'обучение', timed: 'на время', mistakes: 'ошибки', exam: 'экзамен' };
const when = ms => new Date(ms).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const L = i => 'ABCD'[i] ?? String(i);
const mark = r => (r == null ? '' : r.correct ? '<span class="lgm ok">✓</span>' : '<span class="lgm bad">✗</span>');

/** Complete the Words: the paragraph with the student's letters in the gaps */
function ctwHtml(it, rs) {
  const by = Object.fromEntries(rs.map(r => [r.q, r]));
  let g = 0;
  const text = it.body.parts.map(p => {
    if (!p.n) return esc(p.t);
    const r = by[g], key = it.key?.[g] ?? '', typed = r ? String(r.answer ?? '') : '';
    g++;
    const cell = !r ? `<span class="gp skip">${'_'.repeat(p.n)}</span>`
      : r.correct ? `<span class="gp ok">${esc(typed)}</span>`
      : `<span class="gp bad">${esc(typed) || '—'}</span><span class="gp key">${esc(key)}</span>`;
    return `${esc(p.pre)}${esc(p.keep)}${cell}${esc(p.post)}`;
  }).join('');
  return `<p class="lgtext">${esc(it.body.first)}${text}</p><p class="mut sm">Зелёным — верно; красным — ответ ученика, рядом правильные буквы.</p>`;
}

/** Build a Sentence: the sentence as the student built it vs the right one */
function basHtml(it, rs) {
  const r = rs[0], slots = it.key?.[0] || [];
  const fill = chunks => it.body.parts.map(p => (p == null ? (chunks.shift() ?? '…') : p)).join(' ').replace(/\s+([.,!?])/g, '$1');
  const got = Array.isArray(r?.answer) ? r.answer : [];
  return `<p class="lgq"><b>${esc(it.body.a)}</b></p>
    <div class="lgrow ${r?.correct ? 'ok' : 'bad'}"><span class="lgl">Ответ ученика</span> ${mark(r)} ${esc(fill([...got]))}</div>
    ${r?.correct ? '' : `<div class="lgrow ok"><span class="lgl">Верно</span> ${esc(fill([...slots]))}</div>`}
    ${it.explain?.[0] ? `<p class="mut sm">${esc(it.explain[0])}</p>` : ''}`;
}

/** multiple choice (Reading / Listening): stem, options, student's pick and the key */
function mcqHtml(it, rs) {
  return rs.map(r => {
    const q = it.body.qs?.[r.q] || {}, key = Array.isArray(it.key) ? it.key[r.q] : it.key, ex = Array.isArray(it.explain) ? it.explain[r.q] : null;
    const pick = r.answer == null || r.answer === '' ? null : Number(r.answer);
    const opts = (q.opts || []).map((o, i) => `<li class="${i === key ? 'ok' : ''} ${i === pick ? (i === key ? 'pick' : 'pick bad') : ''}"><b>${L(i)}</b> ${esc(o)}${i === pick ? ' <em>← ответ ученика</em>' : ''}${i === key && i !== pick ? ' <em>← верно</em>' : ''}</li>`).join('');
    return `<div class="lgq"><div class="lgqh">${mark(r)} <span class="chip">${esc(r.qtype || '')}</span>${r.ms ? ` <span class="mut sm">${Math.round(r.ms / 1000)} с</span>` : ''}</div>
      <p><b>${esc(q.stem || (q.sel ? 'Выбор предложения' : q.insert != null ? 'Вставка предложения' : 'Вопрос ' + (r.q + 1)))}</b></p>
      ${opts ? `<ul class="lgopts">${opts}</ul>` : `<p>Ответ: ${esc(JSON.stringify(r.answer))} · верно: ${esc(JSON.stringify(key))}</p>`}
      ${pick == null ? '<p class="mut sm">Ученик не ответил.</p>' : ''}${ex ? `<p class="mut sm">${esc(ex)}</p>` : ''}</div>`;
  }).join('');
}

function group(g) {
  const { attempt: a, item: it, rs } = g;
  const got = rs.filter(r => r.correct).length;
  const body = it.task === 'ctw' ? ctwHtml(it, rs) : it.task === 'bas' ? basHtml(it, rs) : mcqHtml(it, rs);
  const title = it.body?.title || it.body?.topic || it.body?.genre || '';
  return `<article class="card pad lg"><header class="lgh"><div><b>${esc(src.TASK_NAMES[it.task] || NAMES[it.task] || it.task)}</b> <span class="mut">· ${esc(it.id)}${title ? ' · ' + esc(title) : ''}</span></div>
    <div class="mut sm">${when(g.at)} · ${KIND[a.kind] || a.kind}${a.mode ? ', ' + (MODE[a.mode] || a.mode) : ''}${a.assignment_id ? ' · по заданию' : ''}</div>
    <span class="chip ${got === rs.length ? 'ok' : got === 0 ? 'bad' : 'warn'}">${got} из ${rs.length}</span></header>${body}</article>`;
}

/** params: [studentId, 'log', section, qtype?]  |  [studentId, 'attempt', attemptId] */
export async function studentLog(params) {
  if (!isLive()) return { title: 'Ответы', html: '<div class="card empty"><b>В демо-режиме журнал недоступен</b></div>' };
  const [sid, mode, a1, a2] = params;
  const f = mode === 'attempt' ? { attempt: a1 } : { section: a1 || undefined, qtype: a2 ? decodeURIComponent(a2) : undefined };
  const d = await src.studentLog(sid, f);
  const what = f.qtype ? `${f.qtype}${f.section ? ' · ' + SEC[f.section]?.name : ''}` : f.attempt ? 'Попытка №' + f.attempt : f.section ? SEC[f.section]?.name : 'Все ответы';
  const n = d.groups.length;
  return {
    title: 'Ответы', wide: true,
    html: `${hdr(what, { back: '#/t/student/' + sid, sub: `${d.student?.name || ''} · ${n} ${plural(n, 'задание', 'задания', 'заданий')}${n >= 60 ? ' (последние 60)' : ''}` })}
    ${n ? d.groups.map(group).join('') : '<div class="card empty"><b>Ответов пока нет</b></div>'}`
  };
}

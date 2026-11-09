// Teacher: what exactly a student did — items served, answers given, key and explanation (opened from the student card).
import * as src from '../data/source.js';
import { isLive } from '../lib/api.js';
import { SEC, esc, plural } from '../lib/util.js';
import { hdr, on } from '../lib/ui.js';
import { docHtml } from './practice.js';

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

/** the text the questions are about: Reading document / passage, Listening transcript + audio */
function sourceHtml(it) {
  const b = it.body || {};
  if (it.task === 'rdl' && b.doc) return `<details class="lgsrc" open><summary>Текст</summary>${docHtml(b.doc)}</details>`;
  if (it.task === 'rap' && b.paras) return `<details class="lgsrc" open><summary>Текст</summary><div class="xpass"><h3>${esc(b.title || '')}</h3>${b.paras.map(p => `<p>${p.map(esc).join(' ')}</p>`).join('')}</div>${b.insert ? `<p class="mut sm">Для вопроса о вставке: «${esc(b.insert.sentence)}» — квадраты стоят перед предложениями ${b.insert.slots.map(k => k + 1).join(', ')} абзаца ${b.insert.p + 1}.</p>` : ''}</details>`;
  if (it.section === 'L') {
    const ex = Array.isArray(it.explain) ? it.explain : [], tr = ex.length > (it.key?.length || 0) ? ex[ex.length - 1] : '';
    return `<details class="lgsrc" open><summary>Запись</summary>${b.audio ? `<audio controls preload="none" src="${esc(b.audio)}"></audio>` : ''}${tr ? `<p class="lgtr">${esc(tr).replace(/\n/g, '<br>')}</p>` : ''}</details>`;
  }
  return '';
}

/** multiple choice (Reading / Listening): stem, options, student's pick and the key */
function mcqHtml(it, rs) {
  return rs.map(r => {
    const q = it.body.qs?.[r.q] || {}, key = Array.isArray(it.key) ? it.key[r.q] : it.key, ex = Array.isArray(it.explain) ? it.explain[r.q] : null;
    const pick = r.answer == null || r.answer === '' ? null : Number(r.answer);
    const txt = i => (q.sel ? it.body.paras?.[q.sel.p]?.[i] : null);
    const opts = !(q.opts || []).length && q.sel ? [] : (q.opts || []).map((o, i) => `<li class="${i === key ? 'ok' : ''} ${i === pick ? (i === key ? 'pick' : 'pick bad') : ''}"><b>${L(i)}</b> ${esc(o)}${i === pick ? ' <em>← ответ ученика</em>' : ''}${i === key && i !== pick ? ' <em>← верно</em>' : ''}</li>`).join('');
    return `<div class="lgq"><div class="lgqh">${mark(r)} <span class="chip">${esc(r.qtype || '')}</span>${r.ms ? ` <span class="mut sm">${Math.round(r.ms / 1000)} с</span>` : ''}</div>
      <p><b>${esc(q.stem || (q.sel ? 'Выбор предложения' : q.insert != null ? 'Вставка предложения' : 'Вопрос ' + (r.q + 1)))}</b></p>
      ${opts ? `<ul class="lgopts">${opts}</ul>` : q.sel ? `<div class="lgrow ${r.correct ? 'ok' : 'bad'}"><span class="lgl">Ответ ученика</span> ${pick == null ? '—' : '«' + esc(txt(pick) ?? '#' + (pick + 1)) + '»'}</div>${r.correct ? '' : `<div class="lgrow ok"><span class="lgl">Верно</span> «${esc(txt(key) ?? '#' + (key + 1))}»</div>`}`
        : q.insert ? `<div class="lgrow ${r.correct ? 'ok' : 'bad'}"><span class="lgl">Ответ ученика</span> квадрат ${pick == null ? '—' : pick + 1}</div>${r.correct ? '' : `<div class="lgrow ok"><span class="lgl">Верно</span> квадрат ${key + 1}</div>`}${q.insert ? `<p class="mut sm">Вставляемое предложение: ${esc(it.body.insert?.sentence || '')}</p>` : ''}`
        : `<p>Ответ: ${esc(JSON.stringify(r.answer))} · верно: ${esc(JSON.stringify(key))}</p>`}
      ${q.hl ? `<p class="mut sm">Выделено в тексте: «${esc(q.hl.w)}»</p>` : ''}
      ${pick == null ? '<p class="mut sm">Ученик не ответил.</p>' : ''}${ex ? `<p class="mut sm">${esc(ex)}</p>` : ''}</div>`;
  }).join('');
}

function group(g) {
  const { attempt: a, item: it, rs } = g;
  const got = rs.filter(r => r.correct).length;
  const body = it.task === 'ctw' ? ctwHtml(it, rs) : it.task === 'bas' ? basHtml(it, rs) : mcqHtml(it, rs);
  const title = it.body?.title || it.body?.topic || it.body?.genre || '';
  return `<article class="card pad lg"><header class="lgh"><div><b>${esc(src.TASK_NAMES[it.task] || NAMES[it.task] || it.task)}</b> <span class="chip lvl">уровень ${esc(it.level || '—')}</span> <span class="mut">· ${esc(it.id)}${title ? ' · ' + esc(title) : ''}</span></div>
    <div class="mut sm">${when(g.at)} · ${KIND[a.kind] || a.kind}${a.mode ? ', ' + (MODE[a.mode] || a.mode) : ''}${a.assignment_id ? ' · по заданию' : ''}</div>
    <span class="chip ${got === rs.length ? 'ok' : got === 0 ? 'bad' : 'warn'}">${got} из ${rs.length}</span></header>${sourceHtml(it)}${body}</article>`;
}

const SUBST = { pending: 'ждёт проверки', done: 'проверено', rated: 'проверено' };
const subRow = x => `<a class="row c${x.section}" href="#/t/review/${x.id}"><span class="sq">${(SEC[x.section]?.name || '')[0] || ''}</span>
  <div class="t"><div class="nm">${esc(src.TASK_NAMES[x.task] || x.task)}</div><div class="mt">${esc(x.prompt?.title || x.prompt?.subject || x.prompt?.course || '')} · ${when(x.submitted_at || x.created_at)}</div></div>
  <div class="end">${x.status === 'pending' ? '<span class="chip warn">ждёт</span>' : x.score != null ? `<b class="serif">${String(x.score).replace('.', ',')}</b>` : ''}</div></a>`;

const TABS = [['all', 'Все'], ['R', 'Reading'], ['L', 'Listening'], ['W', 'Writing'], ['S', 'Speaking']];

/** params: [studentId, 'log', section|all, qtype?]  |  [studentId, 'attempt', attemptId] */
export async function studentLog(params) {
  if (!isLive()) return { title: 'Ответы', html: '<div class="card empty"><b>В демо-режиме журнал недоступен</b></div>' };
  const [sid, mode, a1, a2] = params;
  const f = mode === 'attempt' ? { attempt: a1 } : { section: a1 && a1 !== 'all' ? a1 : undefined, qtype: a2 ? decodeURIComponent(a2) : undefined };
  const d = await src.studentLog(sid, f);
  const what = f.qtype ? `${f.qtype}${f.section ? ' · ' + SEC[f.section]?.name : ''}` : f.attempt ? 'Попытка №' + f.attempt : f.section ? SEC[f.section]?.name : 'Все выполненные задания';
  const n = d.groups.length + (d.subs?.length || 0);
  const tabs = mode === 'attempt' ? '' : `<div class="lgtabs">${TABS.map(([k, l]) => `<a class="${(f.section || 'all') === k && !f.qtype ? 'on' : ''}" href="#/t/student/${sid}/log/${k}">${l}</a>`).join('')}</div>`;
  const subs = d.subs?.length ? `<div class="lbl">Работы Writing и Speaking</div><div class="card rows" style="margin-bottom:14px">${d.subs.map(subRow).join('')}</div>` : '';
  const filt = JSON.stringify(f).replace(/"/g, '&quot;');
  return {
    title: 'Ответы', wide: true,
    html: `${hdr(what, { back: '#/t/student/' + sid, sub: `${d.student?.name || ''}` })}${tabs}${subs}
    ${d.groups.length || d.subs?.length ? `<div id="lglist">${d.groups.map(group).join('')}</div>` : '<div class="card empty"><b>Выполненных заданий пока нет</b></div>'}
    ${d.more ? `<div class="row-btns" style="justify-content:center"><button class="btn" id="lgmore" data-act="log-more" data-sid="${sid}" data-f="${filt}" data-off="${d.groups.length}">Показать ещё</button></div>` : ''}`
  };
}

on('log-more', async el => {
  el.disabled = true;
  try {
    const d = await src.studentLog(el.dataset.sid, { ...JSON.parse(el.dataset.f), offset: el.dataset.off });
    document.getElementById('lglist').insertAdjacentHTML('beforeend', d.groups.map(group).join(''));
    el.dataset.off = Number(el.dataset.off) + d.groups.length;
    if (d.more) el.disabled = false; else el.closest('.row-btns').remove();
  } catch { el.disabled = false; }
});

import { RUBRIC, CRIT, PHRASES, critFlat, critHint, markedHtml, notesHtml, selectionOffsets, promptBlock, MK, mkType, applyMark, eraseMarks, trimRange, markQuote } from '../lib/writing.js';
import { bank, emailWork } from '../data/mock.js';
import * as src from '../data/source.js';
import { isLive, audioUrl } from '../lib/api.js';
import { ic } from '../lib/icons.js';
import { band, cefr, overallBand, fullBand, heat, SEC, esc, plural } from '../lib/util.js';
import { hdr, on, toast, modal } from '../lib/ui.js';
import { pref } from '../lib/store.js';
import { contentLive } from './tcab.js';

const ovOf = s => fullBand(s);
const initials = n => String(n || '?').split(' ').map(x => x[0]).join('').slice(0, 2);
const rerender = () => window.dispatchEvent(new Event('hashchange'));

/* ---------------- Обзор ---------------- */
export async function home() {
  const [students, queue] = await Promise.all([src.students(), src.queue()]);
  const full = students.map(ovOf).filter(v => v != null);
  const avg = full.length ? Math.round(full.reduce((a, b) => a + b, 0) / full.length * 2) / 2 : null;
  const overdue = students.filter(s => s.overdue).length;
  const kpi = [
    ['users', students.length, plural(students.length, 'ученик', 'ученика', 'учеников'), '#/t/students'],
    ['inbox', queue.length, plural(queue.length, 'работа ждёт', 'работы ждут', 'работ ждут'), '#/t/review'],
    ['alert', overdue, 'просрочено', '#/t/students'],
    ['trend', avg == null ? '—' : band(avg), avg == null ? 'средний прогноз: нужны все 4 секции' : `средний прогноз · ${full.length} из ${students.length}`, '#/t/students']
  ];
  const table = students.length ? `<div class="card tblwrap"><table class="tbl heatmap">
      <thead><tr><th>Ученик</th>${Object.values(SEC).map(s => `<th class="c${s.k}"><i class="dot"></i> ${s.k}</th>`).join('')}<th>Общий</th><th>Цель</th></tr></thead>
      <tbody>${students.map(s => `<tr data-act="open-student" data-id="${s.id}"><td><div class="who-s"><span class="av sm">${esc(initials(s.name))}</span><div><b>${esc(s.name)}</b><span>${s.last}${s.overdue ? ' · <em class="badtx">просрочка</em>' : ''}</span></div></div></td>
        ${['R', 'L', 'W', 'S'].map(k => `<td class="num"><span class="sc ${heat(s[k], s.target)}">${s[k] == null ? 'нет' : band(s[k])}</span></td>`).join('')}
        <td class="num"><b class="serif">${ovOf(s) == null ? '—' : band(ovOf(s))}</b></td><td class="num fade">${band(s.target)}</td></tr>`).join('')}</tbody></table></div>
    <div class="card rows hmlist">${students.map(s => `<a class="row" href="#/t/student/${s.id}"><span class="av sm">${esc(initials(s.name))}</span>
      <div class="t"><div class="nm">${esc(s.name)}</div><div class="hm4">${['R', 'L', 'W', 'S'].map(k => `<span class="sc ${heat(s[k], s.target)}"><i>${k}</i>${s[k] == null ? '—' : band(s[k])}</span>`).join('')}</div>
        <div class="mt">${s.last}${s.overdue ? ' · <em class="badtx">просрочка</em>' : ''} · цель ${band(s.target)}${ovOf(s) != null ? ` · общий <b>${band(ovOf(s))}</b>` : ''}</div></div>${ic('right', 18)}</a>`).join('')}</div>`
    : `<div class="card empty"><b>Учеников пока нет</b>Отправьте код приглашения из профиля — ученик появится здесь сразу после регистрации.<br><br><a class="btn sm" href="#/profile">${ic('link', 16)} Коды приглашения</a></div>`;

  return {
    title: 'Обзор', wide: true,
    html: `${hdr('Обзор', { sub: 'Кабинет учителя', right: isLive() ? `<button class="btn sm pri" data-act="assign" aria-label="Назначить">${ic('plus', 16)}<span class="bl"> Назначить</span></button>` : '' })}
    <div class="kpis">${kpi.map(([i, v, l, h], n) => `<a class="kpi ${n === 1 && queue.length ? 'hot' : ''}" href="${h}">${ic(i, 20)}<b class="serif">${v}</b><span>${l}</span></a>`).join('')}</div>
    <div class="g-thome">
      <section>
        <div class="lbl">Ученики × секции <b>цвет — расстояние до цели</b></div>${table}
      </section>
      <section>
        <div class="lbl">Очередь проверки ${queue.length ? `<a class="lnk" href="#/t/review">Все ${queue.length}</a>` : ''}</div>
        ${queue.length ? `<div class="card rows">${queue.slice(0, 4).map(qRow).join('')}</div>` : `<div class="card empty"><b>Всё проверено</b>Новые письма и записи появятся здесь</div>`}
        ${isLive() ? '' : `<div class="lbl">Слабые места группы</div>
        <div class="card pad weak">${[['Rhetorical Purpose', 49], ['Inference', 54], ['Sentence Simplification', 58]].map(([n, a]) =>
          `<div class="qb cR"><span class="qn">${n}</span><div class="bar"><i style="width:${a}%;background:var(--sS)"></i></div><b>${a}%</b></div>`).join('')}
          <button class="btn sm" data-act="assign" style="margin-top:12px">${ic('plus', 16)} Назначить тренажёр группе</button></div>`}
      </section>
    </div>`
  };
}

const qRow = q => `<a class="row c${q.k}" href="#/t/review/${q.id}"><span class="sq">${ic(SEC[q.k].ic, 19)}</span>
  <div class="t"><div class="nm">${esc(q.task)}</div><div class="mt">${esc(q.student)} · ${q.when}${q.late ? ' · <em class="badtx">после дедлайна</em>' : ''}</div></div>
  <div class="end">${q.words ? q.words + ' сл.' : q.dur || ''}${ic('right', 18)}</div></a>`;


/* ---------------- Ученики ---------------- */
export async function studentsView() {
  const students = await src.students();
  const groups = [...new Set(students.map(s => s.group))];
  return {
    title: 'Ученики', wide: true,
    html: `${hdr('Ученики', { right: `<a class="btn sm pri" href="#/profile">${ic('plus', 16)} Пригласить</a>` })}
    ${students.length ? `<div class="toolbar"><input class="inp search" type="search" placeholder="Поиск ученика" aria-label="Поиск ученика" data-act-input="filter-students">
      ${groups.length > 1 ? `<div class="seg grp">${['Все', ...groups].map((g, i) => `<button class="${i ? '' : 'on'}" data-act="grp" data-v="${esc(g)}">${esc(g)}</button>`).join('')}</div>` : ''}</div>
    <div class="scards">${students.map(s => {
      const ov = ovOf(s);
      return `<article class="card scard" data-act="open-student" data-id="${s.id}" data-name="${esc(s.name.toLowerCase())}" data-grp="${esc(s.group)}">
        <div class="sc-hd"><span class="av">${esc(initials(s.name))}</span><div class="t"><b>${esc(s.name)}</b><span>${esc(s.group)}</span></div>
          <div class="sc-ov"><b class="serif">${ov == null ? '—' : band(ov)}</b>${ov == null ? '' : `<span class="cefr">${cefr(ov)}</span>`}</div></div>
        <div class="sc-secs">${['R', 'L', 'W', 'S'].map(k => `<div class="c${k}"><span>${k}</span><b class="serif">${s[k] == null ? '—' : band(s[k])}</b><div class="pips">${[1, 2, 3, 4, 5, 6].map(n => `<i class="${s[k] >= n ? 'on' : s[k] >= n - .5 ? 'half' : ''}"></i>`).join('')}</div></div>`).join('')}</div>
        <div class="sc-ft"><span>${ic('flag', 15)} цель ${band(s.target)}</span><span>${ic('cal', 15)} ${s.exam}</span><span>${ic('flame', 15)} ${s.streak}</span>
          ${s.overdue ? '<span class="chip bad">просрочка</span>' : `<span class="fade">${s.last}</span>`}</div>
      </article>`;
    }).join('')}</div>` : `<div class="card empty"><b>Учеников пока нет</b>Скопируйте ссылку-приглашение в профиле и отправьте ученику.</div>`}`
  };
}
on('grp', el => {
  el.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el));
  document.querySelectorAll('.scard').forEach(c => { c.hidden = el.dataset.v !== 'Все' && c.dataset.grp !== el.dataset.v; });
});
on('reset-pw', el => modal(`<h2>Сбросить пароль?</h2><p class="mut" style="margin-bottom:14px">${esc(el.dataset.name)} получит временный пароль и при входе придумает новый. Текущие сеансы ученика закроются.</p>
  <button class="btn pri block" data-act="reset-pw-go" data-id="${el.dataset.id}">Сбросить</button><button class="btn ghost block" data-act="modal-close" style="margin-top:6px">Отмена</button>`));
on('reset-pw-go', async el => {
  try {
    const r = await src.resetPassword(el.dataset.id);
    modal(`<h2>Временный пароль</h2><p class="mut" style="margin-bottom:10px">Передайте его ученику. Больше он показан не будет.</p>
      <div class="card pad" style="font-family:var(--ffd);font-size:24px;letter-spacing:.06em;text-align:center;user-select:all">${esc(r.temp_password)}</div>
      <button class="btn pri block" data-act="modal-close" style="margin-top:14px">Готово</button>`);
  } catch (e) { toast(e.message); }
});

/* ---------------- Проверка: очередь ---------------- */
export async function reviewList() {
  const f = pref.get('qf', 'all');
  const all = await src.queue();
  const list = all.filter(q => f === 'all' || q.k === f);
  return {
    title: 'Проверка', wide: true,
    html: `${hdr('Проверка', { sub: all.length ? `${all.length} ${plural(all.length, 'работа ждёт', 'работы ждут', 'работ ждут')} оценки` : 'Очередь пуста' })}
    <div class="seg qseg">${[['all', 'Все'], ['W', 'Writing'], ['S', 'Speaking']].map(([v, l]) => `<button class="${f === v ? 'on' : ''}" data-act="qf" data-v="${v}">${l}</button>`).join('')}</div>
    ${list.length ? `<div class="card rows qlist">${list.map(q => `<a class="row c${q.k}" href="#/t/review/${q.id}"><span class="sq">${ic(SEC[q.k].ic, 19)}</span>
      <div class="t"><div class="nm">${esc(q.task)} <span class="fade">· ${esc(q.student)}</span></div><div class="mt">${esc(q.title)}</div></div>
      <div class="end"><span class="hide-sm">${q.when}</span>${q.late ? '<span class="chip bad">поздно</span>' : ''}<span class="chip">${q.words ? q.words + ' слов' : q.dur || ''}</span>${ic('right', 18)}</div></a>`).join('')}</div>`
      : `<div class="card empty"><b>Нечего проверять</b>Когда ученик отправит письмо или запись, она появится здесь</div>`}
    <p class="fade small" style="margin:12px 2px">${ic('spark', 14)} AI-предоценку можно будет включить позже — сейчас всё оценивает учитель.</p>`
  };
}
on('qf', el => { pref.set('qf', el.dataset.v); rerender(); });

/* ---------------- Проверка: одна работа ---------------- */
const kindOf = task => ({ eml: 'email', dsc: 'dsc', int: 'interview', lrp: 'lrp' }[task] || 'email');

function promptHtml(task, p) {
  if (!p) return '';
  if (task === 'eml' || task === 'dsc') return `<div class="card pad prompt">${promptBlock(task, p, { compact: true })}</div>`;
  return `<div class="card pad prompt"><div class="pr-k">${ic('mic', 16)} ${task === 'int' ? 'Take an Interview · 45 с на ответ' : 'Listen and Repeat'}</div>${p.scenario ? `<p>${esc(p.scenario)}</p>` : ''}</div>`;
}

export async function reviewItem(params) {
  const live = isLive();
  let q, sub = null, text, prompt, task, audios = [], prev = null;
  if (live) {
    const r = await src.submission(params[0]);
    sub = r.submission; task = sub.task; prompt = sub.prompt; text = sub.text; audios = r.audio; prev = r.ratings.find(x => x.is_final) || null;
    q = { id: sub.id, k: sub.section, student: sub.student, task: src.TASK_NAMES[task] || task, title: prompt?.title || prompt?.subject || '', words: sub.words, when: '' };
  } else {
    const demoQ = await src.queue();
    q = demoQ.find(x => String(x.id) === params[0]) || demoQ[0];
    task = q.k === 'W' ? (q.task.includes('Email') ? 'eml' : 'dsc') : (q.task.includes('Interview') ? 'int' : 'lrp');
    prompt = task === 'eml' ? emailWork.prompt : null; text = task === 'eml' ? emailWork.text : null;
  }
  const isW = q.k === 'W', kind = kindOf(task);
  const sel = pref.get('score.' + q.id, null) ?? (prev ? Math.round(prev.score) : null);
  const nParts = live ? Math.max(sub.parts, audios.length) : 4;
  const partScores = live && prev?.parts ? prev.parts : [];
  // Listen and Repeat: the total is the mean of the per-answer scores — never picked by hand
  const auto = !isW && kind === 'lrp';
  const partNow = Array.from({ length: nParts }, (_, i) => pref.get('sc.' + q.id + '.' + i, null) ?? partScores[i] ?? null);
  const rated = partNow.filter(x => x != null).length;
  const autoAvg = auto && nParts && rated === nParts ? Math.round(partNow.reduce((a, b) => a + b, 0) / nParts * 10) / 10 : null;
  const demoMarks = [{ s: (text || '').indexOf('enough academic'), e: (text || '').indexOf('enough academic') + 15, q: 'enough academic', note: 'Порядок слов: academic enough — «enough» ставится после прилагательного.' }].filter(m => m.s >= 0);
  const marks = pref.get('marks.' + q.id, null) ?? (live ? prev?.marks || [] : demoMarks);
  if (RV?.id !== q.id) TOOL = null;
  RV = { id: q.id, text: text || '', sel: null, marks };

  const work = isW ? `${promptHtml(task, prompt)}
    <div class="card pad paper">
      ${task === 'eml' && prompt ? `<div class="mailhd"><span>To:</span> ${esc(prompt.to || '')}<br><span>Subject:</span> ${esc(prompt.subject || '')}</div>` : ''}
      ${toolbarHtml()}
      <div class="mailbody pre ${TOOL ? 'tool-on tool-' + TOOL : ''}" id="mbody">${markedHtml(text || '', marks)}</div>
      <div id="mnotes">${notesHtml(marks, { edit: true, text: text || '' })}</div>
      <div class="paper-ft fade">${q.words || 0} слов${task === 'dsc' && q.words < 100 ? ' · <span class="badtx">меньше 100</span>' : ''}</div>
    </div>`
    : `${promptHtml(task, prompt) || `<div class="card pad prompt"><div class="pr-k">${ic('mic', 16)} ${esc(q.task)}</div></div>`}
    <div class="card rows audios">${Array.from({ length: nParts }, (_, i) => {
      const has = !live || audios.some(a => a.part === i);
      const qtext = prompt?.questions?.[i] || (live ? '' : ['What do you like most about the place where you live?', 'Describe a change in your neighborhood in recent years.', 'Do you think cities should limit cars in the center? Why?', 'How will cities be different in twenty years?'][i] || '');
      return `<div class="row arow audio-row"><div class="t"><div class="nm">${i + 1}. ${esc(qtext)}</div>
        ${has ? (live ? `<audio controls preload="none" data-sub="${q.id}" data-part="${i}"></audio>` : `<div class="wave" aria-hidden="true">${Array.from({ length: 48 }, (_, j) => `<i style="height:${6 + Math.round(Math.abs(Math.sin(j * 1.7 + i) * 18 + Math.cos(j * .6) * 6))}px"></i>`).join('')}</div>`) : '<div class="fade small">нет записи</div>'}</div>
        <div class="end"><div class="minis">${[0, 1, 2, 3, 4, 5].map(n => `<button class="mini ${(pref.get('sc.' + q.id + '.' + i) ?? partScores[i]) === n ? 'on' : ''}" data-act="mini" data-q="${q.id}" data-i="${i}" data-n="${n}">${n}</button>`).join('')}</div></div></div>`;
    }).join('')}</div>`;

  // checklist and comment survive re-renders (picking a score re-draws the panel): drafts live in pref until saved
  const savedCrit = {}; for (const c of critFlat(kind)) if (prev?.criteria?.[c.id] != null) savedCrit[c.id] = !!prev.criteria[c.id];
  const ticked = pref.get('crit.' + q.id, null) ?? savedCrit;
  const comment = pref.get('cmt.' + q.id, null) ?? (prev?.comment || '');
  RV.kind = kind;
  const panel = `<aside class="card pad rubric">
    <div class="rb-hd"><span class="av">${esc(initials(q.student))}</span><div><b>${esc(q.student)}</b><span class="fade">${esc(q.task)}</span></div></div>
    ${prev ? `<p class="chip ok" style="margin-top:10px">Оценено: ${band(prev.score)} / 5</p>` : ''}
    <div class="lbl" style="margin-top:14px">${isW ? 'Балл по рубрике ETS' : auto ? 'Итог: среднее по ответам (считается само)' : 'Итог (или средний по ответам)'}</div>
    ${auto ? `<div class="autosc ${autoAvg == null ? 'wait' : ''}">${autoAvg == null ? `<span>Оцените каждый ответ баллом 0–5: сейчас ${rated} из ${nParts}</span>` : `<div class="wscore"><b class="serif">${band(autoAvg)}</b><span>/ 5</span></div><p class="mut">${esc(RUBRIC[kind][Math.round(autoAvg)] || '')}</p>`}</div>` : `<div class="scores">${RUBRIC[kind].map((d, n) => `<button class="scoreb ${sel === n ? 'on' : ''}" data-act="score" data-q="${q.id}" data-n="${n}"><b class="serif">${n}</b><span>${d}</span></button>`).join('')}</div>`}
    <div class="lbl">Чек-лист <span class="chint" id="chint"></span></div>
    <div class="cgrps">${CRIT[kind].map(g => `<details class="cgrp" open data-g="${g.id}"><summary><b>${g.t}</b><span class="cgn" data-n="${g.id}"></span></summary>
      <p class="cgq">${g.q}</p>
      <div class="crit">${g.items.map(c => `<label class="ck"><input type="checkbox" name="crit" value="${c.id}" ${ticked[c.id] ? 'checked' : ''}><span>${c.t}</span></label>`).join('')}</div></details>`).join('')}</div>
    <div class="lbl">Комментарий ученику</div>
    <div class="phr">${PHRASES[kind].map((t, i) => `<button type="button" class="phb" data-act="phrase" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div>
    <textarea class="inp" id="rcomment" rows="4" placeholder="Что получилось и что улучшить">${esc(comment)}</textarea>
    <div class="rb-ft"><a class="btn ghost" href="#/t/review">К очереди</a><button class="btn pri" data-act="save-score" data-q="${q.id}" data-s="${isW ? 'W' : 'S'}" data-k="${kind}" data-parts="${isW ? 0 : nParts}">${ic('check', 17)} Сохранить</button></div>
    <p class="fade small kbdh"><kbd>0</kbd>–<kbd>5</kbd> балл · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> сохранить · <kbd>J</kbd>/<kbd>K</kbd> следующая/предыдущая</p>
  </aside>`;

  const queueIds = live ? (await src.queue()).map(x => x.id) : (await src.queue()).map(x => x.id);
  return {
    title: 'Проверка', wide: true,
    html: `${hdr(q.task, { back: '#/t/review', sub: q.student + (q.title ? ' · ' + q.title : '') })}<div class="g-review"><div class="work">${work}</div>${panel}</div>`,
    unmount() { document.onselectionchange = null; },
    mount(root) {
      const sync = () => {
        const st = {}; root.querySelectorAll('input[name=crit]').forEach(c => { st[c.value] = c.checked; });
        for (const g of CRIT[kind]) { const el = root.querySelector(`[data-n="${g.id}"]`); if (el) el.textContent = `${g.items.filter(c => st[c.id]).length}/${g.items.length}`; }
        const h = critHint(kind, st), ch = root.querySelector('#chint');
        if (ch) ch.textContent = h && h.n ? `· отмечено ${h.n} из ${h.of}, ориентир ≈ ${h.score}` : '';
        return st;
      };
      sync();
      root.querySelectorAll('input[name=crit]').forEach(c => c.addEventListener('change', () => pref.set('crit.' + q.id, sync())));
      root.querySelector('#rcomment')?.addEventListener('input', e => pref.set('cmt.' + q.id, e.target.value));
      const mb = root.querySelector('#mbody');
      if (mb) bindPaper(root, mb);
      if (!live) return;
      root.querySelectorAll('audio[data-sub]').forEach(a => {
        a.addEventListener('play', async function load() {
          if (a.src) return;
          a.removeEventListener('play', load);
          try { a.src = await audioUrl(a.dataset.sub, a.dataset.part); a.play(); } catch (e) { toast(e.message); }
        });
      });
    },
    keys(e) {
      if (e.target.closest('textarea,input')) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) document.querySelector('[data-act="save-score"]').click(); return; }
      if (isW && markKeys(e)) return;
      if (/^[0-5]$/.test(e.key)) {
        if (auto) { const i = partNow.findIndex((x, k) => pref.get('sc.' + q.id + '.' + k, null) == null && partScores[k] == null); if (i >= 0) { pref.set('sc.' + q.id + '.' + i, Number(e.key)); rerender(); } }
        else { pref.set('score.' + q.id, Number(e.key)); rerender(); }
      }
      const i = queueIds.indexOf(q.id);
      if (e.key === 'j' && queueIds[i + 1] != null) location.hash = '#/t/review/' + queueIds[i + 1];
      if (e.key === 'k' && i > 0) location.hash = '#/t/review/' + queueIds[i - 1];
    }
  };
}
let RV = null;
on('phrase', el => {
  const ta = document.getElementById('rcomment'); if (!ta) return;
  ta.value = (ta.value.trim() ? ta.value.trim() + ' ' : '') + el.dataset.t;
  ta.dispatchEvent(new Event('input')); ta.focus();
});
/* ---- marks on the student's text: marker, underline, wavy, strike, caret, comment, eraser, undo ---- */
let TOOL = null;            // sticky tool: every new selection gets it (stays across works until switched off)
const UNDO = new Map();     // work id → previous marks arrays
let lastApply = 0;
const TOOLS = [['hl-y'], ['hl-g'], ['hl-p'], ['u'], ['wav'], ['x'], ['ins'], ['cm']];
const TOOL_IC = {
  u: '<span class="tg tg-u">U</span>', wav: '<span class="tg tg-wav">abc</span>', x: '<span class="tg tg-x">S</span>',
  ins: '<span class="tg tg-ins">∧</span>', cm: ic('edit', 15), erase: '<span class="tg tg-er">⌫</span>'
};
function toolbarHtml() {
  const undo = (UNDO.get(RV?.id) || []).length;
  const btn = (t, label, key, inner) => `<button type="button" class="mtool ${TOOL === t ? 'on' : ''}" data-act="tool" data-t="${t}" title="${esc(label)} (${key})" aria-pressed="${TOOL === t}">${inner}</button>`;
  return `<div class="mtools" id="mtools">
    <div class="mt-grp">${['hl-y', 'hl-g', 'hl-p'].map(t => btn(t, MK[t].l + ' — ' + MK[t].m, MK[t].key, `<i class="dot mk-${t}"></i>`)).join('')}</div>
    <div class="mt-grp">${['u', 'wav', 'x', 'ins'].map(t => btn(t, MK[t].l + ' — ' + MK[t].m, MK[t].key, TOOL_IC[t])).join('')}</div>
    <div class="mt-grp">${btn('cm', 'Комментарий к фрагменту', 'C', TOOL_IC.cm + '<span class="hide-sm">Комментарий</span>')}</div>
    <div class="mt-grp">${btn('erase', 'Ластик — убрать пометки с фрагмента', 'E', TOOL_IC.erase)}
      <button type="button" class="mtool" data-act="mark-undo" title="Отменить (Ctrl+Z)" ${undo ? '' : 'disabled'}>↶</button></div>
    <span class="mt-hint fade small">${TOOL ? `<b>${esc(TOOL === 'erase' ? 'Ластик' : MK[TOOL].l)}</b> включён: ${TOOL === 'ins' ? 'кликайте в место пропуска' : TOOL === 'erase' ? 'выделяйте или кликайте по пометкам' : 'выделяйте фрагменты подряд'} · <kbd>Esc</kbd> выключить` : 'Выделите фрагмент и выберите инструмент, или включите инструмент и выделяйте подряд. Клик по пометке — добавить пояснение'}</span>
  </div>`;
}
const curMarks = () => pref.get('marks.' + RV.id, null) ?? RV.marks;
function setMarks(next) {
  const st = UNDO.get(RV.id) || []; st.push(curMarks()); if (st.length > 100) st.shift(); UNDO.set(RV.id, st);
  pref.set('marks.' + RV.id, next); redrawPaper();
}
/** redraw only the paper (no refetch, no scroll jump) */
function redrawPaper() {
  const mb = document.getElementById('mbody'); if (!mb || !RV) return;
  const marks = curMarks();
  mb.innerHTML = markedHtml(RV.text, marks);
  mb.className = `mailbody pre ${TOOL ? 'tool-on tool-' + TOOL : ''}`;
  document.getElementById('mnotes').innerHTML = notesHtml(marks, { edit: true, text: RV.text });
  document.getElementById('mtools').outerHTML = toolbarHtml();
  RV.sel = null; window.getSelection()?.removeAllRanges();
}
/** the teacher's current selection inside the text (live; on touch devices the last one seen) */
function liveSel() {
  const mb = document.getElementById('mbody'); if (!mb) return null;
  return selectionOffsets(mb) || (RV.sel && RV.sel.e > RV.sel.s ? RV.sel : null);
}
function applyTool(t, o) {
  if (!o) return;
  if (t === 'erase') { setMarks(eraseMarks(curMarks(), o)); return; }
  if (t === 'ins') { setMarks(applyMark(curMarks(), 'ins', { s: o.e, e: o.e })); return; }
  const r = trimRange(RV.text, o);
  if (r.e <= r.s) return;
  if (t === 'cm') { editMark(null, r); return; }
  setMarks(applyMark(curMarks(), t, r));
}
/** modal: note for a mark (new comment when i == null and range given) */
function editMark(i, range) {
  const marks = curMarks(), m = i != null ? marks[i] : { ...range, t: 'cm' };
  if (!m) return;
  const t = mkType(m);
  modal(`<h2>${i == null ? 'Комментарий' : esc(MK[t].l)}</h2>
    <p class="mut" style="margin-bottom:10px">${t !== 'cm' ? `<span class="mtag mk-${t}">${esc(MK[t].m)}</span> ` : ''}${esc(markQuote(m, RV.text))}</p>
    <textarea class="inp" id="mnote" rows="3" placeholder="${t === 'ins' ? 'Что пропущено' : 'Что не так и как правильно'}${t === 'cm' ? '' : ' (необязательно)'}">${esc(m.note || '')}</textarea>
    <div class="row-btns" style="margin-top:12px">${i != null ? `<button class="btn ghost" data-act="mark-del" data-i="${i}">Убрать пометку</button>` : ''}<button class="btn" data-act="modal-close">Отмена</button><button class="btn pri" data-act="mark-save">${i == null ? 'Добавить' : 'Сохранить'}</button></div>`);
  RV.pending = { i, range };
  setTimeout(() => document.getElementById('mnote')?.focus(), 30);
}
function bindPaper(root, mb) {
  document.onselectionchange = () => {
    const o = selectionOffsets(mb, { collapsed: true });
    if (o) RV.sel = o;
  };
  // keep the selection when a tool button is pressed (otherwise the browser clears it first)
  root.querySelector('.paper')?.addEventListener('pointerdown', e => { if (e.target.closest('.mtool')) e.preventDefault(); });
  // sticky tool: apply as soon as the mouse selection is finished
  mb.addEventListener('mouseup', () => setTimeout(() => {
    if (!TOOL || TOOL === 'ins') return;
    const o = selectionOffsets(mb); if (o) { lastApply = Date.now(); applyTool(TOOL, o); }
  }, 0));
  mb.addEventListener('click', e => {
    if (Date.now() - lastApply < 350) return;
    const sl = window.getSelection(); if (sl && !sl.isCollapsed) return;
    if (TOOL === 'ins') { const o = selectionOffsets(mb, { collapsed: true }); if (o) applyTool('ins', { s: o.s, e: o.s }); return; }
    const el = e.target.closest('[data-mi]'); if (!el || !mb.contains(el)) return;
    const i = Number(el.dataset.mi);
    if (TOOL === 'erase') { const next = [...curMarks()]; next.splice(i, 1); setMarks(next); return; }
    editMark(i);
  });
}
/** hotkeys on the review screen; returns true when handled */
function markKeys(e) {
  if (document.querySelector('.scrim')) return false;
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undoMark(); return true; }
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  if (e.key === 'Escape' && TOOL) { TOOL = null; redrawPaper(); return true; }
  const k = e.key.toUpperCase();
  const t = k === 'E' ? 'erase' : Object.keys(MK).find(x => MK[x].key === k);
  if (!t) return false;
  e.preventDefault(); pickTool(t); return true;
}
function pickTool(t) {
  const o = t === 'ins' ? null : liveSel();
  if (o) { applyTool(t, o); return; }                 // one-off: selection first, then the tool
  TOOL = TOOL === t ? null : t; redrawPaper();       // no selection: toggle sticky mode
}
function undoMark() {
  const st = UNDO.get(RV?.id) || []; if (!st.length) return;
  pref.set('marks.' + RV.id, st.pop()); redrawPaper();
}
on('tool', el => pickTool(el.dataset.t));
on('mark-undo', () => undoMark());
on('mark-edit', el => editMark(Number(el.dataset.i)));
on('mark-save', () => {
  const note = (document.getElementById('mnote')?.value || '').trim().slice(0, 600);
  const { i, range } = RV.pending || {};
  if (i == null) {
    if (!note) { toast('Напишите комментарий'); return; }
    document.getElementById('layer').innerHTML = '';
    setMarks(applyMark(curMarks(), 'cm', range, { note, q: RV.text.slice(range.s, range.e).slice(0, 120) }));
    return;
  }
  const cur = curMarks().map(m => ({ ...m }));
  const m = cur[i]; if (!m) return;
  if (mkType(m) === 'cm' && !note) { toast('Напишите комментарий или уберите пометку'); return; }
  if (note) { m.note = note; if (m.e > m.s) m.q = RV.text.slice(m.s, m.e).slice(0, 120); } else { delete m.note; delete m.q; }
  document.getElementById('layer').innerHTML = '';
  setMarks(cur);
});
on('mark-del', el => {
  const cur = [...curMarks()]; cur.splice(Number(el.dataset.i), 1);
  document.getElementById('layer').innerHTML = '';
  setMarks(cur);
});
on('score', el => { pref.set('score.' + el.dataset.q, Number(el.dataset.n)); rerender(); });
on('mini', el => { pref.set('sc.' + el.dataset.q + '.' + el.dataset.i, Number(el.dataset.n)); rerender(); });
on('save-score', async el => {
  const id = el.dataset.q, nParts = Number(el.dataset.parts);
  const lrp = el.dataset.k === 'lrp';
  const score = lrp ? null : pref.get('score.' + id, null);
  const parts = Array.from({ length: nParts }, (_, i) => pref.get('sc.' + id + '.' + i, null));
  const criteria = Object.fromEntries([...document.querySelectorAll('input[name=crit]')].map(c => [c.value, c.checked]));
  const comment = document.getElementById('rcomment')?.value || '';
  if (!isLive()) { toast('Оценка сохранена (демо)'); setTimeout(() => { location.hash = '#/t/review'; }, 500); return; }
  const payload = { criteria, comment };
  const marks = pref.get('marks.' + id, null) ?? (RV && String(RV.id) === String(id) ? RV.marks : null);
  if (marks) payload.marks = marks;
  if (score != null) payload.score = score;
  if (nParts && parts.every(x => x != null)) payload.parts = parts;
  if (payload.score == null && !payload.parts) { toast(lrp ? 'Оцените каждый ответ: итог посчитается сам' : nParts ? 'Поставьте итоговый балл или баллы за каждый ответ' : 'Поставьте балл'); return; }
  try {
    await src.rate(id, payload);
    pref.set('score.' + id, null); pref.set('marks.' + id, null); UNDO.delete(Number(id)); UNDO.delete(id); pref.set('crit.' + id, null); pref.set('cmt.' + id, null); parts.forEach((_, i) => pref.set('sc.' + id + '.' + i, null));
    toast('Оценка сохранена'); location.hash = '#/t/review';
  } catch (e) { toast(e.message); }
});

/* ---------------- Контент ---------------- */
export function content() {
  if (isLive()) return contentLive();
  const sum = bank.reduce((a, b) => a + b.total, 0);
  return {
    title: 'Контент', wide: true,
    html: `${hdr('Контент', { sub: isLive() ? 'Банк заданий · импорт появится на этапе P9' : `Банк заданий · ${sum} единиц (пример)`, right: `<button class="btn sm" data-act="imp">${ic('upload', 16)} Импорт JSON</button>` })}
    <div class="card tblwrap"><table class="tbl bank">
      <thead><tr><th>Задание</th><th>Всего</th><th>A · B · C</th><th>Откалибровано</th><th>Флаги</th><th></th></tr></thead>
      <tbody>${bank.map(b => `<tr data-act="open-bank"><td><div class="who-s c${b.k}"><span class="sq sm">${ic(SEC[b.k].ic, 16)}</span><b>${b.nm}</b></div></td>
        <td class="num">${b.total}</td>
        <td><div class="lvbar">${b.lv.map((n, i) => `<i class="lv${i}" style="flex:${n}" title="${'ABC'[i]}: ${n}">${n}</i>`).join('')}</div></td>
        <td>${b.cal == null ? `<span class="fade small">${b.soon ? 'после озвучки' : 'оценивает учитель'}</span>` : `<div class="calc"><div class="bar"><i style="width:${Math.round(b.cal / b.total * 100)}%"></i></div><span>${Math.round(b.cal / b.total * 100)}%</span></div>`}</td>
        <td>${b.flags ? `<span class="chip warn">${ic('alert', 13)} ${b.flags}</span>` : '<span class="fade">—</span>'}</td>
        <td class="fade">${ic('right', 18)}</td></tr>`).join('')}</tbody></table></div>
    <div class="g-two">
      <div class="card pad"><div class="nm">Калибровка</div><p class="mut small" style="margin-top:4px">Трудность задания пересчитывается после 30+ ответов учеников. Флаг ставится, если задание оказалось заметно легче или труднее своего уровня, либо если сильные ученики ошибаются в нём чаще слабых.</p></div>
      <div class="card pad"><div class="nm">Фиксированные варианты</div><p class="mut small" style="margin-top:4px">Соберите пробник из банка по блупринту ETS: router-модуль, лёгкий и трудный второй модуль. Вариант можно назначить группе.</p>
        <button class="btn sm" data-act="imp" style="margin-top:10px">${ic('plus', 16)} Собрать вариант</button></div>
    </div>`
  };
}

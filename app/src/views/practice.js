// Reading practice player on the item bank.
// Modes: learn (check each answer → key + Russian explanation), timed (exam rules, results at the end),
// mistakes (repeat questions whose latest answer was wrong). Also question-type trainers (#/practice/types?type=Inference).
import * as src from '../data/source.js';
import { ic } from '../lib/icons.js';
import { esc, mmss } from '../lib/util.js';
import { on, modal, closeModal, toast } from '../lib/ui.js';

const TASK = {
  ctw: { name: 'Complete the Words', per: 1, limit: 2, sec: 150 },
  rdl: { name: 'Read in Daily Life', limit: 3, sec: 40 },
  rap: { name: 'Read an Academic Passage', limit: 1, sec: 50 },
  bas: { name: 'Build a Sentence', limit: 10, sec: 35, section: 'W' },
  types: { name: 'Тренажёр типа вопроса', limit: 6, sec: 50 },
  mistakes: { name: 'Мои ошибки', limit: 5, sec: 50 }
};
const MODE = { learn: 'Учиться', timed: 'На время', mistakes: 'Мои ошибки' };
const LETTERS = 'ABCD';
let P = null, timer = null;

/* ---------------- session ---------------- */
async function load(task, mode, qtype, exclude = [], section = 'R') {
  let items = [], only = null;
  if (task === 'mistakes' || mode === 'mistakes') {
    const m = await src.mistakes(section, task === 'mistakes' ? undefined : task);
    const pick = m.items.slice(0, TASK.mistakes.limit);
    items = await Promise.all(pick.map(x => src.item(x.item_id)));
    only = Object.fromEntries(pick.map(x => [x.item_id, new Set(x.qs)]));
  } else if (task === 'types') {
    const r = await src.practiceItems({ section, qtype, limit: TASK.types.limit, level: null, exclude });
    items = r.items;
    only = Object.fromEntries(items.map(it => [it.id, new Set((it.qtypes || it.body.qs.map(q => q.type)).map((t, i) => (t === qtype ? i : -1)).filter(i => i >= 0))]));
  } else {
    const r = await src.practiceItems({ section, task, limit: TASK[task].limit, exclude });
    items = r.items;
  }
  const screens = [];
  for (const it of items) {
    if (it.task === 'bas') { if (!only || only[it.id]?.has(0)) screens.push({ kind: 'bas', it, i: 0 }); continue; }
    if (it.task === 'ctw') {
      const gaps = it.body.parts.filter(p => p.n).length;
      const qs = [...Array(gaps).keys()].filter(i => !only || only[it.id]?.has(i));
      if (qs.length) screens.push({ kind: 'ctw', it, qs });
    } else {
      it.body.qs.forEach((q, i) => { if (!only || only[it.id]?.has(i)) screens.push({ kind: 'q', it, q, i }); });
    }
  }
  return { items, screens };
}

const qid = (it, i) => it.id + '#' + i;
const qcount = () => P.screens.reduce((a, s) => a + (s.kind === 'ctw' ? s.qs.length : 1), 0);
const basSlots = it => it.body.parts.filter(p => p === null).length;
const basAns = s => P.ans[qid(s.it, 0)] || Array(basSlots(s.it)).fill(null);
const answered = s => s.kind === 'bas' ? basAns(s).every(x => x != null) : s.kind === 'ctw' ? s.qs.every(i => (P.ans[qid(s.it, i)] || '').length === gapLen(s.it, i) && !/\s/.test(P.ans[qid(s.it, i)])) : P.ans[qid(s.it, s.i)] != null;
const gapLen = (it, i) => it.body.parts.filter(p => p.n)[i].n;
const checked = s => s.kind === 'ctw' ? s.qs.every(i => P.fb[qid(s.it, i)]) : !!P.fb[qid(s.it, s.i)];

/* ---------------- left pane renderers ---------------- */
function docHtml(d, hlw) {
  const mark = t => hlw ? esc(t).replace(esc(hlw), `<mark class="xhl">${esc(hlw)}</mark>`) : esc(t);
  const paras = (d.paras || []).map(p => `<p>${mark(p).replace(/\n/g, '<br>')}</p>`).join('');
  switch (d.kind) {
    case 'chat': return `<div class="xdoc chat">${d.group ? `<div class="ch-g">${esc(d.group)}</div>` : ''}${d.msgs.map((m, k) => `<div class="msg ${k % 2 ? 'r' : ''}"><b>${esc(m.who)}</b><span>${mark(m.text)}</span><i>${esc(m.time || '')}</i></div>`).join('')}</div>`;
    case 'email': return `<div class="xdoc email"><div class="em-h"><div><span>From:</span> ${esc(d.from)}</div><div><span>To:</span> ${esc(d.to)}</div><div><span>Subject:</span> <b>${esc(d.subject)}</b></div></div>${paras}</div>`;
    case 'table': return `<div class="xdoc table"><div class="nt-hd">${esc(d.head)}</div><table>${d.rows.map(r => `<tr>${r.map(c => `<td>${mark(c)}</td>`).join('')}</tr>`).join('')}</table>${d.foot ? `<p class="foot">${mark(d.foot)}</p>` : ''}</div>`;
    case 'receipt': return `<div class="xdoc receipt"><div class="nt-hd">${esc(d.head)}</div><div class="rc-m">${esc(d.meta || '')}</div><table>${d.rows.map(r => `<tr class="${/total|subtotal/i.test(r[0]) ? 'tot' : ''}"><td>${mark(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('')}</table>${d.foot ? `<p class="foot">${mark(d.foot)}</p>` : ''}</div>`;
    case 'post': return `<div class="xdoc post"><div class="ps-h"><span class="ps-av">${esc(d.who[0])}</span><div><b>${esc(d.who)}</b><span>${esc(d.handle || '')}</span></div></div>${paras}</div>`;
    default: return `<div class="xdoc notice">${d.head ? `<div class="nt-hd">${esc(d.head)}</div>` : ''}${paras}</div>`;
  }
}

function passageHtml(s) {
  const b = s.it.body, q = s.q || {}, id = qid(s.it, s.i), fb = P.fb[id], a = P.ans[id];
  const ins = q.insert ? b.insert : null;
  return `<div class="xpass"><h3>${esc(b.title)}</h3>${b.paras.map((para, p) => {
    const sents = para.map((t, k) => {
      let h = esc(t);
      if (q.hl && q.hl.p === p && q.hl.s === k) h = h.replace(new RegExp(`\\b${esc(q.hl.w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`), m => `<mark class="xhl">${m}</mark>`);
      if (q.simp && q.simp.p === p && q.simp.s === k) h = `<mark class="xhl">${h}</mark>`;
      if (q.sel && q.sel.p === p) {
        const st = fb ? (k === fb.key ? 'ok' : k === a ? 'bad' : '') : (a === k ? 'on' : '');
        return `<span class="xsent ${st}" role="button" tabindex="0" data-act="pr-sel" data-k="${k}">${h}</span>`;
      }
      return h;
    });
    if (ins && ins.p === p) {
      // squares before the listed sentence indexes (index = length → end of paragraph)
      const out = [];
      for (let k = 0; k <= sents.length; k++) {
        const slot = ins.slots.indexOf(k);
        if (slot >= 0) {
          const chosen = a === slot, right = fb && fb.key === slot, wrong = fb && chosen && !right;
          out.push(`<button class="sq-ins ${chosen ? 'on' : ''} ${right ? 'ok' : ''} ${wrong ? 'bad' : ''}" data-act="pr-ins" data-k="${slot}" aria-label="Square ${slot + 1}">■</button>${chosen ? ` <b class="ins-t">${esc(ins.sentence)}</b>` : ''}`);
        }
        if (k < sents.length) out.push(sents[k]);
      }
      return `<p><span class="pn">${p + 1}</span>${out.join(' ')}</p>`;
    }
    return `<p><span class="pn">${p + 1}</span>${sents.join(' ')}</p>`;
  }).join('')}</div>`;
}

function ctwHtml(s) {
  const b = s.it.body;
  let gi = -1;
  const body = b.parts.map(p => {
    if (p.t != null) return esc(p.t);
    gi++;
    const id = qid(s.it, gi), a = P.ans[id] || '', fb = P.fb[id], active = s.qs.includes(gi);
    if (!active) return esc(p.pre + p.keep) + '<span class="cw-done">' + '·'.repeat(p.n) + '</span>' + esc(p.post);
    const boxes = [...Array(p.n).keys()].map(i => {
      const st = fb ? (fb.correct ? 'ok' : 'bad') : '';
      return `<input class="lb ${st}" maxlength="1" autocomplete="off" autocapitalize="off" spellcheck="false" data-q="${gi}" data-i="${i}" value="${esc(a[i] && a[i] !== ' ' ? a[i] : '')}" ${fb ? 'readonly' : ''} aria-label="Gap ${gi + 1}, letter ${i + 1}">`;
    }).join('');
    const fix = fb && !fb.correct ? `<sup class="cw-fix">${esc(p.keep + fb.key)}</sup>` : '';
    return `${esc(p.pre)}<span class="cw ${fb ? (fb.correct ? 'ok' : 'bad') : ''}">${esc(p.keep)}${boxes}${fix}</span>${esc(p.post)}`;
  }).join('');
  return `<div class="xctw"><p>${esc(b.first)}${body}</p></div>`;
}

/* ---------------- Build a Sentence ---------------- */
const cap = t => t ? t[0].toUpperCase() + t.slice(1) : t;
function basSentence(it, slots) {
  let k = 0;
  return it.body.parts.map((p, i) => {
    if (p !== null) return p;
    const t = (slots || [])[k++] || '…';
    return i === 0 ? cap(t) : t;
  }).join(' ').replace(/\s+([.,?!])/g, '$1');
}
function basHtml(s) {
  const b = s.it.body, id = qid(s.it, 0), a = basAns(s), fb = P.fb[id];
  const used = new Set(a.filter(x => x != null));
  let k = -1;
  const frame = b.parts.map((p, i) => {
    if (p !== null) return `<span class="fx ${/^[.,?!]/.test(p) ? 'punct' : ''}">${esc(p)}</span>`;
    k++;
    const ci = a[k], txt = ci == null ? '' : (i === 0 ? cap(b.chunks[ci]) : b.chunks[ci]);
    const st = fb ? (fb.key && fb.key[k] === b.chunks[ci] ? 'ok' : 'bad') : '';
    return ci == null
      ? `<span class="slot empty" data-slot="${k}" aria-label="Пустая ячейка ${k + 1}"></span>`
      : `<button class="slot filled ${st}" data-act="bas-un" data-k="${k}" data-drag="slot" ${fb ? 'disabled' : ''} aria-label="Убрать: ${esc(txt)}">${esc(txt)}</button>`;
  }).join(' ');
  const pool = b.chunks.map((c, ci) => used.has(ci) ? `<span class="chunk ghost">${esc(c)}</span>`
    : `<button class="chunk" data-act="bas-pick" data-c="${ci}" data-drag="chunk" ${fb ? 'disabled' : ''}>${esc(c)}</button>`).join('');
  return `<div class="bas">
    <p class="xdir">Move the words in the boxes to create a grammatical sentence.</p>
    <div class="bas-dlg">
      <div class="bub a"><span class="who">A</span><p>${esc(b.a)}</p></div>
      <div class="bub b"><span class="who">B</span><div class="frame">${frame}</div></div>
    </div>
    <div class="pool" data-pool="1">${pool}</div>
    ${fb ? `<div class="fbk ${fb.correct ? 'ok' : 'bad'}"><div class="fb-h">${ic(fb.correct ? 'check' : 'x', 18)} ${fb.correct ? 'Верно' : 'Неверно'} <span class="qt-chip" style="margin:0 0 0 6px">${esc(b.focus)}</span></div>
      ${fb.correct ? '' : `<p><b>Правильно:</b> ${esc(basSentence(s.it, fb.key))}</p>`}${fb.explain ? `<p>${esc(fb.explain)}</p>` : ''}</div>`
      : `<p class="xhint">Нажмите на слово, чтобы поставить его в первую свободную ячейку, или перетащите в нужную. Нажмите на слово в ячейке, чтобы убрать его.</p>`}
  </div>`;
}
function basPlace(ci, slot) {
  const s = P.screens[P.at], id = qid(s.it, 0), a = basAns(s).slice();
  if (P.fb[id]) return;
  const from = a.indexOf(ci);
  if (slot == null) { slot = a.indexOf(null); if (slot < 0) return; }
  const prev = a[slot];
  if (from >= 0) a[from] = prev ?? null; // swap when moving between slots
  a[slot] = ci;
  P.ans[id] = a; render();
}
function basRemove(k) {
  const s = P.screens[P.at], id = qid(s.it, 0), a = basAns(s).slice();
  if (P.fb[id]) return;
  a[k] = null; P.ans[id] = a; render();
}
on('bas-pick', el => { if (drag.moved) return; basPlace(+el.dataset.c); });
on('bas-un', el => { if (drag.moved) return; basRemove(+el.dataset.k); });

/* drag with pointer events (mouse, finger, pen) */
const drag = { el: null, ghost: null, ci: null, from: null, x: 0, y: 0, moved: false };
function onDown(e) {
  const el = e.target.closest('[data-drag]');
  if (!el || el.disabled || !P || e.button > 0) return;
  const s = P.screens[P.at];
  drag.el = el; drag.moved = false; drag.x = e.clientX; drag.y = e.clientY;
  drag.from = el.dataset.drag === 'slot' ? +el.dataset.k : null;
  drag.ci = drag.from != null ? basAns(s)[drag.from] : +el.dataset.c;
}
function onMove(e) {
  if (!drag.el) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
  if (!drag.moved) {
    drag.moved = true;
    const r = drag.el.getBoundingClientRect();
    drag.ghost = drag.el.cloneNode(true); drag.ghost.classList.add('drag-ghost');
    drag.ghost.style.width = r.width + 'px'; document.body.appendChild(drag.ghost);
    drag.el.classList.add('dragging');
  }
  e.preventDefault();
  drag.ghost.style.transform = `translate(${e.clientX - drag.ghost.offsetWidth / 2}px, ${e.clientY - drag.ghost.offsetHeight / 2}px)`;
  document.querySelectorAll('.slot.over').forEach(x => x.classList.remove('over'));
  const t = document.elementFromPoint(e.clientX, e.clientY)?.closest('.slot');
  if (t) t.classList.add('over');
}
function onUp(e) {
  if (!drag.el) return;
  const was = drag.moved;
  if (was) {
    drag.ghost?.remove();
    const t = document.elementFromPoint(e.clientX, e.clientY);
    const slot = t?.closest('.slot');
    if (slot) basPlace(drag.ci, +(slot.dataset.slot ?? slot.dataset.k));
    else if (drag.from != null) basRemove(drag.from);
    else render();
    setTimeout(() => { drag.moved = false; }, 0);
  }
  drag.el = null; drag.ghost = null;
}

/* ---------------- right pane ---------------- */
function questionHtml(s) {
  const q = s.q, id = qid(s.it, s.i), a = P.ans[id], fb = P.fb[id];
  let ctl;
  if (q.sel) ctl = `<p class="xhint">${ic('book', 16)} Нажмите на предложение в абзаце ${q.sel.p + 1}.</p>${a != null ? `<p class="xpicked">Выбрано: предложение ${a + 1}</p>` : ''}`;
  else if (q.insert) ctl = `<div class="ins-box"><b>${esc(s.it.body.insert.sentence)}</b></div><p class="xhint">Нажмите на квадрат ■ в абзаце ${s.it.body.insert.p + 1}, чтобы вставить предложение.</p>`;
  else ctl = `<div class="opts" role="radiogroup">${q.opts.map((o, k) => {
    const st = fb ? (k === fb.key ? 'ok' : k === a ? 'bad' : 'dim') : (a === k ? 'on' : '');
    return `<button class="opt ${st}" role="radio" aria-checked="${a === k}" data-act="pr-opt" data-k="${k}" ${fb ? 'disabled' : ''}><span class="rad">${LETTERS[k]}</span><span>${esc(o)}</span></button>`;
  }).join('')}</div>`;
  return `<div class="xq"><div class="qt-chip">${esc(q.type)}</div><p class="stem">${esc(q.stem)}</p>${ctl}${fb ? feedbackHtml([fb]) : ''}</div>`;
}

function feedbackHtml(list) {
  const ok = list.every(f => f.correct);
  return `<div class="fbk ${ok ? 'ok' : 'bad'}"><div class="fb-h">${ic(ok ? 'check' : 'x', 18)} ${ok ? 'Верно' : list.length > 1 ? `Верно ${list.filter(f => f.correct).length} из ${list.length}` : 'Неверно'}</div>
    ${list.filter(f => !f.correct || list.length === 1).map(f => f.explain ? `<p>${esc(f.explain)}</p>` : '').join('')}</div>`;
}

/* ---------------- frame ---------------- */
function bar() {
  const s = P.screens[P.at], total = P.screens.length;
  const learn = P.mode !== 'timed';
  const right = learn
    ? (checked(s) ? `<button class="xbtn pri" data-act="pr-next"><span>${P.at < total - 1 ? 'Дальше' : 'Итоги'}</span>${ic('right', 17)}</button>`
      : `<button class="xbtn pri" data-act="pr-check" ${answered(s) ? '' : 'disabled'}><span>Проверить</span>${ic('check', 17)}</button>`)
    : `<button class="xbtn" data-act="pr-review">${ic('list', 17)}<span>Review</span></button>
       <button class="xbtn" data-act="pr-back" ${P.at ? '' : 'disabled'}>${ic('left', 17)}<span>Back</span></button>
       <button class="xbtn pri" data-act="pr-next"><span>${P.at < total - 1 ? 'Next' : 'Finish'}</span>${ic('right', 17)}</button>`;
  return `<div class="xbar">
    <div class="xb-l"><button class="xexit" data-act="pr-exit" aria-label="Выйти">${ic('x', 18)}</button><span class="xsec">${esc(P.title)}<span> · ${MODE[P.mode] || ''}</span></span></div>
    <div class="xb-c"><span class="xq-n">${learn ? 'Шаг' : 'Screen'} ${P.at + 1} / ${total}</span>${P.mode === 'timed' ? `<span class="xtime ${P.left <= 60 ? 'warn' : ''}">${mmss(P.left)}</span>` : ''}</div>
    <div class="xb-r">${right}</div></div>`;
}

function render() {
  const root = document.getElementById('app');
  if (!P) return;
  if (P.results) return renderResults(root);
  if (!P.screens.length) {
    root.innerHTML = `<div class="exam"><div class="xbar"><div class="xb-l"><a class="xexit" href="#/train/${P.section}">${ic('x', 18)}</a><span class="xsec">${esc(P.title)}</span></div></div>
      <div class="xres-in"><div class="xres-hero"><div class="k">${P.mode === 'mistakes' || P.task === 'mistakes' ? 'Ошибок для повтора нет' : 'Задания закончились'}</div>
      <p class="mut" style="margin-top:8px">${P.mode === 'mistakes' || P.task === 'mistakes' ? 'Все ошибки исправлены. Новые появятся после тренировок.' : 'Вы прошли все задания этого типа на своём уровне. Банк будет пополняться.'}</p></div>
      <div class="xr-ft"><a class="btn pri" href="#/train/${P.section}">К тренировке</a></div></div></div>`;
    return;
  }
  const s = P.screens[P.at];
  const one = s.kind === 'ctw' || s.kind === 'bas';
  const progress = P.screens.filter(x => P.mode === 'timed' ? answered(x) : checked(x)).length / P.screens.length * 100;
  root.innerHTML = `<div class="exam practice ${P.mode}">${bar()}<div class="xprogress"><i style="width:${progress}%"></i></div>
    <div class="xbody ${one ? 'one' : 'two'}">
      ${s.kind === 'bas' ? `<div class="xpane">${basHtml(s)}</div>`
        : one ? `<div class="xpane"><p class="xdir">Fill in the missing letters in the paragraph.</p>${ctwHtml(s)}
          ${P.fb[qid(s.it, s.qs[0])] ? feedbackHtml(s.qs.map(i => P.fb[qid(s.it, i)])) : ''}</div>`
        : `<div class="xpane left"><p class="xdir">${s.it.task === 'rdl' ? 'Read the text.' : 'Read the passage.'}</p>${s.it.task === 'rdl' ? docHtml(s.it.body.doc, s.q.hlw) : passageHtml(s)}</div>
           <div class="xpane right">${questionHtml(s)}</div>`}
    </div>
    <div class="xkeys fade">${P.mode === 'timed' ? '←/→ Back/Next · 1–4 вариант' : '1–4 вариант · Enter — проверить / дальше'}</div></div>`;
}

function renderResults(root) {
  const R = P.results;
  const got = R.filter(r => r.correct).length;
  const byType = {};
  R.forEach(r => { const t = byType[r.qtype || 'Complete the Words'] ||= [0, 0]; t[1]++; if (r.correct) t[0]++; });
  const wrong = R.filter(r => !r.correct);
  root.innerHTML = `<div class="exam xres practice-res"><div class="xbar"><div class="xb-l"><a class="xexit" href="#/train/${P.section}" aria-label="Закрыть">${ic('x', 18)}</a><span class="xsec">${esc(P.title)}<span> · итоги</span></span></div></div>
    <div class="xres-in">
      <div class="xres-hero"><div class="k">${MODE[P.mode] || ''}</div><div class="xr-n serif">${got}<small>/${R.length}</small></div>
        <p class="mut">${got === R.length ? 'Без ошибок.' : `Ошибок: ${wrong.length}. Они попадут в «Мои ошибки» — вернёмся к ним позже.`}</p></div>
      <div class="xr-grid">
        <div class="card pad"><div class="nm">По типам вопросов</div>${Object.entries(byType).map(([t, [a, b]]) => `<div class="qb cR"><span class="qn">${esc(t)}</span><div class="bar"><i style="width:${a / b * 100}%;${a / b < .6 ? 'background:var(--sS)' : ''}"></i></div><b>${a}/${b}</b></div>`).join('')}</div>
        <div class="card pad"><div class="nm">Разбор ошибок</div>${wrong.length ? wrong.slice(0, 12).map(r => `<div class="wr"><span class="chip">${esc(r.qtype || 'Complete the Words')}</span>${r.label ? `<b>${esc(r.label)}</b>` : ''}<p>${esc(r.explain || '')}</p></div>`).join('') : '<p class="mut">Ошибок нет — отличный результат.</p>'}</div>
      </div>
      <div class="xr-ft"><a class="btn" href="#/train/${P.section}">К тренировке</a>${wrong.length ? `<a class="btn" href="#/practice/mistakes?mode=mistakes&sec=${P.section}">Мои ошибки</a>` : ''}<button class="btn pri" data-act="pr-again">${ic('repeat', 17)} Ещё подход</button></div>
    </div></div>`;
}

/* ---------------- answering ---------------- */
function responsesFor(s) {
  if (s.kind === 'bas') { const a = basAns(s); return [{ item_id: s.it.id, q: 0, answer: a.map(ci => ci == null ? null : s.it.body.chunks[ci]) }]; }
  if (s.kind === 'ctw') return s.qs.map(i => ({ item_id: s.it.id, q: i, answer: (P.ans[qid(s.it, i)] || '').trim() }));
  return [{ item_id: s.it.id, q: s.i, answer: P.ans[qid(s.it, s.i)] }];
}

async function check() {
  const s = P.screens[P.at];
  if (!answered(s) || checked(s) || P.busy) return;
  P.busy = true;
  try {
    const r = await src.practiceAnswer(P.attemptId, responsesFor(s));
    for (const f of r.results || []) P.fb[f.item_id + '#' + f.q] = f;
    for (const f of r.results || []) P.log.push({ ...f, qtype: s.kind === 'bas' ? s.it.body.focus : f.qtype || (s.kind === 'ctw' ? 'Complete the Words' : s.q.type), label: s.kind === 'ctw' ? labelGap(s.it, f.q, f.key) : s.kind === 'bas' ? basSentence(s.it, f.key) : s.q.stem });
  } catch (e) { toast(e.message); }
  P.busy = false;
  render();
}
const labelGap = (it, i, key) => { const p = it.body.parts.filter(x => x.n)[i]; return p ? p.keep + key : ''; };

async function finish() {
  if (P.results || P.busy) return;
  clearInterval(timer);
  P.busy = true; closeModal();
  try {
    if (P.mode === 'timed') {
      const all = P.screens.flatMap(responsesFor);
      const r = await src.practiceFinish(P.attemptId, all);
      P.results = r.responses.map(x => {
        const s = P.screens.find(sc => sc.it.id === x.item_id && (sc.kind === 'ctw' ? sc.qs.includes(x.q) : sc.i === x.q));
        return { ...x, qtype: s?.kind === 'bas' ? s.it.body.focus : x.qtype || (s?.kind === 'ctw' ? 'Complete the Words' : s?.q?.type), label: s?.kind === 'ctw' ? labelGap(s.it, x.q, x.key) : s?.kind === 'bas' ? basSentence(s.it, x.key) : s?.q?.stem };
      });
    } else {
      await src.practiceFinish(P.attemptId, []);
      P.results = P.log;
    }
  } catch (e) { toast('Не сохранилось: ' + e.message); P.results = P.log; }
  P.busy = false;
  render(); window.scrollTo(0, 0);
}

function go(i) { P.at = Math.max(0, Math.min(P.screens.length - 1, i)); render(); window.scrollTo(0, 0); }
function rerenderKeepFocus() {
  const a = document.activeElement, key = a && a.classList?.contains('lb') ? [a.dataset.q, a.dataset.i] : null;
  render();
  if (key) document.querySelector(`.lb[data-q="${key[0]}"][data-i="${key[1]}"]`)?.focus();
}

on('pr-opt', el => { const s = P.screens[P.at]; if (checked(s)) return; P.ans[qid(s.it, s.i)] = +el.dataset.k; render(); });
on('pr-sel', el => { const s = P.screens[P.at]; if (checked(s)) return; P.ans[qid(s.it, s.i)] = +el.dataset.k; render(); });
on('pr-ins', el => { const s = P.screens[P.at]; if (checked(s)) return; P.ans[qid(s.it, s.i)] = +el.dataset.k; render(); });
on('pr-check', check);
on('pr-next', () => {
  if (P.mode !== 'timed') { if (P.at < P.screens.length - 1) go(P.at + 1); else finish(); return; }
  if (P.at < P.screens.length - 1) return go(P.at + 1);
  const left = P.screens.filter(s => !answered(s)).length;
  modal(`<h2>Завершить?</h2><p class="mut" style="margin-bottom:14px">${left ? `Без ответа экранов: ${left}. ` : ''}После завершения увидите результат и разбор.</p>
    <button class="btn pri block" data-act="pr-finish">Завершить</button><button class="btn ghost block" data-act="modal-close" style="margin-top:6px">Вернуться</button>`);
});
on('pr-finish', finish);
on('pr-back', () => go(P.at - 1));
on('pr-review', () => modal(`<h2>Review</h2><div class="xrev">${P.screens.map((s, k) => `<button class="${answered(s) ? 'a' : ''} ${k === P.at ? 'cur' : ''}" data-act="pr-goto" data-k="${k}"><b>${k + 1}</b><span>${answered(s) ? 'Answered' : 'Not answered'}</span></button>`).join('')}</div>
  <button class="btn block" data-act="modal-close" style="margin-top:14px">Return</button>`));
on('pr-goto', el => { closeModal(); go(+el.dataset.k); });
on('pr-exit', () => modal(`<h2>Выйти из тренировки?</h2><p class="mut" style="margin-bottom:14px">${P.mode === 'timed' ? 'Ответы этого подхода не сохранятся.' : 'Проверенные ответы уже сохранены.'}</p>
  <a class="btn pri block" href="#/train/${P.section}" data-act="modal-close">Выйти</a><button class="btn ghost block" data-act="modal-close" style="margin-top:6px">Продолжить</button>`));
on('pr-again', () => { const seen = P.items.map(i => i.id); start(P.task, P.mode, P.qtype, seen, P.section); });

function onInput(e) {
  const el = e.target;
  if (!P || !el.classList?.contains('lb')) return;
  el.value = el.value.replace(/[^A-Za-z]/g, '').slice(-1);
  const s = P.screens[P.at], q = el.dataset.q;
  const boxes = [...document.querySelectorAll(`.lb[data-q="${q}"]`)];
  P.ans[qid(s.it, q)] = boxes.map(b => b.value || ' ').join('').replace(/\s+$/, '');
  if (el.value) { const all = [...document.querySelectorAll('.lb:not([readonly])')]; all[all.indexOf(el) + 1]?.focus(); }
  const btn = document.querySelector('[data-act="pr-check"]');
  if (btn) btn.disabled = !answered(s);
}

function tick() {
  if (!P || P.results) return;
  P.left--;
  if (P.left <= 0) { finish(); return; }
  const t = document.querySelector('.xtime');
  if (t) { t.textContent = mmss(P.left); t.classList.toggle('warn', P.left <= 60); }
}

async function start(task, mode, qtype, exclude = [], section = 'R') {
  clearInterval(timer);
  const title = task === 'types' ? qtype : TASK[task].name;
  P = { task, mode, qtype, title, section, items: [], screens: [], at: 0, ans: {}, fb: {}, log: [], results: null, busy: false };
  document.getElementById('app').innerHTML = `<div class="exam"><div class="xbar"><div class="xb-l"><span class="xsec">${esc(title)}</span></div></div><div class="xres-in"><div class="skel"></div></div></div>`;
  try {
    const { items, screens } = await load(task, mode, qtype, exclude, P.section);
    Object.assign(P, { items, screens });
    if (screens.length) {
      const a = await src.practiceStart({ mode: mode === 'mistakes' ? 'mistakes' : mode, section: P.section, task: task === 'types' || task === 'mistakes' ? null : task });
      P.attemptId = a.id;
      if (mode === 'timed') {
        P.left = screens.reduce((t, s) => t + (s.kind === 'ctw' ? TASK.ctw.sec : (TASK[s.it.task]?.sec || 45)), 0);
        timer = setInterval(tick, 1000);
      }
    }
  } catch (e) { toast(e.message); }
  render();
}

export default function practice(params) {
  const task = TASK[params[0]] ? params[0] : 'ctw';
  const qs = new URLSearchParams(location.hash.split('?')[1] || '');
  const mode = task === 'mistakes' ? 'mistakes' : ['learn', 'timed', 'mistakes'].includes(qs.get('mode')) ? qs.get('mode') : 'learn';
  const qtype = qs.get('type');
  const section = TASK[task].section || (['R', 'W', 'S', 'L'].includes(qs.get('sec')) ? qs.get('sec') : 'R');
  return {
    exam: true, title: TASK[task].name,
    mount() { start(task, mode, qtype, [], section); document.addEventListener('input', onInput); document.addEventListener('pointerdown', onDown); document.addEventListener('pointermove', onMove, { passive: false }); document.addEventListener('pointerup', onUp); },
    unmount() { clearInterval(timer); document.removeEventListener('input', onInput); document.removeEventListener('pointerdown', onDown); document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp); drag.ghost?.remove(); P = null; },
    keys(e) {
      if (!P || P.results || document.querySelector('.scrim')) return;
      const t = e.target, s = P.screens[P.at];
      if (!s) return;
      if (t.classList?.contains('lb')) {
        const all = [...document.querySelectorAll('.lb:not([readonly])')], k = all.indexOf(t);
        if (e.key === 'Backspace' && !t.value && k > 0) { all[k - 1].focus(); all[k - 1].value = ''; all[k - 1].dispatchEvent(new Event('input', { bubbles: true })); e.preventDefault(); }
        else if (e.key === 'ArrowLeft' && k > 0) { all[k - 1].focus(); e.preventDefault(); }
        else if (e.key === 'ArrowRight' && k < all.length - 1) { all[k + 1].focus(); e.preventDefault(); }
        else if (e.key === 'Enter') { e.preventDefault(); P.mode === 'timed' ? null : (checked(s) ? document.querySelector('[data-act="pr-next"]')?.click() : check()); }
        return;
      }
      if (t.closest('input,textarea')) return;
      if (/^[1-4]$/.test(e.key) && s.kind === 'q' && s.q.opts && !checked(s)) { P.ans[qid(s.it, s.i)] = +e.key - 1; render(); }
      if (e.key === 'Enter' && P.mode !== 'timed') { e.preventDefault(); checked(s) ? document.querySelector('[data-act="pr-next"]')?.click() : check(); }
      if (P.mode === 'timed' && e.key === 'ArrowRight') { e.preventDefault(); document.querySelector('[data-act="pr-next"]')?.click(); }
      if (P.mode === 'timed' && e.key === 'ArrowLeft') { e.preventDefault(); go(P.at - 1); }
    }
  };
}

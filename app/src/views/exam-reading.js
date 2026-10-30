// Exam shell — Reading. Behaviour follows ETS rules (guide §4.3, §13.2):
// passage always visible; Back and Review inside the module; Help does not stop the clock;
// clock can be hidden but is forced visible near the end; no penalty for guessing.
// Toolbar labels are English, as on the real test. The look is our own, deliberately plain.

import { demoModule } from '../data/exam-reading.js';
import { makeCtw, ctwCorrect } from '../lib/ctw.js';
import { ic } from '../lib/icons.js';
import { esc, mmss } from '../lib/util.js';
import { on, modal, closeModal, toast } from '../lib/ui.js';
import * as src from '../data/source.js';

const ROUTE_THRESHOLD = 0.6; // share correct in module 1 → upper module 2 (configurable; ETS does not publish it)

let S = null; // exam state
let timerId = null;

function build() {
  const screens = [], items = [];
  let qn = 0;
  demoModule.sets.forEach((set, si) => {
    if (set.type === 'ctw') {
      const c = makeCtw(set.text);
      const first = qn + 1;
      c.parts.filter(p => p.miss).forEach(p => items.push({ kind: 'ctw', n: ++qn, screen: screens.length, part: p, type: 'Complete the Words' }));
      screens.push({ set, si, ctw: c, from: first, to: qn });
    } else {
      set.qs.forEach((q, qi) => {
        items.push({ kind: q.select ? 'sel' : 'mcq', n: ++qn, screen: screens.length, q, type: q.type });
        screens.push({ set, si, q, qi, from: qn, to: qn });
      });
    }
  });
  return { screens, items, at: 0, ans: {}, left: demoModule.minutes * 60, hideTime: false, done: false };
}

const answered = it => {
  const a = S.ans[it.n];
  return it.kind === 'ctw' ? !!a && a.length === it.part.miss.length && !a.includes(' ') : a != null;
};
const correct = it => {
  const a = S.ans[it.n];
  if (it.kind === 'ctw') return ctwCorrect(it.part, a);
  if (it.kind === 'sel') return a === it.q.select.a;
  return a === it.q.a;
};

/* ---------- left pane ---------- */
function passageHtml(sc) {
  const set = sc.set;
  if (set.type === 'ctw') return ctwHtml(sc);
  if (set.type === 'rdl') {
    const d = set.doc;
    return `<div class="xdoc notice"><div class="nt-hd">${esc(d.head)}</div>${d.body.map(p => `<p>${p}</p>`).join('')}</div>`;
  }
  const q = sc.q || {};
  const selMode = !!q.select;
  return `<div class="xpass"><h3>${esc(set.heading)}</h3>${set.paras.map((p, pi) => `<p class="${selMode && pi === q.select.para ? 'selpara' : ''}">${p.map((s, si) => {
    let t = esc(s)
      .replace(/\[\[(.+?)\]\]/g, (_, w) => q.hl === w ? `<mark class="xhl">${w}</mark>` : w)
      .replace(/\{\{(.+?)\}\}/g, (_, w) => q.hl === w ? `<mark class="xhl">${w}</mark>` : w);
    if (selMode && pi === q.select.para) {
      const on = S.ans[sc.from] === si;
      return `<span class="xsent ${on ? 'on' : ''}" role="button" tabindex="0" data-act="x-sel" data-n="${sc.from}" data-i="${si}">${t}</span>`;
    }
    return t;
  }).join(' ')}</p>`).join('')}</div>`;
}

function ctwHtml(sc) {
  const c = sc.ctw;
  const body = c.parts.map(p => {
    if (p.t != null) return esc(p.t);
    const it = S.items.find(x => x.part === p);
    const a = S.ans[it.n] || '';
    const boxes = [...p.miss].map((_, i) => `<input class="lb" maxlength="1" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false"
      data-n="${it.n}" data-i="${i}" value="${esc(a[i] || '')}" aria-label="Question ${it.n}, letter ${i + 1}">`).join('');
    return `${esc(p.pre)}<span class="cw" data-q="${it.n}">${esc(p.keep)}${boxes}</span>${esc(p.post)}`;
  }).join('');
  return `<div class="xctw"><p>${esc(c.first)}${body}</p></div>`;
}

/* ---------- right pane ---------- */
function questionHtml(sc) {
  const q = sc.q;
  if (q.select) return `<div class="xq"><p class="stem">${esc(q.stem)}</p><p class="xhint">Click on a sentence in the passage to select it.</p>
    ${S.ans[sc.from] != null ? `<p class="xpicked">Selected: sentence ${S.ans[sc.from] + 1}</p>` : ''}</div>`;
  return `<div class="xq"><p class="stem">${esc(q.stem)}</p>
    <div class="opts" role="radiogroup">${q.opts.map((o, i) => `<button class="opt ${S.ans[sc.from] === i ? 'on' : ''}" role="radio" aria-checked="${S.ans[sc.from] === i}" data-act="x-opt" data-n="${sc.from}" data-i="${i}">
      <span class="rad"></span><span>${esc(o)}</span></button>`).join('')}</div></div>`;
}

/* ---------- render ---------- */
function bar() {
  const sc = S.screens[S.at], total = S.items.length;
  const qlabel = sc.from === sc.to ? `Question ${sc.from} of ${total}` : `Questions ${sc.from}–${sc.to} of ${total}`;
  const force = S.left <= 60;
  return `<div class="xbar">
    <div class="xb-l"><button class="xexit" data-act="x-exit" aria-label="Выйти из теста">${ic('x', 18)}</button><span class="xsec">Reading<span> · Module ${demoModule.module}</span></span></div>
    <div class="xb-c"><span class="xq-n">${qlabel}</span>
      <span class="xtime ${force ? 'warn' : ''}">${S.hideTime && !force ? '' : mmss(S.left)}</span>
      ${force ? '' : `<button class="xbtn link" data-act="x-hide">${S.hideTime ? 'Show Time' : 'Hide Time'}</button>`}</div>
    <div class="xb-r">
      <button class="xbtn" data-act="x-help">${ic('help', 17)}<span>Help</span></button>
      <button class="xbtn" data-act="x-review">${ic('list', 17)}<span>Review</span></button>
      <button class="xbtn" data-act="x-back" ${S.at === 0 ? 'disabled' : ''}>${ic('left', 17)}<span>Back</span></button>
      <button class="xbtn pri" data-act="x-next"><span>Next</span>${ic('right', 17)}</button>
    </div></div>`;
}

function render() {
  const root = document.getElementById('app');
  if (S.done) return renderResult(root);
  const sc = S.screens[S.at];
  const isCtw = sc.set.type === 'ctw';
  root.innerHTML = `<div class="exam">${bar()}
    <div class="xprogress"><i style="width:${(S.items.filter(answered).length / S.items.length) * 100}%"></i></div>
    <div class="xbody ${isCtw ? 'one' : 'two'}">
      ${isCtw ? `<div class="xpane"><p class="xdir">${esc(sc.set.title)}</p>${passageHtml(sc)}</div>`
        : `<div class="xpane left"><p class="xdir">${esc(sc.set.title)}</p>${passageHtml(sc)}</div><div class="xpane right">${questionHtml(sc)}</div>`}
    </div>
    <div class="xkeys fade">←/→ Back/Next · 1–4 choose · R Review</div></div>`;
}

function tick() {
  if (!S || S.done) return;
  S.left -= 1;
  const t = document.querySelector('.xtime');
  if (S.left <= 0) { finish(); return; }
  if (S.left === 60) { renderKeepFocus(); return; }
  if (t && !(S.hideTime && S.left > 60)) t.textContent = mmss(S.left);
}

function renderKeepFocus() {
  const a = document.activeElement, key = a && a.dataset && a.dataset.n != null ? [a.dataset.n, a.dataset.i] : null;
  render();
  if (key) { const el = document.querySelector(`.lb[data-n="${key[0]}"][data-i="${key[1]}"]`); if (el) el.focus(); }
}

function go(i) { S.at = Math.max(0, Math.min(S.screens.length - 1, i)); render(); window.scrollTo(0, 0); }

async function finish() {
  if (!S || S.done) return;
  S.done = true; clearInterval(timerId); closeModal();
  // live: save responses, let the server decide the route and band
  if (S.attemptId) {
    S.saving = true; render();
    try {
      await src.saveResponses(S.attemptId, S.items.map(it => ({
        section: 'R', q: it.n - 1, module: 1, qtype: it.type, answer: S.ans[it.n] ?? null, correct: correct(it) ? 1 : 0
      })));
      const r = await src.routeAttempt(S.attemptId, 'R');
      const f = await src.finishAttempt(S.attemptId);
      S.server = { route: r.route, threshold: r.threshold, band: f.bands?.R };
    } catch (e) { toast('Результат не сохранился: ' + e.message); }
    S.saving = false;
  }
  render();
}

function renderResult(root) {
  if (S.saving) { root.innerHTML = `<div class="exam xres"><div class="xres-in"><div class="xres-hero"><div class="k">Сохраняем ответы…</div></div></div></div>`; return; }
  const got = S.items.filter(correct).length, total = S.items.length, share = got / total;
  const thr = S.server?.threshold ?? S.threshold ?? ROUTE_THRESHOLD;
  const upper = S.server ? S.server.route === 'upper' : share >= thr;
  const byType = {};
  S.items.forEach(it => { const t = byType[it.type] || (byType[it.type] = [0, 0]); t[1]++; if (correct(it)) t[0]++; });
  root.innerHTML = `<div class="exam xres"><div class="xbar"><div class="xb-l"><span class="xsec">Reading<span> · Module 1 complete</span></span></div></div>
    <div class="xres-in">
      <div class="xres-hero"><div class="k">Первый модуль</div><div class="xr-n serif">${got}<small>/${total}</small></div>
        <div class="xr-route ${upper ? 'up' : ''}">${ic('route', 18)} Дальше: <b>${upper ? 'трудный' : 'лёгкий'} модуль 2</b></div>
        <p class="mut">Порог маршрута — ${Math.round(thr * 100)}% верных${S.server ? ', решение принял сервер' : ''}.${S.server?.band ? ` Ориентировочный балл Reading по этому модулю: <b>${String(S.server.band).replace('.', ',')}</b>.` : ''} ETS порог не публикует, поэтому в приложении он настраивается и уточняется по данным учеников.</p></div>
      <div class="xr-grid">
        <div class="card pad"><div class="nm">По типам вопросов</div>${Object.entries(byType).map(([t, [a, b]]) => `<div class="qb cR"><span class="qn">${t}</span><div class="bar"><i style="width:${a / b * 100}%;${a / b < .6 ? 'background:var(--sS)' : ''}"></i></div><b>${a}/${b}</b></div>`).join('')}</div>
        <div class="card pad"><div class="nm">Ответы</div><div class="xr-items">${S.items.map(it => `<span class="${correct(it) ? 'ok' : 'bad'}" title="${esc(it.type)}${it.kind === 'ctw' ? ': ' + esc(it.part.keep + it.part.miss) : ''}">${it.n}</span>`).join('')}</div>
          <p class="fade small" style="margin-top:10px">В учебном режиме здесь будет разбор каждого вопроса на русском: тип вопроса и ловушка.</p></div>
      </div>
      <div class="xr-ft"><a class="btn" href="#/train/R">К тренировке</a><button class="btn pri" data-act="x-restart">${ic('repeat', 17)} Пройти заново</button></div>
    </div></div>`;
}

/* ---------- actions ---------- */
on('x-next', () => {
  if (S.at < S.screens.length - 1) return go(S.at + 1);
  const left = S.items.filter(it => !answered(it)).length;
  modal(`<h2>Закончить модуль?</h2><p class="mut" style="margin-bottom:14px">${left ? `Без ответа: ${left}. Штрафа за неверный ответ нет — лучше угадать, чем оставить пустым.` : 'Все вопросы отвечены.'} После перехода вернуться к модулю 1 будет нельзя.</p>
    <button class="btn pri block" data-act="x-finish">Закончить модуль</button><button class="btn ghost block" data-act="modal-close" style="margin-top:6px">Вернуться</button>`);
});
on('x-finish', finish);
on('x-back', () => go(S.at - 1));
on('x-hide', () => { S.hideTime = !S.hideTime; renderKeepFocus(); });
on('x-opt', el => { S.ans[+el.dataset.n] = +el.dataset.i; renderKeepFocus(); });
on('x-sel', el => { S.ans[+el.dataset.n] = +el.dataset.i; renderKeepFocus(); });
on('x-restart', () => { start(); });
on('x-exit', () => modal(`<h2>Выйти из теста?</h2><p class="mut" style="margin-bottom:14px">Ответы этого модуля не сохранятся.</p>
  <a class="btn pri block" href="#/train/R" data-act="modal-close">Выйти</a><button class="btn ghost block" data-act="modal-close" style="margin-top:6px">Продолжить тест</button>`));
on('x-help', () => modal(`<h2>Help</h2><p class="mut" style="margin-bottom:10px">The clock does not stop while Help is open.</p>
  <div class="rows card" style="margin-bottom:14px">
    <div class="row"><div class="t"><div class="nm">Back / Next</div><div class="mt">Move between questions in this module.</div></div></div>
    <div class="row"><div class="t"><div class="nm">Review</div><div class="mt">See all questions, which are answered, and go to any of them.</div></div></div>
    <div class="row"><div class="t"><div class="nm">Complete the Words</div><div class="mt">Type the missing letters. Each box is one letter.</div></div></div>
  </div><button class="btn pri block" data-act="modal-close">Return to the test</button>`));
on('x-review', () => {
  modal(`<h2>Review</h2><p class="mut" style="margin-bottom:12px">Select a question to go to it.</p>
    <div class="xrev">${S.items.map(it => `<button class="${answered(it) ? 'a' : ''} ${it.screen === S.at ? 'cur' : ''}" data-act="x-goto" data-s="${it.screen}">
      <b>${it.n}</b><span>${answered(it) ? 'Answered' : 'Not answered'}</span></button>`).join('')}</div>
    <button class="btn block" data-act="modal-close" style="margin-top:14px">Return</button>`);
});
on('x-goto', el => { closeModal(); go(+el.dataset.s); });

/* letter boxes: type → next box; Backspace on empty → previous box */
function onInput(e) {
  const el = e.target;
  if (!el.classList || !el.classList.contains('lb')) return;
  el.value = el.value.replace(/[^A-Za-z]/g, '').slice(-1);
  const n = +el.dataset.n, boxes = [...document.querySelectorAll(`.lb[data-n="${n}"]`)];
  S.ans[n] = boxes.map(b => b.value || ' ').join('').replace(/\s+$/, '');
  if (el.value) { const all = [...document.querySelectorAll('.lb')]; const nx = all[all.indexOf(el) + 1]; if (nx) nx.focus(); }
  const pr = document.querySelector('.xprogress i');
  if (pr) pr.style.width = (S.items.filter(answered).length / S.items.length) * 100 + '%';
}

export default function examReading() {
  return {
    exam: true, title: 'Reading · экзамен',
    html: '',
    mount() { start(); document.addEventListener('input', onInput); },
    unmount() { clearInterval(timerId); document.removeEventListener('input', onInput); S = null; },
    keys(e) {
      if (!S || S.done || document.querySelector('.scrim')) return;
      const t = e.target;
      if (t.classList && t.classList.contains('lb')) {
        if (e.key === 'Backspace' && !t.value) { const all = [...document.querySelectorAll('.lb')]; const pv = all[all.indexOf(t) - 1]; if (pv) { pv.focus(); pv.value = ''; pv.dispatchEvent(new Event('input', { bubbles: true })); e.preventDefault(); } }
        if (e.key === 'ArrowLeft' && t.selectionStart === 0) { const all = [...document.querySelectorAll('.lb')]; const pv = all[all.indexOf(t) - 1]; if (pv) { pv.focus(); e.preventDefault(); } }
        if (e.key === 'ArrowRight') { const all = [...document.querySelectorAll('.lb')]; const nx = all[all.indexOf(t) + 1]; if (nx) { nx.focus(); e.preventDefault(); } }
        return;
      }
      if (e.target.closest('input,textarea')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); document.querySelector('[data-act="x-next"]').click(); }
      if (e.key === 'ArrowLeft' && S.at > 0) { e.preventDefault(); go(S.at - 1); }
      if (e.key === 'r' || e.key === 'R') { document.querySelector('[data-act="x-review"]').click(); }
      const sc = S.screens[S.at];
      if (/^[1-4]$/.test(e.key) && sc.q && sc.q.opts) { S.ans[sc.from] = +e.key - 1; renderKeepFocus(); }
    }
  };
}

function start() {
  clearInterval(timerId);
  S = build();
  render();
  timerId = setInterval(tick, 1000);
  const me = S;
  src.startAttempt({ kind: 'module', mode: 'exam', section: 'R', task: 'demo' })
    .then(r => { if (r && S === me) { me.attemptId = r.id; me.threshold = r.threshold; } })
    .catch(() => { /* offline: result stays local */ });
}

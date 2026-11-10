// Listening player on the item bank (guide §Listening).
// Task flow: audio (once in exam mode) → questions one at a time. Modes:
//  learn  — audio can be replayed, each answer is checked at once (key + Russian explanation + transcript)
//  timed  — exam rules: the recording plays once, no pause, no going back, a countdown per question; results at the end
// Also question-type trainers (#/listen/types?type=Inference) and «Мои ошибки» (#/listen/mistakes).
import * as src from '../data/source.js';
import { ic } from '../lib/icons.js';
import { esc } from '../lib/util.js';
import { on, modal, closeModal, toast } from '../lib/ui.js';
import { activeFlow } from '../lib/mockstate.js';
import * as mockflow from '../lib/mockflow.js';

const TASK = {
  lcr: { name: 'Listen and Choose a Response', limit: 8, sec: 20 },
  lco: { name: 'Listen to a Conversation', limit: 2, sec: 30 },
  lan: { name: 'Listen to an Announcement', limit: 3, sec: 30 },
  lat: { name: 'Listen to an Academic Talk', limit: 2, sec: 35 },
  types: { name: 'Тренажёр типа вопроса', limit: 5, sec: 30 },
  mistakes: { name: 'Мои ошибки', limit: 5, sec: 30 },
  mock: { name: 'Listening', limit: 99, sec: 30 } // full mock test: items fixed by the mock
};
const MODE = { learn: 'Учиться', timed: 'На время', mistakes: 'Мои ошибки' };
const LETTERS = 'ABCD';
let P = null, timer = null, audio = null;

/* ---------------- session ---------------- */
async function load(task, mode, qtype, exclude, bank, mock = null) {
  let items = [], only = null;
  if (mock) items = await src.mockPart(mock.mock, mock.part);
  else if (task === 'mistakes' || mode === 'mistakes') {
    const m = await src.mistakes('L', task === 'mistakes' ? undefined : task);
    const pick = m.items.slice(0, TASK.mistakes.limit);
    items = await Promise.all(pick.map(x => src.item(x.item_id)));
    only = Object.fromEntries(pick.map(x => [x.item_id, new Set(x.qs)]));
  } else if (task === 'types') {
    const r = await src.practiceItems({ section: 'L', qtype, limit: TASK.types.limit, level: null, exclude, bank });
    items = r.items;
    only = Object.fromEntries(items.map(it => [it.id, new Set((it.qtypes || []).map((t, i) => (t === qtype ? i : -1)).filter(i => i >= 0))]));
  } else {
    let r = await src.practiceItems({ section: 'L', task, limit: TASK[task].limit, exclude, bank });
    if (!r.items.length) r = await src.practiceItems({ section: 'L', task, limit: TASK[task].limit, exclude, bank, level: null });
    items = r.items;
  }
  const screens = [];
  for (const it of items) {
    const qs = it.body.qs.map((q, i) => ({ kind: 'q', it, q: { ...q, type: (it.qtypes || [])[i] || 'Question' }, i })).filter(s => !only || only[it.id]?.has(s.i));
    if (qs.length) screens.push(...(mode === 'timed' ? [{ kind: 'a', it }] : []), ...qs); // exam mode needs the one-time audio screen; training goes straight from question to question
  }
  return { items, screens };
}

const qid = (it, i) => it.id + '#' + i;
const isQ = s => s.kind === 'q';
const answered = s => !isQ(s) || P.ans[qid(s.it, s.i)] != null;
const checked = s => !isQ(s) || !!P.fb[qid(s.it, s.i)];
const qScreens = () => P.screens.filter(isQ);
const secFor = s => TASK[s.it.task]?.sec || 30;

/* ---------------- audio ---------------- */
function stopAudio() { if (audio) { audio.onended = audio.onerror = audio.ontimeupdate = null; audio.pause(); audio = null; } }

function playOnce(s, auto) {
  stopAudio();
  const a = audio = new Audio(s.it.body.audio);
  P.playing = true; render();
  a.ontimeupdate = () => { const b = document.querySelector('.ls-prog i'); if (b && a.duration) b.style.width = (a.currentTime / a.duration * 100) + '%'; };
  a.onended = () => { P.played[s.it.id] = true; P.playing = false; audio = null; go(P.at + 1); };
  a.onerror = () => { P.playing = false; P.audioErr = true; audio = null; render(); };
  a.play().catch(() => { P.playing = false; P.audioErr = !auto; audio = null; render(); }); // blocked autoplay → plain «Слушать» button instead of an error
}

/* ---------------- renderers ---------------- */
const player = it => `<audio class="ls-audio" controls preload="auto" src="${esc(it.body.audio)}"></audio>`;

function audioScreen(s) {
  const it = s.it, n = it.body.qs.length, timed = P.mode === 'timed';
  const what = { lcr: 'Вы услышите одну реплику.', lco: 'Вы услышите разговор двух студентов.', lan: 'Вы услышите объявление в кампусе.', lat: 'Вы услышите фрагмент лекции.' }[it.task] || 'Прослушайте запись.';
  if (!timed) return `<div class="ls-card"><div class="ls-ic">${ic('volume', 30)}</div>
    <p class="xdir">${what}</p>
    <p class="xhint">На следующем экране будет запись, её можно слушать сколько нужно. Вопросов: ${n}. Нажмите «К вопросам», когда будете готовы.</p></div>`;
  if (P.audioErr) return `<div class="ls-card"><div class="ls-ic">${ic('alert', 30)}</div><p class="xdir">Не удалось воспроизвести запись</p>
    <p class="xhint">Проверьте звук и соединение, затем попробуйте ещё раз.</p><button class="btn pri" data-act="ls-play">Повторить</button></div>`;
  if (P.playing) return `<div class="ls-card playing"><div class="ls-ic pulse">${ic('volume', 30)}</div><p class="xdir">Идёт запись…</p>
    <div class="ls-prog"><i></i></div><p class="xhint">Пауза и повтор недоступны, как на экзамене.</p></div>`;
  return `<div class="ls-card"><div class="ls-ic">${ic('volume', 30)}</div><p class="xdir">${what}</p>
    <p class="xhint">Запись звучит один раз. Затем появятся вопросы (${n}). Вернуться назад нельзя.</p>
    <button class="btn pri" data-act="ls-play">${ic('play', 18)} Слушать</button></div>`;
}

function questionScreen(s) {
  const q = s.q, id = qid(s.it, s.i), a = P.ans[id], fb = P.fb[id], timed = P.mode === 'timed';
  const opts = q.opts.map((o, k) => {
    const st = fb ? (k === fb.key ? 'ok' : k === a ? 'bad' : 'dim') : (a === k ? 'on' : '');
    return `<button class="opt ${st}" role="radio" aria-checked="${a === k}" data-act="ls-opt" data-k="${k}" ${fb ? 'disabled' : ''}><span class="rad">${LETTERS[k]}</span><span>${esc(o)}</span></button>`;
  }).join('');
  const nq = s.it.body.qs.length;
  return `<div class="xq">
    ${timed ? '' : `<div class="ls-replay">${player(s.it)}</div>`}
    <div class="qt-chip">${esc(q.type)}${nq > 1 ? ` · вопрос ${s.i + 1} из ${nq}` : ''}</div>
    <p class="stem">${esc(q.stem)}</p>
    <div class="opts" role="radiogroup">${opts}</div>
    ${fb ? fbHtml(fb) : ''}</div>`;
}

function fbHtml(f) {
  return `<div class="fbk ${f.correct ? 'ok' : 'bad'}"><div class="fb-h">${ic(f.correct ? 'check' : 'x', 18)} ${f.correct ? 'Верно' : 'Неверно'}</div>
    ${f.explain ? `<p style="white-space:pre-line">${esc(f.explain)}</p>` : ''}
    ${f.transcript ? `<details class="ls-tr"><summary>Расшифровка записи</summary><p>${esc(f.transcript).replace(/\n/g, '<br>')}</p></details>` : ''}</div>`;
}

function bar() {
  const s = P.screens[P.at], total = P.screens.length, learn = P.mode !== 'timed';
  const qn = qScreens(), qi = isQ(s) ? qn.indexOf(s) + 1 : qn.indexOf(P.screens.slice(P.at).find(isQ)) + 1;
  let right;
  if (learn) right = !isQ(s) ? `<button class="xbtn pri" data-act="ls-next"><span>К вопросам</span>${ic('right', 17)}</button>`
    : checked(s) ? `<button class="xbtn pri" data-act="ls-next"><span>${P.at < total - 1 ? 'Дальше' : 'Итоги'}</span>${ic('right', 17)}</button>`
    : `<button class="xbtn pri" data-act="ls-check" ${answered(s) ? '' : 'disabled'}><span>Проверить</span>${ic('check', 17)}</button>`;
  else right = isQ(s) ? `<button class="xbtn pri" data-act="ls-next"><span>${P.at < total - 1 ? 'Next' : 'Finish'}</span>${ic('right', 17)}</button>` : '';
  return `<div class="xbar">
    <div class="xb-l"><button class="xexit" data-act="ls-exit" aria-label="Выйти">${ic('x', 18)}</button><span class="xsec">${esc(P.title)}<span> · ${MODE[P.mode] || ''}</span></span></div>
    <div class="xb-c"><span class="xq-n">${learn ? 'Вопрос' : 'Question'} ${qi} / ${qn.length}</span>${!learn && isQ(s) ? `<span class="xtime ${P.left <= 8 ? 'warn' : ''}">${P.left}</span>` : ''}</div>
    <div class="xb-r">${right}</div></div>`;
}

function render() {
  const root = document.getElementById('app');
  if (!P) return;
  if (P.results) return renderResults(root);
  if (!P.screens.length) {
    const m = P.task === 'mistakes' || P.mode === 'mistakes';
    root.innerHTML = `<div class="exam"><div class="xbar"><div class="xb-l"><a class="xexit" href="#/train/L">${ic('x', 18)}</a><span class="xsec">${esc(P.title)}</span></div></div>
      <div class="xres-in"><div class="xres-hero"><div class="k">${m ? 'Ошибок для повтора нет' : 'Заданий пока нет'}</div>
      <p class="mut" style="margin-top:8px">${m ? 'Все ошибки исправлены. Новые появятся после тренировок.' : 'Вы прошли все задания этого типа. Новые появятся при пополнении банка.'}</p></div>
      <div class="xr-ft"><a class="btn pri" href="#/train/L">К тренировке</a></div></div></div>`;
    return;
  }
  const s = P.screens[P.at];
  const progress = P.screens.filter(x => isQ(x) && (P.mode === 'timed' ? answered(x) : checked(x))).length / qScreens().length * 100;
  root.innerHTML = `<div class="exam practice listen ${P.mode}">${bar()}<div class="xprogress"><i style="width:${progress}%"></i></div>
    <div class="xbody one"><div class="xpane">${isQ(s) ? questionScreen(s) : audioScreen(s)}</div></div>
    <div class="xkeys fade">${P.mode === 'timed' ? '1–4 вариант · Enter — дальше' : '1–4 вариант · Enter — проверить / дальше'}</div></div>`;
}

function renderResults(root) {
  const R = P.results, got = R.filter(r => r.correct).length;
  const byType = {};
  R.forEach(r => { const t = byType[r.qtype || 'Question'] ||= [0, 0]; t[1]++; if (r.correct) t[0]++; });
  const wrong = R.filter(r => !r.correct);
  const row = r => {
    const opts = r.opts || [];
    return `<details class="wr ls-rw" ${r.correct ? '' : 'open'}><summary><span class="chip ${r.correct ? 'ok' : 'bad'}">${r.correct ? '✓' : '✗'}</span> <span class="chip">${esc(r.qtype || '')}</span> <b>${esc(r.label || '')}</b></summary>
      ${r.correct ? '' : `<p>${r.answer != null && opts[r.answer] ? `<b>Ваш ответ:</b> ${LETTERS[r.answer]}. ${esc(opts[r.answer])}<br>` : '<b>Ответа не было.</b><br>'}`}
      ${opts[r.key] ? `<b>Верно:</b> ${LETTERS[r.key]}. ${esc(opts[r.key])}</p>` : ''}
      ${r.explain ? `<p style="white-space:pre-line">${esc(r.explain)}</p>` : ''}
      ${r.transcript ? `<details class="ls-tr"><summary>Расшифровка записи</summary><p>${esc(r.transcript).replace(/\n/g, '<br>')}</p></details>` : ''}</details>`;
  };
  root.innerHTML = `<div class="exam xres practice-res"><div class="xbar"><div class="xb-l"><a class="xexit" href="#/train/L" aria-label="Закрыть">${ic('x', 18)}</a><span class="xsec">${esc(P.title)}<span> · итоги</span></span></div></div>
    <div class="xres-in">
      <div class="xres-hero"><div class="k">${MODE[P.mode] || ''}</div><div class="xr-n serif">${got}<small>/${R.length}</small></div>
        <p class="mut">${got === R.length ? 'Без ошибок.' : `Ошибок: ${wrong.length}. Они попадут в «Мои ошибки» — вернёмся к ним позже.`}</p></div>
      <div class="xr-grid">
        <div class="card pad"><div class="nm">По типам вопросов</div>${Object.entries(byType).map(([t, [a, b]]) => `<div class="qb cL"><span class="qn">${esc(t)}</span><div class="bar"><i style="width:${a / b * 100}%;${a / b < .6 ? 'background:var(--sS)' : ''}"></i></div><b>${a}/${b}</b></div>`).join('')}</div>
        <div class="card pad"><div class="nm">Разбор вопросов</div>${R.map(row).join('')}</div>
      </div>
      <div class="xr-ft"><a class="btn" href="#/train/L">К тренировке</a>${wrong.length ? `<a class="btn" href="#/listen/mistakes?mode=mistakes">Мои ошибки</a>` : ''}<button class="btn pri" data-act="ls-again">${ic('repeat', 17)} Ещё подход</button></div>
    </div></div>`;
}

/* ---------------- flow ---------------- */
function go(i) {
  stopAudio(); P.playing = false; P.audioErr = false;
  if (i >= P.screens.length) return finish();
  P.at = Math.max(0, i);
  const s = P.screens[P.at];
  if (P.mode === 'timed' && isQ(s)) P.left = secFor(s);
  render(); window.scrollTo(0, 0);
  if (P.mode === 'timed' && !isQ(s) && !P.played[s.it.id]) playOnce(s, true);
}

function responsesFor(s) { return [{ item_id: s.it.id, q: s.i, answer: P.ans[qid(s.it, s.i)] ?? null }]; }

async function check() {
  const s = P.screens[P.at];
  if (!isQ(s) || !answered(s) || checked(s) || P.busy) return;
  P.busy = true;
  try {
    const r = await src.practiceAnswer(P.attemptId, responsesFor(s));
    for (const f of r.results || []) {
      P.fb[f.item_id + '#' + f.q] = f;
      P.log.push({ ...f, qtype: s.q.type, label: s.q.stem, opts: s.q.opts, answer: P.ans[qid(s.it, s.i)] });
    }
  } catch (e) { toast(e.message); }
  P.busy = false;
  render();
}

async function finish() {
  if (P.results || P.busy) return;
  clearInterval(timer); stopAudio();
  P.busy = true; closeModal();
  try {
    if (P.mock) {
      const module = P.mock.part === 'L:M1' ? 1 : 2;
      await src.saveResponses(P.attemptId, qScreens().flatMap(responsesFor).map(x => ({ ...x, module })));
      const r = P.mock.part === 'L:M1' ? await src.routeAttempt(P.attemptId, 'L') : null;
      P.busy = false;
      document.getElementById('app').innerHTML = '<div class="exam"><div class="xres-in"><div class="skel"></div></div></div>';
      mockflow.advance(r ? { L: r.route } : null);
      return;
    }
    if (P.mode === 'timed') {
      const r = await src.practiceFinish(P.attemptId, qScreens().flatMap(responsesFor));
      P.results = r.responses.map(x => {
        const s = qScreens().find(sc => sc.it.id === x.item_id && sc.i === x.q);
        return { ...x, qtype: s?.q.type || x.qtype, label: s?.q.stem, opts: s?.q.opts };
      });
    } else {
      await src.practiceFinish(P.attemptId, []);
      P.results = P.log;
    }
  } catch (e) { toast('Не сохранилось: ' + e.message); P.results = P.log; }
  P.busy = false;
  render(); window.scrollTo(0, 0);
}

function tick() {
  if (!P || P.results || P.mode !== 'timed') return;
  const s = P.screens[P.at];
  if (!isQ(s)) return;
  P.left--;
  if (P.left <= 0) { go(P.at + 1); return; }
  const t = document.querySelector('.xtime');
  if (t) { t.textContent = P.left; t.classList.toggle('warn', P.left <= 8); }
}

on('ls-play', () => { const s = P?.screens[P.at]; if (s && !isQ(s) && !P.played[s.it.id]) { P.audioErr = false; playOnce(s); } });
on('ls-opt', el => { const s = P.screens[P.at]; if (!isQ(s) || checked(s)) return; P.ans[qid(s.it, s.i)] = +el.dataset.k; render(); });
on('ls-check', check);
on('ls-next', () => { if (P.mode === 'timed') { go(P.at + 1); return; } if (P.at < P.screens.length - 1) go(P.at + 1); else finish(); });
on('ls-exit', () => P.mock ? modal(`<h2>Выйти из пробника?</h2><p class="mut" style="margin-bottom:14px">Пройденные части сохранены, но пробник придётся начать заново.</p>
  <a class="btn pri block" href="#/mock" data-act="ls-leave">Выйти</a><button class="btn ghost block" data-act="modal-close" style="margin-top:6px">Продолжить</button>`) : modal(`<h2>Выйти из тренировки?</h2><p class="mut" style="margin-bottom:14px">${P.mode === 'timed' ? 'Ответы этого подхода не сохранятся.' : 'Проверенные ответы уже сохранены.'}</p>
  <a class="btn pri block" href="#/train/L" data-act="modal-close">Выйти</a><button class="btn ghost block" data-act="modal-close" style="margin-top:6px">Продолжить</button>`));
on('ls-leave', () => { mockflow.quit(); closeModal(); });
on('ls-again', () => { start(P.task, P.mode, P.qtype, P.items.map(i => i.id), P.bank); });

async function start(task, mode, qtype, exclude = [], bank) {
  clearInterval(timer); stopAudio();
  const fl = task === 'mock' ? activeFlow() : null;
  const mock = fl ? { mock: fl.mock, part: new URLSearchParams(location.hash.split('?')[1] || '').get('part'), attempt: fl.attempt } : null;
  if (task === 'mock') mode = 'timed';
  const title = mock ? 'Listening · Module ' + (mock.part === 'L:M1' ? 1 : 2) : task === 'types' ? qtype : TASK[task].name;
  P = { task, mode, qtype, bank, mock, title, section: 'L', items: [], screens: [], at: 0, ans: {}, fb: {}, log: [], results: null, busy: false, played: {}, playing: false, left: 0 };
  document.getElementById('app').innerHTML = `<div class="exam"><div class="xbar"><div class="xb-l"><span class="xsec">${esc(title)}</span></div></div><div class="xres-in"><div class="skel"></div></div></div>`;
  try {
    const { items, screens } = await load(task, mode, qtype, exclude, bank, mock);
    Object.assign(P, { items, screens });
    if (screens.length) {
      const a = mock ? { id: mock.attempt } : await src.practiceStart({ mode: mode === 'mistakes' ? 'mistakes' : mode, section: 'L', task: task === 'types' || task === 'mistakes' ? null : task });
      P.attemptId = a.id;
      if (mode === 'timed') { P.left = secFor(screens[0]); timer = setInterval(tick, 1000); }
    }
  } catch (e) { toast(e.message); }
  render();
  const f = P?.screens[0];
  if (f && P.mode === 'timed' && !isQ(f)) playOnce(f, true);
}

export default function listen(params) {
  const task = TASK[params[0]] ? params[0] : 'lcr';
  const qs = new URLSearchParams(location.hash.split('?')[1] || '');
  const mode = task === 'mistakes' ? 'mistakes' : ['learn', 'timed', 'mistakes'].includes(qs.get('mode')) ? qs.get('mode') : 'learn';
  return {
    exam: true, title: TASK[task].name,
    mount() { start(task, mode, qs.get('type'), [], qs.get('bank') === 'test' ? 'test' : undefined); },
    unmount() { clearInterval(timer); stopAudio(); P = null; },
    keys(e) {
      if (!P || P.results || document.querySelector('.scrim')) return;
      const s = P.screens[P.at];
      if (!s || e.target.closest?.('input,textarea,audio')) return;
      if (/^[1-4]$/.test(e.key) && isQ(s) && !checked(s)) { P.ans[qid(s.it, s.i)] = +e.key - 1; render(); }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (P.mode === 'timed') { if (isQ(s)) go(P.at + 1); return; }
        if (!isQ(s) || checked(s)) document.querySelector('[data-act="ls-next"]')?.click(); else check();
      }
    }
  };
}

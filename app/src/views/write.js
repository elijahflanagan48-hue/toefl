// Write an Email (7 min) and Write for an Academic Discussion (10 min).
// Exam shell: prompt on the left, plain editor on the right (no spellcheck / autocorrect, as on the test),
// Cut / Paste / Undo / Redo, word count, Hide Time. Timed mode submits automatically when time runs out.
// "Учиться" mode has no countdown and shows a short strategy card. Work goes to the teacher's review queue.
import * as src from '../data/source.js';
import { ic } from '../lib/icons.js';
import { esc, mmss } from '../lib/util.js';
import { on, modal, closeModal, toast } from '../lib/ui.js';
import { pref } from '../lib/store.js';
import { isLive } from '../lib/api.js';
import { WTASK, countWords, promptBlock } from '../lib/writing.js';

const TIPS = {
  eml: ['Первая фраза — зачем вы пишете.', 'По 1–3 предложения на каждый из трёх пунктов, в том же порядке.', 'Вежливые формулы по ситуации: Could you…?, I would appreciate it if…, I was wondering whether…', 'Завершение и подпись: Thank you for your help. Best regards, …', 'Ориентир — 100–150 слов. Последнюю минуту оставьте на проверку ошибок.'],
  dsc: ['В первом предложении — ваша позиция.', 'Добавьте новый довод: не пересказывайте посты студентов.', 'Поддержите мысль причиной и примером из жизни или учёбы.', 'Можно сослаться на однокурсника: I see Kelly\'s point, but…', 'Не меньше 100 слов, лучше 120–150. Без заученных вступлений «In today\'s world…».']
};

let W = null, timer = null;
const draftKey = () => 'wdraft.' + W.item.id;

async function load(task, exclude) {
  const r = await src.practiceItems({ section: 'W', task, limit: 1, exclude, level: null });
  return r.items[0] || null;
}

async function start(task, mode) {
  clearInterval(timer);
  W = { task, mode, item: null, text: '', left: WTASK[task].min * 60, used: 0, hideTime: false, hideWords: false, done: null, loading: true };
  render();
  try {
    const done = await src.myWritingItems().catch(() => []);
    W.item = await load(task, done);
    if (!W.item && done.length) W.item = await load(task, []); // everything done once — allow repeats
  } catch (e) { toast(e.message); }
  W.loading = false;
  if (W.item) W.text = pref.get(draftKey(), '') || '';
  render();
  timer = setInterval(tick, 1000);
}

function tick() {
  if (!W || W.done || !W.item) return;
  W.used++;
  if (W.mode === 'timed') {
    W.left--;
    if (W.left <= 0) { clearInterval(timer); submit(true); return; }
  }
  paintTime();
}
function paintTime() {
  const t = document.querySelector('.xtime');
  if (t) {
    const force = W.mode === 'timed' && W.left <= 60;
    t.textContent = W.hideTime && !force ? '' : mmss(W.mode === 'timed' ? W.left : W.used);
    t.classList.toggle('warn', force);
  }
}

function bar() {
  const force = W.mode === 'timed' && W.left <= 60;
  return `<div class="xbar">
    <div class="xb-l"><button class="xexit" data-act="w-exit" aria-label="Выйти">${ic('x', 18)}</button><span class="xsec">${esc(WTASK[W.task].name)}<span> · ${W.mode === 'timed' ? 'на время' : 'учиться'}</span></span></div>
    <div class="xb-c">${W.mode === 'timed' ? `<button class="xbtn link" data-act="w-hidetime">${W.hideTime && !force ? 'Show Time' : 'Hide Time'}</button>` : '<span class="xq-n">без ограничения</span>'}
      <span class="xtime ${force ? 'warn' : ''}">${W.hideTime && !force ? '' : mmss(W.mode === 'timed' ? W.left : W.used)}</span></div>
    <div class="xb-r">${W.done ? '' : `<button class="xbtn pri" data-act="w-submit" ${W.item ? '' : 'disabled'}><span>Отправить</span>${ic('check', 17)}</button>`}</div></div>`;
}

function editor() {
  const isE = W.task === 'eml', p = W.item.body, n = countWords(W.text);
  return `<div class="wtools">
      <button class="wtb" data-act="w-cmd" data-c="cut">Cut</button><button class="wtb" data-act="w-cmd" data-c="paste">Paste</button>
      <button class="wtb" data-act="w-cmd" data-c="undo">Undo</button><button class="wtb" data-act="w-cmd" data-c="redo">Redo</button>
      <span class="wcount" ${W.hideWords ? 'hidden' : ''}>Word Count: <b id="wc">${n}</b></span>
      <button class="xbtn link dark" data-act="w-hidewords">${W.hideWords ? 'Show Word Count' : 'Hide Word Count'}</button></div>
    ${isE ? `<div class="wmail"><div><span>To:</span> ${esc(p.to)}</div><div><span>Subject:</span> ${esc(p.subject)}</div></div>` : ''}
    <textarea id="wtext" class="wtext ${isE ? 'mail' : ''}" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off" data-gramm="false"
      aria-label="Ваш ответ" placeholder="${isE ? 'Dear …,' : 'Type your response here.'}">${esc(W.text)}</textarea>
    ${W.task === 'dsc' ? `<p class="wmin ${n >= 100 ? 'ok' : ''}" id="wmin">${n >= 100 ? 'Есть 100 слов' : `До 100 слов: ${100 - n}`}</p>` : ''}`;
}

function render() {
  const root = document.getElementById('app');
  if (!W) return;
  if (W.loading) { root.innerHTML = `<div class="exam">${bar()}<div class="xres-in"><div class="skel"></div></div></div>`; return; }
  if (!W.item) {
    root.innerHTML = `<div class="exam">${bar()}<div class="xres-in"><div class="xres-hero"><div class="k">Заданий пока нет</div><p class="mut" style="margin-top:8px">Банк ${esc(WTASK[W.task].short)} пополняется.</p></div>
      <div class="xr-ft"><a class="btn pri" href="#/train/W">К тренировке</a></div></div></div>`;
    return;
  }
  if (W.done) return renderDone(root);
  const tips = W.mode !== 'timed' ? `<details class="wtips" open><summary>${ic('spark', 15)} Как построить ответ</summary><ul>${TIPS[W.task].map(t => `<li>${esc(t)}</li>`).join('')}</ul></details>` : '';
  root.innerHTML = `<div class="exam writing">${bar()}
    <div class="xbody two">
      <div class="xpane left">${promptBlock(W.task, W.item.body)}${tips}
        ${W.text ? '' : `<button class="lnk sm wother" data-act="w-other">${ic('repeat', 14)} Другое задание</button>`}</div>
      <div class="xpane right weditor">${editor()}</div>
    </div></div>`;
}

function renderDone(root) {
  const d = W.done;
  root.innerHTML = `<div class="exam xres"><div class="xbar"><div class="xb-l"><a class="xexit" href="#/train/W" aria-label="Закрыть">${ic('x', 18)}</a><span class="xsec">${esc(WTASK[W.task].name)}<span> · отправлено</span></span></div></div>
    <div class="xres-in">
      <div class="xres-hero"><div class="k">${d.auto ? 'Время вышло — работа отправлена автоматически' : 'Работа отправлена учителю'}</div>
        <div class="xr-n serif">${d.words}<small> слов</small></div>
        <p class="mut">${isLive() ? 'Оценка, критерии и комментарии к фрагментам появятся в «Прогрессе» после проверки.' : 'Демо-режим: в аккаунте работа ушла бы учителю на проверку.'}
        ${W.task === 'dsc' && d.words < 100 ? '<br><b>Меньше 100 слов</b> — на экзамене это снижает балл.' : ''}</p></div>
      <div class="card pad paper"><div class="mailbody wsent">${esc(d.text)}</div></div>
      <div class="xr-ft">${d.id ? `<a class="btn" href="#/work/${d.id}">Открыть работу</a>` : ''}<a class="btn" href="#/train/W">К тренировке</a><button class="btn pri" data-act="w-again">${ic('repeat', 17)} Ещё задание</button></div>
    </div></div>`;
}

async function submit(auto = false) {
  if (!W || W.done || W.sending) return;
  W.sending = true;
  const text = (document.getElementById('wtext')?.value ?? W.text).trim();
  W.text = text;
  clearInterval(timer);
  try {
    const r = text ? await src.submitWriting({ task: W.task, item_id: W.item.id, prompt: W.item.body, text, seconds: W.used }) : null;
    pref.set(draftKey(), null);
    W.done = { id: r?.id || null, words: countWords(text), text: text || '(пусто)', auto };
    closeModal(); render();
  } catch (e) {
    W.sending = false; toast(e.message);
    if (!auto) timer = setInterval(tick, 1000);
  }
}

on('w-cmd', async el => {
  const ta = document.getElementById('wtext'); if (!ta) return;
  ta.focus();
  const c = el.dataset.c;
  if (c === 'paste') {
    try { const t = await navigator.clipboard.readText(); document.execCommand('insertText', false, t); } catch (e) { toast('Вставка: Ctrl+V'); }
  } else document.execCommand(c);
  onInput({ target: ta });
});
on('w-hidetime', () => { W.hideTime = !W.hideTime; document.querySelector('[data-act="w-hidetime"]').textContent = W.hideTime ? 'Show Time' : 'Hide Time'; paintTime(); });
on('w-hidewords', el => { W.hideWords = !W.hideWords; document.querySelector('.wcount').hidden = W.hideWords; el.textContent = W.hideWords ? 'Show Word Count' : 'Hide Word Count'; });
on('w-other', async () => { const cur = W.item?.id; W.loading = true; render(); const done = await src.myWritingItems().catch(() => []); W.item = (await load(W.task, [...done, cur].filter(Boolean))) || W.item; W.loading = false; W.text = pref.get(draftKey(), '') || ''; render(); });
on('w-submit', () => {
  const n = countWords(document.getElementById('wtext')?.value || '');
  if (!n) { toast('Ответ пустой'); return; }
  modal(`<h2>Отправить учителю?</h2><p class="mut" style="margin-bottom:14px">${n} слов. После отправки текст изменить нельзя.${W.task === 'dsc' && n < 100 ? ' <b>Меньше 100 слов.</b>' : ''}</p>
    <div class="row-btns"><button class="btn" data-act="modal-close">Продолжить писать</button><button class="btn pri" data-act="w-confirm">Отправить</button></div>`);
});
on('w-confirm', () => submit(false));
on('w-again', () => start(W.task, W.mode));
on('w-exit', () => modal(`<h2>Выйти?</h2><p class="mut" style="margin-bottom:14px">Черновик сохранится на этом устройстве, но таймер начнётся заново.</p>
  <div class="row-btns"><button class="btn" data-act="modal-close">Остаться</button><a class="btn pri" href="#/train/W">Выйти</a></div>`));

function onInput(e) {
  if (!W || e.target.id !== 'wtext') return;
  W.text = e.target.value;
  try { pref.set(draftKey(), W.text); } catch (err) { /* storage full or blocked */ }
  const n = countWords(W.text);
  const wc = document.getElementById('wc'); if (wc) wc.textContent = n;
  const wm = document.getElementById('wmin'); if (wm) { wm.textContent = n >= 100 ? 'Есть 100 слов' : `До 100 слов: ${100 - n}`; wm.classList.toggle('ok', n >= 100); }
  const other = document.querySelector('.wother'); if (other && W.text) other.remove();
}

export default function write(params) {
  const task = WTASK[params[0]] ? params[0] : 'eml';
  const qs = new URLSearchParams(location.hash.split('?')[1] || '');
  const mode = qs.get('mode') === 'learn' ? 'learn' : 'timed';
  return {
    exam: true, title: WTASK[task].name,
    mount() { start(task, mode); document.addEventListener('input', onInput); },
    unmount() { clearInterval(timer); document.removeEventListener('input', onInput); W = null; },
    keys(e) { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && W && !W.done) { e.preventDefault(); document.querySelector('[data-act="w-submit"]')?.click(); } }
  };
}

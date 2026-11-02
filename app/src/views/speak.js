// Listen and Repeat (7 sentences, 8/10/12 s each) and Take an Interview (4 questions, 45 s each).
// Exam rules (TOEFL iBT 2026): one attempt per part, no pause, no going back, recording starts right after the beep.
// Prompts are spoken by the browser's voice until recorded audio is added to the items. Answers go to the teacher.
import * as src from '../data/source.js';
import { ic } from '../lib/icons.js';
import { esc } from '../lib/util.js';
import { on, modal, closeModal, toast } from '../lib/ui.js';
import { isLive } from '../lib/api.js';
import * as rec from '../lib/rec.js';
import { activeFlow } from '../lib/mockstate.js';
import * as mockflow from '../lib/mockflow.js';

const NAME = { lrp: 'Listen and Repeat', int: 'Take an Interview' };
const LRP_LIMIT = [8, 8, 10, 10, 10, 12, 12];
const limitFor = (task, k) => (task === 'lrp' ? LRP_LIMIT[k] : 45);

let S = null, run = 0, cleanup = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
const alive = tok => S && tok === run;

const lines = () => (S.task === 'lrp' ? S.item.body.sentences : S.item.body.questions);

async function load(exclude) {
  const f = activeFlow();
  if (f) return (await src.mockPart(f.mock, 'S:' + S.task))[0] || null; // full mock test: fixed item
  const r = await src.practiceItems({ section: 'S', task: S.task, limit: 1, exclude, level: null });
  return r.items[0] || null;
}

async function start(task, mode) {
  cleanupAll();
  run++;
  S = { task, mode, item: null, phase: 'loading', k: 0, parts: [], subId: null, chain: Promise.resolve(), err: '' };
  render();
  try {
    const done = await src.mySpeakingItems().catch(() => []);
    S.item = await load(done);
    if (!S.item && done.length) S.item = await load([]);
  } catch (e) { toast(e.message); }
  S.phase = S.item ? 'mic' : 'empty';
  render();
}

function cleanupAll() {
  cleanup.forEach(f => { try { f(); } catch (e) {} }); cleanup = [];
  rec.stopSpeak();
}

/* ------------------------------------------------------------------ rendering */
const bar = (tail = '') => `<div class="xbar"><div class="xb-l"><button class="xexit" data-act="s-exit" aria-label="Выйти">${ic('x', 18)}</button>
  <span class="xsec">${NAME[S.task]}<span> · ${S.mode === 'timed' ? 'как на экзамене' : 'учиться'}</span></span></div>
  <div class="xb-c">${tail}</div><div class="xb-r"></div></div>`;
const progress = () => {
  const n = lines().length;
  return `<div class="spk-prog" aria-label="Ответ ${S.k + 1} из ${n}">${Array.from({ length: n }, (_, i) => `<i class="${i < S.k ? 'ok' : i === S.k ? 'on' : ''}"></i>`).join('')}</div>`;
};
const show = html => { document.getElementById('app').innerHTML = `<div class="exam speaking">${bar(S.phase === 'rec' ? '<span class="xq-n">идёт запись</span>' : '')}<div class="spk">${html}</div></div>`; };

function render() {
  if (!S) return;
  const it = S.item, ph = S.phase;
  if (ph === 'loading') return show(`<div class="skel"></div>`);
  if (ph === 'empty') return show(`<div class="spk-card"><h2>Заданий пока нет</h2><p>Банк Speaking пополняется.</p><div class="spk-btns"><a class="btn pri" href="#/train/S">К тренировке</a></div></div>`);
  if (ph === 'mic') return show(`<div class="spk-card"><div class="spk-ic">${ic('mic', 30)}</div><h2>Проверка микрофона</h2>
    <p>${rec.supported() ? 'Нажмите «Включить» и скажите вслух несколько слов — полоска ниже должна двигаться. Лучше в наушниках, в тишине.' : 'Этот браузер не умеет записывать звук. Откройте приложение в Chrome, Edge, Safari или Firefox.'}</p>
    <div class="lvl" aria-hidden="true"><i id="lvl"></i></div><div class="spk-hint" id="lvlmsg">${S.micOk ? 'Микрофон включён' : ''}</div>
    ${S.err ? `<p class="spk-err" role="alert">${esc(S.err)}</p>` : ''}
    <div class="spk-btns">${S.micOk ? `<button class="btn pri" data-act="s-go">Продолжить</button>` : rec.supported() ? `<button class="btn pri" data-act="s-mic">Включить микрофон</button>` : ''}<a class="btn" href="#/train/S">Отмена</a></div></div>`);
  if (ph === 'intro') return show(`<div class="spk-card"><div class="spk-ic">${ic(S.task === 'lrp' ? 'volume' : 'users', 30)}</div><h2>${esc(it.body.title)}</h2>
    <p class="big">${esc(it.body.scenario)}</p>
    <p>${S.task === 'lrp' ? 'Вы услышите 7 предложений. После каждого — короткая пауза и сигнал: повторите предложение так точно, как можете. Каждое предложение звучит один раз.'
      : 'Вам зададут 4 вопроса. После каждого раздастся сигнал, и сразу начнётся запись — 45 секунд. Времени на подготовку нет.'}</p>
    <div class="spk-btns"><button class="btn pri" data-act="s-start">Начать</button></div>
    <p class="spk-hint">Включите звук: задания озвучены диктором.</p></div>`);
  if (ph === 'narr') return show(`<div class="spk-card"><div class="spk-ic say">${ic('volume', 30)}</div><h2>Слушайте</h2><p class="big">${esc(it.body.scenario)}</p></div>`);
  if (ph === 'listen' || ph === 'gap' || ph === 'rec') {
    const text = lines()[S.k], n = lines().length, lim = limitFor(S.task, S.k);
    // Listen and Repeat is a listening task: the sentence is never shown while it is being said or recorded (it appears in the results).
    const showText = S.task === 'int' && S.mode !== 'timed';
    const head = ph === 'listen' ? `<div class="spk-ic say">${ic('volume', 30)}</div><h2>Слушайте</h2>` : ph === 'gap' ? `<div class="spk-ic">${ic('mic', 30)}</div><h2>Приготовьтесь</h2>`
      : `<div class="spk-ic rec">${ic('mic', 30)}</div><h2>Говорите</h2>`;
    return show(`${progress()}<div class="spk-card">${head}
      <p>${S.task === 'lrp' ? 'Предложение' : 'Вопрос'} ${S.k + 1} из ${n}${ph === 'rec' ? ` · ${lim} с` : ''}</p>
      ${showText ? `<div class="spk-sub" lang="en">${esc(text)}</div>` : ''}
      ${ph === 'rec' ? `<div class="lvl" aria-hidden="true"><i id="lvl"></i></div><div class="tbar" role="progressbar" aria-label="Время ответа"><i id="tb"></i></div><div class="spk-hint"><span id="tl">${lim}</span> с</div>
        ${S.mode !== 'timed' ? `<div class="spk-btns"><button class="btn" data-act="s-stop">Готово</button></div>` : ''}` : ''}
      </div>`);
  }
  if (ph === 'send') return show(`<div class="spk-card"><div class="spk-ic">${ic('upload', 30)}</div><h2>${S.err ? 'Не всё загрузилось' : 'Отправляем ответы…'}</h2>
    <p>${S.err ? esc(S.err) : 'Не закрывайте страницу.'}</p>${S.err ? `<div class="spk-btns"><button class="btn pri" data-act="s-retry">Повторить</button></div>` : '<div class="skel" style="height:8px;margin-top:14px"></div>'}</div>`);
  if (ph === 'done') {
    const live = isLive();
    return show(`<div class="spk-card"><div class="spk-ic">${ic('check', 30)}</div><h2>${live ? 'Ответы отправлены учителю' : 'Готово'}</h2>
      <p>${live ? 'Оценка и комментарии появятся в «Прогрессе» после проверки.' : 'Демо-режим: в аккаунте записи ушли бы учителю на проверку.'}</p>
      <div class="spk-list">${S.parts.map((p, i) => `<div class="it"><b>${i + 1}. ${esc(lines()[i])}</b>${p?.url ? `<audio controls preload="none" src="${p.url}"></audio>` : '<span class="fade">нет записи</span>'}</div>`).join('')}</div>
      <div class="spk-btns">${S.subId ? `<a class="btn" href="#/work/${S.subId}">Открыть работу</a>` : ''}<a class="btn" href="#/train/S">К тренировке</a><button class="btn pri" data-act="s-again">${ic('repeat', 17)} Ещё задание</button></div></div>`);
  }
}

/* ------------------------------------------------------------------ flow */
function bindMeter(st) {
  const stop = rec.meter(st, v => { const el = document.getElementById('lvl'); if (el) el.style.width = Math.round(v * 100) + '%'; if (v > 0.2 && S) S.heard = true; });
  cleanup.push(stop);
  return stop;
}

on('s-mic', async () => {
  try {
    S.err = ''; const st = await rec.getMic(); S.micOk = true; render();
    bindMeter(st);
    let t = 0; const iv = setInterval(() => { const m = document.getElementById('lvlmsg'); if (m) m.textContent = S?.heard ? '✓ Вас слышно' : 'Скажите что-нибудь вслух…'; if (++t > 600) clearInterval(iv); }, 300);
    cleanup.push(() => clearInterval(iv));
  } catch (e) { S.err = e.message; render(); }
});
on('s-go', () => { cleanupAll(); rec.releaseMic(); S.phase = 'intro'; render(); }); // the mic stays off while prompts play (iOS drops playback volume while it is open)
on('s-start', () => begin());

/** recorded voice (audio/S/SP-LR|INT-<level>-<nnn>-<k>.mp3, k=0 narrator intro); browser voice only when the file is missing */
const clipUrl = k => `audio/S/${S.item.id.replace('S-LRP-', 'SP-LR-').replace('S-INT-', 'SP-INT-')}-${k}.mp3`;
async function say(k, text, role, rate) {
  if (!S) return;
  const r = await rec.playClip(clipUrl(k));
  if (r !== 'error' || !S) return;
  await rec.speak(text, { role, rate });
}

async function begin() {
  const tok = ++run;
  rec.audioCtx(); // unlock audio inside the user gesture
  rec.preload(Array.from({ length: lines().length + 1 }, (_, k) => clipUrl(k))); // decode every clip of the task up front
  S.phase = 'narr'; render();
  await rec.warmUp(); // right after the mic check iOS is still switching its audio route: the first seconds come out as crackle
  if (!alive(tok)) return;
  await say(0, S.item.body.scenario, 'int', 0.95);
  if (!alive(tok)) return;
  await wait(600);
  for (let k = 0, n = lines().length; k < n; k++) {
    if (!alive(tok)) return;
    S.k = k;
    try { await runPart(tok); } catch (e) { if (!alive(tok)) return; S.err = e.message; S.phase = 'mic'; S.micOk = false; render(); return; }
  }
  if (!alive(tok)) return;
  S.phase = 'send'; S.err = ''; render();
  await finish(tok);
}

async function runPart(tok) {
  const k = S.k, text = lines()[k], lim = limitFor(S.task, k);
  S.phase = 'listen'; render();
  await say(k + 1, text, S.task === 'int' ? 'int' : 'lrp', S.task === 'lrp' ? 0.92 : 0.95);
  if (!alive(tok)) return;
  // switch the microphone on only now, during the pause
  const micP = rec.getMic().then(st => ({ st }), e => ({ e }));
  if (S.task === 'lrp') { S.phase = 'gap'; render(); await wait(2000); } else await wait(500);
  const m = await micP;
  if (!alive(tok)) { rec.releaseMic(); return; }
  if (m.e) throw m.e;
  S.stream = m.st;
  await rec.beep();
  if (!alive(tok)) return;
  const r = rec.recorder(S.stream);
  S.phase = 'rec'; S.stop = null; render();
  r.start();
  const stopMeter = bindMeter(S.stream);
  const t0 = performance.now();
  await new Promise(res => {
    const iv = setInterval(() => {
      const el = (performance.now() - t0) / 1000;
      const tb = document.getElementById('tb'), tl = document.getElementById('tl');
      if (tb) tb.style.width = Math.min(100, el / lim * 100) + '%';
      if (tl) tl.textContent = Math.max(0, Math.ceil(lim - el));
      if (el >= lim || !alive(tok)) { clearInterval(iv); res(); }
    }, 100);
    S.stop = () => { clearInterval(iv); res(); };
    cleanup.push(() => clearInterval(iv));
  });
  stopMeter();
  const out = await r.stop();
  rec.releaseMic(); S.stream = null;
  if (!alive(tok)) return;
  if (out.blob.size < 300) { S.parts[k] = { empty: true, up: 'ok' }; return; } // stopped before any sound was captured
  S.parts[k] = { ...out, url: URL.createObjectURL(out.blob), up: 'idle' };
  queueUpload(k);
}
on('s-stop', () => S?.stop?.());

/* uploads run in the background while the next prompt plays */
const linesOf = s => (s.task === 'lrp' ? s.item.body.sentences : s.item.body.questions);
function ensureSub(s) {
  if (s.subId || !isLive()) return Promise.resolve(s.subId);
  s.subP ||= src.createSpeaking({ task: s.task, item_id: s.item.id, prompt: { title: s.item.body.title, scenario: s.item.body.scenario, questions: linesOf(s) }, parts: linesOf(s).length })
    .then(r => (s.subId = r.id)).catch(e => { s.subP = null; throw e; });
  return s.subP;
}
function queueUpload(k) {
  const s = S; // the session at the time of recording
  s.chain = s.chain.then(async () => {
    const p = s.parts[k]; if (!p || p.up === 'ok') return;
    try { p.up = 'busy'; const id = await ensureSub(s); await src.uploadAudio(id, k, p.blob, p.ms); p.up = 'ok'; }
    catch (e) { p.up = 'err'; p.msg = e.message; }
  });
}

async function finish(tok) {
  await S.chain;
  if (!alive(tok)) return;
  if (!S.parts.some(p => p && !p.empty)) { S.err = 'Не записано ни одного ответа. Проверьте микрофон и попробуйте ещё раз.'; S.phase = 'send'; render(); return; }
  const bad = S.parts.map((p, i) => [p, i]).filter(([p]) => p && p.up !== 'ok');
  if (bad.length) { S.err = `Не удалось загрузить ответов: ${bad.length}. ${bad[0][0].msg || 'Проверьте интернет'}. Записи сохранены на этом устройстве — повторите.`; S.phase = 'send'; render(); return; }
  try { await src.submitSpeaking(S.subId); }
  catch (e) { S.err = e.message; S.phase = 'send'; render(); return; }
  rec.releaseMic();
  if (activeFlow()) { mockflow.advance(); return; }
  S.phase = 'done'; render();
}
on('s-retry', () => {
  const tok = run; S.err = ''; render();
  S.parts.forEach((p, i) => { if (p && p.up !== 'ok') { p.up = 'idle'; queueUpload(i); } });
  finish(tok);
});
on('s-again', () => start(S.task, S.mode));
on('s-exit', () => {
  if (activeFlow()) { modal(`<h2>Выйти из пробника?</h2><p class="mut" style="margin-bottom:14px">Пройденные части сохранены, но пробник придётся начать заново.</p>
    <div class="row-btns"><button class="btn" data-act="modal-close">Остаться</button><a class="btn pri" href="#/mock" data-act="s-leave">Выйти</a></div>`); return; }
  if (!S || S.phase === 'mic' || S.phase === 'intro' || S.phase === 'done' || S.phase === 'empty') { location.hash = '#/train/S'; return; }
  modal(`<h2>Выйти из задания?</h2><p class="mut" style="margin-bottom:14px">Записанные ответы не будут отправлены учителю.</p>
    <div class="row-btns"><button class="btn" data-act="modal-close">Остаться</button><a class="btn pri" href="#/train/S" data-act="s-leave">Выйти</a></div>`);
});
// navigate explicitly: Safari drops the link's own navigation when the modal is removed inside the click handler
on('s-leave', () => { const inMock = !!activeFlow(); mockflow.quit(); closeModal(); cleanupAll(); location.hash = inMock ? '#/mock' : '#/train/S'; });

export default function speak(params) {
  const task = NAME[params[0]] ? params[0] : 'int';
  const qs = new URLSearchParams(location.hash.split('?')[1] || '');
  const mode = qs.get('mode') === 'timed' ? 'timed' : 'learn';
  return {
    exam: true, title: NAME[task],
    mount() { start(task, mode); },
    unmount() { run++; cleanupAll(); rec.releaseMic(); S?.parts.forEach(p => p?.url && URL.revokeObjectURL(p.url)); S = null; }
  };
}

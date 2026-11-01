import { catalog, me } from '../data/mock.js';
import * as src from '../data/source.js';
import { ic } from '../lib/icons.js';
import { band, SEC } from '../lib/util.js';
import { hdr, on, toast } from '../lib/ui.js';
import { pref } from '../lib/store.js';
import { isLive, session } from '../lib/api.js';

const MODES = [['learn', 'Учиться', 'Ответ проверяется сразу, с разбором на русском'], ['timed', 'На время', 'Таймер и правила экзамена, разбор в конце'], ['mistakes', 'Мои ошибки', 'Повтор вопросов, в которых была ошибка, пока не ответишь верно']];
const READY = { ctw: true, rdl: true, rap: true, bas: true, eml: true, dsc: true, lrp: true, int: true, lcr: true, lco: true, lan: true, lat: true }; // tasks with a working trainer
const WRITE = { eml: true, dsc: true, lrp: true, int: true }; // teacher-graded writing: own editor, no mistakes mode

on('train-mode', el => { pref.set('trainMode', el.dataset.v); window.dispatchEvent(new Event('hashchange')); });
on('start-task', el => toast(el.dataset.soon ? 'Откроется после озвучки' : 'Тренажёр «' + el.dataset.nm + '» появится на этапе ' + el.dataset.stage));

function taskCard(k, t, st, mode, mist) {
  const stage = { R: 'P3–P4', W: 'P5–P6', S: 'P7', L: 'P12' }[k];
  const ready = READY[t.id];
  const s = st?.tasks?.[t.id], done = st?.done?.[t.id] || 0, inBank = st?.bank?.[t.id];
  let stat;
  if (WRITE[t.id] && isLive()) stat = `<div class="tc-stat"><span>Оценка</span><b class="fade" style="font-size:14px">ставит учитель, 0–5</b></div>`;
  else if (t.scripts != null) stat = `<div class="tc-stat"><span>Скрипты для озвучки</span><b class="serif">${t.scripts}</b></div>`;
  else if (isLive() && s) stat = `<div class="tc-stat"><span>Точность</span><b class="serif">${s.acc}%</b></div><div class="bar c${k}"><i style="width:${s.acc}%"></i></div>`;
  else if (isLive()) stat = `<div class="tc-stat"><span>Точность</span><b class="fade" style="font-size:14px">после первых ответов</b></div>`;
  else if (t.acc != null) stat = `<div class="tc-stat"><span>Точность</span><b class="serif">${t.acc}%</b></div><div class="bar c${k}"><i style="width:${t.acc}%"></i></div>`;
  else if (t.score != null) stat = `<div class="tc-stat"><span>Средний балл учителя</span><b class="serif">${band(t.score)}<small> / 5</small></b></div><div class="bar c${k}"><i style="width:${t.score / 5 * 100}%"></i></div>`;
  const meta = WRITE[t.id] && isLive() ? `${inBank ? inBank + ' заданий · ' : ''}${t.time}` : t.scripts != null ? 'ждёт озвучки' : isLive() && inBank != null ? `${done} из ${inBank} · ${t.time}` : isLive() ? t.time : `${t.done} из ${t.n} · ${t.time}`;
  const href = k === 'L' ? `#/listen/${t.id}?mode=${mode === 'timed' ? 'timed' : 'learn'}` : t.id === 'lrp' || t.id === 'int' ? `#/speak/${t.id}?mode=${mode === 'timed' ? 'timed' : 'learn'}` : WRITE[t.id] ? `#/write/${t.id}?mode=${mode === 'learn' ? 'learn' : 'timed'}` : `#/practice/${t.id}?mode=${mode}`;
  const btn = t.scripts != null ? `<button class="btn sm" data-act="start-task" data-soon="1">${ic('lock', 16)} Скоро</button>`
    : ready && WRITE[t.id] && mode === 'mistakes' ? `<span class="chip">проверяет учитель</span>`
    : ready ? (mode === 'mistakes' && isLive() && !mist ? `<span class="chip ok">ошибок нет</span>` : `<a class="btn sm pri" href="${href}">${mode === 'mistakes' ? `Повторить${mist ? ' · ' + mist : ''}` : 'Начать'}</a>`)
      : `<button class="btn sm pri" data-act="start-task" data-nm="${t.nm}" data-stage="${stage}">Начать</button>`;
  return `<article class="tc c${k} ${t.scripts != null ? 'soon' : ''}">
    <div class="tc-hd"><span class="sq">${ic(SEC[k].ic, 19)}</span><span class="cefr">${t.cefr}</span></div>
    <h3>${t.nm}</h3><p class="mut">${t.ru}</p>
    ${stat || ''}
    <div class="tc-ft"><span class="fade">${meta}</span>${btn}</div>
    ${t.tts ? `<div class="tc-note">${ic('volume', 15)} Пока звучит синтезатор браузера — до записи озвучки</div>` : ''}
  </article>`;
}

export default async function train(params) {
  const k = SEC[params[0]] ? params[0] : 'R';
  const c = catalog[k], mode = MODES.some(m => m[0] === pref.get('trainMode', 'learn')) ? pref.get('trainMode', 'learn') : 'learn';
  let st = null, mist = null;
  const banked = true;
  if (banked && isLive()) {
    try { [st, mist] = await Promise.all([src.stats(k), src.mistakes(k)]); } catch (e) { /* show the page without stats */ }
  }
  const mistByTask = {};
  (mist?.items || []).forEach(x => { mistByTask[x.task] = (mistByTask[x.task] || 0) + x.qs.length; });

  const secList = Object.values(SEC).map(s => {
    const v = isLive() ? null : me.forecast[s.k], n = catalog[s.k].tasks.length;
    return `<a class="secpick c${s.k} ${s.k === k ? 'on' : ''}" href="#/train/${s.k}" aria-current="${s.k === k ? 'page' : 'false'}">
      <span class="sq">${ic(s.ic, 19)}</span>
      <span class="t"><b>${s.name}</b><span>${catalog[s.k].soon ? 'скоро' : n + ' задания'}</span></span>
      <span class="v serif">${v ? band(v) : '—'}</span></a>`;
  }).join('');

  const typeAcc = n => isLive() ? st?.types?.[n]?.acc ?? null : (c.types.find(t => t[0] === n) || [])[1];
  const types = c.types ? `<div class="lbl">Тренажёры по типам вопросов <b>${k === 'R' ? 'Daily Life и Academic Passage' : 'Conversation, Announcement, Talk'}</b></div>
    <div class="qtypes c${k}">${c.types.map(([n]) => {
      const a = typeAcc(n);
      return k === 'R' ? `<a class="qt" href="#/practice/types?type=${encodeURIComponent(n)}&mode=${mode === 'timed' ? 'timed' : 'learn'}"><span>${n}</span>${a != null ? `<b class="${a < 60 ? 'weak' : ''}">${a}%</b>` : ''}</a>`
        : `<a class="qt" href="#/listen/types?type=${encodeURIComponent(n)}&mode=${mode === 'timed' ? 'timed' : 'learn'}"><span>${n}</span>${a != null ? `<b class="${a < 60 ? 'weak' : ''}">${a}%</b>` : ''}</a>`;
    }).join('')}</div>` : '';

  const mistNote = banked && mode === 'mistakes' ? `<a class="note ${mist?.count ? '' : 'info'}" href="${k === 'L' ? '#/listen/mistakes?mode=mistakes' : `#/practice/mistakes?mode=mistakes&sec=${k}`}" style="margin-top:12px">${ic('repeat', 22)}<div class="t"><div class="nm">${isLive() ? (mist?.count ? `Ошибок к повтору: ${mist.count}` : 'Ошибок к повтору нет') : 'Повтор ошибок'}</div><div class="mt">Вопрос уходит из списка, когда отвечаешь на него верно</div></div>${ic('right', 20)}</a>` : '';

  return {
    title: 'Тренировка', wide: true,
    html: `${hdr('Тренировка')}
    <div class="g-train">
      <nav class="secrail" aria-label="Секции">${secList}</nav>
      <div class="trainmain c${k}">
        <div class="trainhead"><div><h2 class="serif">${SEC[k].name}</h2><p class="mut">${c.blurb}</p></div>
          ${c.soon ? '' : `<div class="seg modeseg" role="tablist">${MODES.map(([v, l]) => `<button class="${mode === v ? 'on' : ''}" data-act="train-mode" data-v="${v}" role="tab" aria-selected="${mode === v}">${l}</button>`).join('')}</div>`}</div>
        ${c.soon ? '' : `<p class="modehint fade">${ic('spark', 15)} ${MODES.find(m => m[0] === mode)[2]}</p>`}
        ${mistNote}
        <div class="tgrid">${c.tasks.map(t => taskCard(k, t, st, mode, mistByTask[t.id] || 0)).join('')}</div>
        ${k === 'L' && isLive() && session.user && session.user.role !== 'student' ? `<div class="lbl">Для учителя <b>тест-банк T1–T3</b></div>
          <div class="note info">${ic('lock', 22)}<div class="t"><div class="nm">Задания из тестов недоступны ученикам в тренировке</div><div class="mt">Попробуйте их сами: ${[['lcr', 'Choose a Response'], ['lco', 'Conversation'], ['lan', 'Announcement'], ['lat', 'Academic Talk']].map(([id, n]) => `<a href="#/listen/${id}?mode=${mode === 'timed' ? 'timed' : 'learn'}&bank=test"><b>${n}</b></a>`).join(' · ')}. Чтобы открыть задание ученикам, смените его статус в банке заданий.</div></div></div>` : ''}
        ${types}
        ${k === 'R' ? `<div class="lbl">Модуль целиком</div><a class="note" href="#/exam/reading">${ic('timer', 22)}<div class="t"><div class="nm">Модуль Reading в экзаменационной оболочке</div><div class="mt">Complete the Words → Daily Life → Academic Passage · 12 мин</div></div>${ic('right', 20)}</a>` : ''}
      </div>
    </div>`
  };
}

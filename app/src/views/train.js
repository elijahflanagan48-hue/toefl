import { catalog, me } from '../data/mock.js';
import { ic } from '../lib/icons.js';
import { band, SEC } from '../lib/util.js';
import { hdr, on, toast } from '../lib/ui.js';
import { pref } from '../lib/store.js';
import { isLive } from '../lib/api.js';

const MODES = [['learn', 'Учиться', 'Подсказки и разбор после каждого ответа'], ['timed', 'На время', 'Правила и таймер как на экзамене'], ['mist', 'Мои ошибки', 'Повтор ошибок с интервалами']];

on('train-mode', el => { pref.set('trainMode', el.dataset.v); window.dispatchEvent(new Event('hashchange')); });
on('start-task', el => toast(el.dataset.soon ? 'Откроется после озвучки' : 'Тренажёр «' + el.dataset.nm + '» появится на этапе ' + el.dataset.stage));

function taskCard(k, t) {
  const stage = { R: 'P3–P4', W: 'P5–P6', S: 'P7' }[k];
  const stat = isLive() && t.scripts == null ? `<div class="tc-stat"><span>Статистика</span><b class="fade" style="font-size:14px">после первых ответов</b></div>`
    : t.acc != null
    ? `<div class="tc-stat"><span>Точность</span><b class="serif">${t.acc}%</b></div><div class="bar c${k}"><i style="width:${t.acc}%"></i></div>`
    : t.score != null
      ? `<div class="tc-stat"><span>Средний балл учителя</span><b class="serif">${band(t.score)}<small> / 5</small></b></div><div class="bar c${k}"><i style="width:${t.score / 5 * 100}%"></i></div>`
      : `<div class="tc-stat"><span>Скрипты для озвучки</span><b class="serif">${t.scripts}</b></div>`;
  return `<article class="tc c${k} ${t.scripts != null ? 'soon' : ''}">
    <div class="tc-hd"><span class="sq">${ic(SEC[k].ic, 19)}</span><span class="cefr">${t.cefr}</span></div>
    <h3>${t.nm}</h3><p class="mut">${t.ru}</p>
    ${stat}
    <div class="tc-ft">
      <span class="fade">${t.scripts != null ? 'ждёт озвучки' : isLive() ? t.time : `${t.done} из ${t.n} · ${t.time}`}</span>
      <button class="btn sm ${t.scripts != null ? '' : 'pri'}" data-act="start-task" data-nm="${t.nm}" data-stage="${stage}" ${t.scripts != null ? 'data-soon="1"' : ''}>
        ${t.scripts != null ? ic('lock', 16) + ' Скоро' : 'Начать'}</button>
    </div>
    ${t.tts ? `<div class="tc-note">${ic('volume', 15)} Пока звучит синтезатор браузера — до записи озвучки</div>` : ''}
  </article>`;
}

export default function train(params) {
  const k = SEC[params[0]] ? params[0] : 'R';
  const c = catalog[k], mode = pref.get('trainMode', 'learn');

  const secList = Object.values(SEC).map(s => {
    const v = isLive() ? null : me.forecast[s.k], n = catalog[s.k].tasks.length;
    return `<a class="secpick c${s.k} ${s.k === k ? 'on' : ''}" href="#/train/${s.k}" aria-current="${s.k === k ? 'page' : 'false'}">
      <span class="sq">${ic(s.ic, 19)}</span>
      <span class="t"><b>${s.name}</b><span>${catalog[s.k].soon ? 'скоро' : n + ' задания'}</span></span>
      <span class="v serif">${v ? band(v) : '—'}</span></a>`;
  }).join('');

  const types = c.types ? `<div class="lbl">Тренажёры по типам вопросов <b>${k === 'R' ? 'Daily Life и Academic Passage' : 'Conversation, Announcement, Talk'}</b></div>
    <div class="qtypes c${k}">${c.types.map(([n, a]) => `<button class="qt" data-act="start-task" data-nm="${n}" data-stage="P4" ${a == null ? 'data-soon="1"' : ''}>
      <span>${n}</span>${a != null && !isLive() ? `<b class="${a < 60 ? 'weak' : ''}">${a}%</b>` : ''}</button>`).join('')}</div>` : '';

  return {
    title: 'Тренировка', wide: true,
    html: `${hdr('Тренировка')}
    <div class="g-train">
      <nav class="secrail" aria-label="Секции">${secList}</nav>
      <div class="trainmain c${k}">
        <div class="trainhead"><div><h2 class="serif">${SEC[k].name}</h2><p class="mut">${c.blurb}</p></div>
          ${c.soon ? '' : `<div class="seg modeseg" role="tablist">${MODES.map(([v, l]) => `<button class="${mode === v ? 'on' : ''}" data-act="train-mode" data-v="${v}" role="tab" aria-selected="${mode === v}">${l}</button>`).join('')}</div>`}</div>
        ${c.soon ? '' : `<p class="modehint fade">${ic('spark', 15)} ${MODES.find(m => m[0] === mode)[2]}</p>`}
        <div class="tgrid">${c.tasks.map(t => taskCard(k, t)).join('')}</div>
        ${types}
        ${k === 'R' ? `<div class="lbl">Модуль целиком</div><a class="note" href="#/exam/reading">${ic('timer', 22)}<div class="t"><div class="nm">Демо-модуль Reading в экзаменационной оболочке</div><div class="mt">Complete the Words → Daily Life → Academic Passage · 12 мин</div></div>${ic('right', 20)}</a>` : ''}
      </div>
    </div>`
  };
}

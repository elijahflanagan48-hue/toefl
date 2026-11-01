import * as src from '../data/source.js';
import { ic } from '../lib/icons.js';
import { band, cefr, overallBand, plural, SEC } from '../lib/util.js';
import { hdr } from '../lib/ui.js';

export function ladder(f, target) {
  const fr = v => ((v - 1) / 5).toFixed(4);
  return `<div class="ladder">
    <div class="ax">${[6, 5, 4, 3, 2, 1].map(n => `<span>${n}</span>`).join('')}</div>
    ${Object.values(SEC).map(s => {
      const v = f[s.k];
      return `<div class="lcol c${s.k}"><div class="plot"><div class="b ${v ? '' : 'na'}" style="--f:${v ? fr(v) : 0.55}">${v ? `<div class="v">${band(v)}</div>` : ''}</div></div>
        <div class="n">${s.k}${v ? '' : ' · —'}</div></div>`;
    }).join('')}
    <div class="goal" style="--f:${fr(target)}"><span>цель ${band(target)}</span></div>
  </div>`;
}

function streakNote(w, streak) {
  const t = w.find(x => x[2] === 'today');
  const min = t && t[1] ? Object.values(t[1]).reduce((a, b) => a + b, 0) : 0;
  if (min) return `Сегодня уже ${min} ${plural(min, 'минута', 'минуты', 'минут')} — серия продолжается`;
  return streak ? 'Позанимайся сегодня, чтобы не прервать серию' : 'Первое занятие запустит серию';
}

export function weekCard(w, streak, mins) {
  const max = 30;
  return `<div class="card pad week">
    <div class="hd"><span class="fl">${ic('flame', 20)}</span><div><div class="nm">${streak ? `${streak} ${plural(streak, 'день', 'дня', 'дней')} подряд` : 'Серия ещё не началась'}</div>
      <div class="mt">${streakNote(w, streak)}</div></div></div>
    <div class="days7">${w.map(([d, m, t]) => `<div class="d7 ${t === 'today' ? 'today' : ''} ${m === null ? 'fut' : ''}">
      <div class="col">${m ? Object.entries(m).map(([k, v]) => `<i class="c${k}" style="height:${Math.min(100, v / max * 100)}%"></i>`).join('') : ''}</div>${d}</div>`).join('')}</div>
    <div class="legend">${['R', 'W', 'S'].map(k => `<span class="c${k}"><i class="dot"></i>${SEC[k].name}</span>`).join('')}</div>
  </div>`;
}

export default async function today() {
  const me = await src.today();
  const f = me.forecast, ov = overallBand(Object.values(f));
  const days = me.examDate ? Math.max(0, Math.ceil((new Date(me.examDate) - new Date(new Date().toDateString())) / 864e5)) : null;
  const left = me.plan.reduce((a, p) => a + (p.done ? 0 : p.min), 0);

  const hero = `<section class="hero today-hero on-hero">
    <div class="th-top">
      ${days != null ? `<div><div class="k">До экзамена</div>
        <div class="days"><span class="serif">${days}</span><small>${plural(days, 'день', 'дня', 'дней')} · ${me.examLabel}</small></div></div>`
        : `<a href="#/profile" class="nodate"><div class="k">Дата экзамена</div><b class="serif">Указать</b></a>`}
      <div class="goalbox"><div class="k">Цель</div><b class="serif">${band(me.target)}</b></div>
    </div>
    ${ladder(f, me.target)}
    <div class="hfoot">${ov != null ? `<span class="pillv">прогноз <b class="serif">${band(ov)}</b> ${cefr(ov)}</span>
      <span class="gap">${ov >= me.target ? '<b>цель достигнута</b>' : `до цели <b>+${band(me.target - ov)}</b>`}</span>`
      : '<span>Прогноз появится после первого модуля или проверенной работы</span>'}</div>
  </section>`;

  const route = `<div class="lbl">Маршрут на сегодня <b>${me.plan.length} шага · осталось ${left} мин</b></div>
    <div class="route">${me.plan.map(p => `<a class="step c${p.k} ${p.done ? 'done' : ''}" href="${p.to}">
      <span class="sq">${ic(SEC[p.k].ic, 19)}</span>
      <div class="t"><div class="nm">${p.nm}</div><div class="mt">${p.mt} · ${p.min} мин</div></div>
      <span class="go">${p.done ? 'готово' : 'Начать'}</span></a>`).join('')}</div>`;

  const tasks = !me.tasks.length ? '' : `<div class="lbl">От учителя <b>${me.tasks.length}</b></div>
    ${me.tasks.map((t, i) => `<a class="note" href="${t.to}" style="margin-bottom:8px">${ic('clip', 22)}<div class="t"><div class="nm">${t.nm}</div><div class="mt">${t.mt} · ${t.due}</div></div>${ic('right', 20)}</a>`).join('')}`;

  return {
    title: 'Сегодня', wide: true,
    html: `${hdr('Привет, ' + me.name, { right: `<button class="ic" data-act="notif" aria-label="Уведомления">${ic('bell', 21)}<span class="badge"></span></button>` })}
      <div class="g-today">
        <div class="col-a">${hero}<div class="lbl">Эта неделя <b>${me.weekMin} мин</b></div>${weekCard(me.week, me.streak, me.weekMin)}</div>
        <div class="col-b">${route}${tasks}
          <div class="lbl">Быстрый старт</div>
          <div class="quick">${Object.values(SEC).map(s => `<a class="qk c${s.k}" href="#/train/${s.k}"><span class="sq">${ic(s.ic, 19)}</span><span>${s.name}</span></a>`).join('')}</div>
        </div>
      </div>`
  };
}

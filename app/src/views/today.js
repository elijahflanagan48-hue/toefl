import * as src from '../data/source.js';
import { ic } from '../lib/icons.js';
import { band, cefr, fullBand, secCount, plural, SEC, esc } from '../lib/util.js';
import { hdr } from '../lib/ui.js';
import { pref } from '../lib/store.js';

/** readiness ring: four arcs (R L W S) filled by each section's forecast on the 1–6 scale; days to the exam in the centre */
function ring(f, days) {
  const r = 64, c = 2 * Math.PI * r, seg = c / 4, gap = 11, full = seg - gap;
  const arcs = ['R', 'L', 'W', 'S'].map((k, i) => {
    const off = (-i * seg).toFixed(1), v = f[k];
    return `<circle class="trk" cx="80" cy="80" r="${r}" stroke-dasharray="${full.toFixed(1)} ${c.toFixed(1)}" stroke-dashoffset="${off}"/>`
      + (v ? `<circle class="arc c${k}" cx="80" cy="80" r="${r}" stroke-dasharray="${(full * Math.min(1, v / 6)).toFixed(1)} ${c.toFixed(1)}" stroke-dashoffset="${off}"/>` : '');
  }).join('');
  const mid = days != null ? `<b class="serif">${days}</b><span>${plural(days, 'день', 'дня', 'дней')} до экзамена</span>`
    : `<a href="#/profile" class="nodate2"><b class="serif">?</b><span>указать дату экзамена</span></a>`;
  return `<div class="rring"><svg viewBox="0 0 160 160" aria-hidden="true"><g transform="rotate(-86 80 80)">${arcs}</g></svg><div class="mid">${mid}</div></div>`;
}

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
    <div class="legend">${['R', 'L', 'W', 'S'].map(k => `<span class="c${k}"><i class="dot"></i>${SEC[k].name}</span>`).join('')}</div>
  </div>`;
}

export default async function today() {
  const me = await src.today();
  const f = me.forecast, ov = fullBand(f), nSec = secCount(f);
  const days = me.examDate ? Math.max(0, Math.ceil((new Date(me.examDate) - new Date(new Date().toDateString())) / 864e5)) : null;
  const left = me.plan.reduce((a, p) => a + (p.done ? 0 : p.min), 0);

  const missing = ['R', 'L', 'W', 'S'].filter(k => f[k] == null).map(k => SEC[k].name);
  const status = ov != null
    ? `<b class="rt">Общий прогноз <span class="serif">${band(ov)}</span> · ${cefr(ov)}</b><span class="rs">${ov >= me.target ? `Цель <b>${band(me.target)}</b> достигнута — держим уровень.` : `До цели <b>${band(me.target)}</b> осталось <b>+${band(me.target - ov)}</b>.`}</span>`
    : nSec ? `<b class="rt">${nSec} из 4 секций</b><span class="rs">Нет прогноза: ${missing.join(', ')} — пройдите ${missing.length > 1 ? 'их' : 'её'}, и появится общий балл. Цель <b>${band(me.target)}</b></span>`
    : `<b class="rt">Пока без прогноза</b><span class="rs">Он появится после первого модуля или проверенной работы. Цель <b>${band(me.target)}</b></span>`;
  const hero = `<section class="hero today-hero on-hero">
    <div class="rd">${ring(f, days)}<div class="rtx"><div class="k">Готовность${days != null && me.examLabel ? ` · экзамен ${me.examLabel}` : ''}</div>${status}</div></div>
    <div class="rchips">${['R', 'L', 'W', 'S'].map(k => `<div class="c${k}"><span><i class="dot"></i>${SEC[k].name}</span><b class="serif ${f[k] == null ? 'na' : ''}">${f[k] == null ? '—' : band(f[k])}</b></div>`).join('')}</div>
  </section>`;

  const route = `<div class="lbl">Маршрут на сегодня <b>${me.plan.length} шага · осталось ${left} мин</b></div>
    <div class="route">${me.plan.map(p => `<a class="step c${p.k} ${p.done ? 'done' : ''}" href="${p.to}">
      <span class="sq">${ic(SEC[p.k].ic, 19)}</span>
      <div class="t"><div class="nm">${p.nm}</div><div class="mt">${p.mt} · ${p.min} мин</div></div>
      <span class="go">${p.done ? 'готово' : 'Начать'}</span></a>`).join('')}</div>`;

  const mocksDue = me.tasks.filter(t => t.mock), other = me.tasks.filter(t => !t.mock);
  const mockCard = mocksDue.map(t => `<a class="mockdue on-hero" href="${t.to}">${ic('timer', 24)}<div class="t"><div class="k">Учитель назначил пробник</div><div class="nm">${esc(t.nm)}</div><div class="mt">Reading → Listening → Writing → Speaking · ${t.due}</div></div><span class="btn gold sm">${ic('play', 16)} Открыть</span></a>`).join('');
  const tasks = !other.length ? '' : `<div class="lbl">От учителя <b>${other.length}</b></div>
    ${other.map(t => `<a class="note" href="${t.to}" style="margin-bottom:8px">${ic('clip', 22)}<div class="t"><div class="nm">${esc(t.nm)}</div><div class="mt">${t.mt} · ${t.due}</div></div>${ic('right', 20)}</a>`).join('')}`;

  // bell: dot only when the teacher has checked a work the student has not opened yet; tap opens that work
  const graded = me.graded || [];
  let seen = pref.get('seenGraded', null);
  if (seen == null) { seen = graded.map(g => g.id); pref.set('seenGraded', seen); }
  const fresh = graded.filter(g => !seen.includes(g.id));
  const bell = `<a class="ic" href="${fresh.length ? '#/work/' + fresh[0].id : '#/progress'}" aria-label="${fresh.length ? 'Новая оценка учителя' : 'Мои работы'}" title="${fresh.length ? `Учитель проверил: ${esc(fresh[0].nm)}` : 'Мои работы'}">${ic('bell', 21)}${fresh.length ? '<span class="badge"></span>' : ''}</a>`;

  return {
    title: 'Сегодня', wide: true,
    html: `${hdr('Привет, ' + me.name, { right: bell })}
      <div class="g-today">
        <div class="col-a"><div class="tb tb-hero">${hero}</div><div class="tb tb-week"><div class="lbl">Эта неделя <b>${me.weekMin} мин</b></div>${weekCard(me.week, me.streak, me.weekMin)}</div></div>
        <div class="col-b">${mockCard ? `<div class="tb tb-mock">${mockCard}</div>` : ''}<div class="tb tb-route">${route}</div>${tasks ? `<div class="tb tb-tasks">${tasks}</div>` : ''}
          <div class="tb tb-quick"><div class="lbl">Быстрый старт</div>
          <div class="quick">${Object.values(SEC).map(s => `<a class="qk c${s.k}" href="#/train/${s.k}"><span class="sq">${ic(s.ic, 19)}</span><span>${s.name}</span></a>`).join('')}</div></div>
        </div>
      </div>`
  };
}

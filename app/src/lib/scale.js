// Result of a practice set on the TOEFL 2026 band scale 1–6: today's score, where the section forecast sits,
// the goal, and the question types to repeat. Used by Reading/Writing (practice.js) and Listening (listen.js).
import { band, cefr, esc, SEC } from './util.js';

const errWord = n => (n % 10 === 1 && n % 100 !== 11 ? 'ошибка' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'ошибки' : 'ошибок');

export function resultHero({ k, mode, got, total, fc, byType }) {
  const f = fc?.forecast?.[k] ?? null, t = fc?.target ?? 4.5;
  const bars = [1, 2, 3, 4, 5, 6].map(n => {
    const fill = f == null ? 0 : f >= n ? 1 : f > n - 1 ? f - (n - 1) : 0;
    return `<div class="rs-b ${Math.ceil(t) === n ? 'goal' : ''}"><div class="rs-col" style="height:${18 + n * 13}px"><i style="height:${Math.round(fill * 100)}%"></i></div><span>${n}</span></div>`;
  }).join('');
  const line = f == null
    ? `Прогноз по ${SEC[k].name} появится после экзаменационного модуля или пробника — тренировки его не меняют.`
    : `Прогноз по ${SEC[k].name} — <b>${band(f)}</b> (${cefr(f)}). ${f >= t ? `Цель ${band(t)} есть — держим уровень.` : `До цели ${band(t)} осталось <b>+${band(t - f)}</b>.`}`;
  const rep = Object.entries(byType || {}).map(([n, [a, b]]) => [n, b - a]).filter(([, w]) => w > 0).sort((x, y) => y[1] - x[1]).slice(0, 4);
  return `<div class="xres-hero rs-hero c${k}">
    <div class="rs-top">
      <div><div class="k">${esc(mode || '')}</div><div class="xr-n serif">${got} <small>из ${total}</small></div><p>${line}</p></div>
      <div class="rs-scale" role="img" aria-label="${f == null ? 'Шкала 1–6, прогноза пока нет' : `Шкала 1–6: прогноз ${band(f)}, цель ${band(t)}`}">${bars}</div>
    </div>
    ${rep.length ? `<div class="rs-rep"><b>Что повторить</b>${rep.map(([n, w]) => `<span class="chip">${esc(n)} · ${w} ${errWord(w)}</span>`).join('')}</div>` : ''}
  </div>`;
}

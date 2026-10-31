import { catalog } from '../data/mock.js';
import * as src from '../data/source.js';
import { isLive } from '../lib/api.js';
import { ic } from '../lib/icons.js';
import { band, SEC } from '../lib/util.js';
import { hdr } from '../lib/ui.js';

function chart(mocks, target) {
  const narrow = window.innerWidth < 600;
  const W = narrow ? 340 : 640, H = narrow ? 200 : 220, pl = 30, pr = 26, pt = 14, pb = 30;
  const n = mocks.length;
  const x = i => n === 1 ? (pl + W - pr) / 2 : pl + (i * (W - pl - pr)) / (n - 1);
  const y = v => pt + ((6 - v) / 5) * (H - pt - pb);
  const grid = [1, 2, 3, 4, 5, 6].map(v => `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" class="gl"/><text x="${pl - 10}" y="${y(v) + 4}" class="ax" text-anchor="end">${v}</text>`).join('');
  const lines = ['R', 'L', 'W', 'S'].map(k => {
    const pts = mocks.map((m, i) => m[k] != null ? [x(i), y(m[k]), m[k]] : null).filter(Boolean);
    if (!pts.length) return '';
    return `<g class="c${k}"><polyline points="${pts.map(p => p[0] + ',' + p[1]).join(' ')}" class="pl"/>
      ${pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="4.5" class="pt"><title>${SEC[k].name}: ${band(p[2])}</title></circle>`).join('')}</g>`;
  }).join('');
  const step = Math.ceil(n / (narrow ? 4 : 8));
  const xl = mocks.map((m, i) => i % step === 0 || i === n - 1 ? `<text x="${x(i)}" y="${H - 8}" class="ax" text-anchor="middle">${m.date}</text>` : '').join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="lchart" role="img" aria-label="Динамика баллов по секциям">
    ${grid}<line x1="${pl}" x2="${W - pr}" y1="${y(target)}" y2="${y(target)}" class="tg"/><text x="${W - pr}" y="${y(target) - 6}" class="tgl" text-anchor="end">цель ${band(target)}</text>
    ${lines}${xl}</svg>`;
}

export default async function progress() {
  const live = isLive();
  const [mocks, works, me, pst] = await Promise.all([src.mocks(), src.works(), src.today(), live ? src.stats('R').catch(() => null) : null]);
  const types = live ? Object.entries(pst?.types || {}).filter(([t]) => t !== 'Complete the Words' && t !== 'ctw').map(([t, v]) => [t, v.acc, v.n]).sort((a, b) => a[1] - b[1]) : [...catalog.R.types].sort((a, b) => a[1] - b[1]);
  const st = { review: '<span class="chip warn">на проверке</span>', draft: '<span class="chip">черновик</span>' };
  const used = ['R', 'L', 'W', 'S'].filter(k => mocks.some(m => m[k] != null));

  return {
    title: 'Прогресс', wide: true,
    html: `${hdr('Прогресс')}
    <div class="g-prog">
      <section class="card pad pchart">
        <div class="pc-hd"><div><div class="nm">Баллы по пробникам</div><div class="mt">Шкала 1–6, как в отчёте ETS</div></div>
          <div class="legend">${used.map(k => `<span class="c${k}"><i class="dot"></i>${SEC[k].name}</span>`).join('')}</div></div>
        ${mocks.length ? chart(mocks, me.target) : `<div class="empty"><b>Графика пока нет</b>Он появится после первого модуля или пробника</div>`}
      </section>
      <section>
        <div class="lbl">Reading · типы вопросов <b>от слабых к сильным</b></div>
        ${live && !types.length ? `<div class="card empty"><b>Нужно больше ответов</b>Статистика по типам вопросов появится после тренировок Daily Life и Academic Passage</div>`
        : `<div class="card pad qbars cR">${types.map(([n, a]) => `<a class="qb" href="#/practice/types?type=${encodeURIComponent(n)}&mode=learn"><span class="qn">${n}</span><div class="bar"><i style="width:${a}%;${a < 60 ? 'background:var(--sS)' : ''}"></i></div><b>${a}%</b></a>`).join('')}</div>`}
      </section>
      <section>
        ${live ? '' : `<div class="lbl">Тетрадь ошибок</div>
        <a class="card pad errbook" href="#/train/R">
          <div class="eb-n serif">23</div><div class="t"><div class="nm">ошибки ждут повтора</div><div class="mt">6 на сегодня · чаще всего Inference и Rhetorical Purpose</div></div>${ic('right', 20)}
        </a>`}
        <div class="lbl">Мои тексты и записи</div>
        ${works.length ? `<div class="card rows">${works.map(w => `<${w.id ? `a href="#/work/${w.id}"` : 'div'} class="row c${w.k}"><span class="sq">${ic(SEC[w.k].ic, 19)}</span>
          <div class="t"><div class="nm">${w.nm}</div><div class="mt">${w.mt ? w.mt + ' · ' : ''}${w.when}</div></div>
          <div class="end">${w.status ? st[w.status] : w.score != null ? `<b class="serif big">${band(w.score)}</b><span class="fade">/5</span>` : ''}</div></${w.id ? 'a' : 'div'}>`).join('')}</div>`
        : `<div class="card empty"><b>Пока нет работ</b>Письма, ответы на форуме и записи Speaking появятся здесь с оценкой учителя</div>`}
      </section>
    </div>`
  };
}

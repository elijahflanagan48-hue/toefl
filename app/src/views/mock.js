import * as src from '../data/source.js';
import { ic } from '../lib/icons.js';
import { band, cefr, overallBand, SEC } from '../lib/util.js';
import { hdr, on, modal, closeModal } from '../lib/ui.js';

const FLOW = [
  { k: 'R', min: 30, q: 50, note: 'адаптивная' },
  { k: 'L', min: 29, q: 47, note: 'после озвучки', off: true },
  { k: 'W', min: 23, q: 12, note: '3 таймера' },
  { k: 'S', min: 8, q: 11, note: 'запись' }
];

on('mock-start', () => modal(`<h2>Полный пробник</h2>
  <p class="mut" style="margin-bottom:14px">Секции идут подряд без перерыва, как на экзамене. Listening пока пропускается — после озвучки он встанет на своё место.</p>
  <div class="rows card" style="margin-bottom:14px">
    <div class="row">${ic('monitor', 20)}<div class="t"><div class="nm">Лучше с компьютера</div><div class="mt">Home Edition сдаётся только на компьютере</div></div></div>
    <div class="row">${ic('mic', 20)}<div class="t"><div class="nm">Нужен микрофон</div><div class="mt">Проверим перед Speaking</div></div></div>
    <div class="row">${ic('clock', 20)}<div class="t"><div class="nm">≈ 61 минута</div><div class="mt">Reading 30 · Writing 23 · Speaking 8</div></div></div>
  </div>
  <a class="btn pri block" href="#/exam/reading" data-act="modal-close">Начать с Reading</a>
  <button class="btn ghost block" data-act="modal-close" style="margin-top:6px">Отмена</button>`));

export default async function mock() {
  const mocks = await src.mocks();
  const total = FLOW.filter(f => !f.off).reduce((a, f) => a + f.min, 0);
  const last = mocks[mocks.length - 1] || {};

  const hero = `<section class="hero mock-hero on-hero">
    <div class="k">Полный пробник</div>
    <h2 class="serif">Reading → Listening → Writing → Speaking</h2>
    <div class="flow">${FLOW.map((f, i) => `${i ? `<span class="arr">${ic('right', 16)}</span>` : ''}
      <div class="fstep c${f.k} ${f.off ? 'off' : ''}"><i class="dot"></i><b>${SEC[f.k].name}</b><span>${f.min} мин · ${f.note}</span></div>`).join('')}</div>
    <div class="mh-ft"><span>Без перерыва · ≈ ${total} мин сейчас</span><button class="btn gold" data-act="mock-start">${ic('play', 17)} Начать</button></div>
  </section>`;

  const mst = `<div class="card pad mst">
    <div class="mst-hd"><span class="sq cR">${ic('route', 19)}</span><div><div class="nm">Как работает адаптивность</div><div class="mt">Reading и Listening: второй модуль зависит от первого</div></div></div>
    <svg viewBox="0 0 320 120" class="mst-svg" role="img" aria-label="Схема: первый модуль ведёт к лёгкому или трудному второму модулю">
      <rect x="4" y="38" width="112" height="44" rx="12" class="m1"/><text x="60" y="57" class="t1">Модуль 1</text><text x="60" y="73" class="t2">35 вопросов · 20 мин</text>
      <path d="M118 52 C150 52 150 22 182 22" class="ln up"/><path d="M118 68 C150 68 150 98 182 98" class="ln"/>
      <rect x="184" y="2" width="132" height="40" rx="12" class="m2 up"/><text x="250" y="20" class="t1">Трудный модуль 2</text><text x="250" y="35" class="t2">15 вопросов · до 6,0</text>
      <rect x="184" y="78" width="132" height="40" rx="12" class="m2"/><text x="250" y="96" class="t1">Лёгкий модуль 2</text><text x="250" y="111" class="t2">15 вопросов · потолок ниже</text>
    </svg>
    <p class="mut small">Точность в первом модуле определяет потолок балла. ${last.route ? `Твой последний маршрут: <b>${last.route === 'upper' ? 'трудный модуль' : 'лёгкий модуль'}</b>.` : 'Пройди модуль Reading, чтобы увидеть свой маршрут.'}</p>
  </div>`;

  const single = `<div class="lbl">Одна секция</div><div class="secgrid">${FLOW.map(f => `<a class="sgc c${f.k} ${f.off ? 'off' : ''}" href="${f.k === 'R' ? '#/exam/reading' : '#/mock'}">
      <span class="sq">${ic(SEC[f.k].ic, 19)}</span><b>${SEC[f.k].name}</b><span>${f.off ? 'после озвучки' : `${f.q} вопросов · ${f.min} мин`}</span></a>`).join('')}</div>`;

  const diag = `<a class="note info" href="#/exam/reading">${ic('spark', 22)}<div class="t"><div class="nm">Диагностика уровня · 25 мин</div><div class="mt">Короткий тест для нового ученика: стартовый прогноз и план</div></div>${ic('right', 20)}</a>`;

  const hist = !mocks.length ? `<div class="lbl">История</div><div class="card empty"><b>Пока пусто</b>Здесь появятся результаты пробников и модулей</div>` : `<div class="lbl">История <b>${mocks.length}</b></div><div class="card rows hist">${[...mocks].reverse().map(m => {
    const ov = overallBand([m.R, m.W, m.S]);
    return `<div class="row"><div class="hdate"><b>${m.date.split(' ')[0]}</b><span>${m.date.split(' ')[1]}</span></div>
      <div class="t"><div class="nm">${m.kind}</div><div class="mt hsec">${['R', 'W', 'S'].map(k => m[k] != null ? `<span class="c${k}"><i class="dot"></i>${band(m[k])}</span>` : '').join('')}
        ${m.route ? `<span class="chip ${m.route === 'upper' ? 'ok' : 'warn'}" title="Маршрут Reading">${ic('route', 13)} ${m.route === 'upper' ? 'трудный' : 'лёгкий'}</span>` : ''}</div></div>
      <div class="end"><b class="serif big">${band(ov)}</b><span class="cefr">${cefr(ov)}</span></div></div>`;
  }).join('')}</div>`;

  return {
    title: 'Пробник', wide: true,
    html: `${hdr('Пробник')}
      <div class="g-mock"><div class="col-a">${hero}${single}${diag}</div><div class="col-b">${mst}${hist}</div></div>`
  };
}

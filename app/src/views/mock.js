import * as src from '../data/source.js';
import { ic } from '../lib/icons.js';
import { band, cefr, overallBand, SEC } from '../lib/util.js';
import { hdr, on, modal, closeModal, toast } from '../lib/ui.js';
import { isLive } from '../lib/api.js';
import * as mockflow from '../lib/mockflow.js';

const FLOW = [
  { k: 'R', min: 30, q: 50, note: 'адаптивная' },
  { k: 'L', min: 27, q: 47, note: 'адаптивная' },
  { k: 'W', min: 23, q: 12, note: '3 таймера' },
  { k: 'S', min: 8, q: 11, note: 'запись' }
];

on('mock-start', async () => {
  if (!isLive()) { modal(`<h2>Полный пробник</h2><p class="mut" style="margin-bottom:14px">Пробники доступны после входа в аккаунт: ответы и записи сохраняются, а учитель проверяет Writing и Speaking.</p><button class="btn block" data-act="modal-close">Понятно</button>`); return; }
  let list = [];
  try { list = await src.mockList(); } catch (e) { toast(e.message); return; }
  modal(`<h2>Полный пробник</h2>
  <p class="mut" style="margin-bottom:14px">Все четыре секции идут подряд, как на экзамене: Reading → Listening → Writing → Speaking. Второй модуль Reading и Listening зависит от результата первого. Перерыва нет, пауза невозможна.</p>
  <div class="rows card" style="margin-bottom:14px">
    <div class="row">${ic('monitor', 20)}<div class="t"><div class="nm">Компьютер и тишина</div><div class="mt">Home Edition сдаётся только на компьютере</div></div></div>
    <div class="row">${ic('volume', 20)}<div class="t"><div class="nm">Наушники и микрофон</div><div class="mt">Listening звучит один раз; микрофон проверим перед Speaking</div></div></div>
    <div class="row">${ic('clock', 20)}<div class="t"><div class="nm">≈ ${total} минут</div><div class="mt">Reading 29 · Listening 27 · Writing 23 · Speaking 8</div></div></div>
  </div>
  ${list.length ? list.map(m => `<button class="btn pri block" style="margin-bottom:6px" data-act="mock-go" data-id="${m.id}">${ic('play', 17)} ${m.title}</button>`).join('') : '<p class="mut">Пробников пока нет.</p>'}
  <button class="btn ghost block" data-act="modal-close" style="margin-top:6px">Отмена</button>`);
});
on('mock-go', async el => {
  el.disabled = true;
  try { await mockflow.begin(el.dataset.id); closeModal(); } catch (e) { el.disabled = false; toast(e.message); }
});

const total = FLOW.reduce((a, f) => a + f.min, 0);

/** between sections: the clock is not running, the student decides when to start */
export function mockNext() {
  const f = mockflow.getFlow();
  return {
    exam: true, title: 'Пробник',
    html: '',
    mount() {
      const root = document.getElementById('app');
      if (!f) { location.hash = '#/mock'; return; }
      const steps = mockflow.stepsOf(f), prev = steps[f.at - 1]?.sec, cur = steps[f.at].sec;
      const tip = { L: 'Наденьте наушники. Каждая запись звучит один раз, вернуться к вопросу нельзя.', W: 'Три задания, у каждого свой таймер: Build a Sentence 6 мин, Email 7 мин, Academic Discussion 10 мин.',
        S: 'Разрешите микрофон. Ответ записывается сразу после сигнала; перезаписать и пропустить нельзя.', R: '' }[cur];
      root.innerHTML = `<div class="exam xres"><div class="xbar"><div class="xb-l"><span class="xsec">Пробник<span> · ${f.mock}</span></span></div></div><div class="xres-in">
        <div class="xres-hero"><div class="k">${SEC[prev].name} завершён</div><div class="xr-n serif" style="font-size:44px">${SEC[cur].name}</div>
          <p class="mut">≈ ${mockflow.MIN[cur]} минут. ${tip}</p></div>
        <div class="xr-ft"><a class="btn pri" href="${mockflow.urlOf(f, f.at)}">${ic('play', 17)} Начать ${SEC[cur].name}</a></div></div></div>`;
    }
  };
}

/** result of a full mock test */
export async function mockResult(params) {
  const id = params[0];
  let r;
  try { r = await src.mockSummary(id); } catch (e) { return { title: 'Пробник', html: `${hdr('Пробник', { back: '#/mock' })}<div class="card empty"><b>Результат недоступен</b>${e.message}</div>` }; }
  const b = r.bands || {}, lab = { lower: 'лёгкий', upper: 'трудный' };
  const wait = '<span class="chip warn">проверяет учитель</span>';
  const sub = (x, href) => !x ? '<span class="fade">нет</span>' : x.score != null ? `<b>${band(x.score)}</b> / 5` : wait;
  const mod = k => { const m = r.modules?.[k]; return m ? Object.entries(m).map(([n, v]) => `М${n}: ${v.got}/${v.of}`).join(' · ') : ''; };
  const card = (k, main, sub2) => `<div class="card pad rs-card c${k}"><div class="nm">${SEC[k].name}</div><div class="rs-b serif">${main}</div><p class="mut small">${sub2 || ''}</p></div>`;
  const ov = b.overall;
  return {
    title: 'Результат пробника', wide: true,
    html: `${hdr('Результат пробника', { back: '#/mock', sub: r.attempt.task || '' })}
    <section class="hero mock-hero on-hero"><div class="k">Итоговый балл</div><h2 class="serif" style="font-size:52px">${ov != null ? band(ov) : '—'}</h2>
      <div class="mh-ft"><span>${ov != null ? `Уровень ${cefr(ov)}` : 'Итог появится, когда учитель проверит Writing и Speaking'}</span></div></section>
    <div class="secgrid rs-grid">
      ${card('R', b.R != null ? band(b.R) : '—', `${mod('R')}${r.route?.R ? ` · дальше: ${lab[r.route.R]} модуль` : ''}`)}
      ${card('L', b.L != null ? band(b.L) : '—', `${mod('L')}${r.route?.L ? ` · дальше: ${lab[r.route.L]} модуль` : ''}`)}
      ${card('W', b.W != null ? band(b.W) : '—', `Build a Sentence: ${r.W.bas.got} из ${r.W.bas.n} · Email: ${sub(r.W.eml)} · Discussion: ${sub(r.W.dsc)}`)}
      ${card('S', b.S != null ? band(b.S) : '—', `Listen and Repeat: ${sub(r.S.lrp)} · Interview: ${sub(r.S.int)}`)}
    </div>
    <p class="mut small" style="margin-top:12px">Reading и Listening оцениваются сразу. Баллы за Writing и Speaking появятся после проверки учителем; шкала приблизительная (у ETS она не публикуется).</p>
    <div class="row-btns" style="margin-top:14px"><a class="btn" href="#/mock">К пробникам</a><a class="btn pri" href="#/progress">Прогресс</a></div>`
  };
}

export default async function mock() {
  const mocks = await src.mocks();
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

  const single = `<div class="lbl">Одна секция</div><div class="secgrid">${FLOW.map(f => `<a class="sgc c${f.k} ${f.off ? 'off' : ''}" href="#/train/${f.k}">
      <span class="sq">${ic(SEC[f.k].ic, 19)}</span><b>${SEC[f.k].name}</b><span>${f.q} вопросов · ${f.min} мин</span></a>`).join('')}</div>`;

  const diag = `<a class="note info" href="#/exam/reading">${ic('spark', 22)}<div class="t"><div class="nm">Диагностика уровня · 25 мин</div><div class="mt">Короткий тест для нового ученика: стартовый прогноз и план</div></div>${ic('right', 20)}</a>`;

  const hist = !mocks.length ? `<div class="lbl">История</div><div class="card empty"><b>Пока пусто</b>Здесь появятся результаты пробников и модулей</div>` : `<div class="lbl">История <b>${mocks.length}</b></div><div class="card rows hist">${[...mocks].reverse().map(m => {
    const ov = overallBand([m.R, m.W, m.S]);
    return `<${m.isMock ? `a href="#/mock/result/${m.id}"` : 'div'} class="row"><div class="hdate"><b>${m.date.split(' ')[0]}</b><span>${m.date.split(' ')[1]}</span></div>
      <div class="t"><div class="nm">${m.kind}</div><div class="mt hsec">${['R', 'W', 'S'].map(k => m[k] != null ? `<span class="c${k}"><i class="dot"></i>${band(m[k])}</span>` : '').join('')}
        ${m.route ? `<span class="chip ${m.route === 'upper' ? 'ok' : 'warn'}" title="Маршрут Reading">${ic('route', 13)} ${m.route === 'upper' ? 'трудный' : 'лёгкий'}</span>` : ''}</div></div>
      <div class="end"><b class="serif big">${band(ov)}</b><span class="cefr">${cefr(ov)}</span></div></${m.isMock ? 'a' : 'div'}>`;
  }).join('')}</div>`;

  return {
    title: 'Пробник', wide: true,
    html: `${hdr('Пробник')}
      <div class="g-mock"><div class="col-a">${hero}${single}${diag}</div><div class="col-b">${mst}${hist}</div></div>`
  };
}

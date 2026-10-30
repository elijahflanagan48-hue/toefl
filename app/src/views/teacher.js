import { bank, emailWork } from '../data/mock.js';
import * as src from '../data/source.js';
import { isLive, audioUrl } from '../lib/api.js';
import { ic } from '../lib/icons.js';
import { band, cefr, overallBand, heat, SEC, esc, plural } from '../lib/util.js';
import { hdr, on, toast, modal } from '../lib/ui.js';
import { pref } from '../lib/store.js';

const ovOf = s => overallBand([s.R, s.L, s.W, s.S]);
const initials = n => String(n || '?').split(' ').map(x => x[0]).join('').slice(0, 2);
const rerender = () => window.dispatchEvent(new Event('hashchange'));

/* ---------------- Обзор ---------------- */
export async function home() {
  const [students, queue] = await Promise.all([src.students(), src.queue()]);
  const avg = overallBand(students.map(ovOf));
  const overdue = students.filter(s => s.overdue).length;
  const kpi = [
    ['users', students.length, plural(students.length, 'ученик', 'ученика', 'учеников'), '#/t/students'],
    ['inbox', queue.length, plural(queue.length, 'работа ждёт', 'работы ждут', 'работ ждут'), '#/t/review'],
    ['alert', overdue, 'просрочено', '#/t/students'],
    ['trend', avg == null ? '—' : band(avg), 'средний прогноз', '#/t/students']
  ];
  const table = students.length ? `<div class="card tblwrap"><table class="tbl heatmap">
      <thead><tr><th>Ученик</th>${Object.values(SEC).map(s => `<th class="c${s.k}"><i class="dot"></i> ${s.k}</th>`).join('')}<th>Общий</th><th>Цель</th></tr></thead>
      <tbody>${students.map(s => `<tr data-act="open-student" data-id="${s.id}"><td><div class="who-s"><span class="av sm">${esc(initials(s.name))}</span><div><b>${esc(s.name)}</b><span>${s.last}${s.overdue ? ' · <em class="badtx">просрочка</em>' : ''}</span></div></div></td>
        ${['R', 'L', 'W', 'S'].map(k => `<td class="num"><span class="sc ${heat(s[k], s.target)}">${s[k] == null ? 'нет' : band(s[k])}</span></td>`).join('')}
        <td class="num"><b class="serif">${ovOf(s) == null ? '—' : band(ovOf(s))}</b></td><td class="num fade">${band(s.target)}</td></tr>`).join('')}</tbody></table></div>`
    : `<div class="card empty"><b>Учеников пока нет</b>Отправьте код приглашения из профиля — ученик появится здесь сразу после регистрации.<br><br><a class="btn sm" href="#/profile">${ic('link', 16)} Коды приглашения</a></div>`;

  return {
    title: 'Обзор', wide: true,
    html: `${hdr('Обзор', { sub: 'Кабинет учителя' })}
    <div class="kpis">${kpi.map(([i, v, l, h], n) => `<a class="kpi ${n === 1 && queue.length ? 'hot' : ''}" href="${h}">${ic(i, 20)}<b class="serif">${v}</b><span>${l}</span></a>`).join('')}</div>
    <div class="g-thome">
      <section>
        <div class="lbl">Ученики × секции <b>цвет — расстояние до цели</b></div>${table}
      </section>
      <section>
        <div class="lbl">Очередь проверки ${queue.length ? `<a class="lnk" href="#/t/review">Все ${queue.length}</a>` : ''}</div>
        ${queue.length ? `<div class="card rows">${queue.slice(0, 4).map(qRow).join('')}</div>` : `<div class="card empty"><b>Всё проверено</b>Новые письма и записи появятся здесь</div>`}
        ${isLive() ? '' : `<div class="lbl">Слабые места группы</div>
        <div class="card pad weak">${[['Rhetorical Purpose', 49], ['Inference', 54], ['Sentence Simplification', 58]].map(([n, a]) =>
          `<div class="qb cR"><span class="qn">${n}</span><div class="bar"><i style="width:${a}%;background:var(--sS)"></i></div><b>${a}%</b></div>`).join('')}
          <button class="btn sm" data-act="assign" style="margin-top:12px">${ic('plus', 16)} Назначить тренажёр группе</button></div>`}
      </section>
    </div>`
  };
}

const qRow = q => `<a class="row c${q.k}" href="#/t/review/${q.id}"><span class="sq">${ic(SEC[q.k].ic, 19)}</span>
  <div class="t"><div class="nm">${esc(q.task)}</div><div class="mt">${esc(q.student)} · ${q.when}${q.late ? ' · <em class="badtx">после дедлайна</em>' : ''}</div></div>
  <div class="end">${q.words ? q.words + ' сл.' : q.dur || ''}${ic('right', 18)}</div></a>`;

on('open-student', () => toast('Карточка ученика — этап P9'));
on('assign', () => toast('Назначение заданий — этап P9'));

/* ---------------- Ученики ---------------- */
export async function studentsView() {
  const students = await src.students();
  const groups = [...new Set(students.map(s => s.group))];
  return {
    title: 'Ученики', wide: true,
    html: `${hdr('Ученики', { right: `<a class="btn sm pri" href="#/profile">${ic('plus', 16)} Пригласить</a>` })}
    ${students.length ? `<div class="toolbar"><input class="inp search" type="search" placeholder="Поиск ученика" aria-label="Поиск ученика" data-act-input="filter-students">
      ${groups.length > 1 ? `<div class="seg grp">${['Все', ...groups].map((g, i) => `<button class="${i ? '' : 'on'}" data-act="grp" data-v="${esc(g)}">${esc(g)}</button>`).join('')}</div>` : ''}</div>
    <div class="scards">${students.map(s => {
      const ov = ovOf(s);
      return `<article class="card scard" data-name="${esc(s.name.toLowerCase())}" data-grp="${esc(s.group)}">
        <div class="sc-hd"><span class="av">${esc(initials(s.name))}</span><div class="t"><b>${esc(s.name)}</b><span>${esc(s.group)}</span></div>
          <div class="sc-ov"><b class="serif">${ov == null ? '—' : band(ov)}</b>${ov == null ? '' : `<span class="cefr">${cefr(ov)}</span>`}</div></div>
        <div class="sc-secs">${['R', 'L', 'W', 'S'].map(k => `<div class="c${k}"><span>${k}</span><b class="serif">${s[k] == null ? '—' : band(s[k])}</b><div class="pips">${[1, 2, 3, 4, 5, 6].map(n => `<i class="${s[k] >= n ? 'on' : s[k] >= n - .5 ? 'half' : ''}"></i>`).join('')}</div></div>`).join('')}</div>
        <div class="sc-ft"><span>${ic('flag', 15)} цель ${band(s.target)}</span><span>${ic('cal', 15)} ${s.exam}</span><span>${ic('flame', 15)} ${s.streak}</span>
          ${s.overdue ? '<span class="chip bad">просрочка</span>' : `<span class="fade">${s.last}</span>`}
          ${isLive() ? `<button class="btn sm ghost" data-act="reset-pw" data-id="${s.id}" data-name="${esc(s.name)}" style="margin-left:0">${ic('lock', 14)} Сбросить пароль</button>` : ''}</div>
      </article>`;
    }).join('')}</div>` : `<div class="card empty"><b>Учеников пока нет</b>Скопируйте ссылку-приглашение в профиле и отправьте ученику.</div>`}`
  };
}
on('grp', el => {
  el.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el));
  document.querySelectorAll('.scard').forEach(c => { c.hidden = el.dataset.v !== 'Все' && c.dataset.grp !== el.dataset.v; });
});
on('reset-pw', el => modal(`<h2>Сбросить пароль?</h2><p class="mut" style="margin-bottom:14px">${esc(el.dataset.name)} получит временный пароль и при входе придумает новый. Текущие сеансы ученика закроются.</p>
  <button class="btn pri block" data-act="reset-pw-go" data-id="${el.dataset.id}">Сбросить</button><button class="btn ghost block" data-act="modal-close" style="margin-top:6px">Отмена</button>`));
on('reset-pw-go', async el => {
  try {
    const r = await src.resetPassword(el.dataset.id);
    modal(`<h2>Временный пароль</h2><p class="mut" style="margin-bottom:10px">Передайте его ученику. Больше он показан не будет.</p>
      <div class="card pad" style="font-family:var(--ffd);font-size:24px;letter-spacing:.06em;text-align:center;user-select:all">${esc(r.temp_password)}</div>
      <button class="btn pri block" data-act="modal-close" style="margin-top:14px">Готово</button>`);
  } catch (e) { toast(e.message); }
});

/* ---------------- Проверка: очередь ---------------- */
export async function reviewList() {
  const f = pref.get('qf', 'all');
  const all = await src.queue();
  const list = all.filter(q => f === 'all' || q.k === f);
  return {
    title: 'Проверка', wide: true,
    html: `${hdr('Проверка', { sub: all.length ? `${all.length} ${plural(all.length, 'работа ждёт', 'работы ждут', 'работ ждут')} оценки` : 'Очередь пуста' })}
    <div class="seg qseg">${[['all', 'Все'], ['W', 'Writing'], ['S', 'Speaking']].map(([v, l]) => `<button class="${f === v ? 'on' : ''}" data-act="qf" data-v="${v}">${l}</button>`).join('')}</div>
    ${list.length ? `<div class="card rows qlist">${list.map(q => `<a class="row c${q.k}" href="#/t/review/${q.id}"><span class="sq">${ic(SEC[q.k].ic, 19)}</span>
      <div class="t"><div class="nm">${esc(q.task)} <span class="fade">· ${esc(q.student)}</span></div><div class="mt">${esc(q.title)}</div></div>
      <div class="end"><span class="hide-sm">${q.when}</span>${q.late ? '<span class="chip bad">поздно</span>' : ''}<span class="chip">${q.words ? q.words + ' слов' : q.dur || ''}</span>${ic('right', 18)}</div></a>`).join('')}</div>`
      : `<div class="card empty"><b>Нечего проверять</b>Когда ученик отправит письмо или запись, она появится здесь</div>`}
    <p class="fade small" style="margin:12px 2px">${ic('spark', 14)} AI-предоценку можно будет включить позже — сейчас всё оценивает учитель.</p>`
  };
}
on('qf', el => { pref.set('qf', el.dataset.v); rerender(); });

/* ---------------- Проверка: одна работа ---------------- */
const RUBRIC = {
  email: ['Не по теме, пусто или скопировано', 'Почти непонятно, «телеграфный» язык', 'Попытка есть, но сообщение трудно понять', 'Задача решена частично, заметные ошибки', 'В основном эффективно, мало ошибок', 'Полностью эффективно, разнообразный и точный язык'],
  dsc: ['Не по теме, пусто или скопировано', 'Нет связных идей, язык из промпта', 'Идеи трудно отследить, слабо развёрнуто', 'В основном понятно, часть объяснения не хватает', 'Релевантно и развёрнуто, мало ошибок', 'Очень ясный вклад, точный и разнообразный язык'],
  interview: ['Нет ответа или не по теме', 'Отдельные слова, почти неразборчиво', 'Слабо связано с вопросом, трудно понять', 'Отвечает, но ограниченно, паузы мешают', 'Развёрнуто и понятно, небольшие шероховатости', 'Полно, бегло, точный и разнообразный язык'],
  lrp: ['Нет ответа / неразборчиво', 'Несколько слов', 'Значительная часть пропущена', 'Почти полностью, но смысл неточен', 'Смысл сохранён, мелкие замены', 'Точное повторение, разборчиво']
};
const CRIT = {
  email: ['Закрыт пункт 1', 'Закрыт пункт 2', 'Закрыт пункт 3', 'Уместный регистр и вежливые формулы', 'Связность', 'Нет заученных шаблонов'],
  dsc: ['Чёткая позиция', 'Новый вклад, не повтор постов', 'Причины и примеры', 'Не меньше 100 слов', 'Связность', 'Нет «воды» и шаблонов'],
  interview: ['Отвечает на вопрос', 'Развёрнутость на 45 с', 'Беглость и темп', 'Разборчивость', 'Грамматика и лексика'],
  lrp: ['Знаменательные слова на месте', 'Служебные слова', 'Разборчивость', 'Ритм и ударение']
};
const kindOf = task => ({ eml: 'email', dsc: 'dsc', int: 'interview', lrp: 'lrp' }[task] || 'email');

function promptHtml(task, p) {
  if (!p) return '';
  if (task === 'eml') return `<div class="card pad prompt"><div class="pr-k">${ic('file', 16)} Write an Email · 7 мин</div>
    ${p.situation ? `<p>${esc(p.situation)}</p>` : ''}${p.bullets ? `<ul>${p.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}</div>`;
  if (task === 'dsc') return `<div class="card pad prompt"><div class="pr-k">${ic('file', 16)} Academic Discussion · 10 мин</div>
    ${p.professor ? `<p><b>${esc(p.professor.name || 'Professor')}:</b> ${esc(p.professor.text || '')}</p>` : ''}
    ${(p.students || []).map(s => `<p class="mut"><b>${esc(s.name)}:</b> ${esc(s.text)}</p>`).join('')}</div>`;
  return `<div class="card pad prompt"><div class="pr-k">${ic('mic', 16)} ${task === 'int' ? 'Take an Interview · 45 с на ответ' : 'Listen and Repeat'}</div>${p.scenario ? `<p>${esc(p.scenario)}</p>` : ''}</div>`;
}

export async function reviewItem(params) {
  const live = isLive();
  let q, sub = null, text, prompt, task, audios = [], prev = null;
  if (live) {
    const r = await src.submission(params[0]);
    sub = r.submission; task = sub.task; prompt = sub.prompt; text = sub.text; audios = r.audio; prev = r.ratings.find(x => x.is_final) || null;
    q = { id: sub.id, k: sub.section, student: sub.student, task: src.TASK_NAMES[task] || task, title: prompt?.title || prompt?.subject || '', words: sub.words, when: '' };
  } else {
    const demoQ = await src.queue();
    q = demoQ.find(x => String(x.id) === params[0]) || demoQ[0];
    task = q.k === 'W' ? (q.task.includes('Email') ? 'eml' : 'dsc') : (q.task.includes('Interview') ? 'int' : 'lrp');
    prompt = task === 'eml' ? emailWork.prompt : null; text = task === 'eml' ? emailWork.text : null;
  }
  const isW = q.k === 'W', kind = kindOf(task);
  const sel = pref.get('score.' + q.id, null) ?? (prev ? Math.round(prev.score) : null);
  const nParts = live ? Math.max(sub.parts, audios.length) : 4;
  const partScores = live && prev?.parts ? prev.parts : [];

  const work = isW ? `${promptHtml(task, prompt)}
    <div class="card pad paper">
      ${task === 'eml' && prompt ? `<div class="mailhd"><span>To:</span> ${esc(prompt.to || '')}<br><span>Subject:</span> ${esc(prompt.subject || '')}</div>` : ''}
      <div class="mailbody">${live ? esc(text).replace(/\n/g, '<br>') : esc(text || '').replace('enough academic', '<mark class="cm" data-n="1">enough academic</mark>').replace(/\n/g, '<br>')}</div>
      ${live ? '' : `<div class="cmts"><div class="cmt"><b>1</b> Порядок слов: <i>academic enough</i> — «enough» ставится после прилагательного.</div></div>`}
      <div class="paper-ft fade">${q.words || 0} слов${task === 'dsc' && q.words < 100 ? ' · <span class="badtx">меньше 100</span>' : ''}</div>
    </div>`
    : `${promptHtml(task, prompt) || `<div class="card pad prompt"><div class="pr-k">${ic('mic', 16)} ${esc(q.task)}</div></div>`}
    <div class="card rows audios">${Array.from({ length: nParts }, (_, i) => {
      const has = !live || audios.some(a => a.part === i);
      const qtext = prompt?.questions?.[i] || (live ? '' : ['What do you like most about the place where you live?', 'Describe a change in your neighborhood in recent years.', 'Do you think cities should limit cars in the center? Why?', 'How will cities be different in twenty years?'][i] || '');
      return `<div class="row arow audio-row"><div class="t"><div class="nm">${i + 1}. ${esc(qtext)}</div>
        ${has ? (live ? `<audio controls preload="none" data-sub="${q.id}" data-part="${i}"></audio>` : `<div class="wave" aria-hidden="true">${Array.from({ length: 48 }, (_, j) => `<i style="height:${6 + Math.round(Math.abs(Math.sin(j * 1.7 + i) * 18 + Math.cos(j * .6) * 6))}px"></i>`).join('')}</div>`) : '<div class="fade small">нет записи</div>'}</div>
        <div class="end"><div class="minis">${[0, 1, 2, 3, 4, 5].map(n => `<button class="mini ${(pref.get('sc.' + q.id + '.' + i) ?? partScores[i]) === n ? 'on' : ''}" data-act="mini" data-q="${q.id}" data-i="${i}" data-n="${n}">${n}</button>`).join('')}</div></div></div>`;
    }).join('')}</div>`;

  const panel = `<aside class="card pad rubric">
    <div class="rb-hd"><span class="av">${esc(initials(q.student))}</span><div><b>${esc(q.student)}</b><span class="fade">${esc(q.task)}</span></div></div>
    ${prev ? `<p class="chip ok" style="margin-top:10px">Оценено: ${band(prev.score)} / 5</p>` : ''}
    <div class="lbl" style="margin-top:14px">${isW ? 'Балл по рубрике ETS' : 'Итог (или средний по ответам)'}</div>
    <div class="scores">${RUBRIC[kind].map((d, n) => `<button class="scoreb ${sel === n ? 'on' : ''}" data-act="score" data-q="${q.id}" data-n="${n}"><b class="serif">${n}</b><span>${d}</span></button>`).join('')}</div>
    <div class="lbl">Критерии</div>
    <div class="crit">${CRIT[kind].map((c, i) => `<label class="ck"><input type="checkbox" name="crit" value="${esc(c)}" ${prev?.criteria?.[c] ? 'checked' : ''}><span>${c}</span></label>`).join('')}</div>
    <div class="lbl">Комментарий ученику</div>
    <textarea class="inp" id="rcomment" rows="3" placeholder="Что получилось и что улучшить">${esc(prev?.comment || '')}</textarea>
    <div class="rb-ft"><a class="btn ghost" href="#/t/review">К очереди</a><button class="btn pri" data-act="save-score" data-q="${q.id}" data-s="${isW ? 'W' : 'S'}" data-parts="${isW ? 0 : nParts}">${ic('check', 17)} Сохранить</button></div>
    <p class="fade small kbdh"><kbd>0</kbd>–<kbd>5</kbd> балл · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> сохранить · <kbd>J</kbd>/<kbd>K</kbd> следующая/предыдущая</p>
  </aside>`;

  const queueIds = live ? (await src.queue()).map(x => x.id) : (await src.queue()).map(x => x.id);
  return {
    title: 'Проверка', wide: true,
    html: `${hdr(q.task, { back: '#/t/review', sub: q.student + (q.title ? ' · ' + q.title : '') })}<div class="g-review"><div class="work">${work}</div>${panel}</div>`,
    mount(root) {
      if (!live) return;
      root.querySelectorAll('audio[data-sub]').forEach(a => {
        a.addEventListener('play', async function load() {
          if (a.src) return;
          a.removeEventListener('play', load);
          try { a.src = await audioUrl(a.dataset.sub, a.dataset.part); a.play(); } catch (e) { toast(e.message); }
        });
      });
    },
    keys(e) {
      if (e.target.closest('textarea,input')) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) document.querySelector('[data-act="save-score"]').click(); return; }
      if (/^[0-5]$/.test(e.key)) { pref.set('score.' + q.id, Number(e.key)); rerender(); }
      const i = queueIds.indexOf(q.id);
      if (e.key === 'j' && queueIds[i + 1] != null) location.hash = '#/t/review/' + queueIds[i + 1];
      if (e.key === 'k' && i > 0) location.hash = '#/t/review/' + queueIds[i - 1];
    }
  };
}
on('score', el => { pref.set('score.' + el.dataset.q, Number(el.dataset.n)); rerender(); });
on('mini', el => { pref.set('sc.' + el.dataset.q + '.' + el.dataset.i, Number(el.dataset.n)); rerender(); });
on('save-score', async el => {
  const id = el.dataset.q, nParts = Number(el.dataset.parts);
  const score = pref.get('score.' + id, null);
  const parts = Array.from({ length: nParts }, (_, i) => pref.get('sc.' + id + '.' + i, null));
  const criteria = Object.fromEntries([...document.querySelectorAll('input[name=crit]')].map(c => [c.value, c.checked]));
  const comment = document.getElementById('rcomment')?.value || '';
  if (!isLive()) { toast('Оценка сохранена (демо)'); setTimeout(() => { location.hash = '#/t/review'; }, 500); return; }
  const payload = { criteria, comment };
  if (score != null) payload.score = score;
  if (nParts && parts.every(x => x != null)) payload.parts = parts;
  if (payload.score == null && !payload.parts) { toast(nParts ? 'Поставьте итоговый балл или баллы за каждый ответ' : 'Поставьте балл'); return; }
  try {
    await src.rate(id, payload);
    pref.set('score.' + id, null); parts.forEach((_, i) => pref.set('sc.' + id + '.' + i, null));
    toast('Оценка сохранена'); location.hash = '#/t/review';
  } catch (e) { toast(e.message); }
});

/* ---------------- Контент ---------------- */
export function content() {
  const sum = bank.reduce((a, b) => a + b.total, 0);
  return {
    title: 'Контент', wide: true,
    html: `${hdr('Контент', { sub: isLive() ? 'Банк заданий · импорт появится на этапе P9' : `Банк заданий · ${sum} единиц (пример)`, right: `<button class="btn sm" data-act="imp">${ic('upload', 16)} Импорт JSON</button>` })}
    <div class="card tblwrap"><table class="tbl bank">
      <thead><tr><th>Задание</th><th>Всего</th><th>A · B · C</th><th>Откалибровано</th><th>Флаги</th><th></th></tr></thead>
      <tbody>${bank.map(b => `<tr data-act="open-bank"><td><div class="who-s c${b.k}"><span class="sq sm">${ic(SEC[b.k].ic, 16)}</span><b>${b.nm}</b></div></td>
        <td class="num">${b.total}</td>
        <td><div class="lvbar">${b.lv.map((n, i) => `<i class="lv${i}" style="flex:${n}" title="${'ABC'[i]}: ${n}">${n}</i>`).join('')}</div></td>
        <td>${b.cal == null ? `<span class="fade small">${b.soon ? 'после озвучки' : 'оценивает учитель'}</span>` : `<div class="calc"><div class="bar"><i style="width:${Math.round(b.cal / b.total * 100)}%"></i></div><span>${Math.round(b.cal / b.total * 100)}%</span></div>`}</td>
        <td>${b.flags ? `<span class="chip warn">${ic('alert', 13)} ${b.flags}</span>` : '<span class="fade">—</span>'}</td>
        <td class="fade">${ic('right', 18)}</td></tr>`).join('')}</tbody></table></div>
    <div class="g-two">
      <div class="card pad"><div class="nm">Калибровка</div><p class="mut small" style="margin-top:4px">Трудность задания пересчитывается после 30+ ответов учеников. Флаг ставится, если задание оказалось заметно легче или труднее своего уровня, либо если сильные ученики ошибаются в нём чаще слабых.</p></div>
      <div class="card pad"><div class="nm">Фиксированные варианты</div><p class="mut small" style="margin-top:4px">Соберите пробник из банка по блупринту ETS: router-модуль, лёгкий и трудный второй модуль. Вариант можно назначить группе.</p>
        <button class="btn sm" data-act="imp" style="margin-top:10px">${ic('plus', 16)} Собрать вариант</button></div>
    </div>`
  };
}
on('imp', () => toast('Импорт и редактор — этап P9'));
on('open-bank', () => toast('Список заданий — этап P9'));

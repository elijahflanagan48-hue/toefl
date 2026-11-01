// Teacher cabinet (P9): student card, assignments with deadlines, bank browser with import / edit.
import * as src from '../data/source.js';
import { isLive } from '../lib/api.js';
import { ic } from '../lib/icons.js';
import { band, cefr, overallBand, heat, SEC, esc, plural } from '../lib/util.js';
import { hdr, on, toast, modal, closeModal } from '../lib/ui.js';
import { ASSIGN_TASKS, MODE_NAMES } from '../lib/assign.js';

const rerender = () => window.dispatchEvent(new Event('hashchange'));
const dateLabel = ms => (ms ? new Date(ms).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '—');
const KIND = { practice: 'Тренировка', module: 'Модуль', section: 'Секция', mock: 'Пробник', diagnostic: 'Диагностика' };
const needLive = html => `${hdr('Кабинет учителя')}<div class="card empty"><b>Доступно в аккаунте</b>${html}</div>`;

/* ------------------------------------------------------------------ student card */
export async function studentCard(params) {
  if (!isLive()) return { title: 'Ученик', html: needLive('В демо-режиме карточки учеников недоступны.') };
  const d = await src.studentDetail(params[0]);
  const st = d.student, f = d.summary.forecast, ov = overallBand([f.R, f.L, f.W, f.S]);
  const weak = sec => Object.entries(d.stats[sec]?.types || {}).filter(([, v]) => v.n >= 3).sort((a, b) => a[1].acc - b[1].acc).slice(0, 5);
  const weakR = weak('R'), weakW = weak('W');
  const wrows = (list, k) => list.map(([n, v]) => `<div class="qb c${k}"><span class="qn">${esc(n)}</span><div class="bar"><i style="width:${v.acc}%;background:${v.acc < 60 ? 'var(--sS)' : 'var(--ok)'}"></i></div><b>${v.acc}%</b></div>`).join('');
  const att = d.attempts.filter(a => a.finished_at).slice(0, 8);
  const subs = d.submissions.slice(0, 8);
  return {
    title: st.name, wide: true,
    html: `${hdr(st.name, { back: '#/t/students', sub: [st.group_name, st.email].filter(Boolean).join(' · '), right: `<button class="btn sm pri" data-act="assign" data-sid="${st.id}">${ic('plus', 16)} Назначить</button>` })}
    <div class="kpis">${['R', 'L', 'W', 'S'].map(k => `<div class="kpi"><span class="sc ${heat(f[k], st.target ?? 4.5)}">${f[k] == null ? 'нет' : band(f[k])}</span><b class="serif" style="font-size:15px">${SEC[k].name}</b><span>прогноз</span></div>`).join('')}
      <div class="kpi hot">${ic('trend', 20)}<b class="serif">${ov == null ? '—' : band(ov)}</b><span>общий${ov == null ? '' : ' · ' + cefr(ov)} · цель ${band(st.target ?? 4.5)}</span></div></div>
    <div class="g-two">
      <section><div class="lbl">Слабые типы вопросов</div>
        <div class="card pad weak">${weakR.length || weakW.length ? `${wrows(weakR, 'R')}${wrows(weakW, 'W')}` : '<p class="mut">Пока мало ответов: нужно хотя бы 3 вопроса каждого типа.</p>'}
          <button class="btn sm" data-act="assign" data-sid="${st.id}" style="margin-top:12px">${ic('plus', 16)} Назначить тренажёр</button></div>
        <div class="lbl">Последние попытки</div>
        ${att.length ? `<div class="card tblwrap"><table class="tbl"><thead><tr><th>Дата</th><th>Что</th><th>Баллы</th></tr></thead><tbody>${att.map(a => `<tr><td>${dateLabel(a.finished_at)}</td>
          <td>${KIND[a.kind] || a.kind}${a.section ? ' · ' + SEC[a.section].name : ''}${a.route?.R ? ` · ${a.route.R === 'upper' ? 'трудный' : 'лёгкий'} модуль 2` : ''}</td>
          <td class="num">${['R', 'L', 'W', 'S'].filter(k => a.bands?.[k] != null).map(k => `${k} ${band(a.bands[k])}`).join(' · ') || '—'}</td></tr>`).join('')}</tbody></table></div>` : '<div class="card empty"><b>Попыток пока нет</b></div>'}
      </section>
      <section><div class="lbl">Работы Writing и Speaking</div>
        ${subs.length ? `<div class="card rows">${subs.map(s => `<a class="row c${s.section}" href="#/t/review/${s.id}"><span class="sq">${ic(SEC[s.section].ic, 19)}</span>
          <div class="t"><div class="nm">${esc(src.TASK_NAMES[s.task] || s.task)}</div><div class="mt">${esc(s.prompt?.title || s.prompt?.subject || s.prompt?.course || '')} · ${dateLabel(s.submitted_at || s.created_at)}</div></div>
          <div class="end">${s.status === 'pending' ? '<span class="chip warn">ждёт</span>' : s.score != null ? `<b class="serif">${band(s.score)}</b>` : ''}${ic('right', 18)}</div></a>`).join('')}</div>` : '<div class="card empty"><b>Работ пока нет</b></div>'}
        <div class="row-btns" style="margin-top:12px"><button class="btn sm ghost" data-act="reset-pw" data-id="${st.id}" data-name="${esc(st.name)}">${ic('lock', 14)} Сбросить пароль</button></div>
      </section>
    </div>`
  };
}
on('open-student', el => { location.hash = '#/t/student/' + el.dataset.id; });

/* ------------------------------------------------------------------ assignments */
export async function assignView() {
  if (!isLive()) return { title: 'Назначения', html: needLive('В демо-режиме назначения недоступны.') };
  const list = await src.assignments();
  const now = Date.now();
  return {
    title: 'Назначения', wide: true,
    html: `${hdr('Назначения', { back: '#/t/home', sub: 'Задания с дедлайнами', right: `<button class="btn sm pri" data-act="assign">${ic('plus', 16)} Новое</button>` })}
    ${list.length ? `<div class="card tblwrap"><table class="tbl"><thead><tr><th>Задание</th><th>Кому</th><th>Срок</th><th>Выполнили</th><th></th></tr></thead><tbody>${list.map(a => {
      const pct = a.targets ? Math.round(a.done / a.targets * 100) : 0, late = a.due_at && a.due_at < now && a.done < a.targets;
      return `<tr><td><b>${esc(a.title)}</b><div class="fade small">${MODE_NAMES[a.spec?.mode] || ''}</div></td>
        <td>${esc(a.group_name || a.student_name || '—')}</td><td>${a.due_at ? dateLabel(a.due_at) : 'без срока'}${late ? ' <em class="badtx">просрочено</em>' : ''}</td>
        <td><div class="calc"><div class="bar"><i style="width:${pct}%"></i></div><span>${a.done} из ${a.targets}</span></div></td>
        <td><button class="btn sm ghost" data-act="assign-del" data-id="${a.id}" data-nm="${esc(a.title)}">Удалить</button></td></tr>`;
    }).join('')}</tbody></table></div>`
      : `<div class="card empty"><b>Назначений пока нет</b>Назначьте тренажёр группе или ученику — он появится у них на главной с дедлайном.<br><br><button class="btn sm pri" data-act="assign">${ic('plus', 16)} Назначить</button></div>`}`
  };
}
on('assign-del', el => modal(`<h2>Удалить назначение?</h2><p class="mut" style="margin-bottom:14px">«${esc(el.dataset.nm)}» исчезнет у учеников. Сделанные работы останутся.</p>
  <button class="btn pri block" data-act="assign-del-go" data-id="${el.dataset.id}">Удалить</button><button class="btn ghost block" data-act="modal-close" style="margin-top:6px">Отмена</button>`));
on('assign-del-go', async el => { try { await src.deleteAssignment(el.dataset.id); closeModal(); toast('Удалено'); rerender(); } catch (e) { toast(e.message); } });

on('assign', async el => {
  if (!isLive()) { toast('Назначения работают в аккаунте'); return; }
  let groups = [], students = [];
  try { [groups, students] = await Promise.all([src.groups(), src.students()]); } catch (e) { toast(e.message); return; }
  const sid = el.dataset.sid || '';
  const tomorrow = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  modal(`<h2>Новое назначение</h2>
    <div class="field"><label for="a-to">Кому</label><select class="inp" id="a-to">
      <optgroup label="Группа">${groups.map(g => `<option value="g${g.id}">${esc(g.name)} · ${g.students ?? ''} уч.</option>`).join('')}</optgroup>
      <optgroup label="Ученик">${students.map(s => `<option value="s${s.id}" ${String(s.id) === sid ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</optgroup></select></div>
    <div class="field"><label for="a-task">Что</label><select class="inp" id="a-task">${ASSIGN_TASKS.map(t => `<option value="${t.v}">${t.nm}</option>`).join('')}</select></div>
    <div class="field"><label for="a-mode">Режим</label><select class="inp" id="a-mode"><option value="learn">${MODE_NAMES.learn}</option><option value="timed">${MODE_NAMES.timed}</option></select></div>
    <div class="field"><label for="a-due">Срок (необязательно)</label><input class="inp" id="a-due" type="date" value="${tomorrow}"></div>
    <div class="row-btns"><button class="btn" data-act="modal-close">Отмена</button><button class="btn pri" data-act="assign-go">Назначить</button></div>`);
  if (sid) document.getElementById('a-to').value = 's' + sid;
});
on('assign-go', async () => {
  const to = document.getElementById('a-to').value, t = ASSIGN_TASKS.find(x => x.v === document.getElementById('a-task').value);
  const mode = document.getElementById('a-mode').value, dueS = document.getElementById('a-due').value;
  const payload = { title: t.nm.replace(' · ', ': '), spec: { section: t.section, task: t.task || undefined, mode }, due_at: dueS ? new Date(dueS + 'T23:59:00').getTime() : undefined };
  if (to[0] === 'g') payload.group_id = Number(to.slice(1)); else payload.student_id = Number(to.slice(1));
  try { await src.createAssignment(payload); closeModal(); toast('Назначено'); if (location.hash.startsWith('#/t/assign')) rerender(); else location.hash = '#/t/assign'; }
  catch (e) { toast(e.message); }
});

/* ------------------------------------------------------------------ bank */
const TASKS = { R: ['ctw', 'rdl', 'rap'], L: ['lcr', 'lco', 'lan', 'lat'], W: ['bas', 'eml', 'dsc'], S: ['lrp', 'int'] };
const STATUS = { active: 'в тренировке', pretest: 'банк пробников', draft: 'черновик', retired: 'снято' };
const TNAME = { ctw: 'Complete the Words', rdl: 'Read in Daily Life', rap: 'Academic Passage', lcr: 'Choose a Response', lco: 'Conversation', lan: 'Announcement', lat: 'Academic Talk', bas: 'Build a Sentence', eml: 'Write an Email', dsc: 'Academic Discussion', lrp: 'Listen and Repeat', int: 'Take an Interview' };
const headText = h => { const m = String(h || '').match(/"(?:title|subject|course|a|stem|text|situation|kind)":"([^"]{0,80})/); return m ? m[1] : ''; };

export async function bankView() {
  if (!isLive()) return { title: 'Банк заданий', html: needLive('В демо-режиме банк недоступен.') };
  const qs = new URLSearchParams(location.hash.split('?')[1] || '');
  const f = { section: qs.get('section') || '', task: qs.get('task') || '', status: qs.get('status') || '', level: qs.get('level') || '', q: qs.get('q') || '' };
  const r = await src.bankList({ ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)), limit: 120 });
  const opts = (list, cur, all) => `<option value="">${all}</option>${list.map(([v, l]) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${l}</option>`).join('')}`;
  const tasks = (f.section ? TASKS[f.section] : Object.values(TASKS).flat()).map(t => [t, TNAME[t]]);
  return {
    title: 'Банк заданий', wide: true,
    html: `${hdr('Банк заданий', { back: '#/t/content', sub: `${r.total} ${plural(r.total, 'задание', 'задания', 'заданий')}`, right: `<button class="btn sm" data-act="imp">${ic('upload', 16)} Импорт JSON</button>` })}
    <div class="toolbar bankbar"><input class="inp search" type="search" placeholder="Поиск по id или тексту" value="${esc(f.q)}" data-f="q" aria-label="Поиск">
      <select class="inp" data-f="section" aria-label="Секция">${opts([['R', 'Reading'], ['L', 'Listening'], ['W', 'Writing'], ['S', 'Speaking']], f.section, 'Все секции')}</select>
      <select class="inp" data-f="task" aria-label="Задание">${opts(tasks, f.task, 'Все задания')}</select>
      <select class="inp" data-f="level" aria-label="Уровень">${opts([['A', 'A'], ['B', 'B'], ['C', 'C']], f.level, 'Любой уровень')}</select>
      <select class="inp" data-f="status" aria-label="Статус">${opts(Object.entries(STATUS), f.status, 'Любой статус')}</select></div>
    <div class="card tblwrap"><table class="tbl bank"><thead><tr><th>Id</th><th>Начало</th><th>Ур.</th><th>Статус</th><th>Ответов</th><th>Верно</th></tr></thead>
      <tbody>${r.items.map(i => `<tr data-act="bank-open" data-id="${esc(i.id)}"><td><b>${esc(i.id)}</b></td><td class="fade small">${esc(headText(i.head))}</td><td>${i.level}</td>
        <td><span class="chip ${i.status === 'active' ? 'ok' : i.status === 'retired' ? 'bad' : ''}">${STATUS[i.status]}</span></td><td class="num">${i.n || '—'}</td><td class="num">${i.n >= 5 ? Math.round(i.got / i.n * 100) + '%' : '—'}</td></tr>`).join('') || '<tr><td colspan="6" class="fade">Ничего не найдено</td></tr>'}</tbody></table></div>
    ${r.total > r.items.length ? `<p class="fade small" style="margin:10px 2px">Показаны первые ${r.items.length}. Уточните поиск или фильтры.</p>` : ''}`,
    mount(root) {
      const bar = root.querySelector('.bankbar'); if (!bar) return;
      const go = () => { const p = new URLSearchParams(); bar.querySelectorAll('[data-f]').forEach(e => e.value && p.set(e.dataset.f, e.value)); location.hash = '#/t/bank' + ([...p].length ? '?' + p : ''); };
      bar.querySelectorAll('select').forEach(s => s.addEventListener('change', () => { if (s.dataset.f === 'section') bar.querySelector('[data-f=task]').value = ''; go(); }));
      let t; bar.querySelector('[data-f=q]').addEventListener('input', () => { clearTimeout(t); t = setTimeout(go, 500); });
      const q = bar.querySelector('[data-f=q]'); if (f.q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
    }
  };
}

let OPEN = null;
on('bank-open', async el => {
  try {
    const r = await src.bankItem(el.dataset.id); OPEN = r.item;
    const json = JSON.stringify({ id: r.item.id, section: r.item.section, task: r.item.task, level: r.item.level, status: r.item.status, body: r.item.body, key: r.item.key, explain: r.item.explain, qtypes: r.item.qtypes }, null, 1);
    modal(`<h2>${esc(r.item.id)}</h2><p class="mut small" style="margin-bottom:8px">${TNAME[r.item.task] || r.item.task} · ${r.item.level} · ответов: ${r.stats.n}${r.stats.n >= 5 ? ', верно ' + Math.round(r.stats.correct / r.stats.n * 100) + '%' : ''}</p>
      <div class="seg" style="margin-bottom:10px">${Object.entries(STATUS).map(([v, l]) => `<button class="${r.item.status === v ? 'on' : ''}" data-act="bank-status" data-v="${v}">${l}</button>`).join('')}</div>
      ${r.item.body?.audio ? `<audio controls preload="none" src="${esc(r.item.body.audio)}" style="width:100%;margin-bottom:10px"></audio>` : ''}
      <div class="field"><label for="b-json">Содержимое (JSON) — можно править</label><textarea class="inp" id="b-json" rows="14" spellcheck="false" style="font-family:ui-monospace,monospace;font-size:12.5px">${esc(json)}</textarea></div>
      <div class="row-btns"><button class="btn" data-act="modal-close">Закрыть</button><button class="btn pri" data-act="bank-save">Сохранить</button></div>`, { cls: 'wide' });
  } catch (e) { toast(e.message); }
});
on('bank-status', async el => { try { await src.setItemStatus(OPEN.id, el.dataset.v); toast('Статус: ' + STATUS[el.dataset.v]); closeModal(); rerender(); } catch (e) { toast(e.message); } });
on('bank-save', async () => {
  let it; try { it = JSON.parse(document.getElementById('b-json').value); } catch (e) { toast('Ошибка JSON: ' + e.message); return; }
  try { const r = await src.importItems([it]); toast('Сохранено'); closeModal(); rerender(); return r; } catch (e) { toast(e.message + (e.details ? ' · ' + JSON.stringify(e.details).slice(0, 120) : '')); }
});

on('imp', () => {
  if (!isLive()) { toast('Импорт работает в аккаунте'); return; }
  modal(`<h2>Импорт заданий</h2><p class="mut small" style="margin-bottom:10px">Массив JSON: <code>{id, section, task, level, body, key, explain, qtypes, status}</code>. Существующие id обновляются. До 500 за раз.</p>
    <div class="field"><input class="inp" type="file" id="imp-file" accept=".json,application/json"></div>
    <div class="field"><textarea class="inp" id="imp-json" rows="9" spellcheck="false" placeholder="[ { &quot;id&quot;: &quot;R-CTW-B-901&quot;, … } ]" style="font-family:ui-monospace,monospace;font-size:12.5px"></textarea></div>
    <div class="row-btns"><button class="btn" data-act="modal-close">Отмена</button><button class="btn pri" data-act="imp-go">Загрузить</button></div>`, { cls: 'wide' });
  document.getElementById('imp-file').addEventListener('change', async e => { const f = e.target.files[0]; if (f) document.getElementById('imp-json').value = await f.text(); });
});
on('imp-go', async () => {
  let list; try { list = JSON.parse(document.getElementById('imp-json').value); } catch (e) { toast('Ошибка JSON: ' + e.message); return; }
  if (!Array.isArray(list)) list = [list];
  try { const r = await src.importItems(list); toast(`Загружено: ${r.imported}`); closeModal(); rerender(); }
  catch (e) { toast(e.message + (e.details ? ' · ' + e.details.slice(0, 3).map(d => `${d.id}: ${d.fields}`).join('; ') : '')); }
});

/* ------------------------------------------------------------------ content overview (live) */
export async function contentLive() {
  const rows = await src.bankStats();
  const by = {};
  rows.forEach(r => { const k = r.section + ':' + r.task, o = (by[k] ||= { section: r.section, task: r.task, lv: { A: 0, B: 0, C: 0 }, n: 0, cal: 0 }); o.lv[r.level] += r.n; o.n += r.n; o.cal += r.calibrated || 0; });
  const list = Object.values(by).sort((a, b) => 'RLWS'.indexOf(a.section) - 'RLWS'.indexOf(b.section));
  return {
    title: 'Контент', wide: true,
    html: `${hdr('Контент', { sub: `Банк заданий · ${list.reduce((a, b) => a + b.n, 0)} единиц`, right: `<a class="btn sm" href="#/t/bank">${ic('list', 16)} Все задания</a> <button class="btn sm" data-act="imp">${ic('upload', 16)} Импорт JSON</button>` })}
    <div class="card tblwrap"><table class="tbl bank"><thead><tr><th>Задание</th><th>Всего</th><th>A · B · C</th><th>Откалибровано</th><th></th></tr></thead>
      <tbody>${list.map(b => `<tr data-act="go" data-go="#/t/bank?section=${b.section}&task=${b.task}"><td><div class="who-s c${b.section}"><span class="sq sm">${ic(SEC[b.section].ic, 16)}</span><b>${TNAME[b.task] || b.task}</b></div></td>
        <td class="num">${b.n}</td><td><div class="lvbar">${['A', 'B', 'C'].map((l, i) => `<i class="lv${i}" style="flex:${b.lv[l] || 0.2}" title="${l}: ${b.lv[l]}">${b.lv[l]}</i>`).join('')}</div></td>
        <td>${'RL'.includes(b.section) ? `<div class="calc"><div class="bar"><i style="width:${Math.round(b.cal / b.n * 100)}%"></i></div><span>${Math.round(b.cal / b.n * 100)}%</span></div>` : '<span class="fade small">оценивает учитель</span>'}</td>
        <td class="fade">${ic('right', 18)}</td></tr>`).join('')}</tbody></table></div>
    <div class="g-two">
      <div class="card pad"><div class="nm">Статусы</div><p class="mut small" style="margin-top:4px"><b>в тренировке</b> — видят ученики; <b>банк пробников</b> — зарезервировано под пробные тесты и в тренировке не показывается; <b>черновик</b> — например, Listening без озвучки; <b>снято</b> — в архиве.</p></div>
      <div class="card pad"><div class="nm">Калибровка</div><p class="mut small" style="margin-top:4px">Трудность задания пересчитывается после 30+ ответов учеников.</p></div>
    </div>`
  };
}
on('go', el => { location.hash = el.dataset.go; });

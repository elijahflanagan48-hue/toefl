// Teacher cabinet (P9): student card, assignments with deadlines, bank browser with import / edit.
import * as src from '../data/source.js';
import { isLive } from '../lib/api.js';
import { ic } from '../lib/icons.js';
import { band, cefr, overallBand, heat, SEC, esc, plural } from '../lib/util.js';
import { hdr, on, toast, modal, closeModal } from '../lib/ui.js';
import { ASSIGN_TASKS, MODE_NAMES, SECTION_NAMES, buildAssignments } from '../lib/assign.js';

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
  const wrows = (list, k) => list.map(([n, v]) => `<a class="qb c${k}" href="#/t/student/${st.id}/log/${k}/${encodeURIComponent(n)}" title="Показать ответы ученика"><span class="qn">${esc(n)}</span><div class="bar"><i style="width:${v.acc}%;background:${v.acc < 60 ? 'var(--sS)' : 'var(--ok)'}"></i></div><b>${v.acc}%</b>${ic('right', 16)}</a>`).join('');
  const att = d.attempts.filter(a => a.finished_at).slice(0, 8);
  const subs = d.submissions.slice(0, 8);
  return {
    title: st.name, wide: true,
    html: `${hdr(st.name, { back: '#/t/students', sub: [st.group_name, st.email].filter(Boolean).join(' · '), right: `<button class="btn sm pri" data-act="assign" data-sid="${st.id}" aria-label="Назначить">${ic('plus', 16)}<span class="bl"> Назначить</span></button>` })}
    <div class="kpis">${['R', 'L', 'W', 'S'].map(k => `<div class="kpi"><span class="sc ${heat(f[k], st.target ?? 4.5)}">${f[k] == null ? 'нет' : band(f[k])}</span><b class="serif" style="font-size:15px">${SEC[k].name}</b><span>прогноз</span></div>`).join('')}
      <div class="kpi hot">${ic('trend', 20)}<b class="serif">${ov == null ? '—' : band(ov)}</b><span>общий${ov == null ? '' : ' · ' + cefr(ov)} · цель ${band(st.target ?? 4.5)}</span></div></div>
    <div class="g-two">
      <section><div class="lbl">Слабые типы вопросов</div>
        <div class="card pad weak">${weakR.length || weakW.length ? `${wrows(weakR, 'R')}${wrows(weakW, 'W')}` : '<p class="mut">Пока мало ответов: нужно хотя бы 3 вопроса каждого типа.</p>'}
          <div class="row-btns" style="margin-top:12px"><button class="btn sm" data-act="assign" data-sid="${st.id}">${ic('plus', 16)} Назначить тренажёр</button>
            <a class="btn sm ghost" href="#/t/student/${st.id}/log/R">Все ответы Reading</a><a class="btn sm ghost" href="#/t/student/${st.id}/log/W">Writing</a><a class="btn sm ghost" href="#/t/student/${st.id}/log/L">Listening</a></div></div>
        <div class="lbl">Последние попытки</div>
        ${att.length ? `<div class="card tblwrap"><table class="tbl"><thead><tr><th>Дата</th><th>Что</th><th>Баллы</th></tr></thead><tbody>${att.map(a => `<tr><td>${dateLabel(a.finished_at)}</td>
          <td>${a.kind === 'mock' ? `<a href="#/mock/result/${a.id}"><b>Пробник ${esc((a.task || '').replace(/^T/, ''))}</b></a> · <a href="#/t/student/${st.id}/attempt/${a.id}">ответы</a>` : `<a href="#/t/student/${st.id}/attempt/${a.id}"><b>${KIND[a.kind] || a.kind}</b></a>`}${a.section ? ' · ' + SEC[a.section].name : ''}${a.route?.R ? ` · ${a.route.R === 'upper' ? 'трудный' : 'лёгкий'} модуль 2` : ''}</td>
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
    ${list.length ? `<div class="card tblwrap"><table class="tbl"><thead><tr><th>Задание</th><th>Кому</th><th>Срок</th><th>Выполнили</th><th></th></tr></thead><tbody>${groupAssignments(list).map(g => {
      const a = g.parts[0], late = a.due_at && a.due_at < now && g.parts.some(p => p.done < p.targets);
      const bar = p => { const pct = p.targets ? Math.round(p.done / p.targets * 100) : 0; return `<div class="calc"><div class="bar"><i style="width:${pct}%"></i></div><span>${p.done} из ${p.targets}</span></div>`; };
      const ids = g.parts.map(p => p.id).join(',');
      const who = `<td>${esc(a.group_name || a.student_name || '—')}</td><td>${a.due_at ? dateLabel(a.due_at) : 'без срока'}${late ? ' <em class="badtx">просрочено</em>' : ''}<div><button class="linkbtn" data-act="due-edit" data-id="${ids}" data-due="${a.due_at || ''}" data-nm="${esc(g.parts.length > 1 ? g.label : a.title)}">изменить срок</button></div></td>`;
      if (g.parts.length === 1) return `<tr><td><a href="#/t/assign/${a.id}"><b>${esc(a.title)}</b></a><div class="fade small">${MODE_NAMES[a.spec?.mode] || ''}</div></td>
        ${who}<td>${bar(a)}</td>
        <td><a class="btn sm" href="#/t/assign/${a.id}">Результаты</a> <button class="btn sm ghost" data-act="assign-del" data-id="${a.id}" data-nm="${esc(a.title)}">Удалить</button></td></tr>`;
      return `<tr class="aset"><td><b>${esc(g.label)}</b><div class="fade small">${g.parts.length} ${plural(g.parts.length, 'задание', 'задания', 'заданий')} · ${MODE_NAMES[a.spec?.mode] || ''}</div>
        <ul class="aparts">${g.parts.map(p => `<li><a href="#/t/assign/${p.id}">${esc(p.title.replace(/^[^:]*: /, ''))}</a></li>`).join('')}</ul></td>
        ${who}<td>${g.parts.map(p => `<div class="aprog"><span class="fade small">${esc(p.title.replace(/^[^:]*: /, ''))}</span>${bar(p)}</div>`).join('')}</td>
        <td><button class="btn sm ghost" data-act="assign-del" data-id="${ids}" data-nm="${esc(g.label)} (${g.parts.length} ${plural(g.parts.length, 'задание', 'задания', 'заданий')})">Удалить всё</button></td></tr>`;
    }).join('')}</tbody></table></div>`
      : `<div class="card empty"><b>Назначений пока нет</b>Назначьте задания группе или ученику — они появятся у них на главной с дедлайном.<br><br><button class="btn sm pri" data-act="assign">${ic('plus', 16)} Назначить</button></div>`}`
  };
}
/** tasks created together share spec.set → shown as one row; everything else is a row of its own */
function groupAssignments(list) {
  const out = [], bySet = new Map();
  for (const a of list) {
    const k = a.spec?.set;
    if (!k) { out.push({ parts: [a] }); continue; }
    if (!bySet.has(k)) { const g = { label: a.spec.setLabel || 'Набор заданий', parts: [] }; bySet.set(k, g); out.push(g); }
    bySet.get(k).parts.push(a);
  }
  for (const g of out) g.parts.sort((x, y) => x.id - y.id); // in the order they were picked
  return out;
}
/* change the deadline of an assignment (all tasks of a set at once) */
const dateInput = ms => ms ? new Date(Number(ms)).toLocaleDateString('sv-SE') : '';
on('due-edit', el => {
  const many = el.dataset.id.includes(',');
  modal(`<h2>Срок выполнения</h2><p class="mut" style="margin-bottom:12px">«${esc(el.dataset.nm)}»${many ? ' — срок изменится у всех заданий набора' : ''}</p>
    <div class="field"><label for="d-due">Новая дата</label><input class="inp" id="d-due" type="date" value="${dateInput(el.dataset.due)}"></div>
    <div class="row-btns"><button class="btn" data-act="modal-close">Отмена</button>
      ${el.dataset.due ? `<button class="btn ghost" data-act="due-go" data-id="${el.dataset.id}" data-clear="1">Без срока</button>` : ''}
      <button class="btn pri" data-act="due-go" data-id="${el.dataset.id}">Сохранить</button></div>`);
});
on('due-go', async el => {
  const v = document.getElementById('d-due').value;
  if (!el.dataset.clear && !v) { toast('Выберите дату или нажмите «Без срока»'); return; }
  const due = el.dataset.clear ? null : new Date(v + 'T23:59:00').getTime();
  el.disabled = true;
  try { await src.setAssignmentsDue(el.dataset.id.split(',').map(Number), due); closeModal(); toast(due ? 'Срок изменён' : 'Срок убран'); rerender(); }
  catch (e) { el.disabled = false; toast(e.message); }
});
on('assign-del', el => modal(`<h2>Удалить назначение?</h2><p class="mut" style="margin-bottom:14px">«${esc(el.dataset.nm)}» ${el.dataset.id.includes(',') ? 'исчезнут' : 'исчезнет'} у учеников. Сделанные работы останутся.</p>
  <button class="btn pri block" data-act="assign-del-go" data-id="${el.dataset.id}">Удалить</button><button class="btn ghost block" data-act="modal-close" style="margin-top:6px">Отмена</button>`));
on('assign-del-go', async el => { try { for (const id of String(el.dataset.id).split(',')) await src.deleteAssignment(id); closeModal(); toast('Удалено'); rerender(); } catch (e) { toast(e.message); } });

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
    <div class="field"><label>Что назначить <span class="fade small">— можно отметить несколько заданий или сразу весь раздел</span></label>
      <div class="picklist">${['R', 'L', 'W', 'S', 'M'].map(sec => {
        const ts = ASSIGN_TASKS.filter(t => t.section === sec), core = ts.filter(t => t.core);
        return `<fieldset class="pickgrp"><legend>${SECTION_NAMES[sec]}</legend>
          ${core.length ? `<label class="pick all"><input type="checkbox" data-pick="all" data-sec="${sec}"> <b>Весь ${SECTION_NAMES[sec]}</b> <span class="fade small">${core.length} типа заданий</span></label>` : ''}
          ${ts.map(t => `<label class="pick"><input type="checkbox" name="a-task" value="${t.v}" data-core="${t.core ? 1 : ''}" data-sec="${sec}" data-pick="one"> ${esc(t.nm.replace(/^[^·]*· /, ''))}</label>`).join('')}</fieldset>`;
      }).join('')}</div>
      <div class="fade small" id="a-count" role="status" style="margin-top:6px">Выберите хотя бы одно задание</div></div>
    <div class="field"><label for="a-mode">Режим</label><select class="inp" id="a-mode"><option value="learn">${MODE_NAMES.learn}</option><option value="timed">${MODE_NAMES.timed}</option></select></div>
    <div class="field"><label for="a-due">Срок (необязательно)</label><input class="inp" id="a-due" type="date" value="${tomorrow}"></div>
    <div class="row-btns"><button class="btn" data-act="modal-close">Отмена</button><button class="btn pri" data-act="assign-go" disabled>Назначить</button></div>`);
  if (sid) document.getElementById('a-to').value = 's' + sid;
});
const pickBoxes = () => [...document.querySelectorAll('input[name="a-task"]')];
function syncPick() {
  const boxes = pickBoxes();
  for (const all of document.querySelectorAll('input[data-pick="all"]')) {
    const core = boxes.filter(b => b.dataset.sec === all.dataset.sec && b.dataset.core), n = core.filter(b => b.checked).length;
    all.checked = n === core.length; all.indeterminate = n > 0 && n < core.length;
  }
  const n = boxes.filter(b => b.checked).length;
  document.getElementById('a-count').textContent = n ? `Выбрано: ${n}` : 'Выберите хотя бы одно задание';
  document.querySelector('[data-act="assign-go"]').disabled = !n;
}
/* plain click listener, not data-act: the global data-act handler calls preventDefault, which would undo a checkbox toggle */
document.addEventListener('click', e => {
  const box = e.target instanceof Element && e.target.closest('input[data-pick]');
  if (!box) return;
  if (box.dataset.pick === 'all') for (const b of pickBoxes()) if (b.dataset.sec === box.dataset.sec && b.dataset.core) b.checked = box.checked;
  syncPick();
});
on('assign-go', async el => {
  const to = document.getElementById('a-to').value, mode = document.getElementById('a-mode').value, dueS = document.getElementById('a-due').value;
  const picked = pickBoxes().filter(b => b.checked).map(b => b.value);
  if (!picked.length) { toast('Отметьте хотя бы одно задание'); return; }
  const { items, setLabel } = buildAssignments(picked, mode);
  const payload = { items, set_label: setLabel, due_at: dueS ? new Date(dueS + 'T23:59:00').getTime() : undefined };
  if (to[0] === 'g') payload.group_id = Number(to.slice(1)); else payload.student_id = Number(to.slice(1));
  el.disabled = true;
  try { await src.createAssignment(payload); closeModal(); toast(items.length > 1 ? `Назначено: ${items.length}` : 'Назначено'); if (location.hash.startsWith('#/t/assign')) rerender(); else location.hash = '#/t/assign'; }
  catch (e) { el.disabled = false; toast(e.message); }
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
    <a class="note info" href="#/t/calibration" style="margin-bottom:12px">${ic('trend', 22)}<div class="t"><div class="nm">Калибровка заданий</div><div class="mt">Сложность и качество заданий по ответам учеников: какие перевести на другой уровень, где проверить ключ</div></div></a>
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

/* ------------------------------------------------------------------ results of one assignment (for the lesson) */
const L = i => 'ABCD'[i];
const docText = d => [d.head, d.subject, ...(d.paras || []), ...(d.msgs || []).map(m => (m.from ? m.from + ': ' : '') + m.text), ...(d.rows || []).map(r => r.join(' | ')), d.foot].filter(Boolean).join('\n');
function ctxOf(it) {
  const b = it.body;
  if (it.task === 'rdl') return docText(b.doc || {});
  if (it.task === 'rap') return (b.paras || []).map(p => p.join(' ')).join('\n\n');
  if (it.task === 'ctw') return (b.first || '') + ' ' + (b.parts || []).map(p => (p.t != null ? p.t : `${p.pre || ''}${p.keep}${'_'.repeat(p.n)}${p.post || ''}`)).join('');
  if (['lcr', 'lco', 'lan', 'lat'].includes(it.task)) return it.task === 'lcr' ? '' : (it.explain?.[b.qs.length] || '');
  return '';
}
const who = (list, names) => list.map(r => esc(names[r.user_id] || '?')).join(', ');
function qBlock(it, q, rows, names) {
  const n = rows.length, wrong = rows.filter(r => r.correct === 0), key = Array.isArray(it.key) ? it.key[q] : it.key;
  const expl = Array.isArray(it.explain) ? it.explain[q] : it.explain;
  const head = `<div class="rq-h"><span class="chip ${wrong.length ? 'bad' : 'ok'}">${n - wrong.length} из ${n}</span><span class="fade small">${esc(it.qtypes?.[q] || '')}</span></div>`;
  let body = '';
  if (['rdl', 'rap', 'lcr', 'lco', 'lan', 'lat'].includes(it.task)) {
    const qq = it.body.qs[q];
    body = `<p class="rq-s"><b>${q + 1}.</b> ${esc(qq.stem)}</p><ul class="rq-o">${qq.opts.map((o, i) => {
      const pick = rows.filter(r => Number(r.answer) === i);
      return `<li class="${i === key ? 'key' : pick.length ? 'bad' : ''}"><b>${L(i)}</b> <span>${esc(o)}</span>${pick.length ? `<em>${pick.length}: ${who(pick, names)}</em>` : ''}</li>`;
    }).join('')}</ul>`;
  } else if (it.task === 'ctw') {
    const p = it.body.parts.filter(x => x.keep != null)[q];
    body = `<p class="rq-s"><b>Пропуск ${q + 1}.</b> ${esc(p?.pre || '')}<b>${esc(p?.keep || '')}</b><u>${esc(String(key))}</u>${esc(p?.post || '')}</p>
      ${wrong.length ? `<ul class="rq-o">${wrong.map(r => `<li class="bad"><span>${esc(String(r.answer ?? '—'))}</span><em>${esc(names[r.user_id] || '?')}</em></li>`).join('')}</ul>` : ''}`;
  } else if (it.task === 'bas') {
    body = `<p class="rq-s"><b>Ответ:</b> ${esc((key || []).join(' '))}</p>${wrong.length ? `<ul class="rq-o">${wrong.map(r => `<li class="bad"><span>${esc(Array.isArray(r.answer) ? r.answer.join(' ') : String(r.answer ?? '—'))}</span><em>${esc(names[r.user_id] || '?')}</em></li>`).join('')}</ul>` : ''}`;
  }
  return `<div class="rq">${head}${body}${expl ? `<div class="rq-e">${esc(String(expl)).replace(/\n/g, '<br>')}</div>` : ''}</div>`;
}

export async function assignResults(params) {
  if (!isLive()) return { title: 'Результаты', html: needLive('В демо-режиме результаты недоступны.') };
  const r = await src.assignmentResults(params[0]);
  const a = r.assignment, names = Object.fromEntries(r.students.map(s => [s.id, s.name]));
  const done = r.students.filter(s => s.finished || s.subs.length).length;
  const scored = r.students.filter(s => s.n);
  const acc = scored.length ? Math.round(scored.reduce((x, s) => x + s.got, 0) / scored.reduce((x, s) => x + s.n, 0) * 100) : null;
  // items ordered by error rate
  const byItem = {};
  r.responses.forEach(x => { ((byItem[x.item_id] ||= {})[x.q] ||= []).push(x); });
  const itemList = Object.keys(byItem).map(id => {
    const rows = Object.values(byItem[id]).flat(), graded = rows.filter(x => x.correct != null);
    return { id, bad: graded.length ? 1 - graded.reduce((s, x) => s + x.correct, 0) / graded.length : 0 };
  }).filter(x => r.items[x.id]).sort((x, y) => y.bad - x.bad);
  const blocks = itemList.map(({ id, bad }) => {
    const it = r.items[id], ctx = ctxOf(it), qs = Object.keys(byItem[id]).map(Number).sort((x, y) => x - y);
    return `<article class="card pad rq-item"><div class="rq-top"><b>${esc(id)}</b><span class="fade small">${TNAME[it.task] || it.task} · ${it.level}</span><span class="chip ${bad > 0.3 ? 'bad' : bad > 0 ? 'warn' : 'ok'}">ошибок ${Math.round(bad * 100)}%</span></div>
      ${it.body?.audio ? `<audio controls preload="none" src="${esc(it.body.audio)}" style="width:100%;margin:6px 0"></audio>` : ''}
      ${ctx ? `<details class="rq-ctx"><summary>${it.task.startsWith('l') ? 'Расшифровка' : 'Текст'}</summary><p>${esc(ctx).replace(/\n/g, '<br>')}</p></details>` : ''}
      ${qs.map(q => qBlock(it, q, byItem[id][q], names)).join('')}</article>`;
  }).join('');
  return {
    title: a.title, wide: true,
    html: `${hdr(a.title, { back: '#/t/assign', sub: `${a.group_name || a.student_name || ''}${a.due_at ? ' · до ' + dateLabel(a.due_at) : ' · без срока'}`, right: `<button class="btn sm" data-act="due-edit" data-id="${a.id}" data-due="${a.due_at || ''}" data-nm="${esc(a.title)}">Срок</button>` })}
    <div class="kpis"><div class="kpi">${ic('users', 20)}<b class="serif">${done} из ${r.students.length}</b><span>выполнили</span></div>
      <div class="kpi">${ic('check', 20)}<b class="serif">${acc == null ? '—' : acc + '%'}</b><span>верных ответов</span></div>
      <div class="kpi">${ic('alert', 20)}<b class="serif">${itemList.filter(x => x.bad > 0.3).length}</b><span>заданий с ошибками > 30%</span></div></div>
    <div class="lbl">Ученики</div>
    <div class="card tblwrap"><table class="tbl"><thead><tr><th>Ученик</th><th>Статус</th><th>Верно</th><th>Работы</th></tr></thead><tbody>${r.students.map(s => `<tr><td><b>${esc(s.name)}</b></td>
      <td>${s.finished || s.subs.length ? '<span class="chip ok">сделано</span>' : s.attempts ? '<span class="chip warn">начал</span>' : '<span class="chip">не начал</span>'}</td>
      <td class="num">${s.n ? `${s.got} из ${s.n} · ${Math.round(s.got / s.n * 100)}%` : '—'}</td>
      <td>${s.subs.map(x => `<a class="btn sm" href="#/t/review/${x.id}">${x.status === 'pending' ? 'проверить' : 'оценка ' + band(x.score)}</a>`).join(' ') || '<span class="fade">—</span>'}</td></tr>`).join('')}</tbody></table></div>
    ${blocks ? `<div class="lbl">Разбор для урока <b>сначала самые трудные</b></div>${blocks}` : (a.spec?.section === 'W' || a.spec?.section === 'S') ? '' : '<div class="card empty"><b>Ответов пока нет</b>Как только ученики выполнят задание, здесь появится разбор.</div>'}`
  };
}

/* ---------------- calibration: difficulty of bank items from student answers ---------------- */
const FLAG = { easy: ['слишком лёгкое (>90% верных)', 'warn'], hard: ['слишком трудное (<20% верных)', 'warn'], weak: ['слабо различает сильных и слабых', 'warn'],
  inverted: ['сильные отвечают хуже слабых: проверьте ключ', 'bad'], 'key?': ['сильные чаще выбирают другой вариант: проверьте ключ', 'bad'] };
const FLAG_SHORT = { easy: 'лёгкое', hard: 'трудное', weak: 'слабо различает', inverted: 'проверьте ключ', 'key?': 'проверьте ключ' };
const TSHORT = { ctw: 'CtW', rdl: 'Daily Life', rap: 'Academic', lcr: 'Response', lco: 'Conversation', lan: 'Announcement', lat: 'Talk', bas: 'Build a Sentence' };
export async function calibrationView() {
  if (!isLive()) return { title: 'Калибровка', html: needLive('В демо-режиме калибровка недоступна.') };
  const task = new URLSearchParams(location.hash.split('?')[1] || '').get('task') || '';
  const r = await src.calibration(task);
  const tasks = ['ctw', 'rdl', 'rap', 'lcr', 'lco', 'lan', 'lat', 'bas'];
  const kpi = (v, l) => `<div class="kpi"><b>${v}</b><span>${l}</span></div>`;
  const rows = r.items.map(i => {
    const move = i.rec && i.rec !== i.level;
    return `<tr><td><b>${esc(i.id)}</b></td><td>${TSHORT[i.task] || i.task}</td>
      <td>${i.level}${move ? ` → <b>${i.rec}</b>` : i.rec ? ' ✓' : ''}${i.cal_level ? ' <span class="fade small">(уже откалибровано)</span>' : ''}</td>
      <td class="num">${i.n}</td><td class="num">${i.n >= 5 ? Math.round(i.p * 100) + '%' : '—'}</td><td class="num">${i.rec ? i.b.toFixed(1) : '—'}</td><td class="num">${i.disc == null ? '—' : i.disc.toFixed(2)}</td>
      <td>${i.n < r.min_n ? `<span class="fade small">нужно ещё ${r.min_n - i.n}</span>` : i.flags.filter(f => !(f === 'weak' && (i.flags.includes('easy') || i.flags.includes('hard')))).map(f => `<span class="chip ${FLAG[f][1]}" title="${FLAG[f][0]}">${FLAG_SHORT[f]}</span>`).join(' ') || '<span class="fade">—</span>'}</td>
      <td>${move ? `<button class="btn sm" data-act="cal-apply" data-id="${esc(i.id)}">Применить</button>` : ''}</td></tr>`;
  }).join('');
  return {
    title: 'Калибровка', wide: true,
    html: `${hdr('Калибровка заданий', { back: '#/t/content', sub: `по первым ответам учеников · минимум ${r.min_n} ответов на задание`, right: r.to_move ? `<button class="btn sm pri" data-act="cal-apply-all">Применить всё (${r.to_move})</button>` : '' })}
    <div class="kpis">${kpi(r.with_data, 'заданий с ответами')}${kpi(r.ready, 'готово к оценке')}${kpi(r.to_move, 'сменят уровень')}${kpi(r.flagged, 'с флагами')}</div>
    <div class="toolbar"><select class="inp" id="cal-task" aria-label="Задание"><option value="">Все задания</option>${tasks.map(t => `<option value="${t}" ${t === task ? 'selected' : ''}>${TNAME[t]}</option>`).join('')}</select></div>
    ${r.items.length ? `<div class="card tblwrap" style="max-width:100%"><table class="tbl bank" style="min-width:0"><thead><tr><th>Id</th><th>Задание</th><th>Уровень</th><th>Ответов</th><th>Верно</th><th title="Сложность в логитах: −1 лёгкое, 0 среднее, +1 трудное">b</th><th title="Точечно-бисериальная корреляция: как хорошо задание отделяет сильных от слабых">Различение</th><th>Флаги</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="fade small" style="margin:10px 2px">Считаются только первые ответы каждого ученика (повторы не искажают картину). Уровень A — b ниже −0,5, C — выше +0,5. Применённый уровень сохраняется и не затирается при обновлении банка.</p>`
      : `<div class="card empty"><b>Ответов пока нет</b>Калибровка заработает, когда ученики начнут решать задания: для оценки нужно ${r.min_n}+ ответов на задание.</div>`}`,
    mount(root) { root.querySelector('#cal-task')?.addEventListener('change', e => { location.hash = '#/t/calibration' + (e.target.value ? '?task=' + e.target.value : ''); }); }
  };
}
on('cal-apply', async el => { try { const r = await src.applyCalibration({ ids: [el.dataset.id] }); toast(r.moved ? 'Уровень обновлён' : 'Сохранено'); rerender(); } catch (e) { toast(e.message); } });
on('cal-apply-all', async () => {
  modal(`<h2>Применить всё?</h2><p class="mut" style="margin-bottom:14px">Уровни всех заданий с достаточным числом ответов будут заменены рекомендованными. Содержимое пробников не меняется.</p>
    <div class="row-btns"><button class="btn" data-act="modal-close">Отмена</button><button class="btn pri" data-act="cal-apply-go">Применить</button></div>`);
});
on('cal-apply-go', async () => { try { const r = await src.applyCalibration({}); closeModal(); toast(`Обновлено: ${r.updated}, сменили уровень: ${r.moved}`); rerender(); } catch (e) { closeModal(); toast(e.message); } });

// Shared pieces for Write an Email / Academic Discussion: prompt rendering, word count,
// and fragment comments ("marks") that the teacher attaches to the student's text.
import { esc } from './util.js';
import { ic } from './icons.js';

export const WTASK = {
  eml: { name: 'Write an Email', min: 7, short: 'Email', dir: 'Read the situation and write an email. In your response, do all of the following.' },
  dsc: { name: 'Write for an Academic Discussion', min: 10, short: 'Academic Discussion', dir: 'Your professor is teaching a class. Write a post responding to the professor\'s question. In your response, express and support your opinion and make a contribution to the discussion. An effective response will contain at least 100 words.' }
};

export const countWords = t => (String(t || '').match(/[A-Za-z0-9'’-]+/g) || []).length;

/** exam-style prompt (left pane / review card) */
export function promptBlock(task, p, { compact = false } = {}) {
  if (!p) return '';
  if (task === 'eml') return `<div class="wprompt">
    ${compact ? `<div class="pr-k">${ic('file', 16)} Write an Email · 7 мин</div>` : `<p class="xdir">${esc(WTASK.eml.dir)}</p>`}
    <p>${esc(p.situation || '')}</p>
    ${p.bullets ? `<p class="wp-k">Write an email to ${esc(p.to || '')}. In your email, do the following:</p><ul>${p.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
    ${compact ? '' : `<p class="wp-tip">Write as much as you can and in complete sentences.</p>`}</div>`;
  return `<div class="wprompt">
    ${compact ? `<div class="pr-k">${ic('file', 16)} Academic Discussion · 10 мин${p.course ? ' · ' + esc(p.course) : ''}</div>` : `<p class="xdir">${esc(WTASK.dsc.dir)}</p>`}
    ${p.professor ? `<div class="post prof"><span class="pav">${esc((p.professor.name || 'P').replace(/^(Dr\.|Professor)\s*/, '')[0])}</span><div><b>${esc(p.professor.name || 'Professor')}</b>${p.course && !compact ? `<i>${esc(p.course)}</i>` : ''}<p>${esc(p.professor.text || '')}</p></div></div>` : ''}
    ${(p.students || []).map(s => `<div class="post"><span class="pav s">${esc(s.name[0])}</span><div><b>${esc(s.name)}</b><p>${esc(s.text)}</p></div></div>`).join('')}</div>`;
}

/* ---------- Teacher marks on the student's text ----------
 * mark = {s, e, t, note?, q?} by character offset into the raw text; the text itself is never changed.
 * t: hl-y / hl-g / hl-p (marker colours), u (underline), wav (wavy: error), x (strike: extra),
 *    ins (caret at s === e: something missing), cm (comment, note required). Old marks without t are comments.
 * Marks may overlap (e.g. underline + comment); within one family a new mark replaces the old one on that range. */
export const MK = {
  'hl-y': { l: 'Жёлтый маркер', m: 'обратить внимание', key: 'H' },
  'hl-g': { l: 'Зелёный маркер', m: 'удачно', key: 'G' },
  'hl-p': { l: 'Розовый маркер', m: 'ошибка', key: 'R' },
  u: { l: 'Подчеркнуть', m: 'подчёркнуто', key: 'U' },
  wav: { l: 'Волнистая линия', m: 'ошибка', key: 'W' },
  x: { l: 'Зачеркнуть', m: 'лишнее', key: 'X' },
  ins: { l: 'Пропуск ∧', m: 'здесь что-то пропущено', key: 'I' },
  cm: { l: 'Комментарий', m: 'комментарий', key: 'C' }
};
export const mkType = m => (m && MK[m.t] ? m.t : 'cm');
export const mkFamily = t => (t.startsWith('hl') ? 'hl' : t);

/** number (1, 2, …) for every mark that carries a note, in text order: Map(index → n) */
export function noteNumbers(marks = []) {
  const idx = (marks || []).map((m, i) => i).filter(i => (marks[i].note || '').trim()).sort((a, b) => marks[a].s - marks[b].s || marks[a].e - marks[b].e || a - b);
  return new Map(idx.map((i, k) => [i, k + 1]));
}

/** text with marks. Only empty spans and CSS pseudo-content are added, so root.textContent === text (selection offsets stay exact) */
export function markedHtml(text, marks = []) {
  text = String(text || '');
  const L = text.length, num = noteNumbers(marks);
  const list = (marks || []).map((m, i) => ({ s: m.s, e: m.e, t: mkType(m), i }))
    .filter(m => Number.isFinite(m.s) && Number.isFinite(m.e) && m.s >= 0 && m.e <= L && (m.e > m.s || (m.t === 'ins' && m.e === m.s)));
  const range = list.filter(m => m.e > m.s), ins = list.filter(m => m.e === m.s);
  const pts = [...new Set([0, L, ...list.flatMap(m => [m.s, m.e])])].sort((a, b) => a - b);
  const badge = m => num.has(m.i) ? `<span class="mn" data-mi="${m.i}" data-n="${num.get(m.i)}"></span>` : '';
  let out = '';
  for (let k = 0; k < pts.length; k++) {
    const a = pts[k];
    for (const m of ins) if (m.s === a) out += `<span class="mk mk-ins" data-mi="${m.i}" title="${MK.ins.m}"></span>${badge(m)}`;
    if (k === pts.length - 1) break;
    const b = pts[k + 1];
    const cov = range.filter(m => m.s <= a && m.e >= b).sort((x, y) => (y.e - y.s) - (x.e - x.s) || x.i - y.i);
    let h = esc(text.slice(a, b));
    for (let j = cov.length - 1; j >= 0; j--) h = `<span class="mk mk-${cov[j].t}" data-mi="${cov[j].i}">${h}</span>`;
    out += h;
    for (const m of range) if (m.e === b) out += badge(m);
  }
  return out;
}

/** what a mark points at, for the list of notes */
export function markQuote(m, text = '') {
  if (mkType(m) === 'ins') {
    const before = String(text).slice(Math.max(0, m.s - 40), m.s).match(/([A-Za-z0-9'’-]+)\W*$/);
    return before ? `пропуск после «${before[1]}»` : 'пропуск в начале';
  }
  return `«${(m.q || String(text).slice(m.s, m.e)).slice(0, 120)}»`;
}

export function notesHtml(marks = [], { edit = false, text = '' } = {}) {
  const num = noteNumbers(marks);
  if (!num.size) return '';
  const rows = [...num.entries()].sort((a, b) => a[1] - b[1]).map(([i, n]) => {
    const m = marks[i], t = mkType(m);
    return `<div class="cmt"><b>${n}</b>${t !== 'cm' ? `<span class="mtag mk-${t}">${esc(MK[t].m)}</span>` : ''}<span class="cq">${esc(markQuote(m, text))}</span> ${esc(m.note)}${edit ? ` <button class="lnk sm" data-act="mark-edit" data-i="${i}">изменить</button><button class="lnk sm" data-act="mark-del" data-i="${i}">удалить</button>` : ''}</div>`;
  });
  return `<div class="cmts">${rows.join('')}</div>`;
}

/** legend for the student: only the kinds of marks that occur in this text */
export function legendHtml(marks = []) {
  const used = [...new Set((marks || []).map(mkType))].filter(t => t !== 'cm');
  if (!used.length) return '';
  return `<div class="mlegend">${Object.keys(MK).filter(t => used.includes(t)).map(t => `<span><i class="mk mk-${t}">${t === 'ins' ? '' : 'abc'}</i> ${esc(MK[t].m)}</span>`).join('')}</div>`;
}

/** apply a tool to a range: same family is cut out of the range; if the range was already fully covered by this
 * exact type, the call toggles it off. Returns the new array (input is not changed). */
export function applyMark(marks, t, o, extra = {}) {
  let cur = (marks || []).map(m => ({ ...m, t: mkType(m) }));
  if (t === 'ins') {
    cur = cur.filter(m => !(m.t === 'ins' && m.s === o.s));
    cur.push({ s: o.s, e: o.s, t: 'ins', ...extra });
    return cur;
  }
  if (o.e <= o.s) return cur;
  const fam = mkFamily(t);
  const same = cur.filter(m => m.t === t && m.e > m.s && m.s < o.e && m.e > o.s).sort((a, b) => a.s - b.s);
  let at = o.s; for (const m of same) { if (m.s > at) break; at = Math.max(at, m.e); }
  const toggleOff = !extra.note && at >= o.e;
  const next = [];
  for (const m of cur) {
    if (m.t === 'ins' || mkFamily(m.t) !== fam || m.e <= o.s || m.s >= o.e) { next.push(m); continue; }
    if (m.s < o.s) next.push({ ...m, e: o.s });
    if (m.e > o.e) next.push({ ...m, s: o.e, ...(m.s < o.s ? { note: undefined, q: undefined } : {}) });
  }
  if (!toggleOff) next.push({ s: o.s, e: o.e, t, ...extra });
  return next.map(m => { const c = { ...m }; if (!c.note) { delete c.note; delete c.q; } return c; }).sort((a, b) => a.s - b.s || a.e - b.e);
}

/** remove every mark touching the range (or the caret position) */
export function eraseMarks(marks, o) {
  return (marks || []).filter(m => m.e === m.s ? !(m.s >= o.s && m.s <= o.e) : !(m.s < Math.max(o.e, o.s + 1) && m.e > o.s));
}

/** shrink a selection so it doesn't start or end on spaces / line breaks (double-click often grabs a trailing space) */
export function trimRange(text, o) {
  let { s, e } = o;
  while (s < e && /\s/.test(text[s])) s++;
  while (e > s && /\s/.test(text[e - 1])) e--;
  return { s, e };
}

/** character offsets of the current selection inside `root` (whose text equals the raw string) */
export function selectionOffsets(root, { collapsed = false } = {}) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || (sel.isCollapsed && !collapsed)) return null;
  const r = sel.getRangeAt(0);
  if (!root.contains(r.startContainer) || !root.contains(r.endContainer)) return null;
  const pre = document.createRange();
  pre.selectNodeContents(root); pre.setEnd(r.startContainer, r.startOffset);
  const s = pre.toString().length, e = s + r.toString().length;
  return e > s || collapsed ? { s, e } : null;
}

/* ETS-style 0–5 scale descriptions and teacher checklist (shared by review and the student's view) */
export const RUBRIC = {
  email: ['Не по теме, пусто или скопировано', 'Почти непонятно, «телеграфный» язык', 'Попытка есть, но сообщение трудно понять', 'Задача решена частично, заметные ошибки', 'В основном эффективно, мало ошибок', 'Полностью эффективно, разнообразный и точный язык'],
  dsc: ['Не по теме, пусто или скопировано', 'Нет связных идей, язык из промпта', 'Идеи трудно отследить, слабо развёрнуто', 'В основном понятно, часть объяснения не хватает', 'Релевантно и развёрнуто, мало ошибок', 'Очень ясный вклад, точный и разнообразный язык'],
  interview: ['Нет ответа или не по теме', 'Отдельные слова, почти неразборчиво', 'Слабо связано с вопросом, трудно понять', 'Отвечает, но ограниченно, паузы мешают', 'Развёрнуто и понятно, небольшие шероховатости', 'Полно, бегло, точный и разнообразный язык'],
  lrp: ['Нет ответа / неразборчиво', 'Несколько слов', 'Значительная часть пропущена', 'Почти полностью, но смысл неточен', 'Смысл сохранён, мелкие замены', 'Точное повторение, разборчиво']
};
/* Teacher checklist: groups with a guiding question and tick-boxes. Ids are stored in ratings.criteria ({id: true/false});
 * the old text keys of earlier ratings still render (see critLabel). Every item is phrased positively: ticked = good. */
const G = (id, t, q, items) => ({ id, t, q, items: items.map(([k, label]) => ({ id: id + '.' + k, t: label })) });
export const CRIT = {
  email: [
    G('task', 'Задача и содержание', 'Достиг ли ученик цели письма?', [['all', 'Закрыты все пункты задания'], ['detail', 'Есть конкретные детали, а не общие слова']]),
    G('tone', 'Адресат и тон', 'Подходит ли тон тому, кому пишут?', [['reg', 'Приветствие, прощание и регистр соответствуют адресату'], ['polite', 'Вежливые формулы просьбы и благодарности']]),
    G('org', 'Структура и связность', 'Легко ли читать? Видна ли логика?', [['parts', 'Есть начало, основная часть и завершение'], ['flow', 'Мысли связаны (связки, переходы)']]),
    G('lang', 'Язык', 'Мешают ли ошибки понять смысл?', [['clear', 'Ошибки не мешают пониманию'], ['range', 'Грамматика и лексика достаточно разнообразны и точны']]),
    G('own', 'Самостоятельность и оформление', 'Это собственный текст, оформленный аккуратно?', [['own', 'Нет заученных шаблонов и копирования задания'], ['spell', 'Орфография и пунктуация в порядке']])
  ],
  dsc: [
    G('pos', 'Позиция', 'Понятно ли, на чьей стороне ученик и почему?', [['clear', 'Чёткая позиция, названа в начале']]),
    G('contrib', 'Вклад в обсуждение', 'Добавил ли ученик что-то новое к постам студентов?', [['react', 'Откликается на пост студента (согласие, возражение)'], ['new', 'Есть новая мысль, а не повтор постов']]),
    G('arg', 'Аргументация', 'Чем подкреплена позиция?', [['why', 'Названы причины'], ['ex', 'Есть пример или пояснение']]),
    G('dev', 'Объём и связность', 'Развёрнут ли ответ и легко ли следить за мыслью?', [['len', 'Не меньше 100 слов, ответ законченный'], ['flow', 'Мысли идут в логичном порядке']]),
    G('lang', 'Язык', 'Мешают ли ошибки понять смысл?', [['clear', 'Ошибки не мешают, структуры разнообразны'], ['own', 'Нет заученных шаблонов']])
  ],
  interview: [
    G('dev', 'Содержание', 'Ответил ли на вопрос и развил ли мысль?', [['ans', 'Отвечает по существу, есть причина или пример'], ['time', 'Использовано время, ответ законченный']]),
    G('flu', 'Беглость', 'Говорит плавно или останавливается?', [['flow', 'Речь плавная, паузы и повторы не мешают'], ['pace', 'Естественный темп']]),
    G('pron', 'Произношение', 'Понятно ли без напряжения?', [['int', 'Понятно с первого раза'], ['stress', 'Ударение и интонация в основном верные']]),
    G('lang', 'Грамматика и лексика', 'Мешают ли ошибки понять смысл?', [['clear', 'Ошибки не мешают пониманию'], ['range', 'Лексика и структуры разнообразны']]),
    G('tech', 'Запись', 'Достаточно ли качественная запись?', [['rec', 'Запись слышна, шум не мешает']])
  ],
  lrp: [
    G('acc', 'Точность', 'Все ли слова повторены в правильном порядке?', [['content', 'Знаменательные слова на месте'], ['func', 'Служебные слова и окончания (-s, -ed, артикли) сохранены'], ['order', 'Порядок слов верный, смысл не изменён']]),
    G('pron', 'Произношение', 'Разборчиво ли?', [['int', 'Разборчиво с первого раза'], ['sounds', 'Трудные звуки и ударение не мешают']]),
    G('rhy', 'Ритм', 'Похоже ли на естественную речь?', [['rhythm', 'Естественный ритм и интонация, говорит фразой, а не по слову']]),
    G('proc', 'Процесс', 'Как проходило повторение?', [['restart', 'Нет перезапусков, ответ на каждое предложение']])
  ]
};
export const critFlat = kind => (CRIT[kind] || []).flatMap(g => g.items);
/** label for a stored key: new ids → label; old ratings stored the label text itself */
export const critLabel = (kind, key) => critFlat(kind).find(c => c.id === key)?.t || key;
/** rough score hint from the ticks: share of ticked items → 0–5 (a guide, not a verdict) */
export const critHint = (kind, checked) => { const all = critFlat(kind); const n = all.filter(c => checked[c.id]).length; return all.length ? { n, of: all.length, score: Math.round((n / all.length) * 5) } : null; };
/** ready phrases for the comment: click to add */
export const PHRASES = {
  email: ['Хорошее начало: сразу понятна цель письма.', 'Закройте все пункты задания: один из них пропущен.', 'Добавьте конкретику: даты, причины, детали просьбы.', 'Следите за тоном: для преподавателя подойдёт более формальный стиль.', 'Используйте связки (also, however, therefore), чтобы письмо читалось плавнее.', 'Проверьте артикли и порядок слов.', 'Отличные вежливые формулы, так и оставляйте.', 'Не заучивайте шаблоны целиком, пишите своими словами.'],
  dsc: ['Чётко названа позиция, это сильная сторона ответа.', 'Откликнитесь на мнение одного из студентов: согласитесь или возразите.', 'Добавьте новую мысль, не повторяйте то, что уже написали студенты.', 'Подкрепите позицию примером и объясните, почему он подходит.', 'Развивайте мысль подробнее: 100 слов минимум.', 'Завершите ответ короткой итоговой мыслью.', 'Попробуйте более точную академическую лексику.', 'Избегайте шаблонов вроде «In today’s society…».'],
  interview: ['Ответ по существу и с примером, хорошо.', 'Развивайте ответ дольше: используйте все 45 секунд.', 'Добавьте причину или пример к своей мысли.', 'Старайтесь не делать долгих пауз: если не хватает слова, перефразируйте.', 'Следите за окончаниями -s и -ed.', 'Поработайте над словесным ударением в длинных словах.', 'Интонация ровная: добавьте больше выразительности.', 'Используйте более разнообразные конструкции, не только простые предложения.'],
  lrp: ['Все слова на месте, отличная точность.', 'Сохраняйте служебные слова: артикли и предлоги.', 'Не теряйте окончания -s и -ed.', 'Длинные предложения повторяйте по смысловым блокам.', 'Следите за ритмом: ударные слоги громче и длиннее.', 'Потренируйте звуки th и r.']
};

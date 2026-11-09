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

/** text with teacher marks as <mark data-n>; marks = [{s,e,note}] by character offset, non-overlapping */
export function markedHtml(text, marks = []) {
  const ms = [...(marks || [])].map((m, i) => ({ ...m, n: i + 1 })).filter(m => m.e > m.s).sort((a, b) => a.s - b.s);
  let out = '', at = 0;
  for (const m of ms) {
    if (m.s < at) continue;
    out += esc(text.slice(at, m.s)) + `<mark class="cm" data-n="${m.n}">${esc(text.slice(m.s, m.e))}</mark>`;
    at = m.e;
  }
  return out + esc(text.slice(at));
}

export function notesHtml(marks = [], { edit = false } = {}) {
  if (!marks?.length) return '';
  return `<div class="cmts">${marks.map((m, i) => `<div class="cmt"><b>${i + 1}</b><span class="cq">«${esc(m.q || '')}»</span> ${esc(m.note)}${edit ? ` <button class="lnk sm" data-act="mark-del" data-i="${i}">удалить</button>` : ''}</div>`).join('')}</div>`;
}

/** character offsets of the current selection inside `root` (whose text equals the raw string) */
export function selectionOffsets(root) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const r = sel.getRangeAt(0);
  if (!root.contains(r.startContainer) || !root.contains(r.endContainer)) return null;
  const pre = document.createRange();
  pre.selectNodeContents(root); pre.setEnd(r.startContainer, r.startOffset);
  const s = pre.toString().length, e = s + r.toString().length;
  return e > s ? { s, e } : null;
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
    G('task', 'Задача и содержание', 'Достиг ли ученик цели письма? Есть ли в тексте всё, о чём просили?', [
      ['b1', 'Закрыт пункт 1 из задания'], ['b2', 'Закрыт пункт 2 из задания'], ['b3', 'Закрыт пункт 3 из задания'],
      ['purpose', 'Цель письма понятна с первого предложения'], ['detail', 'Есть конкретные детали (причина, время, просьба), а не общие слова'], ['focus', 'Всё по теме, нет лишнего']]),
    G('tone', 'Адресат и тон', 'Подходит ли тон тому, кому пишут (преподаватель, администрация, знакомый)?', [
      ['greet', 'Приветствие и прощание соответствуют адресату'], ['register', 'Выдержан регистр, нет лишней разговорности'], ['polite', 'Вежливые формулы просьбы и благодарности (Could you…, I would appreciate…)'], ['nort', 'Нет резкого или неуместного тона']]),
    G('org', 'Структура и связность', 'Легко ли читать письмо? Видна ли логика?', [
      ['parts', 'Есть начало, основная часть и завершение'], ['links', 'Связующие слова (also, however, therefore) использованы к месту'], ['flow', 'Предложения связаны между собой, нет скачков мысли']]),
    G('gram', 'Грамматика', 'Мешают ли ошибки понять смысл?', [
      ['clear', 'Ошибки не мешают пониманию'], ['basic', 'Времена, согласование подлежащего и сказуемого в основном верны'], ['detail', 'Артикли, предлоги и порядок слов в основном верны'], ['range', 'Есть сложные структуры (придаточные, условные, пассив), и они точны']]),
    G('lex', 'Лексика', 'Достаточно ли богатый и точный язык?', [
      ['range', 'Слова не повторяются, лексика разнообразна'], ['exact', 'Слова и сочетания употреблены точно (collocations)'], ['rus', 'Нет прямых калек с русского']]),
    G('form', 'Оформление и самостоятельность', 'Самостоятельная ли это работа и аккуратно ли оформлена?', [
      ['spell', 'Орфография, заглавные буквы и пунктуация в порядке'], ['len', 'Объём достаточный, письмо не обрывается'], ['own', 'Нет заученных шаблонов целиком'], ['copy', 'Нет копирования формулировок из задания']])
  ],
  dsc: [
    G('pos', 'Позиция', 'Понятно ли, на чьей стороне ученик и почему?', [
      ['clear', 'Чёткая позиция или прямой ответ на вопрос профессора'], ['early', 'Позиция названа в начале'], ['steady', 'Позиция не противоречит сама себе']]),
    G('contrib', 'Вклад в обсуждение', 'Добавил ли ученик что-то новое к постам студентов?', [
      ['react', 'Откликается на мнение хотя бы одного студента (согласие, возражение, уточнение)'], ['new', 'Есть новая мысль, а не повтор постов'], ['nosum', 'Не пересказывает чужие посты']]),
    G('arg', 'Аргументация', 'Чем подкреплена позиция?', [
      ['why', 'Названы причины'], ['ex', 'Есть пример или пояснение (факт, личный опыт)'], ['link', 'Объяснено, почему пример подтверждает мысль'], ['rel', 'Аргументы относятся к вопросу профессора']]),
    G('dev', 'Развитие и объём', 'Развёрнут ли ответ?', [
      ['len', 'Не меньше 100 слов'], ['deep', 'Идеи развёрнуты, это не перечень тезисов'], ['end', 'Есть завершающая мысль или вывод']]),
    G('org', 'Связность', 'Легко ли следить за мыслью?', [
      ['links', 'Связующие слова на своих местах'], ['order', 'Мысли идут в логичном порядке'], ['para', 'Текст разбит на смысловые блоки']]),
    G('lang', 'Язык', 'Мешают ли ошибки понять смысл? Насколько язык академичный?', [
      ['clear', 'Ошибки не мешают пониманию'], ['range', 'Разнообразные грамматические структуры'], ['lex', 'Точная лексика, уместная для обсуждения'], ['spell', 'Орфография и пунктуация в порядке']]),
    G('own', 'Самостоятельность', 'Это собственный ответ?', [
      ['own', 'Нет заученных шаблонов («In today’s society…»)'], ['copy', 'Нет копирования формулировок из заданий и постов']])
  ],
  interview: [
    G('dev', 'Содержание и развитие', 'Ответил ли на вопрос и развил ли мысль за отведённое время?', [
      ['ans', 'Отвечает на вопрос по существу'], ['why', 'Есть причина или пример'], ['time', 'Использовано время: не обрывается рано'], ['end', 'Ответ законченный, есть вывод'], ['order', 'Мысли идут в логичном порядке']]),
    G('flu', 'Беглость и темп', 'Говорит плавно или останавливается?', [
      ['flow', 'Речь в основном плавная'], ['pause', 'Паузы и повторы не мешают слушать'], ['long', 'Нет долгих пауз'], ['pace', 'Естественный темп, не слишком быстро и не слишком медленно'], ['fill', 'Мало слов-паразитов (uh, um)']]),
    G('pron', 'Произношение и разборчивость', 'Понятно ли без напряжения, с первого прослушивания?', [
      ['int', 'Понятно с первого раза'], ['sounds', 'Ошибки отдельных звуков не мешают пониманию'], ['stress', 'Словесное ударение в основном верное'], ['into', 'Интонация естественна (паузы по смыслу, вопрос и утверждение)'], ['end', 'Окончания -s и -ed слышны']]),
    G('gram', 'Грамматика', 'Мешают ли ошибки понять смысл?', [
      ['clear', 'Ошибки не мешают пониманию'], ['tense', 'Времена согласованы'], ['range', 'Есть не только простые предложения'], ['detail', 'Артикли и предлоги в основном верны']]),
    G('lex', 'Лексика', 'Достаточно ли слов, чтобы выразить мысль?', [
      ['range', 'Лексика разнообразна, не только базовые слова'], ['exact', 'Слова подобраны точно'], ['para', 'Умеет перефразировать, если не хватает слова']]),
    G('tech', 'Запись', 'Достаточно ли качественная запись для оценки?', [
      ['rec', 'Запись слышна, шум не мешает']])
  ],
  lrp: [
    G('acc', 'Точность повторения', 'Все ли слова повторены в правильном порядке?', [
      ['content', 'Знаменательные слова на месте (существительные, глаголы, прилагательные)'], ['func', 'Служебные слова на месте (артикли, предлоги, местоимения)'], ['order', 'Порядок слов сохранён'], ['sub', 'Нет лишних слов и подмены смысла'], ['long', 'Длинные предложения тоже повторены полностью']]),
    G('form', 'Грамматическая форма', 'Сохранены ли окончания и формы?', [
      ['end', 'Окончания -s, -ed, -ing на месте'], ['tense', 'Время и форма глагола не изменены'], ['art', 'Артикли a/the не потеряны']]),
    G('pron', 'Произношение', 'Разборчиво ли?', [
      ['int', 'Разборчиво с первого прослушивания'], ['sounds', 'Трудные звуки (th, r, v/w) не мешают пониманию'], ['stress', 'Ударение в многосложных словах верное']]),
    G('rhy', 'Ритм и интонация', 'Похоже ли на естественную речь?', [
      ['rhythm', 'Естественный ритм (ударные и безударные слоги)'], ['into', 'Интонация фразы близка к образцу'], ['smooth', 'Говорит фразой, а не по одному слову']]),
    G('proc', 'Процесс', 'Как проходило повторение?', [
      ['restart', 'Нет перезапусков и самопоправок'], ['all', 'Ответ дан на каждое предложение']])
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

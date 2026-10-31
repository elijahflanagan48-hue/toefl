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
export const CRIT = {
  email: ['Закрыт пункт 1', 'Закрыт пункт 2', 'Закрыт пункт 3', 'Уместный регистр и вежливые формулы', 'Связность', 'Нет заученных шаблонов'],
  dsc: ['Чёткая позиция', 'Новый вклад, не повтор постов', 'Причины и примеры', 'Не меньше 100 слов', 'Связность', 'Нет «воды» и шаблонов'],
  interview: ['Отвечает на вопрос', 'Развёрнутость на 45 с', 'Беглость и темп', 'Разборчивость', 'Грамматика и лексика'],
  lrp: ['Знаменательные слова на месте', 'Служебные слова', 'Разборчивость', 'Ритм и ударение']
};

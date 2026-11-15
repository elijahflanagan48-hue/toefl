// Build a Sentence — items 101–110 (A/B/C × 10). Idempotent (replaces 101–110): node content/import/bas-new-J.mjs
// Entry: [focus, speaker line (campus dialogue), template, extra chunk (trap), Russian explanation]. {a|b|c} = consecutive slots; text outside braces is pre-filled.
import { readFileSync, writeFileSync } from 'node:fs';
const A = [
  ["Вопрос с whose", "This umbrella was left in the classroom.", "{Whose|umbrella|is|it}?", "Who's", "Чей? — whose + существительное: Whose umbrella is it? Who's = who is, и в этой позиции неверно."],
  ["Вопрос с which в Present Continuous", "There are two sections of the history course.", "Which {one|are|you|taking}?", "do", "Действие в текущем семестре — Present Continuous: Which one are you taking? Do не сочетается с формой taking."],
  ["Предлоги: in the middle of", "When is the final exam?", "It's {in|the middle|of|December}.", "on", "In the middle of + месяц: in the middle of December. On используется с датами и днями, а не с серединой месяца."],
  ["Вопрос What … like?", "I just met our new neighbor.", "What {is|she|like}?", "how", "О характере спрашивают What is she like? Сочетание how … like неверно: либо How is she?, либо What is she like?"],
  ["There were + множественное", "Was the party fun?", "Yes, there {were|lots of|students} from my class.", "much", "Students — исчисляемое во множественном числе: there were lots of students. Much с исчисляемыми не употребляется."],
  ["Отрицательный повелительный", "Can I eat in the computer lab?", "No, please {don't|bring|any food} into the lab.", "not", "Запрет выражается don't + глагол: please don't bring. Одного not перед глаголом в повелительном наклонении недостаточно."],
  ["Сравнительная степень с more", "Should I take the morning or the evening class?", "The morning class {is|more|convenient} for you.", "much", "Длинные прилагательные сравниваются через more: more convenient. Much может только усиливать сравнение (much more), но не заменять more."],
  ["Will для предложения помощи", "This box is really heavy.", "Wait, I {will|help|you|carry} it.", "helping", "Спонтанное предложение помощи — will + глагол: I will help you carry it. После will форма helping неверна."],
  ["Вопрос с how many", "I have so many exams this week.", "How {many|exams|do|you|have} this week?", "much", "Exams — исчисляемое существительное, поэтому how many exams. How much используется с неисчисляемыми."],
  ["Interested in", "Why did you join the photography club?", "I'm {very|interested|in|photography}.", "on", "Прилагательное interested требует предлога in: interested in photography. Предлог on с ним не употребляется."],
];
const B = [
  ["Косвенный вопрос с what time", "When does the career fair start?", "I'll ask {the organizers|what time|the fair|starts}.", "does", "В косвенном вопросе прямой порядок слов: what time the fair starts. Вспомогательный does здесь не нужен."],
  ["Пассив в Present Simple", "Do students have to pay for printing?", "No, printing {is|provided|by|the library} free of charge.", "provides", "Печать предоставляется библиотекой — пассив: is provided by. Активная форма provides после printing даёт неверный смысл и неграмматична рядом с is и by."],
  ["Present Perfect с just", "Is the professor in her office?", "No, she {has just|left|for|a meeting}.", "leave", "Только что завершившееся действие — has just + третья форма: has just left. Начальная форма leave после has неверна."],
  ["Определительное придаточное с who", "Who is that man by the door?", "He's the professor {who|teaches|our|statistics class}.", "which", "О человеке — who: the professor who teaches. Which относится к предметам и животным."],
  ["Условное 1-го типа в вопросе", "The forecast says it might snow tomorrow.", "Will the campus {close|if|it|snows}?", "will snow", "В придаточном условия после if будущее выражается настоящим временем: if it snows. Will snow после if неверно."],
  ["Would you mind + герундий", "It's really cold in here.", "Would you {mind|closing|the window|near you}?", "to close", "После mind используется герундий: Would you mind closing…? Инфинитив to close после mind невозможен."],
  ["Neither do I", "I don't like studying late at night.", "{Neither|do|I}.", "don't", "Согласие с отрицанием — Neither + вспомогательный + подлежащее: Neither do I. Neither уже отрицательное, поэтому don't — двойное отрицание."],
  ["Either … or", "How can I contact the advisor?", "You can {either|call|her|or|send} an email.", "nor", "Either сочетается с or: either call her or send an email. Nor пишется в паре с neither."],
  ["Past Perfect", "Did you see the start of the movie?", "No, it {had|started|before|we|arrived}.", "has", "Действие, завершившееся раньше другого в прошлом, — Past Perfect: it had started before we arrived. Has started не сочетается с прошедшим arrived."],
  ["Told + объект + to-инфинитив", "What did the librarian say about your overdue book?", "She {told|me|to return|it} by Friday.", "said", "Глагол told берёт объект без предлога: told me to return it. Said me невозможно (только said to me)."],
];
const C = [
  ["Инверсия: Nowhere else", "Is this attendance policy common at other universities?", "Nowhere else {is|such|a strict|policy|enforced}.", "does", "После Nowhere else в начале — инверсия, а пассив образуется с be: is such a strict policy enforced. Does не сочетается с причастием enforced."],
  ["Условие с Were … to", "What would happen if the funding were cut?", "{Were|the funding|to be|cut}, the project {would|come|to a halt}.", "If", "Условие без if: Were the funding to be cut = If the funding were to be cut. Если поставить If вместо Were, пропадёт сказуемое придаточного."],
  ["It is high time + Past Simple", "The lab equipment is twenty years old.", "It is high time {the university|replaced|it|with|newer models}.", "replace", "После It is high time действие выражается прошедшим временем: the university replaced it. Начальная форма replace после единственного числа неверна."],
  ["Противопоставление с whereas", "How do the two theories differ?", "The first theory focuses on individuals, whereas the second {emphasizes|the role|of|society|as a whole}.", "emphasize", "Подлежащее the second — третье лицо единственного числа, поэтому emphasizes. Форма emphasize без -s не согласуется с ним."],
  ["Причастный оборот с третьей формой", "Why is the novel still so popular?", "{Written|in|plain language}, the novel {remains|accessible|to|modern readers}.", "Wrote", "Пассивный причастный оборот начинается с третьей формы: Written in plain language (= Because it was written…). Wrote — прошедшее время, а не причастие."],
  ["Provided that", "Can I submit the essay a few days late?", "You can, {provided that|you|inform|your instructor|in advance}.", "provide", "Условие «при условии что» — provided that + придаточное. Форма provide that так не употребляется."],
  ["Most of whom", "How many students applied for the internship?", "Over two hundred, {most|of|whom|had|no experience}.", "who", "После предлога в относительном придаточном — whom: most of whom. Who после of не употребляется."],
  ["Whatever + существительное", "Should I follow the template exactly?", "{Whatever|format|you|choose}, make sure {it|is|consistent}.", "However", "«Какой бы ни» с существительным — whatever format you choose. However соединяется с прилагательным или наречием (however hard), а не с существительным."],
  ["Be supposed to have been + причастие", "Why is the professor upset with our group?", "The report {was|supposed|to have been|submitted|last week}.", "be", "Ожидавшееся, но несостоявшееся действие в пассиве: was supposed to have been submitted. Be без to и без was ломает конструкцию."],
  ["Эмфатическое do", "You didn't seem to enjoy the concert.", "Actually, I {did|enjoy|it}, but I {was|exhausted}.", "enjoyed", "Эмфатическое did усиливает утверждение, после него глагол в начальной форме: I did enjoy it. Did enjoyed неверно."],
];
const chunkify = tpl => { const parts = [], slots = []; for (const s of tpl.split(/(\{[^}]*\})/).filter(Boolean)) { if (s.startsWith('{')) for (const c of s.slice(1, -1).split('|')) { parts.push(null); slots.push(c); } else { const t = s.trim(); if (t) parts.push(t); } } return { parts, slots }; };
const sent = (parts, slots) => { let i = 0; return parts.map(p => p === null ? slots[i++] : p).join(' ').replace(/\s+([.?!,])/g, '$1'); };
const file = new URL('../writing/bas.json', import.meta.url);
const all = JSON.parse(readFileSync(file));
const existing = all.filter(x => !/-(10[1-9]|110)$/.test(x.id));
const out = [];
for (const [lvl, list] of [['A', A], ['B', B], ['C', C]]) list.forEach(([focus, a, tpl, extra, ex], i) => {
  const { parts, slots } = chunkify(tpl); const id = `W-BAS-${lvl}-${String(101 + i).padStart(3, '0')}`;
  out.push({ id, level: lvl, focus, a, parts, slots, extra, ex });
});
const seenA = new Set(existing.map(x => x.a));
for (const it of out) if (seenA.has(it.a)) console.log('DUPLICATE speaker line:', it.id, it.a);
writeFileSync(file, JSON.stringify(existing.concat(out), null, 1));
// review output: key, every adjacent swap, and the trap substituted for each slot
for (const it of out) {
  const key = sent(it.parts, it.slots); console.log(`\n${it.id} [${it.slots.length}] ${key}   (trap: ${it.extra})`);
  for (let i = 0; i < it.slots.length - 1; i++) { const s = it.slots.slice(); [s[i], s[i + 1]] = [s[i + 1], s[i]]; console.log('   swap', i, '→', sent(it.parts, s)); }
  for (let i = 0; i < it.slots.length; i++) { const s = it.slots.slice(); s[i] = it.extra; console.log('   trap', i, '→', sent(it.parts, s)); }
}

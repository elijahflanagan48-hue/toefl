// New Writing items written specifically for mock tests T4 and T5 (reserved via content/mocks/mocks.json, never shown in practice).
// node content/import/mock-T4T5-writing.mjs  → bas.json (replaces these ids), email.json and discussion.json (skips existing ids); prints a BaS review.
// T4: BaS A-121…123, B-121…124, C-121…123; Email W-EML-C-021; Discussion W-DSC-B-023
// T5: BaS A-124…126, B-125…128, C-124…126; Email W-EML-B-021; Discussion W-DSC-C-021
import { readFileSync, writeFileSync } from 'node:fs';
const F = p => new URL(p, import.meta.url);
const BAS = {
 A: [
  ['Наречие always в Present Simple', 'How do you always get your coffee so fast?', 'I {always|order|it|online} before class.', 'orders', 'Always стоит перед смысловым глаголом, а после I глагол без -s: I always order it. Форма orders подходит только к he, she, it.'],
  ['Present Perfect с ever в вопросе', 'I\'m reading a great book about Japan.', '{Have|you|ever|visited} Japan?', 'Did', 'Вопрос об опыте — Present Perfect: Have you ever visited…? После Did нужна начальная форма (visit), а не visited.'],
  ['Косвенный вопрос с where', 'I need to print my essay before class.', 'Do you know {where|the printer|is}?', 'does', 'В косвенном вопросе после Do you know прямой порядок слов: where the printer is. Does здесь лишний.'],
  ['Определительное придаточное с who', 'Who is Mr. Lee?', 'He\'s the man {who|works|in|the library}.', 'which', 'О человеке — who: the man who works in the library. Which используется для предметов.'],
  ['Условное 1-го типа с if', 'Are you coming to the picnic on Saturday?', 'Yes, {if|it|doesn\'t|rain}.', 'won\'t', 'В придаточном условия будущее выражается настоящим временем: if it doesn\'t rain. Won\'t после if неверно.'],
  ['Present Continuous для планов', 'Do you have any plans for the weekend?', 'I {am|visiting|my grandparents} on Sunday.', 'visit', 'Запланированное действие — Present Continuous: I am visiting. Начальная форма visit после am неверна.'],
 ],
 B: [
  ['Косвенный вопрос с why', 'The library closed early today.', 'Do you know {why|it|closed|so early}?', 'did', 'В косвенном вопросе прямой порядок слов и без вспомогательного глагола: why it closed so early. Did здесь лишний.'],
  ['Косвенный вопрос с whether', 'Is the seminar going to be online?', 'I\'ll ask {the professor|whether|it|will be|online}.', 'is it', 'После whether — прямой порядок слов: whether it will be online. Сочетание is it даёт порядок прямого вопроса.'],
  ['Whose в определительном придаточном', 'Which student won the science prize?', 'The one {whose|project|was about|clean water}.', 'who\'s', 'Принадлежность — whose + существительное: whose project. Who\'s = who is и с project не сочетается.'],
  ['Present Perfect с yet в вопросе', 'The new exam schedule was posted this morning.', '{Have|you|seen|it} yet?', 'Did', 'С yet в вопросе — Present Perfect: Have you seen it yet? После Did нужна начальная форма see, а не seen.'],
  ['Условное 2-го типа', 'Would you join the debate team?', 'I {would|join|if|I|had} more time.', 'will', 'Нереальное условие в настоящем: would join if I had. Will не сочетается с had в придаточном.'],
  ['Восклицание What a …', 'I got the last ticket for the concert!', '{What|a|lucky|break}!', 'How', 'Восклицание с существительным: What a lucky break! How используется с прилагательным без существительного (How lucky!).'],
  ['Present Perfect Passive', 'Is the cafeteria open again?', 'Yes, it {has|been|reopened|after the repairs}.', 'have', 'Пассив в Present Perfect: it has been reopened. Have не согласуется с подлежащим it.'],
  ['Who\'s = who has', 'Who should I ask about the lab equipment?', 'Ask Dr. Patel. She\'s the one {who\'s|worked|in this lab} the longest.', 'whose', 'Who\'s = who has: who\'s worked in this lab the longest. Whose — «чей» и требует существительного.'],
 ],
 C: [
  ['Инверсия: Scarcely … when', 'Did the meeting start on time?', 'Scarcely {had|the chair|begun|her introduction|when|the fire alarm} went off.', 'did', 'После Scarcely в начале — инверсия с Past Perfect: had the chair begun … when. Did не сочетается с причастием begun.'],
  ['Косвенный вопрос с whether + модальный', 'What is the committee still debating?', 'They have not decided {whether|the new policy|should|apply|to current students} as well.', 'applies', 'В косвенном вопросе прямой порядок слов: whether the new policy should apply. После should глагол без окончания, поэтому applies неверно.'],
  ['Предлог + whom', 'Who should I send my appeal to?', 'The person {to|whom|you|should address|your appeal} is the dean.', 'who', 'После предлога в относительном придаточном — whom: to whom you should address your appeal. Who после to не употребляется.'],
  ['Would rather + Past Perfect', 'I didn\'t tell you about the change because I didn\'t want to worry you.', 'I {would rather|you|had told|me|earlier}.', 'have told', 'Сожаление о чужом действии в прошлом: would rather + подлежащее + Past Perfect (you had told me). Have told в этой конструкции неверно.'],
  ['Перфектное пассивное причастие', 'Why was the old bridge closed for so long?', '{Having been|damaged|in the storm}, it {had to|be|repaired} before reopening.', 'Have been', 'Предшествующее пассивное действие — Having been + третья форма: Having been damaged…. Have been не может начинать причастный оборот.'],
  ['Инверсия: No longer', 'Does the library still lend laptops to new students?', 'No longer {does|the library|lend|laptops|to first-year students}.', 'lends', 'После No longer в начале — инверсия с does: does the library lend. После does глагол стоит в начальной форме, поэтому lends неверно.'],
 ],
};
const START = { A: 121, B: 121, C: 121 };
const chunkify = tpl => { const parts = [], slots = []; for (const s of tpl.split(/(\{[^}]*\})/).filter(Boolean)) { if (s.startsWith('{')) for (const c of s.slice(1, -1).split('|')) { parts.push(null); slots.push(c); } else { const t = s.trim(); if (t) parts.push(t); } } return { parts, slots }; };
const sent = (parts, slots) => { let i = 0; return parts.map(p => p === null ? slots[i++] : p).join(' ').replace(/\s+([.?!,])/g, '$1'); };
const out = [];
for (const lvl of ['A', 'B', 'C']) BAS[lvl].forEach(([focus, a, tpl, extra, ex], i) => { const { parts, slots } = chunkify(tpl); out.push({ id: `W-BAS-${lvl}-${START[lvl] + i}`, level: lvl, focus, a, parts, slots, extra, ex }); });
const ids = new Set(out.map(x => x.id));
const bas = JSON.parse(readFileSync(F('../writing/bas.json'))).filter(x => !ids.has(x.id));
writeFileSync(F('../writing/bas.json'), JSON.stringify(bas.concat(out), null, 1));

const EML = [
 { id: 'W-EML-C-021', level: 'C', to: 'Professor Grant, Department Chair', subject: 'Extending computer lab hours during finals', situation: 'Your department\'s computer lab closes at 6 p.m., but many students in your program need specialized software that is installed only there. During the last weeks of the semester, students wait in long lines, and some cannot finish their projects on time. You would like the department to consider a change.', bullets: ['Explain the problem students are facing', 'Propose a specific change and how it could work', 'Respond to one concern the department might have'] },
 { id: 'W-EML-B-021', level: 'B', to: 'Ms. Chen, Transportation Office', subject: 'New campus shuttle schedule', situation: 'Since the shuttle schedule changed this month, the bus from the north residence halls to the main campus runs only every 40 minutes in the morning. The buses are often too full to board, and you have arrived late to your 8 a.m. class several times.', bullets: ['Describe the problem with the new schedule', 'Explain how it has affected you', 'Suggest a possible solution'] },
];
const DSC = [
 { id: 'W-DSC-B-023', level: 'B', course: 'Education', professor: { name: 'Dr. Simmons', text: 'In many courses, the final grade depends heavily on one written exam at the end of the semester. Some instructors are replacing these exams with final projects, such as research papers, presentations, or portfolios of work. Which do you think is a better way to measure what students have learned in a course: a final exam or a final project? Explain why.' }, students: [{ name: 'Hannah', text: 'I prefer projects. An exam only shows what you can remember in two hours, while a project shows that you can actually use what you learned. It also reduces the stress of one big test.' }, { name: 'Kevin', text: 'Exams are fairer, in my opinion. Everyone answers the same questions under the same conditions, but with projects it is hard to know how much help a student got from friends or the internet.' }] },
 { id: 'W-DSC-C-021', level: 'C', course: 'Museum Studies', professor: { name: 'Dr. Okafor', text: 'Many major museums hold objects that were taken from other countries during periods of war or colonial rule. Some of these countries are now asking for the objects to be returned. Supporters of returning them argue that the objects belong to the cultures that created them, while opponents argue that large international museums allow more people to see and study them. Should museums return such objects to their countries of origin? Explain your position.' }, students: [{ name: 'Amara', text: 'I believe they should be returned. When objects were taken by force, keeping them continues that injustice. Communities have a right to see their own heritage in their own countries, not only by traveling abroad.' }, { name: 'Jonas', text: 'I see the moral argument, but each case is different. Some objects are fragile and may not be safely stored elsewhere. Long-term loans or shared ownership could be a more practical solution than automatic return.' }] },
];
// append as text (one compact line per new item) so the existing file layout stays untouched
const appendLines = (path, items) => { const txt = readFileSync(F(path), 'utf8'); const have = new Set(JSON.parse(txt).map(x => x.id)); const add = items.filter(x => !have.has(x.id)); if (add.length) { const body = txt.replace(/\s*\]\s*$/, ''); writeFileSync(F(path), body + ',\n' + add.map(x => JSON.stringify(x)).join(',\n') + '\n]\n'); JSON.parse(readFileSync(F(path), 'utf8')); } console.log(path, '+', add.length); };
appendLines('../writing/email.json', EML);
appendLines('../writing/discussion.json', DSC);

for (const it of out) {
  const key = sent(it.parts, it.slots); console.log(`\n${it.id} [${it.slots.length}] ${key}   (trap: ${it.extra})`);
  for (let i = 0; i < it.slots.length - 1; i++) { const s = it.slots.slice(); [s[i], s[i + 1]] = [s[i + 1], s[i]]; console.log('   swap', i, '→', sent(it.parts, s)); }
  for (let i = 0; i < it.slots.length; i++) { const s = it.slots.slice(); s[i] = it.extra; console.log('   trap', i, '→', sent(it.parts, s)); }
}

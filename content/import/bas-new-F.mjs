// Build a Sentence — +30 items (A/B/C × 10), ids 061–070. Run once: node content/import/bas-new-F.mjs
// Entry: [focus, speaker line, template, extra chunk (trap), Russian explanation]. {a|b|c} = consecutive slots.
import { readFileSync, writeFileSync } from 'node:fs';
const A = [
  ['Present Perfect с never', 'Have you ever been to London?', 'No, I {have never|been|there}.', 'went', 'Present Perfect: have never been. Форма went — Past Simple, с have она не сочетается.'],
  ['There are + число', 'How many students are in your class?', 'There {are|twenty|students|in my class}.', 'is', 'Students — множественное число, поэтому there are. There is стоит только перед единственным числом.'],
  ['Вопрос с where', 'Excuse me, I need to find a bus stop.', 'Where {is|the nearest|bus stop}?', 'are', 'Bus stop — единственное число, поэтому is. Порядок в вопросе: where + глагол + подлежащее.'],
  ['Like + герундий', 'What do you do in your free time?', 'I {like|playing|chess|with my brother}.', 'play', 'После like для обозначения увлечения ставим -ing: like playing. Форма play после like не подходит.'],
  ['Объектные местоимения', 'Do you know Anna and Tom?', 'Yes, I {know|them|very well}.', 'they', 'После глагола нужна объектная форма: know them. Форма they — подлежащее, на месте дополнения она невозможна.'],
  ['Could для прошлой способности', 'Could you swim when you were a child?', 'Yes, I {could|swim|when I was five}.', 'can', 'Способность в прошлом выражаем через could. Can относится к настоящему и не сочетается с when I was five.'],
  ['Too + прилагательное', 'Why didn\'t you buy the jacket?', 'It {was|too|expensive|for me}.', 'enough', 'Too + прилагательное = «слишком»: too expensive. Enough ставится после прилагательного и означает «достаточно».'],
  ['Условное 1-го типа', 'What will you do if it rains?', 'If it rains, {I|will stay|at home}.', 'would', 'В главной части условного 1-го типа — will: I will stay. Would относится ко 2-му типу.'],
  ['Some в утверждении', 'Do you need anything from the shop?', 'Yes, we {need|some|milk}.', 'any', 'В утвердительном предложении используем some: need some milk. Any характерно для вопросов и отрицаний.'],
  ['Даты и предлог on', 'When is your birthday?', 'It {is|on|the third|of May}.', 'in', 'С конкретным числом ставим on: on the third of May. In используется с месяцами и годами без числа.'],
];
const B = [
  ['Косвенная просьба', 'What did the teacher ask you?', 'She asked {me|to open|the window}.', 'opening', 'Ask + кому + to + инфинитив: asked me to open. После ask герундий не используется.'],
  ['Present Perfect с since', 'How long have you lived here?', 'I {have lived|here|since 2019}.', 'for 2019', 'Since + момент начала: since 2019. For используется с периодом (for five years).'],
  ['Be used to + -ing', 'Is the noise bothering you?', 'No, I {am|used to|living|near a road}.', 'use to', 'Be used to + -ing означает «привык»: am used to living. Форма use to (без -d) — это used to для прошлых привычек и без be не подходит.'],
  ['Enough + инфинитив', 'Can your brother drive?', 'No, he {is not|old enough|to drive}.', 'enough old', 'Enough стоит после прилагательного: old enough. Порядок enough old неверен.'],
  ['Относительное придаточное с that', 'Which laptop did you buy?', 'I bought the one {that|was|on sale}.', 'what', 'Определяем существительное (the one) словом that. What не вводит определительное придаточное.'],
  ['Условное 2-го типа', 'Would you move abroad?', 'I would {move|abroad|if I had|a job there}.', 'have', 'Условное 2-го типа: would + инфинитив … if + Past Simple (had). Форма have после if не подходит.'],
  ['Пассив с by', 'Who painted this picture?', 'It {was|painted|by|a local artist}.', 'painting', 'Пассив в Past Simple: was painted by. Причастие painting действие над картиной не выражает.'],
  ['So that', 'Why did you write it down?', 'I wrote it down {so that|I|would not|forget it}.', 'so as to', 'So that вводит придаточное цели с собственным подлежащим: so that I would not forget. So as to требует инфинитива без подлежащего.'],
  ['Little / few', 'Is there enough time?', 'No, we {have|very little|time|left}.', 'very few', 'Time неисчисляемое, поэтому little. Few используется с исчисляемыми существительными.'],
  ['Look forward to + -ing', 'Are you ready for the trip?', 'Yes, I\'m {looking forward|to|seeing|the mountains}.', 'see', 'В look forward to частица to — предлог, поэтому дальше идёт -ing: to seeing. Инфинитив see неверен.'],
];
const C = [
  ['Инверсия: Hardly … when', 'Did you leave before the storm?', 'Hardly {had we|left|when|the rain started}.', 'did we', 'После Hardly подлежащее и вспомогательный меняются местами в Past Perfect: Hardly had we left. Форма did we для этой конструкции не подходит.'],
  ['Wish + Past Perfect', 'Do you regret skipping the lecture?', 'Yes, I wish {I had|attended|the whole lecture}.', 'I would have', 'Сожаление о прошлом: wish + Past Perfect (I had attended). I would have после wish не используется.'],
  ['Причастный оборот', 'What did the committee do?', '{Having reviewed|the proposal}, {the committee|approved it}.', 'Having review', 'Причастие совершенного вида: having + третья форма (having reviewed). Форма having review неверна.'],
  ['Whom после предлога', 'Who did you collaborate with?', 'She is the researcher {with whom|I|co-authored|the paper}.', 'who', 'После предлога относительное местоимение — whom: with whom. Who после предлога не ставится.'],
  ['Сокращённое определение (причастие)', 'Which proposals were approved?', 'The proposals {submitted|before the deadline|were|accepted}.', 'submitting', 'Proposals — то, что подавали, поэтому причастие страдательное: submitted. Форма submitting означала бы, что предложения сами подают.'],
  ['Инверсия: Only when', 'When do you plan to publish?', 'Only when {the data are verified|will|we|publish}.', 'did', 'После Only when в главной части инверсия: will we publish. Did относится к прошлому и не сочетается с are verified.'],
  ['Согласование: the number of', 'How many participants dropped out?', '{The number of|participants|who withdrew|was|small}.', 'were', 'The number of … — единственное число: the number was small. Форма were относилась бы к a number of.'],
  ['Инверсия: Under no circumstances', 'May employees share the passwords?', 'Under no circumstances {should|passwords|be shared}.', 'sharing', 'После Under no circumstances инверсия: should passwords be shared. Форма sharing пассив не образует.'],
  ['The more … the more', 'Does practice really help?', 'Yes, {the more|you practice|the better|you become}.', 'more better', 'Парное сравнение: the more … the better. Форма more better неверна, потому что better уже сравнительная степень.'],
  ['Regret + перфектный герундий', 'Do you regret your decision?', 'Yes, I regret {not|having accepted|the offer}.', 'to accept', 'Сожаление о прошлом: regret + (not) having + третья форма. Regret to accept означает «с сожалением принимаю».'],
];
const chunkify = tpl => { const parts = [], slots = []; for (const s of tpl.split(/(\{[^}]*\})/).filter(Boolean)) { if (s.startsWith('{')) for (const c of s.slice(1, -1).split('|')) { parts.push(null); slots.push(c); } else { const t = s.trim(); if (t) parts.push(t); } } return { parts, slots }; };
const sent = (parts, slots) => { let i = 0; return parts.map(p => p === null ? slots[i++] : p).join(' ').replace(/\s+([.?!,])/g, '$1'); };
const file = new URL('../writing/bas.json', import.meta.url);
const existing = JSON.parse(readFileSync(file));
if (existing.some(x => x.id === 'W-BAS-A-061')) { console.error('already applied'); process.exit(1); }
const out = [];
for (const [lvl, list] of [['A', A], ['B', B], ['C', C]]) list.forEach(([focus, a, tpl, extra, ex], i) => {
  const { parts, slots } = chunkify(tpl); const id = `W-BAS-${lvl}-${String(61 + i).padStart(3, '0')}`;
  out.push({ id, level: lvl, focus, a, parts, slots, extra, ex }); console.log(id, '|', a, '→', sent(parts, slots), '| extra:', extra);
});
writeFileSync(file, JSON.stringify(existing.concat(out), null, 1));

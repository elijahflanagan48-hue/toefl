// Build a Sentence — items 091–100 (A/B/C × 10). Idempotent (replaces 091–100): node content/import/bas-new-I.mjs
// Entry: [focus, speaker line (campus dialogue), template, extra chunk (trap), Russian explanation]. {a|b|c} = consecutive slots; text outside braces is pre-filled.
import { readFileSync, writeFileSync } from 'node:fs';
const A = [
  ["Вопрос с where в Past Simple", "I lost my student card.", "Where {did|you|last|see} it?", "saw", "В вопросе в Past Simple после did глагол стоит в начальной форме: did you last see. Форма saw после did неверна."],
  ["Past Continuous", "Why didn't you answer my call?", "I {was|taking|a shower} at the time.", "were", "Длительное действие в прошлом: I was taking. С подлежащим I используется was, а не were."],
  ["Вопрос с how much", "I bought a new backpack today.", "How {much|did|it|cost}?", "costed", "О цене спрашиваем how much did it cost. После did глагол стоит в начальной форме; к тому же cost — неправильный глагол (cost – cost – cost), формы costed нет."],
  ["Вопрос к подлежащему", "Somebody left a note on your desk.", "Really? Who {left|it|there}?", "leave", "Who здесь подлежащее, поэтому did не нужен, а глагол стоит в Past Simple: Who left it there? Форма leave без прошедшего времени неверна."],
  ["Good at + герундий", "You always win our chess games.", "I'm {good|at|planning|my moves} ahead.", "plan", "После предлога at глагол принимает форму -ing: good at planning. Начальная форма plan после предлога невозможна."],
  ["Present Perfect с yet", "Is your essay ready to submit?", "No, I {haven't|finished|it|yet}.", "didn't", "Незавершённое к настоящему моменту действие с yet — Present Perfect: haven't finished it yet. После didn't нужна начальная форма, а не finished."],
  ["By + вид транспорта", "How do you get to campus?", "I usually {go|by|bike} because it's faster.", "with", "Способ передвижения — by + существительное без артикля: go by bike. With bike в этом значении не говорят."],
  ["Too many + исчисляемое", "Is the cafeteria busy right now?", "Yes, there {are|too|many|people} in line.", "much", "People — исчисляемое существительное во множественном числе, поэтому too many people. Much используется с неисчисляемыми."],
  ["Вопрос с what time", "I want to go to the gym tomorrow morning.", "What time {does|the gym|open}?", "opens", "В вопросе с does глагол стоит в начальной форме: does the gym open. Окончание -s уже выражено в does, поэтому opens неверно."],
  ["Let's + инфинитив", "I'm so tired of studying.", "Let's {take|a break|for|ten minutes}.", "taking", "После let's идёт инфинитив без to: Let's take a break. Форма taking после let's неверна."],
];
const B = [
  ["Косвенный вопрос с how long", "I'm taking the bus to the city tomorrow.", "Do you know {how long|the trip|will|take}?", "does", "В косвенном вопросе прямой порядок слов: how long the trip will take. Вспомогательный does здесь не нужен."],
  ["Be supposed to", "Why are you running?", "I {was|supposed|to|meet|my tutor} at noon.", "suppose", "Устойчивая конструкция be supposed to + инфинитив: I was supposed to meet. Форма suppose без -d неверна."],
  ["Had better", "It looks like it's going to rain.", "We {had better|leave|before|it starts}.", "to leave", "После had better инфинитив идёт без to: had better leave. Форма to leave после had better неверна."],
  ["Which, относящееся ко всему предложению", "Did you enjoy the guest lecture on Friday?", "Not really. It was very long, {which|made|it|hard|to concentrate}.", "what", "Which после запятой относится ко всей предыдущей мысли: which made it hard to concentrate. What в такой позиции не употребляется."],
  ["It takes + время + to", "Is the campus far from the station?", "It {takes|about|twenty minutes|to walk} there.", "spends", "Сколько времени нужно — it takes + время + to-инфинитив. Глагол spend требует подлежащего-человека: I spend…, а не it spends."],
  ["Present Perfect Continuous с since", "You look exhausted.", "I {have been|working|on this project|since} early morning.", "for", "Since указывает на момент начала: since early morning. For используется с периодом (for five hours), а не с моментом."],
  ["Второй тип условных в вопросе", "I might get the scholarship this year.", "What {would|you|do|if you|got} it?", "will", "Гипотетическая ситуация — второй тип: What would you do if you got it? Will в главной части не сочетается с got в придаточном."],
  ["Определительное придаточное без that", "Did you enjoy the novel?", "It's the best book {I|have|ever|read}.", "it", "Объектное придаточное можно присоединить без that: the best book I have ever read. Лишнее it повторяет дополнение — в английском так нельзя."],
  ["Каузатив have something done", "Why aren't you using your laptop?", "I'm {having|the screen|repaired|this week}.", "repair", "Действие выполняет мастер: have + объект + третья форма (having the screen repaired). Начальная форма repair в этой конструкции неверна."],
  ["Stop + герундий", "Why don't you drink coffee anymore?", "I {stopped|drinking|it|because|it kept me awake}.", "drink", "Перестать что-то делать — stop + -ing: stopped drinking it. Начальная форма drink после stopped неверна."],
];
const C = [
  ["Инверсия: Seldom", "Does the committee usually approve late applications?", "Seldom {does|the committee|make|an exception|to|this rule}.", "makes", "После отрицательного наречия Seldom в начале — инверсия: does the committee make. После does глагол в начальной форме, поэтому makes неверно."],
  ["Инверсия: Had it not been for", "How did the team finish the project on time?", "{Had|it|not|been} for Maria's help, we {would have|missed|the deadline}.", "If", "Условие третьего типа без if: Had it not been for … = If it had not been for …. Если поставить If, пропадёт had, и предложение станет неграмматичным."],
  ["Псевдорасщеплённое предложение с what", "What worries you most about the exam?", "What {worries|me|most|is|the listening section}.", "are", "Придаточное What worries me most — подлежащее в единственном числе, поэтому is. Форма are не согласуется с ним."],
  ["Сослагательное после it is essential that", "Can the application forms be sent by email?", "No, it is essential that {each|applicant|submit|the original|documents} in person.", "to submit", "После it is essential that — сослагательное наклонение: глагол в начальной форме без to (each applicant submit). To submit после подлежащего неверно."],
  ["Such … that", "Why did so many students sign up for the course?", "It was {such|an engaging|course|that|nobody|wanted to miss} it.", "very", "Such + a/an + прилагательное + существительное + that: such an engaging course that…. Very не ставится перед артиклем."],
  ["Перфектный причастный оборот", "Why did the professor seem so confident?", "{Having|taught|the course|for ten years}, she {knew|exactly what|to expect}.", "Have", "Предшествующее действие выражено перфектным причастием: Having taught the course…. Форма Have без -ing не может начинать причастный оборот."],
  ["Инверсия: Only by", "How can the university reduce its energy costs?", "Only by {investing|in|solar power|can|it|cut} costs significantly.", "invest", "После Only by — герундий (investing), а в главной части инверсия: can it cut. Начальная форма invest после предлога by невозможна."],
  ["As if + Past Perfect", "Did the new student already know everyone?", "She talked {as if|she|had known|us|for years}.", "knowing", "Нереальное сравнение о предшествующем периоде: as if she had known us for years. Форма knowing не может быть сказуемым придаточного."],
  ["Инверсия: Not once", "Did the speaker mention the budget cuts?", "Not once {did|he|refer|to|the cuts}.", "referred", "После Not once в начале — инверсия с did: did he refer. После did глагол в начальной форме, поэтому referred неверно."],
  ["Косвенный вопрос с why + пассив", "Has anyone explained the delay?", "Nobody {has|explained|why|the results|have not been|released}.", "did", "В косвенном вопросе прямой порядок слов: why the results have not been released. Did не сочетается ни с explained, ни с released."],
];
const chunkify = tpl => { const parts = [], slots = []; for (const s of tpl.split(/(\{[^}]*\})/).filter(Boolean)) { if (s.startsWith('{')) for (const c of s.slice(1, -1).split('|')) { parts.push(null); slots.push(c); } else { const t = s.trim(); if (t) parts.push(t); } } return { parts, slots }; };
const sent = (parts, slots) => { let i = 0; return parts.map(p => p === null ? slots[i++] : p).join(' ').replace(/\s+([.?!,])/g, '$1'); };
const file = new URL('../writing/bas.json', import.meta.url);
const all = JSON.parse(readFileSync(file));
const existing = all.filter(x => !/-(09[1-9]|100)$/.test(x.id));
const out = [];
for (const [lvl, list] of [['A', A], ['B', B], ['C', C]]) list.forEach(([focus, a, tpl, extra, ex], i) => {
  const { parts, slots } = chunkify(tpl); const id = `W-BAS-${lvl}-${String(91 + i).padStart(3, '0')}`;
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

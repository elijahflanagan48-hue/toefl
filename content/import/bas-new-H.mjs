// Build a Sentence — items 081–090 (A/B/C × 20). Idempotent (replaces 081–090): node content/import/bas-new-H.mjs
// Entry: [focus, speaker line (campus dialogue), template, extra chunk (trap), Russian explanation]. {a|b|c} = consecutive slots; text outside braces is pre-filled.
import { readFileSync, writeFileSync } from 'node:fs';
const A = [
  ['Вопрос с how often', 'I study in the library every day.', 'How {often|do|you|go there}?', 'does', 'Порядок в вопросе: how often + do + подлежащее + глагол. После you нужен вспомогательный глагол do, а не does.'],
  ['Present Continuous в вопросе', 'I can hear loud music in the dorm.', 'What {are|they|doing}?', 'do', 'Действие происходит сейчас — Present Continuous: are they doing. Форма do с doing не образует вопрос.'],
  ['Past Simple: отрицание', 'Did you see the game last night?', 'No, I {didn\'t|watch|it}.', 'watched', 'После didn\'t глагол стоит в начальной форме: didn\'t watch. Форма watched после didn\'t неверна.'],
  ['Сравнительная степень', 'How is your new roommate?', 'She {is|friendlier|than|my old one}.', 'friendly', 'Сравнение: friendlier than. Форма friendly без -er сравнение не образует.'],
  ['Превосходная степень', 'Which café should we try?', 'The Corner Café {is|the cheapest|place|on campus}.', 'cheapest', 'Превосходная степень требует артикля: the cheapest. Форма cheapest без the в такой позиции неверна.'],
  ['Present Perfect с for', 'How long have you studied Spanish?', 'I {have|studied|it|for two years}.', 'since two years', 'For + период: for two years. Since используется с моментом начала, а не с периодом.'],
  ['Should', 'I have a headache and a test tomorrow.', 'You {should|take|a break}.', 'should to', 'После should глагол идёт без to: should take. Форма should to неверна.'],
  ['Don\'t have to', 'Do I need to bring my ID to the exam?', 'No, you {don\'t|have to|bring|it}.', 'doesn\'t', 'После you вспомогательный глагол — don\'t: you don\'t have to. Форма doesn\'t подходит только к he, she, it.'],
  ['Вопрос с be', 'I met your new teacher today.', 'What {is|her|name}?', 'does', 'В вопросе с глаголом be вспомогательный do не нужен: What is her name? Форма does здесь лишняя.'],
  ['Придаточное времени', 'Can you phone me after class?', 'I will {call you|when I|get home}.', 'will get', 'В придаточном времени будущее выражаем настоящим временем: when I get home. Will get в придаточном не ставится.'],
];
const B = [
  ['Косвенный вопрос с where', 'Where is the admissions office?', 'Could you tell me {where|the admissions office|is|located}?', 'does', 'В косвенном вопросе прямой порядок слов: where the admissions office is located. Вспомогательный does здесь не нужен.'],
  ['Косвенный вопрос с if', 'Is the bookstore open on Sundays?', 'I wonder {if|the bookstore|is open} on Sundays.', 'does', 'Косвенный вопрос «да/нет» вводится if и не требует инверсии: if the bookstore is open. Does в такой позиции лишний.'],
  ['Where в определительном придаточном', 'Where does the chess club meet?', 'It\'s the room {where|the club|holds|its meetings}.', 'which', 'К месту относится where: the room where the club holds its meetings. Which потребовал бы предлога и дополнения.'],
  ['Present Perfect в вопросе', 'Is the exam still on Friday?', 'Have you {heard|about|the new schedule}?', 'hearing', 'Вопрос в Present Perfect: have you + третья форма (heard). Форма hearing после have you неверна.'],
  ['Present Perfect Passive: отрицание', 'Is the library renovation finished?', 'Not yet, the roof {has not|been|repaired}.', 'have not', 'Пассив в Present Perfect: has not been repaired. Have not не согласуется с единственным числом the roof.'],
  ['Used to', 'Did you take the bus to school as a child?', 'Yes, I {used to|take|it|every day}.', 'use to', 'Прошлая привычка: used to + инфинитив. Форма use to без -d в утверждении неверна.'],
  ['Герундий как подлежащее', 'Is it okay to stay up all night before an exam?', '{Staying up late|is|bad|for your health}.', 'Stay up late', 'Подлежащее-действие выражаем герундием: Staying up late is bad. Инфинитив без to в роли подлежащего невозможен.'],
  ['Косвенный вопрос в прошлом', 'What did the librarian ask you?', 'She asked me {where|I|had found|the book}.', 'did I find', 'В косвенном вопросе прямой порядок слов и сдвиг времени: where I had found the book. Did I find — прямой вопрос.'],
  ['Neither of', 'Did both candidates answer the question?', 'No, {neither|of them|answered|it}.', 'nobody', 'Neither of them — «ни один из двоих». Nobody of them так не употребляется.'],
  ['Wish + would', 'The construction noise is annoying.', 'I wish {they|would|stop|it}.', 'will', 'Раздражение и просьба о прекращении — wish + would: I wish they would stop. Will после wish не используется.'],
];
const C = [
  ['Too … to + инфинитив', 'Why did the study fail to replicate?', 'The sample {was|too small|to|yield|reliable results}.', 'enough', 'Конструкция too + прилагательное + to-инфинитив: too small to yield. Enough ставится после прилагательного и в этой позиции неверен.'],
  ['Despite + существительное', 'Did the delay affect the final grade?', '{Despite|the delay}, {the students|submitted|their work} on time.', 'Although', 'Despite требует существительного: Despite the delay. После Although нужно целое придаточное с подлежащим и сказуемым.'],
  ['Пассив мнения с it', 'What do economists say about the policy?', 'It {is widely believed|that|the policy|has reduced|costs}.', 'believing', 'Безличный пассив: it is widely believed that …. Форма believing пассив не образует.'],
  ['Инверсия: Never before', 'Was the turnout unusual?', 'Never before {had|so many|students|voted}.', 'did', 'После Never before инверсия: had so many students voted. Did требует начальной формы, а здесь уже стоит voted.'],
  ['The fact that', 'Why was the proposal rejected?', '{The fact that|it ignored|safety concerns|troubled|the board}.', 'what', 'Придаточное-подлежащее вводится словами the fact that. What в этой позиции не употребляется.'],
  ['As long as', 'Can I use the lab after hours?', 'You may {use|the lab|as long as|you|sign in}.', 'so long', 'Условие выражается словами as long as. Форма so long без второго as неверна.'],
  ['Предлог перед which', 'Which theory does the author discuss?', 'The theory {on which|the argument|rests|is widely|disputed}.', 'that on', 'После предлога относительное местоимение — which: on which. Сочетание that on так не строится.'],
  ['It was only after … that', 'When did critics start paying attention?', 'It was only after {the results|were|published|that|critics|took notice}.', 'being', 'Расщеплённая конструкция в пассиве: after the results were published. Форма being без were пассив в этой позиции не образует.'],
  ['Косвенный вопрос с how little', 'What did the survey on student budgets show?', 'It revealed {how little|students|know|about budgeting}.', 'does', 'В придаточном дополнении прямой порядок слов: how little students know. Does здесь лишний.'],
  ['No matter how many', 'Will the fee change?', 'No matter {how many|students|enroll}, the fee {stays|the same}.', 'whatever', 'No matter how many — «сколько бы ни». Форма whatever many неверна.'],
];
const chunkify = tpl => { const parts = [], slots = []; for (const s of tpl.split(/(\{[^}]*\})/).filter(Boolean)) { if (s.startsWith('{')) for (const c of s.slice(1, -1).split('|')) { parts.push(null); slots.push(c); } else { const t = s.trim(); if (t) parts.push(t); } } return { parts, slots }; };
const sent = (parts, slots) => { let i = 0; return parts.map(p => p === null ? slots[i++] : p).join(' ').replace(/\s+([.?!,])/g, '$1'); };
const file = new URL('../writing/bas.json', import.meta.url);
const existing = JSON.parse(readFileSync(file)).filter(x => !/-(08[1-9]|090)$/.test(x.id));
const out = [];
for (const [lvl, list] of [['A', A], ['B', B], ['C', C]]) list.forEach(([focus, a, tpl, extra, ex], i) => {
  const { parts, slots } = chunkify(tpl); const id = `W-BAS-${lvl}-${String(81 + i).padStart(3, '0')}`;
  out.push({ id, level: lvl, focus, a, parts, slots, extra, ex });
});
writeFileSync(file, JSON.stringify(existing.concat(out), null, 1));
// review output: key sentence + every adjacent swap of two slots (the most likely alternative orders)
for (const it of out) {
  const key = sent(it.parts, it.slots); console.log(`\n${it.id} [${it.slots.length}] ${key}`);
  for (let i = 0; i < it.slots.length - 1; i++) { const s = it.slots.slice(); [s[i], s[i + 1]] = [s[i + 1], s[i]]; console.log('   swap', i, '→', sent(it.parts, s)); }
}

// Build a Sentence — items 111–120 (A/B/C × 10). Idempotent (replaces 111–120): node content/import/bas-new-K.mjs
// Entry: [focus, speaker line (campus dialogue), template, extra chunk (trap), Russian explanation]. {a|b|c} = consecutive slots; text outside braces is pre-filled.
import { readFileSync, writeFileSync } from 'node:fs';
const A = [
  ["Вопрос с how long в Past Simple", "I just got back from my trip to Spain.", "How long {did|you|stay} there?", "stayed", "После did в вопросе глагол стоит в начальной форме: did you stay. Форма stayed после did неверна."],
  ["Вопрос с who + предлог в конце", "I moved into a new apartment last week.", "Who {do|you|live} with?", "does", "С подлежащим you вспомогательный глагол — do: Who do you live with? Does используется только с he, she, it."],
  ["Наречие never в Present Simple", "Does your roommate cook a lot?", "No, she {never|cooks|at home}.", "cook", "Never стоит перед смысловым глаголом, а после she у глагола окончание -s: she never cooks. Форма cook без -s неверна."],
  ["Lend и borrow", "I left my calculator at home.", "Could {you|lend|me|yours}?", "borrow", "Дать на время — lend: Could you lend me yours? Borrow значит «взять на время» и не употребляется с дополнением me в таком значении."],
  ["Past Simple глагола be", "I called you yesterday, but you didn't answer.", "Sorry, I {was|at|the dentist}.", "were", "С подлежащим I в прошедшем времени используется was. Were — для you, we, they."],
  ["Притяжательное местоимение mine", "Someone left a phone on the table.", "Oh, that {phone|is|mine}.", "my", "В конце предложения без существительного нужно местоимение mine: that phone is mine. My требует существительного после себя."],
  ["Going to: прогноз по признакам", "Look at those dark clouds.", "It {is|going|to|rain} soon.", "will", "Прогноз по видимым признакам — be going to: It is going to rain. Will не сочетается с going to."],
  ["Any с неисчисляемым в вопросе", "I'm making coffee for everyone.", "Do we {have|any|milk} left?", "many", "Milk — неисчисляемое существительное: any milk. Many используют только с исчисляемыми во множественном числе."],
  ["Предлог at night", "When do you usually study?", "I usually {study|at|night}.", "in", "Устойчивое сочетание — at night. In the night в таком значении не говорят, а in night вообще неверно."],
  ["Вопрос к подлежащему с what", "Why is there water all over the floor?", "What {happened|in|the kitchen}?", "happen", "What здесь подлежащее, поэтому вспомогательный did не нужен, а глагол стоит в Past Simple: What happened? Форма happen неверна."],
];
const B = [
  ["Косвенный вопрос с who-подлежащим", "Who is giving the keynote speech tomorrow?", "I'm not sure {who|is|giving|the speech}.", "does", "Когда who — подлежащее, порядок в косвенном вопросе не меняется: who is giving the speech. Does здесь лишний."],
  ["Пассив в будущем времени", "Have the grades come out yet?", "Not yet. They {will|be|posted} by Friday.", "post", "Пассив в будущем: will be + третья форма (will be posted). Начальная форма post после be неверна."],
  ["Without + герундий", "How did you finish the essay so quickly?", "I wrote it {without|taking|a single|break}.", "take", "После предлога without глагол принимает форму -ing: without taking. Начальная форма take после предлога невозможна."],
  ["The same as", "Is the new edition of the textbook different?", "No, it's {almost|the same|as|last year's}.", "like", "Устойчивая конструкция — the same as. Сочетание the same like неверно."],
  ["Can't be: уверенный вывод", "Is that Professor Kim at the door?", "It {can't|be|her}. She is in Seoul this week.", "to", "Уверенное отрицание — can't + инфинитив без to: It can't be her. После модального глагола to не ставится."],
  ["Косвенная речь: said that", "What did the coach say about practice?", "He said {that|practice|was|canceled}.", "were", "Practice — неисчисляемое, единственное число, поэтому was canceled. Were не согласуется с этим подлежащим."],
  ["Present Perfect с since", "You and Sara seem like good friends.", "Yes, we {have|known|each other|since} high school.", "knew", "Состояние с прошлого до настоящего — Present Perfect: have known since. Форма knew после have неверна."],
  ["Who's = who is в придаточном", "Who is the student in the red jacket?", "That's the girl {who's|always|asking|questions}.", "whose", "Who's = who is: who's always asking questions. Whose означает «чей» и требует существительного после себя."],
  ["If I were you", "Should I take the job offer?", "If I were you, I {would|accept|it|right away}.", "will", "Совет через нереальное условие: If I were you, I would…. Will не сочетается с were в условии."],
  ["Get used to + -ing", "How are you finding the early classes?", "I'm {getting|used|to|waking up} early.", "wake up", "В конструкции get used to частица to — предлог, после неё нужна форма -ing: getting used to waking up. Начальная форма wake up неверна."],
];
const C = [
  ["Инверсия: Only then", "When did the team realize the data was wrong?", "After the second test. Only then {did|they|realize|that|the data|were flawed}.", "realized", "После Only then в начале — инверсия: did they realize. После did глагол стоит в начальной форме, поэтому realized неверно."],
  ["The reason … is that", "Why did the experiment fail?", "The reason {it|failed|is that|the samples|were|contaminated}.", "because", "Конструкция The reason (why) … is that …. Слово because не может заменить is that: без глагола is предложение остаётся без сказуемого."],
  ["Отрицательный причастный оборот", "Why didn't the new student ask for help?", "{Not|knowing|anyone|in the class}, she {was|too shy|to speak up}.", "Don't", "Отрицательный причастный оборот строится через Not + -ing: Not knowing anyone…. Don't с формой -ing не сочетается."],
  ["Wish + could", "Are you going to the conference in Berlin?", "No, but I wish {I|could|attend|it|this year}.", "can", "Сожаление о невозможности в настоящем — wish + could: I wish I could attend. Can после wish не употребляется."],
  ["All I need is", "What are you looking for in a study space?", "All {that|I|need|is|a quiet place} to work.", "are", "Придаточное All that I need — подлежащее в единственном числе, поэтому is. Are не согласуется с ним."],
  ["Личный пассив: is said to have", "What do we know about the architect of the library?", "He {is|said|to have|designed|over fifty|buildings}.", "says", "Личная пассивная конструкция: He is said to have designed… (= говорят, что он спроектировал). Форма says после is невозможна."],
  ["Инверсия: On no account", "Can we leave the lab door open overnight?", "On no account {should|the door|be|left|open}.", "being", "После On no account в начале — инверсия с модальным глаголом: should the door be left open. Being не может заменить ни should, ни be."],
  ["However + прилагательное", "Is the final problem set really hard?", "However {hard|it|may|seem}, you {can|finish|it} tonight.", "Whatever", "«Каким бы трудным ни» — However + прилагательное: However hard it may seem. Whatever сочетается с существительным, а не с прилагательным."],
  ["Инверсия: Such was … that", "Why did the concert tickets sell out so fast?", "Such {was|the demand|that|the tickets|sold out|in an hour}.", "were", "Такая инверсия согласуется с the demand (единственное число): Such was the demand. Were не согласуется с подлежащим."],
  ["Much as = although", "Will you take another course with Dr. Hale?", "Much {as|I|enjoy|her lectures}, I {cannot|fit|another course} into my schedule.", "though", "Устойчивая уступительная конструкция — Much as I enjoy… (= Хотя мне очень нравятся…). Сочетание Much though не употребляется."],
];
const chunkify = tpl => { const parts = [], slots = []; for (const s of tpl.split(/(\{[^}]*\})/).filter(Boolean)) { if (s.startsWith('{')) for (const c of s.slice(1, -1).split('|')) { parts.push(null); slots.push(c); } else { const t = s.trim(); if (t) parts.push(t); } } return { parts, slots }; };
const sent = (parts, slots) => { let i = 0; return parts.map(p => p === null ? slots[i++] : p).join(' ').replace(/\s+([.?!,])/g, '$1'); };
const file = new URL('../writing/bas.json', import.meta.url);
const all = JSON.parse(readFileSync(file));
const existing = all.filter(x => !/-(11[1-9]|120)$/.test(x.id));
const out = [];
for (const [lvl, list] of [['A', A], ['B', B], ['C', C]]) list.forEach(([focus, a, tpl, extra, ex], i) => {
  const { parts, slots } = chunkify(tpl); const id = `W-BAS-${lvl}-${String(111 + i).padStart(3, '0')}`;
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

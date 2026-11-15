// Build a Sentence — items 061–080 (A/B/C × 20). Replaces the earlier 061–070 draft and adds 071–080. Idempotent: node content/import/bas-new-G.mjs
// Entry: [focus, speaker line (campus dialogue), template, extra chunk (trap), Russian explanation]. {a|b|c} = consecutive slots; text outside braces is pre-filled.
import { readFileSync, writeFileSync } from 'node:fs';
const A = [
  ['Present Perfect с never', 'Have you ever been to the campus gym?', 'No, I {have never|been|there}.', 'went', 'Present Perfect: have never been. Форма went — Past Simple, с have она не сочетается.'],
  ['There are + число', 'How many students are in your class?', 'There {are|twenty|students|in my class}.', 'is', 'Students — множественное число, поэтому there are. There is стоит только перед единственным числом.'],
  ['Предлоги места', 'I can\'t find the library.', 'It {is|next to|the main gate}.', 'next of', 'Расположение рядом выражаем оборотом next to. Форма next of так не употребляется.'],
  ['Like + герундий', 'What do you do after class?', 'I {like|playing|chess|with my friends}.', 'play', 'После like, когда речь об увлечении, ставим -ing: like playing. Форма play после like не подходит.'],
  ['Объектные местоимения', 'Do you know the new students?', 'Yes, I {met|them|at orientation}.', 'they', 'После глагола нужна объектная форма: met them. Форма they — подлежащее, на месте дополнения она невозможна.'],
  ['Could в отрицании', 'Could you speak English when you started school?', 'No, I {couldn\'t|speak|it well}.', 'wasn\'t', 'Речь о прошлом способности: couldn\'t speak. Форма wasn\'t с инфинитивом speak не образует сказуемое.'],
  ['Too + прилагательное', 'Did you buy the textbook?', 'No, it {was|too|expensive|for me}.', 'enough', 'Too + прилагательное = «слишком»: too expensive. Enough стоит после прилагательного и означает «достаточно».'],
  ['Условное 1-го типа', 'What will you do if the library is closed?', 'If it is closed, I {will|study|at home}.', 'am', 'В главной части условного 1-го типа — will + инфинитив: will study. Am study не образует сказуемое.'],
  ['Some в утверждении', 'Do you need anything from the cafeteria?', 'Yes, I {need|some|coffee}.', 'many', 'В утвердительном предложении используем some: need some coffee. Many с неисчисляемым coffee не употребляется.'],
  ['Даты и предлог on', 'When is the registration deadline?', 'It {is|on|the third|of May}.', 'in', 'С конкретным числом ставим on: on the third of May. In используется с месяцами и годами без числа.'],
  ['Present Continuous для планов', 'What are you doing this weekend?', 'We {are|visiting|the science museum}.', 'visit', 'Запланированное действие — Present Continuous: are visiting. Форма visit после are не образует сказуемое.'],
  ['Наречие частоты', 'Do you ever eat in the cafeteria?', 'Yes, I {often|eat|there}.', 'eating', 'Наречие частоты стоит перед смысловым глаголом: often eat. Форма eating без вспомогательного глагола не образует сказуемое.'],
  ['Вопрос с what kind of', 'I want to join a club.', '{What|kind of club|do|you|want to join}?', 'does', 'Порядок в вопросе: вопросительное слово + do + подлежащее + глагол. После you вспомогательный глагол do, а не does.'],
  ['Просьба с can', 'I forgot my pen.', '{Can|I|borrow|yours}?', 'borrowing', 'В вопросе с can подлежащее стоит после can, а затем идёт инфинитив без to: Can I borrow. Форма borrowing не подходит.'],
  ['Past Simple неправильного глагола', 'Why were you late?', 'I {missed|the bus|this morning}.', 'missing', 'Действие в прошлом — Past Simple: missed. Форма missing без вспомогательного глагола не образует сказуемое.'],
  ['Предлоги времени', 'What time does the seminar begin?', 'It {starts|at|nine thirty}.', 'in', 'С точным временем ставим at: at nine thirty. In используется с частями суток и месяцами.'],
  ['Сравнительная степень', 'Which dorm is better?', 'The new dorm {is|bigger|than|the old one}.', 'more big', 'Короткое прилагательное образует сравнительную степень суффиксом: bigger. Форма more big неверна.'],
  ['Have to', 'Why are you in a hurry?', 'I {have to|hand in|my essay|today}.', 'must to', 'Have to + инфинитив без to-частицы после него: have to hand in. Must не требует to, поэтому must to неверно.'],
  ['Present Simple, 3-е лицо', 'What does your roommate study?', 'She {studies|biology|at the university}.', 'study', 'После she у глагола окончание -es: studies. Форма study подходит к I, you, we, they.'],
  ['Going to для планов', 'What are your plans after graduation?', 'I {am going to|study|medicine|in Canada}.', 'going', 'Be going to + инфинитив: am going to study. Одна форма going без be не образует сказуемое.'],
];
const B = [
  ['Косвенная просьба', 'What did the professor ask you to do?', 'She asked {me|to rewrite|the introduction}.', 'rewriting', 'Ask + кому + to + инфинитив: asked me to rewrite. После ask герундий не используется.'],
  ['Present Perfect с since', 'How long have you been in this program?', 'I {have been|in it|since last September}.', 'for last September', 'Since + момент начала: since last September. For используется с периодом (for a year).'],
  ['Be used to + -ing', 'Isn\'t it hard to study in the dorm?', 'Not really, I {am|used to|studying|with noise}.', 'use to', 'Be used to + -ing означает «привык»: am used to studying. Форма use to без be относится к привычкам в прошлом.'],
  ['Enough после прилагательного', 'Can first-year students apply for the exchange program?', 'No, they {have not|studied|long enough|to qualify}.', 'enough long', 'Enough стоит после наречия или прилагательного: long enough. Порядок enough long неверен.'],
  ['Определительное придаточное с that', 'Which laptop did you buy?', 'I bought the one {that|my cousin|recommended}.', 'what', 'Определяем существительное (the one) словом that. What не вводит определительное придаточное.'],
  ['Условное 2-го типа', 'Would you move to another city after graduation?', 'I would {move|if I|had|a job there}.', 'having', 'Условное 2-го типа: would + инфинитив … if + Past Simple (had). Форма having без вспомогательного глагола не образует сказуемое.'],
  ['Пассив в Past Simple с by', 'Who designed the new library?', 'It {was|designed|by|a student team}.', 'designing', 'Пассив в Past Simple: was designed by. Причастие designing выражает активное действие и пассив не образует.'],
  ['So that', 'Why did you record the lecture?', 'I recorded it {so that|I|could|review it later}.', 'so as to', 'So that вводит придаточное цели с собственным подлежащим: so that I could review it. So as to требует инфинитива без подлежащего.'],
  ['Little с неисчисляемым', 'Do you have much free time this semester?', 'No, I {have|very little|free time}.', 'very few', 'Time неисчисляемое, поэтому little. Few используется с исчисляемыми существительными.'],
  ['Look forward to + -ing', 'Are you excited about the field trip?', 'Yes, I\'m {looking forward|to|seeing|the museum}.', 'see', 'В look forward to частица to — предлог, поэтому дальше идёт -ing: to seeing. Инфинитив see неверен.'],
  ['Косвенный вопрос с why', 'Why is the lab closed today?', 'I\'m not sure {why|the lab|is closed}.', 'does', 'В косвенном вопросе прямой порядок слов: why the lab is closed. Вспомогательный глагол does здесь не нужен.'],
  ['Косвенный вопрос с whether', 'Did the professor extend the deadline?', 'I don\'t know {whether|she|extended|it}.', 'what', 'Whether вводит косвенный вопрос «да/нет»: whether she extended it. What требует пропущенного члена предложения, а здесь все члены уже есть.'],
  ['Определительное придаточное с who', 'Who is the student that won the award?', 'He is the student {who|has been|tutoring|first-years}.', 'which', 'К человеку относится who: the student who has been tutoring. Which употребляется с предметами.'],
  ['Present Perfect в вопросе', 'I\'m trying to book a study room.', '{Have|you|ever|used|the quiet room}?', 'Did', 'Вопрос в Present Perfect: have + подлежащее + третья форма. Did требует Past Simple и не сочетается с used после ever в этой конструкции.'],
  ['Условное 3-го типа', 'Why didn\'t you attend the career fair?', 'If I {had known|about it}, {I|would have|gone}.', 'have known', 'Условное 3-го типа: if + Past Perfect (had known), would have + третья форма. Форма have known после if не образует нужное условие.'],
  ['Wish + Past Simple', 'Is the commute bothering you?', 'Yes, I wish {I|lived|closer|to campus}.', 'live', 'Желание о нереальном настоящем: wish + Past Simple (lived). Форма live выражает реальное настоящее.'],
  ['Косвенная речь', 'What did the advisor say?', 'She said {the deadline|had been|extended}.', 'have been', 'Прошедшее событие после said — Past Perfect: had been extended. Форма have been не согласуется с the deadline.'],
  ['Пассив с модальным глаголом', 'Can students submit the form late?', 'No, it {must|be|submitted|by Friday}.', 'submitting', 'Пассив с модальным: must be submitted. Форма submitting пассив не образует.'],
  ['Although', 'How was the midterm?', 'Although {the exam|was|long}, most students {finished|early}.', 'Despite', 'Although вводит целое придаточное: although the exam was long. Despite требует существительного или герундия, а не предложения.'],
  ['Suggest that + инфинитив', 'What should we do for the group project?', 'I suggest {that|we|divide|the work}.', 'dividing', 'После suggest that подлежащее и глагол в базовой форме: that we divide. Форма dividing с подлежащим we невозможна.'],
];
const C = [
  ['Инверсия: Hardly … when', 'Did you leave before the storm hit?', 'Hardly {had we|left|when|the rain started}.', 'did we', 'После Hardly подлежащее и вспомогательный меняются местами: had we left. Форма did we не сочетается с Hardly … when.'],
  ['Wish + Past Perfect', 'Do you regret skipping the lecture?', 'Yes, I wish {I had|attended|the whole thing}.', 'I have', 'Сожаление о прошлом: wish + Past Perfect (I had attended). Форма I have после wish не передаёт прошедшее время.'],
  ['Причастный оборот', 'What did the committee do about the proposal?', 'Having {reviewed the proposal}, {the committee|approved it}.', 'review', 'Причастие совершенного вида: having + третья форма (having reviewed). Форма review после having неверна.'],
  ['Whom после предлога', 'Who did you work with on the paper?', 'She is the researcher {with whom|I|co-authored|the paper}.', 'who', 'После предлога относительное местоимение — whom: with whom. Who после предлога не ставится.'],
  ['Сослагательное после insist', 'What did the dean insist on?', 'She insisted {that|the policy|be|reviewed}.', 'being', 'После insist that используется сослагательное наклонение: that the policy be reviewed. Форма being здесь неверна.'],
  ['Инверсия: Only when', 'When do you plan to publish?', 'Only when {the data are verified|will|we|publish}.', 'did', 'После Only when в главной части инверсия: will we publish. Did относится к прошлому и не сочетается с are verified.'],
  ['Согласование: the number of', 'How many participants dropped out?', '{The number of|participants|who withdrew|was|small}.', 'were', 'The number of … — единственное число: the number was small. Форма were относилась бы к a number of.'],
  ['Инверсия: Under no circumstances', 'May we share our login details with friends?', 'Under no circumstances {should|you|share|your password}.', 'sharing', 'После Under no circumstances инверсия: should you share. Форма sharing после should не подходит.'],
  ['Regret + перфектный герундий', 'Do you regret your decision?', 'Yes, I regret {not|having accepted|the offer}.', 'to accept', 'Сожаление о прошлом: regret + (not) having + третья форма. Regret to accept означает «с сожалением принимаю».'],
  ['Unless', 'Will the trip go ahead if the weather is bad?', 'It will {go ahead|unless|the forecast|gets worse}.', 'otherwise', 'Unless = if not и вводит придаточное: unless the forecast gets worse. Otherwise — наречие и придаточное не вводит.'],
  ['Расщеплённое предложение', 'Who encouraged you to study abroad?', 'It was {my professor|who|first suggested|the idea}.', 'whom', 'Расщеплённое предложение: It was … who …. Whom здесь не подходит, потому что слово выполняет роль подлежащего: who first suggested.'],
  ['Инверсия: So … that', 'Was the lecture popular?', 'So {crowded|was|the hall|that|many students stood}.', 'such', 'После So + прилагательное в начале идёт инверсия: So crowded was the hall. Such требует существительного.'],
  ['Подлежащее-придаточное с what', 'What did the survey show?', 'What {surprised|everyone|was|the low turnout}.', 'surprising', 'Придаточное-подлежащее: What surprised everyone was …. Форма surprising в роли сказуемого неверна.'],
  ['Условное 3-го типа (инверсия смысла)', 'Why didn\'t you ask for help?', 'I would have {asked|if I|had known|it was allowed}.', 'have known', 'Условное 3-го типа: would have asked, if I had known. Форма have known после if не подходит.'],
  ['Need + пассивный инфинитив', 'Why is the printer out of service?', 'It {needs|to be|repaired|by a technician}.', 'repairing', 'Пассивный инфинитив: needs to be repaired. Форма repairing после to be неверна.'],
  ['The extent to which', 'How reliable are the results?', '{The extent|to which|the findings|apply|remains|unclear}.', 'whose', 'После extent нужен предлог и which: the extent to which. Whose вводит принадлежность и здесь невозможно.'],
  ['Инверсия: At no point', 'Did the university warn residents about the closure?', 'At no point {did|the staff|inform|us|of the closure}.', 'were', 'После At no point инверсия с did: did the staff inform. Were не сочетается с inform us.'],
  ['Twice as … as', 'How big is the new lab?', 'It is {twice|as large|as|the old one}.', 'than', 'Кратное сравнение: twice as large as. Than после as large не ставится.'],
  ['Nor + инверсия', 'Hardly any students have read the report.', 'Nor {have|the instructors|read it}.', 'has', 'После Nor инверсия в Present Perfect: have the instructors read it. Has не согласуется с множественным the instructors.'],
  ['Due to + герундий', 'Why was the meeting postponed?', 'It was due to {the speaker|being|unable|to attend}.', 'be', 'После предлога to употребляется герундий: due to the speaker being unable. Форма be после to даёт неверную структуру.'],
];
const chunkify = tpl => { const parts = [], slots = []; for (const s of tpl.split(/(\{[^}]*\})/).filter(Boolean)) { if (s.startsWith('{')) for (const c of s.slice(1, -1).split('|')) { parts.push(null); slots.push(c); } else { const t = s.trim(); if (t) parts.push(t); } } return { parts, slots }; };
const sent = (parts, slots) => { let i = 0; return parts.map(p => p === null ? slots[i++] : p).join(' ').replace(/\s+([.?!,])/g, '$1'); };
const file = new URL('../writing/bas.json', import.meta.url);
const existing = JSON.parse(readFileSync(file)).filter(x => !/^W-BAS-[ABC]-0(6|7)\d$|^W-BAS-[ABC]-080$/.test(x.id) || /-0(5\d|60)$/.test(x.id));
const out = [];
for (const [lvl, list] of [['A', A], ['B', B], ['C', C]]) list.forEach(([focus, a, tpl, extra, ex], i) => {
  const { parts, slots } = chunkify(tpl); const id = `W-BAS-${lvl}-${String(61 + i).padStart(3, '0')}`;
  out.push({ id, level: lvl, focus, a, parts, slots, extra, ex });
});
writeFileSync(file, JSON.stringify(existing.concat(out), null, 1));
// review output: key sentence + every adjacent swap of two slots (the most likely alternative orders)
for (const it of out) {
  const key = sent(it.parts, it.slots); console.log(`\n${it.id} [${it.slots.length}] ${key}`);
  for (let i = 0; i < it.slots.length - 1; i++) { const s = it.slots.slice(); [s[i], s[i + 1]] = [s[i + 1], s[i]]; console.log('   swap', i, '→', sent(it.parts, s)); }
}

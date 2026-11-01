// Build a Sentence — 90 new items (A/B/C × 30). Run once: node content/import/bas-new.mjs
// Entry: [focus, speaker A line, template, extra chunk, Russian explanation]
// Template: {chunk|chunk|…} = consecutive slots in the correct order; text outside braces is fixed.
import { readFileSync, writeFileSync } from 'node:fs';

const A = [
  ['Past Simple', 'Where did you leave your umbrella?', 'I {left|my umbrella|on the bus}.', 'leaving', 'После did в вопросе отвечаем Past Simple: left. Форма leaving без вспомогательного глагола не образует сказуемое.'],
  ['Would like + to', 'Do you want to join the study group?', 'Yes, I {would like|to come|to the meeting}.', 'coming', 'Would like + to + инфинитив: would like to come. После would like герундий не ставится.'],
  ['Притяжательный падеж', 'Whose notebook is this?', '{it|is|my sister\'s|notebook}.', 'sisters', 'Принадлежность выражается через \'s: my sister\'s notebook. Форма sisters — это просто множественное число.'],
  ['There are + множественное', 'What\'s on the kitchen table?', '{there are|some apples|on|the table}.', 'There is', 'Some apples — множественное число, поэтому there are. There is подходит только к единственному числу.'],
  ['Present Simple, 3-е лицо', 'What does Lena do on weekends?', 'She {visits|her grandmother|every Sunday}.', 'visit', 'В Present Simple после she у глагола окончание -s: visits. Форма visit подошла бы к I, you, we, they.'],
  ['Предлоги on / at', 'When is the exam?', 'It {is|on Monday|at ten}.', 'in', 'С днём недели — on, с точным временем — at. Порядок: сначала день, потом время. In с днями недели не употребляется.'],
  ['Can: отрицание', 'Can your brother drive?', 'No, he {can\'t|drive|yet}.', 'cans', 'После модального глагола can инфинитив без окончаний: can\'t drive. Формы cans в английском не существует.'],
  ['Present Continuous: отрицание', 'Is Tom working today?', 'No, he {isn\'t|working|today}.', 'don\'t', 'Вопрос с Is — ответ с isn\'t + глагол с -ing. Don\'t относится к Present Simple.'],
  ['Неправильные глаголы', 'How many books did you buy?', 'I {bought|three books|yesterday}.', 'buyed', 'Buy — неправильный глагол: bought. Форма buyed не существует.'],
  ['Past Simple с ago', 'Did you finish your homework?', 'Yes, I {finished|it|an hour ago}.', 'have', 'С выражением an hour ago используется Past Simple. Have finished с ago не сочетается.'],
  ['Сравнительная степень', 'Which bag should I buy?', 'The {blue one|is|cheaper|than|the black one}.', 'more cheap', 'У коротких прилагательных сравнительная степень образуется суффиксом: cheaper than. More cheap — ошибка.'],
  ['Превосходная степень', 'Who is the tallest student in your class?', '{Marco|is|the tallest|boy|in our class}.', 'most tall', 'У коротких прилагательных превосходная степень образуется суффиксом -est: the tallest. Most tall — ошибка.'],
  ['Повелительное наклонение', 'How do I log in to the system?', '{enter|your ID|and|click|Next}.', 'entering', 'Инструкция — это повелительное наклонение: глагол без изменений. Entering не работает как команда.'],
  ['Present Continuous: планы', 'What are you doing tonight?', 'I {am|meeting|my friends|at seven}.', 'meet', 'Am + глагол с -ing выражает запланированное действие: am meeting. После am голая форма meet невозможна.'],
  ['Have to', 'Why can\'t you come to the party?', 'I {have to|finish|my project|tonight}.', 'must to', 'Обязанность выражается have to + инфинитив. Must to — ошибка: после must частица to не нужна.'],
  ['Because и Past Simple', 'Why is Ana late?', 'She {missed|the bus|because|she|woke up late}.', 'wake', 'Because вводит причину, в обоих предложениях Past Simple: missed, woke up. Wake не согласуется со временем.'],
  ['Вопрос с does', 'I\'m going to the library now.', '{what time|does|it|close}?', 'closes', 'В вопросе с does смысловой глагол стоит в начальной форме: does it close. Closes после does не нужен.'],
  ['Вопрос с be', 'I have a new roommate.', '{where|is|he|from}?', 'does', 'С глаголом be вспомогательное does не нужно: Where is he from? Does используется с другими глаголами.'],
  ['Артикли a / an', 'What did you eat for lunch?', 'I {ate|a sandwich|and|an apple}.', 'eated', 'Eat — неправильный глагол: ate. Артикль a перед согласным звуком, an — перед гласным.'],
  ['Present Simple, частота', 'How often do you go to the gym?', 'I {go|there|twice a week}.', 'goes', 'После I глагол без окончания: go. Goes нужен для he, she, it.'],
  ['Предлоги места', 'Where is the post office?', 'It {is|between|the bank|and|the school}.', 'among', 'Between используется для двух объектов и требует and: between the bank and the school. Among — для групп из трёх и более.'],
  ['Модальный глагол should', 'I have a headache. What should I do?', 'You {should|drink|some water|and rest}.', 'to', 'После should идёт инфинитив без to: should drink. Частица to здесь лишняя.'],
  ['Притяжательные местоимения', 'Is that Ben\'s phone?', 'No, it {isn\'t|his|phone}.', 'he\'s', 'His — притяжательное местоимение: his phone. He\'s означает he is или he has и после it isn\'t не подходит.'],
  ['Past Simple глагола be', 'Were you at the concert?', 'Yes, I {was|there|with|my cousin}.', 'were', 'С местоимением I в прошедшем времени используется was. Were подходит к you, we, they.'],
  ['Going to', 'What are you going to do after class?', 'I {am going|to have|lunch|with Sam}.', 'will', 'Намерение выражается am going to + инфинитив. Will в этой конструкции не нужен.'],
  ['Present Perfect с ever / never', 'Have you ever been to London?', 'No, I {have|never|been|there}.', 'was', 'Опыт выражается Present Perfect: have never been. Was never не отвечает на вопрос в этом времени.'],
  ['Наречия образа действия', 'How did the team play?', 'They {played|very|well|yesterday}.', 'good', 'Наречие от good — well: played very well. Good — прилагательное и после глагола действия не используется.'],
  ['Личные местоимения', 'Do you know the new teacher?', 'Yes, I {met|her|last week}.', 'she', 'После глагола нужен объектный падеж: met her. She — подлежащее и после глагола не ставится.'],
  ['Present Simple: отрицание', 'Does your sister eat meat?', 'No, she {doesn\'t|eat|any meat}.', 'don\'t', 'С she в отрицании используется doesn\'t + глагол без окончания. Don\'t относится к I, you, we, they.'],
  ['Will для обещаний', 'When will you call me?', 'I {will call|you|after|class}.', 'will calls', 'После will глагол без окончания: will call. Will calls — ошибка.']
];

const B = [
  ['Косвенный вопрос', 'What did the receptionist ask you?', 'She {wanted to know|where|I|had parked|my car}.', 'did I', 'После wanted to know порядок слов прямой: where I had parked. Did I — порядок прямого вопроса, здесь он не нужен.'],
  ['Косвенная речь', 'What did the coach say?', 'He said that {we|would play|the final|on Saturday}.', 'to play', 'После said that идёт полное придаточное со сдвигом времён: we would play. To play не образует сказуемое.'],
  ['Пассив в Past Simple', 'Why is the road closed?', 'It {was damaged|by|a storm|last night}.', 'damaged', 'Пассив: was damaged by a storm. Без was форма damaged не образует сказуемое.'],
  ['Определительное придаточное с who', 'Who is Dr. Lee?', 'She {is|the professor|who|teaches|my chemistry class}.', 'which', 'К людям относится who: the professor who teaches. Which употребляется для предметов.'],
  ['Условное предложение 2-го типа', 'Would you travel more if you could?', 'Yes, I {would travel|much more|if|the flights|were cheaper}.', 'would be', 'Тип 2: if + Past Simple, would + глагол. После if would не ставится: if the flights were cheaper.'],
  ['Present Perfect Continuous', 'Why are your eyes so red?', 'I {have been|studying|for|six hours}.', 'since', 'Have been studying for + период времени. Since требует точки отсчёта (since morning), а не длительности.'],
  ['Герундий после enjoy', 'What do you like about your job?', 'I {enjoy|working|with|international students}.', 'to work', 'После enjoy идёт герундий: enjoy working. Инфинитив с to здесь не используется.'],
  ['Used to', 'Did you always live in the city?', 'No, I {used to|live|in a small village}.', 'am used to', 'Used to + инфинитив обозначает прошлую привычку или состояние. Am used to требует герундия.'],
  ['Not as … as', 'Is the new library bigger than the old one?', 'Actually, it {is|not|as big|as|the old one}.', 'more big', 'Равенство и неравенство: not as big as. Форма more big неверна: у коротких прилагательных суффикс -er.'],
  ['Модальный перфект', 'Why didn\'t Ahmed answer the phone?', 'He {might|have|been|sleeping}.', 'might has', 'Предположение о прошлом: might have been sleeping. После модального глагола have без окончаний.'],
  ['Present Perfect Passive', 'Is the report ready?', 'Yes, it {has|been|sent|to the director}.', 'have', 'Present Perfect Passive: has been sent. С it нужен has, а не have.'],
  ['Wish + Past Simple', 'Do you like living far from campus?', 'Not really. I wish {I|lived|closer|to campus}.', 'live', 'Нереальное желание о настоящем выражается через Past Simple: I wish I lived. Начальная форма live не подходит.'],
  ['Пассив с модальным глаголом', 'Can students use their phones during the test?', 'No, phones {must|be|turned off}.', 'must to', 'Модальный пассив: must be turned off. После must частица to не нужна.'],
  ['Whose в определительном придаточном', 'Which student won the prize?', 'It was {the girl|whose|essay|was chosen|by the judges}.', 'who\'s', 'Whose показывает принадлежность: the girl whose essay. Who\'s — сокращение от who is или who has.'],
  ['So that', 'Why did Mia buy a new alarm clock?', 'She {bought it|so that|she|wouldn\'t|be late}.', 'so as', 'So that вводит цель, после него идёт полное придаточное: so that she wouldn\'t be late. So as требует инфинитива.'],
  ['Although', 'Did you enjoy the lecture?', 'Yes, I {enjoyed it|although|the room|was cold}.', 'despite', 'Although вводит полное придаточное: although the room was cold. Despite требует существительного или герундия.'],
  ['Косвенный вопрос после Do you know', 'I need to find the registrar\'s office.', '{do you know|where|it|is}?', 'does', 'В косвенном вопросе после Do you know порядок прямой: where it is. Does здесь лишнее.'],
  ['Past Perfect', 'Why were you so surprised?', 'I {had never|seen|such a large crowd|before}.', 'seeing', 'Past Perfect: had never seen. Форма seeing без вспомогательного глагола не образует сказуемое.'],
  ['Because of', 'Why was the flight delayed?', 'It {was delayed|because of|the heavy fog}.', 'because', 'Because of + существительное: because of the heavy fog. Because требует придаточного со сказуемым.'],
  ['Too + прилагательное', 'Can you carry the box?', 'No, it {is|too|heavy|for me}.', 'enough', 'Too heavy for me — слишком тяжёлая. Enough в утвердительной конструкции так не ставится, и значение было бы противоположным.'],
  ['Suggest + герундий', 'What should we do this weekend?', 'I {suggest|going|to the museum|on Saturday}.', 'to go', 'После suggest идёт герундий: suggest going. Инфинитив с to здесь неправилен.'],
  ['Вопрос в Past Simple Passive', 'Everyone is talking about the festival.', '{when|was|it|announced}?', 'did', 'В вопросе пассива вспомогательный глагол be стоит перед подлежащим: was it announced. Did не нужен.'],
  ['Сложное дополнение', 'What did your parents want?', 'They {wanted|me|to apply|for the scholarship}.', 'applying', 'Want + кто-то + to-инфинитив: wanted me to apply. Герундий здесь не используется.'],
  ['Определительное придаточное с that', 'Which book did you borrow?', 'It\'s {the one|that|my professor|recommended}.', 'what', 'The one that my professor recommended — определительное придаточное. What не может присоединяться к существительному.'],
  ['Придаточное времени с as soon as', 'When will we get the test results?', 'You {will receive|them|as soon as|the teachers|finish grading}.', 'will finish', 'После as soon as будущее выражается через Present Simple: finish grading. Will finish в придаточном времени неправильно.'],
  ['Both … and', 'Is the course useful?', 'Yes, it {teaches|both|writing|and|speaking}.', 'either', 'Both … and соединяет два элемента: both writing and speaking. Either требует or.'],
  ['Whether + инфинитив', 'Did Mia accept the job?', 'She {hasn\'t|decided|whether|to accept it|yet}.', 'decide', 'Present Perfect: hasn\'t decided. После hasn\'t нужна форма третьей формы глагола, а не начальная.'],
  ['Present Perfect с for / since', 'Where is everyone?', 'Most students {have gone|home|for|the holiday}.', 'have went', 'Present Perfect образуется с причастием gone. Form went — это Past Simple.'],
  ['Little и few', 'Is there enough time for questions?', 'Unfortunately, {there|is|very little|time|left}.', 'very few', 'Time — неисчисляемое существительное, поэтому little. Few используется с исчисляемыми.'],
  ['Предлог + герундий', 'How did you improve your listening?', 'I {improved|it|by|watching|online lectures}.', 'watch', 'После предлога by идёт герундий: by watching. Начальная форма watch после предлога невозможна.']
];

const C = [
  ['Инверсия: No sooner … than', 'Did the lecture go smoothly?', 'No sooner {had|the lecture|begun|than|the projector|failed}.', 'when', 'No sooner … than вызывает инверсию: had the lecture begun. With when конструкция неправильна: нужен than.'],
  ['Инверсия: Rarely', 'Does the professor give extensions?', 'Rarely {does|she|grant|an extension|without a good reason}.', 'grants', 'После Rarely в начале предложения идёт инверсия: does she grant. После does глагол без окончания.'],
  ['Сослагательное наклонение', 'Why is Mr. Dunn attending the meeting?', 'The board {insisted|that|he|be|present}.', 'is', 'После insist that используется сослагательное наклонение: he be present. Is здесь неправильно.'],
  ['Расщеплённое предложение', 'Did the manager make the final decision?', 'No, it {was|the committee|that|made|the final decision}.', 'what', 'Cleft-конструкция: it was the committee that made. What не присоединяется к существительному.'],
  ['Смешанное условное', 'Why aren\'t you in the engineering program?', 'I {would be|studying|engineering|if I|had passed|the exam}.', 'would have been', 'Смешанный тип: условие в прошлом, следствие в настоящем. Had passed в условии, would be studying в главной.'],
  ['Пассив с глаголами мнения', 'Is the old bridge in good condition?', 'The bridge {is believed|to have been|damaged|in the storm}.', 'believed', 'Is believed to have been damaged — пассив с перфектным инфинитивом. Одно believed без is не образует сказуемое.'],
  ['Причастный оборот', 'How did Lena find out about the scholarship?', '{browsing|the department\'s website}, she {noticed|the announcement}.', 'browsed', 'Причастие настоящего времени в начале предложения: Browsing … she noticed. Browsed в этой роли недопустимо.'],
  ['Which как комментарий', 'Why is the library so crowded?', 'The exams start soon, {which|is why|everyone|is studying}.', 'what', 'Which присоединяет комментарий к предыдущему предложению: which is why. What не может выполнять эту функцию.'],
  ['Despite / in spite of', 'Did the team finish on time?', 'Yes, they {met the deadline|in spite of|losing|two members}.', 'in spite', 'In spite of — цельное сочетание. Без of оно неправильно.'],
  ['Придаточное подлежащее', 'Were the survey results expected?', 'No, what {the survey|found|surprised|many researchers}.', 'that', 'Придаточное с what выступает как подлежащее: What the survey found surprised many researchers. That не подходит.'],
  ['Seem + перфектный инфинитив', 'Why is the lab empty?', 'The researchers {seem|to have|left|early}.', 'to had', 'Seem to have left — перфектный инфинитив. To had — ошибка: после to нужна начальная форма.'],
  ['Whoever', 'Who should I give the form to?', 'You can give it to {whoever|is|working|at the front desk}.', 'whatever', 'Whoever — любой человек, который. Whatever относится к предметам.'],
  ['Каузатив have', 'Did you repair your laptop yourself?', 'No, I {had|it|repaired|by a technician}.', 'repair', 'Каузатив: had it repaired. Начальная форма repair в этой конструкции не подходит.'],
  ['Инверсия: Only after', 'Can students access the archive freely?', 'Only after {registering|can|students|enter|the archive}.', 'students can', 'После Only after идёт инверсия: can students enter. Students can — прямой порядок.'],
  ['Условное без if', 'Did the volunteers help a lot?', 'Yes, {without|them|the event|would have|failed}.', 'will have', 'Without + местоимение заменяет условное придаточное: would have failed. Will have failed относится к будущему.'],
  ['Would rather … than', 'Would you like to take the bus?', 'I\'d {rather|walk|than|wait|in the rain}.', 'prefer', 'Would rather + инфинитив без to: would rather walk than wait. Prefer требует to или другой конструкции.'],
  ['So … that', 'Did the new policy work?', 'It {worked|so well|that|other schools|adopted it}.', 'such well', 'So well that — следствие. Such well неправильно: such идёт с существительными.'],
  ['Depends on whether', 'Will the trip be canceled?', 'That {depends|on|whether|the weather|improves}.', 'that', 'Depends on whether — зависит от того, ли. That в этой роли не подходит.'],
  ['Сравнение количества', 'Is enrollment growing?', 'No, {fewer students|enrolled|this year|than|last year}.', 'less', 'Few — с исчисляемыми существительными: fewer students. Less — с неисчисляемыми.'],
  ['Приложение', 'Who wrote this report?', 'It was written by Dr. Alvarez, {a historian|who|works|at our university}.', 'which', 'Who относится к человеку: a historian who works. Which употребляется для предметов.'],
  ['Пассивный инфинитив', 'What does the old equipment need?', 'It {needs|to be|replaced|as soon as possible}.', 'replacing', 'Needs to be replaced — пассивный инфинитив. Replacing с to be не сочетается.'],
  ['Инверсия: Little did', 'Did you know about the merger?', 'No, little {did|we|realize|how serious it was}.', 'we did', 'После Little в начале предложения идёт инверсия: did we realize. We did — прямой порядок.'],
  ['In which', 'What is a seminar?', 'It is {a class|in which|students|discuss|ideas|with a professor}.', 'that', 'Предлог перед which: in which students discuss. That не может стоять после предлога.'],
  ['Инверсия: Not until', 'When did you find out the results?', 'Not until {Friday|did|the office|post|the scores}.', 'had', 'После Not until … идёт инверсия: did the office post. Had не образует вопросительную структуру с post.'],
  ['Only if', 'Can I submit my essay late?', 'Yes, but only {if|you|tell|me|beforehand}.', 'unless', 'Only if — только при условии, что. Unless означает «если не» и меняет смысл.'],
  ['Предлог + which', 'Which tool did you use?', 'This is {the program|with which|I|analyzed|the data}.', 'which with', 'Предлог стоит перед which: with which. Which with — неправильный порядок.'],
  ['Придаточное с whether', 'What is the main concern?', 'The question {is|whether|the plan|can work|without more money}.', 'that', 'Whether вводит придаточное с альтернативой: whether the plan can work. That здесь меняет смысл и конструкцию.'],
  ['Инверсия вместо if', 'Would the experiment have succeeded?', 'Had {they|used|better equipment}, it {would have|succeeded}.', 'should', 'Had they used = if they had used. В главной части would have succeeded. Should не подходит.'],
  ['The more … the better', 'How can I improve faster?', 'The more {you|read}, the {better|you write}.', 'most', 'Двойное сравнение: the more you read, the better you write. Most не образует такую конструкцию.'],
  ['Сокращённое причастие', 'Which proposal did the board approve?', 'It approved {the proposal|submitted|by|the engineering team}.', 'submitting', 'Пассивное причастие: the proposal submitted by. Submitting имело бы активное значение.']
];

const out = [];
const chunkify = (tpl) => {
  const parts = []; const slots = [];
  const segs = tpl.split(/(\{[^}]*\})/).filter(s => s !== '');
  for (const s of segs) {
    if (s.startsWith('{')) { for (const c of s.slice(1, -1).split('|')) { parts.push(null); slots.push(c); } }
    else { const t = s.trim(); if (t) parts.push(t); }
  }
  return { parts, slots };
};
const sent = (parts, slots) => { let i = 0; return parts.map(p => p === null ? slots[i++] : p).join(' ').replace(/\s+([.?!,])/g, '$1'); };

const existing = JSON.parse(readFileSync(new URL('../writing/bas.json', import.meta.url)));
if (existing.some(x => x.id === 'W-BAS-A-021')) { console.error('already applied'); process.exit(1); }
for (const [lvl, list] of [['A', A], ['B', B], ['C', C]]) {
  list.forEach(([focus, a, tpl, extra, ex], i) => {
    const { parts, slots } = chunkify(tpl);
    const id = `W-BAS-${lvl}-${String(21 + i).padStart(3, '0')}`;
    out.push({ id, level: lvl, focus, a, parts, slots, extra, ex });
    console.log(id, '|', a, '→', sent(parts, slots), '| extra:', extra);
  });
}
writeFileSync(new URL('../writing/bas.json', import.meta.url), JSON.stringify(existing.concat(out), null, 1));
console.log('total', existing.length + out.length);

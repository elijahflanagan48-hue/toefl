// Prototype data. Replaced by API calls in stage P2; shapes here are the contract the views expect.

export const me = {
  name: 'Аня', full: 'Анна Соколова', teacher: 'Илья', target: 5, examDate: '2026-12-12', examLabel: '12 дек',
  forecast: { R: 4.5, L: null, W: 4.0, S: 3.5 },
  streak: 5, weekMin: 62,
  week: [ // minutes per section per day
    ['Пн', { R: 8, W: 10 }], ['Вт', { S: 6 }], ['Ср', { R: 12, S: 5, W: 10 }], ['Чт', { S: 5 }],
    ['Пт', { R: 6 }, 'today'], ['Сб', null], ['Вс', null]
  ],
  plan: [
    { k: 'R', nm: 'Complete the Words', mt: 'Reading · 2 текста', min: 6, done: true, to: '#/train/R' },
    { k: 'W', nm: 'Academic Discussion', mt: 'Writing · 10 минут, как на экзамене', min: 10, to: '#/train/W' },
    { k: 'S', nm: 'Take an Interview', mt: 'Speaking · 4 вопроса', min: 5, to: '#/train/S' }
  ],
  tasks: [
    { nm: 'Пробник Reading', mt: 'от учителя · экзаменационный режим', due: 'до пт, 6 ноя', to: '#/exam/reading' },
    { nm: 'Build a Sentence × 20', mt: 'от учителя · учебный режим', due: 'до вс, 8 ноя', to: '#/train/W' }
  ]
};

// Task types per section (names exactly as ETS, guide §2; CEFR ranges from Blueprint §3.3).
export const catalog = {
  R: {
    blurb: 'Адаптивная секция: первый модуль решает, будет второй лёгким или трудным.',
    tasks: [
      { id: 'ctw', nm: 'Complete the Words', ru: 'Допиши буквы в академическом абзаце', cefr: 'B1–C1', acc: 74, done: 18, n: 64, time: '3 мин на абзац' },
      { id: 'rdl', nm: 'Read in Daily Life', ru: 'Объявления, чаты, расписания, формы', cefr: 'A1–C1', acc: 86, done: 22, n: 80, time: '1–2 мин на текст' },
      { id: 'rap', nm: 'Read an Academic Passage', ru: 'Текст ≈200 слов и 5 вопросов', cefr: 'B1–C2', acc: 63, done: 9, n: 52, time: '≈5 мин на текст' }
    ],
    types: [
      ['Factual', 81], ['Negative Factual', 70], ['Vocabulary', 77], ['Select the Sentence', 66],
      ['Sentence Simplification', 58], ['Reference', 72], ['Inference', 54], ['Rhetorical Purpose', 49], ['Insert Text', 61]
    ]
  },
  L: {
    blurb: 'Задания откроются, когда будет готова озвучка. Скрипты уже пишутся.',
    soon: true,
    tasks: [
      { id: 'lcr', nm: 'Listen and Choose a Response', ru: 'Одна реплика — выбери уместную реакцию', cefr: 'A1–B2', scripts: 40 },
      { id: 'lco', nm: 'Listen to a Conversation', ru: 'Диалог двух студентов, 2 вопроса', cefr: 'A2–C1', scripts: 18 },
      { id: 'lan', nm: 'Listen to an Announcement', ru: 'Объявление в кампусе, 2 вопроса', cefr: 'A2–C1', scripts: 12 },
      { id: 'lat', nm: 'Listen to an Academic Talk', ru: 'Мини-лекция 100–250 слов, 4 вопроса', cefr: 'A2–C2', scripts: 8 }
    ],
    types: [['Main Idea'], ['Factual'], ['Inference'], ['Purpose'], ['Method'], ['Attitude']]
  },
  W: {
    blurb: 'Линейная секция: у каждого задания свой таймер. Тексты проверяет учитель.',
    tasks: [
      { id: 'bas', nm: 'Build a Sentence', ru: 'Собери ответ из слов и фраз', cefr: 'A1–C2', acc: 68, done: 40, n: 60, time: '≈35 с на предложение' },
      { id: 'eml', nm: 'Write an Email', ru: 'Письмо по ситуации, 3 пункта', cefr: 'B1–C2', score: 3.5, done: 4, n: 20, time: '7 мин' },
      { id: 'dsc', nm: 'Write for an Academic Discussion', ru: 'Мнение на форуме, от 100 слов', cefr: 'B1–C2', score: 4, done: 3, n: 20, time: '10 мин' }
    ]
  },
  S: {
    blurb: 'Без подготовки, ответ записывается сразу. Записи слушает учитель.',
    tasks: [
      { id: 'lrp', nm: 'Listen and Repeat', ru: '7 предложений по сценарию, 8–12 с', cefr: 'A1–C2', score: 3.5, done: 3, n: 12, time: '≈2 мин', tts: true },
      { id: 'int', nm: 'Take an Interview', ru: '4 вопроса исследователя, по 45 с', cefr: 'A1–C2', score: 3.5, done: 2, n: 15, time: '≈4 мин', tts: true }
    ]
  }
};

export const mocks = [
  { date: '2 окт', kind: 'Диагностика', R: 3.5, L: null, W: 3.5, S: 3, route: 'lower' },
  { date: '12 окт', kind: 'Пробник R+W+S', R: 4, L: null, W: 3.5, S: 3.5, route: 'upper' },
  { date: '19 окт', kind: 'Только Reading', R: 4, L: null, W: null, S: null, route: 'upper' },
  { date: '26 окт', kind: 'Пробник R+W+S', R: 4.5, L: null, W: 4, S: 3.5, route: 'upper' }
];

export const works = [
  { k: 'W', nm: 'Write an Email', mt: 'Просьба перенести консультацию', when: 'вчера', status: 'review' },
  { k: 'S', nm: 'Take an Interview', mt: 'Исследование: городская жизнь', when: '28 окт', score: 3.5 },
  { k: 'W', nm: 'Academic Discussion', mt: 'Онлайн-курсы или аудитория', when: '26 окт', score: 4 },
  { k: 'S', nm: 'Listen and Repeat', mt: 'Экскурсия по научному музею', when: '24 окт', score: 3.5 }
];

/* ---------------- teacher ---------------- */
export const teacher = { name: 'Илья', code: 'NT-4K7Q' };

export const students = [
  { id: 1, name: 'Анна Соколова', group: 'TOEFL · осень', R: 4.5, L: null, W: 4, S: 3.5, target: 5, exam: '12 дек', last: 'сегодня', streak: 5 },
  { id: 2, name: 'Дмитрий Лебедев', group: 'TOEFL · осень', R: 5, L: null, W: 4.5, S: 4.5, target: 5.5, exam: '30 ноя', last: 'вчера', streak: 12 },
  { id: 3, name: 'Мария Ким', group: 'TOEFL · осень', R: 3.5, L: null, W: 3, S: 3.5, target: 4.5, exam: '20 янв', last: '4 дня назад', streak: 0, overdue: 1 },
  { id: 4, name: 'Артём Волков', group: 'Индивидуально', R: 4, L: null, W: 4, S: 4.5, target: 5, exam: '15 дек', last: 'сегодня', streak: 3 },
  { id: 5, name: 'Елена Орлова', group: 'Индивидуально', R: 2.5, L: null, W: 3, S: 3, target: 4, exam: 'не назначен', last: '2 дня назад', streak: 1 }
];

export const queue = [
  { id: 1, student: 'Анна Соколова', k: 'W', task: 'Write an Email', title: 'Просьба перенести консультацию', when: '2 ч назад', words: 142 },
  { id: 2, student: 'Артём Волков', k: 'S', task: 'Take an Interview', title: 'Исследование: городская жизнь · 4 ответа', when: '5 ч назад', dur: '2:58' },
  { id: 3, student: 'Дмитрий Лебедев', k: 'W', task: 'Academic Discussion', title: 'Should cities ban cars from downtown?', when: 'вчера', words: 168 },
  { id: 4, student: 'Мария Ким', k: 'S', task: 'Listen and Repeat', title: 'Встреча посетителей зоопарка · 7 ответов', when: 'вчера', dur: '1:12' },
  { id: 5, student: 'Елена Орлова', k: 'W', task: 'Write an Email', title: 'Жалоба на шум в общежитии', when: '2 дня назад', words: 96, late: true }
];

export const emailWork = {
  prompt: {
    to: 'Dr. Patel', subject: 'Office hours',
    situation: 'You signed up for a meeting during your professor\'s office hours on Thursday to discuss your research paper. However, you now have a conflict at that time.',
    bullets: ['Explain why you cannot attend', 'Describe what you would like to discuss', 'Suggest another time to meet']
  },
  text: `Dear Dr. Patel,

I hope you are doing well. I am writing because I signed up for your office hours on Thursday at 2 pm, but unfortunately I can't come at that time. My biology lab was moved to Thursday afternoon this week and attendance is required.

I wanted to discuss the outline of my research paper about urban gardens. In particular, I am not sure if my sources are enough academic and whether my research question is too broad for ten pages.

Would it be possible to meet on Friday morning or on Monday after 3 pm? If neither works for you, I can also join a short video call at any time that is convenient for you.

Thank you for understanding.

Best regards,
Anna Sokolova`
};

export const bank = [
  { k: 'R', nm: 'Complete the Words', total: 64, lv: [20, 28, 16], cal: 41, flags: 2 },
  { k: 'R', nm: 'Read in Daily Life', total: 80, lv: [26, 30, 24], cal: 55, flags: 0 },
  { k: 'R', nm: 'Read an Academic Passage', total: 52, lv: [14, 22, 16], cal: 30, flags: 3 },
  { k: 'W', nm: 'Build a Sentence', total: 60, lv: [20, 20, 20], cal: 48, flags: 1 },
  { k: 'W', nm: 'Write an Email', total: 20, lv: [6, 8, 6], cal: null, flags: 0 },
  { k: 'W', nm: 'Write for an Academic Discussion', total: 20, lv: [6, 8, 6], cal: null, flags: 0 },
  { k: 'S', nm: 'Listen and Repeat', total: 12, lv: [4, 4, 4], cal: null, flags: 0 },
  { k: 'S', nm: 'Take an Interview', total: 15, lv: [5, 5, 5], cal: null, flags: 0 },
  { k: 'L', nm: 'Listening · скрипты', total: 78, lv: [26, 28, 24], cal: null, flags: 0, soon: true }
];

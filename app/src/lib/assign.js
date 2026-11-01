// Assignments: what a teacher can assign, and where the student is sent to do it.
export const ASSIGN_TASKS = [
  { v: 'R:ctw', section: 'R', task: 'ctw', nm: 'Reading · Complete the Words' },
  { v: 'R:rdl', section: 'R', task: 'rdl', nm: 'Reading · Read in Daily Life' },
  { v: 'R:rap', section: 'R', task: 'rap', nm: 'Reading · Read an Academic Passage' },
  { v: 'R:', section: 'R', task: '', nm: 'Reading · смешанная тренировка' },
  { v: 'R:module', section: 'R', task: 'module', nm: 'Reading · модуль в экзаменационной оболочке' },
  { v: 'L:lcr', section: 'L', task: 'lcr', nm: 'Listening · Choose a Response' },
  { v: 'L:lco', section: 'L', task: 'lco', nm: 'Listening · Conversation' },
  { v: 'L:lan', section: 'L', task: 'lan', nm: 'Listening · Announcement' },
  { v: 'L:lat', section: 'L', task: 'lat', nm: 'Listening · Academic Talk' },
  { v: 'W:bas', section: 'W', task: 'bas', nm: 'Writing · Build a Sentence' },
  { v: 'W:eml', section: 'W', task: 'eml', nm: 'Writing · Write an Email' },
  { v: 'W:dsc', section: 'W', task: 'dsc', nm: 'Writing · Academic Discussion' },
  { v: 'S:lrp', section: 'S', task: 'lrp', nm: 'Speaking · Listen and Repeat' },
  { v: 'S:int', section: 'S', task: 'int', nm: 'Speaking · Take an Interview' }
];
export const MODE_NAMES = { learn: 'учебный режим', timed: 'на время / как на экзамене' };

/** hash route for an assignment spec; `a` is stored with the attempt / submission so the teacher sees completion */
export function assignLink(spec = {}, id) {
  const a = id ? `&a=${id}` : '';
  const mode = spec.mode === 'timed' ? 'timed' : 'learn';
  const { section = 'R', task } = spec;
  if (section === 'R' && task === 'module') return `#/exam/reading?${id ? 'a=' + id : ''}`;
  if (section === 'S' && (task === 'lrp' || task === 'int')) return `#/speak/${task}?mode=${mode}${a}`;
  if (section === 'W' && (task === 'eml' || task === 'dsc')) return `#/write/${task}?mode=${mode}${a}`;
  if (section === 'L' && task) return `#/listen/${task}?mode=${mode}${a}`;
  if (task) return `#/practice/${task}?mode=${mode}${a}`;
  return `#/train/${section}`;
}

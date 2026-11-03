// Assignments: what a teacher can assign, and where the student is sent to do it.
import { plural } from './util.js';
export const ASSIGN_TASKS = [
  { v: 'R:ctw', core: true, section: 'R', task: 'ctw', nm: 'Reading · Complete the Words' },
  { v: 'R:rdl', core: true, section: 'R', task: 'rdl', nm: 'Reading · Read in Daily Life' },
  { v: 'R:rap', core: true, section: 'R', task: 'rap', nm: 'Reading · Read an Academic Passage' },
  { v: 'R:', section: 'R', task: '', nm: 'Reading · смешанная тренировка' },
  { v: 'R:module', section: 'R', task: 'module', nm: 'Reading · модуль в экзаменационной оболочке' },
  { v: 'L:lcr', core: true, section: 'L', task: 'lcr', nm: 'Listening · Choose a Response' },
  { v: 'L:lco', core: true, section: 'L', task: 'lco', nm: 'Listening · Conversation' },
  { v: 'L:lan', core: true, section: 'L', task: 'lan', nm: 'Listening · Announcement' },
  { v: 'L:lat', core: true, section: 'L', task: 'lat', nm: 'Listening · Academic Talk' },
  { v: 'W:bas', core: true, section: 'W', task: 'bas', nm: 'Writing · Build a Sentence' },
  { v: 'W:eml', core: true, section: 'W', task: 'eml', nm: 'Writing · Write an Email' },
  { v: 'W:dsc', core: true, section: 'W', task: 'dsc', nm: 'Writing · Academic Discussion' },
  { v: 'S:lrp', core: true, section: 'S', task: 'lrp', nm: 'Speaking · Listen and Repeat' },
  { v: 'S:int', core: true, section: 'S', task: 'int', nm: 'Speaking · Take an Interview' },
  { v: 'M:T1', section: 'M', task: 'T1', nm: 'Полный пробник 1', mock: true },
  { v: 'M:T2', section: 'M', task: 'T2', nm: 'Полный пробник 2', mock: true },
  { v: 'M:T3', section: 'M', task: 'T3', nm: 'Полный пробник 3', mock: true }
];
export const SECTION_NAMES = { R: 'Reading', L: 'Listening', W: 'Writing', S: 'Speaking', M: 'Полные пробники' };
export const MODE_NAMES = { learn: 'учебный режим', timed: 'на время / как на экзамене' };

/** hash route for an assignment spec; `a` is stored with the attempt / submission so the teacher sees completion */
export function assignLink(spec = {}, id) {
  const a = id ? `&a=${id}` : '';
  const mode = spec.mode === 'timed' ? 'timed' : 'learn';
  const { section = 'R', task } = spec;
  if (section === 'M') return `#/mock?${id ? 'a=' + id : ''}`;
  if (section === 'R' && task === 'module') return `#/exam/reading?${id ? 'a=' + id : ''}`;
  if (section === 'S' && (task === 'lrp' || task === 'int')) return `#/speak/${task}?mode=${mode}${a}`;
  if (section === 'W' && (task === 'eml' || task === 'dsc')) return `#/write/${task}?mode=${mode}${a}`;
  if (section === 'L' && task) return `#/listen/${task}?mode=${mode}${a}`;
  if (task) return `#/practice/${task}?mode=${mode}${a}`;
  return `#/train/${section}`;
}


/** selected task values (e.g. ['R:ctw','R:rdl']) → payload items + a label for the whole set.
 *  The label is «Весь Reading» when exactly every task type of one section is chosen, else «Набор: N заданий». */
export function buildAssignments(values, mode) {
  const chosen = ASSIGN_TASKS.filter(t => values.includes(t.v));
  const items = chosen.map(t => ({ title: t.nm.replace(' · ', ': '), spec: { section: t.section, task: t.task || undefined, mode } }));
  let setLabel = `Набор: ${chosen.length} ${plural(chosen.length, 'задание', 'задания', 'заданий')}`;
  for (const sec of 'RLWS') {
    const core = ASSIGN_TASKS.filter(t => t.section === sec && t.core);
    if (chosen.length === core.length && core.every(t => chosen.includes(t))) setLabel = `Весь ${SECTION_NAMES[sec]}`;
  }
  return { items, setLabel };
}

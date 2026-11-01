// Full mock test runner: Reading (M1 → M2 by score) → Listening (M1 → M2) → Writing → Speaking, one continuous run.
import * as src from '../data/source.js';
import { getFlow, putFlow } from './mockstate.js';
import { toast } from './ui.js';

export const SECTION_NAME = { R: 'Reading', L: 'Listening', W: 'Writing', S: 'Speaking' };
export const MIN = { R: 29, L: 27, W: 23, S: 8 };

/** the nine steps, with the second modules resolved from the routes decided so far */
export const stepsOf = f => [
  { part: 'R:M1', sec: 'R' }, { part: 'R:' + (f.route?.R || 'lower'), sec: 'R' },
  { part: 'L:M1', sec: 'L' }, { part: 'L:' + (f.route?.L || 'lower'), sec: 'L' },
  { part: 'W:bas', sec: 'W' }, { part: 'W:eml', sec: 'W' }, { part: 'W:dsc', sec: 'W' },
  { part: 'S:lrp', sec: 'S' }, { part: 'S:int', sec: 'S' }
];

export function urlOf(f, i) {
  const { part } = stepsOf(f)[i];
  if (part[0] === 'R' || part === 'W:bas') return `#/practice/mock?mock=1&part=${part}`;
  if (part[0] === 'L') return `#/listen/mock?mock=1&part=${part}`;
  if (part[0] === 'W') return `#/write/${part.slice(2)}?mock=1&mode=timed`;
  return `#/speak/${part.slice(2)}?mock=1&mode=timed`;
}

export async function begin(mockId, assignmentId) {
  const a = await src.startAttempt({ kind: 'mock', mode: 'exam', task: mockId, assignment_id: assignmentId });
  if (!a?.id) throw new Error('Пробник доступен только в аккаунте');
  const f = { mock: mockId, attempt: a.id, at: 0, route: {}, t0: Date.now() };
  putFlow(f);
  location.hash = urlOf(f, 0);
}

/** called by a player when its part is finished; moves on to the next part or to the result */
export async function advance(routeUpdate) {
  const f = getFlow();
  if (!f) { location.hash = '#/mock'; return; }
  if (routeUpdate) f.route = { ...f.route, ...routeUpdate };
  const prev = stepsOf(f)[f.at];
  f.at++;
  const steps = stepsOf(f);
  if (f.at >= steps.length) {
    try { await src.finishAttempt(f.attempt); } catch (e) { toast('Не удалось завершить: ' + e.message); }
    putFlow(null);
    location.hash = `#/mock/result/${f.attempt}`;
    return;
  }
  putFlow(f);
  location.hash = steps[f.at].sec === prev.sec ? urlOf(f, f.at) : '#/mock/next';
}

export const quit = () => putFlow(null);
export { getFlow };

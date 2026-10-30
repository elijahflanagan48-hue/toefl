// Raw → 1–6 band. Reading and Listening tables are from the Official Guide practice
// tests (guide §9.1); real forms are equated, so these are approximations for our own forms.
// Writing/Speaking: ETS publishes no table; we use a provisional %-table that mirrors Listening.

const READING = [[34, 6], [32, 5.5], [28, 5], [25, 4.5], [18, 4], [12, 3.5], [8, 3], [7, 2.5], [6, 2], [0, 1]];
const LISTENING = [[34, 6], [32, 5.5], [29, 5], [25, 4.5], [23, 4], [18, 3.5], [13, 3], [11, 2.5], [8, 2], [6, 1.5], [0, 1]];
const PCT = [[.97, 6], [.91, 5.5], [.83, 5], [.71, 4.5], [.66, 4], [.51, 3.5], [.37, 3], [.31, 2.5], [.23, 2], [.17, 1.5], [0, 1]];

/** got/of for R or L, rescaled to the 35-point scale when the form is shorter (practice modules) */
export function bandRL(section, got, of) {
  if (!of) return null;
  const raw = Math.round((got / of) * 35);
  const t = section === 'L' ? LISTENING : READING;
  return t.find(([min]) => raw >= min)[1];
}

/** W: 0–20 raw, S: 0–55 raw */
export function bandWS(raw, max) {
  if (!max) return null;
  const p = raw / max;
  return PCT.find(([min]) => p >= min - 1e-9)[1];
}

/** ETS overall: mean of sections, to nearest .5, with .25/.75 rounding up */
export function overall(bands) {
  const v = bands.filter(x => x != null);
  if (!v.length) return null;
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return Math.floor(m * 2 + 0.5 + 1e-9) / 2;
}

export const cefr = v => v == null ? null : v >= 6 ? 'C2' : v >= 5 ? 'C1' : v >= 4 ? 'B2' : v >= 3 ? 'B1' : v >= 2 ? 'A2' : 'A1';

/** MST routing: share correct among scored module-1 responses vs threshold */
export function route(got, of, threshold) {
  if (!of) return 'lower';
  return got / of >= threshold ? 'upper' : 'lower';
}

/** grade one response against an item key. Supports mcq index, select index, ctw strings, bas token arrays. */
export function grade(task, key, q, answer) {
  if (key == null) return null;
  const k = Array.isArray(key) ? key[q] : key;
  if (k == null) return null;
  if (task === 'ctw') return String(answer ?? '').trim().toLowerCase() === String(k).toLowerCase() ? 1 : 0;
  if (task === 'bas') return JSON.stringify(answer) === JSON.stringify(k) ? 1 : 0;
  return Number(answer) === Number(k) ? 1 : 0;
}

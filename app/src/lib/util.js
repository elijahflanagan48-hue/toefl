export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** 4 → "4,0", 4.5 → "4,5" (Russian decimal comma) */
export const band = v => (v == null ? '—' : Number(v).toFixed(1).replace('.', ','));

/** TOEFL 1–6 band → CEFR (ETS mapping, guide §9.2) */
export const cefr = v => v == null ? '' : v >= 6 ? 'C2' : v >= 5 ? 'C1' : v >= 4 ? 'B2' : v >= 3 ? 'B1' : v >= 2 ? 'A2' : 'A1';

/** ETS overall: mean of sections rounded to nearest .5, with .25/.75 rounding UP (guide §9.2). */
export const overallBand = vals => {
  const v = vals.filter(x => x != null);
  if (!v.length) return null;
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return Math.floor(m * 2 + 0.5 + 1e-9) / 2;
};

export const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
};

export const mmss = s => {
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(x).padStart(2, '0');
};

export const SEC = {
  R: { k: 'R', name: 'Reading', ic: 'book' },
  L: { k: 'L', name: 'Listening', ic: 'head' },
  W: { k: 'W', name: 'Writing', ic: 'pen' },
  S: { k: 'S', name: 'Speaking', ic: 'mic' }
};

/** score → heat level for teacher tables */
export const heat = (v, target = 5) => v == null ? 'na' : v >= target ? 'l4' : v >= target - 1 ? 'l3' : v >= target - 1.5 ? 'l2' : 'l1';

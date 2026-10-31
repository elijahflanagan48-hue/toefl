// Elijah's Academic Passage → content format with keys/types/explanations from rap-ex-*.json.
// SRC=<dir> node content/import/convert-rap.mjs <out.json>
import { writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { parseAll } from './audit.mjs';

const R = parseAll();
const here = new URL('.', import.meta.url);
const EX = Object.assign({}, ...readdirSync(here).filter(f => /^rap-ex-\d\.json$/.test(f)).map(f => JSON.parse(readFileSync(new URL(f, here)))));
const TOPIC = { A1: 'Life sciences', A2: 'Physical sciences', A3: 'Art and music', A4: 'Social sciences', A5: 'Life sciences', A6: 'Business and economics', A7: 'Physical sciences', A8: 'History', A9: 'Life sciences', A10: 'Social sciences', A11: 'Physical sciences', A12: 'History', A13: 'Life sciences', A14: 'Business and economics', A15: 'Physical sciences', A16: 'Art and music', A17: 'Social sciences', A18: 'Life sciences', A19: 'Physical sciences', A20: 'History', B1: 'Life sciences', B2: 'Physical sciences', B3: 'Social sciences', B4: 'Physical sciences', B5: 'Business and economics', B6: 'History', B7: 'Social sciences', B8: 'Physical sciences', B9: 'Life sciences', B10: 'Art and music', B11: 'Life sciences', B12: 'History', B13: 'Physical sciences', B14: 'History', B15: 'Business and economics', B16: 'Physical sciences', B17: 'Life sciences', B18: 'Life sciences', B19: 'History', B20: 'Business and economics' };
const sentences = p => p.match(/[^.!?]+[.!?]+(?:["”’)]+)?(?=\s+|$)/g).map(s => s.trim());
const errs = [];
const out = R.rap.map(t => {
  const key = t.type + t.n, ex = EX[key];
  if (!ex || ex.length !== 5) { errs.push(key + ': explanations'); return null; }
  const paras = t.paras.map(sentences);
  const qs = t.qs.map((q, k) => {
    const [L, ...rest] = ex[k].split('|');
    const type = rest.length > 1 ? rest[0] : /closest in meaning/.test(q.stem) ? 'Vocabulary' : /^Why (does|do|is|are) |^Why compare|^Why mention|^Why discuss|^Why distinguish/i.test(q.stem) ? 'Rhetorical Purpose' : /mainly|main (idea|topic)|central idea|passage explain/i.test(q.stem) ? 'Factual' : /infer|conclude|suggest/i.test(q.stem) ? 'Inference' : 'Factual';
    const o = { type, stem: q.stem, opts: q.opts, a: 'ABCD'.indexOf(L), ex: rest[rest.length - 1] };
    if (type === 'Vocabulary') {
      const w = q.stem.match(/"([^"]+)"/)[1];
      let hit = null;
      paras.forEach((ss, p) => ss.forEach((s, si) => { const m = !hit && s.match(new RegExp(`\\b${w}\\b`, "i")); if (m) hit = { p, s: si, w: m[0] }; }));
      if (!hit) errs.push(`${key} q${k + 1}: "${w}" not found`); else { o.hl = hit; o.stem = q.stem.replace('in the passage', '').replace(`"${w}" is`, `"${w}" in the passage is`); }
    }
    if (o.a < 0) errs.push(`${key} q${k + 1}: key`);
    return o;
  });
  return { id: `R-RAP-${t.type}-${100 + t.n}`, level: t.type, src: 'elijah', topic: TOPIC[key], title: t.title, paras, qs };
}).filter(Boolean);
if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
const pos = [0, 1, 2, 3].map(k => out.flatMap(i => i.qs).filter(q => q.a === k).length);
console.log(out.length, 'passages; answer positions A–D', pos.join('/'));
const tc = {}; out.flatMap(i => i.qs).forEach(q => tc[q.type] = (tc[q.type] || 0) + 1); console.log(tc);

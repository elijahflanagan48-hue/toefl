// One-off generator for content/mocks/mocks.json (reviewed and edited by hand afterwards; build.mjs only validates it).
// Usage: node content/mocks/make.mjs  — overwrites mocks.json
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = p => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
let seed = 20261101;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const used = new Set();
const take = (pool, n, pred = () => true, score = () => 0) => {
  const c = shuffle(pool.filter(x => !used.has(x.id) && pred(x))).sort((a, b) => score(b) - score(a)).slice(0, n);
  if (c.length < n) throw new Error('not enough items');
  c.forEach(x => used.add(x.id));
  return c;
};
const ctw = read('content/reading/ctw.json'), rdl = read('content/reading/rdl.json'), rap = read('content/reading/rap.json');
const bas = read('content/writing/bas.json'), eml = read('content/writing/email.json'), dsc = read('content/writing/discussion.json');
const lrp = read('content/speaking/lrp.json'), intr = read('content/speaking/int.json');
const RARE = ['Insert Text', 'Select the Sentence', 'Reference', 'Negative Factual', 'Sentence Simplification', 'Rhetorical Purpose'];
const rareScore = x => new Set((x.qs || []).map(q => q.type).filter(t => RARE.includes(t))).size;

// Listening: ids from modules.json (short name → full id)
const L = read('content/listening/items.json'), mods = read('content/listening/modules.json').tests;
const byShort = Object.fromEntries(L.map(i => [i.short, i.id]));
const lis = t => ({ M1: mods[t].M1.items.map(i => byShort[i.id]), lower: mods[t]['M2-lower'].items.map(i => byShort[i.id]), upper: mods[t]['M2-upper'].items.map(i => byShort[i.id]) });

const out = {};
// speaking: B-level scenarios, one per test (the rest stay in practice)
const spk = { T1: ['S-LRP-B-005', 'S-INT-B-006'], T2: ['S-LRP-B-006', 'S-INT-B-007'], T3: ['S-LRP-B-007', 'S-INT-B-008'] };
const emlLv = { T1: 'B', T2: 'B', T3: 'C' }, dscLv = { T1: 'B', T2: 'C', T3: 'B' };
for (const t of ['T1', 'T2', 'T3']) {
  const r = {
    M1: [...take(ctw, 1, x => x.level === 'A'), ...take(ctw, 1, x => x.level === 'B'),
      ...take(rdl, 1, x => x.level === 'A' && x.qs.length === 2), ...take(rdl, 1, x => x.level === 'B' && x.qs.length === 3),
      ...take(rap, 1, x => x.level === 'B', rareScore), ...take(rap, 1, x => x.level === 'B', rareScore)],
    lower: [...take(ctw, 1, x => x.level === 'A'), ...take(rap, 1, x => x.level === 'A', rareScore)],
    upper: [...take(ctw, 1, x => x.level === 'C'), ...take(rap, 1, x => x.level === 'C', rareScore)]
  };
  const lv = ['A', 'A', 'A', 'B', 'B', 'B', 'B', 'C', 'C', 'C'];
  const w = {
    bas: shuffle(lv).map(l => take(bas, 1, x => x.level === l)[0].id),
    eml: take(eml, 1, x => x.level === emlLv[t])[0].id,
    dsc: take(dsc, 1, x => x.level === dscLv[t])[0].id
  };
  out[t] = {
    title: 'Пробник ' + t.slice(1),
    R: Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.map(x => x.id)])),
    L: lis(t), W: w, S: { lrp: spk[t][0], int: spk[t][1] }
  };
}
writeFileSync(join(ROOT, 'content/mocks/mocks.json'), JSON.stringify(out, null, 1) + '\n');
console.log('mocks.json written;', Object.keys(out).map(t => `${t}: R ${Object.values(out[t].R).flat().length}, L ${Object.values(out[t].L).flat().length}`).join(' | '));

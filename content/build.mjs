// Content pipeline: validate content/*.json → api/seed/*.sql (upserts for D1) + app demo subset.
// Run: node content/build.mjs   (CI runs it before seeding; exits 1 on any validation error)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeCtw } from '../app/src/lib/ctw.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const words = s => (s.match(/[A-Za-z0-9’'-]+/g) || []).length;
const errors = [], warns = [];
const err = (id, m) => errors.push(`${id}: ${m}`);
const warn = (id, m) => warns.push(`${id}: ${m}`);

const QTYPES = ['Factual', 'Negative Factual', 'Vocabulary', 'Select the Sentence', 'Sentence Simplification', 'Reference', 'Inference', 'Rhetorical Purpose', 'Insert Text'];
const B = { A: -1, B: 0, C: 1 };
const items = [];
const ids = new Set();
const checkId = (it, task) => {
  const re = new RegExp(`^R-${task.toUpperCase()}-[ABC]-\\d{3}$`);
  if (!re.test(it.id)) err(it.id, 'id format R-TASK-L-NNN');
  if (ids.has(it.id)) err(it.id, 'duplicate id');
  ids.add(it.id);
  if (!['A', 'B', 'C'].includes(it.level)) err(it.id, 'level');
  if (it.id.split('-')[2] !== it.level) err(it.id, 'level in id differs from level field');
};

function checkMcq(it, q, i) {
  const tag = `${it.id} q${i + 1}`;
  if (!QTYPES.includes(q.type)) err(tag, 'unknown type ' + q.type);
  if (!q.stem || q.stem.length < 8) err(tag, 'stem');
  if (!q.ex || q.ex.length < 20) err(tag, 'Russian explanation missing/short');
  if (q.sel) { if (!Number.isInteger(q.a) || q.a < 0 || q.a >= it.paras[q.sel.p].length) err(tag, 'select answer out of range'); return; }
  if (q.insert) { if (!it.insert || q.a < 0 || q.a >= it.insert.slots.length) err(tag, 'insert answer'); return; }
  if (!Array.isArray(q.opts) || q.opts.length !== 4) err(tag, 'needs exactly 4 options');
  else if (new Set(q.opts).size !== 4) err(tag, 'duplicate options');
  if (!Number.isInteger(q.a) || q.a < 0 || q.a > 3) err(tag, 'answer index');
  if (q.hl) {
    const s = it.paras?.[q.hl.p]?.[q.hl.s];
    if (!s) err(tag, 'hl sentence missing');
    else if (!new RegExp(`\\b${q.hl.w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(s)) err(tag, `hl word "${q.hl.w}" not in sentence`);
  }
  if (q.simp && !it.paras?.[q.simp.p]?.[q.simp.s]) err(tag, 'simplification sentence missing');
}

/* ---------- Complete the Words ---------- */
for (const it of read('content/reading/ctw.json')) {
  checkId(it, 'ctw');
  const n = words(it.text);
  if (n < 70 || n > 100) err(it.id, `CtW length ${n} words (ETS: 70–100)`);
  let c;
  try { c = makeCtw(it.text, 10); } catch (e) { err(it.id, e.message); continue; }
  const gaps = c.parts.filter(p => p.miss);
  const fn = gaps.filter(p => p.keep.length + p.miss.length <= 4).length;
  if (fn < 2) warn(it.id, `only ${fn} short/function-word gaps`);
  items.push({
    id: it.id, section: 'R', task: 'ctw', level: it.level, b: B[it.level],
    body: { topic: it.topic, first: c.first, parts: c.parts.map(p => p.miss ? { pre: p.pre, keep: p.keep, n: p.miss.length, post: p.post } : { t: p.t }) },
    key: gaps.map(p => p.miss),
    explain: gaps.map(p => `Полное слово: ${p.keep}${p.miss}`),
    qtypes: gaps.map(() => 'Complete the Words')
  });
}

/* ---------- Read in Daily Life ---------- */
const docText = d => [d.head, d.subject, ...(d.paras || []), ...(d.msgs || []).map(m => m.text), ...(d.rows || []).flat(), d.foot].filter(Boolean).join(' ');
for (const it of read('content/reading/rdl.json')) {
  checkId(it, 'rdl');
  const n = words(docText(it.doc));
  if (n < 15 || n > 150) err(it.id, `Daily Life length ${n} words (ETS: 15–150)`);
  if (it.qs.length !== 2 && it.qs.length !== 3) err(it.id, '2 or 3 questions');
  if (it.qs.length === 3 && n < 40) warn(it.id, '3 questions on a very short text');
  it.qs.forEach((q, i) => {
    checkMcq(it, q, i);
    if (q.hlw && !docText(it.doc).includes(q.hlw)) err(`${it.id} q${i + 1}`, `hlw "${q.hlw}" not in text`);
  });
  items.push({
    id: it.id, section: 'R', task: 'rdl', level: it.level, b: B[it.level],
    body: { genre: it.genre, doc: it.doc, qs: it.qs.map(q => ({ type: q.type, stem: q.stem, opts: q.opts, hlw: q.hlw })) },
    key: it.qs.map(q => q.a), explain: it.qs.map(q => q.ex), qtypes: it.qs.map(q => q.type)
  });
}

/* ---------- Read an Academic Passage ---------- */
for (const it of read('content/reading/rap.json')) {
  checkId(it, 'rap');
  const n = words(it.paras.flat().join(' '));
  if (n < 170 || n > 240) err(it.id, `passage length ${n} words (ETS: ≈200)`);
  if (it.paras.length < 1 || it.paras.length > 3) err(it.id, '1–3 paragraphs');
  if (it.qs.length !== 5) err(it.id, '5 questions');
  if (it.insert) {
    const p = it.paras[it.insert.p];
    if (!p || it.insert.slots.length !== 4 || it.insert.slots.some(s => s < 0 || s > p.length)) err(it.id, 'insert slots');
  }
  it.qs.forEach((q, i) => checkMcq(it, q, i));
  items.push({
    id: it.id, section: 'R', task: 'rap', level: it.level, b: B[it.level],
    body: { topic: it.topic, title: it.title, paras: it.paras, insert: it.insert, qs: it.qs.map(q => ({ type: q.type, stem: q.stem, opts: q.opts, hl: q.hl, sel: q.sel, simp: q.simp, insert: q.insert })) },
    key: it.qs.map(q => q.a), explain: it.qs.map(q => q.ex), qtypes: it.qs.map(q => q.type)
  });
}

/* ---------- bank-level checks ---------- */
const mcq = items.filter(i => i.task !== 'ctw').flatMap(i => i.body.qs.map((q, k) => (q.opts ? i.key[k] : null))).filter(x => x != null);
const dist = [0, 1, 2, 3].map(k => mcq.filter(x => x === k).length);
if (Math.max(...dist) > mcq.length * 0.4) warn('bank', `answer positions unbalanced: A–D = ${dist.join('/')}`);
const typeCount = Object.fromEntries(QTYPES.map(t => [t, items.flatMap(i => i.qtypes).filter(x => x === t).length]));
for (const [t, c] of Object.entries(typeCount)) if (c < 2) warn('bank', `only ${c} × ${t}`);

console.log(`items: ${items.length} (ctw ${items.filter(i => i.task === 'ctw').length}, rdl ${items.filter(i => i.task === 'rdl').length}, rap ${items.filter(i => i.task === 'rap').length})`);
console.log('MCQ answer positions A–D:', dist.join('/'));
console.log('question types:', JSON.stringify(typeCount));
warns.forEach(w => console.log('warn:', w));
if (errors.length) { errors.forEach(e => console.error('ERROR:', e)); process.exit(1); }

/* ---------- outputs ---------- */
const q = v => v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;
const now = Date.now();
const sql = ['-- generated by content/build.mjs — do not edit by hand']
  .concat(items.map(i => `INSERT INTO items (id, section, task, level, body, key, explain, qtypes, b, status, created_at, updated_at) VALUES (${q(i.id)}, 'R', ${q(i.task)}, ${q(i.level)}, ${q(JSON.stringify(i.body))}, ${q(JSON.stringify(i.key))}, ${q(JSON.stringify(i.explain))}, ${q(JSON.stringify(i.qtypes))}, ${i.b}, 'active', ${now}, ${now})
  ON CONFLICT(id) DO UPDATE SET task = excluded.task, level = excluded.level, body = excluded.body, key = excluded.key, explain = excluded.explain, qtypes = excluded.qtypes, status = excluded.status, updated_at = excluded.updated_at;`));
mkdirSync(join(ROOT, 'api/seed'), { recursive: true });
writeFileSync(join(ROOT, 'api/seed/reading.sql'), sql.join('\n') + '\n');

// demo mode (no account): one item per task per level so the trainer can be tried without a server
const demo = items.filter(i => /-00[1]$/.test(i.id));
writeFileSync(join(ROOT, 'app/src/data/demo-reading.json'), JSON.stringify(demo));
console.log(`wrote api/seed/reading.sql (${items.length}) and app/src/data/demo-reading.json (${demo.length})`);

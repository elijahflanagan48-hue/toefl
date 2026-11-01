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

/* ---------- Writing · Build a Sentence ---------- */
const basItems = [];
for (const it of read('content/writing/bas.json')) {
  if (!/^W-BAS-[ABC]-\d{3}$/.test(it.id)) err(it.id, 'id format W-BAS-L-NNN');
  if (ids.has(it.id)) err(it.id, 'duplicate id'); ids.add(it.id);
  const nSlots = it.parts.filter(p => p === null).length;
  if (nSlots !== it.slots.length) err(it.id, 'parts/slots mismatch');
  if (nSlots < 3 || nSlots > 7) err(it.id, `slots ${nSlots} (ETS: 3–7)`);
  if (it.extra && it.slots.some(s => s.toLowerCase() === it.extra.toLowerCase())) err(it.id, 'extra equals a slot');
  if (!/[?.!]$/.test(it.a)) err(it.id, 'speaker A line must end with punctuation');
  const last = it.parts[it.parts.length - 1];
  if (typeof last !== 'string' || !/[.?!]$/.test(last)) err(it.id, 'sentence must end with fixed punctuation');
  if (!it.ex || it.ex.length < 20 || !it.focus) err(it.id, 'focus / Russian explanation');
  basItems.push({
    id: it.id, section: 'W', task: 'bas', level: it.level, b: B[it.level],
    body: { a: it.a, parts: it.parts, chunks: [...it.slots, ...(it.extra ? [it.extra] : [])].sort((x, y) => x.localeCompare(y)), focus: it.focus },
    key: [it.slots], explain: [it.ex], qtypes: ['Build a Sentence']
  });
}
/* ---------- Writing · Email and Academic Discussion (teacher-graded, no key) ---------- */
for (const it of read('content/writing/email.json')) {
  if (!/^W-EML-[ABC]-\d{3}$/.test(it.id) || it.id.split('-')[2] !== it.level) err(it.id, 'id/level');
  if (ids.has(it.id)) err(it.id, 'duplicate id'); ids.add(it.id);
  if (!it.to || !it.subject || words(it.situation) < 15 || words(it.situation) > 90) err(it.id, 'to/subject/situation 15–90 words');
  if (!Array.isArray(it.bullets) || it.bullets.length !== 3) err(it.id, 'exactly 3 bullets');
  basItems.push({ id: it.id, section: 'W', task: 'eml', level: it.level, b: B[it.level], body: { to: it.to, subject: it.subject, situation: it.situation, bullets: it.bullets }, key: null, explain: null, qtypes: null });
}
for (const it of read('content/writing/discussion.json')) {
  if (!/^W-DSC-[ABC]-\d{3}$/.test(it.id) || it.id.split('-')[2] !== it.level) err(it.id, 'id/level');
  if (ids.has(it.id)) err(it.id, 'duplicate id'); ids.add(it.id);
  if (!it.professor?.text || !/\?/.test(it.professor.text) || words(it.professor.text) < 30 || words(it.professor.text) > 120) err(it.id, 'professor post 30–120 words with a question');
  if (!Array.isArray(it.students) || it.students.length !== 2 || it.students.some(s => !s.name || words(s.text) < 15 || words(s.text) > 80)) err(it.id, 'two student posts 15–80 words');
  basItems.push({ id: it.id, section: 'W', task: 'dsc', level: it.level, b: B[it.level], body: { course: it.course, professor: it.professor, students: it.students }, key: null, explain: null, qtypes: null });
}
console.log(`email prompts: ${basItems.filter(i => i.task === 'eml').length}, discussion prompts: ${basItems.filter(i => i.task === 'dsc').length}`);
const extras = basItems.filter(i => i.task === 'bas' && i.body.chunks.length > i.key[0].length).length;
console.log(`build a sentence: ${basItems.filter(i => i.task === 'bas').length} (with extra chunk: ${extras})`);


/* ---------- Speaking · Listen and Repeat / Take an Interview (teacher-graded, no key) ---------- */
const syl = w => { w = w.toLowerCase().replace(/[^a-z]/g, ''); if (!w) return 0; if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, ''); const m = w.match(/[aeiouy]{1,2}/g); return Math.max(1, m ? m.length : 1); };
const sylS = s => (s.match(/[A-Za-z']+/g) || []).reduce((n, w) => n + syl(w), 0);
const SYL = [[9, 11], [9, 11], [14, 16], [14, 16], [14, 16], [18, 20], [18, 20]];
const spkItems = [];
for (const it of read('content/speaking/lrp.json')) {
  if (!/^S-LRP-[ABC]-\d{3}$/.test(it.id) || it.id.split('-')[2] !== it.level) err(it.id, 'id/level');
  if (ids.has(it.id)) err(it.id, 'duplicate id'); ids.add(it.id);
  if (!it.title || words(it.scenario) < 12 || words(it.scenario) > 40) err(it.id, 'title / scenario 12–40 words');
  if (!Array.isArray(it.sentences) || it.sentences.length !== 7) { err(it.id, 'exactly 7 sentences'); continue; }
  it.sentences.forEach((s, k) => { const n = sylS(s);
    if (!/[.?]$/.test(s)) err(it.id, `sentence ${k + 1} must end with . or ?`);
    if (n < SYL[k][0] - 1 || n > SYL[k][1] + 1) warn(it.id, `sentence ${k + 1} ≈${n} syllables, target ${SYL[k].join('–')}: ${s}`); });
  spkItems.push({ id: it.id, section: 'S', task: 'lrp', level: it.level, b: B[it.level], body: { title: it.title, scenario: it.scenario, sentences: it.sentences, syl: it.sentences.map(sylS) }, key: null, explain: null, qtypes: null });
}
for (const it of read('content/speaking/int.json')) {
  if (!/^S-INT-[ABC]-\d{3}$/.test(it.id) || it.id.split('-')[2] !== it.level) err(it.id, 'id/level');
  if (ids.has(it.id)) err(it.id, 'duplicate id'); ids.add(it.id);
  if (!it.title || words(it.scenario) < 12 || words(it.scenario) > 40) err(it.id, 'title / scenario 12–40 words');
  if (!Array.isArray(it.questions) || it.questions.length !== 4 || it.questions.some(x => !/[?.]$/.test(x) || words(x) < 6 || words(x) > 40)) err(it.id, '4 questions ending with ? or ., 6–40 words');
  spkItems.push({ id: it.id, section: 'S', task: 'int', level: it.level, b: B[it.level], body: { title: it.title, scenario: it.scenario, questions: it.questions }, key: null, explain: null, qtypes: null });
}
console.log(`speaking: listen and repeat ${spkItems.filter(i => i.task === 'lrp').length}, interview ${spkItems.filter(i => i.task === 'int').length}`);

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
const sqlW = ['-- generated by content/build.mjs — do not edit by hand'].concat(basItems.map(i => `INSERT INTO items (id, section, task, level, body, key, explain, qtypes, b, status, created_at, updated_at) VALUES (${q(i.id)}, 'W', ${q(i.task)}, ${q(i.level)}, ${q(JSON.stringify(i.body))}, ${q(JSON.stringify(i.key))}, ${q(JSON.stringify(i.explain))}, ${q(JSON.stringify(i.qtypes))}, ${i.b}, 'active', ${now}, ${now})
  ON CONFLICT(id) DO UPDATE SET task = excluded.task, level = excluded.level, body = excluded.body, key = excluded.key, explain = excluded.explain, qtypes = excluded.qtypes, status = excluded.status, updated_at = excluded.updated_at;`));
writeFileSync(join(ROOT, 'api/seed/writing.sql'), sqlW.join('\n') + '\n');
const sqlS = ['-- generated by content/build.mjs — do not edit by hand'].concat(spkItems.map(i => `INSERT INTO items (id, section, task, level, body, key, explain, qtypes, b, status, created_at, updated_at) VALUES (${q(i.id)}, 'S', ${q(i.task)}, ${q(i.level)}, ${q(JSON.stringify(i.body))}, NULL, NULL, NULL, ${i.b}, 'active', ${now}, ${now})
  ON CONFLICT(id) DO UPDATE SET task = excluded.task, level = excluded.level, body = excluded.body, status = excluded.status, updated_at = excluded.updated_at;`));
writeFileSync(join(ROOT, 'api/seed/speaking.sql'), sqlS.join('\n') + '\n');

// demo mode (no account): one item per task per level so the trainer can be tried without a server
const demo = spkItems.filter(i => /-(A-001|B-005|B-006)$/.test(i.id)).concat(items.filter(i => /-00[1]$/.test(i.id))).concat(basItems.filter(i => /-00[12]$/.test(i.id) && (i.task === 'bas' || /-B-001$/.test(i.id))));
writeFileSync(join(ROOT, 'app/src/data/demo-reading.json'), JSON.stringify(demo));
console.log(`wrote api/seed/reading.sql (${items.length}) and app/src/data/demo-reading.json (${demo.length})`);

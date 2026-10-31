// Elijah's Read in Daily Life → content format. SRC=<dir> node content/import/convert-rdl.mjs > draft
import { writeFileSync, readFileSync } from 'node:fs';
import { parseAll } from './audit.mjs';

const R = parseAll();
const GENRE = { 'chain of text messages': 'chat', 'social media post': 'social', receipt: 'receipt', invoice: 'receipt', schedule: 'schedule', menu: 'menu', form: 'form', email: 'email', notice: 'notice', flyer: 'notice', 'web announcement': 'web', advertisement: 'ad' };
const row = l => { const m = l.match(/^(.{1,40}?):\s+(.*)$/); if (m) return [m[1].trim(), m[2].trim()]; if (/\d:\d\d/.test(l) && l.includes('/')) return l.split('/').map(x => x.trim()); return null; };

function doc(genre, text) {
  const lines = text.split('\n').map(s => s.trim());
  const blocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  const g = GENRE[genre];
  if (g === 'chat') {
    const msgs = lines.filter(Boolean).map(l => { const m = l.match(/^([^,]+),\s*([^:]+?):\s*(.*)$/); return m ? { who: m[1], time: m[2], text: m[3] } : { who: '?', text: l }; });
    return { kind: 'chat', msgs };
  }
  if (g === 'email') {
    const f = k => (lines.find(l => l.startsWith(k + ':')) || '').slice(k.length + 1).trim();
    const body = lines.filter(l => l && !/^(To|From|Subject):/.test(l));
    return { kind: 'email', from: f('From'), to: f('To'), subject: f('Subject'), paras: body };
  }
  if (g === 'social') {
    const [h, ...rest] = lines.filter(Boolean);
    const [who, handle] = h.split(/\s+-\s+/);
    return { kind: 'post', who, handle: handle || '', paras: rest };
  }
  if (['schedule', 'menu', 'form', 'receipt'].includes(g)) {
    const first = blocks[0].split('\n').map(s => s.trim());
    const head = [], rows = [], extra = [];
    for (const l of first) { if (!rows.length && head.length && / \/ /.test(l)) { rows.push(l.split('/').map(x => x.trim())); continue; } const r = row(l); if (r && (rows.length || head.length)) rows.push(r); else if (!rows.length) head.push(l); else { extra.push(l); } }
    const foot = [...extra, ...blocks.slice(1)].join(' ');
    if (g === 'receipt') return { kind: 'receipt', head: head[0], meta: head.slice(1).join(' · '), rows, foot };
    return { kind: 'table', head: head.join(' · '), rows, foot };
  }
  // notice / flyer / web / ad: short opening lines become the heading
  const all = lines.filter(Boolean);
  const head = [];
  while (all.length > 1 && all[0].length < 70 && !/[.]$/.test(all[0]) && head.length < 3) head.push(all.shift());
  return { kind: 'notice', head: head.join(' · '), paras: all };
}
const qtype = s => /"/.test(s) && /closest in meaning|\bmean\b|describe|refers? to/i.test(s) ? 'Vocabulary' : /^Why does (the|this) \w+ mention/i.test(s) ? 'Rhetorical Purpose' : /closest in meaning/i.test(s) ? 'Vocabulary' : /EXCEPT|NOT /.test(s) ? 'Negative Factual' : /infer|suggest|most likely|probably|imply/i.test(s) ? 'Inference' : 'Factual';

const out = R.rdl.map(t => ({
  id: `R-RDL-${t.type}-${100 + t.n}`, level: t.type, src: 'elijah', genre: GENRE[t.genre] || 'notice',
  doc: doc(t.genre, t.text),
  qs: t.qs.map(q => ({ type: qtype(q.stem), stem: q.stem, opts: q.opts, a: q.a }))
}));
const EX = Object.assign({}, ...['A', 'B', 'C'].map(L => JSON.parse(readFileSync(new URL(`./rdl-ex-${L}.json`, import.meta.url)))));
for (const it of out) {
  const ex = EX[it.id]; if (!ex || ex.length !== it.qs.length) { console.error('EX MISMATCH', it.id); continue; }
  it.qs.forEach((q, k) => { const m = ex[k].match(/^(Factual|Negative Factual|Vocabulary|Inference|Rhetorical Purpose)\|(.*)$/s); if (m) { q.type = m[1]; q.ex = m[2]; } else q.ex = ex[k]; if (q.type === 'Vocabulary') { const w = (q.stem.match(/"([^"]+)"/) || [])[1]; if (w) q.hlw = w; } });
}
writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
// review dump
for (const it of out) {
  console.log(`## ${it.id} [${it.genre}/${it.doc.kind}] head=${it.doc.head ?? it.doc.subject ?? it.doc.who ?? ''} rows=${(it.doc.rows || it.doc.msgs || []).length}`);
  it.qs.forEach((q, k) => console.log(`${k + 1}. (${q.type}) ${q.stem} → ${'ABCD'[q.a]}. ${q.opts[q.a]}`));
}

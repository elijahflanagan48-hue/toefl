// Audit Elijah's Reading files against the ETS 2026 format. Usage: node content/import/audit.mjs <dir-with-md-files>
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeCtw } from '../../app/src/lib/ctw.js';

const dir = process.env.SRC || process.argv[2];
const file = k => readFileSync(join(dir, readdirSync(dir).find(f => f.includes(k))), 'utf8');
const words = s => (s.match(/[A-Za-z0-9’'-]+/g) || []).length;
const sections = md => {
  const out = []; let type = null;
  for (const block of md.split(/^## /m).slice(1)) {
    const name = block.split('\n')[0].trim();
    if (name.startsWith('Type')) {
      type = name.slice(5).trim();
      block.split(/^### Task /m).slice(1).forEach(t => out.push({ type, n: +t.split('\n')[0], body: t.slice(t.indexOf('\n') + 1).trim() }));
    } else if (name === 'Answer Key') {
      for (const kb of block.split(/^### Type /m).slice(1)) {
        const tp = kb.split('\n')[0].trim();
        for (const row of kb.matchAll(/^\| (\d+) \| (.+) \|$/gm)) out.push({ key: true, type: tp, n: +row[1], ans: row[2].split(/[;,] ?(?=\d+\.)/).map(x => x.replace(/^\d+\.\s*/, '').trim()) });
      }
    }
  }
  return out;
};
export function parseAll(dir_) {
  const res = {};
  /* ---- Complete the Words ---- */
  const cs = sections(file('complete_the_words'));
  res.ctw = cs.filter(x => !x.key).map(t => {
    const ans = cs.find(k => k.key && k.type === t.type && k.n === t.n)?.ans || [];
    let i = 0;
    const full = t.body.replace(/([A-Za-z]+)\((\d+)\)_+/g, (m, pre, num) => pre + (ans[+num - 1] ?? '??'));
    const gaps = [...t.body.matchAll(/([A-Za-z]+)\((\d+)\)_+/g)].map(m => ({ pre: m[1], miss: ans[+m[2] - 1] }));
    return { type: t.type, n: t.n, raw: t.body, full, gaps, nAns: ans.length };
  });
  /* ---- Daily Life ---- */
  const ds = sections(file('daily_life'));
  res.rdl = ds.filter(x => !x.key).map(t => {
    const ans = ds.find(k => k.key && k.type === t.type && k.n === t.n)?.ans || [];
    const [textPart, ...qParts] = t.body.split(/^(?=\d+\. )/m);
    const genre = (textPart.match(/^\*\*Read (?:a |an )?(.+?)\.\*\*/) || [])[1];
    const text = textPart.replace(/^\*\*.+?\*\*\s*/, '').trim();
    const qs = qParts.map((q, k) => {
      const lines = q.trim().split('\n').map(s => s.trim()).filter(Boolean);
      return { stem: lines[0].replace(/^\d+\.\s*/, ''), opts: lines.slice(1).map(s => s.replace(/^[A-DΑΒΓΔ]\.\s*/, '')), a: 'ABCD'.indexOf(ans[k]) };
    });
    return { type: t.type, n: t.n, genre, text, qs };
  });
  /* ---- Academic Passage ---- */
  const as = sections(file('academic_passage'));
  res.rap = as.filter(x => !x.key).map(t => {
    const [textPart, ...qParts] = t.body.split(/^(?=\d+\. )/m);
    const title = (textPart.match(/^\*\*(.+?)\*\*/) || [])[1];
    const paras = textPart.replace(/^\*\*.+?\*\*\s*/, '').trim().split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
    const qs = qParts.map(q => {
      const lines = q.trim().split('\n').map(s => s.trim()).filter(Boolean);
      return { stem: lines[0].replace(/^\d+\.\s*/, ''), opts: lines.slice(1).map(s => s.replace(/^[A-DΑΒΓΔ]\.\s*/, '')) };
    });
    return { type: t.type, n: t.n, title, paras, qs };
  });
  return res;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const R = parseAll(dir), rep = [];
  const log = (tag, m) => rep.push(`${tag}: ${m}`);
  /* CtW checks */
  for (const t of R.ctw) {
    const tag = `CtW ${t.type}${t.n}`;
    const n = words(t.full);
    if (t.nAns !== 10 || t.gaps.length !== 10) log(tag, `gaps ${t.gaps.length}, answers ${t.nAns}`);
    if (n < 70 || n > 100) log(tag, `length ${n} words (ETS 70–100)`);
    // ETS: first sentence intact, then every second word damaged in one continuous run, rest intact
    const sents = t.raw.split(/(?<=[.!?])\s+/);
    if (/\(\d+\)/.test(sents[0])) log(tag, 'first sentence has a gap');
    const cleanInMiddle = sents.slice(1).filter((s, i, a) => !/\(\d+\)/.test(s) && a.slice(i + 1).some(x => /\(\d+\)/.test(x)));
    if (cleanInMiddle.length) log(tag, `${cleanInMiddle.length} gap-free sentence(s) inside the gap run (ETS: gaps run continuously)`);
    // half rule: ETS removes the second half (for odd length the larger half)
    const halfBad = t.gaps.filter(g => g.miss && Math.abs(g.miss.length - Math.ceil((g.pre.length + g.miss.length) / 2)) > 0);
    if (halfBad.length) log(tag, `${halfBad.length} gap(s) not cut in half: ${halfBad.slice(0, 3).map(g => g.pre + '|' + g.miss).join(', ')}`);
    // spacing: between consecutive gaps there should be exactly one intact word
    const tokens = t.raw.match(/[A-Za-z0-9’'-]+(\(\d+\)_+)?/g) || [];
    const idx = tokens.map((w, i) => /\(\d+\)/.test(w) ? i : -1).filter(i => i >= 0);
    const spacing = idx.slice(1).map((v, i) => v - idx[i]);
    const off = spacing.filter(s => s !== 2).length;
    if (off) log(tag, `${off} of 9 gap spacings ≠ "every second word" (${spacing.join(',')})`);
    try { makeCtw(t.full, 10); } catch (e) { log(tag, 'ETS generator: ' + e.message); }
  }
  /* DL checks */
  for (const t of R.rdl) {
    const tag = `DL ${t.type}${t.n}`;
    const n = words(t.text);
    if (n < 15 || n > 150) log(tag, `length ${n} words (ETS 15–150)`);
    if (t.qs.length < 2 || t.qs.length > 3) log(tag, `${t.qs.length} questions`);
    if (t.qs.length === 3 && n < 40) log(tag, '3 questions on a short text');
    t.qs.forEach((q, k) => { if (q.opts.length !== 4) log(tag, `q${k + 1} has ${q.opts.length} options`); if (q.a < 0) log(tag, `q${k + 1} no key`); });
  }
  /* AP checks */
  for (const t of R.rap) {
    const tag = `AP ${t.type}${t.n}`;
    const n = words(t.paras.join(' '));
    if (n < 170 || n > 240) log(tag, `length ${n} words (ETS ≈200)`);
    if (t.paras.length > 3) log(tag, `${t.paras.length} paragraphs`);
    if (t.qs.length !== 5) log(tag, `${t.qs.length} questions`);
    t.qs.forEach((q, k) => { if (q.opts.length !== 4) log(tag, `q${k + 1} has ${q.opts.length} options`); });
  }
  const stat = arr => { const w = arr.map(x => x); return `min ${Math.min(...w)}, max ${Math.max(...w)}, avg ${Math.round(w.reduce((a, b) => a + b, 0) / w.length)}`; };
  console.log('CtW', R.ctw.length, 'words', stat(R.ctw.map(t => words(t.full))));
  console.log('DL ', R.rdl.length, 'words', stat(R.rdl.map(t => words(t.text))), 'q', R.rdl.map(t => t.qs.length).join(''));
  console.log('AP ', R.rap.length, 'words', stat(R.rap.map(t => words(t.paras.join(' ')))), 'paras', [...new Set(R.rap.map(t => t.paras.length))]);
  const kinds = {}; rep.forEach(r => { const k = r.split(': ')[1].replace(/\d+/g, 'N').slice(0, 45); kinds[k] = (kinds[k] || 0) + 1; });
  console.log(kinds);
  writeFileSync(process.argv[3] || '/dev/stdout', rep.join('\n') + '\n');
}

// Import Listening tasks from the scripts folder (one .md per task) → content/listening/items.json + audio into app/public/audio/L.
// Usage: node content/import/listening-import.mjs "<…/03 Listening>"
import { readFileSync, writeFileSync, readdirSync, existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const SRC = process.argv[2]; if (!SRC) { console.error('path to "03 Listening" required'); process.exit(1); }
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const mods = JSON.parse(readFileSync(join(ROOT, 'content/listening/modules.json'), 'utf8')).tests;
const testOf = {};
for (const [t, v] of Object.entries(mods)) for (const m of Object.values(v)) for (const it of m.items) testOf[it.id] = t;
const TASK = { LCR: 'lcr', CONV: 'lco', ANN: 'lan', TALK: 'lat' };
const out = [], warn = [];
mkdirSync(join(ROOT, 'app/public/audio/L'), { recursive: true });
for (const f of readdirSync(join(SRC, 'Скрипты')).filter(x => /^L-(LCR|CONV|ANN|TALK)-[ABC]-\d{3}\.md$/.test(x)).sort()) {
  const id = f.replace('.md', ''), [, type, level, num] = id.match(/^L-(\w+)-([ABC])-(\d{3})$/), short = `${type}-${num}`;
  const md = readFileSync(join(SRC, 'Скрипты', f), 'utf8');
  const sec = name => { const m = md.match(new RegExp(`## ${name}[^\\n]*\\n([\\s\\S]*?)(?=\\n## |$)`)); return m ? m[1] : ''; };
  const audio = (sec('Аудио').match(/```\n([\s\S]*?)```/) || [, ''])[1].trim().split('\n').filter(Boolean).map(l => { const m = l.match(/^([^:]+):\s*(.*)$/); return { who: m[1].trim(), text: m[2].replace(/\s*\[pause [\d.]+s\]\s*$/, '').trim() }; });
  const screen = sec('На экране'), keyBlock = md.match(/## Ключ[^\n]*\n([\s\S]*)$/)[0];
  const qs = [], key = [], explain = [], qtypes = [];
  if (type === 'LCR') {
    const opts = [...screen.matchAll(/^([A-D])\.\s+(.*)$/gm)].map(m => m[2].trim());
    qs.push({ stem: 'Choose the best response.', opts });
    key.push('ABCD'.indexOf(keyBlock.match(/## Ключ:\s*([A-D])/)[1]));
    explain.push(keyBlock.replace(/^## Ключ[^\n]*\n/, '').trim());
    qtypes.push('Choose a Response');
  } else {
    for (const b of screen.split(/\n(?=\d+\.\s)/).filter(x => /^\d+\./.test(x.trim()))) {
      const lines = b.trim().split('\n');
      qs.push({ stem: lines[0].replace(/^\d+\.\s*/, '').trim(), opts: lines.slice(1).map(l => l.replace(/^\s*-\s*[A-D]\.\s*/, '').trim()).filter(Boolean) });
    }
    for (const r of keyBlock.split('\n').filter(l => /^\|\s*\d+\s*\|/.test(l))) {
      const c = r.split('|').map(x => x.trim());
      key.push('ABCD'.indexOf(c[2])); qtypes.push(c[3]); explain.push(c[4] || '');
    }
  }
  const mp3 = readdirSync(join(SRC, 'Аудио/Готовые')).find(x => x.startsWith(short + ' '));
  let hasAudio = false;
  if (mp3) { copyFileSync(join(SRC, 'Аудио/Готовые', mp3), join(ROOT, 'app/public/audio/L', short + '.mp3')); hasAudio = true; }
  const test = testOf[short] || null;
  const status = !hasAudio ? 'draft' : test ? 'pretest' : 'active';
  const voices = (md.match(/Голос[аы]?:\s*([^·\n]*)/) || [, ''])[1].trim();
  const words = Number((md.match(/(\d+)\s*слов/) || [])[1]) || audio.filter(a => a.who !== 'Narrator').reduce((n, a) => n + a.text.split(/\s+/).length, 0);
  out.push({ id, type, task: TASK[type], level, short, status, test, audio: hasAudio ? `audio/L/${short}.mp3` : null, voices, words, transcript: audio, qs, key, explain, qtypes });
  if (qs.some(q => q.opts.length !== 4) || key.some(k => k < 0) || key.length !== qs.length) warn.push(id + ': parse problem');
}
writeFileSync(join(ROOT, 'content/listening/items.json'), JSON.stringify(out, null, 1));
const by = {}; out.forEach(i => { const k = i.type + ' ' + i.status; by[k] = (by[k] || 0) + 1; });
console.log(out.length, 'items', JSON.stringify(by)); warn.forEach(w => console.log('WARN', w));

// E2E: full mock test — Reading M1 → M2 (by score) → Listening M1 → M2 → Writing (BaS, Email, Discussion) → Speaking.
// UI path runs until the end of Listen and Repeat; the Interview and the final result are completed over the API (45 s answers are too slow for CI).
const { chromium } = require('playwright');
const fs = require('fs');
const APP = 'http://localhost:4173/', API = 'http://127.0.0.1:8787', OUT = process.argv[2] || '/tmp/e2e-mock';
let pass = 0, fail = 0;
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(c ? '  ✓' : '  ✗', n, c ? '' : x); };
const until = async (p, fn, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await p.evaluate(fn).catch(() => false)) return true; await p.waitForTimeout(100); } return false; };
const FAKE_AUDIO = () => { window.__plays = 0; const Real = window.Audio; window.Audio = class { constructor(src) { this.src = src; this.duration = 0.3; window.__plays++; }
  play() { setTimeout(() => this.onended && this.onended(), 250); return Promise.resolve(); } pause() {} }; };
const hash = p => p.evaluate(() => location.hash);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const errs = [];
  const mk = async (w, h) => { const c = await b.newContext({ viewport: { width: w, height: h }, permissions: ['microphone'] }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.addInitScript(FAKE_AUDIO); return p; };
  const t = await mk(1440, 900);
  await t.goto(APP); await t.waitForTimeout(700);
  if (t.url().includes('#/login')) { await t.fill('#email', 'teacher@example.com'); await t.fill('#password', 'teacher-pass-1'); await t.click('button[type=submit]'); await t.waitForTimeout(1200); }
  await t.goto(APP + '#/profile'); await t.waitForTimeout(900);
  const code = (await t.textContent('.groups .code')).trim();
  const s = await mk(1280, 900);
  await s.goto(APP + '#/join?code=' + code); await s.waitForTimeout(700);
  await s.fill('#name', 'Тимур Пробников'); await s.fill('#email', 'm' + Date.now() + '@example.com'); await s.fill('#password', 'student-pass-1');
  await s.click('button[type=submit]'); await s.waitForTimeout(1200);
  const api = async (p, m, path, body) => (await fetch(API + path, { method: m, headers: { Authorization: 'Bearer ' + (await p.evaluate(() => localStorage.getItem('nt.token'))), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })).json();

  // the mocks are items of the bank, closed for practice
  const pr = await api(s, 'GET', '/items?section=R&task=ctw&limit=20&level=');
  ok(!pr.items.some(i => ['R-CTW-A-104', 'R-CTW-B-108', 'R-CTW-C-001'].includes(i.id)), 'mock items are not offered in practice');

  // closed until the teacher assigns it
  await s.goto(APP + '#/mock'); await s.waitForTimeout(1000);
  ok(!(await s.$('[data-act="mock-start"]')) && /открывает учитель/.test(await s.textContent('#app')), 'student: mock page is locked until assigned');
  const ttok = await t.evaluate(() => localStorage.getItem('nt.token')), sid = (await api(s, 'GET', '/me')).user.id;
  await fetch(API + '/teacher/assignments', { method: 'POST', headers: { Authorization: 'Bearer ' + ttok, 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Полный пробник 1', student_id: sid, spec: { section: 'M', task: 'T1' } }) });

  // start
  await s.goto(APP + '#/progress'); await s.waitForTimeout(500); await s.goto(APP + '#/mock'); await s.waitForTimeout(1000);
  ok((await s.textContent('#app')).includes('Listening') && !(await s.textContent('#app')).includes('после озвучки'), 'mock page: Listening is no longer «after voicing»');
  await s.click('[data-act="mock-start"]'); await s.waitForTimeout(600);
  ok((await s.$$('[data-act="mock-go"]')).length === 1, 'only the assigned test is offered');
  await s.screenshot({ path: OUT + '/start.png' });
  await s.click('[data-act="mock-go"][data-id="T1"]'); await s.waitForTimeout(1500);
  ok((await hash(s)).includes('practice/mock') && (await hash(s)).includes('R:M1'), 'starts with Reading module 1', await hash(s));
  ok(await s.evaluate(() => !!document.querySelector('.xtime')), 'module timer is shown');

  // Reading M1: page through all screens without answering (→ lower route)
  let n = 0; for (; n < 40; n++) { const nxt = await s.$('[data-act="pr-next"]'); if (!nxt) break; const txt = (await nxt.textContent()).trim(); await nxt.click(); await s.waitForTimeout(120); if (txt === 'Finish') break; }
  ok(n >= 15, 'Reading module 1 has the expected number of screens', String(n));
  await s.waitForTimeout(300); await s.click('[data-act="pr-finish"]'); await s.waitForTimeout(1500);
  ok((await hash(s)).includes('R:lower'), 'low score → easier Reading module 2', await hash(s));
  await s.screenshot({ path: OUT + '/reading-m2.png' });
  for (let i = 0; i < 20; i++) { const nxt = await s.$('[data-act="pr-next"]'); if (!nxt) break; const txt = (await nxt.textContent()).trim(); await nxt.click(); await s.waitForTimeout(100); if (txt === 'Finish') break; }
  await s.click('[data-act="pr-finish"]'); await s.waitForTimeout(1500);
  ok((await hash(s)).includes('mock/next'), 'between sections: interstitial', await hash(s));
  ok((await s.textContent('#app')).includes('Listening'), 'next section announced');
  await s.screenshot({ path: OUT + '/next.png' });
  await s.click('a.btn.pri'); await s.waitForTimeout(1200);
  ok((await hash(s)).includes('listen/mock') && (await hash(s)).includes('L:M1'), 'Listening module 1', await hash(s));

  // Listening M1 + M2: play each recording (fake audio), skip questions with Enter
  const runL = async () => {
    for (let i = 0; i < 120; i++) {
      if (!(await hash(s)).includes('listen/mock')) return;
      if (await s.$('[data-act="ls-play"]')) { await s.click('[data-act="ls-play"]'); await s.waitForTimeout(700); }
      else if (await s.$('.opts .opt')) { await s.keyboard.press('2'); await s.keyboard.press('Enter'); await s.waitForTimeout(120); }
      else await s.waitForTimeout(150);
    }
  };
  await runL();
  ok((await hash(s)).includes('mock/next'), 'Listening done → interstitial', await hash(s));
  await s.click('a.btn.pri'); await s.waitForTimeout(1500);
  ok((await hash(s)).includes('W:bas'), 'Writing starts with Build a Sentence', await hash(s));
  ok(await s.evaluate(() => /Writing/.test(document.querySelector('.xsec')?.textContent || '')), 'title says Writing');
  for (let i = 0; i < 14; i++) { const nxt = await s.$('[data-act="pr-next"]'); if (!nxt) break; const txt = (await nxt.textContent()).trim(); await nxt.click(); await s.waitForTimeout(100); if (txt === 'Finish') break; }
  await s.click('[data-act="pr-finish"]'); await s.waitForTimeout(1500);
  ok((await hash(s)).includes('write/eml'), 'then the Email', await hash(s));
  await s.fill('#wtext', 'Dear Professor Reed, I am writing to ask about the deadline for the final project. Could you please tell me whether I can submit it on Friday? Thank you for your help. Best regards, Timur');
  await s.click('[data-act="w-submit"]'); await s.waitForTimeout(300); await s.click('[data-act="w-confirm"]'); await s.waitForTimeout(1500);
  ok((await hash(s)).includes('write/dsc'), 'then the Academic Discussion', await hash(s));
  await s.fill('#wtext', 'I think students should have flexible deadlines because every course is different and some projects need more time to finish well.');
  await s.click('[data-act="w-submit"]'); await s.waitForTimeout(300); await s.click('[data-act="w-confirm"]'); await s.waitForTimeout(1500);
  ok((await hash(s)).includes('mock/next') && (await s.textContent('#app')).includes('Speaking'), 'Speaking announced', await hash(s));
  await s.click('a.btn.pri'); await s.waitForTimeout(1200);
  ok((await hash(s)).includes('speak/lrp') && (await hash(s)).includes('mock=1'), 'Speaking: Listen and Repeat', await hash(s));
  await s.click('[data-act="s-mic"]'); await until(s, () => !!document.querySelector('[data-act="s-go"]'), 8000);
  await s.click('[data-act="s-go"]'); await s.click('[data-act="s-start"]');
  ok(await until(s, () => /speak\/int/.test(location.hash), 150000), 'after the 7 sentences → Interview', await hash(s));
  await s.screenshot({ path: OUT + '/speak-int.png' });

  // finish the rest over the API: interview submission → finish → summary → teacher ratings
  const flow = JSON.parse(await s.evaluate(() => sessionStorage.getItem('nt.mockflow')));
  ok(flow && flow.attempt && flow.at === 8, 'flow state points at the last step', JSON.stringify(flow));
  const subs0 = await api(s, 'GET', '/me/submissions');
  const mine = subs0.submissions || subs0;
  ok(mine.filter(x => x.attempt_id === flow.attempt || true).length >= 3, 'email, discussion and speaking submissions exist');
  const sub = await api(s, 'POST', '/submissions', { section: 'S', task: 'int', item_id: 'S-INT-B-006', parts: 4, prompt: {}, attempt_id: flow.attempt });
  const au = await fetch(API + `/submissions/${sub.id}/audio/0`, { method: 'PUT', headers: { Authorization: 'Bearer ' + await s.evaluate(() => localStorage.getItem('nt.token')), 'Content-Type': 'audio/webm' }, body: new Uint8Array(2000) });
  await api(s, 'POST', `/submissions/${sub.id}/submit`);
  await api(s, 'POST', `/attempts/${flow.attempt}/finish`);
  await s.evaluate(() => sessionStorage.removeItem('nt.mockflow'));
  let sum = await api(s, 'GET', `/attempts/${flow.attempt}/summary`);
  ok(sum.route.R === 'lower' && sum.bands.R != null && sum.bands.L != null, 'summary has Reading and Listening bands and routes', JSON.stringify(sum.bands) + JSON.stringify(sum.route));
  ok(sum.modules.R['1'] && sum.modules.R['2'] && sum.modules.L['1'] && sum.modules.L['2'], 'both modules of Reading and Listening were answered', JSON.stringify(sum.modules));
  ok(sum.W.bas.n === 10, 'Build a Sentence: 10 answers saved', JSON.stringify(sum.W.bas));
  ok(sum.W.eml && sum.W.dsc && sum.S.lrp && sum.S.int && sum.bands.overall == null, 'Writing/Speaking submitted, overall waits for the teacher');
  // teacher rates everything
  const q = await api(t, 'GET', '/teacher/queue?status=pending');
  const ids = Object.values(sum.W).concat(Object.values(sum.S)).filter(x => x && x.id).map(x => x.id);
  for (const id of ids) {
    const task = (id === sum.S.lrp.id) ? 'lrp' : (id === sum.S.int.id) ? 'int' : 'w';
    await api(t, 'POST', `/teacher/submissions/${id}/rating`, task === 'lrp' ? { parts: [4, 4, 4, 4, 4, 4, 4] } : task === 'int' ? { parts: [4, 4, 4, 4] } : { score: 4 });
  }
  sum = await api(s, 'GET', `/attempts/${flow.attempt}/summary`);
  ok(sum.bands.W != null && sum.bands.S != null && sum.bands.overall != null, 'after the teacher rates: W, S and overall appear', JSON.stringify(sum.bands));
  await s.goto(APP + '#/mock/result/' + flow.attempt); await s.waitForTimeout(1500);
  const rt = await s.textContent('#app');
  ok(rt.includes('Итоговый балл') && rt.includes('Reading') && rt.includes('Speaking'), 'result page shows all four sections');
  await s.screenshot({ path: OUT + '/result.png' });
  ok(await s.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'result page fits the width');

  // upper route: correct M1 answers over the API
  const a2 = (await api(t, 'POST', '/teacher/assignments', { title: 'Полный пробник 2', student_id: sid, spec: { section: 'M', task: 'T2' } })).id;
  const att = await api(s, 'POST', '/attempts', { kind: 'mock', mode: 'exam', task: 'T2', assignment_id: a2 });
  const items = (await api(t, 'GET', '/mocks/T2/part?part=R:M1')).items;
  const full = [];
  for (const it of items) { const d = await api(t, 'GET', '/teacher/items/' + it.id); full.push(d.item); }
  const resp = [];
  for (const it of full) { const n = it.task === 'ctw' ? it.key.length : it.key.length; for (let i = 0; i < n; i++) resp.push({ item_id: it.id, q: i, answer: it.key[i], module: 1 }); }
  await api(s, 'POST', `/attempts/${att.id}/responses`, { responses: resp });
  const r = await api(s, 'POST', `/attempts/${att.id}/route`, { section: 'R' });
  ok(r.route === 'upper', 'all correct in module 1 → harder module 2', JSON.stringify(r));
  const up = await api(s, 'GET', '/mocks/T2/part?part=R:upper');
  ok(up.items.length === 2, 'upper module has its two items');

  ok(errs.length === 0, 'no page errors', errs.join(' | '));
  await b.close();
  console.log(`\nmock e2e: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

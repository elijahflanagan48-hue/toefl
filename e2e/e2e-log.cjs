// E2E: teacher sees what a student did — weak-type rows and attempts open the answer log (items, student's answers, key).
const { chromium } = require('playwright');
const fs = require('fs');
const APP = 'http://localhost:4173/', API = 'http://127.0.0.1:8787', OUT = process.argv[2] || '/tmp/e2e-log';
let pass = 0, fail = 0;
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(c ? '  ✓' : '  ✗', n, c ? '' : x); };
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch(); const errs = [];
  const mk = async (w, h) => { const c = await b.newContext({ viewport: { width: w, height: h } }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); return p; };
  const t = await mk(1440, 900);
  await t.goto(APP); await t.waitForTimeout(800);
  if (t.url().includes('#/login')) { await t.fill('#email', 'teacher@example.com'); await t.fill('#password', 'teacher-pass-1'); await t.click('button[type=submit]'); await t.waitForTimeout(1200); }
  await t.goto(APP + '#/profile'); await t.waitForTimeout(900);
  const code = (await t.textContent('.groups .code')).trim();

  const s = await mk(390, 800);
  const sname = 'Журнал ' + Date.now().toString().slice(-4);
  await s.goto(APP + '#/join?code=' + code); await s.waitForTimeout(700);
  await s.fill('#name', sname); await s.fill('#email', 'l' + Date.now() + '@example.com'); await s.fill('#password', 'student-pass-1');
  await s.click('button[type=submit]'); await s.waitForTimeout(1200);
  const stok = await s.evaluate(() => localStorage.getItem('nt.token'));
  const sapi = async (m, p, j) => (await fetch(API + p, { method: m, headers: { Authorization: 'Bearer ' + stok, 'Content-Type': 'application/json' }, body: j ? JSON.stringify(j) : undefined })).json();

  // student works: Complete the Words (first gap right, rest wrong), Read in Daily Life (first right, rest wrong)
  async function work(task, wrongOf) {
    const at = await sapi('POST', '/attempts', { kind: 'practice', mode: 'learn', section: 'R', task });
    const its = (await sapi('GET', `/items?section=R&task=${task}&limit=3&level=B`)).items;
    for (const it of its) {
      const n = task === 'ctw' ? it.body.parts.filter(p => p.n).length : it.body.qs.length;
      const responses = [];
      for (let q = 0; q < n; q++) responses.push({ item_id: it.id, q, answer: q === 0 ? null : wrongOf(it, q) });
      // first answer: find the right one through the learn-mode reveal
      const first = await sapi('POST', `/attempts/${at.id}/responses`, { responses: responses.slice(1) });
      const k0 = await sapi('POST', `/attempts/${at.id}/responses`, { responses: [{ item_id: it.id, q: 0, answer: task === 'ctw' ? 'zz' : 0 }] });
      const key0 = k0.results[0].key;
      await sapi('POST', `/attempts/${at.id}/responses`, { responses: [{ item_id: it.id, q: 0, answer: key0 }] });
    }
    await sapi('POST', `/attempts/${at.id}/finish`);
    return at.id;
  }
  const ctwAt = await work('ctw', () => 'qq');
  const rdlAt = await work('rdl', () => 3);
  ok(ctwAt && rdlAt, 'student attempts created');

  await t.goto(APP + '#/t/students'); await t.waitForTimeout(900);
  await t.click('.scard:has-text("' + sname + '")'); await t.waitForTimeout(1200);
  ok((await t.$$('a.qb')).length >= 1, 'weak-type rows are links');
  await t.screenshot({ path: OUT + '/card.png' });

  // Complete the Words → log
  await t.click('a.qb:has-text("Complete the Words")'); await t.waitForSelector('.lg', { timeout: 8000 });
  const arts = await t.$$('.lg');
  ok(arts.length === 3, 'log shows the 3 Complete the Words items the student got', String(arts.length));
  ok((await t.$$('.gp.bad')).length >= 3 && (await t.$$('.gp.key')).length >= 3 && (await t.$$('.gp.ok')).length === 3, 'wrong answers shown struck-through with the right letters beside, correct ones green');
  ok((await t.textContent('.lg')).includes('qq'), 'the student\'s typed answer is visible');
  ok((await t.textContent('.hdr')).includes(sname), 'header names the student');
  await t.screenshot({ path: OUT + '/log-ctw.png', fullPage: true });

  // back → Factual (rdl) via the card
  await t.goBack(); await t.waitForTimeout(900);
  const types = await t.$$eval('a.qb .qn', e => e.map(x => x.textContent));
  const mcqType = types.find(x => x !== 'Complete the Words');
  ok(!!mcqType, 'a Reading question type is listed too', types.join(','));
  if (mcqType) {
    await t.click(`a.qb:has-text("${mcqType}")`); await t.waitForSelector('.lg');
    ok((await t.$$('.lgopts li')).length >= 4, 'options listed');
    ok((await t.$$('.lgopts li.pick.bad')).length >= 1 && (await t.$$('.lgopts li.ok')).length >= 1, 'the student\'s wrong pick and the right option are both marked');
    await t.screenshot({ path: OUT + '/log-rdl.png', fullPage: true });
  }

  // attempt link in «Последние попытки»
  await t.goto(APP + '#/t/students'); await t.waitForTimeout(700);
  await t.click('.scard:has-text("' + sname + '")'); await t.waitForTimeout(1200);
  await t.click(`.tbl a[href$="/attempt/${rdlAt}"]`); await t.waitForSelector('.lg');
  ok((await t.$$('.lg')).length === 3, 'an attempt row opens that attempt\'s items', String((await t.$$('.lg')).length));
  ok((await t.textContent('.hdr')).includes('Попытка'), 'header says which attempt');
  await t.goto(APP + '#/t/students'); await t.waitForTimeout(500);
  await t.click('.scard:has-text("' + sname + '")'); await t.waitForTimeout(1200);
  await t.click('a:has-text("Все выполненные задания")'); await t.waitForSelector('.lg');
  ok((await t.$$('.lg')).length === 6, 'one button opens everything the student did: 6 items', String((await t.$$('.lg')).length));
  ok((await t.$$('.lgtabs a')).length === 5, 'section tabs are there');
  ok((await t.$$('.lgsrc')).length >= 3 && (await t.textContent('.lgsrc')).length > 80, 'the source text is shown with the questions');
  ok((await t.$$('.xdoc')).length >= 1, 'Read in Daily Life document rendered');
  await t.screenshot({ path: OUT + '/log-all.png' });
  await t.click('.lgtabs a:has-text("Reading")'); await t.waitForSelector('.lg'); await t.waitForTimeout(500);
  ok((await t.$$('.lg')).length === 6, 'Reading tab shows the 6 items');
  await t.click('.lgtabs a:has-text("Listening")'); await t.waitForTimeout(900);
  ok((await t.$$('.lg')).length === 0 && (await t.textContent('#app')).includes('пока нет'), 'Listening tab is empty for this student');
  await t.click('.lgtabs a:has-text("Writing")'); await t.waitForTimeout(900);
  ok((await t.textContent('#app')).includes('пока нет'), 'Writing tab: empty state');
  await t.goto(APP + '#/t/students'); await t.waitForTimeout(500);
  await t.click('.scard:has-text("' + sname + '")'); await t.waitForTimeout(1200);
  await t.click('a:has-text("Все выполненные задания")'); await t.waitForSelector('.lg');

  // phone width
  const m = await mk(375, 800);
  await m.goto(APP + '#/login'); await m.fill('#email', 'teacher@example.com'); await m.fill('#password', 'teacher-pass-1'); await m.click('button[type=submit]'); await m.waitForTimeout(1200);
  await m.goto(t.url()); await m.waitForSelector('.lg', { timeout: 8000 });
  ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal scroll at 375');
  await m.screenshot({ path: OUT + '/log-375.png' });

  ok(errs.length === 0, 'no page errors', errs.join(' | '));
  await b.close();
  console.log(`\nlog e2e: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

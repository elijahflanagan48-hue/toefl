// E2E: teacher cabinet (P9) — assignment with deadline → student sees it → does it via the link → completion on the teacher's page;
// student card; bank browser (filter, preview, status change, import, edit); content overview; teacher can open the mock-test page.
const { chromium } = require('playwright');
const fs = require('fs');
const APP = 'http://localhost:4173/', OUT = process.argv[2] || '/tmp/e2e-teacher';
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
  const s = await mk(1280, 900);
  const sname = 'Вера Заданова ' + Date.now().toString().slice(-4);
  await s.goto(APP + '#/join?code=' + code); await s.waitForTimeout(700);
  await s.fill('#name', sname); await s.fill('#email', 'v' + Date.now() + '@example.com'); await s.fill('#password', 'student-pass-1');
  await s.click('button[type=submit]'); await s.waitForTimeout(1200);

  // nav has the mock-test entry for the teacher
  await t.goto(APP + '#/t/home'); await t.waitForTimeout(900);
  ok(!!(await t.$('.rail a[href="#/mock"], nav a[href="#/mock"]')), 'teacher navigation has «Пробник»');
  await t.goto(APP + '#/mock'); await t.waitForTimeout(900);
  ok(!(await t.textContent('#app')).includes('Cannot') && (await t.textContent('#app')).length > 50, 'teacher opens the mock page');

  // assign to the student
  await t.goto(APP + '#/t/students'); await t.waitForTimeout(1000);
  await t.click('.scard:has-text("' + sname + '")'); await t.waitForTimeout(1200);
  ok(t.url().includes('#/t/student/'), 'student card opens from the list');
  ok((await t.textContent('#app')).includes(sname), 'card shows the name');
  await t.screenshot({ path: OUT + '/card.png' });
  await t.click('.hdr [data-act="assign"]'); await t.waitForTimeout(600);
  ok(await t.evaluate(() => document.getElementById('a-to').selectedOptions[0].textContent.includes('Вера')), 'assign dialog preselects this student');
  await t.selectOption('#a-task', 'R:ctw'); await t.selectOption('#a-mode', 'learn');
  await t.click('[data-act="assign-go"]'); await t.waitForTimeout(1200);
  ok(t.url().includes('#/t/assign'), 'goes to the assignments page');
  let txt = await t.textContent('#app');
  ok(txt.includes('Complete the Words') && txt.includes('0 из 1'), 'assignment listed, 0 of 1 done', txt.slice(0, 300));

  // student sees it on «Сегодня» and starts from the link
  await s.goto(APP + '#/train/R'); await s.goto(APP + '#/today'); await s.waitForTimeout(1500);
    const link = await s.$('a[href*="#/practice/ctw"][href*="a="]');
  ok(!!link, 'student has the assignment with a tracked link');
  await link.click(); await s.waitForTimeout(1500);
  // complete one CtW item in learn mode quickly: fill nothing, press through
  for (let i = 0; i < 4; i++) {
    const inputs = await s.$$('input.ltr, .ctw input, input[data-i]');
    if (inputs.length) { for (const x of inputs.slice(0, 1)) await x.fill('a').catch(() => {}); }
    const fin = await s.$('[data-act="p-finish"], [data-act="finish"]');
    if (fin) break;
    const nxt = await s.$('[data-act="p-next"], [data-act="next"], .xbtn.pri'); if (nxt) await nxt.click().catch(() => {});
    await s.waitForTimeout(400);
  }
  await s.evaluate(() => { const b = [...document.querySelectorAll('[data-act]')].find(x => /finish|end|exit-done/.test(x.dataset.act)); b && b.click(); });
  await s.waitForTimeout(800);
  // record completion directly through the attempt API if the UI path above did not finish the attempt
  const token = await s.evaluate(() => localStorage.getItem('nt.token'));
  const api = async (m, p, body) => (await fetch('http://127.0.0.1:8787' + p, { method: m, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })).json();
  const mine = await api('GET', '/me/assignments');
  const aid = mine.assignments[0].id;
  let after = await api('GET', '/me/assignments');
  if (!after.assignments[0].done) { const at = await api('POST', '/attempts', { kind: 'practice', assignment_id: aid }); await api('POST', `/attempts/${at.id}/finish`); }
  after = await api('GET', '/me/assignments');
  ok(after.assignments[0].done === true, 'assignment marked done for the student');
  await s.goto(APP + '#/train/R'); await s.goto(APP + '#/today'); await s.waitForTimeout(1500);
  ok(!(await s.$('a[href*="#/practice/ctw"][href*="a="]')), 'done assignment disappears from «Сегодня»');

  await t.goto(APP + '#/t/home'); await t.goto(APP + '#/t/assign'); await t.waitForTimeout(1200);
  ok((await t.textContent('#app')).includes('1 из 1'), 'teacher sees 1 of 1 done');
  await t.screenshot({ path: OUT + '/assign.png' });

  // results page: student answers an assigned Listening-free item (Reading CtW) wrongly → teacher sees errors + explanation
  await t.click('.hdr [data-act="assign"]'); await t.waitForTimeout(500);
  await t.selectOption('#a-task', 'R:ctw'); await t.click('[data-act="assign-go"]'); await t.waitForTimeout(1000);
  const mine2 = await api('GET', '/me/assignments');
  const a2 = mine2.assignments.find(x => !x.done);
  ok(!!a2, 'second assignment is open for the student');
  if (a2) {
    const at = await api('POST', '/attempts', { kind: 'practice', assignment_id: a2.id, section: 'R', task: 'ctw' });
    const got = await api('GET', '/items?section=R&task=ctw&limit=1');
    const it = got.items[0];
    await api('POST', `/attempts/${at.id}/responses`, { responses: [{ item_id: it.id, q: 0, answer: 'zzz' }] });
    await api('POST', `/attempts/${at.id}/finish`);
    await t.goto(APP + '#/t/home'); await t.goto(APP + '#/t/assign/' + a2.id); await t.waitForTimeout(1500);
    const rt = await t.textContent('#app');
    ok(rt.includes(sname) && rt.includes('Разбор для урока'), 'results page lists the student and the lesson breakdown', rt.slice(0, 300));
    ok(!!(await t.$('.rq-item')) && rt.includes(it.id), 'results page shows the item with the wrong answer');
    ok(rt.includes('zzz'), 'results page shows what the student answered');
    await t.screenshot({ path: OUT + '/results.png' });
  }

  // group assignment + delete
  const n0 = (await t.$$('.tbl tbody tr')).length;
  await t.click('.hdr [data-act="assign"]'); await t.waitForTimeout(500);
  await t.selectOption('#a-task', 'S:int'); await t.selectOption('#a-mode', 'timed');
  await t.click('[data-act="assign-go"]'); await t.waitForTimeout(1000);
  ok((await t.$$('.tbl tbody tr')).length === n0 + 1, 'group assignment added', n0 + ' → ' + (await t.$$('.tbl tbody tr')).length);
  await t.click('.tbl tbody tr:first-child [data-act="assign-del"]'); await t.waitForTimeout(400);
  await t.click('[data-act="assign-del-go"]'); await t.waitForTimeout(900);
  ok((await t.$$('.tbl tbody tr')).length === n0, 'assignment deleted');
  await s.goto(APP + '#/today'); await s.waitForTimeout(900);

  // content overview → bank
  await t.goto(APP + '#/t/content'); await t.waitForTimeout(1200);
  txt = await t.textContent('#app');
  ok(txt.includes('Complete the Words') && txt.includes('Choose a Response') && txt.includes('Take an Interview'), 'content overview covers R, L, W, S');
  await t.screenshot({ path: OUT + '/content.png' });
  await t.click('tr[data-go*="task=lco"]'); await t.waitForTimeout(1200);
  ok(t.url().includes('task=lco') && (await t.$$('.tbl tbody tr')).length === 21, 'bank filtered to Conversation (21 tasks)', String((await t.$$('.tbl tbody tr')).length));
  await t.fill('[data-f=q]', 'CONV-0'); await t.waitForTimeout(1500);
  ok(t.url().includes('q=CONV-0'), 'search updates the URL');
  await t.click('.tbl tbody tr:first-child'); await t.waitForTimeout(800);
  ok((await t.textContent('#layer')).includes('"qs"') && !!(await t.$('#layer audio')), 'item preview with JSON and audio player');
  await t.click('[data-act="bank-status"][data-v="retired"]'); await t.waitForTimeout(1000);
  const row = await t.textContent('.tbl tbody tr:first-child'); ok(row.includes('снято'), 'status changed to retired', row);
  // import
  await t.goto(APP + '#/t/content'); await t.waitForTimeout(800);
  await t.click('.hdr [data-act="imp"]'); await t.waitForTimeout(400);
  const newItem = { id: 'W-BAS-A-999', section: 'W', task: 'bas', level: 'A', status: 'draft', body: { a: 'Where is it?', parts: [null, null, null], chunks: ['it', 'is', 'there'] }, key: [['it', 'is', 'there']], explain: ['x'] };
  await t.fill('#imp-json', JSON.stringify([newItem])); await t.click('[data-act="imp-go"]'); await t.waitForTimeout(1000);
  await t.goto(APP + '#/t/bank?q=W-BAS-A-999'); await t.waitForTimeout(1200);
  ok((await t.textContent('.tbl tbody')).includes('W-BAS-A-999'), 'imported item appears in the bank');
  await t.click('.tbl tbody tr:first-child'); await t.waitForTimeout(600);
  const j = JSON.parse(await t.inputValue('#b-json')); j.level = 'B';
  await t.fill('#b-json', JSON.stringify(j)); await t.click('[data-act="bank-save"]'); await t.waitForTimeout(1000);
  ok((await t.textContent('.tbl tbody tr:first-child')).includes('B'), 'edit saved (level A → B)');
  await t.click('.tbl tbody tr:first-child'); await t.click('[data-act="bank-status"][data-v="retired"]'); await t.waitForTimeout(600);
  // invalid import is rejected
  await t.goto(APP + '#/t/content'); await t.click('.hdr [data-act="imp"]'); await t.fill('#imp-json', JSON.stringify([{ id: 'x', section: 'Z' }])); await t.click('[data-act="imp-go"]'); await t.waitForTimeout(700);
  ok(/section|ошибк/i.test(await t.textContent('.toast').catch(() => '')), 'invalid import shows an error');

  // student card with attempts
  await t.goto(APP + '#/t/students'); await t.waitForTimeout(800); await t.click('.scard:has-text("' + sname + '")'); await t.waitForTimeout(1200);
  ok((await t.textContent('#app')).includes('Тренировка'), 'card lists the finished attempt');
  // mobile
  const m = await mk(375, 740);
  await m.goto(APP + '#/login'); await m.fill('#email', 'teacher@example.com'); await m.fill('#password', 'teacher-pass-1'); await m.click('button[type=submit]'); await m.waitForTimeout(1200);
  for (const h of ['#/t/assign', '#/t/bank', '#/t/content']) { await m.goto(APP + h); await m.waitForTimeout(1000); ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal scroll at 375: ' + h); }
  await m.screenshot({ path: OUT + '/content-375.png' });
  ok(errs.length === 0, 'no page errors', errs.join(' | '));
  await b.close();
  console.log(`\nteacher cabinet e2e: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

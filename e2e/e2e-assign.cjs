// E2E: assigning several tasks at once — checklist, «Весь <раздел>», grouped rows in the list, student sees every task, delete a whole set.
const { chromium } = require('playwright');
const fs = require('fs');
const APP = 'http://localhost:4173/', API = 'http://127.0.0.1:8787', OUT = process.argv[2] || '/tmp/e2e-assign';
let pass = 0, fail = 0;
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(c ? '  ✓' : '  ✗', n, c ? '' : x); };
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch(); const errs = [];
  const mk = async (w, h) => { const c = await b.newContext({ viewport: { width: w, height: h } }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); return p; };
  const t = await mk(1440, 900);
  await t.goto(APP); await t.waitForTimeout(800);
  if (t.url().includes('#/login')) { await t.fill('#email', 'teacher@example.com'); await t.fill('#password', 'teacher-pass-1'); await t.click('button[type=submit]'); await t.waitForTimeout(1200); }
  const ttok = await t.evaluate(() => localStorage.getItem('nt.token'));
  const tapi = async (m, p) => (await fetch(API + p, { method: m, headers: { Authorization: 'Bearer ' + ttok } })).json();
  for (const a of (await tapi('GET', '/teacher/assignments')).assignments || []) await tapi('DELETE', '/teacher/assignments/' + a.id); // clean slate
  await t.goto(APP + '#/profile'); await t.waitForTimeout(900);
  const code = (await t.textContent('.groups .code')).trim();

  const s = await mk(390, 800);
  const sname = 'Мультизадание ' + Date.now().toString().slice(-4);
  await s.goto(APP + '#/join?code=' + code); await s.waitForTimeout(700);
  await s.fill('#name', sname); await s.fill('#email', 'm' + Date.now() + '@example.com'); await s.fill('#password', 'student-pass-1');
  await s.click('button[type=submit]'); await s.waitForTimeout(1200);
  const stok = await s.evaluate(() => localStorage.getItem('nt.token'));
  const sapi = async (m, p) => (await fetch(API + p, { method: m, headers: { Authorization: 'Bearer ' + stok } })).json();

  const box = v => `input[name="a-task"][value="${v}"]`, allBox = sec => `input[data-pick="all"][data-sec="${sec}"]`;
  const state = sel => t.evaluate(s2 => { const e = document.querySelector(s2); return { c: e.checked, i: e.indeterminate }; }, sel);
  const checkedCount = () => t.evaluate(() => document.querySelectorAll('input[name="a-task"]:checked').length);
  const open = async () => {
    await t.goto(APP + '#/t/students'); await t.waitForTimeout(900);
    await t.click('.scard:has-text("' + sname + '")'); await t.waitForTimeout(1000);
    await t.click('.hdr [data-act="assign"]'); await t.waitForSelector('input[name="a-task"]', { timeout: 8000 });
  };

  // ---- dialog behaviour
  await open();
  ok((await t.$$('input[name="a-task"]')).length >= 17, 'dialog lists every task as a checkbox');
  ok(await t.evaluate(() => document.querySelector('[data-act="assign-go"]').disabled), 'assign button is disabled until something is chosen');
  ok((await t.textContent('#a-count')).includes('Выберите'), 'counter asks to choose');
  await t.screenshot({ path: OUT + '/dialog-empty.png' });

  await t.click(allBox('R'));
  ok((await checkedCount()) === 3 && (await state(box('R:ctw'))).c && (await state(box('R:rdl'))).c && (await state(box('R:rap'))).c, '«Весь Reading» ticks the three Reading task types');
  ok(!(await state(box('R:module'))).c && !(await state(box('R:'))).c, '…but not the mixed / exam-module variants');
  ok((await state(allBox('R'))).c, '«Весь Reading» is ticked');
  ok((await t.textContent('#a-count')).includes('Выбрано: 3') && !(await t.evaluate(() => document.querySelector('[data-act="assign-go"]').disabled)), 'counter shows 3 and the button is enabled');

  await t.click(box('R:rdl'));
  let st = await state(allBox('R'));
  ok(!st.c && st.i && (await checkedCount()) === 2, 'unticking one task leaves the section box half-ticked');
  await t.click(box('R:rdl'));
  ok((await state(allBox('R'))).c && !(await state(allBox('R'))).i, 'ticking it again completes the section');

  await t.click(allBox('R'));
  ok((await checkedCount()) === 0 && (await t.textContent('#a-count')).includes('Выберите'), 'clicking «Весь Reading» again clears the section');
  await t.click(allBox('W')); await t.click(box('M:T2'));
  ok((await checkedCount()) === 4, 'sections and a full mock can be combined', String(await checkedCount()));
  await t.screenshot({ path: OUT + '/dialog-multi.png' });

  // ---- 1) whole Reading, timed
  await t.click(allBox('W')); await t.click(box('M:T2'));
  await t.click(allBox('R')); await t.selectOption('#a-mode', 'timed');
  await t.click('[data-act="assign-go"]'); await t.waitForTimeout(1300);
  ok(t.url().includes('#/t/assign'), 'goes to the assignments page');
  let rows = await t.$$('.tbl tbody tr');
  ok(rows.length === 1, 'whole Reading appears as ONE row', String(rows.length));
  let txt = await t.textContent('#app');
  ok(txt.includes('Весь Reading') && txt.includes('3 задания'), 'row is labelled «Весь Reading», 3 tasks', txt.slice(0, 300));
  ok(['Complete the Words', 'Read in Daily Life', 'Read an Academic Passage'].every(n => txt.includes(n)), 'row lists all three tasks');
  ok((await t.$$('.aprog')).length === 3, 'a progress bar per task');

  // ---- 2) a hand-picked mix, learn
  await open();
  await t.click(box('W:bas')); await t.click(box('S:lrp'));
  await t.click('[data-act="assign-go"]'); await t.waitForTimeout(1300);
  txt = await t.textContent('#app');
  ok(txt.includes('Набор: 2 задания'), 'hand-picked mix is labelled «Набор: 2 задания»', txt.slice(0, 300));

  // ---- 3) a single task keeps the plain row
  await open();
  await t.click(box('L:lcr'));
  await t.click('[data-act="assign-go"]'); await t.waitForTimeout(1300);
  rows = await t.$$('.tbl tbody tr');
  ok(rows.length === 3, 'a single task is its own plain row (3 rows in total)', String(rows.length));
  await t.screenshot({ path: OUT + '/list.png' });

  // ---- what the student got
  const mine = (await sapi('GET', '/me/assignments')).assignments;
  ok(mine.length === 6, 'student received 6 separate tasks (3 + 2 + 1)', String(mine.length));
  const reading = mine.filter(a => a.spec.setLabel === 'Весь Reading');
  ok(reading.length === 3 && reading.every(a => a.spec.mode === 'timed' && a.spec.section === 'R'), 'Reading tasks are timed and share a set');
  ok(mine.find(a => a.spec.task === 'lcr' && !a.spec.set && a.spec.mode === 'learn'), 'the single task is a plain learn-mode assignment');
  await s.goto(APP + '#/today'); await s.reload(); await s.waitForSelector('a.note', { timeout: 8000 }).catch(() => {});
  const links = await s.$$eval('a.note', as => as.map(a => a.getAttribute('href')));
  ok(['practice/ctw', 'practice/rdl', 'practice/rap', 'practice/bas', 'speak/lrp', 'listen/lcr'].every(k => links.some(l => l.includes(k))), 'student sees a tracked link for each task', links.join(' ') || (await s.textContent('#app')).replace(/\s+/g, ' ').slice(0, 300));

  // ---- delete a whole set at once
  await t.goto(APP + '#/t/assign'); await t.waitForTimeout(900);
  await t.click('tr.aset:has-text("Весь Reading") [data-act="assign-del"]'); await t.waitForTimeout(400);
  ok((await t.textContent('.sheet')).includes('исчезнут'), 'confirmation speaks about several tasks');
  await t.click('[data-act="assign-del-go"]'); await t.waitForTimeout(1200);
  rows = await t.$$('.tbl tbody tr');
  ok(rows.length === 2, 'deleting the set removes all three tasks at once', String(rows.length));
  ok((await sapi('GET', '/me/assignments')).assignments.length === 3, 'student is left with 3 tasks');

  // ---- narrow screen
  const m = await mk(375, 800);
  await m.goto(APP + '#/login'); await m.fill('#email', 'teacher@example.com'); await m.fill('#password', 'teacher-pass-1'); await m.click('button[type=submit]'); await m.waitForTimeout(1200);
  await m.goto(APP + '#/t/assign'); await m.waitForTimeout(1000);
  ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal scroll on the list at 375');
  await m.click('.hdr [data-act="assign"]'); await m.waitForSelector('input[name="a-task"]'); await m.waitForTimeout(700);
  ok(await m.evaluate(() => { const r = document.querySelector('.sheet').getBoundingClientRect(); return r.right <= innerWidth + 1 && r.height <= innerHeight; }), 'dialog fits the phone screen');
  await m.screenshot({ path: OUT + '/dialog-375.png' });

  // clean up
  for (const a of (await tapi('GET', '/teacher/assignments')).assignments || []) await tapi('DELETE', '/teacher/assignments/' + a.id);
  ok(errs.length === 0, 'no page errors', errs.join(' | '));
  await b.close();
  console.log(`\nassign e2e: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

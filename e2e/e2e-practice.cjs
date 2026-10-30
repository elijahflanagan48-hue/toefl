// E2E for Reading practice: learn (CtW, Academic Passage incl. select/insert), timed (Daily Life), mistakes, stats.
const { chromium } = require('playwright');
const fs = require('fs');
const APP = 'http://localhost:4173/', OUT = process.argv[2] || '/tmp/e2ep';
const C = '/home/claude/noeon-toefl/content/reading/';
let pass = 0, fail = 0;
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(c ? '  ✓' : '  ✗', n, c ? '' : x); };
const rap = Object.fromEntries(JSON.parse(fs.readFileSync(C + 'rap.json')).map(i => [i.id, i]));
const rdl = Object.fromEntries(JSON.parse(fs.readFileSync(C + 'rdl.json')).map(i => [i.id, i]));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { makeCtw } = await import('/home/claude/noeon-toefl/app/src/lib/ctw.js');
  const ctw = Object.fromEntries(JSON.parse(fs.readFileSync(C + 'ctw.json')).map(i => [i.id, makeCtw(i.text).parts.filter(p => p.miss).map(p => p.miss)]));
  const b = await chromium.launch();
  const errs = [];
  const mk = async (w, h) => { const c = await b.newContext({ viewport: { width: w, height: h } }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); return p; };

  // accounts
  const t = await mk(1440, 900);
  await t.goto(APP); await t.waitForTimeout(800);
  if (t.url().includes('#/setup')) { await t.fill('#name', 'Илья'); await t.fill('#email', 'teacher@example.com'); await t.fill('#password', 'teacher-pass-1'); await t.click('button[type=submit]'); await t.waitForTimeout(1200); }
  if (t.url().includes('#/login')) { await t.fill('#email', 'teacher@example.com'); await t.fill('#password', 'teacher-pass-1'); await t.click('button[type=submit]'); await t.waitForTimeout(1200); }
  await t.goto(APP + '#/profile'); await t.waitForTimeout(900);
  const code = (await t.textContent('.groups .code')).trim();
  const s = await mk(1440, 900);
  await s.goto(APP + '#/join?code=' + code); await s.waitForTimeout(700);
  await s.fill('#name', 'Анна Соколова'); await s.fill('#email', 'anna' + Date.now() + '@example.com'); await s.fill('#password', 'student-pass-1');
  await s.click('button[type=submit]'); await s.waitForTimeout(1200);

  // Train page
  await s.goto(APP + '#/train/R'); await s.waitForTimeout(1200);
  ok((await s.$$('a.btn.pri[href^="#/practice/"]')).length === 3, 'three Reading trainers are live');
  await s.screenshot({ path: OUT + '/1-train.png' });

  // ---- learn: Complete the Words
  const itemsResp = s.waitForResponse(r => r.url().includes('/items?') && r.url().includes('task=ctw'));
  await s.goto(APP + '#/practice/ctw?mode=learn');
  const ctwItems = (await (await itemsResp).json()).items;
  await s.waitForTimeout(900);
  ok(ctwItems.length === 2 && ctwItems.every(i => /^R-CTW-B-/.test(i.id)), 'CtW: 2 items at level B (first time)', ctwItems.map(i => i.id).join(','));
  for (let scr = 0; scr < 2; scr++) {
    const keys = ctw[ctwItems[scr].id];
    for (let g = 0; g < 10; g++) {
      const word = scr === 0 && g === 3 ? 'z'.repeat(keys[g].length) : keys[g];
      const bx = await s.$$(`.lb[data-q="${g}"]`);
      for (let i = 0; i < bx.length; i++) { await bx[i].focus(); await s.keyboard.type(word[i]); }
    }
    if (scr === 0) await s.screenshot({ path: OUT + '/2-ctw-filled.png' });
    await s.click('[data-act="pr-check"]'); await s.waitForTimeout(700);
    const fb = await s.textContent('.fbk');
    ok(scr === 0 ? fb.includes('9 из 10') && fb.includes('Полное слово') : fb.includes('Верно'), `CtW screen ${scr + 1} feedback`, fb);
    if (scr === 0) await s.screenshot({ path: OUT + '/3-ctw-feedback.png' });
    await s.click('[data-act="pr-next"]'); await s.waitForTimeout(800);
  }
  ok((await s.textContent('.xr-n')).replace(/\s/g, '') === '19/20', 'CtW results 19/20', await s.textContent('.xr-n'));
  await s.screenshot({ path: OUT + '/4-ctw-results.png', fullPage: true });

  // ---- learn: Academic Passage (one item = 5 questions incl. select / insert)
  const r2 = s.waitForResponse(r => r.url().includes('/items?') && r.url().includes('task=rap'));
  await s.goto(APP + '#/practice/rap?mode=learn');
  const ap = (await (await r2).json()).items[0];
  await s.waitForTimeout(900);
  const src = rap[ap.id];
  let shotSel = false, shotIns = false;
  for (let q = 0; q < 5; q++) {
    const Q = src.qs[q];
    const pick = q === 0 ? (Q.a + 1) % (Q.sel ? src.paras[Q.sel.p].length : 4) : Q.a; // first answer wrong on purpose
    if (Q.sel) await s.click(`.xsent[data-k="${pick}"]`);
    else if (Q.insert) await s.click(`.sq-ins[data-k="${pick}"]`);
    else await s.click(`.opt[data-k="${pick}"]`);
    await s.click('[data-act="pr-check"]'); await s.waitForTimeout(600);
    const fb = await s.textContent('.fbk');
    ok(q === 0 ? fb.includes('Неверно') : fb.includes('Верно'), `AP q${q + 1} (${Q.type}) feedback`, fb.slice(0, 80));
    if (q === 0) await s.screenshot({ path: OUT + '/5-ap-wrong.png' });
    if (Q.sel && !shotSel) { await s.screenshot({ path: OUT + '/6-ap-select.png' }); shotSel = true; }
    if (Q.insert && !shotIns) { await s.screenshot({ path: OUT + '/6-ap-insert.png' }); shotIns = true; }
    await s.click('[data-act="pr-next"]'); await s.waitForTimeout(600);
  }
  ok((await s.textContent('.xr-n')).replace(/\s/g, '') === '4/5', 'AP results 4/5');

  // ---- timed: Daily Life (3 items), all correct
  const r3 = s.waitForResponse(r => r.url().includes('/items?') && r.url().includes('task=rdl'));
  await s.goto(APP + '#/practice/rdl?mode=timed');
  const dl = (await (await r3).json()).items;
  await s.waitForTimeout(900);
  ok(!!(await s.$('.xtime')), 'timed mode shows a timer');
  await s.screenshot({ path: OUT + '/7-dl-timed.png' });
  const screens = dl.flatMap(it => rdl[it.id].qs.map(q => q.a));
  for (let k = 0; k < screens.length; k++) {
    await s.click(`.opt[data-k="${screens[k]}"]`);
    ok(!(await s.$('.fbk')), `timed: no feedback before finishing (screen ${k + 1})`);
    await s.click('[data-act="pr-next"]'); await s.waitForTimeout(250);
  }
  await s.click('[data-act="pr-finish"]'); await s.waitForTimeout(1500);
  const res = (await s.textContent('.xr-n')).replace(/\s/g, '');
  ok(res === `${screens.length}/${screens.length}`, 'timed results all correct', res);

  // ---- mistakes
  await s.goto(APP + '#/train/R'); await s.waitForTimeout(500);
  await s.click('[data-act="train-mode"][data-v="mistakes"]'); await s.waitForTimeout(1200);
  const note = await s.textContent('.trainmain .note');
  ok(note.includes('Ошибок к повтору: 2'), 'mistakes count = 2 (one CtW gap + one AP question)', note);
  await s.screenshot({ path: OUT + '/8-train-mistakes.png' });
  await s.goto(APP + '#/practice/mistakes?mode=mistakes'); await s.waitForTimeout(1500);
  const n = (await s.textContent('.xq-n'));
  ok(n.includes('/ 2'), 'mistakes session has 2 screens', n);
  // fix both: CtW gap 3 of first ctw item, and AP q1
  for (let k = 0; k < 2; k++) {
    if (await s.$('.lb')) {
      const key = ctw[ctwItems[0].id][3];
      const bx = await s.$$('.lb[data-q="3"]');
      for (let i = 0; i < bx.length; i++) { await bx[i].focus(); await s.keyboard.type(key[i]); }
    } else {
      const Q = src.qs[0];
      if (Q.sel) await s.click(`.xsent[data-k="${Q.a}"]`); else if (Q.insert) await s.click(`.sq-ins[data-k="${Q.a}"]`); else await s.click(`.opt[data-k="${Q.a}"]`);
    }
    await s.click('[data-act="pr-check"]'); await s.waitForTimeout(600);
    await s.click('[data-act="pr-next"]'); await s.waitForTimeout(700);
  }
  await s.goto(APP + '#/train/R'); await s.waitForTimeout(600);
  await s.goto(APP + '#/practice/mistakes?mode=mistakes'); await s.waitForTimeout(1500);
  ok((await s.textContent('.xres-hero')).includes('Ошибок для повтора нет'), 'mistakes cleared after correct retries');

  // ---- type trainer + stats
  await s.goto(APP + '#/practice/types?type=Factual&mode=learn'); await s.waitForTimeout(1500);
  ok((await s.textContent('.qt-chip')) === 'Factual', 'type trainer shows only that question type');
  await s.goto(APP + '#/progress'); await s.waitForTimeout(1500);
  ok((await s.$$('.qbars .qb')).length >= 3, 'Progress shows accuracy by question type');
  await s.screenshot({ path: OUT + '/9-progress.png', fullPage: true });
  await s.goto(APP + '#/train/R'); await s.waitForTimeout(1200);
  ok((await s.textContent('.tgrid')).includes('%'), 'Train cards show accuracy');
  await s.screenshot({ path: OUT + '/10-train-stats.png' });

  // ---- mobile layout of the player
  const m = await mk(390, 844);
  await m.goto(APP); await m.waitForTimeout(600);
  await m.click('[data-act="demo"]'); await m.waitForTimeout(600);
  await m.goto(APP + '#/practice/rap?mode=learn'); await m.waitForTimeout(1200);
  await m.click('.opt[data-k="0"]').catch(() => {});
  await m.click('[data-act="pr-check"]').catch(() => {}); await m.waitForTimeout(500);
  await m.screenshot({ path: OUT + '/11-mobile-demo-ap.png', fullPage: true });
  const ow = await m.evaluate(() => document.documentElement.scrollWidth);
  ok(ow <= 390, 'mobile: no horizontal overflow', ow);
  await m.goto(APP + '#/practice/ctw?mode=learn'); await m.waitForTimeout(1200);
  await m.screenshot({ path: OUT + '/12-mobile-demo-ctw.png', fullPage: true });
  ok((await m.evaluate(() => document.documentElement.scrollWidth)) <= 390, 'mobile CtW: no horizontal overflow');

  console.log(errs.length ? 'page errors: ' + errs.join(' | ') : 'no page errors');
  console.log(`${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();

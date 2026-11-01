// E2E: Listening player — learn mode (replay, check, explanation, transcript), timed mode (audio once, no back, per-question timer),
// teacher test-bank access, student pool restriction, results breakdown.
const { chromium } = require('playwright');
const fs = require('fs');
const APP = 'http://localhost:4173/', OUT = process.argv[2] || '/tmp/e2e-listen';
let pass = 0, fail = 0;
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(c ? '  ✓' : '  ✗', n, c ? '' : x); };
const FAKE_AUDIO = () => { // deterministic: the "recording" lasts 400 ms
  window.__plays = [];
  window.Audio = class { constructor(src) { this.src = src; window.__plays.push(src); this.duration = 0.4; this.currentTime = 0; }
    play() { setTimeout(() => this.onended && this.onended(), 400); return Promise.resolve(); } pause() {} };
};
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch(); const errs = [];
  const mk = async (w, h) => { const c = await b.newContext({ viewport: { width: w, height: h } }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.addInitScript(FAKE_AUDIO); return p; };
  const t = await mk(1280, 900);
  await t.goto(APP); await t.waitForTimeout(800);
  if (t.url().includes('#/login')) { await t.fill('#email', 'teacher@example.com'); await t.fill('#password', 'teacher-pass-1'); await t.click('button[type=submit]'); await t.waitForTimeout(1200); }

  // the L page is open now; teacher sees the test-bank row
  await t.goto(APP + '#/train/L'); await t.waitForTimeout(1200);
  let txt = await t.textContent('#app');
  ok(!txt.includes('Скоро') && txt.includes('Listen and Choose a Response'), 'Listening page: tasks are open (no «Скоро»)');
  ok(txt.includes('тест-банк'), 'teacher sees the test-bank row');
  await t.screenshot({ path: OUT + '/train.png' });

  // learn mode, conversation from the test bank
  await t.goto(APP + '#/listen/lco?mode=learn&bank=test'); await t.waitForTimeout(1500);
  ok(!!(await t.$('.ls-audio')), 'learn: audio screen with a player');
  ok(await t.evaluate(() => /audio\/L\/CONV-\d+\.mp3/.test(document.querySelector('.ls-audio').getAttribute('src'))), 'learn: player points at the conversation mp3');
  await t.screenshot({ path: OUT + '/learn-audio.png' });
  await t.click('[data-act="ls-next"]'); await t.waitForTimeout(300);
  ok(!!(await t.$('.opts .opt')) && !!(await t.$('.ls-replay .ls-audio')), 'learn: question with replay player');
  ok(!!(await t.$('[data-act="ls-check"][disabled]')), 'learn: «Проверить» disabled until answered');
  await t.keyboard.press('1'); await t.waitForTimeout(200);
  await t.click('[data-act="ls-check"]'); await t.waitForTimeout(900);
  ok(!!(await t.$('.fbk')) && !!(await t.$('.fbk .ls-tr')), 'learn: feedback with explanation and transcript');
  ok((await t.$$('.opt.ok')).length === 1, 'learn: correct option highlighted');
  await t.screenshot({ path: OUT + '/learn-fb.png' });
  await t.click('[data-act="ls-next"]'); await t.waitForTimeout(300);
  await t.keyboard.press('2'); await t.keyboard.press('Enter'); await t.waitForTimeout(800);
  await t.keyboard.press('Enter'); await t.waitForTimeout(1200); // next → second conversation audio or results
  for (let i = 0; i < 6 && !(await t.$('.practice-res')); i++) {
    if (await t.$('.ls-audio:not(.x)') && !(await t.$('.opts'))) await t.click('[data-act="ls-next"]');
    else if (await t.$('[data-act="ls-check"]')) { await t.keyboard.press('3'); await t.click('[data-act="ls-check"]'); await t.waitForTimeout(700); }
    else if (await t.$('[data-act="ls-next"]')) await t.click('[data-act="ls-next"]');
    await t.waitForTimeout(700);
  }
  ok(!!(await t.$('.practice-res')), 'learn: results screen');
  txt = await t.textContent('#app');
  ok(/\d+\s*\/\s*\d+/.test(txt) || /\d+\/\d+/.test(txt), 'results show a score');
  ok(!!(await t.$('.ls-rw')), 'results list every question with explanation');
  await t.screenshot({ path: OUT + '/results.png' });

  // timed mode, announcement from the bank: audio once, no back, no replay
  await t.goto(APP + '#/train/L'); await t.goto(APP + '#/listen/lan?mode=timed&bank=test'); await t.waitForTimeout(1500);
  ok(!!(await t.$('[data-act="ls-play"]')) && !(await t.$('audio')), 'timed: «Слушать» button, no native player');
  ok(!(await t.$('[data-act="ls-back"], [data-act="pr-back"]')), 'timed: no Back button');
  await t.click('[data-act="ls-play"]'); await t.waitForTimeout(100);
  ok(!!(await t.$('.ls-prog')) && !(await t.$('[data-act="ls-play"]')), 'timed: playing — no pause / second play');
  await t.waitForTimeout(1200);
  ok(!!(await t.$('.opts .opt')) && !(await t.$('.ls-replay')), 'timed: after the recording the first question appears without a replay player');
  ok(await t.evaluate(() => window.__plays.length === 1), 'timed: the recording was started exactly once');
  ok(!!(await t.$('.xtime')), 'timed: per-question countdown shown');
  await t.keyboard.press('2'); await t.waitForTimeout(150);
  await t.keyboard.press('Enter'); await t.waitForTimeout(400); // next question (answered)
  await t.keyboard.press('Enter'); await t.waitForTimeout(400); // skip second (unanswered) → next audio or finish
  for (let i = 0; i < 8 && !(await t.$('.practice-res')); i++) {
    if (await t.$('[data-act="ls-play"]')) { await t.click('[data-act="ls-play"]'); await t.waitForTimeout(900); }
    else { await t.keyboard.press('1'); await t.keyboard.press('Enter'); await t.waitForTimeout(500); }
  }
  ok(!!(await t.$('.practice-res')), 'timed: results screen after the last question');
  ok(!!(await t.$('.ls-rw .ls-tr')), 'timed: results include transcripts');
  await t.screenshot({ path: OUT + '/timed-results.png' });

  // student: tasks open, pool limited to released (active) items, test bank closed
  const code = await (async () => { await t.goto(APP + '#/profile'); await t.waitForTimeout(900); return (await t.textContent('.groups .code')).trim(); })();
  const s = await mk(390, 844);
  await s.goto(APP + '#/join?code=' + code); await s.waitForTimeout(700);
  await s.fill('#name', 'Лена Слушаева'); await s.fill('#email', 'l' + Date.now() + '@example.com'); await s.fill('#password', 'student-pass-1');
  await s.click('button[type=submit]'); await s.waitForTimeout(1200);
  await s.goto(APP + '#/train/L'); await s.waitForTimeout(1200);
  txt = await s.textContent('#app');
  ok(!txt.includes('тест-банк'), 'student does not see the teacher test-bank row');
  ok(await s.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal scroll at 390 on the L page');
  await s.goto(APP + '#/listen/lan?mode=learn&bank=test'); await s.waitForTimeout(1500);
  const src1 = await s.evaluate(() => document.querySelector('.ls-audio')?.getAttribute('src') || '');
  ok(/ANN-005/.test(src1), 'student with ?bank=test still only gets released items', src1);
  await s.screenshot({ path: OUT + '/student-390.png' });
  await s.goto(APP + '#/listen/lcr?mode=learn'); await s.waitForTimeout(1200);
  ok((await s.textContent('#app')).includes('Заданий пока нет'), 'student: no released LCR items → friendly empty state');

  // assignments link
  await t.goto(APP + '#/t/assign'); await t.waitForTimeout(900);
  await t.click('.hdr [data-act="assign"]'); await t.waitForTimeout(400);
  ok(await t.evaluate(() => [...document.querySelectorAll('#a-task option')].some(o => o.value === 'L:lan')), 'teacher can assign Listening tasks');
  ok(errs.length === 0, 'no page errors', errs.join(' | '));
  await b.close();
  console.log(`\nlistening e2e: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

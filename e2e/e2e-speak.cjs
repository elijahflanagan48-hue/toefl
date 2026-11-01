// E2E: Speaking trainers — mic check, Listen and Repeat (7 parts, auto-stop in timed mode, early stop in learn mode),
// Take an Interview (4 parts), background upload to R2, submit → teacher scores each part → student sees players + scores.
// Needs: API on :8787 seeded with seed/speaking.sql, site built with VITE_API_URL on :4173, teacher@example.com existing.
// Chromium fake microphone: --use-fake-device-for-media-stream --use-fake-ui-for-media-stream
const { chromium } = require('playwright');
const fs = require('fs');
const APP = 'http://localhost:4173/', OUT = process.argv[2] || '/tmp/e2e-speak';
let pass = 0, fail = 0;
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(c ? '  ✓' : '  ✗', n, c ? '' : x); };
const until = async (p, fn, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await p.evaluate(fn).catch(() => false)) return true; await p.waitForTimeout(120); } return false; };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const errs = [];
  const mk = async (w, h) => { const c = await b.newContext({ viewport: { width: w, height: h }, permissions: ['microphone'] }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); return p; };

  const t = await mk(1440, 900);
  await t.goto(APP); await t.waitForTimeout(700);
  if (t.url().includes('#/login')) { await t.fill('#email', 'teacher@example.com'); await t.fill('#password', 'teacher-pass-1'); await t.click('button[type=submit]'); await t.waitForTimeout(1200); }
  await t.goto(APP + '#/profile'); await t.waitForTimeout(900);
  const code = (await t.textContent('.groups .code')).trim();
  const s = await mk(1280, 900);
  await s.goto(APP + '#/join?code=' + code); await s.waitForTimeout(700);
  await s.fill('#name', 'Борис Говоров'); await s.fill('#email', 's' + Date.now() + '@example.com'); await s.fill('#password', 'student-pass-1');
  await s.click('button[type=submit]'); await s.waitForTimeout(1200);

  // Train → Speaking cards are live and point to the speak trainer
  await s.goto(APP + '#/train/S'); await s.waitForTimeout(1000);
  ok(!!(await s.$('a[href="#/speak/lrp?mode=learn"]')) && !!(await s.$('a[href="#/speak/int?mode=learn"]')), 'Speaking cards are live');
  ok((await s.textContent('.tgrid')).includes('ставит учитель'), 'score is teacher-given');

  // Listen and Repeat · timed: mic check → intro → first part auto-stops after 8 s
  await s.goto(APP + '#/speak/lrp?mode=timed'); await s.waitForTimeout(900);
  ok((await s.textContent('.spk-card')).includes('Проверка микрофона'), 'mic check first');
  await s.click('[data-act="s-mic"]');
  ok(await until(s, () => !!document.querySelector('[data-act="s-go"]'), 8000), 'mic granted → Continue');
  ok(await until(s, () => (document.getElementById('lvlmsg')?.textContent || '').includes('слышно'), 8000), 'level meter hears the (fake) mic');
  await s.click('[data-act="s-go"]');
  ok((await s.textContent('.spk-card')).includes('7 предложений'), 'intro explains the task');
  await s.click('[data-act="s-start"]');
  ok(await until(s, () => !!document.getElementById('tb'), 20000), 'recording phase reached after narrator, sentence, pause, beep');
  const lim = await s.textContent('#tl');
  ok(Number(lim.trim()) <= 8 && Number(lim.trim()) >= 7, 'first sentence limit is 8 s', lim);
  ok(!(await s.$('[data-act="s-stop"]')), 'no early stop in timed mode');
  ok(await until(s, () => /Предложение 2 из 7/.test(document.querySelector('.spk-card')?.textContent || ''), 15000), 'auto-advances to sentence 2 when time is up');
  await s.screenshot({ path: OUT + '/lrp-timed.png' });
  await s.click('[data-act="s-exit"]');
  await s.waitForTimeout(300);
  ok((await s.textContent('#layer')).includes('не будут отправлены'), 'leaving mid-task warns');
  await s.click('#layer a.btn.pri'); await s.waitForTimeout(600);

  // Listen and Repeat · learn: all 7 parts with early stop
  await s.goto(APP + '#/speak/lrp?mode=learn'); await s.waitForTimeout(900);
  await s.click('[data-act="s-mic"]'); await until(s, () => !!document.querySelector('[data-act="s-go"]'), 8000);
  await s.click('[data-act="s-go"]'); await s.click('[data-act="s-start"]');
  const sentences = [];
  for (let k = 0; k < 7; k++) {
    ok(await until(s, () => !!document.querySelector('[data-act="s-stop"]'), 25000), `part ${k + 1}: recording`);
    sentences.push((await s.textContent('.spk-sub')).trim());
    await s.waitForTimeout(1500);
    await s.click('[data-act="s-stop"]');
    await until(s, () => !document.querySelector('[data-act="s-stop"]'), 5000);
  }
  ok(await until(s, () => /Ответы отправлены/.test(document.querySelector('.spk-card')?.textContent || ''), 30000), 'LRP submitted');
  const lrpHref = await s.getAttribute('.spk-btns a[href^="#/work/"]', 'href');
  ok(!!lrpHref, 'link to the work');
  ok((await s.$$('.spk-list audio')).length === 7, 'seven local players');

  // Interview · learn: 4 parts
  await s.goto(APP + '#/speak/int?mode=learn'); await s.waitForTimeout(900);
  await s.click('[data-act="s-mic"]'); await until(s, () => !!document.querySelector('[data-act="s-go"]'), 8000);
  await s.click('[data-act="s-go"]'); await s.click('[data-act="s-start"]');
  for (let k = 0; k < 4; k++) {
    ok(await until(s, () => !!document.querySelector('[data-act="s-stop"]'), 30000), `question ${k + 1}: recording`);
    if (k === 0) { const l = await s.textContent('#tl'); ok(Number(l.trim()) >= 44 && Number(l.trim()) <= 45, 'interview limit 45 s', l); }
    await s.waitForTimeout(1500);
    await s.click('[data-act="s-stop"]');
    await until(s, () => !document.querySelector('[data-act="s-stop"]'), 5000);
  }
  ok(await until(s, () => /Ответы отправлены/.test(document.querySelector('.spk-card')?.textContent || ''), 30000), 'Interview submitted');
  const intHref = await s.getAttribute('.spk-btns a[href^="#/work/"]', 'href');

  // teacher: queue → review → per-part scores
  const lrpId = lrpHref.split('/').pop(), intId = intHref.split('/').pop();
  await t.goto(APP + '#/t/review/' + intId); await t.waitForTimeout(1500);
  ok((await t.$$('.audio-row')).length === 4, 'teacher sees 4 audio rows');
  ok((await t.textContent('.audios')).includes('?'), 'teacher sees the questions');
  await t.click('.audio-row audio'); // loads blob on play
  await t.waitForTimeout(800);
  for (let i = 0; i < 4; i++) await t.click(`[data-act="mini"][data-i="${i}"][data-n="4"]`);
  await t.click('[data-act="save-score"]'); await t.waitForTimeout(1200);
  await t.goto(APP + '#/t/review/' + lrpId); await t.waitForTimeout(1500);
  ok((await t.$$('.audio-row')).length === 7, 'teacher sees 7 audio rows');
  ok((await t.textContent('.audios')).includes(sentences[0].slice(0, 20)), 'teacher sees the target sentences');
  await t.keyboard.press('3'); await t.waitForTimeout(700);
  await t.fill('#rcomment', 'Хорошо слышно, следите за окончаниями.');
  await t.click('[data-act="save-score"]'); await t.waitForTimeout(1200);

  // student sees results
  await s.goto(APP + intHref); await s.waitForTimeout(1500);
  ok((await s.textContent('.wres')).includes('4'), 'student sees the interview score', await s.textContent('.g-review'));
  ok((await s.$$('audio[data-sub]')).length === 4, 'student has 4 players');
  await s.click('audio[data-sub]'); await s.waitForTimeout(600);
  await s.goto(APP + lrpHref); await s.waitForTimeout(1500);
  ok((await s.textContent('.wres')).includes('Хорошо слышно'), 'student sees the teacher comment');
  await s.screenshot({ path: OUT + '/work-lrp.png' });

  // mobile layout of the recording screen
  const m = await mk(375, 740);
  await m.goto(APP + '#/login'); await m.waitForTimeout(600);
  await m.fill('#email', 'teacher@example.com'); await m.fill('#password', 'teacher-pass-1'); await m.click('button[type=submit]'); await m.waitForTimeout(1200);
  await m.goto(APP + '#/speak/int?mode=learn'); await m.waitForTimeout(900);
  await m.click('[data-act="s-mic"]'); await until(m, () => !!document.querySelector('[data-act="s-go"]'), 8000);
  await m.click('[data-act="s-go"]'); await m.click('[data-act="s-start"]');
  await until(m, () => !!document.querySelector('[data-act="s-stop"]'), 30000);
  await m.screenshot({ path: OUT + '/int-375.png' });
  ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal scroll at 375 px');

  ok(errs.length === 0, 'no page errors', errs.join(' | '));
  await b.close();
  console.log(`\nspeaking e2e: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

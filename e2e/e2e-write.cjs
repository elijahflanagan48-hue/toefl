// E2E: Writing (Email + Academic Discussion) — editor rules, word count, draft autosave, submit → teacher review
// with a fragment comment → student sees score, criteria, comment and the marked text; timed auto-submit; mobile.
// Needs: API on :8787 seeded with seed/writing.sql, site built with VITE_API_URL on :4173, teacher@example.com existing.
const { chromium } = require('playwright');
const fs = require('fs');
const APP = 'http://localhost:4173/', OUT = process.argv[2] || '/tmp/e2e-write';
let pass = 0, fail = 0;
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(c ? '  ✓' : '  ✗', n, c ? '' : x); };
const EMAIL = `Dear Ms. Patel,

I am writing because I accidentally spilled coffee on a library book yesterday. Several pages are now stained, although the text can still be read.

Could you tell me what I should do? I am happy to pay for a replacement copy or a repair if that is the usual procedure.

Thank you for your help.
Best regards,
Anna`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch(); const errs = [];
  const mk = async (w, h) => { const c = await b.newContext({ viewport: { width: w, height: h } }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); return p; };

  // accounts: teacher exists; a new student joins with the group code
  const t = await mk(1440, 900);
  await t.goto(APP); await t.waitForTimeout(700);
  if (t.url().includes('#/login')) { await t.fill('#email', 'teacher@example.com'); await t.fill('#password', 'teacher-pass-1'); await t.click('button[type=submit]'); await t.waitForTimeout(1200); }
  await t.goto(APP + '#/profile'); await t.waitForTimeout(900);
  const code = (await t.textContent('.groups .code')).trim();
  const s = await mk(1440, 900);
  await s.goto(APP + '#/join?code=' + code); await s.waitForTimeout(700);
  await s.fill('#name', 'Анна Письмова'); await s.fill('#email', 'w' + Date.now() + '@example.com'); await s.fill('#password', 'student-pass-1');
  await s.click('button[type=submit]'); await s.waitForTimeout(1200);

  // Train → Writing
  await s.goto(APP + '#/train/W'); await s.waitForTimeout(1000);
  ok(!!(await s.$('a[href="#/write/eml?mode=learn"]')) && !!(await s.$('a[href="#/write/dsc?mode=learn"]')), 'Email and Discussion trainers are live');
  await s.click('[data-act="train-mode"][data-v="mistakes"]'); await s.waitForTimeout(600);
  ok((await s.textContent('.tgrid')).includes('проверяет учитель'), 'no mistakes mode for teacher-graded tasks');
  await s.click('[data-act="train-mode"][data-v="timed"]'); await s.waitForTimeout(600);

  // Email, timed
  await s.goto(APP + '#/write/eml?mode=timed'); await s.waitForTimeout(1500);
  const tm = await s.textContent('.xtime');
  ok(/^0[67]:\d\d$/.test(tm.trim()), 'email timer starts at 7:00', tm);
  const ta = await s.$('#wtext');
  ok((await ta.getAttribute('spellcheck')) === 'false' && (await ta.getAttribute('autocorrect')) === 'off', 'editor: no spellcheck / autocorrect');
  ok((await s.textContent('.wprompt')).includes('do the following'), 'prompt shows situation and three tasks');
  const subj = await s.textContent('.wmail');
  await s.fill('#wtext', 'Dear Ms. Patel, test');
  await s.type('#wtext', ' words');
  ok((await s.textContent('#wc')).trim() === '5', 'live word count', await s.textContent('#wc'));
  await s.click('[data-act="w-cmd"][data-c="undo"]'); await s.waitForTimeout(150);
  ok((await s.inputValue('#wtext')) !== 'Dear Ms. Patel, test words', 'Undo button works', await s.inputValue('#wtext'));
  await s.fill('#wtext', EMAIL);
  await s.waitForTimeout(200);
  await s.reload(); await s.waitForTimeout(1500);
  const sameTask = (await s.textContent('.wmail')) === subj;
  ok(sameTask ? (await s.inputValue('#wtext')) === EMAIL : true, 'draft survives reload');
  if (!sameTask || (await s.inputValue('#wtext')) !== EMAIL) await s.fill('#wtext', EMAIL);
  await s.screenshot({ path: OUT + '/1-email.png' });
  await s.click('[data-act="w-submit"]'); await s.waitForTimeout(300);
  ok((await s.textContent('.sheet')).includes('слов'), 'submit asks for confirmation with word count');
  await s.click('[data-act="w-confirm"]'); await s.waitForTimeout(1200);
  ok((await s.textContent('.xres-hero')).includes('отправлена учителю'), 'email submitted');
  await s.screenshot({ path: OUT + '/2-sent.png' });
  const workHref = await s.getAttribute('a[href^="#/work/"]', 'href');
  ok(!!workHref, 'link to the submitted work');

  // Discussion, learn mode: tips + 100-word indicator
  await s.goto(APP + '#/write/dsc?mode=learn'); await s.waitForTimeout(1500);
  ok(!!(await s.$('.wtips')) && (await s.textContent('.xb-c')).includes('без ограничения'), 'learn mode: tips, no countdown');
  ok((await s.textContent('.wprompt')).includes('100 words') && (await s.$$('.post')).length === 3, 'professor + two student posts');
  await s.fill('#wtext', 'I agree with the idea because it helps students.');
  ok((await s.textContent('#wmin')).includes('До 100 слов'), 'under-100 indicator');
  await s.fill('#wtext', Array.from({ length: 105 }, (_, i) => i % 12 === 11 ? 'idea.' : 'word').join(' '));
  ok((await s.textContent('#wmin')).includes('Есть 100'), '100+ indicator');
  await s.screenshot({ path: OUT + '/3-discussion.png' });
  await s.click('[data-act="w-submit"]'); await s.waitForTimeout(300); await s.click('[data-act="w-confirm"]'); await s.waitForTimeout(1200);

  // Progress lists both, work page pending
  await s.goto(APP + '#/progress'); await s.waitForTimeout(1200);
  ok((await s.$$('a.row[href^="#/work/"]')).length >= 2, 'progress lists submitted works with links');
  await s.goto(APP + workHref); await s.waitForTimeout(1200);
  ok((await s.textContent('.rubric')).includes('на проверке'), 'work page: pending before review');

  // Teacher review with a fragment comment
  const subId = workHref.split('/').pop();
  await t.goto(APP + '#/t/review'); await t.waitForTimeout(1200);
  await t.goto(APP + '#/t/review/' + subId); await t.waitForTimeout(1500);
  ok((await t.textContent('#mbody')).includes('spilled coffee'), 'teacher sees the email text');
  await t.evaluate(() => {
    const mb = document.getElementById('mbody'), tn = [...mb.childNodes].find(n => n.nodeType === 3 && n.textContent.includes('accidentally spilled'));
    const i = tn.textContent.indexOf('accidentally spilled'), r = document.createRange();
    r.setStart(tn, i); r.setEnd(tn, i + 'accidentally spilled'.length);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
  });
  await t.waitForTimeout(200);
  await t.click('[data-act="tool"][data-t="cm"]'); await t.waitForTimeout(300);
  await t.fill('#mnote', 'Хорошо: точное наречие.');
  await t.click('[data-act="mark-save"]'); await t.waitForTimeout(800);
  ok((await t.textContent('#mbody .mk-cm')) === 'accidentally spilled', 'fragment highlighted in review');
  // markup tools: select a phrase + hotkey (one-off), sticky tool with mouse selection, caret, eraser, undo
  const selectText = (phrase) => t.evaluate((ph) => {
    const mb = document.getElementById('mbody'), w = document.createTreeWalker(mb, NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) { const i = n.textContent.indexOf(ph); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + ph.length); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; } }
    return false;
  }, phrase);
  const before = await t.textContent('#mbody');
  await selectText('Several pages'); await t.keyboard.press('u'); await t.waitForTimeout(200);
  ok((await t.textContent('#mbody .mk-u')) === 'Several pages', 'U underlines the selection');
  await selectText(' are now stained'); await t.click('[data-act="tool"][data-t="hl-p"]'); await t.waitForTimeout(200);
  ok((await t.textContent('#mbody .mk-hl-p')) === 'are now stained', 'pink marker on selection (edge space trimmed)');
  await t.click('[data-act="tool"][data-t="x"]'); await t.waitForTimeout(150);
  ok(await t.$('.mtool.on[data-t="x"]') && (await t.textContent('.mt-hint')).includes('включён'), 'tool without selection becomes sticky');
  const box = await t.evaluate(() => { const mb = document.getElementById('mbody'), w = document.createTreeWalker(mb, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const i = n.textContent.indexOf('yesterday'); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 9); const b = r.getBoundingClientRect(); return { x1: b.left + 1, x2: b.right - 1, y: b.top + b.height / 2 }; } } });
  await t.mouse.move(box.x1, box.y); await t.mouse.down(); await t.mouse.move(box.x2, box.y, { steps: 5 }); await t.mouse.up(); await t.waitForTimeout(300);
  ok((await t.textContent('#mbody .mk-x')) === 'yesterday', 'sticky strike applies on mouse selection');
  await t.keyboard.press('Escape'); await t.waitForTimeout(100);
  ok(!(await t.$('.mtool.on')), 'Esc switches the tool off');
  await t.keyboard.press('i'); await t.waitForTimeout(100);
  const pt = await t.evaluate(() => { const mb = document.getElementById('mbody'), w = document.createTreeWalker(mb, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const i = n.textContent.indexOf('library book'); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1); const b = r.getBoundingClientRect(); return { x: b.left + 0.5, y: b.top + b.height / 2 }; } } });
  await t.mouse.click(pt.x, pt.y); await t.waitForTimeout(300);
  ok((await t.$$('#mbody .mk-ins')).length === 1, 'caret tool places ∧ at the click');
  await t.keyboard.press('Escape');
  await t.click('#mbody .mk-u'); await t.waitForTimeout(300);
  await t.fill('#mnote', 'Лучше: A few pages'); await t.click('[data-act="mark-save"]'); await t.waitForTimeout(300);
  ok((await t.$$('#mnotes .cmt')).length === 2 && (await t.textContent('#mnotes')).includes('A few pages'), 'click on a mark adds a note, numbered in the list');
  await selectText('pay for'); await t.keyboard.press('g'); await t.waitForTimeout(150);
  ok((await t.$$('#mbody .mk-hl-g')).length === 1, 'green marker');
  await t.keyboard.press('Control+z'); await t.waitForTimeout(150);
  ok((await t.$$('#mbody .mk-hl-g')).length === 0, 'Ctrl+Z undoes the last mark');
  await selectText('yesterday'); await t.keyboard.press('e'); await t.waitForTimeout(150);
  ok((await t.$$('#mbody .mk-x')).length === 0, 'eraser removes marks on the selection');
  ok((await t.textContent('#mbody')) === before, 'student text itself is unchanged by any mark');
  await t.keyboard.press('4'); await t.waitForTimeout(500);
  ok((await t.$$('details.cgrp')).length === 5 && (await t.$$('input[name=crit]')).length === 10, 'checklist: 5 groups, 10 tick-boxes for an email');
  ok((await t.$$eval('.cgq', e => e.every(x => x.textContent.trim().endsWith('?')))), 'every group has a guiding question');
  await t.check('input[name=crit][value="task.all"]'); await t.check('input[name=crit][value="org.flow"]');
  ok((await t.textContent('#chint')).includes('отмечено 2 из 10'), 'live hint counts the ticks', await t.textContent('#chint'));
  await t.click('.phb >> nth=0'); await t.click('.phb >> nth=2');
  ok((await t.inputValue('#rcomment')).split('. ').length >= 1 && (await t.inputValue('#rcomment')).includes('Хорошее начало') && (await t.inputValue('#rcomment')).includes('конкретику'), 'ready phrases are added to the comment');
  await t.keyboard.press('Escape'); await t.click('[data-act="score"][data-n="3"]'); await t.waitForTimeout(500); await t.click('[data-act="score"][data-n="4"]'); await t.waitForTimeout(500);
  ok((await t.$$('input[name=crit]:checked')).length === 2 && (await t.inputValue('#rcomment')).includes('Хорошее начало'), 'ticks and comment survive picking a score');
  await t.fill('#rcomment', 'Все пункты закрыты. Добавьте конкретную дату возврата.');
  await t.screenshot({ path: OUT + '/4-review.png' });
  await t.click('[data-act="save-score"]'); await t.waitForTimeout(1200);
  ok(t.url().endsWith('#/t/review'), 'rating saved');

  // Student sees the result
  await s.goto(APP + '#/progress'); await s.waitForTimeout(400);
  await s.goto(APP + workHref); await s.waitForTimeout(1500);
  ok((await s.textContent('.wscore')).includes('4,0'), 'student sees score 4,0');
  ok((await s.textContent('.mailbody .mk-cm')) === 'accidentally spilled' && (await s.textContent('.mailbody .mk-u')) === 'Several pages' && (await s.$$('.mailbody .mk-ins')).length === 1 && (await s.$$('.mailbody .mk-hl-p')).length === 1 && (await s.textContent('.cmts')).includes('точное наречие'), 'student sees the fragment comment');
  ok((await s.textContent('.mlegend')).includes('ошибка') && (await s.textContent('.cmts')).includes('A few pages'), 'student sees the legend and the note on the underline');
  ok((await s.$$('.critlist li.ok')).length === 2 && (await s.$$('.critlist li.no')).length === 8 && (await s.$$('.cgs')).length === 5, 'criteria ticked / not ticked, grouped as on the form');
  ok((await s.textContent('.wcomment')).includes('дату возврата'), 'teacher comment shown');
  await s.screenshot({ path: OUT + '/5-result.png', fullPage: true });

  // Timed auto-submit when time runs out (fake clock)
  const c = await b.newContext({ viewport: { width: 1280, height: 800 } }); const a = await c.newPage(); a.on('pageerror', e => errs.push(e.message));
  await c.addInitScript(tok => { localStorage.setItem('nt.token', tok); }, await s.evaluate(() => localStorage.getItem('nt.token')));
  await a.clock.install();
  await a.goto(APP + '#/write/eml?mode=timed'); await a.waitForTimeout(1500);
  await a.fill('#wtext', 'Dear Sir, I would like to ask about the job.');
  await a.clock.runFor(7 * 60 * 1000 + 2000); await a.waitForTimeout(1500);
  ok((await a.textContent('.xres-hero').catch(() => '')).includes('Время вышло'), 'auto-submit when the timer reaches 0');

  // mobile
  const mc = await b.newContext({ viewport: { width: 390, height: 844 } });
  await mc.addInitScript(tok => { localStorage.setItem('nt.token', tok); }, await s.evaluate(() => localStorage.getItem('nt.token')));
  const m = await mc.newPage(); m.on('pageerror', e => errs.push(e.message));
  await m.goto(APP + '#/write/dsc?mode=timed'); await m.waitForTimeout(1500);
  ok(!!(await m.$('#wtext')), 'mobile: editor opens');
  ok((await m.evaluate(() => document.documentElement.scrollWidth)) <= 390, 'mobile: no horizontal overflow');
  await m.screenshot({ path: OUT + '/6-mobile.png', fullPage: true });
  await m.goto(APP + workHref); await m.waitForTimeout(1200);
  ok((await m.evaluate(() => document.documentElement.scrollWidth)) <= 390, 'mobile result: no overflow');
  await m.screenshot({ path: OUT + '/7-mobile-result.png', fullPage: true });

  console.log(errs.length ? 'page errors: ' + errs.join(' | ') : 'no page errors');
  console.log(`${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail || errs.length ? 1 : 0);
})();

// E2E: Build a Sentence — tap to place, drag to a slot, remove, learn feedback, timed mode, mistakes, mobile.
// Needs: API on :8787 with seed/reading.sql + seed/writing.sql, site built with VITE_API_URL served on :4173.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const APP = 'http://localhost:4173/', OUT = process.argv[2] || '/tmp/e2e-bas';
const bank = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(__dirname, '../content/writing/bas.json'))).map(i => [i.id, i]));
let pass = 0, fail = 0;
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(c ? '  ✓' : '  ✗', n, c ? '' : x); };

async function placeAll(p, slots, { wrong = false, dragFirst = false } = {}) {
  const order = wrong ? [slots[1], slots[0], ...slots.slice(2)] : slots;
  for (let k = 0; k < order.length; k++) {
    const chip = p.locator('.pool button.chunk', { hasText: new RegExp('^' + order[k].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first();
    if (dragFirst && k === 0) {
      // drag the first chunk into slot 0 with the pointer
      const from = await chip.boundingBox(), to = await p.locator('.slot.empty').first().boundingBox();
      await p.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await p.mouse.down();
      await p.mouse.move(to.x + 10, to.y + 10, { steps: 8 }); await p.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 4 }); await p.mouse.up();
    } else await chip.click();
  }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch(); const errs = [];
  const mk = async (w, h) => { const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage(); p.on('pageerror', e => errs.push(e.message)); return p; };
  const p = await mk(1440, 900);
  await p.goto(APP); await p.waitForTimeout(900);
  if (p.url().includes('setup')) { await p.fill('#name', 'Илья'); await p.fill('#email', 't@example.com'); await p.fill('#password', 'teacher-pass-1'); await p.click('button[type=submit]'); }
  else { await p.fill('#email', 't@example.com'); await p.fill('#password', 'teacher-pass-1'); await p.click('button[type=submit]'); }
  await p.waitForTimeout(1200);

  await p.goto(APP + '#/train/W'); await p.waitForTimeout(1200);
  ok(!!(await p.$('a[href="#/practice/bas?mode=learn"]')), 'Build a Sentence trainer is live on Writing');
  await p.screenshot({ path: OUT + '/1-train-w.png' });

  // learn
  const resp = p.waitForResponse(r => r.url().includes('/items?') && r.url().includes('task=bas'));
  await p.click('a[href="#/practice/bas?mode=learn"]');
  const items = (await (await resp).json()).items;
  await p.waitForTimeout(900);
  // level=auto: B for a fresh account, moves up after correct answers (the local DB keeps earlier runs)
  ok(items.length === 10 && new Set(items.map(i => i.id.split('-')[2])).size === 1, '10 items at one adaptive level', items.map(i => i.id).join(','));
  ok(items.every(i => !('key' in i)), 'no keys sent to the browser');
  for (let n = 0; n < items.length; n++) {
    const it = bank[items[n].id];
    if (n === 0) {
      // remove and re-place: tap a chunk, tap it in the slot to send it back
      await p.locator('.pool button.chunk').first().click();
      ok((await p.$$('.slot.filled')).length === 1, 'tap places a chunk into the first empty slot');
      await p.locator('.slot.filled').first().click();
      ok((await p.$$('.slot.filled')).length === 0, 'tap on a placed chunk returns it');
      await p.screenshot({ path: OUT + '/2-empty.png' });
    }
    await placeAll(p, it.slots, { wrong: n === 1, dragFirst: n === 2 });
    if (n === 2) ok((await p.textContent('.slot.filled')).toLowerCase().startsWith(it.slots[0].toLowerCase().slice(0, 3)), 'drag and drop into a slot');
    if (n === 0) {
      const first = await p.textContent('.slot.filled');
      ok(it.parts[0] !== null || /^[A-Z]/.test(first.trim()), 'first slot is capitalised', first);
      await p.screenshot({ path: OUT + '/3-filled.png' });
    }
    await p.click('[data-act="pr-check"]'); await p.waitForTimeout(500);
    const fb = await p.textContent('.fbk');
    ok(n === 1 ? fb.includes('Неверно') && fb.includes('Правильно') : fb.includes('Верно'), `item ${n + 1} feedback`, fb.slice(0, 90));
    if (n === 1) await p.screenshot({ path: OUT + '/4-wrong.png' });
    await p.click('[data-act="pr-next"]'); await p.waitForTimeout(400);
  }
  ok((await p.textContent('.xr-n')).replace(/\s/g, '') === '9/10', 'learn results 9/10');
  await p.screenshot({ path: OUT + '/5-results.png', fullPage: true });

  // mistakes on Writing
  await p.goto(APP + '#/train/W'); await p.waitForTimeout(500);
  await p.click('[data-act="train-mode"][data-v="mistakes"]'); await p.waitForTimeout(1200);
  ok((await p.textContent('.trainmain .note')).includes('Ошибок к повтору: 1'), 'Writing mistakes = 1');
  await p.click('.trainmain .note'); await p.waitForTimeout(1500);
  const wrongId = items[1].id;
  await placeAll(p, bank[wrongId].slots);
  await p.click('[data-act="pr-check"]'); await p.waitForTimeout(500);
  ok((await p.textContent('.fbk')).includes('Верно'), 'mistake fixed');
  await p.click('[data-act="pr-next"]'); await p.waitForTimeout(800);

  // timed
  await p.click('[data-act="train-mode"][data-v="timed"]').catch(() => {});
  const r2 = p.waitForResponse(r => r.url().includes('/items?') && r.url().includes('task=bas'));
  await p.goto(APP + '#/practice/bas?mode=timed');
  const t = (await (await r2).json()).items;
  await p.waitForTimeout(800);
  ok(!!(await p.$('.xtime')), 'timed mode has a timer');
  for (let n = 0; n < t.length; n++) {
    await placeAll(p, bank[t[n].id].slots);
    ok(!(await p.$('.fbk')), `timed screen ${n + 1}: no feedback yet`);
    await p.click('[data-act="pr-next"]'); await p.waitForTimeout(200);
  }
  await p.click('[data-act="pr-finish"]'); await p.waitForTimeout(1500);
  ok((await p.textContent('.xr-n')).replace(/\s/g, '') === `${t.length}/${t.length}`, 'timed all correct');

  // mobile
  const m = await mk(390, 844);
  await m.goto(APP); await m.waitForTimeout(600);
  await m.click('[data-act="demo"]'); await m.waitForTimeout(600);
  await m.goto(APP + '#/practice/bas?mode=learn'); await m.waitForTimeout(1200);
  await m.locator('.pool button.chunk').first().click();
  await m.screenshot({ path: OUT + '/6-mobile.png', fullPage: true });
  ok((await m.evaluate(() => document.documentElement.scrollWidth)) <= 390, 'mobile: no horizontal overflow');

  console.log(errs.length ? 'page errors: ' + errs.join(' | ') : 'no page errors');
  console.log(`${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail || errs.length ? 1 : 0);
})();

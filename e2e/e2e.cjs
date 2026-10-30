// End-to-end: teacher setup → invite → student registers → exam module saved → writing submitted (API) → teacher grades → student sees grade.
// Needs: API on :8787 (fresh local DB) and the site built with VITE_API_URL=http://127.0.0.1:8787 served on :4173 (vite preview).
const { chromium } = require('playwright');
const APP = 'http://localhost:4173/', API = 'http://127.0.0.1:8787', OUT = process.argv[2] || '/tmp/e2e';
let pass = 0, fail = 0;
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(c ? '  ✓' : '  ✗', n, c ? '' : x); };

(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const errs = [];
  const mk = async (w = 1440, h = 900) => { const c = await b.newContext({ viewport: { width: w, height: h } }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); return p; };

  // teacher: first run → setup
  const t = await mk();
  await t.goto(APP); await t.waitForTimeout(800);
  ok(t.url().includes('#/setup'), 'fresh install opens first-teacher setup', t.url());
  await t.screenshot({ path: OUT + '/1-setup.png' });
  await t.fill('#name', 'Илья'); await t.fill('#email', 'teacher@example.com'); await t.fill('#password', 'teacher-pass-1');
  await t.click('button[type=submit]'); await t.waitForTimeout(1200);
  ok(t.url().includes('#/t/home'), 'teacher lands on overview', t.url());
  await t.screenshot({ path: OUT + '/2-teacher-empty.png' });
  await t.goto(APP + '#/profile'); await t.waitForTimeout(900);
  const code = (await t.textContent('.groups .code')).trim();
  ok(/^NT-[A-Z0-9]{4}$/.test(code), 'invite code shown in profile: ' + code);
  await t.screenshot({ path: OUT + '/3-teacher-profile.png' });

  // student registers via invite link
  const s = await mk(390, 844);
  await s.goto(APP + '#/join?code=' + code); await s.waitForTimeout(800);
  ok((await s.inputValue('#code')) === code, 'invite link pre-fills the code');
  await s.screenshot({ path: OUT + '/4-join.png' });
  await s.fill('#name', 'Анна Соколова'); await s.fill('#email', 'anna@example.com'); await s.fill('#password', 'student-pass-1');
  await s.click('button[type=submit]'); await s.waitForTimeout(1200);
  ok(s.url().includes('#/today'), 'student lands on Today', s.url());
  await s.screenshot({ path: OUT + '/5-student-today-empty.png', fullPage: true });
  ok((await s.textContent('.hfoot')).includes('Прогноз появится'), 'empty forecast message');

  // student sets target + exam date
  await s.goto(APP + '#/profile'); await s.waitForTimeout(800);
  await s.click('[data-act="target"][data-d="0.5"]'); await s.waitForTimeout(600);
  await s.fill('#examdate', '2026-12-12'); await s.dispatchEvent('#examdate', 'change'); await s.waitForTimeout(600);

  // student does the Reading demo module
  await s.goto(APP + '#/exam/reading'); await s.waitForTimeout(1000);
  const ans = ['lyp', 'rd', 'f', 'onate', 'er', 'ations', 'etons', 'rge', 'efs', 'lter'];
  for (let n = 1; n <= 10; n++) { const bx = await s.$$(`.lb[data-n="${n}"]`); for (let i = 0; i < bx.length; i++) { await bx[i].focus(); await s.keyboard.type(ans[n - 1][i]); } }
  await s.click('[data-act="x-next"]'); await s.click('.opt[data-i="1"]');
  await s.click('[data-act="x-next"]'); await s.click('.opt[data-i="2"]');
  await s.click('[data-act="x-next"]'); await s.click('.opt[data-i="1"]');
  await s.click('[data-act="x-next"]'); await s.click('.opt[data-i="2"]');
  await s.click('[data-act="x-next"]'); await s.click('.xsent[data-i="2"]');
  await s.click('[data-act="x-next"]'); await s.click('.opt[data-i="2"]');
  await s.click('[data-act="x-next"]'); await s.click('.opt[data-i="1"]');
  await s.click('[data-act="x-next"]'); await s.click('[data-act="x-finish"]'); await s.waitForTimeout(1500);
  const res = await s.textContent('.xres-hero');
  ok(res.includes('17') && res.includes('решение принял сервер') && res.includes('трудный'), 'module saved; server routed to upper', res.slice(0, 200));
  await s.screenshot({ path: OUT + '/6-exam-result.png', fullPage: true });

  // student token → submit a Writing email through the API (Writing UI comes in P6)
  const token = await s.evaluate(() => localStorage.getItem('nt.token'));
  const r = await fetch(API + '/submissions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ section: 'W', task: 'eml', text: 'Dear Dr. Patel,\n\nI am writing because I cannot attend your office hours on Thursday.\n\nBest regards,\nAnna',
      prompt: { to: 'Dr. Patel', subject: 'Office hours', situation: 'You have a conflict with office hours.', bullets: ['Explain why', 'Describe the topic', 'Suggest a time'] } }) });
  ok(r.ok, 'student writing submitted');

  await s.goto(APP + '#/today'); await s.waitForTimeout(1000);
  const hf = await s.textContent('.hfoot');
  ok(hf.includes('прогноз 6,0'), 'Today shows forecast from the saved module', hf);
  await s.screenshot({ path: OUT + '/7-student-today.png', fullPage: true });

  // teacher sees student + queue, grades
  await t.goto(APP + '#/t/home'); await t.waitForTimeout(1200);
  ok((await t.textContent('.heatmap')).includes('Анна Соколова'), 'teacher table lists the student');
  await t.screenshot({ path: OUT + '/8-teacher-home.png' });
  await t.goto(APP + '#/t/review'); await t.waitForTimeout(1000);
  await t.click('.qlist .row'); await t.waitForTimeout(1200);
  ok((await t.textContent('.mailbody')).includes('Dear Dr. Patel'), 'teacher opens the email');
  await t.keyboard.press('4'); await t.waitForTimeout(500);
  await t.fill('#rcomment', 'Все три пункта раскрыты. Добавь деталей.');
  await t.screenshot({ path: OUT + '/9-teacher-review.png' });
  await t.click('[data-act="save-score"]'); await t.waitForTimeout(1200);
  ok(t.url().endsWith('#/t/review'), 'after saving goes back to queue');
  ok((await t.textContent('.app')).includes('Нечего проверять'), 'queue is empty after grading');

  // student sees the grade
  await s.goto(APP + '#/progress'); await s.waitForTimeout(1200);
  const prog = await s.textContent('.app');
  ok(prog.includes('Write an Email') && prog.includes('4,0'), 'student sees graded email in Progress');
  await s.screenshot({ path: OUT + '/10-student-progress.png', fullPage: true });

  // logout → login
  await s.goto(APP + '#/profile'); await s.waitForTimeout(800);
  await s.click('[data-act="logout"]'); await s.waitForTimeout(800);
  ok(s.url().includes('#/login'), 'logout → login screen');
  await s.fill('#email', 'anna@example.com'); await s.fill('#password', 'student-pass-1');
  await s.click('button[type=submit]'); await s.waitForTimeout(1200);
  ok(s.url().includes('#/today'), 'login works');

  // demo mode from login screen
  const d = await mk();
  await d.goto(APP); await d.waitForTimeout(800);
  await d.screenshot({ path: OUT + '/11-login.png' });
  await d.click('[data-act="demo"]'); await d.waitForTimeout(900);
  ok((await d.textContent('.app')).includes('Привет, Аня'), 'demo mode shows sample data');

  console.log(errs.length ? 'page errors: ' + errs.join(' | ') : 'no page errors');
  console.log(`${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();

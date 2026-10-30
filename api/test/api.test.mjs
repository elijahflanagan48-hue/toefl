// Integration tests against a running Worker (default: wrangler dev on :8787 with a fresh local D1).
// Run: npm run migrate:local && npm run dev   (other terminal)   then   npm test
const BASE = process.env.API || 'http://127.0.0.1:8787';
let pass = 0, fail = 0;
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra); } };

async function call(method, path, { token, json, raw, type } = {}) {
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  let bodyx;
  if (json !== undefined) { headers['Content-Type'] = 'application/json'; bodyx = JSON.stringify(json); }
  if (raw !== undefined) { headers['Content-Type'] = type; bodyx = raw; }
  const r = await fetch(BASE + path, { method, headers, body: bodyx });
  const ct = r.headers.get('Content-Type') || '';
  const data = ct.includes('json') ? await r.json() : await r.arrayBuffer();
  return { status: r.status, data, headers: r.headers };
}

const tag = Date.now().toString(36);
console.log('API', BASE);

// --- setup & auth
let r = await call('GET', '/health');
ok(r.status === 200 && r.data.ok, 'health');
r = await call('GET', '/auth/status');
const fresh = r.data.needs_setup;
ok(typeof fresh === 'boolean', 'auth/status');

let T, code;
if (fresh) {
  r = await call('POST', '/auth/setup', { json: { name: 'Илья', email: `t-${tag}@x.io`, password: 'teacher-pass-1' } });
  ok(r.status === 200 && r.data.user.role === 'admin' && r.data.group.code.startsWith('NT-'), 'setup creates admin teacher + group');
  T = r.data.token; code = r.data.group.code;
  r = await call('POST', '/auth/setup', { json: { name: 'X', email: `x-${tag}@x.io`, password: 'whatever-123' } });
  ok(r.status === 403, 'setup closed after first user');
} else { console.log('  (db not fresh — run against a clean local D1)'); process.exit(1); }

r = await call('POST', '/auth/register', { json: { name: 'Аня', email: `a-${tag}@x.io`, password: 'short', code } });
ok(r.status === 400 && r.data.error === 'weak_password', 'weak password rejected');
r = await call('POST', '/auth/register', { json: { name: 'Аня', email: `a-${tag}@x.io`, password: 'student-pass-1', code: 'NT-ZZZZ' } });
ok(r.status === 400 && r.data.error === 'bad_code', 'bad invite code rejected');
r = await call('POST', '/auth/register', { json: { name: 'Аня', email: `A-${tag}@X.io`, password: 'student-pass-1', code: code.toLowerCase() } });
ok(r.status === 200 && r.data.user.role === 'student', 'student registers by invite code (case-insensitive)');
const S = r.data.token, sid = r.data.user.id;
r = await call('POST', '/auth/register', { json: { name: 'Аня2', email: `a-${tag}@x.io`, password: 'student-pass-1', code } });
ok(r.status === 400 && r.data.error === 'email_taken', 'duplicate email rejected');

r = await call('POST', '/auth/login', { json: { email: `a-${tag}@x.io`, password: 'wrong-pass-1' } });
ok(r.status === 401, 'wrong password → 401');
r = await call('POST', '/auth/login', { json: { email: `a-${tag}@x.io`, password: 'student-pass-1' } });
ok(r.status === 200 && r.data.token, 'login');
const S2 = r.data.token;

r = await call('GET', '/me', { token: S });
ok(r.status === 200 && r.data.teacher.name === 'Илья', 'me shows teacher');
r = await call('GET', '/me');
ok(r.status === 401, 'me without token → 401');
r = await call('PATCH', '/me', { token: S, json: { target: 5, exam_date: '2026-12-12' } });
ok(r.status === 200 && r.data.user.target === 5, 'update target/exam date');
r = await call('PATCH', '/me', { token: S, json: { target: 5.3 } });
ok(r.status === 400, 'target must be a .5 step');

// --- permissions
r = await call('GET', '/teacher/students', { token: S });
ok(r.status === 403, 'student cannot open teacher endpoints');
r = await call('GET', '/teacher/students', { token: T });
ok(r.status === 200 && r.data.students.length === 1, 'teacher sees own student');

// --- attempt with demo content + MST routing
r = await call('POST', '/attempts', { token: S, json: { kind: 'module', mode: 'exam', section: 'R' } });
ok(r.status === 200 && r.data.threshold === 0.6, 'attempt created with default threshold');
const att = r.data.id;
const resp = Array.from({ length: 10 }, (_, i) => ({ q: i, module: 1, qtype: 'ctw', answer: 'x', correct: i < 7 }));
resp.push({ q: 10, module: 1, qtype: 'Factual', answer: 1, correct: false, scored: false }); // pretest slot
r = await call('POST', `/attempts/${att}/responses`, { token: S, json: { responses: resp } });
ok(r.status === 200 && r.data.saved === 11, 'responses saved');
r = await call('POST', `/attempts/${att}/responses`, { token: S2, json: { responses: [{ q: 0, correct: 1 }] } });
ok(r.status === 200, 'second session of same user can write');
r = await call('POST', `/attempts/${att}/route`, { token: S, json: {} });
ok(r.data.route === 'upper' && r.data.of === 10 && r.data.got === 7, 'route: 7/10 scored ≥ 60% → upper (pretest ignored)', JSON.stringify(r.data));
r = await call('POST', `/attempts/${att}/route`, { token: T, json: {} });
ok(r.status === 404, 'teacher cannot route a student attempt');
r = await call('POST', `/attempts/${att}/finish`, { token: S });
ok(r.status === 200 && r.data.raw.R.got === 7 && r.data.bands.R === 4.5, 'finish → R raw 7/10 → scaled 25/35 → band 4.5', JSON.stringify(r.data));

// --- teacher threshold setting
r = await call('PUT', '/teacher/settings', { token: T, json: { route_threshold: 0.75 } });
ok(r.status === 200 && r.data.settings.route_threshold === 0.75, 'teacher sets threshold');
r = await call('POST', '/attempts', { token: S, json: { kind: 'module', mode: 'exam', section: 'R' } });
ok(r.data.threshold === 0.75, 'new attempts use teacher threshold');
const att2 = r.data.id;
await call('POST', `/attempts/${att2}/responses`, { token: S, json: { responses: resp.slice(0, 10) } });
r = await call('POST', `/attempts/${att2}/route`, { token: S, json: { section: 'R' } });
ok(r.data.route === 'lower', '7/10 < 75% → lower');

// --- item bank: import, server-side grading, key hidden
r = await call('POST', '/teacher/items', { token: T, json: { items: [
  { id: 'T-RDL-1', section: 'R', task: 'rdl', level: 'B', body: { text: 'Notice', qs: [{ stem: 'Q1', opts: ['a', 'b', 'c', 'd'] }, { stem: 'Q2', opts: ['a', 'b', 'c', 'd'] }] }, key: [1, 2], explain: ['потому что…', '…'], qtypes: ['Factual', 'Inference'] },
  { id: 'T-CTW-1', section: 'R', task: 'ctw', level: 'B', body: { text: '...' }, key: ['lyp', 'rd'] }
] } });
ok(r.status === 200 && r.data.imported === 2, 'teacher imports items');
r = await call('POST', '/teacher/items', { token: T, json: { items: [{ id: 'BAD', section: 'R', task: 'eml', level: 'Z', body: {} }] } });
ok(r.status === 400 && r.data.details?.[0]?.fields.includes('task'), 'invalid items rejected with details');
r = await call('POST', '/teacher/items', { token: S, json: { items: [] } });
ok(r.status === 403, 'student cannot import items');
r = await call('GET', '/items?section=R&task=rdl', { token: S });
ok(r.status === 200 && r.data.items.length === 1 && !('key' in r.data.items[0]), 'items listed without key');
r = await call('POST', '/items/T-RDL-1/check', { token: S, json: { q: 1, answer: 2 } });
ok(r.data.correct === 1 && r.data.key === 2, 'learn-mode check reveals key after answer');
r = await call('POST', '/attempts', { token: S, json: { kind: 'practice', mode: 'timed', section: 'R', task: 'rdl' } });
const att3 = r.data.id;
r = await call('POST', `/attempts/${att3}/responses`, { token: S, json: { responses: [
  { item_id: 'T-RDL-1', q: 0, answer: 1, correct: false }, // server ignores client "correct" when it has a key
  { item_id: 'T-RDL-1', q: 1, answer: 0 },
  { item_id: 'T-CTW-1', q: 0, answer: 'LYP' }
] } });
ok(r.data.graded === 3, 'server grades bank items');
r = await call('GET', `/attempts/${att3}`, { token: S });
const cs = r.data.responses.map(x => x.correct).join('');
ok(cs === '101', 'grades: right, wrong, CtW case-insensitive', cs);
r = await call('POST', `/attempts/${att3}/finish`, { token: S });
ok(r.data.raw.R.got === 2 && r.data.raw.R.of === 3, 'finish counts bank items');
r = await call('GET', `/attempts/${att3}`, { token: T });
ok(r.status === 200, 'teacher can view student attempt');

// --- submissions: writing
r = await call('POST', '/submissions', { token: S, json: { section: 'W', task: 'eml', text: 'Dear Dr. Patel, I cannot come on Thursday.', prompt: { to: 'Dr. Patel' } } });
ok(r.status === 200 && r.data.status === 'pending', 'writing submission is pending at once');
const wsub = r.data.id;
r = await call('POST', '/submissions', { token: S, json: { section: 'W', task: 'int', text: 'x' } });
ok(r.status === 400, 'task must match section');

// --- submissions: speaking + audio
r = await call('POST', '/submissions', { token: S, json: { section: 'S', task: 'int', parts: 4, prompt: { scenario: 'city' } } });
ok(r.data.status === 'draft', 'speaking submission starts as draft');
const ssub = r.data.id;
r = await call('POST', `/submissions/${ssub}/submit`, { token: S });
ok(r.status === 400 && r.data.error === 'no_audio', 'cannot submit speaking without audio');
const fake = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4, 5, 6, 7, 8]);
r = await call('PUT', `/submissions/${ssub}/audio/0`, { token: S, raw: fake, type: 'audio/webm' });
ok(r.status === 200 && r.data.bytes === 12, 'audio part uploaded to R2');
r = await call('PUT', `/submissions/${ssub}/audio/9`, { token: S, raw: fake, type: 'audio/webm' });
ok(r.status === 400, 'part index checked');
r = await call('PUT', `/submissions/${ssub}/audio/1`, { token: S, raw: fake, type: 'text/plain' });
ok(r.status === 400 && r.data.error === 'bad_audio_type', 'non-audio rejected');
r = await call('PUT', `/submissions/${ssub}/audio/1`, { token: T, raw: fake, type: 'audio/webm' });
ok(r.status === 404, 'teacher cannot upload into student work');
r = await call('POST', `/submissions/${ssub}/submit`, { token: S });
ok(r.data.status === 'pending', 'speaking submitted');
r = await call('PUT', `/submissions/${ssub}/audio/1`, { token: S, raw: fake, type: 'audio/webm' });
ok(r.status === 400 && r.data.error === 'locked', 'no uploads after submit');

// --- teacher queue & rating
r = await call('GET', '/teacher/queue', { token: T });
ok(r.status === 200 && r.data.queue.length === 2, 'teacher queue has 2 works');
r = await call('GET', '/teacher/queue?section=S', { token: T });
ok(r.data.queue.length === 1 && r.data.queue[0].task === 'int', 'queue filter by section');
r = await call('GET', `/submissions/${ssub}/audio/0`, { token: T });
ok(r.status === 200 && new Uint8Array(r.data).length === 12 && r.headers.get('Content-Type') === 'audio/webm', 'teacher streams audio');
r = await call('POST', `/teacher/submissions/${wsub}/rating`, { token: T, json: { score: 4, criteria: { p1: true }, comment: 'Хорошо' } });
ok(r.status === 200 && r.data.score === 4, 'teacher rates writing');
r = await call('POST', `/teacher/submissions/${ssub}/rating`, { token: T, json: { parts: [4, 3, 4, 3] } });
ok(r.status === 200 && r.data.score === 3.5, 'speaking score = mean of parts');
r = await call('POST', `/teacher/submissions/${wsub}/rating`, { token: S, json: { score: 5 } });
ok(r.status === 403, 'student cannot rate');
r = await call('GET', '/me/submissions', { token: S });
ok(r.data.submissions.every(x => x.status === 'graded') && r.data.submissions.find(x => x.id === wsub).score === 4, 'student sees grades');
r = await call('GET', `/submissions/${wsub}`, { token: S });
ok(r.data.ratings[0].comment === 'Хорошо', 'student sees comment');

// --- summary
r = await call('GET', '/me/summary', { token: S });
ok(r.status === 200 && r.data.forecast.R != null && r.data.forecast.W === 4.5 && r.data.forecast.S === 4 && r.data.streak >= 1,
  'summary: forecast R + W (4/5=80% → 4.5) + S (3.5/5=70% → 4) + streak', JSON.stringify(r.data.forecast));

// --- reset password
r = await call('POST', `/teacher/students/${sid}/reset-password`, { token: T });
ok(r.status === 200 && r.data.temp_password.length >= 10, 'teacher resets student password');
const temp = r.data.temp_password;
r = await call('GET', '/me', { token: S });
ok(r.status === 401, 'old sessions revoked after reset');
r = await call('POST', '/auth/login', { json: { email: `a-${tag}@x.io`, password: temp } });
ok(r.status === 200 && r.data.user.must_reset === true, 'login with temp password → must_reset');
const S3 = r.data.token;
r = await call('POST', '/auth/password', { token: S3, json: { old: temp, new: 'new-student-pass' } });
ok(r.status === 200, 'student sets new password');

// --- groups & assignments
r = await call('POST', '/teacher/groups', { token: T, json: { name: 'TOEFL · осень' } });
ok(r.status === 200 && r.data.group.code !== code, 'new group with its own code');
const g2 = r.data.group;
r = await call('PATCH', `/teacher/groups/${g2.id}`, { token: T, json: { active: false } });
r = await call('POST', '/auth/register', { json: { name: 'Б', email: `b-${tag}@x.io`, password: 'student-pass-2', code: g2.code } });
ok(r.status === 400, 'inactive group code rejected');
r = await call('POST', '/teacher/assignments', { token: T, json: { title: 'Пробник Reading', spec: { kind: 'module', section: 'R', mode: 'exam' }, student_id: sid, due_at: Date.now() + 864e5 } });
ok(r.status === 200, 'assignment created');
r = await call('GET', '/me/assignments', { token: S3 });
ok(r.data.assignments.length === 1 && r.data.assignments[0].teacher_name === 'Илья', 'student sees assignment');

// --- CORS
const pre = await fetch(BASE + '/me', { method: 'OPTIONS', headers: { Origin: 'https://elijahflanagan48-hue.github.io' } });
ok(pre.status === 204 && pre.headers.get('Access-Control-Allow-Origin') === 'https://elijahflanagan48-hue.github.io', 'CORS preflight for Pages origin');
const pre2 = await fetch(BASE + '/me', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } });
ok(!pre2.headers.get('Access-Control-Allow-Origin'), 'other origins get no CORS header');

r = await call('POST', '/auth/logout', { token: S3 });
r = await call('GET', '/me', { token: S3 });
ok(r.status === 401, 'logout revokes token');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

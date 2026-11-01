// API-level access rules: mocks open only by teacher assignment; reserved items never revealed to students.
const API = process.env.API || 'http://127.0.0.1:8787';
let pass = 0, fail = 0;
const ok = (c, m, x) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m + (c ? '' : ' ' + (x ?? ''))); };
const call = async (m, p, tok, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: b ? JSON.stringify(b) : undefined }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
(async () => {
  const t = (await call('POST', '/auth/login', null, { email: 'teacher@example.com', password: 'teacher-pass-1' })).j.token;
  const gs = (await call('GET', '/teacher/groups', t)).j.groups; const code = gs[0].code;
  const em = 's' + Date.now() + '@example.com';
  const reg = (await call('POST', '/auth/register', null, { email: em, name: 'Access Test', password: 'student-pass-1', code })).j;
  const s = reg.token, sid = reg.user.id;
  let r = await call('GET', '/mocks', s); ok(r.s === 200 && r.j.mocks.length === 0, 'student sees no mocks before assignment', JSON.stringify(r));
  r = await call('GET', '/mocks/T1/part?part=R:M1', s); ok(r.s === 403, 'student cannot read mock items without assignment', r.s);
  r = await call('POST', '/attempts', s, { kind: 'mock', mode: 'exam', task: 'T1' }); ok(r.s === 403, 'student cannot start a mock without assignment', r.s);
  r = await call('GET', '/mocks', t); ok(r.j.mocks.length >= 3, 'teacher sees all mocks');
  // reserved items never revealed to a student in a learn attempt
  const mp = (await call('GET', '/mocks/T1/part?part=R:M1', t)).j.items; const itemId = mp[0].id;
  const la = (await call('POST', '/attempts', s, { kind: 'practice', mode: 'learn', section: 'R', task: 'ctw' })).j.id;
  r = await call('POST', `/attempts/${la}/responses`, s, { responses: [{ item_id: itemId, q: 0, answer: 'x' }] });
  ok(r.s === 200 && !(r.j.results || []).length, 'student gets no key/explanation for a mock-reserved item', JSON.stringify(r.j).slice(0, 200));
  const act = (await call('GET', '/items?section=R&task=ctw', s)).j; ok((act.items || []).every(i => !mp.some(m => m.id === i.id)), 'practice pool excludes mock items');
  // assignment opens it
  const a1 = (await call('POST', '/teacher/assignments', t, { title: 'Полный пробник 1', student_id: sid, spec: { section: 'M', task: 'T1' } })).j.id;
  r = await call('GET', '/mocks', s); ok(r.j.mocks.length === 1 && r.j.mocks[0].id === 'T1' && r.j.mocks[0].assignment_id === a1, 'assigned mock appears for the student', JSON.stringify(r.j));
  r = await call('GET', '/mocks/T2/part?part=R:M1', s); ok(r.s === 403, 'other mocks stay closed', r.s);
  r = await call('GET', '/mocks/T1/part?part=R:M1', s); ok(r.s === 200 && r.j.items.length > 0, 'assigned mock items readable');
  r = await call('POST', '/attempts', s, { kind: 'mock', mode: 'exam', task: 'T2', assignment_id: a1 }); ok(r.s === 403, 'assignment for T1 does not open T2', r.s);
  r = await call('POST', '/attempts', s, { kind: 'mock', mode: 'exam', task: 'T1', assignment_id: a1 }); ok(r.s === 200 && r.j.id, 'student starts the assigned mock', JSON.stringify(r));
  const aid = r.j.id; r = await call('POST', `/attempts/${aid}/finish`, s); ok(r.s === 200, 'finish', r.s);
  r = await call('POST', '/attempts', s, { kind: 'mock', mode: 'exam', task: 'T1', assignment_id: a1 }); ok(r.s === 400, 'finished mock cannot be repeated without a new assignment', r.s);
  r = await call('GET', '/mocks', s); ok(r.j.mocks[0].done === true, 'mock marked done');
  const a2 = (await call('POST', '/teacher/assignments', t, { title: 'Полный пробник 1', student_id: sid, spec: { section: 'M', task: 'T1' } })).j.id;
  r = await call('POST', '/attempts', s, { kind: 'mock', mode: 'exam', task: 'T1', assignment_id: a2 }); ok(r.s === 200, 'a new assignment allows a retake', r.s);
  await call('DELETE', '/teacher/assignments/' + a1, t); await call('DELETE', '/teacher/assignments/' + a2, t);
  console.log(`\naccess e2e: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();

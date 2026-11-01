// Calibration: simulated students answer 14 Listening items with known difficulties; the estimates must find the planted problems.
const API = process.env.API || 'http://127.0.0.1:8787';
let pass = 0, fail = 0;
const ok = (c, m, x) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m + (c ? '' : ' ' + (x ?? ''))); };
const call = async (m, p, tok, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: b ? JSON.stringify(b) : undefined }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
let seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const norm = () => { let s = 0; for (let i = 0; i < 6; i++) s += rnd(); return (s - 3) * Math.SQRT2; };
(async () => {
  const t = (await call('POST', '/auth/login', null, { email: 'teacher@example.com', password: 'teacher-pass-1' })).j.token;
  const code = (await call('GET', '/teacher/groups', t)).j.groups[0].code;
  const list = (await call('GET', '/teacher/items?section=L&task=lcr&status=active&limit=300', t)).j.items;
  const pick = lv => list.filter(i => i.level === lv && i.n === 0).slice(0, 5);
  const items = [...pick('A'), ...pick('B'), ...pick('C')].slice(0, 14);
  ok(items.length === 14, 'enough fresh LCR items for the simulation', items.length);
  const full = []; for (const it of items) full.push((await call('GET', '/teacher/items/' + it.id, t)).j.item);
  // true difficulty by plan: first A item is really hard (+2), first C item really easy (-2), one item has a bad key
  const trueB = full.map(i => ({ A: -1, B: 0, C: 1 }[i.level]));
  const iHard = full.findIndex(i => i.level === 'A'), iEasy = full.findIndex(i => i.level === 'C'), iBad = full.findIndex((i, k) => i.level === 'B' && k !== iHard && k !== iEasy);
  trueB[iHard] = 2; trueB[iEasy] = -2;
  const NS = 48;
  for (let s = 0; s < NS; s++) {
    const reg = (await call('POST', '/auth/register', null, { email: `cal${Date.now()}${s}@example.com`, name: 'Cal ' + s, password: 'student-pass-1', code })).j;
    const theta = norm() * 1.1;
    const at = (await call('POST', '/attempts', reg.token, { kind: 'practice', mode: 'learn', section: 'L', task: 'lcr' })).j.id;
    const responses = full.map((it, k) => {
      const key = it.key[0];
      let pc = 1 / (1 + Math.exp(-(theta - trueB[k])));
      if (k === iBad) pc = 1 - pc;                    // strong students pick a wrong option: the key looks wrong
      const right = rnd() < pc;
      return { item_id: it.id, q: 0, section: 'L', answer: right ? key : (key + 1 + Math.floor(rnd() * 3)) % 4 };
    });
    await call('POST', `/attempts/${at}/responses`, reg.token, { responses });
    await call('POST', `/attempts/${at}/finish`, reg.token);
  }
  let r = await call('GET', '/teacher/calibration?task=lcr', t);
  ok(r.s === 200 && r.j.min_n === 30, 'calibration endpoint answers');
  const by = Object.fromEntries(r.j.items.map(x => [x.id, x]));
  const H = by[full[iHard].id], E = by[full[iEasy].id], B = by[full[iBad].id];
  ok(H && H.n === NS && H.rec === 'C' && H.level === 'A', 'authored A but really hard → recommended C', JSON.stringify(H));
  ok(E && E.rec === 'A' && E.level === 'C', 'authored C but really easy → recommended A', JSON.stringify(E));
  ok(B && (B.flags.includes('inverted') || B.flags.includes('key?') || B.flags.includes('weak')), 'item with a wrong-looking key is flagged', JSON.stringify(B));
  const normal = full.map((x, k) => by[x.id]).filter((x, k) => k !== iHard && k !== iEasy && k !== iBad);
  ok(normal.filter(x => x.disc > 0.15).length >= normal.length * 0.7, 'ordinary items discriminate (point-biserial > 0.15)', normal.map(x => x.disc).join(','));
  ok(r.j.to_move >= 2 && r.j.ready >= 14, 'summary counts the items ready and to move', JSON.stringify({ ready: r.j.ready, to_move: r.j.to_move }));
  // apply for the two items only
  r = await call('POST', '/teacher/calibration/apply', t, { ids: [H.id, E.id] });
  ok(r.j.updated === 2 && r.j.moved === 2, 'apply moves exactly the chosen items', JSON.stringify(r.j));
  const after = (await call('GET', '/teacher/items/' + H.id, t)).j.item;
  ok(after.level === 'C' && after.b != null && after.b > 0.5, 'level and b stored on the item', JSON.stringify({ l: after.level, b: after.b }));
  const bad = await call('POST', '/teacher/calibration/apply', null, { all: true }); ok(bad.s === 401 || bad.s === 403, 'apply needs a teacher', bad.s);
  console.log(`\ncalibration e2e: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();

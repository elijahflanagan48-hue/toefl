// Item calibration from student responses (pure functions, no I/O).
// Method (Wright & Stone "PROX"-style, enough for a few dozen students per item):
//   person ability  θ = logit of the person's share correct over the section (first attempts only)
//   item difficulty b = logit of the item's share wrong + mean θ of the people who answered it
//   discrimination  r = point-biserial between the response and the person's share correct on the rest of the section
// Levels: b < -0.5 → A, b > +0.5 → C, otherwise B (the bank was seeded A ≈ -1, B ≈ 0, C ≈ +1).

export const MIN_N = 30;
const logit = p => Math.log(p / (1 - p));
const clip = (p, e = 0.02) => Math.min(1 - e, Math.max(e, p));
export const levelOfB = b => (b < -0.5 ? 'A' : b > 0.5 ? 'C' : 'B');

/** rows: [{ u, item, q, c, a }] first response of each person to each question (c = 1/0, a = raw answer) */
export function calibrate(rows, items, minN = MIN_N) {
  const bySec = new Map();                       // section → person → {n, c}
  const sec = new Map(items.map(i => [i.id, i.section]));
  for (const r of rows) {
    const s = sec.get(r.item); if (!s) continue;
    const m = bySec.get(s) || bySec.set(s, new Map()).get(s);
    const p = m.get(r.u) || m.set(r.u, { n: 0, c: 0 }).get(r.u);
    p.n++; p.c += r.c;
  }
  const per = new Map();                          // item → rows
  for (const r of rows) (per.get(r.item) || per.set(r.item, []).get(r.item)).push(r);
  const out = [];
  for (const it of items) {
    const rs = per.get(it.id) || [];
    const n = rs.length, users = new Set(rs.map(r => r.u)).size;
    const res = { id: it.id, section: it.section, task: it.task, level: it.level, status: it.status, n, users };
    if (!n) { out.push({ ...res, p: null, b: null, rec: null, disc: null, flags: [] }); continue; }
    const p = rs.reduce((t, r) => t + r.c, 0) / n;
    res.p = p;
    const pm = bySec.get(it.section);
    // ability of each respondent without this item's own responses
    const own = new Map();
    for (const r of rs) { const o = own.get(r.u) || own.set(r.u, { n: 0, c: 0 }).get(r.u); o.n++; o.c += r.c; }
    const xs = [], ys = [];
    for (const r of rs) {
      const t = pm.get(r.u), o = own.get(r.u), rest = t.n - o.n;
      if (rest < 8) continue;                      // too little other evidence about this person
      xs.push(r.c); ys.push((t.c - o.c) / rest);
    }
    const mean = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
    const theta = ys.length ? mean(ys.map(v => logit(clip((v * 20 + 0.5) / 21)))) : 0;
    res.b = Math.round((logit(clip(1 - p, 0.03)) + theta) * 100) / 100;
    res.rec = n >= minN ? levelOfB(res.b) : null;
    // point-biserial
    let disc = null;
    if (xs.length >= minN) {
      const mx = mean(xs), my = mean(ys);
      let sxy = 0, sxx = 0, syy = 0;
      for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
      disc = sxx && syy ? Math.round(sxy / Math.sqrt(sxx * syy) * 100) / 100 : 0;
    }
    res.disc = disc;
    const flags = [];
    if (n >= minN) {
      if (p > 0.9) flags.push('easy'); else if (p < 0.2) flags.push('hard');
      if (disc != null && disc < 0.15) flags.push(disc < 0 ? 'inverted' : 'weak');
      if (it.key && ['rdl', 'rap', 'lcr', 'lco', 'lan', 'lat'].includes(it.task) && ys.length >= minN) {
        // is a wrong option more popular with the strongest third than the key?
        const abil = new Map(); for (const r of rs) { const t = pm.get(r.u), o = own.get(r.u), rest = t.n - o.n; if (rest >= 8) abil.set(r.u, (t.c - o.c) / rest); }
        const sorted = [...abil.values()].sort((a, b) => b - a), cut = sorted[Math.floor(sorted.length / 3)] ?? 1;
        const top = rs.filter(r => (abil.get(r.u) ?? -1) >= cut && r.a != null);
        const cnt = new Map(); for (const r of top) { const k = r.q + ':' + r.a; cnt.set(k, (cnt.get(k) || 0) + 1); }
        const keyOf = q => (Array.isArray(it.key) ? it.key[q] : it.key);
        for (const q of new Set(top.map(r => r.q))) {
          const kc = cnt.get(q + ':' + keyOf(q)) || 0;
          for (const [k, v] of cnt) if (k.startsWith(q + ':') && k !== q + ':' + keyOf(q) && v > kc && v >= 5) { flags.push('key?'); break; }
          if (flags.includes('key?')) break;
        }
      }
    }
    out.push({ ...res, flags });
  }
  return out;
}

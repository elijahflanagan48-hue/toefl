// API client. Base URL comes from the build (VITE_API_URL). Without it the app runs in demo mode.
// The session token lives in localStorage (guarded): the API is on another site, so no cookies.

import { pref } from './store.js';

export const API_URL = (import.meta.env && import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const hasApi = () => !!API_URL;

let token = null;
try { token = localStorage.getItem('nt.token'); } catch (e) {}
export const session = {
  get token() { return token; },
  set(t) { token = t; try { t ? localStorage.setItem('nt.token', t) : localStorage.removeItem('nt.token'); } catch (e) {} if (!t) dropStore(); },
  user: null
};

/** demo mode: no API configured, or the visitor chose "посмотреть демо" */
export const isDemo = () => !hasApi() || pref.get('demo', false) === true;
export const isLive = () => !isDemo() && !!session.token;

export class ApiError extends Error {
  constructor(status, code, message) { super(message || code); this.status = status; this.code = code; }
}

/* Fallback addresses for reads: if the main address is blocked or slow for a provider, another route may work. */
const ALT = API_URL.includes('toefl-data.noeon.org') ? ['https://toefl-api.noeon.org'] : [];

async function once(base, method, path, h, body, ms) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(base + path, { method, headers: h, body, signal: ctl.signal }); }
  finally { clearTimeout(timer); }
}

export async function api(method, path, data, { raw, type, headers = {} } = {}) {
  if (method !== 'GET') { dropCache(); dropStore(); }
  const h = { ...headers };
  if (session.token) h.Authorization = 'Bearer ' + session.token;
  let body;
  if (raw !== undefined) { h['Content-Type'] = type; body = raw; }
  else if (data !== undefined) { h['Content-Type'] = 'application/json'; body = JSON.stringify(data); }
  let r, dead = false;
  if (method === 'GET') {
    // reads are safe to repeat: 8 s on the main address, again on it, then on the spare one
    const tries = [[API_URL, 8000], [API_URL, 12000], ...ALT.map(u => [u, 10000])];
    for (const [base, ms] of tries) {
      try { r = await once(base, method, path, h, body, ms); break; } catch (e) { dead = true; }
    }
  } else {
    // writes are never repeated (a second try could save twice): 15 s, 60 s for audio uploads
    try { r = await once(API_URL, method, path, h, body, raw !== undefined ? 60000 : 15000); }
    catch (e) { dead = true; if (e && e.name === 'AbortError') throw new ApiError(0, 'offline', 'Сервер не отвечает. Проверьте интернет и попробуйте ещё раз'); }
  }
  if (!r) throw new ApiError(0, 'offline', dead ? 'Нет связи с сервером' : 'Ошибка');
  const ct = r.headers.get('Content-Type') || '';
  const out = ct.includes('json') ? await r.json().catch(() => ({})) : r;
  if (!r.ok) {
    if (r.status === 401 && path !== '/auth/login') { session.set(null); session.user = null; dropStore(); }
    throw new ApiError(r.status, out.error || 'error', out.message || 'Ошибка');
  }
  return out;
}

/* Last good answers are kept on the phone. On a slow network a screen opens at once from them (after 0.6 s of waiting)
   and refreshes itself when the real answer arrives. Any write or sign-out clears them, so nothing stale survives an action. */
const PFX = 'nt.c:', STALE_MS = 600, MAX_AGE = 3 * 864e5;
const pkey = p => PFX + (session.token || '').slice(-8) + ':' + p;
function dropStore() { try { Object.keys(localStorage).filter(k => k.startsWith(PFX)).forEach(k => localStorage.removeItem(k)); } catch (e) {} }
const pread = p => { try { const x = JSON.parse(localStorage.getItem(pkey(p))); return x && Date.now() - x.t < MAX_AGE ? x : null; } catch (e) { return null; } };
function pwrite(p, v) { try { const j = JSON.stringify({ t: Date.now(), v }); if (j.length < 250000) localStorage.setItem(pkey(p), j); } catch (e) {} }

/* GET cache: identical requests within 3 s share one answer (and one in-flight request), so switching between sections is instant
   and the nav can warm the data on touch-down. Any write clears everything, so screens never show stale results after an action. */
const cache = new Map(), TTL = 3000;
const clone = v => { try { return structuredClone(v); } catch (e) { return JSON.parse(JSON.stringify(v)); } };
export const dropCache = () => cache.clear();
export function get(p) {
  let ent = cache.get(p);
  if (!(ent && Date.now() - ent.t < TTL)) {
    const old = session.token ? pread(p) : null;
    ent = { t: Date.now(), old, done: false, shown: false };
    ent.p = api('GET', p).then(v => {
      ent.done = true;
      if (!(v instanceof Response)) {
        const same = old && JSON.stringify(old.v) === JSON.stringify(v);
        pwrite(p, v);
        if (old && !same && ent.shown) setTimeout(() => window.dispatchEvent(new Event('nt-fresh')), 0);
      }
      return v;
    });
    const e = ent;
    cache.set(p, e);
    e.p.then(v => { if (v instanceof Response) cache.delete(p); }, () => { if (cache.get(p) === e) cache.delete(p); });
  }
  // a second caller sharing a request that is still in flight gets the saved answer after the same short wait
  let out = ent.p;
  if (ent.old && !ent.done) { const e = ent; out = Promise.race([e.p, new Promise(res => setTimeout(() => { if (!e.done) { e.shown = true; res(e.old.v); } }, Math.max(0, STALE_MS - (Date.now() - e.t))))]); }
  return out.then(v => (v instanceof Response ? v : clone(v)));
}
const write = (m, p, d) => api(m, p, d);
export const post = (p, d = {}) => write('POST', p, d);
export const patch = (p, d) => write('PATCH', p, d);
export const put = (p, d) => write('PUT', p, d);

/** load the current user once per page load (or after login) */
export async function loadMe(force = false) {
  if (!isLive()) return null;
  if (session.user && !force) return session.user;
  const r = await get('/me');
  session.user = { ...r.user, teacher: r.teacher, group: r.group };
  return session.user;
}

/** authenticated audio URL → object URL for <audio> */
export async function audioUrl(subId, part) {
  const r = await api('GET', `/submissions/${subId}/audio/${part}`);
  return URL.createObjectURL(await r.blob());
}

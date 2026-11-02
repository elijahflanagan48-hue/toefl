// API client. Base URL comes from the build (VITE_API_URL). Without it the app runs in demo mode.
// The session token lives in localStorage (guarded): the API is on another site, so no cookies.

import { pref } from './store.js';

export const API_URL = (import.meta.env && import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const hasApi = () => !!API_URL;

let token = null;
try { token = localStorage.getItem('nt.token'); } catch (e) {}
export const session = {
  get token() { return token; },
  set(t) { token = t; try { t ? localStorage.setItem('nt.token', t) : localStorage.removeItem('nt.token'); } catch (e) {} },
  user: null
};

/** demo mode: no API configured, or the visitor chose "посмотреть демо" */
export const isDemo = () => !hasApi() || pref.get('demo', false) === true;
export const isLive = () => !isDemo() && !!session.token;

export class ApiError extends Error {
  constructor(status, code, message) { super(message || code); this.status = status; this.code = code; }
}

export async function api(method, path, data, { raw, type, headers = {} } = {}) {
  if (method !== 'GET') dropCache();
  const h = { ...headers };
  if (session.token) h.Authorization = 'Bearer ' + session.token;
  let body;
  if (raw !== undefined) { h['Content-Type'] = type; body = raw; }
  else if (data !== undefined) { h['Content-Type'] = 'application/json'; body = JSON.stringify(data); }
  let r;
  try { r = await fetch(API_URL + path, { method, headers: h, body }); }
  catch (e) { throw new ApiError(0, 'offline', 'Нет связи с сервером'); }
  const ct = r.headers.get('Content-Type') || '';
  const out = ct.includes('json') ? await r.json().catch(() => ({})) : r;
  if (!r.ok) {
    if (r.status === 401 && path !== '/auth/login') { session.set(null); session.user = null; }
    throw new ApiError(r.status, out.error || 'error', out.message || 'Ошибка');
  }
  return out;
}

/* GET cache: identical requests within 3 s share one answer (and one in-flight request), so switching between sections is instant
   and the nav can warm the data on touch-down. Any write clears everything, so screens never show stale results after an action. */
const cache = new Map(), TTL = 3000;
const clone = v => { try { return structuredClone(v); } catch (e) { return JSON.parse(JSON.stringify(v)); } };
export const dropCache = () => cache.clear();
export function get(p) {
  const hit = cache.get(p);
  if (hit && Date.now() - hit.t < TTL) return hit.p.then(clone);
  const pr = api('GET', p);
  const ent = { t: Date.now(), p: pr };
  cache.set(p, ent);
  pr.then(v => { if (v instanceof Response) cache.delete(p); }, () => { if (cache.get(p) === ent) cache.delete(p); });
  return pr.then(v => (v instanceof Response ? v : clone(v)));
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

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

export const get = p => api('GET', p);
export const post = (p, d = {}) => api('POST', p, d);
export const patch = (p, d) => api('PATCH', p, d);
export const put = (p, d) => api('PUT', p, d);

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

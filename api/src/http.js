// Small HTTP helpers: JSON responses, typed errors, CORS.

export class HttpError extends Error {
  constructor(status, code, message) { super(message || code); this.status = status; this.code = code; }
}
export const bad = (code, msg) => new HttpError(400, code, msg);
export const unauthorized = () => new HttpError(401, 'unauthorized', 'Нужно войти');
export const forbidden = () => new HttpError(403, 'forbidden', 'Нет доступа');
export const notFound = (what = 'not_found') => new HttpError(404, what, 'Не найдено');

export function corsHeaders(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const h = {
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-Duration-Ms',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
  if (origin && allowed.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

export const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...extra } });

export async function body(req) {
  const t = req.headers.get('Content-Type') || '';
  if (!t.includes('application/json')) throw bad('json_expected', 'Ожидался JSON');
  try { return await req.json(); } catch { throw bad('bad_json', 'Некорректный JSON'); }
}

/** read a string field with limits */
export function str(o, k, { min = 0, max = 200, required = true } = {}) {
  const v = o?.[k];
  if (v == null || v === '') { if (required) throw bad('missing_' + k, `Не заполнено поле ${k}`); return null; }
  if (typeof v !== 'string') throw bad('bad_' + k);
  const s = v.trim();
  if (s.length < min || s.length > max) throw bad('bad_' + k, `Поле ${k}: от ${min} до ${max} символов`);
  return s;
}
export function num(o, k, { min = -Infinity, max = Infinity, required = true } = {}) {
  const v = o?.[k];
  if (v == null) { if (required) throw bad('missing_' + k); return null; }
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw bad('bad_' + k);
  return n;
}
export const now = () => Date.now();
export const parse = s => { try { return s == null ? null : JSON.parse(s); } catch { return null; } };

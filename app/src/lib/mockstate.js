// State of a full mock test in progress (kept per browser tab). No imports on purpose: data/source.js reads it too.
const KEY = 'nt.mockflow';
export const getFlow = () => { try { return JSON.parse(sessionStorage.getItem(KEY)); } catch (e) { return null; } };
export const putFlow = f => { try { f ? sessionStorage.setItem(KEY, JSON.stringify(f)) : sessionStorage.removeItem(KEY); } catch (e) { /* private mode */ } };
/** the running mock when the current page was opened by the mock runner (?mock=1) */
export const activeFlow = () => (/[?&]mock=1(&|$)/.test(location.hash) ? getFlow() : null);
export const mockAttemptId = () => activeFlow()?.attempt ?? null;

// Per-device preferences only (theme, prototype role, last screen). Never progress data:
// that lives on the server (D1) from stage P2 on. Every access is guarded — storage can throw.
const K = 'nt.';
export const pref = {
  get(key, def) { try { const v = localStorage.getItem(K + key); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
  set(key, val) { try { localStorage.setItem(K + key, JSON.stringify(val)); } catch (e) { /* private mode etc. */ } }
};

export function applyTheme(mode = pref.get('themeMode', 'auto')) {
  const dark = mode === 'dark' || (mode === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  try { localStorage.setItem('nt.theme', mode); } catch (e) {}
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.content = dark ? '#070b16' : '#16213f';
}

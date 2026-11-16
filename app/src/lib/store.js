// Per-device preferences only (theme, prototype role, last screen). Never progress data:
// that lives on the server (D1) from stage P2 on. Every access is guarded — storage can throw.
const K = 'nt.';
export const pref = {
  get(key, def) { try { const v = localStorage.getItem(K + key); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
  set(key, val) { try { localStorage.setItem(K + key, JSON.stringify(val)); } catch (e) { /* private mode etc. */ } }
};

/* day themes: grey (default «Светлая»), white, ink (dark hero card), paper; night: oled (default «Чёрная»), blue, graphite */
export const DAY_THEMES = [['grey', 'Светлая', '#f3f5fa', '#fde8e2'], ['white', 'Белая', '#ffffff', '#fde8e2'], ['ink', 'Чернильная', '#f3f5fa', '#16213f'], ['paper', 'Бумага', '#f6f1e7', '#fde8e2']];
export const NIGHT_THEMES = [['oled', 'Чёрная', '#000000', '#19191c'], ['blue', 'Синяя', '#0b1020', '#1b2340'], ['graphite', 'Графит', '#121316', '#24272e']];
export function applyTheme(mode = pref.get('themeMode', 'auto')) {
  const dark = mode === 'dark' || (mode === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  const day = pref.get('themeDay', 'grey'), night = pref.get('themeNight', 'oled');
  const h = document.documentElement;
  h.dataset.theme = dark ? 'dark' : 'light';
  if (day === 'grey') delete h.dataset.day; else h.dataset.day = day;
  if (night === 'oled') delete h.dataset.night; else h.dataset.night = night;
  try { localStorage.setItem('nt.theme', mode); } catch (e) {}
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.content = dark ? (NIGHT_THEMES.find(t => t[0] === night) || NIGHT_THEMES[0])[2] : (DAY_THEMES.find(t => t[0] === day) || DAY_THEMES[0])[2];
}

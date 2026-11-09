import { ic, mark } from './lib/icons.js';
import { actions, role, closeModal, toast } from './lib/ui.js';
import { pref, applyTheme } from './lib/store.js';
import { hasApi, isDemo, isLive, session, loadMe, post } from './lib/api.js';
import { me as demoMe, teacher as demoTeacher, queue as demoQueue } from './data/mock.js';

import today from './views/today.js';
import train from './views/train.js';
import mock, { mockNext, mockResult } from './views/mock.js';
import progress from './views/progress.js';
import profile from './views/profile.js';
import { home as tHome, studentsView, reviewList, reviewItem, content } from './views/teacher.js';
import examReading from './views/exam-reading.js';
import practice from './views/practice.js';
import write from './views/write.js';
import work from './views/work.js';
import speak from './views/speak.js';
import listen from './views/listen.js';
import { studentLog } from './views/slog.js';
import { studentCard, assignView, bankView, assignResults, calibrationView } from './views/tcab.js';
import { login, join, setup, password } from './views/auth.js';

/* ---------- routes ---------- */
const ROUTES = {
  today, train, mock, progress, profile,
  't/home': tHome, 't/students': studentsView, 't/review': reviewList, 't/content': content, 't/assign': assignView, 't/bank': bankView, 't/calibration': calibrationView,
  'exam/reading': examReading, 'mock/next': mockNext,
  login, join, setup, password
};
const PUBLIC = new Set(['login', 'join', 'setup']);
const PARAM_ROUTES = [['mock/result/', mockResult], ['train/', train], ['t/review/', reviewItem], ['practice/', practice], ['write/', write], ['speak/', speak], ['listen/', listen], ['t/student/', params => (params[1] === 'log' || params[1] === 'attempt' ? studentLog(params) : studentCard(params))], ['t/assign/', assignResults], ['work/', work]];

const NAV = {
  student: [['today', 'today', 'Сегодня'], ['train', 'layers', 'Тренировка'], ['mock', 'timer', 'Пробник'], ['progress', 'trend', 'Прогресс'], ['profile', 'user', 'Профиль']],
  teacher: [['t/home', 'grid', 'Обзор'], ['t/students', 'users', 'Ученики'], ['t/review', 'inbox', 'Проверка'], ['train', 'layers', 'Тренировка'], ['mock', 'timer', 'Пробник'], ['t/content', 'db', 'Контент'], ['profile', 'user', 'Профиль']]
};

function resolve(path) {
  if (ROUTES[path]) return [ROUTES[path], []];
  for (const [pre, fn] of PARAM_ROUTES) if (path.startsWith(pre)) return [fn, path.slice(pre.length).split('/')];
  return null;
}

/** role for navigation: real role when signed in, prototype switch in demo */
export const navRole = () => (isLive() && session.user ? (session.user.role === 'student' ? 'student' : 'teacher') : role());
const home = () => (navRole() === 'teacher' ? 't/home' : 'today');

let current = null, seq = 0, lastPath = null;

function renderNav(path) {
  const r = navRole(), items = NAV[r];
  const active = items.find(([p]) => path === p || path.startsWith(p + '/'))?.[0] || (path.startsWith('practice') || path.startsWith('write') || path.startsWith('speak') || path.startsWith('listen') ? 'train' : path.startsWith('work') ? 'progress' : items[0][0]);
  const u = isLive() ? session.user : null;
  const name = u ? u.name : r === 'teacher' ? demoTeacher.name : demoMe.full;
  const reviewCnt = r === 'teacher' && !u ? demoQueue.length : 0;
  document.getElementById('pill').classList.toggle('many', items.length > 5);
  const pill = document.getElementById('pill'), key = r + ':' + items.length;
  if (pill.dataset.key !== key) { // build the tabs once per role; afterwards only switch the active one so the pill animates instead of flashing
    pill.dataset.key = key;
    pill.innerHTML = items.map(([p, i, l]) => `<a class="tab" href="#/${p}" data-p="${p}" aria-label="${l}">${ic(i, 22)}<span class="tl">${l}</span></a>`).join('');
  }
  pill.querySelectorAll('.tab').forEach(a => { const on = a.dataset.p === active; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  document.getElementById('rail').innerHTML = `
    <div class="brand"><span class="mk">${mark(24)}</span><b>NOEON TOEFL</b></div>
    <nav class="nav">${items.map(([p, i, l]) => `<a class="tab ${p === active ? 'on' : ''}" href="#/${p}">${ic(i, 21)}${l}${p === 't/review' && reviewCnt ? `<span class="cnt">${reviewCnt}</span>` : ''}</a>`).join('')}</nav>
    <div class="foot">
      ${isDemo() && hasApi() ? `<a class="railcta" href="#/login">${ic('user', 19)}<div><b>Демо-режим</b><span>войти в аккаунт</span></div></a>`
        : r === 'student' ? `<a class="railcta" href="#/exam/reading">${ic('timer', 19)}<div><b>Модуль Reading</b><span>экзаменационная оболочка</span></div></a>` : ''}
      <div class="who"><span class="av">${(name || '?')[0]}</span><div><b>${name}</b><span>${r === 'teacher' ? 'учитель' : 'ученик'}</span></div></div>
    </div>`;
}

async function route() {
  const my = ++seq;
  let path = (location.hash.replace(/^#\/?/, '').split('?')[0] || '').replace(/\/$/, '');

  // auth gate: with an API configured, everything except the sign-in screens needs a session (or demo mode)
  if (hasApi() && !isDemo()) {
    if (session.token && !session.user) { try { await loadMe(); } catch (e) { /* token expired → falls through */ } }
    if (!isLive() && !PUBLIC.has(path)) { location.replace('#/login'); return; }
    if (isLive() && session.user?.must_reset && path !== 'password') { location.replace('#/password'); return; }
    if (isLive() && PUBLIC.has(path)) { location.replace('#/' + home()); return; }
  }
  if (!path) path = home();
  const hit = resolve(path);
  if (!hit) { location.replace('#/' + home()); return; }
  const [fn, params] = hit;

  if (current && current.unmount) current.unmount();
  closeModal();
  const app = document.getElementById('app');
  let view, skelT = 0;
  try {
    view = fn(params);
    if (view && typeof view.then === 'function') {
      // keep the old screen until the data arrives; show the skeleton only if it takes noticeably long
      if (!route.soft) skelT = setTimeout(() => { if (my === seq) app.innerHTML = '<div class="skel"></div><div class="skel"></div>'; }, 260);
      view = await view;
    }
    clearTimeout(skelT);
  } catch (e) {
    clearTimeout(skelT);
    if (e.status === 401) { location.replace('#/login'); return; }
    view = { title: 'Ошибка', html: `<div class="empty"><b>Не получилось загрузить</b>${e.message || ''}<br><br><button class="btn" data-act="retry">Повторить</button></div>` };
  }
  if (my !== seq) return; // a newer navigation won
  current = view;

  const commit = () => {
    document.body.classList.toggle('examing', !!view.exam);
    document.body.classList.toggle('authing', !!view.auth);
    document.getElementById('pill').classList.toggle('hide', !!view.exam || !!view.auth);
    if (!view.exam && !view.auth) renderNav(path);

    app.className = 'app' + (view.wide ? ' wide' : '');
    if (view.html != null) app.innerHTML = view.html;
    if (view.mount) view.mount(app);
    document.title = (view.title ? view.title + ' · ' : '') + 'NOEON TOEFL';
    if (!route.soft) window.scrollTo(0, 0);
  };
  const calm = matchMedia('(prefers-reduced-motion:reduce)').matches;
  if (!route.soft && !calm && document.startViewTransition && lastPath !== null) {
    // the browser cross-fades old and new screens on the compositor: no layout flash, no dropped frames
    try { document.startViewTransition(commit); } catch (e) { commit(); }
  } else {
    commit();
    if (!route.soft && !calm) { app.classList.remove('viewin'); void app.offsetWidth; app.classList.add('viewin'); setTimeout(() => app.classList.remove('viewin'), 320); }
  }
  lastPath = path;
}

/* warm the data the moment a finger touches a tab, ~100 ms before the click fires */
const warm = e => {
  const a = e.target.closest && e.target.closest('#pill .tab, #rail .tab'); if (!a) return;
  const path = (a.getAttribute('href') || '').replace(/^#\/?/, '');
  const hit = path && resolve(path); if (!hit) return;
  try { const v = hit[0](hit[1]); if (v && v.then) v.catch(() => {}); } catch (e) {}
};
document.addEventListener('pointerdown', warm, { passive: true });

/* re-render on hashchange; same-path re-renders (state toggles) keep scroll and skip the animation */
let lastHash = location.hash;
window.addEventListener('hashchange', async () => {
  route.soft = location.hash === lastHash;
  const y = window.scrollY;
  lastHash = location.hash;
  await route();
  if (route.soft) window.scrollTo(0, y);
  route.soft = false;
});
export const rerender = () => window.dispatchEvent(new Event('hashchange'));

/* ---------- event delegation ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const name = el.dataset.act;
  if (name === 'modal-close-bg') { if (e.target === el) closeModal(); return; }
  if (name === 'modal-close') { closeModal(); return; }
  if (name === 'retry') { rerender(); return; }
  if (name === 'theme-toggle') {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    pref.set('themeMode', next); applyTheme(next); rerender(); return;
  }
  if (name === 'notif') { location.hash = '#/progress'; return; }
  if (name === 'logout') {
    (async () => {
      if (isLive()) { try { await post('/auth/logout'); } catch (e) {} }
      session.set(null); session.user = null; pref.set('demo', false);
      location.hash = '#/login'; rerender();
    })();
    return;
  }
  const fn = actions[name];
  if (fn) { e.preventDefault(); fn(el, e); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.querySelector('.scrim')) { closeModal(); return; }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"][data-act]')) { e.preventDefault(); e.target.click(); return; }
  if (current && current.keys) current.keys(e);
});
document.addEventListener('input', e => {
  if (e.target.dataset.actInput === 'filter-students') {
    const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll('.scard').forEach(c => { c.hidden = q && !c.dataset.name.includes(q); });
  }
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (pref.get('themeMode', 'auto') === 'auto') { applyTheme('auto'); rerender(); }
});
window.addEventListener('nt-toast', e => toast(e.detail));

applyTheme(pref.get('themeMode', 'auto'));
route();

/* installable app: offline shell via the service worker; the install prompt is kept for the profile page */
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); window.__installEvt = e; });
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => { try { navigator.serviceWorker.register('./sw.js').catch(() => {}); } catch (e) {} });
}

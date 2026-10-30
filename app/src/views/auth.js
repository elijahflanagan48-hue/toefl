// Sign-in screens: login, join by invite code, first-teacher setup, password change.
import { ic, mark } from '../lib/icons.js';
import { esc } from '../lib/util.js';
import { on, toast } from '../lib/ui.js';
import { post, get, session, loadMe, hasApi } from '../lib/api.js';
import { pref } from '../lib/store.js';

const shell = (title, sub, form, foot = '') => `<div class="auth">
  <div class="auth-card">
    <div class="auth-brand"><span class="mk">${mark(26)}</span><div><b>NOEON TOEFL</b><span>Beyond Knowing</span></div></div>
    <h1 class="serif">${title}</h1>${sub ? `<p class="mut">${sub}</p>` : ''}
    <form class="auth-form" novalidate>${form}<p class="auth-err" role="alert"></p></form>
    ${foot}
  </div>
  <aside class="auth-side on-hero"><div class="as-in">
    <div class="as-k">TOEFL iBT · формат 2026</div>
    <p class="serif">Reading, Writing и Speaking — как на экзамене: адаптивные модули, таймеры, шкала 1–6.</p>
    <div class="as-scale">${[1, 2, 3, 4, 5, 6].map(n => `<i style="height:${18 + n * 12}px" class="${n >= 5 ? 'g' : ''}"></i>`).join('')}</div>
  </div></aside>
</div>`;

const field = (id, label, type = 'text', attrs = '') =>
  `<div class="field"><label for="${id}">${label}</label><input class="inp" id="${id}" name="${id}" type="${type}" ${attrs}></div>`;

async function submitForm(form, fn) {
  const btn = form.querySelector('button[type=submit]'), err = form.querySelector('.auth-err');
  err.textContent = ''; btn.disabled = true;
  try { await fn(Object.fromEntries(new FormData(form))); }
  catch (e) { err.textContent = e.message || 'Ошибка'; }
  finally { btn.disabled = false; }
}

async function signedIn(r) {
  session.set(r.token); session.user = null;
  pref.set('demo', false);
  const u = await loadMe(true);
  if (u.must_reset) { location.hash = '#/password'; return; }
  location.hash = u.role === 'student' ? '#/today' : '#/t/home';
}

on('demo', () => { pref.set('demo', true); location.hash = '#/today'; window.dispatchEvent(new Event('hashchange')); });

function bindForm(root, fn) {
  const f = root.querySelector('form');
  f.addEventListener('submit', e => { e.preventDefault(); submitForm(f, fn); });
}

const demoLink = `<button class="btn ghost block" data-act="demo">${ic('play', 16)} Посмотреть демо без входа</button>`;

export function login() {
  return {
    auth: true, title: 'Вход',
    html: shell('Вход', '', `${field('email', 'Email', 'email', 'autocomplete="email" required')}
      ${field('password', 'Пароль', 'password', 'autocomplete="current-password" required')}
      <button class="btn pri block" type="submit">Войти</button>`,
    `<div class="auth-foot"><a href="#/join">${ic('link', 16)} У меня есть код приглашения</a>${demoLink}</div>`),
    async mount(root) {
      try { const s = await get('/auth/status'); if (s.needs_setup) { location.replace('#/setup'); return; } } catch (e) { /* offline: stay */ }
      bindForm(root, async d => signedIn(await post('/auth/login', { email: d.email, password: d.password })));
    }
  };
}

export function join() {
  return {
    auth: true, title: 'Регистрация',
    html: shell('Регистрация', 'Код приглашения даёт учитель. С ним вы сразу попадёте в его группу.',
      `${field('code', 'Код приглашения', 'text', 'placeholder="NT-XXXX" autocapitalize="characters" required')}
      ${field('name', 'Имя и фамилия', 'text', 'autocomplete="name" required')}
      ${field('email', 'Email', 'email', 'autocomplete="email" required')}
      ${field('password', 'Пароль · минимум 8 символов', 'password', 'autocomplete="new-password" minlength="8" required')}
      <button class="btn pri block" type="submit">Создать аккаунт</button>`,
      `<div class="auth-foot"><a href="#/login">${ic('left', 16)} Уже есть аккаунт</a></div>`),
    mount(root) {
      const c = new URLSearchParams(location.hash.split('?')[1] || '').get('code');
      if (c) root.querySelector('#code').value = c;
      bindForm(root, async d => signedIn(await post('/auth/register', d)));
    }
  };
}

export function setup() {
  return {
    auth: true, title: 'Первый запуск',
    html: shell('Аккаунт учителя', 'Это первый вход в приложение: этот аккаунт станет главным (учитель и администратор). Потом регистрация открыта только по кодам приглашения.',
      `${field('name', 'Имя', 'text', 'autocomplete="name" required')}
      ${field('email', 'Email', 'email', 'autocomplete="email" required')}
      ${field('password', 'Пароль · минимум 8 символов', 'password', 'autocomplete="new-password" minlength="8" required')}
      <button class="btn pri block" type="submit">Создать</button>`),
    mount(root) { bindForm(root, async d => signedIn(await post('/auth/setup', d))); }
  };
}

export function password() {
  const forced = session.user?.must_reset;
  return {
    auth: true, title: 'Пароль',
    html: shell(forced ? 'Новый пароль' : 'Смена пароля', forced ? 'Учитель выдал временный пароль. Придумайте свой.' : '',
      `${field('old', forced ? 'Временный пароль' : 'Текущий пароль', 'password', 'autocomplete="current-password" required')}
      ${field('new', 'Новый пароль · минимум 8 символов', 'password', 'autocomplete="new-password" minlength="8" required')}
      <button class="btn pri block" type="submit">Сохранить</button>`,
      forced ? '' : `<div class="auth-foot"><a href="#/profile">${ic('left', 16)} Назад</a></div>`),
    mount(root) {
      bindForm(root, async d => {
        await post('/auth/password', { old: d.old, new: d.new });
        await loadMe(true); toast('Пароль сохранён');
        location.hash = session.user.role === 'student' ? '#/today' : '#/t/home';
      });
    }
  };
}

export const authAvailable = hasApi;
export { esc };

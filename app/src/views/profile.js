import { me as demoMe, teacher as demoTeacher } from '../data/mock.js';
import * as src from '../data/source.js';
import { isLive, isDemo, hasApi, session, loadMe } from '../lib/api.js';
import { ic } from '../lib/icons.js';
import { band, cefr, esc } from '../lib/util.js';
import { hdr, on, toast, role, modal, closeModal } from '../lib/ui.js';
import { pref, applyTheme } from '../lib/store.js';

const rerender = () => window.dispatchEvent(new Event('hashchange'));
const inviteLink = code => location.href.split('#')[0] + '#/join?code=' + encodeURIComponent(code);

const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function installBlock() {
  if (standalone()) return `<div class="lbl">Приложение</div><p class="fade small" style="margin:0 2px">Установлено на этом устройстве.</p>`;
  if (window.__installEvt) return `<div class="lbl">Приложение</div><button class="btn block" data-act="install">${ic('plus', 17)} Установить на устройство</button>`;
  if (isIOS()) return `<div class="lbl">Приложение</div><p class="fade small" style="margin:0 2px">Чтобы открывать как приложение: в Safari нажмите «Поделиться» → «На экран “Домой”».</p>`;
  return '';
}
on('install', async () => { const e = window.__installEvt; if (!e) return; window.__installEvt = null; e.prompt(); try { await e.userChoice; } catch (x) {} rerender(); });
on('theme-mode', el => { pref.set('themeMode', el.dataset.v); applyTheme(el.dataset.v); rerender(); });
on('role', el => { pref.set('role', el.dataset.v); location.hash = el.dataset.v === 'teacher' ? '#/t/home' : '#/today'; });
on('target', async el => {
  const cur = isLive() ? session.user.target ?? 4.5 : pref.get('target', demoMe.target);
  const t = Math.min(6, Math.max(1, cur + Number(el.dataset.d)));
  if (isLive()) { try { await src.saveMe({ target: t }); } catch (e) { toast(e.message); } } else pref.set('target', t);
  rerender();
});
on('mic', async () => {
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach(t => t.stop());
    toast('Микрофон работает');
  } catch (e) { toast('Нет доступа к микрофону — разрешите его в настройках браузера'); }
});
on('copy-code', async el => {
  const link = inviteLink(el.dataset.code);
  try { await navigator.clipboard.writeText(link); toast('Ссылка-приглашение скопирована'); } catch (e) { toast('Код: ' + el.dataset.code); }
});
on('new-group', () => modal(`<h2>Новая группа</h2><p class="mut" style="margin-bottom:12px">У группы будет свой код приглашения.</p>
  <form id="ngf"><div class="field"><label for="gname">Название</label><input class="inp" id="gname" required maxlength="60" placeholder="TOEFL · весна"></div>
  <button class="btn pri block" type="submit">Создать</button></form>`));
document.addEventListener('submit', async e => {
  if (e.target.id !== 'ngf') return;
  e.preventDefault();
  try { await src.newGroup(e.target.querySelector('#gname').value.trim()); closeModal(); toast('Группа создана'); rerender(); } catch (err) { toast(err.message); }
});
on('regen', async el => {
  try { await src.regenCode(el.dataset.id); toast('Новый код создан, старый больше не работает'); rerender(); } catch (e) { toast(e.message); }
});
on('threshold', async el => {
  const v = Number(el.dataset.v);
  try { await src.saveSettings({ route_threshold: v }); toast('Порог сохранён'); rerender(); } catch (e) { toast(e.message); }
});

export default async function profile() {
  const live = isLive();
  if (live) await loadMe();
  const u = live ? session.user : null;
  const mode = pref.get('themeMode', 'auto');
  const r = live ? (u.role === 'student' ? 'student' : 'teacher') : role();
  const isT = r === 'teacher';
  const t = live ? u.target ?? 4.5 : pref.get('target', demoMe.target);
  const name = live ? u.name : isT ? demoTeacher.name : demoMe.full;
  const sub = live ? (isT ? (u.role === 'admin' ? 'Учитель · администратор' : 'Учитель') : 'Ученик' + (u.teacher ? ' · учитель ' + u.teacher.name : '')) + ' · ' + u.email
    : isT ? 'Учитель' : 'Ученик · учитель ' + demoMe.teacher;

  let teacherBlock = '';
  if (isT) {
    const [groups, st] = await Promise.all([src.groups(), src.settings()]);
    teacherBlock = `<div class="lbl">Группы и коды приглашения ${live ? `<button class="lnk" data-act="new-group">+ Новая группа</button>` : ''}</div>
      <div class="card rows groups">${groups.map(g => `<div class="row"><div class="t"><div class="nm">${esc(g.name)}</div><div class="mt">${g.students} ${g.students === 1 ? 'ученик' : 'учеников'}${g.active ? '' : ' · код отключён'}</div></div>
        <div class="end"><span class="code">${g.code}</span>
        <button class="ic" data-act="copy-code" data-code="${g.code}" aria-label="Скопировать ссылку">${ic('link', 18)}</button>
        ${live ? `<button class="ic" data-act="regen" data-id="${g.id}" aria-label="Новый код">${ic('repeat', 18)}</button>` : ''}</div></div>`).join('')}</div>
      <p class="fade small" style="margin:8px 2px 0">Отправьте ученику ссылку или код. При регистрации он сразу попадёт в группу.</p>
      <div class="lbl">Адаптивность · порог перехода в трудный модуль</div>
      <div class="seg">${[0.5, 0.55, 0.6, 0.65, 0.7].map(v => `<button class="${Math.abs(st.route_threshold - v) < 1e-6 ? 'on' : ''}" data-act="threshold" data-v="${v}">${Math.round(v * 100)}%</button>`).join('')}</div>
      <p class="fade small" style="margin:8px 2px 0">Доля верных ответов в первом модуле Reading/Listening. ETS свой порог не публикует; начните с 60% и уточняйте по результатам учеников.</p>`;
  }

  return {
    title: 'Профиль',
    html: `${hdr('Профиль')}
    <div class="g-prof"><div class="pa">
      <div class="card pad acct"><span class="av lg">${esc((name || '?')[0])}</span><div class="t"><div class="nm">${esc(name)}</div><div class="mt">${esc(sub)}</div></div></div>
      ${isT ? teacherBlock : `
      <div class="lbl">Экзамен</div>
      <div class="rowlink">${ic('flag', 20)}Цель<em class="stepper"><button data-act="target" data-d="-0.5" aria-label="Меньше">−</button><b>${band(t)}</b><button data-act="target" data-d="0.5" aria-label="Больше">+</button></em><span class="cefr">${cefr(t)}</span></div>
      <label class="rowlink">${ic('cal', 20)}Дата экзамена<em><input type="date" class="dateinp" id="examdate" value="${live ? u.exam_date || '' : demoMe.examDate}" aria-label="Дата экзамена"></em></label>
      <button class="rowlink" data-act="mic">${ic('mic', 20)}Проверка микрофона<em>для Speaking</em>${ic('right', 18)}</button>`}
      </div><div class="pb">
      <div class="lbl">Оформление</div>
      <div class="seg" role="radiogroup">${[['auto', 'Авто', 'auto'], ['light', 'Светлая', 'sun'], ['dark', 'Тёмная', 'moon']].map(([v, l, i]) =>
        `<button class="${mode === v ? 'on' : ''}" data-act="theme-mode" data-v="${v}" role="radio" aria-checked="${mode === v}">${ic(i, 17)}${l}</button>`).join('')}</div>
      <p class="fade small" style="margin:8px 2px 0">«Авто» следует за настройкой системы: днём светлая, ночью тёмная.</p>
      ${installBlock()}
      ${isDemo() ? `<div class="lbl">Демо-режим</div>
      <div class="seg" role="radiogroup">${[['student', 'Ученик'], ['teacher', 'Учитель']].map(([v, l]) =>
        `<button class="${r === v ? 'on' : ''}" data-act="role" data-v="${v}" role="radio" aria-checked="${r === v}">${l}</button>`).join('')}</div>
      <p class="fade small" style="margin:8px 2px 0">Данные в демо — примеры. ${hasApi() ? 'Чтобы работать по-настоящему, войдите в аккаунт.' : ''}</p>` : ''}
      <div class="lbl">Аккаунт</div>
      ${live ? `<a class="rowlink" href="#/password">${ic('lock', 20)}Сменить пароль${ic('right', 18)}</a>` : ''}
      <button class="rowlink" data-act="logout">${ic('logout', 20)}${live ? 'Выйти' : hasApi() ? 'Войти в аккаунт' : 'Выйти'}</button>
      <p class="fade small center">NOEON TOEFL · v0.2</p>
    </div></div>`,
    mount(root) {
      const d = root.querySelector('#examdate');
      if (d) d.addEventListener('change', async () => {
        if (!isLive()) return;
        try { await src.saveMe({ exam_date: d.value || null }); toast('Дата сохранена'); } catch (e) { toast(e.message); }
      });
    }
  };
}

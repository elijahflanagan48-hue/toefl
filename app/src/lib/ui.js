import { ic } from './icons.js';
import { esc } from './util.js';
import { pref } from './store.js';

/** Action registry for event delegation: elements carry data-act="name"; views register handlers. */
export const actions = Object.create(null);
export const on = (name, fn) => { actions[name] = fn; };

export function hdr(title, { back, sub, right = '' } = {}) {
  const dark = document.documentElement.dataset.theme === 'dark';
  return `<header class="hdr">
    ${back ? `<a class="ic back" href="${back}" aria-label="Назад">${ic('left', 23)}</a>` : ''}
    <h1>${esc(title)}${sub ? `<span class="sub">${esc(sub)}</span>` : ''}</h1>
    ${right}
    <button class="ic" data-act="theme-toggle" aria-label="${dark ? 'Светлая тема' : 'Тёмная тема'}">${ic(dark ? 'sun' : 'moon', 21)}</button>
  </header>`;
}

export function modal(inner, { cls = '' } = {}) {
  const layer = document.getElementById('layer');
  layer.innerHTML = `<div class="scrim" data-act="modal-close-bg"><div class="sheet ${cls}" role="dialog" aria-modal="true"><div class="grab"></div>${inner}</div></div>`;
  const first = layer.querySelector('button,[href],input,textarea');
  if (first) first.focus({ preventScroll: true });
}
export const closeModal = () => { document.getElementById('layer').innerHTML = ''; };

let tt;
export function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg;
  clearTimeout(tt); tt = setTimeout(() => el.remove(), 2200);
}

export const role = () => pref.get('role', 'student');

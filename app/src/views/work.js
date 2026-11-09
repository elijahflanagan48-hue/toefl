// Student's view of one submitted Writing task: prompt, own text with the teacher's fragment comments,
// score on the 0–5 scale with its description, checklist criteria and the overall comment.
import * as src from '../data/source.js';
import { isLive, audioUrl } from '../lib/api.js';
import { ic } from '../lib/icons.js';
import { band, esc } from '../lib/util.js';
import { hdr } from '../lib/ui.js';
import { RUBRIC, CRIT, critLabel, markedHtml, notesHtml, promptBlock, countWords } from '../lib/writing.js';

/** criteria the teacher ticked, grouped as on the review form; old ratings (text keys) are listed flat */
function critBlock(kind, cr) {
  const li = (key, ok) => `<li class="${ok ? 'ok' : 'no'}">${ic(ok ? 'check' : 'x', 15)}<span>${esc(critLabel(kind, key))}</span></li>`;
  const known = new Set(), groups = (CRIT[kind] || []).map(g => {
    const rows = g.items.filter(c => c.id in cr); rows.forEach(c => known.add(c.id));
    return rows.length ? `<div class="cgs"><b>${g.t}</b><ul class="critlist">${rows.map(c => li(c.id, cr[c.id])).join('')}</ul></div>` : '';
  }).join('');
  const rest = Object.entries(cr).filter(([k]) => !known.has(k));
  return groups + (rest.length ? `<ul class="critlist">${rest.map(([k, v]) => li(k, v)).join('')}</ul>` : '');
}

export default async function work(params) {
  if (!isLive()) return { title: 'Работа', html: `${hdr('Работа', { back: '#/progress' })}<div class="card empty"><b>Доступно в аккаунте</b>В демо-режиме работы не сохраняются.</div>` };
  const r = await src.submission(params[0]);
  const s = r.submission, p = s.prompt, rate = r.ratings.find(x => x.is_final) || null;
  const kind = s.task === 'eml' ? 'email' : s.task === 'dsc' ? 'dsc' : s.task === 'int' ? 'interview' : 'lrp';
  const name = src.TASK_NAMES[s.task] || s.task;
  const marks = rate?.marks || [];
  const words = s.words ?? countWords(s.text);

  const paper = s.section === 'W' ? `<div class="card pad paper">
      ${s.task === 'eml' && p ? `<div class="mailhd"><span>To:</span> ${esc(p.to || '')}<br><span>Subject:</span> ${esc(p.subject || '')}</div>` : ''}
      <div class="mailbody pre">${markedHtml(s.text || '', marks)}</div>
      ${notesHtml(marks)}
      <div class="paper-ft fade">${words} слов${s.task === 'dsc' && words < 100 ? ' · <span class="badtx">меньше 100</span>' : ''}</div></div>`
    : `<div class="card rows audios">${Array.from({ length: Math.max(s.parts, r.audio.length) }, (_, i) => {
      const has = r.audio.some(a => a.part === i), sc = rate?.parts?.[i];
      return `<div class="row arow audio-row"><div class="t"><div class="nm">${i + 1}. ${esc(p?.questions?.[i] || '')}</div>
        ${has ? `<audio controls preload="none" data-sub="${s.id}" data-part="${i}"></audio>` : '<div class="fade small">нет записи</div>'}</div>
        ${sc != null ? `<div class="end"><b class="serif">${band(sc)}</b><span class="fade small"> / 5</span></div>` : ''}</div>`;
    }).join('')}</div>`;

  const side = rate ? `<aside class="card pad rubric wres">
      <div class="lbl">Оценка учителя</div>
      <div class="wscore"><b class="serif">${band(rate.score)}</b><span>/ 5</span></div>
      <p class="mut">${esc(RUBRIC[kind]?.[Math.round(rate.score)] || '')}</p>
      ${rate.criteria && Object.keys(rate.criteria).length ? `<div class="lbl" style="margin-top:14px">Критерии</div>${critBlock(kind, rate.criteria)}` : ''}
      ${rate.comment ? `<div class="lbl" style="margin-top:14px">Комментарий</div><p class="wcomment">${esc(rate.comment)}</p>` : ''}
      ${marks.length ? `<p class="fade small" style="margin-top:12px">Пометки в тексте: ${marks.length}</p>` : ''}
    </aside>`
    : `<aside class="card pad rubric"><span class="chip warn">на проверке</span><p class="mut" style="margin-top:10px">Учитель ещё не проверил работу. Оценка, критерии и комментарии появятся здесь.</p></aside>`;

  return {
    title: name, wide: true,
    html: `${hdr(name, { back: '#/progress', sub: p?.subject || p?.course || '' })}
      <div class="g-review"><div class="work"><div class="card pad prompt">${s.section === 'W' ? promptBlock(s.task, p, { compact: true }) : `<div class="pr-k">${ic('mic', 16)} ${esc(name)}${p?.title ? ' · ' + esc(p.title) : ''}</div>${p?.scenario ? `<p>${esc(p.scenario)}</p>` : ''}`}</div>${paper}</div>${side}</div>
      <div class="row-btns" style="margin-top:16px">${s.section === 'W' ? `<a class="btn pri" href="#/write/${s.task}?mode=timed">${ic('repeat', 16)} Новое задание</a>` : `<a class="btn pri" href="#/speak/${s.task}?mode=timed">${ic('repeat', 16)} Новое задание</a>`}</div>`,
    mount(root) {
      root.querySelectorAll('audio[data-sub]').forEach(a => {
        a.addEventListener('play', async function load() {
          if (a.src) return;
          a.removeEventListener('play', load);
          try { a.src = await audioUrl(a.dataset.sub, a.dataset.part); a.play(); } catch (e) { /* no audio */ }
        });
      });
    }
  };
}

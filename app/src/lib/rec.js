// Microphone, recording, level meter, beep and browser text-to-speech for the Speaking trainers.
// Everything degrades quietly: no MediaRecorder / no mic permission → supported() false / getMic() throws a Russian message.

export const supported = () => !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

const MIMES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
export const pickMime = () => MIMES.find(m => { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } }) || '';

let stream = null, ctx = null;
export function audioCtx() {
  if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (C) ctx = new C(); }
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export async function getMic() {
  if (stream && stream.getAudioTracks().some(t => t.readyState === 'live')) return stream;
  if (!supported()) throw new Error('Этот браузер не умеет записывать звук. Откройте приложение в Chrome, Edge, Safari или Firefox.');
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); }
  catch (e) {
    const denied = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
    throw new Error(denied ? 'Доступ к микрофону запрещён. Разрешите его в настройках сайта (значок замка у адреса) и обновите страницу.'
      : e && e.name === 'NotFoundError' ? 'Микрофон не найден. Подключите микрофон или наушники с микрофоном.' : 'Не удалось включить микрофон.');
  }
  return stream;
}
export function releaseMic() { if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; }

/** level 0..1 of the mic, polled via requestAnimationFrame; returns stop() */
export function meter(st, cb) {
  const c = audioCtx(); if (!c) return () => {};
  const src = c.createMediaStreamSource(st), an = c.createAnalyser(); an.fftSize = 512;
  src.connect(an);
  const buf = new Uint8Array(an.fftSize);
  let raf = 0, dead = false;
  const loop = () => {
    if (dead) return;
    an.getByteTimeDomainData(buf);
    let m = 0; for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i] - 128));
    cb(Math.min(1, m / 64));
    raf = requestAnimationFrame(loop);
  };
  loop();
  return () => { dead = true; cancelAnimationFrame(raf); try { src.disconnect(); } catch (e) {} };
}

/** one recording: start() then stop() → {blob, ms, mime}. */
export function recorder(st) {
  const mime = pickMime();
  const mr = new MediaRecorder(st, mime ? { mimeType: mime } : undefined);
  const chunks = [];
  let t0 = 0;
  mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  return {
    start() { t0 = performance.now(); mr.start(250); },
    stop() {
      return new Promise(res => {
        const done = () => { const type = mr.mimeType || mime || 'audio/webm'; res({ blob: new Blob(chunks, { type }), ms: Math.round(performance.now() - t0), mime: type }); };
        if (mr.state === 'inactive') return done();
        mr.onstop = done;
        try { mr.stop(); } catch (e) { done(); }
      });
    },
    get state() { return mr.state; }
  };
}

export function beep(freq = 880, ms = 220) {
  const c = audioCtx(); if (!c) return Promise.resolve();
  return new Promise(res => {
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = freq; g.gain.value = 0.0001;
    o.connect(g); g.connect(c.destination);
    const t = c.currentTime;
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    o.start(t); o.stop(t + ms / 1000 + 0.02);
    setTimeout(res, ms + 40);
  });
}

/* ---- text-to-speech (until recorded voices are added to the items) ---- */
let cancelSpeak = null;
export function stopSpeak() { if (cancelSpeak) cancelSpeak(); try { speechSynthesis.cancel(); } catch (e) {} }
function enVoice(role) {
  let vs = []; try { vs = speechSynthesis.getVoices(); } catch (e) {}
  const en = vs.filter(v => /^en[-_]/i.test(v.lang));
  const pref = role === 'int' ? /(female|samantha|jenny|aria|zira)/i : /(male|daniel|guy|david|alex)/i;
  return en.find(v => /en[-_]US/i.test(v.lang) && pref.test(v.name)) || en.find(v => /en[-_]US/i.test(v.lang)) || en[0] || null;
}
/* Clips are decoded once and played through the Web Audio context that was unlocked by the "Start" tap.
   iOS/iPadOS Safari silently refuses `new Audio().play()` outside a tap — that is why only the first clip used to sound. */
const bufs = new Map();
function loadBuf(url) {
  if (!bufs.has(url)) {
    bufs.set(url, fetch(url).then(r => { if (!r.ok) throw new Error('http'); return r.arrayBuffer(); })
      .then(ab => new Promise((ok, no) => { const p = audioCtx().decodeAudioData(ab, ok, no); if (p && p.catch) p.catch(no); }))
      .catch(() => { bufs.delete(url); return null; }));
  }
  return bufs.get(url);
}
export function preload(urls) { if (audioCtx()) urls.forEach(u => { loadBuf(u); }); }
/** plays a recorded clip; resolves 'ended' | 'error' (missing / blocked file) | 'cancel' (stopSpeak) */
export function playClip(url) {
  stopSpeak();
  return new Promise(async resolve => {
    let a = null, node = null, done = false;
    const end = r => { if (done) return; done = true; cancelSpeak = null; resolve(r); };
    cancelSpeak = () => { try { node && node.stop(); } catch (e) {} try { a && a.pause(); } catch (e) {} end('cancel'); };
    const c = audioCtx();
    if (c && c.state !== 'running') { try { await c.resume(); } catch (e) {} }
    const buf = c ? await loadBuf(url) : null;
    if (done) return;
    if (buf && c) {
      try { node = c.createBufferSource(); node.buffer = buf; node.connect(c.destination); node.onended = () => end('ended'); node.start(); return; } catch (e) { node = null; }
    }
    try { a = new Audio(url); a.onended = () => end('ended'); a.onerror = () => end('error'); a.play().catch(() => end('error')); } catch (e) { end('error'); }
  });
}
/** speaks `text`; resolves when finished (or after an estimated time if the browser has no voice / never fires onend) */
export function speak(text, { rate = 0.95, role = 'lrp' } = {}) {
  stopSpeak();
  return new Promise(resolve => {
    const est = Math.max(1200, text.split(/\s+/).length * 420 + 600);
    let finished = false, timer = 0;
    const end = () => { if (finished) return; finished = true; clearTimeout(timer); cancelSpeak = null; resolve(); };
    cancelSpeak = end;
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') { timer = setTimeout(end, est); return; }
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US'; u.rate = rate;
      const v = enVoice(role); if (v) u.voice = v;
      u.onend = end; u.onerror = end;
      speechSynthesis.speak(u);
      timer = setTimeout(end, est + 6000); // safety net: some engines never fire onend
    } catch (e) { timer = setTimeout(end, est); }
  });
}
export const ttsAvailable = () => { try { return 'speechSynthesis' in window && speechSynthesis.getVoices().some(v => /^en/i.test(v.lang)); } catch (e) { return false; } };

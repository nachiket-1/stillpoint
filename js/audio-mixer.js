// Stillpoint — multi-track ambient audio mixer.
// Uses AudioBufferSourceNode (not HTMLMediaElement) so GainNode volume
// control works on iOS, where HTMLMediaElement.volume is read-only.
import * as store from './store.js';

const cards = document.querySelectorAll('.scape');
const mixer = document.getElementById('mixer');
const lanes = mixer ? mixer.querySelectorAll('.mixer__lane') : [];

// AudioContext created immediately; iOS suspends it until a user gesture.
const ctx = new (window.AudioContext || window.webkitAudioContext)();

// One GainNode per track — persists across play/stop cycles.
const gains = {};
cards.forEach((card) => {
  const key = card.dataset.key;
  const g = ctx.createGain();
  g.gain.value = 0;
  g.connect(ctx.destination);
  gains[key] = g;
});

// Pre-fetch every audio file as an ArrayBuffer immediately.
// Decoding (decodeAudioData) waits until after the first user gesture
// so the AudioContext is running.
const rawBuffers = {};   // key → Promise<ArrayBuffer>
const audioBuffers = {}; // key → Promise<AudioBuffer>  (populated after gesture)
cards.forEach((card) => {
  rawBuffers[card.dataset.key] = fetch(card.dataset.audio)
    .then((r) => r.arrayBuffer())
    .catch(() => null);
});

let decodingStarted = false;
function startDecoding() {
  if (decodingStarted) return;
  decodingStarted = true;
  Object.entries(rawBuffers).forEach(([key, p]) => {
    audioBuffers[key] = p.then((data) => data ? ctx.decodeAudioData(data) : null);
  });
}

// Per-track playback state.
const state = {};
cards.forEach((card) => { state[card.dataset.key] = { node: null, playing: false }; });

let unlocked    = false;
let activeCount = 0;

function getSliderVol(key) {
  const lane   = mixer && mixer.querySelector(`.mixer__lane[data-key="${key}"]`);
  const slider = lane && lane.querySelector('.mixer__slider');
  return slider ? Number(slider.value) / 100 : 0.6;
}

function fadeTo(gainNode, target, dur = 600) {
  const start = gainNode.gain.value;
  const t0 = performance.now();
  (function step() {
    const p = Math.min(1, (performance.now() - t0) / dur);
    gainNode.gain.value = start + (target - start) * p;
    if (p < 1) requestAnimationFrame(step);
  })();
}

function showToast(msg) {
  let el = document.querySelector('.audio-toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'audio-toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('is-visible');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('is-visible'), 2400);
}

cards.forEach((card) => {
  const key      = card.dataset.key;
  const lane     = mixer && mixer.querySelector(`.mixer__lane[data-key="${key}"]`);
  const slider   = lane && lane.querySelector('.mixer__slider');
  const playBtn  = card.querySelector('.scape__play');
  const cardName = (card.querySelector('h3') || {}).textContent || key;

  card.addEventListener('click', async () => {
    // Resume AudioContext synchronously inside the user gesture.
    if (ctx.state !== 'running') await ctx.resume();

    // Begin decoding all tracks now that the context is running.
    startDecoding();

    if (!unlocked) {
      unlocked = true;
      showToast('audio unlocked · headphones recommended');
    }

    const s = state[key];

    if (!s.playing) {
      const buf = await audioBuffers[key];
      if (!buf) return;

      // AudioBufferSourceNode is single-use — create a fresh one each play.
      if (s.node) { try { s.node.stop(); } catch (_) {} }
      const node = ctx.createBufferSource();
      node.buffer = buf;
      node.loop   = true;
      node.connect(gains[key]);
      node.start();
      s.node    = node;
      s.playing = true;

      card.classList.add('is-playing');
      if (lane)    lane.classList.add('is-active');
      if (playBtn) playBtn.setAttribute('aria-label', `Stop ${cardName}`);
      fadeTo(gains[key], getSliderVol(key));
      activeCount++;
      if (activeCount === 1 && mixer) mixer.classList.add('is-active');
      const icon = card.querySelector('.scape__play span:first-child');
      if (icon) icon.textContent = '❚❚';

    } else {
      fadeTo(gains[key], 0);
      setTimeout(() => {
        if (s.node) { try { s.node.stop(); } catch (_) {} }
        s.node    = null;
        s.playing = false;
        card.classList.remove('is-playing');
        if (lane)    lane.classList.remove('is-active');
        if (playBtn) playBtn.setAttribute('aria-label', `Play ${cardName}`);
        const icon = card.querySelector('.scape__play span:first-child');
        if (icon) icon.textContent = '▶';
        activeCount = Math.max(0, activeCount - 1);
        if (activeCount === 0 && mixer) mixer.classList.remove('is-active');
      }, 620);
    }
  });
});

// Pointer-event slider handler — works reliably on iOS, Android, and desktop.
// setPointerCapture keeps events flowing even if the finger drifts off the element.
function setupSlider(slider, onChange) {
  const toVal = (clientX) => {
    const r = slider.getBoundingClientRect();
    return Math.round(Math.max(0, Math.min(100, (clientX - r.left) / r.width * 100)));
  };
  let active = false;
  slider.addEventListener('pointerdown', (e) => {
    active = true;
    slider.setPointerCapture(e.pointerId);
    slider.value = toVal(e.clientX);
    onChange();
  });
  slider.addEventListener('pointermove', (e) => {
    if (!active) return;
    slider.value = toVal(e.clientX);
    onChange();
  });
  ['pointerup', 'pointercancel'].forEach((ev) =>
    slider.addEventListener(ev, () => { active = false; })
  );
}

lanes.forEach((lane) => {
  const key    = lane.dataset.key;
  const slider = lane.querySelector('.mixer__slider');
  if (!slider) return;

  const saved = store.get(`mixer.${key}`);
  if (saved != null) slider.value = saved;

  const updateFill = () => slider.style.setProperty('--fill', slider.value + '%');
  updateFill();

  const onSlide = () => {
    updateFill();
    const vol = Number(slider.value) / 100;
    if (state[key] && state[key].playing) gains[key].gain.value = vol;
    store.set(`mixer.${key}`, Number(slider.value));
  };

  slider.addEventListener('input',  onSlide);
  slider.addEventListener('change', onSlide);
  setupSlider(slider, onSlide);
});

// Suspend/resume the whole graph on tab visibility — no per-track management needed.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    ctx.suspend();
  } else {
    ctx.resume();
  }
});

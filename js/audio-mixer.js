// Stillpoint — multi-track ambient audio mixer.
import * as store from './store.js';

const cards = document.querySelectorAll('.scape');
const mixer = document.getElementById('mixer');
const lanes = mixer ? mixer.querySelectorAll('.mixer__lane') : [];

const ctx = new (window.AudioContext || window.webkitAudioContext)();

// One persistent GainNode per track.
const gains = {};
cards.forEach((card) => {
  const g = ctx.createGain();
  g.gain.value = 0;
  g.connect(ctx.destination);
  gains[card.dataset.key] = g;
});

// Fetch + decode every track immediately on page load.
// decodeAudioData is a CPU operation and works even on a suspended context,
// so buffers are ready long before the first tap.
const audioBuffers = {};
cards.forEach((card) => {
  audioBuffers[card.dataset.key] = fetch(card.dataset.audio)
    .then((r) => r.arrayBuffer())
    .then((data) => ctx.decodeAudioData(data))
    .catch(() => null);
});

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

  if (playBtn) {
    playBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
    });
  }

  card.addEventListener('click', async () => {
    // Fire-and-forget resume — context will be running by the time the
    // buffer await (a microtask) resolves.
    ctx.resume();

    const s = state[key];

    if (!s.playing) {
      // ── Immediate visual feedback so the tap feels instant ──
      s.playing = true;
      card.classList.add('is-playing');
      if (lane)    lane.classList.add('is-active');
      if (playBtn) playBtn.setAttribute('aria-label', `Stop ${cardName}`);
      activeCount++;
      if (activeCount === 1 && mixer) mixer.classList.add('is-active');

      if (!unlocked) {
        unlocked = true;
        showToast('audio unlocked · headphones recommended');
      }

      // Buffer is almost always already decoded by the time of first tap.
      const buf = await audioBuffers[key];
      if (!buf) {
        // Decode failed — revert visuals.
        s.playing = false;
        card.classList.remove('is-playing');
        if (lane)    lane.classList.remove('is-active');
        if (playBtn) playBtn.setAttribute('aria-label', `Play ${cardName}`);
        activeCount = Math.max(0, activeCount - 1);
        if (activeCount === 0 && mixer) mixer.classList.remove('is-active');
        return;
      }

      if (s.node) { try { s.node.stop(); } catch (_) {} }
      const node = ctx.createBufferSource();
      node.buffer = buf;
      node.loop   = true;
      node.connect(gains[key]);
      node.start();
      s.node = node;
      fadeTo(gains[key], getSliderVol(key));

    } else {
      // ── Stop: immediate visual, audio fades out ──
      s.playing = false;
      card.classList.remove('is-playing');
      if (lane)    lane.classList.remove('is-active');
      if (playBtn) playBtn.setAttribute('aria-label', `Play ${cardName}`);
      activeCount = Math.max(0, activeCount - 1);
      if (activeCount === 0 && mixer) mixer.classList.remove('is-active');

      fadeTo(gains[key], 0);
      const stoppedNode = s.node;
      s.node = null;
      setTimeout(() => { try { stoppedNode.stop(); } catch (_) {} }, 620);
    }
  });
});

// Pointer-event slider handler with setPointerCapture for reliable drag.
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

// Suspend/resume the whole graph on tab visibility.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) ctx.suspend();
  else ctx.resume();
});

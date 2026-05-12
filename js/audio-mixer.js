// Stillpoint — multi-track ambient audio mixer.
// Volume is controlled via Web Audio GainNode, not audio.volume,
// because iOS Safari makes audio.volume read-only (hardware-only).
import * as store from './store.js';

const cards  = document.querySelectorAll('.scape');
const mixer  = document.getElementById('mixer');
const lanes  = mixer ? mixer.querySelectorAll('.mixer__lane') : [];

const tracks = {};
let unlocked    = false;
let activeCount = 0;
let audioCtx    = null;

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function ensureTrack(key, src, initialVol) {
  if (tracks[key]) return tracks[key];
  const audio = new Audio(src);
  audio.loop    = true;
  audio.preload = 'auto';

  const ctx  = getCtx();
  const source = ctx.createMediaElementSource(audio);
  const gain   = ctx.createGain();
  gain.gain.value = initialVol;
  source.connect(gain);
  gain.connect(ctx.destination);

  tracks[key] = { audio, gain, playing: false, vol: initialVol };
  return tracks[key];
}

function fadeTo(track, target, dur = 600) {
  const start = track.gain.gain.value;
  const t0 = performance.now();
  function step() {
    const p = Math.min(1, (performance.now() - t0) / dur);
    track.gain.gain.value = start + (target - start) * p;
    if (p < 1) requestAnimationFrame(step);
  }
  step();
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
  const key     = card.dataset.key;
  const src     = card.dataset.audio;
  const lane    = mixer && mixer.querySelector(`.mixer__lane[data-key="${key}"]`);
  const slider  = lane && lane.querySelector('.mixer__slider');
  const playBtn = card.querySelector('.scape__play');
  const cardName = (card.querySelector('h3') || {}).textContent || key;

  card.addEventListener('click', () => {
    const initialVol = slider ? slider.value / 100 : 0.6;
    const t = ensureTrack(key, src, 0);
    if (!unlocked) {
      unlocked = true;
      showToast('audio unlocked · headphones recommended');
    }
    if (!t.playing) {
      t.audio.play().then(() => {
        t.playing = true;
        card.classList.add('is-playing');
        if (lane) lane.classList.add('is-active');
        if (playBtn) playBtn.setAttribute('aria-label', `Stop ${cardName}`);
        fadeTo(t, initialVol);
        activeCount++;
        if (activeCount === 1 && mixer) mixer.classList.add('is-active');
        const icon = card.querySelector('.scape__play span:first-child');
        if (icon) icon.textContent = '❚❚';
      }).catch((err) => {
        console.warn('audio play failed', err);
      });
    } else {
      fadeTo(t, 0);
      setTimeout(() => {
        t.audio.pause();
        t.playing = false;
        card.classList.remove('is-playing');
        if (lane) lane.classList.remove('is-active');
        if (playBtn) playBtn.setAttribute('aria-label', `Play ${cardName}`);
        const icon = card.querySelector('.scape__play span:first-child');
        if (icon) icon.textContent = '▶';
        activeCount = Math.max(0, activeCount - 1);
        if (activeCount === 0 && mixer) mixer.classList.remove('is-active');
      }, 620);
    }
  });
});

// Direct touch-to-value handler — both events non-passive so we can
// preventDefault, which stops iOS from running its own conflicting drag.
function patchSliderTouch(slider, onChange) {
  const toVal = (clientX) => {
    const r = slider.getBoundingClientRect();
    return Math.round(Math.max(0, Math.min(100, (clientX - r.left) / r.width * 100)));
  };
  slider.addEventListener('touchstart', (e) => {
    e.preventDefault();
    slider.value = toVal(e.touches[0].clientX);
    onChange();
  }, { passive: false });
  slider.addEventListener('touchmove', (e) => {
    e.preventDefault();
    slider.value = toVal(e.touches[0].clientX);
    onChange();
  }, { passive: false });
}

lanes.forEach((lane) => {
  const key    = lane.dataset.key;
  const slider = lane.querySelector('.mixer__slider');
  if (!slider) return;

  const saved = store.get(`mixer.${key}`);
  if (saved != null) slider.value = saved;

  const updateFill = () => {
    slider.style.setProperty('--fill', slider.value + '%');
  };
  updateFill();

  const onSlide = () => {
    updateFill();
    const t = tracks[key];
    if (t) {
      t.vol = slider.value / 100;
      t.gain.gain.value = t.vol;
    }
    store.set(`mixer.${key}`, Number(slider.value));
  };
  slider.addEventListener('input', onSlide);
  slider.addEventListener('change', onSlide);
  patchSliderTouch(slider, onSlide);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    Object.values(tracks).forEach((t) => { if (t.playing) t.audio.pause(); });
  } else {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    Object.values(tracks).forEach((t) => { if (t.playing) t.audio.play().catch(() => {}); });
  }
});

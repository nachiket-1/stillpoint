// Stillpoint — multi-track ambient audio mixer.
// Each track loops, can be toggled via card click, and has an independent slider.
// Browsers require a user gesture to start audio — first click unlocks all.

const cards = document.querySelectorAll('.scape');
const mixer = document.getElementById('mixer');
const lanes = mixer ? mixer.querySelectorAll('.mixer__lane') : [];

const tracks = {};
let unlocked = false;
let activeCount = 0;

function ensureTrack(key, src, initialVol) {
  if (tracks[key]) return tracks[key];
  const audio = new Audio(src);
  audio.loop = true;
  audio.preload = 'auto';
  audio.volume = initialVol;
  tracks[key] = { audio, playing: false, vol: initialVol };
  return tracks[key];
}

function fadeTo(track, target, dur = 600) {
  const start = track.audio.volume;
  const t0 = performance.now();
  function step() {
    const p = Math.min(1, (performance.now() - t0) / dur);
    track.audio.volume = start + (target - start) * p;
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
  const key = card.dataset.key;
  const src = card.dataset.audio;
  const lane = mixer && mixer.querySelector(`.mixer__lane[data-key="${key}"]`);
  const slider = lane && lane.querySelector('.mixer__slider');

  card.addEventListener('click', () => {
    const initialVol = slider ? slider.value / 100 : 0.6;
    const t = ensureTrack(key, src, 0); // start silent, fade in
    if (!unlocked) {
      unlocked = true;
      showToast('audio unlocked · headphones recommended');
    }
    if (!t.playing) {
      t.audio.play().then(() => {
        t.playing = true;
        card.classList.add('is-playing');
        fadeTo(t, initialVol);
        activeCount++;
        if (activeCount === 1 && mixer) mixer.classList.add('is-active');
        const playBtn = card.querySelector('.scape__play span:first-child');
        if (playBtn) playBtn.textContent = '❚❚';
      }).catch((err) => {
        console.warn('audio play failed', err);
      });
    } else {
      // pause with fade
      fadeTo(t, 0);
      setTimeout(() => {
        t.audio.pause();
        t.playing = false;
        card.classList.remove('is-playing');
        const playBtn = card.querySelector('.scape__play span:first-child');
        if (playBtn) playBtn.textContent = '▶';
        activeCount = Math.max(0, activeCount - 1);
        if (activeCount === 0 && mixer) mixer.classList.remove('is-active');
      }, 620);
    }
  });
});

lanes.forEach((lane) => {
  const key = lane.dataset.key;
  const slider = lane.querySelector('.mixer__slider');
  if (!slider) return;
  const onSlide = () => {
    const t = tracks[key];
    if (t) {
      t.vol = slider.value / 100;
      t.audio.volume = t.vol;
    }
  };
  slider.addEventListener('input', onSlide);
  slider.addEventListener('change', onSlide); // iOS Safari fires change, not input
});

// Pause everything if tab hidden (be polite)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    Object.values(tracks).forEach((t) => { if (t.playing) t.audio.pause(); });
  } else {
    Object.values(tracks).forEach((t) => { if (t.playing) t.audio.play().catch(() => {}); });
  }
});

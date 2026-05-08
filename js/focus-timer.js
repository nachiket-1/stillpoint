// Stillpoint — minimalist focus timer

const DURATIONS = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };
const PHASES   = { focus: 'focus', short: 'short break', long: 'long break' };
const SOUNDS = {
  dawn:      'assets/audio/dawn.mp3',
  fireplace: 'assets/audio/fireplace.mp3',
  ocean:     'assets/audio/ocean.mp3',
  forest:    'assets/audio/forest.mp3',
  rain:      'assets/audio/rain.mp3',
  stream:    'assets/audio/stream.mp3',
};

const timeEl     = document.getElementById('time');
const phaseEl    = document.getElementById('phase');
const sessionsEl = document.getElementById('sessions');
const toggleBtn  = document.getElementById('toggle');
const resetBtn   = document.getElementById('reset');
const modeBtns   = document.querySelectorAll('.focus__chip');
const soundBtns  = document.querySelectorAll('.focus__sound button');

let mode         = 'focus';
let remaining    = DURATIONS[mode];
let running      = false;
let started      = false; // true once timer has been started since last reset
let last         = 0;
let raf;
let sessionCount = 0;

const audio = new Audio();
audio.loop    = true;
audio.volume  = 0;
let activeSound = 'none';

function fmt(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function render() {
  timeEl.textContent  = fmt(remaining);
  phaseEl.textContent = PHASES[mode];

  const arrow = toggleBtn.querySelector('.arrow');
  if (running) {
    toggleBtn.firstChild.textContent = 'Pause ';
    if (arrow) arrow.style.visibility = 'hidden';
  } else if (started) {
    toggleBtn.firstChild.textContent = 'Resume ';
    if (arrow) { arrow.textContent = '→'; arrow.style.visibility = 'visible'; }
  } else {
    toggleBtn.firstChild.textContent = 'Start ';
    if (arrow) { arrow.textContent = '→'; arrow.style.visibility = 'visible'; }
  }

  document.title = `${fmt(remaining)} · ${PHASES[mode]} — Stillpoint`;
}

function tick(now) {
  if (!running) return;
  const dt = (now - last) / 1000;
  last = now;
  remaining = Math.max(0, remaining - dt);
  if (remaining <= 0) {
    running = false;
    started = false;
    if (mode === 'focus') {
      sessionCount++;
      if (sessionsEl) {
        sessionsEl.textContent = sessionCount === 1
          ? '1 session complete'
          : `${sessionCount} sessions today`;
      }
    }
    bell();
    remaining = DURATIONS[mode];
    // audio keeps playing between sessions — user can stop manually
  }
  render();
  if (running) raf = requestAnimationFrame(tick);
}

function startStop() {
  running = !running;
  if (running) {
    started = true;
    last = performance.now();
    if (activeSound !== 'none') {
      // Start button is the user gesture that unlocks audio on mobile
      audio.play().catch(() => {});
      fadeAudio(0.4);
    }
    raf = requestAnimationFrame(tick);
  } else {
    fadeAudio(0);
    setTimeout(() => audio.pause(), 700);
    cancelAnimationFrame(raf);
  }
  render();
}

function reset() {
  running = false;
  started = false;
  cancelAnimationFrame(raf);
  remaining = DURATIONS[mode];
  fadeAudio(0);
  setTimeout(() => audio.pause(), 700);
  render();
}

function setMode(next) {
  mode = next;
  modeBtns.forEach((b) => b.classList.toggle('is-active', b.dataset.mode === next));
  reset();
}

function setSound(name) {
  soundBtns.forEach((b) => b.classList.toggle('is-active', b.dataset.sound === name));
  activeSound = name;
  if (name === 'none') {
    fadeAudio(0);
    setTimeout(() => { audio.pause(); audio.removeAttribute('src'); }, 700);
    return;
  }
  audio.src = SOUNDS[name];
  if (running) {
    // Timer already running — switch sound seamlessly
    audio.play().catch(() => {});
    fadeAudio(0.4);
  }
  // If not running: src is queued, will start when Start is pressed
}

function fadeAudio(target, dur = 700) {
  const start = audio.volume;
  const t0 = performance.now();
  function step() {
    const p = Math.min(1, (performance.now() - t0) / dur);
    audio.volume = start + (target - start) * p;
    if (p < 1) requestAnimationFrame(step);
  }
  step();
}

// Soft bell using WebAudio
let audioCtx;
function bell() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = 660;
    osc.type = 'sine';
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(0.18, audioCtx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 1.3);
  } catch {}
}

toggleBtn.addEventListener('click', startStop);
resetBtn.addEventListener('click', reset);
modeBtns.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
soundBtns.forEach((b) => b.addEventListener('click', () => setSound(b.dataset.sound)));

// Spacebar toggles timer
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
    e.preventDefault();
    startStop();
  }
});

render();

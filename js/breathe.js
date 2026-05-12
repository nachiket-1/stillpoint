// Stillpoint — guided breathing.
// Soft pulsing circle on a canvas, paced by a chosen pattern.

const canvas      = document.getElementById('breatheCanvas');
const phaseEl     = document.getElementById('breathePhase');
const countEl     = document.getElementById('breatheCount');
const hintEl      = document.getElementById('breatheHint');
const toggleBtn   = document.getElementById('breatheToggle');
const patternBtns = document.querySelectorAll('.breathe__chip');

if (!canvas) throw new Error('No #breatheCanvas');
const ctx = canvas.getContext('2d');

// patterns: each phase = [label, seconds]
const PATTERNS = {
  coherent: { name: 'Coherent · 5·5',     phases: [['inhale', 5], ['exhale', 5]] },
  box:      { name: 'Box · 4·4·4·4',      phases: [['inhale', 4], ['hold', 4], ['exhale', 4], ['hold', 4]] },
  '478':    { name: 'Calm · 4·7·8',       phases: [['inhale', 4], ['hold', 7], ['exhale', 8]] },
};

let pattern   = '478';  // start a more grounding rhythm
patternBtns.forEach((b) => b.classList.toggle('is-active', b.dataset.pattern === pattern));

let running    = false;
let phaseIdx   = 0;
let phaseStart = 0;
let cycleCount = 0;

// Smooth animated radius (eased 0..1)
let target = 0.0;       // 0 = small, 1 = full expanded
let radiusN = 0.0;      // smoothed value
let raf;

function setSize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = canvas.getBoundingClientRect();
  canvas.width  = Math.max(1, Math.floor(r.width  * dpr));
  canvas.height = Math.max(1, Math.floor(r.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
setSize();
window.addEventListener('resize', setSize);

function currentPhase() {
  const p = PATTERNS[pattern].phases;
  return p[phaseIdx % p.length];
}

function startSession() {
  running    = true;
  phaseIdx   = 0;
  phaseStart = performance.now();
  cycleCount = 0;
  toggleBtn.firstChild.textContent = 'Pause ';
  const arrow = toggleBtn.querySelector('.arrow');
  if (arrow) arrow.style.visibility = 'hidden';
  hintEl.textContent = 'Follow the circle · let the count guide you.';
  loop();
}

function pauseSession() {
  running = false;
  cancelAnimationFrame(raf);
  toggleBtn.firstChild.textContent = 'Resume ';
  const arrow = toggleBtn.querySelector('.arrow');
  if (arrow) { arrow.textContent = '→'; arrow.style.visibility = 'visible'; }
  hintEl.textContent = 'Pick up where you left off, or change the rhythm.';
  // keep last frame on screen
  draw();
}

function advanceIfNeeded(now) {
  const [, dur] = currentPhase();
  if ((now - phaseStart) / 1000 >= dur) {
    phaseIdx++;
    phaseStart = now;
    if (phaseIdx % PATTERNS[pattern].phases.length === 0) cycleCount++;
  }
}

function easeInOut(t) { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2; }

function update(now) {
  if (!running) { return; }
  advanceIfNeeded(now);
  const [name, dur] = currentPhase();
  const t = Math.min(1, (now - phaseStart) / 1000 / dur);
  const remaining = Math.max(0, Math.ceil(dur - (now - phaseStart) / 1000));

  if (name === 'inhale')      target = easeInOut(t);          // 0 → 1
  else if (name === 'exhale') target = 1 - easeInOut(t);      // 1 → 0
  else                         target = (radiusN + (radiusN > 0.5 ? 1 : 0)) / 2; // hold near current

  // smooth toward target
  radiusN += (target - radiusN) * 0.18;

  phaseEl.textContent = name;
  countEl.textContent = remaining > 0 ? remaining : '·';
}

function draw() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2, cy = h / 2;
  const minSide = Math.min(w, h);
  const minR = minSide * 0.10;
  const maxR = minSide * 0.34;
  const r   = minR + (maxR - minR) * radiusN;

  // soft outer halo
  const grad = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 1.7);
  grad.addColorStop(0,   'rgba(195, 152, 69, 0.34)');
  grad.addColorStop(0.5, 'rgba(195, 152, 69, 0.10)');
  grad.addColorStop(1,   'rgba(195, 152, 69, 0.0)');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(cx, cy, r * 1.7, 0, Math.PI * 2); ctx.fill();

  // ring
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(34, 35, 31, 0.18)';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();

  // inner disc
  const inner = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  inner.addColorStop(0,   'rgba(246, 239, 226, 0.95)');
  inner.addColorStop(1,   'rgba(246, 239, 226, 0.20)');
  ctx.fillStyle = inner;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
}

function loop() {
  const now = performance.now();
  update(now);
  draw();
  if (running) raf = requestAnimationFrame(loop);
}

// Initial render
draw();

toggleBtn.addEventListener('click', () => {
  if (running) pauseSession(); else startSession();
});

patternBtns.forEach((b) => b.addEventListener('click', () => {
  pattern = b.dataset.pattern;
  patternBtns.forEach((x) => x.classList.toggle('is-active', x === b));
  // Reset cycle so the user starts fresh on the new pattern
  phaseIdx = 0;
  phaseStart = performance.now();
  cycleCount = 0;
}));

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
    e.preventDefault();
    if (running) pauseSession(); else startSession();
  }
});

// Boot + page-level interactions

const boot = document.getElementById('boot');
function ready() {
  document.body.classList.add('is-ready');
  setTimeout(() => boot && boot.classList.add('hidden'), 500);
}
window.addEventListener('load', () => requestAnimationFrame(ready));
if (document.readyState === 'complete') requestAnimationFrame(ready);

// WebGL detection — add no-webgl class so CSS fallback kicks in
try {
  const testCanvas = document.createElement('canvas');
  if (!testCanvas.getContext('webgl') && !testCanvas.getContext('experimental-webgl')) {
    document.body.classList.add('no-webgl');
  }
} catch(e) {
  document.body.classList.add('no-webgl');
}

// Mobile nav toggle
const nav     = document.getElementById('nav');
const navMenu = document.getElementById('navMenu');
if (nav && navMenu) {
  navMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    nav.classList.toggle('is-open');
  });
  // Close when tapping a nav link
  nav.querySelectorAll('.nav__links a').forEach((link) => {
    link.addEventListener('click', () => nav.classList.remove('is-open'));
  });
  // Close when tapping outside nav
  document.addEventListener('click', (e) => {
    if (!nav.contains(e.target)) nav.classList.remove('is-open');
  });
}

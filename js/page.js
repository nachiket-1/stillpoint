// Boot + page-level interactions
const boot = document.getElementById('boot');
function ready() {
  document.body.classList.add('is-ready');
  setTimeout(() => boot && boot.classList.add('hidden'), 500);
}
window.addEventListener('load', () => requestAnimationFrame(ready));
if (document.readyState === 'complete') requestAnimationFrame(ready);

// Mobile nav toggle
const nav = document.getElementById('nav');
const navMenu = document.getElementById('navMenu');
if (nav && navMenu) {
  navMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    nav.classList.toggle('is-open');
  });
  document.addEventListener('click', (e) => {
    if (!nav.contains(e.target)) nav.classList.remove('is-open');
  });
}

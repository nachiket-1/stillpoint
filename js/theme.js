// Stillpoint — theme system: light/dark with auto time-of-day default.
import * as store from './store.js';

const KEY = 'theme'; // 'auto' | 'light' | 'dark'

function autoTheme() {
  const h = new Date().getHours();
  return (h >= 6 && h < 19) ? 'light' : 'dark';
}

const effective = (pref) => (pref === 'auto' ? autoTheme() : pref);

function apply(pref) {
  const t = effective(pref);
  if (t === 'dark') document.documentElement.dataset.theme = 'dark';
  else delete document.documentElement.dataset.theme;
  return t;
}

let pref = store.get(KEY, 'light');
apply(pref);

// Re-evaluate auto theme periodically so dusk → dark transition kicks in
setInterval(() => {
  if (store.get(KEY, 'auto') === 'auto') {
    apply('auto');
    if (btn) updateIcon();
  }
}, 5 * 60 * 1000);

const btn = document.getElementById('navTheme');
function updateIcon() {
  if (!btn) return;
  const t = effective(pref);
  btn.textContent = t === 'dark' ? '☀' : '☾';
  const target = t === 'dark' ? 'light' : 'dark';
  btn.setAttribute('aria-label', `Switch to ${target} theme`);
  btn.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
  btn.title = `Switch to ${target}`;
}

if (btn) {
  updateIcon();
  btn.addEventListener('click', () => {
    const cur = effective(pref);
    pref = cur === 'dark' ? 'light' : 'dark';
    store.set(KEY, pref);
    apply(pref);
    updateIcon();
  });
}

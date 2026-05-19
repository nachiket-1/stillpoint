// Stillpoint — daily wisdom: pick one quote per local day from data/wisdom.json.

const el = document.getElementById('daily');
if (el) {
  const d = new Date();
  const dateEl = el.querySelector('.daily__date');
  if (dateEl) {
    dateEl.textContent = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  fetch('/data/wisdom.json')
    .then((r) => r.json())
    .then((quotes) => {
      const start = new Date(d.getFullYear(), 0, 0);
      const dayOfYear = Math.floor((d - start) / 86400000);
      const q = quotes[dayOfYear % quotes.length];

      el.querySelector('.daily__text').textContent = `”${q.text}”`;
      el.querySelector('.daily__author').textContent = `— ${q.author}`;
      el.classList.add('is-loaded');
    })
    .catch(() => { el.remove(); });
}

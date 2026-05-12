// Stillpoint — daily wisdom: pick one quote per local day from data/wisdom.json.

const el = document.getElementById('daily');
if (el) {
  fetch('data/wisdom.json')
    .then((r) => r.json())
    .then((quotes) => {
      // Day-of-year index gives a stable per-day selection that loops yearly
      const d = new Date();
      const start = new Date(d.getFullYear(), 0, 0);
      const dayOfYear = Math.floor((d - start) / 86400000);
      const q = quotes[dayOfYear % quotes.length];

      el.querySelector('.daily__text').textContent = `“${q.text}”`;
      el.querySelector('.daily__author').textContent = `— ${q.author}`;
      el.classList.add('is-loaded');
    })
    .catch(() => { el.remove(); });
}

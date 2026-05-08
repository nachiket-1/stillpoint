# Stillpoint

A small, slow corner of the internet. Four ambient 3D worlds, a focus timer, and zero ways to scroll.

Built with vanilla HTML/CSS/JS + Three.js (no build step). Free to host on GitHub Pages.

---

## What's inside

```
stillpoint/
├── index.html          → Home (cinematic hero scene)
├── soundscapes.html    → Four worlds + audio mixer
├── focus.html          → Pomodoro timer + ambient scene
├── about.html          → Manifesto
├── css/style.css
├── js/
│   ├── page.js
│   ├── scene-hero.js
│   ├── scene-soundscapes.js
│   ├── scene-focus.js
│   ├── scene-about.js
│   ├── audio-mixer.js
│   └── focus-timer.js
└── assets/audio/
    ├── fireplace.mp3
    ├── ocean.mp3
    ├── forest.mp3
    └── rain.mp3
```

---

## Run it locally

No install, no build:

```bash
cd stillpoint
python3 -m http.server 5173
# open http://localhost:5173
```

(Any static server works — `npx serve`, `php -S`, etc. Don't open the HTML files directly with `file://` — ES module imports require an HTTP origin.)

---

## Deploy free on GitHub Pages

1. **Create a new GitHub repo** named `stillpoint` (or anything you like — but `stillpoint` is a clean URL).
2. From the project folder:
   ```bash
   cd stillpoint
   git init
   git add .
   git commit -m "first breath"
   git branch -M main
   git remote add origin https://github.com/<your-username>/stillpoint.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages → Build and deployment → Source: "Deploy from a branch"**, then pick **`main` / `(root)`** and Save.
4. Wait ~30 seconds. Your site goes live at:
   ```
   https://<your-username>.github.io/stillpoint/
   ```

That's the URL to put in your Instagram bio.

> Custom domain (e.g. `thestillpoint.in`): in **Settings → Pages → Custom domain** add the domain, then at your registrar's DNS panel add a `CNAME` record pointing `www` (or apex via 4× `A` records → 185.199.108.153 / .109.153 / .110.153 / .111.153) to `nachiket-1.github.io`. GitHub auto-issues an HTTPS cert within minutes.

---

## Tweak it

**Change the credit name.** It's in three places (search-and-replace `Nachiket Talekar`):
- `index.html`, `soundscapes.html`, `focus.html`, `about.html` — bottom credit line
- `about.html` — large signature

**Use your Blender scene.** The current 3D is procedural (Three.js builds the hills/sun/particles in code), so the site stays small and loads fast. To embed your Namaqualand `.blend` file:
1. Open `Namaqualand.blend` in Blender.
2. **File → Export → glTF 2.0 (.glb)** — choose **Binary glTF** for one-file output. Bring resolution down (decimate modifier or 1k textures) so the file is < 10 MB.
3. Save as `assets/models/namaqualand.glb`.
4. In `js/scene-hero.js`, swap the procedural hills for the loader (Three.js docs: `GLTFLoader`).

**Swap audio.** Drop a different `.mp3` into `assets/audio/` (keep the same filename) or change the path in the relevant page's `<article data-audio="...">`.

**Recolor.** Open `css/style.css` — the palette lives in the top `:root` block (`--cream`, `--sage`, `--ochre`, `--terracotta`, `--ink`).

---

## Audio credits

Audios are © their respective creators (filenames preserve attribution):
- `fireplace.mp3` — capaholiczsfx · Crackle Fireplace Campfire (Pixabay #402289)
- `ocean.mp3` — soundangel1111 · Ocean Beach Waves (Pixabay #332383)
- `forest.mp3` — eryliaa · Night Forest with Frogs and Crickets (Pixabay #451153)
- `rain.mp3` — liecio · Calming Rain (Pixabay #257596)
- `stream.mp3` — u_g4b6tnje0y · Water Stream (Pixabay #512531)

Verify each is licensed for your intended use before publishing publicly.

---

## A small note

This was made with Blender (for the original Namaqualand scene that inspired the palette), Three.js (for the procedural worlds), and a slow afternoon. The point is to be a place you visit on purpose — not one that visits you.

— Nachiket Talekar, 2026

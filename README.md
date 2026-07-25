# Shubhang Srinivas Varda — Portfolio

**[personal-portfolio-ten-alpha-49.vercel.app](https://personal-portfolio-ten-alpha-49.vercel.app)**

Full-stack and AI/ML engineer in Bengaluru. Final-year B.Tech CSE (Data Science &
Engineering) at RV University, currently holding two engineering internships, and
co-author of a peer-reviewed paper in Springer Nature's *AI & Society*.

This repository is the site itself — a hand-built portfolio with **no framework, no
build step and no dependencies**. Clone it and open `index.html`; that's the whole
toolchain. Everything below runs on plain HTML, CSS and JavaScript.

---

## The idea

The page has two modes. At the top it presents itself as a **macOS desktop** — menu
bar, draggable window, magnifying dock, planetary wallpaper. Scroll, and it hands
over to a **Swiss-grid editorial document** — twelve columns, hairline rules, display
type, and a generative background that reshapes itself section by section.

Both halves share one cursor: a small black hole that bends whatever it passes over.

---

## Things worth opening the source for

### The wallpaper is an actual gravitational lens

The hero background isn't a decorative swirl. Every star, planet and orbit vertex is
displaced through the thin-lens equation for a point mass. A source at distance `r`
from the lens centre resolves into two images at

$$r_\pm = \tfrac{1}{2}\left(r \pm \sqrt{r^2 + 4R_e^2}\right)$$

where `Rₑ` is the Einstein radius. `r₊` lands on the source's side; `r₋` comes out
negative and therefore appears on the opposite side — the counter-image real lensing
produces. Brightness follows the standard magnification, `μ = (u²+2) / (u√(u²+4))`
with `u = r/Rₑ`, split as `μ± = (μ ± 1)/2`. Sources near alignment smear onto the
Einstein ring, so the ring emerges on its own rather than being drawn.

Orbits are walked as polylines with **every vertex lensed**, so the rings visibly bend
around the hole and break where the two images diverge.

→ [`js/sky.js`](js/sky.js)

### The lens warps the text too

DOM text can't be displaced like canvas geometry, so it goes through an SVG
`feDisplacementMap`. A generated texture encodes the same deflection the stars get —
sample offset `Rₑ²/r` pointing inward — and the filter resamples the rendered element
through it.

Two details that make it work:

- The texture only covers a patch around the cursor, so the filter region is flooded
  with the neutral value first. Without that, the transparent area outside the patch
  decodes as a large constant shift and throws the whole element sideways.
- Each warped element owns its filter. The patch sits in the element's *own* user
  space, so a shared node would put the second element's warp around the wrong point.

Displacement filters are cheap on some machines and not on others, so the warp watches
its own frame budget and retires permanently if it can't hold 30 ms.

→ [`js/textlens.js`](js/textlens.js)

### One particle graph, many formations

Below the hero, a single neural field runs behind the whole page. Every node owns a
*target position* produced by a layout function, so each section re-targets the swarm
and the graph physically reflows: free constellation → feed-forward layers → weight
matrix → gradient-flow streams → lattice → entropy cloud → convergence funnel.

Edges are rebuilt from a uniform spatial hash rather than an O(n²) sweep, and motion
uses a near-critically-damped spring integrated against elapsed time — so a formation
settles in ~1.8 s with under 1% overshoot, and runs identically at 60 Hz and 144 Hz.

→ [`js/field.js`](js/field.js)

### Smaller things

| | |
|---|---|
| **Boot sequence** | `PRESS START` types out real source describing how the page works, syntax-highlighted by a small TypeScript tokenizer written for the purpose |
| **Stack matrix** | Hovering a cell wires its row and column; clicking **permutes** them, FLIP-animated, with the grid padded to a full rectangle so a swap can't tear holes through it |
| **Palette morphing** | Accents are registered with `@property` as real `<color>` types, so the browser interpolates them and every gradient, border and glow on the page shifts together as you scroll |
| **Display type** | The masthead sizes itself off its own column with container query units, instead of guessing at viewport breakpoints |
| **Builds gallery** | Vertical scroll pans a pinned horizontal track, releasing back to a normal stack when there isn't the height for it |
| **Console** | A working shell with command parsing, history and tab-completion — everything on the page is queryable from it |

---

## Structure

```
index.html          markup, and the per-section background config in data-* attributes
css/
  style.css         design tokens and shared components
  editorial.css     Swiss grid, desktop chrome, scrollytelling layout
js/
  sky.js            gravitational-lens wallpaper
  textlens.js       SVG displacement warp for DOM content
  field.js          the neural field
  scrolly.js        section theming, dock, case-study diagram, pinned gallery
  main.js           boot sequence, cursor, terminal, command palette
assets/icons/       local SVG logos — no icon CDN
```

Sections declare their own background. Adding one is a matter of markup:

```html
<section data-field="lattice" data-a="#22d3ee" data-b="#a855f7"
         data-morph="0.9" data-density="0.34" data-op="0.6">
```

---

## Running it

No install step. Open `index.html` directly, or serve the folder if you'd rather avoid
`file://` quirks:

```bash
python -m http.server 5173
```

Then visit `http://localhost:5173`.

---

## Motion and accessibility

- `prefers-reduced-motion` is honoured before first paint, so there's no flash of
  animation for anyone who's asked not to see it. The boot sequence is skipped
  entirely in that case.
- An **Effects** toggle overrides either way and persists to `localStorage`.
- Every animated surface exposes a still frame rather than freezing mid-motion.
- Body copy and small monospace labels are sized and contrasted to stay readable over
  a live canvas; the background pulls itself back behind text.
- Keyboard: `⌘K` / `Ctrl+K` opens the command palette, `Enter` permutes the stack
  matrix, and the dock and console are reachable by tab.

Layout is verified from 360 px to 1920 px with no horizontal overflow.

---

## Browser support

Built for current Chrome, Edge, Safari and Firefox. A few modern features degrade
rather than break: `@property` colour interpolation falls back to instant palette
swaps, container query units fall back to a viewport-based clamp, and the text warp
removes itself if the frame budget says no.

---

## Elsewhere

- **Email** — [vardashubhang@gmail.com](mailto:vardashubhang@gmail.com)
- **LinkedIn** — [shubhang-srinivas-varda](https://www.linkedin.com/in/shubhang-srinivas-varda-322ba4297/)
- **WhatsApp** — [message me](https://wa.me/qr/77CMMCHW5JAKI1)
- **GitHub** — [@BaconKage](https://github.com/BaconKage)

Selected work, all linked from the site: **MyGym**, a gym operating platform
(client demonstration complete, moving to a controlled pilot) · **VaniCert**, a voice
deepfake detector on GPU infrastructure · **FirstDropAI**, a clinical communication
simulator · **BhashaBuddy**, a mother-tongue learning app for children abroad.

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

Both halves share one cursor: a small black hole that bends whatever it passes over,
and one colour. The page owns a single sodium amber that shifts in brightness and
temperature as you scroll, over a ground kept deliberately cool so the accent is the
only warm thing on screen.

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

The hole is a cursor, not a wallpaper feature, so the warp doesn't stop at the hero.
It tracks the pointer directly and only defers to the starfield's centre while the
starfield is actually drawing — which is what keeps one hole shared between canvas and
copy up top, and lets the lens go on reading display type all the way down the page.
Passing it over the research pull-quote bends a sentence about errors that don't
disappear but change shape.

Displacement filters are cheap on some machines and not on others, so the warp watches
its own frame budget and retires permanently if it can't hold 30 ms. Coarse pointers
never build it at all.

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
| **Palette morphing** | Accents are registered with `@property` as real `<color>` types, so the browser interpolates them and every gradient, border and glow on the page shifts together as you scroll. Ten sections, one hue, a deliberate luminance arc rather than ten different colours |
| **Project schemas** | Each build draws its own architecture from a declarative spec: tiers become rows, the layout spreads them, and the same spec generates the text description a screen reader gets |
| **Display type** | The masthead sizes itself off its own column with container query units, instead of guessing at viewport breakpoints |
| **Builds gallery** | Vertical scroll pans a pinned horizontal track, releasing back to a normal stack when there isn't the height for it |
| **Console** | A working shell with command parsing, history and tab-completion — everything on the page is queryable from it |
| **Power menu** | The desktop metaphor taken to its conclusion: sleep, restart and a CRT power-off that drops back to the start screen, plus a shut-down button at the foot of the document |

---

## Bugs worth writing down

Building this turned up a handful of failures that were more interesting than the
features. Keeping them here because in every case the symptom pointed somewhere
other than the cause.

### A sphere squashed into a sliver

The projects globe rendered as a thin vertical line in production, and nowhere else.

Mounting races the layout pass that pins the section. Until that runs, the pinned
viewport isn't sticky and isn't `100vh` — it's only as tall as its own heading, about
**54 px**. A mount that won the race sized the drawing buffer to 1280×54 and baked an
aspect ratio of **23.7** into the projection matrix, squashing x more than tenfold.
Pinning then stretched that 54-pixel buffer up into a full-height box, which is where
the *tall* part of the sliver came from.

Nothing corrected it, because the resize handler only listened to the **window** — and
being pinned isn't a window resize. The canvas now watches its own box with a
`ResizeObserver`. It never reproduced locally because a warm cache let the layout pass
win the race every time.

### Landmasses that came out black

Each project's id was packed into the alpha channel of the map texture — tidy, and
quietly wrong. Canvas backing stores are **premultiplied**, so writing an id of `1`
into alpha means `1/255 ≈ 0.004`, and `putImageData` multiplies that pixel's colour by
it on the way in. Every landmass rendered near-black inside its own coastline. Art and
ids are two opaque textures now.

### A tab switch condemning the lens to its fallback

Leaving the site for another app and coming back left the hero warp in its low-power
fallback — glyphs shoved around individually instead of the smooth filter — until a
reload.

The frame-budget watchdog counted every gap between `requestAnimationFrame` callbacks
as a frame time. rAF doesn't run in a background tab, so the first callback after
switching back reports *the entire time you were away* as one frame. Forty-five seconds
elsewhere arrives as a single 45,000 ms sample, which on its own drags a sixty-sample
mean to 750 ms against a 55 ms threshold. A machine holding a comfortable 60 fps got
demoted because its owner looked at something else. Gaps over 200 ms are now treated as
pauses rather than costs.

### One throwing subscriber killing every scroll effect

The shared scroll bus sets a latch, then clears it inside the rAF callback — with
nothing catching a throw. A single failing subscriber left the latch set forever and
took the rail, section theming, the progress bar, the pinned gallery and the globe down
with it, permanently, until reload. Subscribers are isolated now and the latch always
clears.

### The lens that never let go

`lensState()` reported `live` as "has the pointer moved", which latches true from the
first movement until the pointer leaves the window entirely. It never asked whether the
hole was still on screen. Scrolling out of the hero stops the starfield and fades the
canvas — but the DOM warp kept being applied, and the nav is `position: fixed`, so it
sat there permanently distorted. `live` now requires the simulation to be running, so
the text warp shares the hole's lifetime.

### A dwell that landed between projects

The globe holds still on each project as you scroll past it. The easing that produced
the hold put its flat section at the *step boundary* — which is exactly where the
caption swaps. So the planet stopped moving precisely as the text changed, and raced
through the middle of each step where it should have been resting. Inverting it fixed
all six.

A companion bug in the same feature: longitudes were assigned ascending, but the yaw
needed to face each one is its negation, which then *descends*. The unwrap that keeps
rotation monotonic responded by adding a whole extra revolution between every pair —
six spins where there should have been one.

### Filter, then clip, then mask

The cards' lightning border is a gradient masked into a thin band and torn apart by a
displacement filter. Doing both on one element renders nothing useful: CSS applies
**filter, then clip, then mask**, so the ring gets displaced and then clipped straight
back into a rectangle. The ring lives in a nested element so the mask happens
underneath the filter — the only arrangement where any of the crackle escapes the box.

### Enter meant the opposite of what the button said

The boot screen has a START button and a SKIP button. Pressing Enter while SKIP had
focus started the boot sequence.

A window-level `keydown` handler claimed Enter to start the boot, without asking what
had focus. Both controls are real `<button>` elements, so the browser was already
going to turn Enter into a click on whichever one was focused — the handler simply got
there first and called `run()` before the click could fire. The visible effect was a
button that did the opposite of its label, and a keyboard visitor with no way past the
gate except sitting through the whole sequence.

### A diagram that ignored the palette entirely

The case-study architecture drawing reads the live accent every frame. It rendered
violet in every section, including the green one and the amber one.

`--accent-a` is registered with `@property`. That registration is what makes it
interpolate — and it also means `getPropertyValue` hands back the *computed* value,
`rgb(184, 122, 40)`, rather than the hex that was authored. The canvas helper parsed
that with `parseInt(v, 16)`, got `NaN`, and fell through to its hardcoded fallback.
The fallback was the old violet, which looked enough like a deliberate choice to
survive every visual pass over it.

### A selector that could never match anything

`html.fx-off :root { transition: none; }` was there to stop the palette interpolating
when effects are switched off.

`:root` *is* `html`. A descendant combinator between the two asks for an html element
inside an html element, which no document contains. The rule parsed, validated, and
never applied. Turning effects off stopped every animation on the page except the one
that rule was written for.

### Focus stranded behind the boot screen

Finishing the boot left the keyboard in the middle of the document.

Focus was still on the button inside the boot overlay when it closed, and Tab resumes
from wherever focus is — so the next press went to whatever followed the overlay in
source order, skipping the skip link and the entire nav. Nothing looked wrong, because
nothing looks wrong until you try to navigate without a mouse.

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
  main.js           boot sequence, hyperlapse, cursor, terminal, command palette
  bolt.js           cursor-reactive lightning borders on the content cards
  orbit.js          the builds globe — WebGL2, one landmass per project
  schema.js         per-project architecture diagrams, generated as inline SVG
  power.js          sleep, restart, shut down
assets/icons/       local SVG logos and Tabler glyphs — no icon CDN
```

Sections declare their own background. Adding one is a matter of markup:

```html
<section data-field="lattice" data-a="#B87A28" data-b="#D9A24E"
         data-morph="0.9" data-density="0.34" data-op="0.6">
```

`data-a` and `data-b` are that section's step on the amber arc: deeper for the long
reads, brighter at the two peaks and at the call to action.

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
- Keyboard: a skip link is the first stop on Tab, `⌘K` / `Ctrl+K` opens the command
  palette, `Enter` permutes the stack matrix, and the dock and console are reachable
  by tab. Finishing the boot hands focus to `<main>` rather than leaving it inside the
  overlay.
- Every control has a visible focus ring, including the two inputs that had removed
  theirs, and every tap target clears 24 × 24 CSS pixels on touch.
- Diagrams carry a generated text description of the same graph, built from the spec
  so it cannot drift from the drawing.

Layout is verified from 360 px to 1920 px with no horizontal overflow.

---

## Browser support

Built for current Chrome, Edge, Safari and Firefox. A few modern features degrade
rather than break: `@property` colour interpolation falls back to instant palette
swaps, container query units fall back to a viewport-based clamp, and the text warp
removes itself if the frame budget says no.

Some of that degradation is deliberate rather than defensive. Interpolating the accent
cascades a colour transition through every element that resolves through it, and
colour is not compositable, so it repaints — measured at roughly half the main thread
for the length of the transition on a throttled phone. Touch devices get the same
palette applied instantly. The canvases read one graphics budget, decided once at
load, that lowers pixel ratio and particle density on coarse-pointer and low-core
machines: a phone was previously drawing desktop-tuned particle floors into twice as
many device pixels as it has CSS ones.

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

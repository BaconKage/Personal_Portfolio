/* ═══════════════════════════════════════════════════════
   BOLT — cursor-reactive lightning borders on the cards
   ───────────────────────────────────────────────────────
   Every content card (builds, research, stats, off-stack)
   gets a hairline ring that only exists while the pointer
   is over it. The ring is a masked gradient; an SVG
   turbulence displacement tears it into filaments, and a
   radial hot-spot tracks the cursor so the arcs crowd
   toward whatever edge you are nearest.

   The ring lives in a real child element rather than a
   pseudo-element on purpose: CSS renders filter → clip →
   mask, so a single element would displace the ring and
   then clip it straight back into a rectangle. Nesting
   puts the mask underneath the filter, which is the only
   way any crackle escapes the box.
   ═══════════════════════════════════════════════════════ */

(() => {
  'use strict';

  const SEL = '.pcard, .cert-card, .statline, .beyond-card';
  const NS = 'http://www.w3.org/2000/svg';
  const CRACKLE = 78;   // ms between re-seeds — ~13Hz reads as arcing, 60Hz reads as liquid

  // Nothing here means anything without a hovering pointer, and the filter is
  // the most expensive thing on the page. Same gate the cursor and tilt use.
  if (window.matchMedia('(hover: none), (pointer: coarse)').matches) return;

  const cards = Array.from(document.querySelectorAll(SEL));
  if (!cards.length) return;

  /* ── the shared warp ──
     One filter for the whole document: only one card can be hovered, so only
     one element is ever filtered. objectBoundingBox with a small pad rather
     than the region-blowing percentages that cost textlens.js its filter on
     weak GPUs — 124% of a card is a few hundred px, not a viewport. */
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  svg.innerHTML =
    '<defs>' +
      '<filter id="boltWarp" x="-14%" y="-14%" width="128%" height="128%" ' +
              'color-interpolation-filters="sRGB">' +
        '<feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" ' +
                      'seed="1" result="n"/>' +
        '<feDisplacementMap in="SourceGraphic" in2="n" scale="13" ' +
                           'xChannelSelector="R" yChannelSelector="G"/>' +
      '</filter>' +
    '</defs>';
  document.body.appendChild(svg);
  const turb = svg.querySelector('feTurbulence');

  cards.forEach((card) => {
    const bolt = document.createElement('span');
    bolt.className = 'bolt';
    bolt.setAttribute('aria-hidden', 'true');
    bolt.innerHTML = '<i class="bolt-ring"></i>';
    card.appendChild(bolt);
    card.dataset.bolt = '';
  });

  let on = false;          // fx manager state
  let warped = true;       // false once the frame budget forces the plain glow
  let active = null;       // the hovered card, at most one
  let frame = 0;
  let px = 0, py = 0;
  let seed = 1, seedT = 0;
  let samples = 0, total = 0, lastT = 0;

  const onMove = (e) => { px = e.clientX; py = e.clientY; };

  /* ── frame budget ──
     Downgrade rather than switch off, the same bargain textlens.js strikes:
     a machine that cannot afford the displacement can still afford a glowing
     rim, and the visitor did ask for effects. */
  function budget(now) {
    if (!warped) { lastT = now; return; }
    if (lastT) {
      total += now - lastT;
      if (++samples >= 60) {
        if (total / samples > 55) {          // under ~18fps: genuinely unusable
          warped = false;
          document.documentElement.classList.add('bolt-plain');
        }
        samples = 0; total = 0;
      }
    }
    lastT = now;
  }

  // One rAF for the whole effect, running only while a card is hovered, and
  // writing to exactly one element per frame.
  function tick(now) {
    if (!active) { frame = 0; return; }
    frame = requestAnimationFrame(tick);

    const r = active.getBoundingClientRect();
    if (r.width && r.height) {
      active.style.setProperty('--bx', (((px - r.left) / r.width) * 100).toFixed(1) + '%');
      active.style.setProperty('--by', (((py - r.top) / r.height) * 100).toFixed(1) + '%');
    }

    if (warped && now - seedT > CRACKLE) {
      seedT = now;
      seed = (seed + 1 + Math.floor(Math.random() * 3)) % 97;
      turb.setAttribute('seed', String(seed));
      // a little frequency drift stops the arcs settling into a repeating shape
      turb.setAttribute('baseFrequency', (0.042 + Math.random() * 0.017).toFixed(4));
    }

    budget(now);
  }

  function onEnter(e) {
    active = e.currentTarget;
    px = e.clientX;
    py = e.clientY;
    lastT = 0; samples = 0; total = 0;
    if (!frame) frame = requestAnimationFrame(tick);
  }

  function onLeave(e) {
    if (e.currentTarget !== active) return;
    active.style.removeProperty('--bx');
    active.style.removeProperty('--by');
    active = null;
  }

  const api = {
    enable() {
      if (on) return;
      on = true;
      window.addEventListener('pointermove', onMove, { passive: true });
      cards.forEach((c) => {
        c.addEventListener('pointerenter', onEnter);
        c.addEventListener('pointerleave', onLeave);
      });
    },
    disable() {
      if (!on) return;
      on = false;
      window.removeEventListener('pointermove', onMove);
      cards.forEach((c) => {
        c.removeEventListener('pointerenter', onEnter);
        c.removeEventListener('pointerleave', onLeave);
        c.style.removeProperty('--bx');
        c.style.removeProperty('--by');
      });
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      active = null;
    },
  };

  // main.js calls straight through to enable/disable with the current state
  if (window.__fxRegister) window.__fxRegister(api);
  else api.enable();
})();

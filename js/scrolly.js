/* ═══════════════════════════════════════════════════════
   SCROLLYTELLING · SECTION THEMING · ARCHITECTURE DIAGRAM
   ───────────────────────────────────────────────────────
   Drives everything that reacts to scroll position:
     · per-section palette, formation and field intensity
     · split-text reveals and section rules
     · the sticky MyGym architecture diagram
     · the pinned horizontal build gallery
   ═══════════════════════════════════════════════════════ */

(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;

  const de = document.documentElement;
  const motionOn = () => de.classList.contains('fx-on');
  const isCoarse = window.matchMedia('(hover: none), (pointer: coarse)').matches;

  /* ═════════ 1 · NEURAL FIELD + SECTION THEMING ═════════ */

  const fieldCanvas = $('#fieldCanvas');
  const field = fieldCanvas && window.NeuralField ? window.NeuralField(fieldCanvas) : null;

  // the hero's wallpaper: a lensed starfield, live only over the first screen
  const skyCanvas = $('#skyCanvas');
  const sky = skyCanvas && window.BlackHoleSky ? window.BlackHoleSky(skyCanvas) : null;

  /* The same lens applied to the hero copy, so the hole warps words as well
     as stars. Driven off the sky's hole so both share one centre. */
  (function textWarp() {
    if (!sky || !window.TextLens || isCoarse) return;
    if (!$('[data-warp]')) return;
    const lens = window.TextLens({ radius: 52 });
    let raf;
    const tick = (now) => {
      const s = sky.lensState();
      lens.update(s.x, s.y, s.live && motionOn(), now);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  })();

  const themed = $$('[data-field]');
  let currentSection = null;

  const applySection = (el) => {
    if (!el || el === currentSection) return;
    currentSection = el;

    const a = el.dataset.a || '#a855f7';
    const b = el.dataset.b || '#22d3ee';

    // Global accent swap — @property makes these transition as colours,
    // so every gradient, border and glow on the page morphs together.
    de.style.setProperty('--accent-a', a);
    de.style.setProperty('--accent-b', b);

    // The field is scenery behind body copy everywhere except the hero.
    // Pulling its opacity down per section is what keeps text readable.
    if (fieldCanvas) fieldCanvas.style.opacity = el.dataset.op ?? '0.4';

    if (field) {
      field.set({
        layout: el.dataset.field,
        morph: parseFloat(el.dataset.morph ?? '0.85'),
        density: parseFloat(el.dataset.density ?? '0.35'),
        link: parseFloat(el.dataset.link ?? '150'),
        speed: parseFloat(el.dataset.speed ?? '0.8'),
        pulseRate: parseFloat(el.dataset.pulse ?? '0.03'),
        a, b,
      });
    }

    const rail = $('#railLabel');
    if (rail && el.dataset.label) {
      rail.textContent = el.dataset.label;
      rail.classList.remove('swap');
      void rail.offsetWidth;
      rail.classList.add('swap');
    }
    const railNum = $('#railNum');
    if (railNum && el.dataset.num) railNum.textContent = el.dataset.num;
  };

  if (themed.length) {
    const obs = new IntersectionObserver(
      (entries) => {
        // pick the entry closest to the viewport middle so fast scrolls
        // still land on the section the visitor is actually looking at
        let best = null, bestDist = Infinity;
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          const r = en.target.getBoundingClientRect();
          const dist = Math.abs(r.top + r.height / 2 - window.innerHeight / 2);
          if (dist < bestDist) { bestDist = dist; best = en.target; }
        });
        if (best) applySection(best);
      },
      { rootMargin: '-38% 0px -38% 0px', threshold: [0, 0.2, 0.5] }
    );
    themed.forEach((s) => obs.observe(s));
    applySection(themed[0]);
  }

  if (field) {
    const FXhook = {
      enable: () => field.start(),
      disable: () => { field.stop(); field.settle(); },
    };
    (window.__fxRegister || ((h) => (motionOn() ? h.enable() : h.disable())))(FXhook);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) field.stop();
      else if (motionOn()) field.start();
    });
  }

  if (sky) {
    const nearHero = () => window.scrollY < window.innerHeight;
    (window.__fxRegister || ((h) => (motionOn() ? h.enable() : h.disable())))({
      enable: () => { if (nearHero()) sky.start(); else sky.settle(); },
      disable: () => { sky.stop(); sky.settle(); },
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) sky.stop();
      else if (motionOn() && nearHero()) sky.start();
    });
  }

  /* ═════════ 2 · SPLIT TEXT + SECTION RULES ═════════ */

  // Wrap each word in a masked span so headlines rise out of a clip
  // edge instead of just fading — reads far more editorial.
  $$('[data-split]').forEach((el) => {
    const mode = el.dataset.split;
    const raw = el.textContent.trim();
    el.textContent = '';
    const units = mode === 'chars' ? [...raw] : raw.split(/(\s+)/);
    let idx = 0;
    units.forEach((u) => {
      if (/^\s+$/.test(u)) { el.appendChild(document.createTextNode(' ')); return; }
      const mask = document.createElement('span');
      mask.className = 'sp-mask';
      const inner = document.createElement('span');
      inner.className = 'sp-unit';
      inner.style.setProperty('--i', idx++);
      inner.textContent = u;
      mask.appendChild(inner);
      el.appendChild(mask);
    });
  });

  const splitObs = new IntersectionObserver((entries, o) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('shown');
      o.unobserve(en.target);
    });
  }, { threshold: 0.25 });
  $$('[data-split]').forEach((el) => splitObs.observe(el));

  const headObs = new IntersectionObserver((entries, o) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('lit');
      o.unobserve(en.target);
    });
  }, { threshold: 0.4 });
  $$('.sec-head').forEach((el) => headObs.observe(el));

  /* ═════════ 3 · SHARED SCROLL BUS ═════════ */

  // Every scroll-driven module subscribes here rather than adding its
  // own listener, so the page does one rAF-throttled pass per frame.
  const subs = [];
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      /* Isolate the subscribers and always clear the latch. This bus drives
         the rail, section theming, the progress bar, the pinned gallery and
         the globe — if one subscriber threw, `ticking` stayed true and every
         scroll-driven thing on the page went dead for good. */
      for (const fn of subs) {
        try { fn(); } catch (e) {}
      }
      ticking = false;
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  /* ═════════ 4 · MYGYM ARCHITECTURE DIAGRAM ═════════ */

  (function architecture() {
    const cv = $('#archCanvas');
    const wrap = $('#caseScrolly');
    if (!cv || !wrap) return;

    const ctx = cv.getContext('2d');
    const steps = $$('.step', wrap);

    /* The system, told in the order the prose tells it. Positions are
       normalised so a resize rescales rather than relays out. `stage` is
       the step a piece enters on; `until` is the step it fades out after,
       which is how the scattered before-state clears away. */
    const NODES = [
      // 0 · the mess it replaces
      { id: 't1', x: 0.15, y: 0.15, label: 'WhatsApp',   sub: 'messages',    stage: 0, until: 0, kind: 'tool' },
      { id: 't2', x: 0.47, y: 0.09, label: 'Spreadsheet', sub: 'leads',      stage: 0, until: 0, kind: 'tool' },
      { id: 't3', x: 0.80, y: 0.18, label: 'Forms',      sub: 'assessments', stage: 0, until: 0, kind: 'tool' },
      { id: 't4', x: 0.19, y: 0.56, label: 'Calendar',   sub: 'bookings',    stage: 0, until: 0, kind: 'tool' },
      { id: 't5', x: 0.52, y: 0.70, label: 'Notes',      sub: 'per trainer', stage: 0, until: 0, kind: 'tool' },
      { id: 't6', x: 0.83, y: 0.55, label: 'Accounting', sub: 'payments',    stage: 0, until: 0, kind: 'tool' },

      // 1 · the member's journey, one linked chain
      { id: 'lead',  x: 0.10, y: 0.33, label: 'Lead',     sub: 'enquiry',    stage: 1, kind: 'stage' },
      { id: 'sale',  x: 0.30, y: 0.33, label: 'Sale',     sub: 'consult',    stage: 1, kind: 'stage' },
      { id: 'onb',   x: 0.50, y: 0.33, label: 'Onboard',  sub: 'handoff',    stage: 1, kind: 'stage' },
      { id: 'coach', x: 0.70, y: 0.33, label: 'Coach',    sub: 'plan',       stage: 1, kind: 'stage' },
      { id: 'prog',  x: 0.90, y: 0.33, label: 'Progress', sub: 'check-ins',  stage: 1, kind: 'stage' },

      // 2 · who looks at it
      { id: 'web', x: 0.30, y: 0.08, label: 'Web console', sub: 'staff',          stage: 2, kind: 'client' },
      { id: 'mob', x: 0.70, y: 0.08, label: 'Mobile app',  sub: 'staff + member', stage: 2, kind: 'client' },

      // 3 · the single source of truth, 4 · what it stands on
      { id: 'api', x: 0.50, y: 0.63, label: 'One API',    sub: 'rules · roles · limits', stage: 3, kind: 'svc' },
      { id: 'db',  x: 0.50, y: 0.87, label: 'PostgreSQL', sub: '23 linked records',      stage: 4, kind: 'svc' },
    ];

    const EDGES = [
      { a: 'lead',  b: 'sale',  stage: 1 },
      { a: 'sale',  b: 'onb',   stage: 1 },
      { a: 'onb',   b: 'coach', stage: 1 },
      { a: 'coach', b: 'prog',  stage: 1 },

      { a: 'web', b: 'api', stage: 3 },
      { a: 'mob', b: 'api', stage: 3 },

      { a: 'lead',  b: 'api', stage: 3, faint: true },
      { a: 'sale',  b: 'api', stage: 3, faint: true },
      { a: 'onb',   b: 'api', stage: 3, faint: true },
      { a: 'coach', b: 'api', stage: 3, faint: true },
      { a: 'prog',  b: 'api', stage: 3, faint: true },

      { a: 'api', b: 'db', stage: 4, note: 'validated' },
    ];

    // box width relative to the base, per kind
    const WIDTH = { tool: 1.12, stage: 1, client: 1.3, svc: 1.95 };

    const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));
    let W = 0, H = 0, S = 1, BW = 132, BH = 46;
    let stage = 0, stageF = 0;
    let pulses = [];
    let raf = null, live = false;

    const layout = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = cv.getBoundingClientRect();
      W = r.width; H = r.height;
      if (W < 2 || H < 2) return;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // One scale factor keeps boxes and type proportional across the short
      // mobile frame and the tall desktop one. The floor matters: below
      // ~0.86 the service labels fall under 10px and stop being readable,
      // which is worse than the boxes sitting a little tighter.
      S = clamp(Math.min(W / 620, H / 460), 0.86, 1.15);
      // Five lifecycle boxes have to sit side by side, so the base box is
      // capped against the canvas width and each kind scales from there.
      // Centres are clamped so nothing can run off the edge.
      BW = Math.min(112 * S, W * 0.175);
      BH = 46 * S;
      NODES.forEach((n) => {
        n.bw = BW * (WIDTH[n.kind] || 1);
        n.px = clamp(n.x * W, n.bw / 2 + 2, W - n.bw / 2 - 2);
        n.py = clamp(n.y * H, BH / 2 + 2, H - BH / 2 - 2);
      });
    };

    const css = (name, fb) =>
      getComputedStyle(de).getPropertyValue(name).trim() || fb;

    const rgba = (hex, a) => {
      const s = hex.replace('#', '').trim();
      const v = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
      const n = parseInt(v, 16);
      if (Number.isNaN(n)) return `rgba(168,85,247,${a})`;
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    };

    const nodeBox = (n) => ({ x: n.px - n.bw / 2, y: n.py - BH / 2, w: n.bw, h: BH });

    /* How visible a node is right now: fades in at `stage`, and back out
       after `until` when one is set. */
    const vis = (n) => {
      const inAmt = clamp(stageF - n.stage + 1, 0, 1);
      const outAmt = n.until === undefined ? 1 : clamp(n.until - stageF + 1, 0, 1);
      return inAmt * outAmt;
    };

    /* Shrink a label until it fits its box — guarantees no overflow at any
       canvas size, which fixed-size type cannot. */
    const fitText = (text, maxW, basePx, weight, fontFn) => {
      let px = basePx;
      ctx.font = fontFn(px, weight);
      while (px > 6.5 && ctx.measureText(text).width > maxW) {
        px -= 0.5;
        ctx.font = fontFn(px, weight);
      }
      return px;
    };

    // where an edge should meet a box, so lines stop at the border
    const anchor = (from, to) => {
      const b = nodeBox(from);
      const dx = to.px - from.px, dy = to.py - from.py;
      const hw = b.w / 2, hh = b.h / 2;
      const sx = dx === 0 ? Infinity : hw / Math.abs(dx);
      const sy = dy === 0 ? Infinity : hh / Math.abs(dy);
      const t = Math.min(sx, sy);
      return { x: from.px + dx * t, y: from.py + dy * t };
    };

    const roundRect = (x, y, w, h, r) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };

    const activeEdges = () => EDGES.filter((e) => stageF >= e.stage - 0.35);

    const spawn = () => {
      const list = activeEdges();
      if (!list.length || pulses.length > 14) return;
      const e = list[(Math.random() * list.length) | 0];
      pulses.push({ e, t: 0, v: 0.010 + Math.random() * 0.014 });
    };

    const draw = () => {
      if (!W) { raf = requestAnimationFrame(draw); return; }
      stageF = lerp(stageF, stage, 0.085);
      ctx.clearRect(0, 0, W, H);

      const A = css('--accent-a', '#6366f1');
      const B = css('--accent-b', '#38bdf8');
      const now = performance.now();
      const fontMono = (px, weight) =>
        `${weight || 500} ${Math.round(px * S)}px "JetBrains Mono", ui-monospace, monospace`;

      /* ── connections ── */
      EDGES.forEach((e) => {
        const on = clamp(stageF - e.stage + 1, 0, 1);
        if (on <= 0.01) return;
        const from = byId[e.a], to = byId[e.b];
        const p1 = anchor(from, to), p2 = anchor(to, from);
        const strength = e.faint ? 0.26 : 1;
        const g = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
        g.addColorStop(0, rgba(A, (0.15 + on * 0.5) * strength));
        g.addColorStop(1, rgba(B, (0.15 + on * 0.5) * strength));
        ctx.strokeStyle = g;
        ctx.lineWidth = (1 + on * 0.6) * S * (e.faint ? 0.75 : 1);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        if (e.note && on > 0.6) {
          ctx.font = fontMono(9, 400);
          ctx.fillStyle = rgba(B, on * 0.8);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(e.note, (p1.x + p2.x) / 2 + 8 * S, (p1.y + p2.y) / 2);
        }
      });

      /* ── requests in flight ── */
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        p.t += p.v;
        if (p.t >= 1) { pulses.splice(i, 1); continue; }
        const from = byId[p.e.a], to = byId[p.e.b];
        const p1 = anchor(from, to), p2 = anchor(to, from);
        const x = lerp(p1.x, p2.x, p.t), y = lerp(p1.y, p2.y, p.t);
        const f = Math.sin(p.t * Math.PI);
        ctx.beginPath();
        ctx.arc(x, y, 6 * f * S, 0, 6.2832);
        ctx.fillStyle = rgba(B, f * 0.22);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, 2.1 * S, 0, 6.2832);
        ctx.fillStyle = `rgba(255,255,255,${f})`;
        ctx.fill();
      }

      /* ── boxes ── */
      NODES.forEach((n) => {
        const v = vis(n);
        if (v <= 0.02) return;

        const b = nodeBox(n);
        const isTool = n.kind === 'tool';
        const col = n.kind === 'svc' ? B : n.kind === 'client' ? B : A;
        const breathe = 0.5 + 0.5 * Math.sin(now * 0.0018 + n.px);

        if (!isTool && v > 0.2) {
          ctx.save();
          ctx.shadowColor = rgba(col, 0.5 * v);
          ctx.shadowBlur = 22 * S * (0.6 + breathe * 0.4);
          roundRect(b.x, b.y, b.w, b.h, 3 * S);
          ctx.fillStyle = 'rgba(8,4,18,0.92)';
          ctx.fill();
          ctx.restore();
        } else {
          roundRect(b.x, b.y, b.w, b.h, 3 * S);
          ctx.fillStyle = 'rgba(8,4,18,0.72)';
          ctx.fill();
        }

        roundRect(b.x, b.y, b.w, b.h, 3 * S);
        if (isTool) {
          // the before-state reads as provisional: grey, dashed, unconnected
          ctx.setLineDash([4 * S, 4 * S]);
          ctx.strokeStyle = `rgba(150,142,172,${0.5 * v})`;
        } else {
          ctx.strokeStyle = rgba(col, 0.22 + v * 0.72);
        }
        ctx.lineWidth = 1 * S;
        ctx.stroke();
        ctx.setLineDash([]);

        if (!isTool && v > 0.05) {
          ctx.fillStyle = rgba(col, v);
          ctx.fillRect(b.x, b.y, 2.5 * S, b.h);
        }

        const pad = 10 * S;
        const room = b.w - pad - 7 * S;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';

        const lp = fitText(n.label, room, 12.5, 600, fontMono);
        ctx.font = fontMono(lp, 600);
        ctx.fillStyle = isTool
          ? `rgba(176,169,198,${0.45 + v * 0.4})`
          : `rgba(242,240,248,${0.32 + v * 0.68})`;
        ctx.fillText(n.label, b.x + pad, b.y + 20 * S);

        const sp = fitText(n.sub, room, 9.5, 400, fontMono);
        ctx.font = fontMono(sp, 400);
        ctx.fillStyle = isTool
          ? `rgba(150,142,172,${0.45 * v})`
          : rgba(col, 0.35 + v * 0.55);
        ctx.fillText(n.sub, b.x + pad, b.y + 34 * S);
      });

      /* ── stage 0 caption ── */
      const empty = clamp(1 - stageF * 1.6, 0, 1);
      if (empty > 0.02) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = fontMono(12, 400);
        ctx.fillStyle = `rgba(170,162,192,${empty * 0.95})`;
        ctx.fillText('nothing talks to anything', W / 2, H * 0.36);
      }

      /* ── fail-closed marker, once the database is in ── */
      const guarded = clamp(stageF - 3.5, 0, 1);
      if (guarded > 0.02) {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = fontMono(9, 400);
        ctx.fillStyle = `rgba(170,162,192,${guarded * 0.85})`;
        ctx.fillText('malformed response → error, never data', 14 * S, H - 16 * S);
      }

      /* ── status marker on the final step ── */
      const shipped = clamp(stageF - 4.4, 0, 1);
      if (shipped > 0.02) {
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.font = fontMono(9.5, 600);
        ctx.fillStyle = rgba('#34d399', shipped);
        ctx.fillText('● CLIENT DEMO COMPLETE · PILOT NEXT', W - 14 * S, H - 16 * S);
      }

      if (live && Math.random() < 0.14) spawn();
      raf = requestAnimationFrame(draw);
    };

    /* ── step tracking ──
       An IntersectionObserver with a fixed rootMargin gets this wrong in
       the stacked layout, where the sticky diagram eats the top of the
       viewport and the prose is centred in what's left. Measuring against
       a reference line we compute per layout keeps the two in sync. */
    const viz = $('.scrolly-viz', wrap);
    const stepsCol = $('.scrolly-steps', wrap);
    let activeIdx = -1;

    const refLine = () => {
      const v = viz.getBoundingClientRect();
      const s = stepsCol.getBoundingClientRect();
      const stacked = s.left < v.right - 4;
      if (!stacked) return window.innerHeight / 2;
      const top = Math.max(v.bottom, 0);
      return top + (window.innerHeight - top) / 2;
    };

    const pickStep = () => {
      if (!steps.length) return;
      const ref = refLine();
      let best = 0, bestD = Infinity;
      steps.forEach((s, i) => {
        const r = s.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - ref);
        if (d < bestD) { bestD = d; best = i; }
      });
      if (best === activeIdx) return;
      activeIdx = best;
      steps.forEach((s, i) => s.classList.toggle('active', i === best));
      stage = best;
      const cap = $('#archCaption');
      if (cap) cap.textContent = steps[best].dataset.caption || '';
    };

    layout();
    window.addEventListener('resize', layout);
    subs.push(pickStep);
    pickStep();

    new IntersectionObserver((es) => es.forEach((en) => {
      live = en.isIntersecting && motionOn();
      cancelAnimationFrame(raf);
      if (en.isIntersecting) draw();
    }), { threshold: 0 }).observe(cv);

    draw();
  })();

  /* ═════════ 5 · PINNED HORIZONTAL GALLERY ═════════ */

  (function pinnedGallery() {
    const section = $('#projects');
    const track = $('#projTrack');
    const bar = $('#projBar');
    if (!section || !track) return;

    // must match the pin media query in editorial.css
    const supportsPin = () =>
      window.matchMedia('(min-width: 901px) and (min-height: 640px)').matches;
    let travel = 0;

    const measure = () => {
      if (!supportsPin()) {
        section.style.height = '';
        track.style.transform = '';
        section.classList.remove('pinned');
        return;
      }
      section.classList.add('pinned');
      track.style.transform = 'translate3d(0,0,0)';
      travel = Math.max(0, track.scrollWidth - window.innerWidth + window.innerWidth * 0.08);
      // vertical scroll distance needed to pan the whole track sideways
      section.style.height = window.innerHeight + travel + 'px';
      update();
    };

    const update = () => {
      if (!supportsPin() || !travel) return;
      const r = section.getBoundingClientRect();
      const p = clamp(-r.top / (section.offsetHeight - window.innerHeight), 0, 1);
      if (bar) bar.style.transform = `scaleX(${p})`;

      /* The sphere takes the same progress the track would have used, and the
         section keeps its original scroll length either way. Only paint while
         the pinned viewport is actually on screen. */
      const orbit = window.ProjectOrbit;
      if (orbit && orbit.active) {
        orbit.setProgress(p);
        orbit.setVisible(r.top < window.innerHeight && r.bottom > 0);
        return;
      }

      track.style.transform = `translate3d(${-p * travel}px,0,0)`;
      $$('.pcard', track).forEach((card) => {
        const cr = card.getBoundingClientRect();
        const centre = (cr.left + cr.width / 2 - window.innerWidth / 2) / window.innerWidth;
        card.style.setProperty('--drift', (-centre * 22).toFixed(2) + 'px');
        card.classList.toggle('near', Math.abs(centre) < 0.34);
      });
    };

    subs.push(update);
    window.addEventListener('resize', measure);
    window.addEventListener('load', measure);
    measure();
  })();

  /* ═════════ 6 · HERO EXIT + PARALLAX ═════════ */

  subs.push(() => {
    const hero = $('#hero');
    if (hero) {
      const p = clamp(window.scrollY / window.innerHeight, 0, 1);
      hero.style.setProperty('--exit', p.toFixed(3));
      // the wallpaper crossfades to the neural field across the same range
      de.style.setProperty('--hero-exit', p.toFixed(3));
      if (motionOn()) {
        // only one background loop runs at a time: the wallpaper owns the
        // hero, the field owns everything below it, and they overlap just
        // long enough to hand over mid-crossfade
        if (p < 0.995) sky.start?.(); else sky.stop?.();
        if (p > 0.12) field?.start(); else field?.stop();
      }
    }
    $$('[data-parallax]').forEach((el) => {
      const r = el.getBoundingClientRect();
      const p = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;
      el.style.transform = `translate3d(0, ${(-p * parseFloat(el.dataset.parallax)).toFixed(1)}px, 0)`;
    });
  });
  onScroll();

  /* ═════════ 7 · DESKTOP: MENU BAR, DOCK, WINDOW ═════════ */

  // `at-top` is what swaps the page between "macOS desktop" and "document":
  // menu bar vs nav, dock vs dot-nav. One class, both wardrobes.
  (function desktopState() {
    let atTop = null;
    const sync = () => {
      const next = window.scrollY < window.innerHeight * 0.32;
      if (next === atTop) return;
      atTop = next;
      de.classList.toggle('at-top', next);
    };
    subs.push(sync);
    sync();
  })();

  /* Dock magnification — icons swell with proximity, exactly like the real
     thing. Written straight to CSS vars each frame; the settle animation is
     handled by a class so tracking stays 1:1 while the cursor is over it. */
  (function dock() {
    const dock = $('#osDock');
    if (!dock) return;
    const tray = $('.dock-tray', dock);
    const items = $$('.dock-item', dock);
    if (!items.length) return;

    const MAX = 0.62;    // extra scale at the cursor
    const REACH = 130;   // px of falloff either side
    let frame = null;

    const apply = (mx) => {
      items.forEach((it) => {
        const r = it.getBoundingClientRect();
        const d = Math.abs(r.left + r.width / 2 - mx);
        const f = Math.max(0, 1 - d / REACH);
        const eased = f * f * (3 - 2 * f);          // smoothstep
        const s = 1 + MAX * eased;
        it.style.setProperty('--s', s.toFixed(3));
        it.style.setProperty('--ty', (-eased * 13).toFixed(2) + 'px');
      });
    };

    if (!isCoarse) {
      tray.addEventListener('pointermove', (e) => {
        dock.classList.remove('resting');
        if (frame) cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => apply(e.clientX));
      });
      tray.addEventListener('pointerleave', () => {
        dock.classList.add('resting');
        items.forEach((it) => {
          it.style.setProperty('--s', '1');
          it.style.setProperty('--ty', '0px');
        });
      });
      dock.classList.add('resting');
    }

    // running-app dots follow the section you're actually in
    const secs = items.map((it) => it.dataset.sec).filter(Boolean);
    subs.push(() => {
      const mid = window.innerHeight / 2;
      let best = null, bestD = Infinity;
      secs.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        const r = el.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - mid);
        if (d < bestD) { bestD = d; best = id; }
      });
      items.forEach((it) => it.classList.toggle('active', !!it.dataset.sec && it.dataset.sec === best));
    });
  })();

  /* The identity window: draggable by its title bar, closable by the red
     light, and restored from the dock — the small pieces of "this is a real
     desktop" that make people actually try things. */
  (function identityWindow() {
    const win = $('#osWin');
    const bar = $('#osWinBar');
    const closeBtn = $('#osWinClose');
    const dockBtn = $('#dockIdentity');
    if (!win || !bar) return;

    const floating = () => window.matchMedia('(min-width: 1101px)').matches;
    let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;

    bar.addEventListener('pointerdown', (e) => {
      if (!floating() || e.target.closest('button')) return;
      const r = win.getBoundingClientRect();
      const p = win.offsetParent.getBoundingClientRect();
      // switch from right-anchored to left/top so dragging has one origin
      ox = r.left - p.left;
      oy = r.top - p.top;
      win.style.left = ox + 'px';
      win.style.top = oy + 'px';
      win.style.right = 'auto';
      sx = e.clientX; sy = e.clientY;
      dragging = true;
      win.classList.add('dragging');
      bar.setPointerCapture(e.pointerId);
    });

    bar.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const p = win.offsetParent.getBoundingClientRect();
      // keep the window reachable — never let it leave the viewport
      const nx = clamp(ox + e.clientX - sx, -p.left + 8, window.innerWidth - p.left - win.offsetWidth - 8);
      const ny = clamp(oy + e.clientY - sy, -p.top + 44, window.innerHeight - p.top - 60);
      win.style.left = nx + 'px';
      win.style.top = ny + 'px';
    });

    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      win.classList.remove('dragging');
      try { bar.releasePointerCapture(e.pointerId); } catch (err) {}
    };
    bar.addEventListener('pointerup', endDrag);
    bar.addEventListener('pointercancel', endDrag);

    closeBtn?.addEventListener('click', () => win.classList.add('closed'));
    dockBtn?.addEventListener('click', () => {
      win.classList.toggle('closed');
      if (!win.classList.contains('closed')) {
        win.animate(
          [{ transform: 'scale(0.9)', opacity: 0.4 }, { transform: 'scale(1)', opacity: 1 }],
          { duration: 320, easing: 'cubic-bezier(.22,1,.36,1)' }
        );
      }
    });

    // a window dragged on desktop must not keep stale coordinates on mobile
    window.addEventListener('resize', () => {
      if (!floating()) { win.style.left = ''; win.style.top = ''; win.style.right = ''; }
    });
  })();

  /* ═════════ 8 · STACK MATRIX — hover to wire, click to permute ═════════ */

  (function matrix() {
    const grid = $('#stackMatrix');
    const readout = $('#matrixOp');
    if (!grid) return;

    const colCount = () =>
      getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;

    /* The grid is padded to a full rectangle with inert cells. Without
       that the last row is ragged and a row/column swap would tear holes
       through the middle of the matrix. */
    const pad = () => {
      $$('.mcell-void', grid).forEach((v) => v.remove());
      const real = $$('.mcell', grid).length;
      const cols = colCount();
      if (!cols) return;
      const missing = (cols - (real % cols)) % cols;
      for (let i = 0; i < missing; i++) {
        const v = document.createElement('div');
        v.className = 'mcell mcell-void';
        v.setAttribute('aria-hidden', 'true');
        grid.appendChild(v);
      }
    };

    /* FLIP: measure, reorder, invert, then release. Animating grid reflow
       any other way just snaps. */
    let settleTimer;
    const flip = (mutate) => {
      const cells = $$('.mcell', grid);

      // Clear any in-flight inversion first, so a fast second click measures
      // from the settled grid instead of compounding the previous offsets.
      cells.forEach((c) => { c.style.transition = 'none'; c.style.transform = ''; });
      void grid.offsetWidth;

      const first = new Map(cells.map((c) => [c, c.getBoundingClientRect()]));
      mutate();
      const moved = [];
      cells.forEach((c) => {
        const a = c.getBoundingClientRect(), f = first.get(c);
        const dx = f.left - a.left, dy = f.top - a.top;
        if (!dx && !dy) return;
        c.style.transform = `translate(${dx}px, ${dy}px)`;
        moved.push(c);
      });

      requestAnimationFrame(() => {
        moved.forEach((c, i) => {
          // slight stagger so the grid ripples rather than moving as a slab
          c.style.transition = `transform 0.62s cubic-bezier(.22,1,.36,1) ${(i % 7) * 18}ms`;
          c.style.transform = '';
        });
      });

      // hand styling back to the stylesheet once the move is done, or the
      // inline transition would smother the hover transitions on .mcell
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        cells.forEach((c) => { c.style.transition = ''; c.style.transform = ''; });
      }, 900);
    };

    const permute = (fromCell) => {
      const cols = colCount();
      const cells = $$('.mcell', grid);
      const rows = Math.ceil(cells.length / cols);
      if (cols < 2 || rows < 2) return;

      const i = cells.indexOf(fromCell);
      const r1 = Math.floor(i / cols), c1 = i % cols;
      let r2 = r1, c2 = c1;
      while (r2 === r1) r2 = (Math.random() * rows) | 0;
      while (c2 === c1) c2 = (Math.random() * cols) | 0;

      flip(() => {
        // grid[r][c] as a 2D array, swap two rows and two columns, flatten
        const g = [];
        for (let r = 0; r < rows; r++) g.push(cells.slice(r * cols, r * cols + cols));
        [g[r1], g[r2]] = [g[r2], g[r1]];
        for (const row of g) [row[c1], row[c2]] = [row[c2], row[c1]];
        g.flat().forEach((c) => grid.appendChild(c));
      });

      fromCell.classList.remove('fired');
      void fromCell.offsetWidth;
      fromCell.classList.add('fired');

      if (readout) {
        readout.textContent = `R${r1} ↔ R${r2} · C${c1} ↔ C${c2}`;
        readout.classList.remove('flash');
        void readout.offsetWidth;
        readout.classList.add('flash');
      }
    };

    grid.addEventListener('click', (e) => {
      const cell = e.target.closest('.mcell');
      if (!cell || cell.classList.contains('mcell-void')) return;
      permute(cell);
    });

    /* Keyboard parity. The grid takes a single tab stop rather than 37 —
       Enter permutes from a random cell, same operation as a click. */
    grid.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      const real = $$('.mcell:not(.mcell-void)', grid);
      if (real.length) permute(real[(Math.random() * real.length) | 0]);
    });

    if (!isCoarse) {
      grid.addEventListener('pointerover', (e) => {
        const cell = e.target.closest('.mcell');
        if (!cell) return;
        const cells = $$('.mcell', grid);
        const cols = colCount();
        const i = cells.indexOf(cell);
        const row = Math.floor(i / cols), col = i % cols;
        cells.forEach((c, j) => {
          const r = Math.floor(j / cols), cc = j % cols;
          c.classList.toggle('wired', (r === row || cc === col) && j !== i);
        });
      });
      grid.addEventListener('pointerleave', () => {
        $$('.mcell', grid).forEach((c) => c.classList.remove('wired'));
      });
    }

    pad();
    let padTimer;
    window.addEventListener('resize', () => {
      clearTimeout(padTimer);
      padTimer = setTimeout(pad, 160);
    });
  })();
})();

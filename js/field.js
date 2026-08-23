/* ═══════════════════════════════════════════════════════
   NEURAL FIELD — one generative network, many formations
   ───────────────────────────────────────────────────────
   A single fixed-canvas particle graph that lives behind the
   whole page. Every node owns a target position produced by a
   *layout function*; changing the layout re-targets the swarm
   and the network physically reflows into its new shape.

   Formations:
     net      free constellation (drift, no targets)
     layers   feed-forward MLP — input → hidden → hidden → output
     matrix   weight matrix / dense grid
     flow     directed streams (gradient descent trails)
     lattice  modular grid cells
     entropy  noise-warped cloud (structural uncertainty)
     orbit    concentric rings
     funnel   convergence toward a point

   Edges are rebuilt from a uniform spatial hash so the cost
   stays ~O(n) instead of O(n²), and signal pulses travel the
   edges to sell the "network is thinking" read.
   ═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ── deterministic per-node randomness (stable across relayouts) ── */
  const hash = (i) => {
    let x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  /* ─────────── LAYOUT FUNCTIONS ───────────
     Each returns a normalized target { x, y } in 0..1 space for
     node `i` of `n`. Keeping them normalized means a resize never
     re-randomizes the formation — it just rescales it. */
  const LAYOUTS = {
    net(i, n) {
      // no attractor: nodes drift freely, springs go slack
      return null;
    },

    layers(i, n) {
      // 4-layer MLP; node counts weighted so hidden layers read wider
      const cols = [0.14, 0.32, 0.5, 0.68, 0.86];
      const per = Math.ceil(n / cols.length);
      const c = Math.min(Math.floor(i / per), cols.length - 1);
      const k = i - c * per;
      const inCol = Math.min(per, n - c * per);
      const spread = c === 0 || c === cols.length - 1 ? 0.42 : 0.74;
      const t = inCol <= 1 ? 0.5 : k / (inCol - 1);
      return { x: cols[c], y: 0.5 + (t - 0.5) * spread, layer: c };
    },

    matrix(i, n) {
      const cols = Math.round(Math.sqrt(n * 1.6));
      const rows = Math.ceil(n / cols);
      const cx = i % cols;
      const cy = Math.floor(i / cols);
      return {
        x: 0.12 + (cx / Math.max(1, cols - 1)) * 0.76,
        y: 0.14 + (cy / Math.max(1, rows - 1)) * 0.72,
      };
    },

    flow(i, n) {
      // parallel descent streams sloping down-right
      const lanes = 7;
      const lane = i % lanes;
      const along = Math.floor(i / lanes) / Math.max(1, Math.ceil(n / lanes) - 1);
      const y0 = 0.16 + (lane / (lanes - 1)) * 0.68;
      return {
        x: 0.06 + along * 0.88,
        y: y0 + Math.sin(along * 3.4 + lane) * 0.06 + along * 0.06,
      };
    },

    lattice(i, n) {
      // sparse modular cells — blocks with gutters
      const cols = 6;
      const rows = Math.ceil(n / cols);
      const cx = i % cols;
      const cy = Math.floor(i / cols);
      const jx = (hash(i) - 0.5) * 0.05;
      const jy = (hash(i + 91) - 0.5) * 0.05;
      return {
        x: 0.1 + (cx / (cols - 1)) * 0.8 + jx,
        y: 0.12 + (cy / Math.max(1, rows - 1)) * 0.76 + jy,
      };
    },

    entropy(i, n) {
      // structured start, noise-displaced — order decaying into uncertainty
      const a = hash(i) * Math.PI * 2;
      const r = 0.08 + Math.pow(hash(i + 17), 0.7) * 0.42;
      const wob = Math.pow(hash(i + 33), 2) * 0.22;
      return {
        x: 0.5 + Math.cos(a) * (r + wob) * 1.5,
        y: 0.5 + Math.sin(a) * (r + wob),
      };
    },

    orbit(i, n) {
      const rings = 4;
      const ring = i % rings;
      const k = Math.floor(i / rings);
      const perRing = Math.ceil(n / rings);
      const a = (k / perRing) * Math.PI * 2 + ring * 0.4;
      const r = 0.1 + (ring / (rings - 1)) * 0.34;
      return { x: 0.5 + Math.cos(a) * r * 1.45, y: 0.5 + Math.sin(a) * r };
    },

    funnel(i, n) {
      const t = i / (n - 1);
      const a = t * Math.PI * 8;
      const r = (1 - t) * 0.46;
      return { x: 0.5 + Math.cos(a) * r * 1.4, y: 0.5 + Math.sin(a) * r };
    },
  };

  /* ─────────── FIELD ─────────── */
  function NeuralField(canvas) {
    const ctx = canvas.getContext('2d', { alpha: true });
    let w = 0, h = 0, dpr = 1;
    let nodes = [];
    let edges = [];
    let pulses = [];
    let ripples = [];
    let raf = null, running = false;
    let lastEdgeBuild = 0;

    const mouse = { x: -9999, y: -9999, active: false };
    const REACH = 265;      // cursor influence radius
    const TETHER = 190;     // cursor draws lines to nodes inside this

    /* animated state — every visual parameter is lerped, so section
       changes read as a morph rather than a cut */
    const S = {
      layout: 'net',
      morph: 0,          // 0 = free drift, 1 = fully snapped to layout
      density: 1,        // node opacity/size multiplier
      link: 150,         // connection radius in px
      speed: 1,
      colA: [232, 163, 61],
      colB: [247, 208, 140],
      pulseRate: 0.02,
    };
    const T = { ...S, colA: S.colA.slice(), colB: S.colB.slice() };

    /* Accepts an authored hex or a computed rgb() string: registered custom
       properties resolve to the latter, and silently returning NaN channels
       paints the whole field black. */
    const hexToRgb = (col) => {
      const c = String(col).trim();
      const m = c.match(/rgba?\(([^)]+)\)/i);
      if (m) return m[1].split(',').slice(0, 3).map((v) => (parseFloat(v) | 0));
      const s = c.replace('#', '');
      const v = s.length === 3 ? s.split('').map((ch) => ch + ch).join('') : s;
      const n = parseInt(v, 16);
      if (Number.isNaN(n)) return [232, 163, 61];
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };

    /* ── build node set sized to the viewport ── */
    function build() {
      const area = w * h;
      const d = (window.__gfx && window.__gfx.density) || 1;
      const count = clamp(Math.round((area / 11000) * d), Math.round(70 * d), Math.round(230 * d));
      nodes = Array.from({ length: count }, (_, i) => ({
        i,
        x: hash(i) * w,
        y: hash(i + 7) * h,
        vx: (hash(i + 13) - 0.5) * 0.34,
        vy: (hash(i + 29) - 0.5) * 0.34,
        r: 0.9 + hash(i + 41) * 1.5,
        // per-node phase so activation shimmer isn't synchronised
        ph: hash(i + 53) * Math.PI * 2,
        act: 0,
        tx: 0, ty: 0, layer: -1, hasTarget: false,
      }));
      retarget();
    }

    /* ── recompute targets for the current layout ── */
    function retarget() {
      const fn = LAYOUTS[T.layout] || LAYOUTS.net;
      const n = nodes.length;
      for (let i = 0; i < n; i++) {
        const t = fn(i, n);
        const nd = nodes[i];
        if (!t) { nd.hasTarget = false; nd.layer = -1; continue; }
        nd.hasTarget = true;
        nd.tx = t.x * w;
        nd.ty = t.y * h;
        nd.layer = t.layer !== undefined ? t.layer : -1;
      }
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, (window.__gfx && window.__gfx.dprCap) || 2);
      w = window.innerWidth || document.documentElement.clientWidth;
      h = window.innerHeight || document.documentElement.clientHeight;
      // pre-layout reads 0; sizing to that would leave the canvas blank
      if (w < 2 || h < 2) { requestAnimationFrame(resize); return; }
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!nodes.length) build(); else retarget();
      if (!running) draw(0);
    }

    /* ── spatial hash → edge list.
       Rebuilt a few times a second rather than every frame; the graph
       is visually stable at that cadence and it keeps the loop cheap. ── */
    function buildEdges() {
      const R = S.link;
      const cell = R;
      const cols = Math.max(1, Math.ceil(w / cell));
      const rows = Math.max(1, Math.ceil(h / cell));
      const grid = new Map();
      for (const nd of nodes) {
        const cx = clamp((nd.x / cell) | 0, 0, cols - 1);
        const cy = clamp((nd.y / cell) | 0, 0, rows - 1);
        const key = cy * cols + cx;
        let bucket = grid.get(key);
        if (!bucket) grid.set(key, (bucket = []));
        bucket.push(nd);
      }
      edges = [];
      const R2 = R * R;
      for (const nd of nodes) {
        const cx = clamp((nd.x / cell) | 0, 0, cols - 1);
        const cy = clamp((nd.y / cell) | 0, 0, rows - 1);
        for (let oy = 0; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            if (oy === 0 && ox < 0) continue;      // avoid duplicate pairs
            const gx = cx + ox, gy = cy + oy;
            if (gx < 0 || gx >= cols || gy < 0 || gy >= rows) continue;
            const bucket = grid.get(gy * cols + gx);
            if (!bucket) continue;
            for (const ot of bucket) {
              if (ot.i <= nd.i) continue;
              const dx = ot.x - nd.x, dy = ot.y - nd.y;
              const d2 = dx * dx + dy * dy;
              if (d2 > R2) continue;
              // in layered mode only forward connections read as a network
              if (nd.layer >= 0 && ot.layer >= 0 && Math.abs(nd.layer - ot.layer) > 1) continue;
              edges.push({ a: nd, b: ot, d: Math.sqrt(d2) });
            }
          }
        }
      }
      if (edges.length > 1400) edges.length = 1400;   // hard ceiling on fill cost
    }

    /* ── signal pulses travelling along edges ── */
    function spawnPulse() {
      if (!edges.length || pulses.length > 34) return;
      const e = edges[(Math.random() * edges.length) | 0];
      // always fire "forward" through the network when layers exist
      const fwd = e.a.layer < 0 || e.a.layer <= e.b.layer;
      pulses.push({ a: fwd ? e.a : e.b, b: fwd ? e.b : e.a, t: 0, v: 0.012 + Math.random() * 0.022 });
    }

    const BASE_DT = 1000 / 60;

    function step(dt) {
      /* Frame-rate normaliser. Velocity used to be integrated per *frame*,
         so the whole field ran ~2.4x faster on a 144Hz display than on a
         60Hz one. Everything below is scaled by this instead. */
      const f = clamp(dt / BASE_DT, 0.4, 2.2);

      // ease every parameter toward its target
      const k = clamp(dt / 380, 0, 1);
      S.morph = lerp(S.morph, T.morph, k);
      S.density = lerp(S.density, T.density, k);
      S.link = lerp(S.link, T.link, k);
      S.speed = lerp(S.speed, T.speed, k);
      S.pulseRate = lerp(S.pulseRate, T.pulseRate, k);
      for (let c = 0; c < 3; c++) {
        S.colA[c] = lerp(S.colA[c], T.colA[c], k);
        S.colB[c] = lerp(S.colB[c], T.colB[c], k);
      }

      const now = performance.now();

      /* Soft spring, heavy damping — near-critical, so a node glides into
         its new formation and stops instead of overshooting and ringing.
         Damping scales with morph: free drift barely damps (so the hero
         keeps floating), a snapped formation damps hard (so it settles). */
      const stiff = 0.0085 * S.morph * f;
      const damp = Math.pow(lerp(0.995, 0.89, S.morph), f);
      const MAXV = 4.5;   // ~1.8s to settle a full-width move, <1% overshoot

      for (const nd of nodes) {
        if (nd.hasTarget && S.morph > 0.001) {
          nd.vx += (nd.tx - nd.x) * stiff;
          nd.vy += (nd.ty - nd.y) * stiff;
        }
        nd.vx *= damp;
        nd.vy *= damp;

        // residual drift keeps the field alive even when snapped
        const wander = 0.0017 * (1 - S.morph * 0.7) * f;
        nd.vx += Math.cos(now * 0.00035 + nd.ph) * wander;
        nd.vy += Math.sin(now * 0.00042 + nd.ph * 1.3) * wander;

        // nothing — cursor, shockwave or a fast section change — may fling a node
        const sp = Math.hypot(nd.vx, nd.vy);
        if (sp > MAXV) { nd.vx = (nd.vx / sp) * MAXV; nd.vy = (nd.vy / sp) * MAXV; }

        nd.x += nd.vx * S.speed * f;
        nd.y += nd.vy * S.speed * f;

        // walls only matter in free drift; targeted nodes are already bounded
        if (S.morph < 0.6) {
          if (nd.x < 0) { nd.x = 0; nd.vx = Math.abs(nd.vx); }
          if (nd.x > w) { nd.x = w; nd.vx = -Math.abs(nd.vx); }
          if (nd.y < 0) { nd.y = 0; nd.vy = Math.abs(nd.vy); }
          if (nd.y > h) { nd.y = h; nd.vy = -Math.abs(nd.vy); }
        }

        // cursor excites nearby neurons
        let act = 0;
        if (mouse.active) {
          const dx = mouse.x - nd.x, dy = mouse.y - nd.y;
          const d = Math.hypot(dx, dy);
          if (d < REACH) {
            act = 1 - d / REACH;
            nd.vx -= (dx / (d || 1)) * act * 0.17 * f;
            nd.vy -= (dy / (d || 1)) * act * 0.17 * f;
          }
        }

        // a click sends a shockwave out; nodes flare as the front passes
        // through them and get shoved outward, so the whole graph rings
        for (const rp of ripples) {
          const d = Math.hypot(nd.x - rp.x, nd.y - rp.y);
          const front = Math.abs(d - rp.r);
          if (front > 70) continue;
          const hit = (1 - front / 70) * rp.life;
          act = Math.max(act, hit);
          const inv = d || 1;
          nd.vx += ((nd.x - rp.x) / inv) * hit * 0.85 * f;
          nd.vy += ((nd.y - rp.y) / inv) * hit * 0.85 * f;
        }

        nd.act = lerp(nd.act, act, clamp(0.16 * f, 0, 1));
      }

      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        rp.r += rp.v * (dt / 16);
        rp.life -= dt / 900;
        if (rp.life <= 0) ripples.splice(i, 1);
      }

      if (now - lastEdgeBuild > 240) { buildEdges(); lastEdgeBuild = now; }

      if (Math.random() < S.pulseRate * 60 * (dt / 1000)) spawnPulse();
      for (let i = pulses.length - 1; i >= 0; i--) {
        pulses[i].t += pulses[i].v * S.speed * f;
        if (pulses[i].t >= 1) pulses.splice(i, 1);
      }
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      const [ar, ag, ab] = S.colA;
      const [br, bg, bb] = S.colB;

      /* edges — hue interpolated along the x axis so the network
         reads as a gradient from input side to output side */
      ctx.lineWidth = 1;
      for (const e of edges) {
        const fade = 1 - e.d / S.link;
        if (fade <= 0) continue;
        const heat = Math.max(e.a.act, e.b.act);
        const mix = clamp(((e.a.x + e.b.x) * 0.5) / w, 0, 1);
        const r = lerp(ar, br, mix), g = lerp(ag, bg, mix), b2 = lerp(ab, bb, mix);
        const alpha = (fade * 0.3 + heat * 0.5) * S.density;
        if (alpha < 0.012) continue;
        ctx.strokeStyle = `rgba(${r | 0},${g | 0},${b2 | 0},${alpha})`;
        ctx.beginPath();
        ctx.moveTo(e.a.x, e.a.y);
        ctx.lineTo(e.b.x, e.b.y);
        ctx.stroke();
      }

      /* cursor tethers — the network visibly reaches for the pointer.
         Transient and local, so it reads loudly without ever sitting
         behind a paragraph of body copy. */
      if (mouse.active) {
        for (const nd of nodes) {
          const d = Math.hypot(nd.x - mouse.x, nd.y - mouse.y);
          if (d > TETHER) continue;
          const f = 1 - d / TETHER;
          const mix = clamp(nd.x / w, 0, 1);
          const r = lerp(ar, br, mix), g = lerp(ag, bg, mix), b2 = lerp(ab, bb, mix);
          ctx.strokeStyle = `rgba(${r | 0},${g | 0},${b2 | 0},${f * 0.55})`;
          ctx.lineWidth = f * 1.5;
          ctx.beginPath();
          ctx.moveTo(nd.x, nd.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
        const cg = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 90);
        cg.addColorStop(0, `rgba(${br | 0},${bg | 0},${bb | 0},0.16)`);
        cg.addColorStop(1, `rgba(${br | 0},${bg | 0},${bb | 0},0)`);
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 90, 0, 6.2832);
        ctx.fill();
      }

      /* shockwave fronts */
      for (const rp of ripples) {
        ctx.strokeStyle = `rgba(${br | 0},${bg | 0},${bb | 0},${rp.life * 0.4})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, rp.r, 0, 6.2832);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${rp.life * 0.14})`;
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, rp.r * 0.82, 0, 6.2832);
        ctx.stroke();
      }

      /* nodes */
      for (const nd of nodes) {
        const mix = clamp(nd.x / w, 0, 1);
        const r = lerp(ar, br, mix), g = lerp(ag, bg, mix), b2 = lerp(ab, bb, mix);
        const pulseGlow = 0.5 + 0.5 * Math.sin(performance.now() * 0.0016 + nd.ph);
        const rad = nd.r * (1 + nd.act * 1.9) * (0.85 + pulseGlow * 0.25);
        const a = (0.42 + nd.act * 0.55 + pulseGlow * 0.16) * S.density;
        ctx.beginPath();
        ctx.arc(nd.x, nd.y, rad, 0, 6.2832);
        ctx.fillStyle = `rgba(${r | 0},${g | 0},${b2 | 0},${a})`;
        ctx.fill();
        if (nd.act > 0.25) {
          ctx.beginPath();
          ctx.arc(nd.x, nd.y, rad * 3.4, 0, 6.2832);
          ctx.fillStyle = `rgba(${r | 0},${g | 0},${b2 | 0},${nd.act * 0.1})`;
          ctx.fill();
        }
      }

      /* travelling activations */
      for (const p of pulses) {
        const t = p.t;
        const x = lerp(p.a.x, p.b.x, t);
        const y = lerp(p.a.y, p.b.y, t);
        const fade = Math.sin(t * Math.PI);
        const mix = clamp(x / w, 0, 1);
        const r = lerp(ar, br, mix), g = lerp(ag, bg, mix), b2 = lerp(ab, bb, mix);
        // comet tail
        const tx = lerp(p.a.x, p.b.x, Math.max(0, t - 0.16));
        const ty = lerp(p.a.y, p.b.y, Math.max(0, t - 0.16));
        const grad = ctx.createLinearGradient(tx, ty, x, y);
        grad.addColorStop(0, `rgba(${r | 0},${g | 0},${b2 | 0},0)`);
        grad.addColorStop(1, `rgba(255,255,255,${fade * 0.55 * S.density})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 1.9 * fade + 0.6, 0, 6.2832);
        ctx.fillStyle = `rgba(255,255,255,${fade * 0.85 * S.density})`;
        ctx.fill();
      }
    }

    let last = performance.now();
    function frame(now) {
      if (!running) return;
      const dt = Math.min(now - last, 48);
      last = now;
      step(dt);
      draw();
      raf = requestAnimationFrame(frame);
    }

    /* ── public API ── */
    const api = {
      start() {
        if (running) return;
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(frame);
      },
      stop() {
        running = false;
        cancelAnimationFrame(raf);
      },
      /* Freeze the swarm into a still, readable frame — used when the
         visitor turns effects off, so the page still looks designed. */
      settle() {
        for (let i = 0; i < 260; i++) step(16);
        draw();
      },
      set(opts) {
        if (opts.layout && opts.layout !== T.layout) {
          T.layout = opts.layout;
          retarget();
        }
        if (opts.morph !== undefined) T.morph = opts.morph;
        if (opts.density !== undefined) T.density = opts.density;
        if (opts.link !== undefined) T.link = opts.link;
        if (opts.speed !== undefined) T.speed = opts.speed;
        if (opts.pulseRate !== undefined) T.pulseRate = opts.pulseRate;
        if (opts.a) T.colA = hexToRgb(opts.a);
        if (opts.b) T.colB = hexToRgb(opts.b);
      },
      /* Fire a shockwave from a point, and light a handful of edges with it. */
      burst(x, y) {
        if (ripples.length > 3) return;
        ripples.push({ x, y, r: 8, v: 9, life: 1 });
        for (let i = 0; i < 7; i++) spawnPulse();
      },
      resize,
      get running() { return running; },
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', (e) => {
      mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true;
    }, { passive: true });
    window.addEventListener('pointerleave', () => { mouse.active = false; });

    // Clicking anywhere rings the network. Clicks on real controls still do
    // their own thing — this only adds a visual, it never swallows the event.
    window.addEventListener('pointerdown', (e) => {
      if (!running) return;
      api.burst(e.clientX, e.clientY);
    }, { passive: true });

    return api;
  }

  window.NeuralField = NeuralField;
})();

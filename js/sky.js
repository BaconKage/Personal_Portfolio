/* ═══════════════════════════════════════════════════════
   BLACK HOLE SKY — the desktop wallpaper
   ───────────────────────────────────────────────────────
   A planetary system on a starfield, with the cursor acting as a
   gravitational lens.

   The distortion is not a decorative swirl. Every star, planet and
   orbit vertex is displaced through the thin-lens equation for a point
   mass, which for a source at angular distance r from the lens centre
   puts its two images at

       r± = ½ ( r ± √(r² + 4Rₑ²) )

   where Rₑ is the Einstein radius. r₊ lands on the source's side, r₋
   comes out negative and therefore lands on the opposite side — the
   counter-image real lensing produces. Magnification follows

       μ = (u² + 2) / (u √(u² + 4)),   u = r / Rₑ

   split as μ± = (μ ± 1) / 2, which is what drives each image's
   brightness. Sources near alignment (u → 0) smear onto the Einstein
   ring, so the ring appears on its own rather than being drawn.
   ═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;

  function BlackHoleSky(canvas) {
    const ctx = canvas.getContext('2d', { alpha: false });
    let w = 0, h = 0, dpr = 1;
    let stars = [], planets = [], neb = null;
    let raf = null, running = false, last = 0;

    const mouse = { x: -9999, y: -9999, active: false };
    const hole = { x: 0, y: 0, R: 96, targetR: 96, spin: 0 };

    /* ── palette ── */
    const STAR_TINTS = [
      [255, 255, 255], [201, 221, 255], [255, 236, 209],
      [255, 208, 190], [214, 233, 255],
    ];

    const PLANETS = [
      { a: 96,  e: 0.10, sp: 0.00042, r: 3.4, c: '#c9a27a', ring: false, ph: 0.4 },
      { a: 152, e: 0.06, sp: 0.00029, r: 5.2, c: '#7fb0e8', ring: false, ph: 2.1 },
      { a: 214, e: 0.13, sp: 0.00020, r: 4.1, c: '#e08b6a', ring: false, ph: 3.7 },
      { a: 292, e: 0.08, sp: 0.00014, r: 8.0, c: '#d9c08a', ring: true,  ph: 5.2 },
      { a: 372, e: 0.05, sp: 0.00010, r: 6.2, c: '#8fd6d0', ring: false, ph: 1.2 },
    ];

    const sys = { x: 0, y: 0 };   // planetary system barycentre

    function build() {
      const area = w * h;
      const count = clamp(Math.round(area / 3400), 200, 620);
      stars = Array.from({ length: count }, () => {
        const t = STAR_TINTS[(Math.random() * STAR_TINTS.length) | 0];
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          z: 0.25 + Math.random() * 0.75,          // depth → parallax + size
          r: 0.35 + Math.pow(Math.random(), 2.4) * 1.7,
          tw: Math.random() * 6.283,
          tws: 0.0009 + Math.random() * 0.0022,
          c: t,
        };
      });

      sys.x = w * 0.74;
      sys.y = h * 0.72;
      planets = PLANETS.map((p) => ({ ...p }));

      // nebula is static — bake it once instead of re-filling gradients per frame
      neb = document.createElement('canvas');
      neb.width = Math.max(2, Math.round(w / 2));
      neb.height = Math.max(2, Math.round(h / 2));
      const nc = neb.getContext('2d');
      const blobs = [
        [0.22, 0.30, 0.42, 'rgba(86,44,160,0.30)'],
        [0.78, 0.24, 0.34, 'rgba(28,96,150,0.24)'],
        [0.60, 0.80, 0.44, 'rgba(120,38,110,0.20)'],
        [0.10, 0.82, 0.32, 'rgba(30,70,140,0.18)'],
      ];
      blobs.forEach(([cx, cy, rr, col]) => {
        const g = nc.createRadialGradient(
          cx * neb.width, cy * neb.height, 0,
          cx * neb.width, cy * neb.height, rr * neb.width
        );
        g.addColorStop(0, col);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        nc.fillStyle = g;
        nc.fillRect(0, 0, neb.width, neb.height);
      });
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth || document.documentElement.clientWidth;
      h = window.innerHeight || document.documentElement.clientHeight;
      // A page that hasn't been laid out yet reports 0. Sizing the canvas to
      // that leaves it permanently blank, so wait for a frame and retry.
      if (w < 2 || h < 2) { requestAnimationFrame(resize); return; }
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
      hole.x = w * 0.5;
      hole.y = h * 0.45;
      if (!running) draw(0);
    }

    /* ── the lens ──
       Returns both images of a source point, or null when the source sits
       essentially on the optical axis (where the images degenerate into the
       Einstein ring and the maths blows up). */
    function lens(px, py) {
      const dx = px - hole.x, dy = py - hole.y;
      const r = Math.hypot(dx, dy);
      if (r < 0.5) return null;
      const Re = hole.R;
      const ux = dx / r, uy = dy / r;
      const s = Math.sqrt(r * r + 4 * Re * Re);
      const rp = 0.5 * (r + s);
      const rm = 0.5 * (r - s);          // negative → opposite side of the hole
      const u = r / Re;
      const mu = (u * u + 2) / (u * Math.sqrt(u * u + 4));
      return {
        px: hole.x + ux * rp, py: hole.y + uy * rp, mp: (mu + 1) / 2,
        sx: hole.x + ux * rm, sy: hole.y + uy * rm, ms: (mu - 1) / 2,
        u,
      };
    }

    const horizon = () => hole.R * 0.38;

    function step(dt) {
      const f = clamp(dt / 16.667, 0.3, 3);
      const t = performance.now();

      // the hole trails the cursor; with no pointer it drifts on its own
      let tx, ty;
      if (mouse.active) { tx = mouse.x; ty = mouse.y; }
      else {
        tx = w * 0.5 + Math.cos(t * 0.000112) * w * 0.24;
        ty = h * 0.46 + Math.sin(t * 0.000147) * h * 0.20;
      }
      hole.x = lerp(hole.x, tx, clamp(0.055 * f, 0, 1));
      hole.y = lerp(hole.y, ty, clamp(0.055 * f, 0, 1));
      hole.R = lerp(hole.R, hole.targetR, clamp(0.06 * f, 0, 1));
      hole.targetR = lerp(hole.targetR, 96, clamp(0.02 * f, 0, 1));
      hole.spin += 0.0016 * f;

      for (const p of planets) p.ph += p.sp * dt;
      for (const s of stars) s.tw += s.tws * dt;
    }

    /* orbital position, flattened to read as a tilted plane */
    function orbitPoint(p, phase) {
      const a = p.a, b = p.a * (1 - p.e);
      return {
        x: sys.x + Math.cos(phase) * a,
        y: sys.y + Math.sin(phase) * b * 0.34,
      };
    }

    function draw() {
      if (!w) return;

      /* ── deep space ── */
      const bg = ctx.createLinearGradient(0, 0, w * 0.4, h);
      bg.addColorStop(0, '#05020f');
      bg.addColorStop(0.55, '#070313');
      bg.addColorStop(1, '#03010a');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      if (neb) ctx.drawImage(neb, 0, 0, w, h);

      const Rh = horizon();

      /* ── stars, both images ── */
      for (const s of stars) {
        const L = lens(s.x, s.y);
        if (!L) continue;
        const tw = 0.72 + 0.28 * Math.sin(s.tw);
        const [cr, cg, cb] = s.c;

        // primary — brightens and swells as it nears the ring
        const gp = clamp(L.mp, 0, 6);
        const rp = s.r * s.z * (1 + Math.min(gp - 1, 2.2) * 0.5);
        if (L.px > -20 && L.px < w + 20 && L.py > -20 && L.py < h + 20) {
          // light climbing out of the well loses energy — redden it
          const red = clamp(1 - L.u * 0.42, 0, 1);
          const R = Math.round(lerp(cr, 255, red * 0.5));
          const G = Math.round(lerp(cg, 150, red * 0.55));
          const B = Math.round(lerp(cb, 90, red * 0.6));
          ctx.beginPath();
          ctx.arc(L.px, L.py, rp, 0, 6.2832);
          ctx.fillStyle = `rgba(${R},${G},${B},${clamp(tw * Math.min(gp, 2.4) * 0.8, 0, 1)})`;
          ctx.fill();
        }

        // counter-image: real, but swallowed once it falls inside the horizon
        const dsec = Math.hypot(L.sx - hole.x, L.sy - hole.y);
        if (dsec > Rh * 1.06 && L.ms > 0.02) {
          ctx.beginPath();
          ctx.arc(L.sx, L.sy, Math.max(0.35, s.r * s.z * clamp(L.ms, 0.15, 2)), 0, 6.2832);
          ctx.fillStyle = `rgba(${cr},${cg},${cb},${clamp(L.ms * tw * 0.85, 0, 0.9)})`;
          ctx.fill();
        }
      }

      /* ── the system's star ── */
      const sunL = lens(sys.x, sys.y);
      if (sunL) {
        const g = ctx.createRadialGradient(sunL.px, sunL.py, 0, sunL.px, sunL.py, 46);
        g.addColorStop(0, 'rgba(255,240,205,0.95)');
        g.addColorStop(0.22, 'rgba(255,197,120,0.5)');
        g.addColorStop(1, 'rgba(255,150,60,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sunL.px, sunL.py, 46, 0, 6.2832);
        ctx.fill();
      }

      /* ── orbits, traced through the lens ──
         Each ring is walked as a polyline and every vertex is displaced,
         so the orbits visibly bend around the hole. The path breaks near
         the axis where the two images diverge. */
      ctx.lineWidth = 1;
      for (const p of planets) {
        ctx.strokeStyle = 'rgba(150,170,220,0.14)';
        ctx.beginPath();
        let penDown = false;
        for (let i = 0; i <= 96; i++) {
          const pt = orbitPoint(p, (i / 96) * 6.2832);
          const L = lens(pt.x, pt.y);
          if (!L || L.u < 0.34) { penDown = false; continue; }
          if (!penDown) { ctx.moveTo(L.px, L.py); penDown = true; }
          else ctx.lineTo(L.px, L.py);
        }
        ctx.stroke();
      }

      /* ── planets ── */
      for (const p of planets) {
        const pt = orbitPoint(p, p.ph);
        const L = lens(pt.x, pt.y);
        if (!L) continue;
        const sc = clamp(L.mp, 0.6, 3.2);
        const pr = p.r * Math.min(sc, 2.1);

        if (p.ring) {
          ctx.save();
          ctx.translate(L.px, L.py);
          ctx.rotate(-0.42);
          ctx.scale(1, 0.28);
          ctx.strokeStyle = 'rgba(226,208,166,0.55)';
          ctx.lineWidth = pr * 0.32;
          ctx.beginPath();
          ctx.arc(0, 0, pr * 2.05, 0, 6.2832);
          ctx.stroke();
          ctx.restore();
        }

        ctx.beginPath();
        ctx.arc(L.px, L.py, pr, 0, 6.2832);
        ctx.fillStyle = p.c;
        ctx.fill();
        // crescent terminator, lit from the system's star
        const ang = Math.atan2(L.py - (sunL ? sunL.py : sys.y), L.px - (sunL ? sunL.px : sys.x));
        ctx.save();
        ctx.beginPath();
        ctx.arc(L.px, L.py, pr, 0, 6.2832);
        ctx.clip();
        ctx.beginPath();
        ctx.arc(L.px + Math.cos(ang) * pr * 0.72, L.py + Math.sin(ang) * pr * 0.72, pr, 0, 6.2832);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fill();
        ctx.restore();
      }

      /* ── accretion disk ── */
      ctx.save();
      ctx.translate(hole.x, hole.y);
      ctx.rotate(-0.36);
      ctx.scale(1, 0.3);
      const disk = ctx.createRadialGradient(0, 0, Rh * 1.1, 0, 0, hole.R * 2.5);
      disk.addColorStop(0, 'rgba(255,240,220,0)');
      disk.addColorStop(0.16, 'rgba(255,196,120,0.62)');
      disk.addColorStop(0.42, 'rgba(255,128,52,0.36)');
      disk.addColorStop(0.75, 'rgba(190,60,30,0.13)');
      disk.addColorStop(1, 'rgba(120,30,20,0)');
      ctx.fillStyle = disk;
      ctx.beginPath();
      ctx.arc(0, 0, hole.R * 2.5, 0, 6.2832);
      ctx.fill();
      // Doppler beaming — the side rotating toward us runs brighter
      const beam = ctx.createLinearGradient(-hole.R * 2.2, 0, hole.R * 2.2, 0);
      const bp = 0.5 + 0.5 * Math.sin(hole.spin);
      beam.addColorStop(0, `rgba(255,255,255,${0.16 * bp})`);
      beam.addColorStop(0.5, 'rgba(255,255,255,0)');
      beam.addColorStop(1, `rgba(255,255,255,${0.16 * (1 - bp)})`);
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.arc(0, 0, hole.R * 2.5, 0, 6.2832);
      ctx.fill();
      ctx.restore();

      /* ── photon ring + event horizon ── */
      const ring = ctx.createRadialGradient(hole.x, hole.y, Rh * 0.9, hole.x, hole.y, Rh * 1.5);
      ring.addColorStop(0, 'rgba(255,214,150,0)');
      ring.addColorStop(0.42, 'rgba(255,226,178,0.85)');
      ring.addColorStop(0.62, 'rgba(255,168,80,0.28)');
      ring.addColorStop(1, 'rgba(255,140,60,0)');
      ctx.fillStyle = ring;
      ctx.beginPath();
      ctx.arc(hole.x, hole.y, Rh * 1.5, 0, 6.2832);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(hole.x, hole.y, Rh, 0, 6.2832);
      ctx.fillStyle = '#000';
      ctx.fill();
    }

    function frame(now) {
      if (!running) return;
      step(Math.min(now - last, 50));
      last = now;
      draw();
      raf = requestAnimationFrame(frame);
    }

    const api = {
      start() {
        if (running) return;
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(frame);
      },
      stop() { running = false; cancelAnimationFrame(raf); },
      /* one composed still, for when motion is switched off */
      settle() { for (let i = 0; i < 40; i++) step(16); draw(); },
      /* a click briefly deepens the well */
      pulse() { hole.targetR = Math.min(hole.targetR + 62, 190); },
      resize,
      get running() { return running; },
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', (e) => {
      mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true;
    }, { passive: true });
    window.addEventListener('pointerleave', () => { mouse.active = false; });
    window.addEventListener('pointerdown', () => { if (running) api.pulse(); }, { passive: true });

    return api;
  }

  window.BlackHoleSky = BlackHoleSky;
})();

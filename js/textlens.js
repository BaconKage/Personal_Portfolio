/* ═══════════════════════════════════════════════════════
   TEXT LENS — the black hole warps the page content too
   ───────────────────────────────────────────────────────
   Two ways of doing it, picked at runtime.

   FILTER (preferred). An SVG feDisplacementMap resamples the rendered
   element through a texture holding the same deflection the canvas uses:
   an output pixel at radius r shows the source that truly sits at

       r_src = r − Rₑ² / r

   so the sample offset points inward with magnitude Rₑ²/r. This is a real
   pixel warp — glyphs bend.

   TRANSFORM (fallback). Filters of this size are dropped outright by some
   browsers and are slow on weak GPUs, so if the filter can't be used the
   same deflection is applied to individual glyphs and words as transforms
   instead. Not a pixel warp, but it costs almost nothing and works
   everywhere. A source at r appears at

       r_img = ½ ( r + √(r² + 4Rₑ²) )

   giving an outward push of ½(√(r²+4Rₑ²) − r) — the same falloff.

   Selection order: wait for the texture to decode, use the filter, and
   drop to transforms if the frame budget says the filter is too expensive.
   ═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const XLINK = 'http://www.w3.org/1999/xlink';

  /* Wrap every word in its own inline-block so it can be transformed.
     Walks text nodes only, so inline markup inside the copy survives. */
  function splitWords(root, cls) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) =>
        n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const out = [];
    for (const n of nodes) {
      const frag = document.createDocumentFragment();
      for (const piece of n.nodeValue.split(/(\s+)/)) {
        if (!piece) continue;
        if (/^\s+$/.test(piece)) { frag.appendChild(document.createTextNode(piece)); continue; }
        const s = document.createElement('span');
        s.className = cls;
        s.textContent = piece;
        frag.appendChild(s);
        out.push(s);
      }
      n.parentNode.replaceChild(frag, n);
    }
    return out;
  }

  function TextLens(opts) {
    const Re = opts.radius || 52;
    const REACH = 3.2;                 // texture covers this many Rₑ
    const MAPR = Math.ceil(Re * REACH);
    const MAXOFF = Re * 1.5;           // cap so the encoding stays in range
    const SCALE = MAXOFF * 2;          // feDisplacementMap maps (c-0.5)*SCALE
    const PAD = Math.ceil(MAXOFF) + 12;

    let mode = 'pending';              // pending → filter | transform | off

    /* ── displacement texture ── */
    function texture() {
      const n = MAPR * 2;
      const cv = document.createElement('canvas');
      cv.width = n; cv.height = n;
      const ctx = cv.getContext('2d');
      const img = ctx.createImageData(n, n);
      const d = img.data;
      const c = n / 2;
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          const dx = x - c + 0.5, dy = y - c + 0.5;
          const r = Math.hypot(dx, dy);
          let ox = 0, oy = 0;
          // skip the very centre: the core covers it and 1/r explodes there
          if (r > Re * 0.5 && r < MAPR) {
            const mag = Math.min((Re * Re) / r, MAXOFF);
            ox = -(dx / r) * mag;
            oy = -(dy / r) * mag;
          }
          const i = (y * n + x) * 4;
          d[i] = Math.round(255 * (0.5 + ox / SCALE));
          d[i + 1] = Math.round(255 * (0.5 + oy / SCALE));
          d[i + 2] = 0;
          d[i + 3] = 255;              // opaque, so it wins over the flood
        }
      }
      ctx.putImageData(img, 0, 0);
      return cv.toDataURL('image/png');
    }

    /* ── filter chain ──
       Each target gets its own filter: the patch has to sit at different
       coordinates in each element's local space, so one shared feImage
       cannot serve two warped elements at once. */
    const href = texture();
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    const defs = document.createElementNS(NS, 'defs');
    svg.appendChild(defs);
    document.body.appendChild(svg);

    const targets = Array.from(document.querySelectorAll('[data-warp]')).map((el, i) => {
      const id = 'bhWarp' + i;
      const filter = document.createElementNS(NS, 'filter');
      filter.setAttribute('id', id);
      /* Region in user space rather than a percentage of the box. The old
         -30%/160% meant 2.56x the area of a viewport-sized element, which is
         both wasteful and large enough that some engines drop the filter
         entirely. Displacement never exceeds MAXOFF, so this much padding
         is all it can possibly need. */
      filter.setAttribute('filterUnits', 'userSpaceOnUse');
      filter.setAttribute('primitiveUnits', 'userSpaceOnUse');
      filter.setAttribute('color-interpolation-filters', 'sRGB');
      filter.innerHTML =
        '<feFlood flood-color="rgb(128,128,0)" flood-opacity="1" result="flat"/>' +
        '<feImage result="patch" preserveAspectRatio="none"/>' +
        '<feMerge result="map"><feMergeNode in="flat"/><feMergeNode in="patch"/></feMerge>' +
        '<feDisplacementMap in="SourceGraphic" in2="map" xChannelSelector="R" yChannelSelector="G"/>';
      defs.appendChild(filter);

      const feImage = filter.querySelector('feImage');
      feImage.setAttribute('width', String(MAPR * 2));
      feImage.setAttribute('height', String(MAPR * 2));
      feImage.setAttribute('href', href);
      feImage.setAttributeNS(XLINK, 'xlink:href', href);   // older engines
      filter.querySelector('feDisplacementMap').setAttribute('scale', String(SCALE));

      return { el, filter, feImage, url: 'url(#' + id + ')', on: false, w: 0, h: 0, units: null };
    });

    /* feImage loads its href asynchronously. Attaching the filter before the
       texture has decoded renders one or more frames with a flat map — and if
       it never decodes, the filter is a silent no-op. Gate on it. */
    const probe = new Image();
    probe.onload = () => { if (mode === 'pending') mode = 'filter'; };
    probe.onerror = () => { if (mode === 'pending') mode = 'transform'; };
    probe.src = href;
    // never leave it stuck in pending
    setTimeout(() => { if (mode === 'pending') mode = 'transform'; }, 2500);

    /* ── transform fallback ── */
    const UNIT_SEL = '.hero-char, .btn, .nav-link, .nav-logo, .os-stat, .hero-sub';
    function unitsFor(t) {
      if (t.units) return t.units;
      const list = Array.from(t.el.querySelectorAll(UNIT_SEL));
      // paragraphs get split into words so the warp has something to grip
      t.el.querySelectorAll('.mh-desc, .mh-eyebrow').forEach((p) => {
        list.push(...splitWords(p, 'wl-u'));
      });
      const win = t.el.querySelector('.os-win');
      if (win) list.push(win);
      t.units = list.map((el) => ({ el, on: false }));
      return t.units;
    }

    function clearUnits(t) {
      if (!t.units) return;
      for (const u of t.units) if (u.on) { u.on = false; u.el.style.transform = ''; }
    }

    function transformUpdate(t, hx, hy) {
      for (const u of unitsFor(t)) {
        // a window being dragged must not be shoved around underneath the grab
        if (u.el.classList.contains('dragging')) { if (u.on) { u.on = false; u.el.style.transform = ''; } continue; }
        const r = u.el.getBoundingClientRect();
        if (!r.width) continue;
        const dx = r.left + r.width / 2 - hx;
        const dy = r.top + r.height / 2 - hy;
        const d = Math.hypot(dx, dy);
        if (d > MAPR || d < 0.01) {
          if (u.on) { u.on = false; u.el.style.transform = ''; }
          continue;
        }
        const push = Math.min(0.5 * (Math.sqrt(d * d + 4 * Re * Re) - d), MAXOFF);
        u.on = true;
        u.el.style.transform =
          'translate(' + ((dx / d) * push).toFixed(2) + 'px,' +
          ((dy / d) * push).toFixed(2) + 'px)';
      }
    }

    /* ── frame budget ──
       Downgrade rather than switch off: a machine that cannot afford the
       filter can still afford transforms, and the visitor asked for effects. */
    let samples = 0, total = 0, lastT = 0, active = false;
    function budget(now) {
      if (!active || mode !== 'filter') { lastT = now; return; }
      if (lastT) {
        total += now - lastT;
        if (++samples >= 60) {
          if (total / samples > 55) {          // under ~18fps: genuinely unusable
            targets.forEach(detachFilter);
            mode = 'transform';
          }
          samples = 0; total = 0;
        }
      }
      lastT = now;
    }

    function detachFilter(t) {
      if (!t.on) return;
      t.on = false;
      t.el.style.filter = '';
    }

    function filterUpdate(t, hx, hy, r) {
      // keep the region glued to the element's current size
      if (r.width !== t.w || r.height !== t.h) {
        t.w = r.width; t.h = r.height;
        t.filter.setAttribute('x', String(-PAD));
        t.filter.setAttribute('y', String(-PAD));
        t.filter.setAttribute('width', String(r.width + PAD * 2));
        t.filter.setAttribute('height', String(r.height + PAD * 2));
      }
      t.feImage.setAttribute('x', String(hx - r.left - MAPR));
      t.feImage.setAttribute('y', String(hy - r.top - MAPR));
      if (!t.on) { t.on = true; t.el.style.filter = t.url; }
    }

    function off() {
      if (!active) return;
      active = false;
      targets.forEach((t) => { detachFilter(t); clearUnits(t); });
    }

    function update(hx, hy, live, now) {
      if (mode === 'off') return;
      if (!live || mode === 'pending') { off(); budget(now); return; }

      let any = false;
      for (const t of targets) {
        const r = t.el.getBoundingClientRect();
        const near = r.width > 1 &&
          hx > r.left - MAPR && hx < r.right + MAPR &&
          hy > r.top - MAPR && hy < r.bottom + MAPR;
        if (!near) { detachFilter(t); clearUnits(t); continue; }
        any = true;
        if (mode === 'filter') filterUpdate(t, hx, hy, r);
        else transformUpdate(t, hx, hy);
      }
      active = any;
      budget(now);
    }

    return { update, get mode() { return mode; } };
  }

  window.TextLens = TextLens;
})();

/* ═══════════════════════════════════════════════════════
   TEXT LENS — the black hole warps the words too
   ───────────────────────────────────────────────────────
   The background is warped by displacing geometry we own. DOM text can't
   be moved that way, so it goes through an SVG feDisplacementMap: a small
   texture encodes, per pixel, where to sample the source from, and the
   filter resamples the rendered element through it.

   The texture holds the same deflection the canvas uses. An output pixel
   at radius r from the hole shows the source that truly sits at

       r_src = r − Rₑ² / r

   so the sample offset points inward with magnitude Rₑ²/r — strong at the
   rim, fading with distance. Offsets are encoded into R and G around a
   neutral 128, which is what feDisplacementMap reads.

   The texture only covers a patch around the cursor, so the rest of the
   filter region is flooded with that neutral value first; without it the
   transparent area outside the patch would decode as a huge constant
   shift and throw the whole element sideways.
   ═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const XLINK = 'http://www.w3.org/1999/xlink';

  function TextLens(opts) {
    const Re = opts.radius || 52;
    const REACH = 3.2;                 // texture covers this many Rₑ
    const MAPR = Math.ceil(Re * REACH);
    const MAXOFF = Re * 1.5;           // cap so the encoding stays in range
    const SCALE = MAXOFF * 2;          // feDisplacementMap maps (c-0.5)*SCALE

    /* ── build the displacement texture once ── */
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
       Each target gets its own filter. They share the texture, but the patch
       has to sit at different coordinates in each element's local space, so a
       single feImage cannot serve more than one warped element at a time. */
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
      filter.setAttribute('x', '-30%');
      filter.setAttribute('y', '-30%');
      filter.setAttribute('width', '160%');
      filter.setAttribute('height', '160%');
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

      return { el, feImage, url: 'url(#' + id + ')', on: false };
    });

    let active = false, disabled = false;

    /* Filters this size are cheap on some machines and not on others, and
       there is no way to know in advance. Watch the frame budget while the
       warp is on and retire it for good if it can't hold up. */
    let samples = 0, total = 0, lastT = 0;
    function budget(now) {
      if (!active) { lastT = now; return; }
      if (lastT) {
        total += now - lastT;
        if (++samples >= 45) {
          if (total / samples > 30) { off(); disabled = true; }
          samples = 0; total = 0;
        }
      }
      lastT = now;
    }

    function detach(t) {
      if (!t.on) return;
      t.on = false;
      t.el.style.filter = '';
    }

    function off() {
      if (!active) return;
      active = false;
      targets.forEach(detach);
    }

    function update(hx, hy, live, now) {
      if (disabled) return;
      if (!live) { off(); budget(now); return; }

      let any = false;
      for (const t of targets) {
        const r = t.el.getBoundingClientRect();
        const near = r.width > 1 &&
          hx > r.left - MAPR && hx < r.right + MAPR &&
          hy > r.top - MAPR && hy < r.bottom + MAPR;
        if (!near) { detach(t); continue; }
        any = true;
        // the patch sits in this element's own user space, hence one per target
        t.feImage.setAttribute('x', String(hx - r.left - MAPR));
        t.feImage.setAttribute('y', String(hy - r.top - MAPR));
        if (!t.on) { t.on = true; t.el.style.filter = t.url; }
      }
      active = any;
      budget(now);
    }

    return { update, get disabled() { return disabled; } };
  }

  window.TextLens = TextLens;
})();

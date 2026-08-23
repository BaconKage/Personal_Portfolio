/* ═══════════════════════════════════════════════════════
   PROJECT SCHEMAS — what each build is, drawn
   ───────────────────────────────────────────────────────
   The projects are client work and mostly confidential, so there are no
   screenshots to show. That constraint turns out to be the better brief:
   for the people who read this page, the shape of a system is stronger
   evidence than a picture of its login screen.

   Each project declares nodes and edges. Nodes carry a `tier`, which is the
   row they sit on, and the layout spreads each tier evenly across the width,
   so adding a node never requires re-positioning its neighbours by hand.

   Rendered as inline SVG rather than canvas on purpose: it scales to any
   size without a redraw, costs nothing once painted, needs no animation
   frame or teardown, and can carry a real text description for anyone who
   cannot see it. The page already runs six canvases.
   ═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* kind → visual weight. `core` is the thing that decides what is true in a
     system, `io` is where the outside world touches it, `store` persists. */
  const SCHEMAS = {
    MyGym: {
      caption: 'One service owns every rule; both clients ask it and neither invents an answer.',
      nodes: [
        { id: 'web', tier: 0, label: 'Web console', sub: 'staff', kind: 'io' },
        { id: 'mob', tier: 0, label: 'Mobile app', sub: 'staff + member', kind: 'io' },
        { id: 'api', tier: 1, label: 'NestJS API', sub: 'rules · roles · limits', kind: 'core' },
        { id: 'db', tier: 2, label: 'PostgreSQL', sub: '23 linked records', kind: 'store' },
      ],
      edges: [['web', 'api'], ['mob', 'api'], ['api', 'db', 'validated']],
    },

    VaniCert: {
      caption: 'Two independent signals must agree before a verdict is returned.',
      nodes: [
        { id: 'in', tier: 0, label: 'Audio', sub: 'phone or upload', kind: 'io' },
        { id: 'vad', tier: 1, label: 'Silero VAD', sub: 'isolate speech', kind: 'proc' },
        { id: 'aas', tier: 2, label: 'AASIST', sub: 'anti-spoof score', kind: 'proc' },
        { id: 'dsp', tier: 2, label: 'DSP pass', sub: 'MFCC · centroid · flux', kind: 'proc' },
        { id: 'agree', tier: 3, label: 'Consensus', sub: 'both must concur', kind: 'core' },
      ],
      edges: [['in', 'vad'], ['vad', 'aas'], ['vad', 'dsp'], ['aas', 'agree'], ['dsp', 'agree']],
    },

    FirstDropAI: {
      caption: 'A rehearsal loop: the room reacts, then the room is scored.',
      nodes: [
        { id: 'sc', tier: 0, label: 'Scenario', sub: 'generated per case', kind: 'io' },
        { id: 'room', tier: 1, label: 'Roleplay room', sub: 'patient · family', kind: 'core' },
        { id: 'ten', tier: 2, label: 'Tension model', sub: 'tracked live', kind: 'proc' },
        { id: 'rep', tier: 3, label: 'Report', sub: 'empathy · clarity', kind: 'store' },
      ],
      edges: [['sc', 'room'], ['room', 'ten'], ['ten', 'room', 'reacts'], ['ten', 'rep']],
    },

    BhashaBuddy: {
      caption: 'Speech goes out and comes back scored, which is the whole lesson.',
      nodes: [
        { id: 'les', tier: 0, label: 'Lessons', sub: 'levelled', kind: 'io' },
        { id: 'game', tier: 0, label: 'Games', sub: 'retention', kind: 'io' },
        { id: 'conv', tier: 1, label: 'AI conversation', sub: 'in the family language', kind: 'core' },
        { id: 'tts', tier: 2, label: 'Pronunciation', sub: 'TTS + feedback', kind: 'proc' },
        { id: 'prog', tier: 3, label: 'Progress', sub: 'per child', kind: 'store' },
      ],
      edges: [['les', 'conv'], ['game', 'conv'], ['conv', 'tts'], ['tts', 'prog']],
    },

    'Posture Engine': {
      caption: 'One camera feed, two answers: is the rep real, and does it count.',
      nodes: [
        { id: 'cam', tier: 0, label: 'Camera', sub: '30 fps', kind: 'io' },
        { id: 'pose', tier: 1, label: 'MediaPipe', sub: 'joint landmarks', kind: 'proc' },
        { id: 'ang', tier: 2, label: 'Joint angles', sub: 'form check', kind: 'core' },
        { id: 'rep', tier: 2, label: 'Rep counter', sub: 'phase detection', kind: 'core' },
        { id: 'diet', tier: 3, label: 'Diet engine', sub: 'Indian food DB', kind: 'store' },
      ],
      edges: [['cam', 'pose'], ['pose', 'ang'], ['pose', 'rep'], ['ang', 'diet'], ['rep', 'diet']],
    },
  };

  /* ── layout ──
     Normalised 0..1 coordinates so the SVG viewBox does the scaling. Tiers are
     rows; members of a tier are spread evenly with half-step insets so a lone
     node lands centred and a pair does not hug the edges. */
  /* The viewBox is deliberately tight. These render into a ~470px side panel,
     and at a 1000-wide box the labels came out around 7px on screen. Scale is
     render-width / viewBox-width, so shrinking the coordinate space is what
     buys legibility, not raising the font size. */
  const VB = { w: 780, h: 520 };
  const BOX = { w: 230, h: 62 };

  function layout(spec) {
    const tiers = {};
    spec.nodes.forEach((n) => (tiers[n.tier] = (tiers[n.tier] || []).concat(n)));
    const keys = Object.keys(tiers).map(Number).sort((a, b) => a - b);
    const placed = {};
    keys.forEach((t, ti) => {
      const row = tiers[t];
      const y = keys.length === 1 ? 0.5 : (ti + 0.5) / keys.length;
      row.forEach((n, i) => {
        placed[n.id] = Object.assign({}, n, {
          x: (i + 0.5) / row.length,
          y,
          px: ((i + 0.5) / row.length) * VB.w,
          py: y * VB.h,
        });
      });
    });
    return placed;
  }

  /* Anchor an edge on the box border rather than the centre, so lines do not
     disappear under the node they point at. */
  function anchor(from, to) {
    const dx = to.px - from.px, dy = to.py - from.py;
    if (Math.abs(dy) * BOX.w > Math.abs(dx) * BOX.h) {
      const s = dy > 0 ? 1 : -1;
      return { x: from.px + (dx * (BOX.h / 2)) / Math.abs(dy || 1), y: from.py + s * (BOX.h / 2) };
    }
    const s = dx > 0 ? 1 : -1;
    return { x: from.px + s * (BOX.w / 2), y: from.py + (dy * (BOX.w / 2)) / Math.abs(dx || 1) };
  }

  const esc = (s) =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* A plain-language description of the same graph, for anyone who cannot see
     it. Built from the spec so it can never drift from the drawing. */
  function describe(spec, placed) {
    const name = (id) => placed[id].label;
    const flows = spec.edges.map((e) => name(e[0]) + ' to ' + name(e[1]) + (e[2] ? ' (' + e[2] + ')' : ''));
    return 'System diagram. ' + spec.nodes.map((n) => n.label + ', ' + n.sub).join('. ') +
           '. Connections: ' + flows.join('; ') + '.';
  }

  function svgFor(spec) {
    const placed = layout(spec);
    let lines = '', labels = '', boxes = '';

    spec.edges.forEach((e, i) => {
      const a = placed[e[0]], b = placed[e[1]];
      if (!a || !b) return;
      const p1 = anchor(a, b), p2 = anchor(b, a);
      lines +=
        '<line class="pd-link" x1="' + p1.x.toFixed(1) + '" y1="' + p1.y.toFixed(1) +
        '" x2="' + p2.x.toFixed(1) + '" y2="' + p2.y.toFixed(1) +
        '" style="--i:' + i + '"/>';
      if (e[2]) {
        labels +=
          '<text class="pd-note" x="' + ((p1.x + p2.x) / 2).toFixed(1) +
          '" y="' + ((p1.y + p2.y) / 2 - 6).toFixed(1) + '">' + esc(e[2]) + '</text>';
      }
    });

    spec.nodes.forEach((n, i) => {
      const p = placed[n.id];
      const x = (p.px - BOX.w / 2).toFixed(1), y = (p.py - BOX.h / 2).toFixed(1);
      boxes +=
        '<g class="pd-node pd-' + n.kind + '" style="--i:' + i + '">' +
        '<rect x="' + x + '" y="' + y + '" width="' + BOX.w + '" height="' + BOX.h + '" rx="3"/>' +
        '<text class="pd-label" x="' + p.px.toFixed(1) + '" y="' + (p.py - 4).toFixed(1) + '">' + esc(n.label) + '</text>' +
        '<text class="pd-sub" x="' + p.px.toFixed(1) + '" y="' + (p.py + 15).toFixed(1) + '">' + esc(n.sub) + '</text>' +
        '</g>';
    });

    return '<svg class="pdiag-svg" viewBox="0 0 ' + VB.w + ' ' + VB.h + '" role="img" ' +
           'aria-label="' + esc(describe(spec, placed)) + '" preserveAspectRatio="xMidYMid meet">' +
           lines + labels + boxes + '</svg>';
  }

  const cache = {};
  function markup(name) {
    const spec = SCHEMAS[name];
    if (!spec) return '';
    if (!cache[name]) {
      cache[name] = svgFor(spec) +
        '<p class="pdiag-cap mono">' + esc(spec.caption) + '</p>';
    }
    return cache[name];
  }

  /* Match on the leading word so the HUD's "MyGym" and the card's
     "MyGym Gym Operating System" resolve to the same schema. */
  function keyFor(title) {
    const t = String(title || '').trim();
    const hit = Object.keys(SCHEMAS).find((k) => t.toLowerCase().startsWith(k.toLowerCase()));
    return hit || null;
  }

  function paint(el, title) {
    if (!el) return false;
    const key = keyFor(title);
    if (!key) { el.innerHTML = ''; el.hidden = true; return false; }
    if (el.dataset.schema === key) { el.hidden = false; return true; }
    el.dataset.schema = key;
    el.innerHTML = markup(key);
    el.hidden = false;
    return true;
  }

  window.ProjectSchema = { paint: paint, has: (t) => !!keyFor(t), keys: Object.keys(SCHEMAS) };

  /* Cards render their own diagram up front: they are the fallback when WebGL
     is unavailable, and they must stand on their own. */
  function initCards() {
    document.querySelectorAll('.pcard').forEach((card) => {
      const h = card.querySelector('h3');
      if (!h) return;
      const title = h.textContent.trim();
      if (!keyFor(title)) return;
      const slot = document.createElement('div');
      slot.className = 'pdiag';
      const anchorEl = card.querySelector('.chips') || card.querySelector('.project-links');
      card.insertBefore(slot, anchorEl || null);
      paint(slot, title);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCards, { once: true });
  } else {
    initCards();
  }
})();

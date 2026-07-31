/* ═══════════════════════════════════════════════════════
   ORBIT — the builds section as a globe
   ───────────────────────────────────────────────────────
   Every project is a landmass. Scroll turns the planet and
   brings each one to face you, and the panel beside it
   carries that project's whole write-up as it comes round.

   Why this shape:

   · The map is generated, not drawn by hand. Each project
     owns a spherical cap at a set lat/lon, its coastline
     traced with the standard destination-point formula so
     the outline is a true circle on the sphere however the
     equirectangular texture stretches it.

   · Because the coastline comes from a formula, hit-testing
     is the same formula backwards — angular distance from
     the cap centre against the same wobble. No colour
     picking, no second render pass, exact by construction.

   · Landmasses carry the project name and nothing else, so
     the globe stays readable. Everything else — index,
     subtitle, description, stack, link — sits in the panel
     to the left, always on screen. Nothing is behind a
     click; clicking a landmass just scrolls to it.

   · scrolly.js still owns the scroll. It hands over the
     pinned section's progress; this decides what that means.

   · The card track stays in the DOM. No WebGL2, effects
     off, or a viewport too small to pin, and none of this
     mounts — the original gallery is what you get.
   ═══════════════════════════════════════════════════════ */

(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const D2R = Math.PI / 180;
  const SEG_LON = 96, SEG_LAT = 48;
  /* Camera far enough back that the globe clears the section heading, and
     pushed well right so the write-up down the left is never underneath it.
     At 3.25/0.55 the sphere ran into both. */
  const DIST = 4.0;
  const OFFSET_X = 0.82;
  const TRANS = 0.45;         // fraction of a scroll step spent turning; rest is the dwell
  const TEX_W = 2048, TEX_H = 1024;
  const CAP = 28;             // landmass radius, degrees
  /* A cap of CAP° spans (CAP/180)*TEX_H px vertically, so the name has to fit
     inside roughly three-quarters of that diameter or it runs past its own
     coastline — which is what clipped MYGYM and VANICERT at 330px. */
  const LABEL_W = (CAP / 180) * TEX_H * 2 * 0.72;

  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const lerp = (a, b, t) => a + (b - a) * t;

  const section = document.getElementById('projects');
  const canvas = document.getElementById('orbitCanvas');
  const hud = document.getElementById('orbitHud');
  const track = document.getElementById('projTrack');
  if (!section || !canvas || !hud || !track) return;

  const canPin = () => window.matchMedia('(min-width: 901px) and (min-height: 640px)').matches;

  /* ── content comes from the cards, not a second copy of the truth ── */
  const flat = (el) => {
    if (!el) return '';
    const c = el.cloneNode(true);
    c.querySelectorAll('br').forEach((br) => br.replaceWith(' '));
    return c.textContent.replace(/\s+/g, ' ').trim();
  };
  // the heading's first line is the product name; the rest is its subtitle
  const splitName = (h) => {
    if (!h) return ['', ''];
    const html = h.innerHTML.split(/<br\s*\/?>/i);
    const strip = (s) => { const d = document.createElement('div'); d.innerHTML = s; return flat(d); };
    return [strip(html[0]), html.length > 1 ? strip(html.slice(1).join(' ')) : ''];
  };

  const items = Array.from(track.querySelectorAll('.pcard')).map((card, i) => {
    const a = card.querySelector('a[href]');
    const [name, sub] = splitName(card.querySelector('h3'));
    return {
      idx: flat(card.querySelector('.pcard-idx')) || String(i + 1),
      name,                                   // the only thing drawn on the globe
      sub,
      desc: flat(card.querySelector('p')),
      href: a ? a.getAttribute('href') : '',
      label: flat(a),
      chips: Array.from(card.querySelectorAll('.chip')).map((c) => c.textContent.trim()).slice(0, 6),
    };
  });
  if (items.length < 2) return;

  const N = items.length;
  const accentA = section.dataset.a || '#22d3ee';
  const accentB = section.dataset.b || '#a855f7';

  /* ── where each project sits on the planet ──
     Longitudes evenly spaced so one scroll of the section is one rotation.
     Latitudes alternate to keep it from reading as a flat band, and stay
     inside ±32° where equirectangular stretching is still mild. */
  /* Longitudes run east-to-west so that the yaw needed to face each one
     (-lon) increases by exactly one step per project. Ascending longitudes
     make -lon descend, and the unwrap below then adds a whole extra
     revolution between every pair — six spins instead of one. */
  const places = items.map((_, k) => ({
    lon: 180 - (360 / N) * (k + 0.5),
    lat: [24, -19, 30, -27, 14, -12][k % 6],
  }));

  // wobble that makes a cap look like a coastline; drawing and hit-testing
  // both call this, so the shape you click is the shape you see
  const wobble = (k, a) =>
    1 + 0.20 * Math.sin(3 * a + k * 1.3) + 0.12 * Math.cos(5 * a - k * 2.1)
      + 0.07 * Math.sin(7 * a + k * 0.7);

  // point at angular distance d, bearing brg, from (lat, lon) — all radians
  const destination = (lat, lon, d, brg) => {
    const sinLat = Math.sin(lat) * Math.cos(d) + Math.cos(lat) * Math.sin(d) * Math.cos(brg);
    const la = Math.asin(clamp(sinLat, -1, 1));
    const lo = lon + Math.atan2(Math.sin(brg) * Math.sin(d) * Math.cos(lat),
                                Math.cos(d) - Math.sin(lat) * sinLat);
    return [la, lo];
  };

  /* ── the map ──
     Two canvases, kept as two textures: one for what you see, one for which
     project owns each pixel.

     These used to be merged into a single RGBA texture with the id in the
     alpha channel. That looks tidy and is quietly broken: canvas backing
     stores are premultiplied, so putting an id of 1 in alpha (1/255 ≈ 0.004)
     multiplies that pixel's colour by 0.004 on the way in. Every landmass
     came out near-black inside its own coastline. Both canvases stay fully
     opaque now and the id rides the red channel of its own texture. */
  const buildTexture = () => {
    const art = document.createElement('canvas');
    art.width = TEX_W; art.height = TEX_H;
    const c = art.getContext('2d');
    const ids = document.createElement('canvas');
    ids.width = TEX_W; ids.height = TEX_H;
    const q = ids.getContext('2d');

    // ocean
    const oc = c.createLinearGradient(0, 0, 0, TEX_H);
    oc.addColorStop(0, '#0a0620');
    oc.addColorStop(0.5, '#0d0827');
    oc.addColorStop(1, '#0a0620');
    c.fillStyle = oc;
    c.fillRect(0, 0, TEX_W, TEX_H);
    q.fillStyle = '#000';
    q.fillRect(0, 0, TEX_W, TEX_H);

    // graticule — the cue that says "globe" before anything else reads
    c.strokeStyle = 'rgba(255,255,255,0.045)';
    c.lineWidth = 2;
    for (let lon = -180; lon <= 180; lon += 30) {
      const x = ((lon + 180) / 360) * TEX_W;
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x, TEX_H); c.stroke();
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const y = ((90 - lat) / 180) * TEX_H;
      c.beginPath(); c.moveTo(0, y); c.lineTo(TEX_W, y); c.stroke();
    }
    c.strokeStyle = 'rgba(255,255,255,0.09)';
    c.beginPath(); c.moveTo(0, TEX_H / 2); c.lineTo(TEX_W, TEX_H / 2); c.stroke();

    const toPx = (la, lo) => {
      let d = lo / D2R;
      while (d < -180) d += 360;
      while (d > 180) d -= 360;
      return [((d + 180) / 360) * TEX_W, ((90 - la / D2R) / 180) * TEX_H];
    };

    places.forEach((pl, k) => {
      const lat0 = pl.lat * D2R, lon0 = pl.lon * D2R;
      const pts = [];
      for (let i = 0; i <= 220; i++) {
        const a = (i / 220) * TAU;
        const [la, lo] = destination(lat0, lon0, CAP * D2R * wobble(k, a), a);
        pts.push(toPx(la, lo));
      }
      // the centre pixel, and the seam copies either side of it
      const [cxp, cyp] = toPx(lat0, lon0);

      const mix = k / Math.max(1, N - 1);
      const land = c.createLinearGradient(cxp - 200, cyp - 200, cxp + 200, cyp + 200);
      land.addColorStop(0, accentA);
      land.addColorStop(1, accentB);

      for (const dx of [-TEX_W, 0, TEX_W]) {
        // fills are drawn three times so a landmass straddling the
        // antimeridian is whole on both edges of the map
        const path = new Path2D();
        pts.forEach(([x, y], i) => {
          const px = x + dx;
          if (i === 0) path.moveTo(px, y); else path.lineTo(px, y);
        });
        path.closePath();

        c.save();
        c.globalAlpha = 0.34 + mix * 0.10;
        c.fillStyle = land;
        c.fill(path);
        c.globalAlpha = 1;
        c.strokeStyle = accentA;
        c.lineWidth = 3.5;
        c.stroke(path);
        c.restore();

        q.fillStyle = 'rgb(' + (k + 1) + ',' + (k + 1) + ',' + (k + 1) + ')';
        q.fill(path);

        // the name, and only the name
        c.save();
        c.translate(cxp + dx, cyp);
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillStyle = '#fff';
        c.shadowColor = 'rgba(0,0,0,0.85)';
        c.shadowBlur = 14;
        let size = 58;
        c.font = '800 ' + size + 'px Syne, system-ui, sans-serif';
        while (c.measureText(it_name(k)).width > LABEL_W && size > 18) {
          size -= 2;
          c.font = '800 ' + size + 'px Syne, system-ui, sans-serif';
        }
        c.fillText(it_name(k), 0, 0);
        c.restore();
      }
    });

    return { art, ids };
  };
  const it_name = (k) => items[k].name.toUpperCase();

  /* ── mesh ── */
  const verts = [], uvs = [], idx = [];
  for (let iy = 0; iy <= SEG_LAT; iy++) {
    const v = iy / SEG_LAT, theta = v * Math.PI;
    for (let ix = 0; ix <= SEG_LON; ix++) {
      const uu = ix / SEG_LON, lon = uu * TAU - Math.PI;
      verts.push(Math.sin(theta) * Math.sin(lon), Math.cos(theta), Math.sin(theta) * Math.cos(lon));
      uvs.push(uu, v);
    }
  }
  for (let iy = 0; iy < SEG_LAT; iy++) {
    for (let ix = 0; ix < SEG_LON; ix++) {
      const p = iy * (SEG_LON + 1) + ix, r = p + SEG_LON + 1;
      idx.push(p, r, p + 1, r, r + 1, p + 1);
    }
  }

  /* ── scroll curve: park on each project, turn across the step's tail ── */
  const yawFor = (k) => -places[k].lon * D2R;
  const pitchFor = (k) => places[k].lat * D2R;
  const stops = [];
  for (let k = 0; k < N; k++) stops.push(yawFor(k));
  for (let k = 1; k < N; k++) while (stops[k] < stops[k - 1]) stops[k] += TAU;
  stops.push(stops[0] + TAU);
  const pitches = places.map((p) => p.lat * D2R).concat([places[0].lat * D2R]);

  const curve = (p) => {
    const x = clamp(p, 0, 1) * N;
    const k = Math.min(Math.floor(x), N - 1);
    const u = x - k;
    const e = clamp((u - (1 - TRANS)) / TRANS, 0, 1);
    const s = e * e * (3 - 2 * e);
    return { yaw: lerp(stops[k], stops[k + 1], s), pitch: lerp(pitches[k], pitches[k + 1], s), k };
  };

  /* ── gl ── */
  const VS = `#version 300 es
  layout(location=0) in vec3 aPos;
  layout(location=1) in vec2 aUv;
  uniform mat4 uProj, uView, uModel;
  out vec2 vUv; out vec3 vN; out vec3 vView;
  void main() {
    vUv = aUv;
    vN = normalize(mat3(uModel) * aPos);
    vec4 wp = uModel * vec4(aPos, 1.0);
    vec4 vp = uView * wp;
    vView = normalize(-vp.xyz);
    gl_Position = uProj * vp;
  }`;

  const FS = `#version 300 es
  precision highp float;
  in vec2 vUv; in vec3 vN; in vec3 vView;
  uniform sampler2D uTex;
  uniform sampler2D uIds;
  uniform vec3 uRim;
  uniform float uHot;
  out vec4 frag;
  void main() {
    vec4 t = texture(uTex, vUv);
    float id = floor(texture(uIds, vUv).r * 255.0 + 0.5);
    vec3 L = normalize(vec3(0.45, 0.55, 0.85));
    float lam = max(dot(vN, L), 0.0);
    float rim = pow(1.0 - max(dot(vN, vView), 0.0), 2.6);
    vec3 col = t.rgb * (0.30 + 0.95 * lam);
    if (id > 0.5 && abs(id - uHot) < 0.5) col += t.rgb * 0.55 + uRim * 0.10;  // the one you're on
    col += uRim * rim * 0.55;                                                 // atmosphere
    frag = vec4(col, 1.0);
  }`;

  let gl = null, prog = null, vao = null, tex = null, idTex = null, u = {}, count = 0;

  const compile = (t, src) => {
    const s = gl.createShader(t);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); return null; }
    return s;
  };

  const initGL = () => {
    try { gl = canvas.getContext('webgl2', { alpha: true, antialias: true }); }
    catch (e) { gl = null; }
    if (!gl) return false;
    const vs = compile(gl.VERTEX_SHADER, VS), fs = compile(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return false;
    prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.deleteShader(vs); gl.deleteShader(fs);

    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const pb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    const ub = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ub);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx), gl.STATIC_DRAW);
    count = idx.length;
    gl.bindVertexArray(null);

    const maps = buildTexture();
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

    tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, maps.art);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // NEAREST, and no mipmaps: interpolating ids would invent projects that
    // don't exist along every coastline
    idTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, idTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, maps.ids);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    ['uProj', 'uView', 'uModel', 'uTex', 'uIds', 'uRim', 'uHot']
      .forEach((n) => { u[n] = gl.getUniformLocation(prog, n); });

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    return true;
  };

  /* ── matrices ── */
  const proj = new Float32Array(16), view = new Float32Array(16), model = new Float32Array(16);
  const FOV = 0.42;
  const setProj = (aspect) => {
    const f = 1 / Math.tan(FOV), near = 0.1, far = 40, nf = 1 / (near - far);
    proj.fill(0);
    proj[0] = f / aspect; proj[5] = f;
    proj[10] = (far + near) * nf; proj[11] = -1; proj[14] = 2 * far * near * nf;
  };
  const setView = (d) => {
    view.fill(0);
    view[0] = view[5] = view[10] = view[15] = 1;
    view[12] = OFFSET_X; view[14] = -d;
  };
  const setModel = (yaw, pitch) => {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(pitch), sx = Math.sin(pitch);
    model[0] = cy;  model[1] = sx * sy;  model[2] = -cx * sy; model[3] = 0;
    model[4] = 0;   model[5] = cx;       model[6] = sx;       model[7] = 0;
    model[8] = sy;  model[9] = -sx * cy; model[10] = cx * cy; model[11] = 0;
    model[12] = 0;  model[13] = 0;       model[14] = 0;       model[15] = 1;
  };
  const rotate = (p, yaw, pitch) => {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(pitch), sx = Math.sin(pitch);
    return [cy * p[0] + sy * p[2],
            sx * sy * p[0] + cx * p[1] - sx * cy * p[2],
            -cx * sy * p[0] + sx * p[1] + cx * cy * p[2]];
  };
  const unrotate = (p, yaw, pitch) => {   // transpose — rotations are orthonormal
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(pitch), sx = Math.sin(pitch);
    return [cy * p[0] + sx * sy * p[1] - cx * sy * p[2],
            cx * p[1] + sx * p[2],
            sy * p[0] - sx * cy * p[1] + cx * cy * p[2]];
  };

  /* ── state ── */
  let mounted = false, running = false, raf = 0, w = 0, h = 0, ro = null;
  let yaw = 0, pitch = 0, yawTo = 0, pitchTo = 0;
  let spin = 0, spinV = 0;                 // user drag, on top of the scroll
  let step = -1;
  let dragging = false, moved = 0, lastX = 0, lastY = 0;

  const hudIdx = hud.querySelector('.orbit-idx');
  const hudTitle = hud.querySelector('.orbit-title');
  const hudSub = hud.querySelector('.orbit-sub');
  const hudDesc = hud.querySelector('.orbit-desc');
  const hudChips = hud.querySelector('.orbit-chips');
  const hudLink = hud.querySelector('.orbit-link');

  /* The whole write-up rides the scroll. Nothing here is behind a click —
     you get the description and the link for whatever is facing you. */
  const showStep = (k) => {
    if (k === step) return;
    step = k;
    const it = items[k];
    hud.classList.remove('in');
    hudIdx.textContent = it.idx;
    hudTitle.textContent = it.name;
    hudSub.textContent = it.sub || '';
    hudDesc.textContent = it.desc;
    hudChips.innerHTML = '';
    it.chips.forEach((t) => {
      const s = document.createElement('span');
      s.className = 'chip';
      s.textContent = t;
      hudChips.appendChild(s);
    });
    if (it.href) { hudLink.href = it.href; hudLink.textContent = it.label || 'open ↗'; hudLink.hidden = false; }
    else hudLink.hidden = true;
    requestAnimationFrame(() => hud.classList.add('in'));
    // scrolling to a new project re-centres it, so a previous drag decays away
    spinV = 0;
    spin *= 0.25;
  };

  /* Clicking a landmass scrolls to that project's dwell rather than opening
     anything. Scroll stays the single source of truth for where the globe is,
     and the panel updates itself on the way. */
  const jumpTo = (k) => {
    const travel = section.offsetHeight - window.innerHeight;
    if (travel <= 0) return;
    window.scrollTo({ top: section.offsetTop + travel * ((k + 0.5) / N), behavior: 'smooth' });
  };

  /* Follows the canvas's own box, not the window's.
     Mounting races scrolly's measure(): until the section is pinned, the
     viewport is only as tall as its heading — about 54px — so a mount that
     wins that race baked an aspect of ~24 into the projection and a 54px-tall
     drawing buffer. Pinning then stretched that buffer into a full-height box
     and the globe came out as a thin vertical sliver. A window resize was the
     only thing that ever re-ran this, and pinning is not one. */
  const size = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (cw < 2 || ch < 2) return;
    const bw = Math.round(cw * dpr), bh = Math.round(ch * dpr);
    if (cw === w && ch === h && bw === canvas.width && bh === canvas.height) return;
    w = cw; h = ch;
    canvas.width = bw;
    canvas.height = bh;
    gl.viewport(0, 0, bw, bh);
    setProj(w / h);
  };

  const draw = () => {
    raf = running ? requestAnimationFrame(draw) : 0;
    if (!w || !h) { size(); return; }

    if (!dragging) { spin += spinV; spinV *= 0.94; }
    yaw = lerp(yaw, yawTo + spin, 0.12);
    pitch = lerp(pitch, pitchTo, 0.12);

    setModel(yaw, pitch);
    setView(DIST);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(prog);
    gl.bindVertexArray(vao);
    gl.uniformMatrix4fv(u.uProj, false, proj);
    gl.uniformMatrix4fv(u.uView, false, view);
    gl.uniformMatrix4fv(u.uModel, false, model);
    gl.uniform3f(u.uRim, 0.30, 0.72, 0.92);
    gl.uniform1f(u.uHot, step + 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(u.uTex, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, idTex);
    gl.uniform1i(u.uIds, 1);
    gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
  };

  /* ── picking ──
     Ray through the pixel, intersect the unit sphere, undo the rotation to
     get model-space lat/lon, then the same cap test the coastline was
     drawn from. */
  const pick = (clientX, clientY) => {
    const r = canvas.getBoundingClientRect();
    const ndcX = ((clientX - r.left) / r.width) * 2 - 1;
    const ndcY = 1 - ((clientY - r.top) / r.height) * 2;
    const t = Math.tan(FOV), aspect = r.width / r.height;
    let dx = ndcX * t * aspect, dy = ndcY * t, dz = -1;
    const len = Math.hypot(dx, dy, dz); dx /= len; dy /= len; dz /= len;

    const cx = OFFSET_X, cy = 0, cz = -DIST;              // globe centre, view space
    const b = dx * cx + dy * cy + dz * cz;
    const c2 = cx * cx + cy * cy + cz * cz - 1;
    const disc = b * b - c2;
    if (disc < 0) return -1;
    const tHit = b - Math.sqrt(disc);
    if (tHit < 0) return -1;

    const p = unrotate([dx * tHit - cx, dy * tHit - cy, dz * tHit - cz], yaw, pitch);
    const lat = Math.asin(clamp(p[1], -1, 1));
    const lon = Math.atan2(p[0], p[2]);

    for (let k = 0; k < N; k++) {
      const la0 = places[k].lat * D2R, lo0 = places[k].lon * D2R;
      const dLon = lon - lo0;
      const ang = Math.acos(clamp(Math.sin(la0) * Math.sin(lat)
        + Math.cos(la0) * Math.cos(lat) * Math.cos(dLon), -1, 1));
      const brg = Math.atan2(Math.sin(dLon) * Math.cos(lat),
        Math.cos(la0) * Math.sin(lat) - Math.sin(la0) * Math.cos(lat) * Math.cos(dLon));
      if (ang < CAP * D2R * wobble(k, brg < 0 ? brg + TAU : brg)) return k;
    }
    return -1;
  };

  const onDown = (e) => {
    if (!running) return;
    dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY;
    // throws if the pointer isn't active — must not take the drag down with it
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  };
  const onMove = (e) => {
    if (!dragging) {
      if (running) canvas.style.cursor = pick(e.clientX, e.clientY) >= 0 ? 'pointer' : 'grab';
      return;
    }
    const dx = e.clientX - lastX;
    moved += Math.abs(dx) + Math.abs(e.clientY - lastY);
    spinV = dx * 0.0016;
    spin += dx * 0.005;
    lastX = e.clientX; lastY = e.clientY;
  };
  const onUp = (e) => {
    if (!dragging) return;
    dragging = false;
    if (moved > 6) return;                    // that was a spin, not a click
    const k = pick(e.clientX, e.clientY);
    if (k >= 0) jumpTo(k);
  };

  const start = () => { if (!running && mounted) { running = true; if (!raf) raf = requestAnimationFrame(draw); } };
  const stop = () => { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; };

  const mount = () => {
    if (mounted) return true;
    if (!canPin() || !initGL()) return false;
    mounted = true;
    section.classList.add('orbit-on');
    size();
    window.addEventListener('resize', size);
    // the box can change without the window doing anything — pinning, fonts,
    // the fallback swapping in — so watch the element itself
    if (window.ResizeObserver) { ro = new ResizeObserver(size); ro.observe(canvas); }
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    const c0 = curve(0);
    yaw = yawTo = c0.yaw; pitch = pitchTo = c0.pitch;
    showStep(0);
    return true;
  };

  const unmount = () => {
    if (!mounted) return;
    stop();
    mounted = false;
    section.classList.remove('orbit-on');
    window.removeEventListener('resize', size);
    if (ro) { ro.disconnect(); ro = null; }
    canvas.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  };

  window.ProjectOrbit = {
    get active() { return mounted; },
    setProgress(p) {
      if (!mounted) return;
      const c = curve(p);
      yawTo = c.yaw; pitchTo = c.pitch;
      showStep(c.k);
    },
    setVisible(v) {
      // scrolling the section into view is the natural moment to retry a
      // mount that failed earlier — by now layout has settled and the
      // compositor is certainly running
      if (v) { if (!mounted && fxOn()) mount(); start(); } else stop();
    },
  };

  const fxOn = () => !window.__fxOn || window.__fxOn();

  const boot = () => {
    /* Register whatever happens. Bailing out on a failed first mount used to
       skip this, which left the globe dead for the whole page load: the
       effects toggle had no handler to call and nothing ever re-checked. A
       mount can fail for reasons that later stop being true — a window that
       starts too narrow to pin, or a GL context the browser declines to hand
       out while the page is still coming up. */
    if (fxOn()) mount();
    if (window.__fxRegister) {
      window.__fxRegister({ enable() { if (mount()) start(); }, disable() { unmount(); } });
    } else if (fxOn()) start();
    /* Follow the pin threshold both ways. Widening past it should upgrade to
       the globe; narrowing below it has to hand the section back to the card
       track, or a resized window is left with a globe in a layout that no
       longer pins and a card list that is still hidden underneath it. */
    window.addEventListener('resize', () => {
      if (mounted && !canPin()) { unmount(); return; }
      if (!mounted && fxOn() && mount()) start();
    });
  };

  // the map bakes project names into a texture — wait for the webfonts
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot).catch(boot);
  else boot();
})();

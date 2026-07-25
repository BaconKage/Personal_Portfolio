/* ═══════════════════════════════════════════════════════
   SHUBHANG VARDA — PORTFOLIO · main.js
   preloader · cursor · reveals · counters · typewriter
   stack matrix · magnetic · terminal · command palette
   ───────────────────────────────────────────────────────
   The generative background lives in field.js; everything
   scroll-driven lives in scrolly.js. This file owns the
   chrome and the effects manager both of them register with.
   ═══════════════════════════════════════════════════════ */

(() => {
  'use strict';

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ─────────── MOTION / EFFECTS MANAGER ─────────── */
  // Resolve initial state: an inline <head> script already stamped fx-on/fx-off
  // (from saved preference, else the OS reduce-motion setting). Fall back here.
  const de = document.documentElement;
  let motionEnabled;
  if (de.classList.contains('fx-on')) motionEnabled = true;
  else if (de.classList.contains('fx-off')) motionEnabled = false;
  else { motionEnabled = !prefersReduced; de.classList.add(motionEnabled ? 'fx-on' : 'fx-off'); }

  const toast = (msg) => {
    const t = document.createElement('div');
    t.textContent = msg;
    t.className = 'fx-toast';
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 1500);
  };

  const FX = {
    handlers: [],
    register(h) { this.handlers.push(h); try { (motionEnabled ? h.enable : h.disable)(); } catch (e) {} },
    set(on) {
      motionEnabled = on;
      de.classList.toggle('fx-on', on);
      de.classList.toggle('fx-off', !on);
      try { localStorage.setItem('fx', on ? 'on' : 'off'); } catch (e) {}
      this.handlers.forEach((h) => { try { (on ? h.enable : h.disable)(); } catch (e) {} });
    },
  };
  // field.js / scrolly.js load around this file and register through here
  window.__fxRegister = (h) => FX.register(h);
  window.__fxOn = () => motionEnabled;

  /* ─────────── BOOT SEQUENCE ───────────
     Start gate → compile log → wipe into the page. The hero's entrance
     animation is paused until this finishes (see html.booted in
     editorial.css) so the two never play over each other. */
  (function boot() {
    const el = $('#boot');
    if (!el) { de.classList.add('booted'); return; }

    const startBtn = $('#bootStart');
    const skipBtn = $('#bootSkip');
    const hint = $('#bootHint');
    const codeEl = $('#bootCode');
    const logEl = $('#bootLog');
    const bar = $('#bootBar');
    const statusEl = $('#bootStatus');

    let finished = false;
    document.body.style.overflow = 'hidden';

    const finish = () => {
      if (finished) return;
      finished = true;
      el.classList.add('done');
      de.classList.add('booted');
      document.body.style.overflow = '';
      try { sessionStorage.setItem('booted', '1'); } catch (e) {}
      setTimeout(() => el.remove(), 1000);
    };

    // Returning within the same session shouldn't mean sitting through
    // the intro again — but a fresh visitor always gets it.
    let seen = false;
    try { seen = sessionStorage.getItem('booted') === '1'; } catch (e) {}
    if (seen || !motionEnabled || prefersReduced) {
      el.classList.add('instant');
      finish();
      return;
    }

    /* The source that gets typed out. It is a genuine, readable summary of
       how this page actually works — the field really does hold ~214 nodes
       and every section really does re-theme the page on enter. Anyone who
       stops to read it learns something true. */
    const SRC = [
      "// portfolio.boot.ts — what you're about to look at",
      "import { NeuralField } from './field';",
      "import { sections } from './content';",
      '',
      'async function boot() {',
      "  const field = NeuralField('#fieldCanvas');",
      "  await field.warm({ nodes: 214, layout: 'net' });",
      '',
      '  for (const s of sections) {',
      '    // each section repaints the page and reshapes the network',
      "    s.on('enter', () => field.morph(s.layout, s.palette));",
      '  }',
      '',
      '  return render(sections);',
      '}',
      '',
      "boot().then(() => ready('shubhang srinivas varda'));",
    ].join('\n');

    /* Log entries fire as the typing passes the line they belong to. */
    const LOG_AT = {
      2: ['content', '8 sections · 6 products'],
      6: ['field', '214 nodes · 60fps'],
      10: ['sections', 'observers attached'],
      13: ['render', 'web · mobile · api'],
      16: ['ready', 'welcome'],
    };

    /* Minimal TypeScript tokenizer — order matters, first match wins. */
    const RULES = [
      [/^\/\/[^\n]*/, 'com'],
      [/^'[^']*'/, 'str'],
      [/^\b(?:import|from|export|const|let|async|await|function|return|for|of|new|then|null|true|false)\b/, 'kw'],
      [/^\b\d+\b/, 'num'],
      [/^[A-Za-z_$][\w$]*(?=\s*\()/, 'fn'],
      [/^[A-Z][\w$]*/, 'cls'],
      [/^[A-Za-z_$][\w$]*/, 'id'],
      [/^\s+/, 'ws'],
      [/^[^\s\w]/, 'op'],
    ];
    const tokenize = (src) => {
      const out = [];
      let i = 0;
      while (i < src.length) {
        const rest = src.slice(i);
        let hit = null;
        for (const [re, cls] of RULES) {
          const m = re.exec(rest);
          if (m) { hit = { cls, text: m[0] }; break; }
        }
        if (!hit) hit = { cls: 'op', text: rest[0] };
        out.push(hit);
        i += hit.text.length;
      }
      return out;
    };

    const addLog = (key, val) => {
      if (!logEl) return;
      const row = document.createElement('div');
      row.className = 'boot-log-row';
      row.innerHTML =
        '<span class="boot-log-k"></span><span class="boot-log-v"></span>';
      row.querySelector('.boot-log-k').textContent = key;
      row.querySelector('.boot-log-v').textContent = val;
      logEl.appendChild(row);
      requestAnimationFrame(() => row.classList.add('in'));
    };

    const run = () => {
      if (el.classList.contains('running')) return;
      el.classList.add('running');
      if (statusEl) statusEl.textContent = 'building…';
      // the whole sequence lands around 2.8s — long enough to read as a real
      // build, short enough that nobody bounces waiting for it
      if (bar) bar.style.transitionDuration = '2900ms';
      requestAnimationFrame(() => { if (bar) bar.style.transform = 'scaleX(1)'; });

      const tokens = tokenize(SRC);
      const frag = document.createDocumentFragment();
      const spans = tokens.map((t) => {
        const s = document.createElement('span');
        s.className = 'tk tk-' + t.cls;
        frag.appendChild(s);
        return s;
      });
      const caret = document.createElement('span');
      caret.className = 'boot-caret';
      frag.appendChild(caret);
      codeEl.appendChild(frag);

      let ti = 0, ci = 0, line = 0;
      const step = () => {
        if (finished) return;
        if (ti >= tokens.length) {
          // the final line has no trailing newline, so flush its entry here
          const last = LOG_AT[line];
          if (last) addLog(last[0], last[1]);
          if (statusEl) statusEl.textContent = 'ready';
          caret.classList.add('done');
          setTimeout(finish, 450);
          return;
        }
        const tk = tokens[ti];

        // whitespace lands whole; a newline is where the log ticks over
        if (tk.cls === 'ws') {
          spans[ti].textContent = tk.text;
          const breaks = (tk.text.match(/\n/g) || []).length;
          for (let n = 0; n < breaks; n++) {
            const entry = LOG_AT[line];
            if (entry) addLog(entry[0], entry[1]);
            line++;
          }
          ti++; ci = 0;
          codeEl.scrollTop = codeEl.scrollHeight;
          return setTimeout(step, breaks ? 50 : 0);
        }

        ci = Math.min(ci + 2, tk.text.length);   // two glyphs a tick
        spans[ti].textContent = tk.text.slice(0, ci);
        if (ci >= tk.text.length) { ti++; ci = 0; }
        setTimeout(step, 8);
      };
      step();
    };

    startBtn?.addEventListener('click', run);
    skipBtn?.addEventListener('click', finish);
    window.addEventListener('keydown', function onKey(e) {
      if (finished) return;
      if (e.key === 'Enter' || e.key === ' ') {
        if (!el.classList.contains('running')) { e.preventDefault(); run(); }
      } else if (e.key === 'Escape') {
        finish();
      }
    });

    setTimeout(() => startBtn?.focus(), 120);
    if (hint) setTimeout(() => hint.classList.add('show'), 900);

    // never trap someone behind a stalled intro
    setTimeout(() => { if (!el.classList.contains('running')) return; finish(); }, 12000);
  })();

  /* ─────────── BOOT BACKDROP ─────────── */
  (function bootField() {
    const cv = $('#bootCanvas');
    if (!cv || !motionEnabled) return;
    const ctx = cv.getContext('2d');
    let w = 0, h = 0, pts = [], raf, t0 = performance.now();

    const size = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = cv.clientWidth; h = cv.clientHeight;
      if (w < 2 || h < 2) return;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      pts = Array.from({ length: 46 }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      }));
    };
    size();
    addEventListener('resize', size);

    const frame = () => {
      if (!document.getElementById('boot')) { cancelAnimationFrame(raf); return; }
      const age = Math.min((performance.now() - t0) / 2600, 1);
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
          if (d > 170) continue;
          ctx.strokeStyle = `rgba(140,110,240,${(1 - d / 170) * 0.3 * age})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.stroke();
        }
      }
      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.5, 0, 6.2832);
        ctx.fillStyle = `rgba(190,175,255,${0.6 * age})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    frame();
  })();

  /* ─────────── SPLIT HERO NAME INTO LETTERS ─────────── */
  $$('.hero-word').forEach((word) => {
    const text = word.textContent;
    word.textContent = '';
    for (const ch of text) {
      const span = document.createElement('span');
      span.className = 'hero-char';
      span.textContent = ch;
      word.appendChild(span);
    }
  });

  /* ─────────── LIVE BENGALURU CLOCK ─────────── */
  // both the menu bar and the identity window carry a clock
  const clocks = $$('[data-clock]');
  if (clocks.length) {
    const tick = () => {
      const t = new Date().toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Kolkata', hour12: false,
      });
      clocks.forEach((el) => { el.textContent = t; });
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ─────────── CAFFEINE METER ───────────
     One timer drives both the bar and the readout so they can't drift apart,
     which a CSS animation plus a JS counter inevitably would. */
  (function battery() {
    const fill = $('#battFill');
    const pct = $('#battPct');
    if (!fill || !pct) return;
    const CYCLE = 7000, RAMP = 5400;
    const paint = (p, dip) => {
      fill.style.width = (p * 100).toFixed(1) + '%';
      fill.style.opacity = dip ? '0.25' : '1';
      pct.textContent = Math.round(p * 100) + '%';
    };
    const tick = (force) => {
      // skip the work while the tab is hidden, but never leave it unpainted
      if (document.hidden && !force) return;
      const t = Date.now() % CYCLE;
      const p = t < RAMP ? 1 - Math.pow(1 - t / RAMP, 2) : 1;   // eases as it tops up
      paint(p, t > CYCLE - 260);   // brief dip hides the reset to empty
    };

    if (!motionEnabled) { paint(1, false); return; }
    tick(true);
    setInterval(tick, 90);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(true); });
  })();

  /* ─────────── CUSTOM CURSOR ─────────── */
  const dot = $('#cursorDot');
  const ring = $('#cursorRing');
  if (dot && ring && !isTouch && motionEnabled) {
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    addEventListener('mousemove', (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
    });
    (function render() {
      rx = lerp(rx, mx, 0.18); ry = lerp(ry, my, 0.18);
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
      requestAnimationFrame(render);
    })();
    const hoverSel = 'a, button, input, [data-magnetic], [data-tilt], .chip, .tag, .term-chip';
    document.addEventListener('mouseover', (e) => { if (e.target.closest(hoverSel)) ring.classList.add('hovering'); });
    document.addEventListener('mouseout', (e) => { if (e.target.closest(hoverSel)) ring.classList.remove('hovering'); });
  } else if (dot && ring) {
    dot.style.display = 'none'; ring.style.display = 'none';
  }

  /* ─────────── SCROLL PROGRESS + NAV ─────────── */
  const navById = new Map();
  $$('[data-nav]').forEach((l) => navById.set(l.getAttribute('href').slice(1), l));
  const dotById = new Map();
  $$('[data-dot]').forEach((l) => dotById.set(l.getAttribute('href').slice(1), l));
  const progress = $('#scrollProgress');
  const nav = $('#nav');
  const onScroll = () => {
    const st = scrollY || document.documentElement.scrollTop;
    const h = document.documentElement.scrollHeight - innerHeight;
    if (progress) progress.style.width = (h > 0 ? (st / h) * 100 : 0) + '%';
    if (nav) nav.classList.toggle('scrolled', st > 40);
    if (st < 120) {
      navById.forEach((l) => l.classList.remove('active'));
      dotById.forEach((l) => l.classList.remove('active'));
      dotById.get('hero')?.classList.add('active');
    }
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ─────────── MOBILE MENU ─────────── */
  const burger = $('#navBurger');
  const navLinks = $('#navLinks');
  if (burger && navLinks) {
    const toggle = (force) => {
      const open = force ?? !navLinks.classList.contains('open');
      navLinks.classList.toggle('open', open);
      burger.classList.toggle('open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    };
    burger.addEventListener('click', () => toggle());
    $$('#navLinks a').forEach((a) => a.addEventListener('click', () => toggle(false)));
  }

  /* ─────────── ACTIVE SECTION (nav links + dot nav) ─────────── */
  const sections = $$('section[id]');
  if (sections.length) {
    const secObs = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const id = en.target.id;
        navById.forEach((l) => l.classList.remove('active'));
        dotById.forEach((l) => l.classList.remove('active'));
        navById.get(id)?.classList.add('active');
        dotById.get(id)?.classList.add('active');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((s) => secObs.observe(s));
  }

  /* ─────────── REVEAL ON SCROLL ─────────── */
  const reveals = $$('.reveal-up');
  if (reveals.length) {
    const revObs = new IntersectionObserver((entries, obs) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.style.transitionDelay = (en.target.dataset.delay || '0') + 'ms';
        en.target.classList.add('visible');
        obs.unobserve(en.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach((el) => {
      const sibs = Array.from(el.parentElement.children).filter((c) => c.classList.contains('reveal-up'));
      const idx = sibs.indexOf(el);
      if (idx > 0) el.dataset.delay = Math.min(idx * 80, 320);
      revObs.observe(el);
    });
  }

  /* ─────────── COUNTERS ─────────── */
  $$('.counter').forEach((el) => {
    const cObs = new IntersectionObserver((entries, obs) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        obs.unobserve(en.target);
        const target = parseFloat(el.dataset.target || '0');
        const dec = parseInt(el.dataset.decimals || '0', 10);
        if (!motionEnabled) { el.textContent = target.toFixed(dec); return; }
        const dur = 1500, t0 = performance.now();
        (function step(now) {
          const p = clamp((now - t0) / dur, 0, 1);
          el.textContent = (target * (1 - Math.pow(1 - p, 3))).toFixed(dec);
          if (p < 1) requestAnimationFrame(step); else el.textContent = target.toFixed(dec);
        })(t0);
      });
    }, { threshold: 0.6 });
    cObs.observe(el);
  });

  /* ─────────── TYPEWRITER ─────────── */
  const tw = $('#typewriter');
  if (tw) {
    const roles = ['Full-Stack Developer', 'AI / ML Engineer', 'Computer Vision Tinkerer',
      'Published Springer Author', 'Product-Minded Builder'];
    if (!motionEnabled) { tw.textContent = roles[0]; }
    else {
      let ri = 0, ci = 0, del = false;
      (function tick() {
        const word = roles[ri];
        if (!del) { tw.textContent = word.slice(0, ++ci); if (ci === word.length) { del = true; return setTimeout(tick, 1500); } }
        else { tw.textContent = word.slice(0, --ci); if (ci === 0) { del = false; ri = (ri + 1) % roles.length; } }
        setTimeout(tick, del ? 45 : 85);
      })();
    }
  }

  /* ─────────── STACK MATRIX ─────────── */
  (function skills() {
    const grid = $('#stackMatrix');
    if (!grid) return;
    // inline SVGs for concepts without a brand logo (inherit currentColor)
    const S = {
      api: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="8 7 3 12 8 17"/><polyline points="16 7 21 12 16 17"/><line x1="13" y1="4" x2="11" y2="20"/></svg>',
      face: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><circle cx="9" cy="10" r="1"/><circle cx="15" cy="10" r="1"/><path d="M9 14.5c1 1 5 1 6 0"/></svg>',
      pose: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4" r="2"/><path d="M12 6v6m0 0-4 6m4-6 4 6M8 9h8"/></svg>',
      prompt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>',
      chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><circle cx="8" cy="10" r=".6" fill="currentColor"/><circle cx="12" cy="10" r=".6" fill="currentColor"/><circle cx="16" cy="10" r=".6" fill="currentColor"/></svg>',
      wave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="10" x2="4" y2="14"/><line x1="8" y1="6" x2="8" y2="18"/><line x1="12" y1="9" x2="12" y2="15"/><line x1="16" y1="4" x2="16" y2="20"/><line x1="20" y1="10" x2="20" y2="14"/></svg>',
      shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg>',
      chip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><rect x="7" y="7" width="10" height="10" rx="1"/><path d="M9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2"/></svg>',
      layout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>',
      net: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><rect x="9" y="2" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="16" y="16" width="6" height="6" rx="1"/><path d="M12 8v4M5 16v-2h14v2M12 12v2"/></svg>',
      test: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2h6M10 2v4l-5 12a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3L14 6V2"/><path d="M8 15h8"/></svg>',
      bulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.5 1 2.5h6c0-1 .4-1.9 1-2.5A6 6 0 0 0 12 3z"/></svg>',
      heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 6.6a4.5 4.5 0 0 0-7.8-1.5L12 6.2l-1-1.1A4.5 4.5 0 0 0 3.2 6.6C1.5 9.3 3.4 12.8 12 19c8.6-6.2 10.5-9.7 8.8-12.4z"/><path d="M6 11h3l1.5-2.5L12.5 14l1.5-3H18"/></svg>',
    };
    const DATA = {
      fullstack: [
        { n: 'React', si: 'react', c: '61DAFB' },
        { n: 'Next.js', si: 'nextdotjs', c: 'FFFFFF' },
        { n: 'TypeScript', si: 'typescript', c: '3178C6' },
        { n: 'Node.js', si: 'nodedotjs', c: '5FA04E' },
        { n: 'NestJS', si: 'nestjs', c: 'E0234E' },
        { n: 'Flask', si: 'flask', c: 'FFFFFF' },
        { n: 'FastAPI', si: 'fastapi', c: '009688' },
        { n: 'REST APIs', svg: S.api },
        { n: 'Tailwind', si: 'tailwindcss', c: '06B6D4' },
        { n: 'Flutter', si: 'flutter', c: '54C5F8' },
      ],
      ai: [
        { n: 'MediaPipe', svg: S.face },
        { n: 'OpenCV', si: 'opencv', c: '5C3EE8' },
        { n: 'Pose Est.', svg: S.pose },
        { n: 'Gemini', si: 'googlegemini', c: '8E75B2' },
        { n: 'OpenAI', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M2 12h20M5 5l14 14M19 5 5 19"/></svg>' },
        { n: 'Groq', svg: S.prompt },
        { n: 'Prompt Eng.', svg: S.prompt },
        { n: 'Chatbots', svg: S.chat },
        { n: 'Deepfake Det.', svg: S.wave },
        { n: 'AASIST', svg: S.shield },
        { n: 'Silero VAD', svg: S.wave },
      ],
      data: [
        { n: 'MongoDB', si: 'mongodb', c: '47A248' },
        { n: 'PostgreSQL', si: 'postgresql', c: '4169E1' },
        { n: 'Prisma', si: 'prisma', c: 'FFFFFF' },
        { n: 'Supabase', si: 'supabase', c: '3FCF8E' },
        { n: 'AWS', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.3A3.5 3.5 0 0 1 18 16z"/><path d="M4 20c3 1.5 13 1.5 16 0"/></svg>' },
        { n: 'Google Cloud', si: 'googlecloud', c: '4285F4' },
        { n: 'Modal', svg: S.chip },
        { n: 'Vercel', si: 'vercel', c: 'FFFFFF' },
      ],
      craft: [
        { n: 'UI/UX', svg: S.layout },
        { n: 'Figma', si: 'figma', c: 'F24E1E' },
        { n: 'Git', si: 'git', c: 'F05032' },
        { n: 'GitHub', si: 'github', c: 'FFFFFF' },
        { n: 'Architecture', svg: S.net },
        { n: 'Testing', svg: S.test },
        { n: 'Product', svg: S.bulb },
        { n: 'Affective AI', svg: S.heart },
      ],
    };
    // category → legend swatch, so a cell always declares which layer it belongs to
    const CAT = { fullstack: '#a855f7', ai: '#22d3ee', data: '#10b981', craft: '#fbbf24' };
    const mono = (n) => `<span class="mcell-mono">${n.slice(0, 2)}</span>`;

    // Interleave the categories so the matrix reads as a mixed weight grid
    // rather than four stacked blocks — the row/column wiring is only
    // interesting when neighbours come from different disciplines.
    const cats = Object.keys(DATA);
    const cursors = cats.map(() => 0);
    const cells = [];
    let remaining = cats.reduce((n, c) => n + DATA[c].length, 0);
    while (remaining > 0) {
      cats.forEach((cat, ci) => {
        const list = DATA[cat];
        if (cursors[ci] >= list.length) return;
        cells.push({ cat, it: list[cursors[ci]++] });
        remaining--;
      });
    }

    const frag = document.createDocumentFragment();
    cells.forEach(({ cat, it }) => {
      const cell = document.createElement('div');
      cell.className = 'mcell';
      cell.style.setProperty('--cat', CAT[cat]);
      cell.title = it.n;

      const logo = document.createElement('div');
      logo.className = 'mcell-logo';
      if (it.si) {
        const img = new Image();
        img.alt = it.n; img.decoding = 'async';
        img.onerror = () => { logo.innerHTML = mono(it.n); };
        img.src = `assets/icons/${it.si}.svg`;
        // safety net for offline/blocked environments (local files load instantly)
        setTimeout(() => { if (!img.complete || img.naturalWidth === 0) logo.innerHTML = mono(it.n); }, 6000);
        logo.appendChild(img);
      } else {
        logo.innerHTML = it.svg;
      }

      const label = document.createElement('span');
      label.className = 'mcell-label';
      label.textContent = it.n;

      cell.appendChild(logo);
      cell.appendChild(label);
      frag.appendChild(cell);
    });
    grid.appendChild(frag);
  })();

  /* ─────────── MAGNETIC ─────────── */
  if (!isTouch && motionEnabled) {
    $$('[data-magnetic]').forEach((el) => {
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${(e.clientX - (r.left + r.width / 2)) * 0.35}px, ${(e.clientY - (r.top + r.height / 2)) * 0.35}px)`;
      });
      el.addEventListener('mouseleave', () => { el.style.transform = ''; });
    });
  }

  /* ─────────── TILT + GLOW-FOLLOW ─────────── */
  if (!isTouch && motionEnabled) {
    $$('[data-tilt]').forEach((el) => {
      const max = 8;
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        el.style.setProperty('--mx', px * 100 + '%');
        el.style.setProperty('--my', py * 100 + '%');
        el.style.transform = `perspective(900px) rotateX(${(0.5 - py) * max * 2}deg) rotateY(${(px - 0.5) * max * 2}deg) translateY(-4px)`;
      });
      el.addEventListener('mouseleave', () => { el.style.transform = ''; });
    });
  }

  /* ─────────── INTERACTIVE TERMINAL ─────────── */
  (function terminal() {
    const win = $('#terminalWindow');
    const body = $('#terminalBody');
    const inputLine = $('#termInputLine');
    const input = $('#termInput');
    if (!win || !body || !input) return;

    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const promptHTML = '<span class="term-user">shubhang</span><span class="term-out">@</span><span class="term-accent">portfolio</span><span class="term-out">:</span><span class="term-path">~</span><span class="term-prompt">$</span> ';
    const print = (html) => {
      const div = document.createElement('div');
      div.className = 'term-line';
      div.innerHTML = html;
      body.insertBefore(div, inputLine);
      body.scrollTop = body.scrollHeight;
    };
    const printCmd = (cmd) => print(promptHTML + '<span class="term-cmd">' + esc(cmd) + '</span>');

    const link = (url, label) => `<a class="term-link" href="${url}" target="_blank" rel="noopener">${label || url}</a>`;
    const scrollTo = (id) => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth' }); };

    const commands = {
      help: () => [
        '<span class="term-accent">Available commands:</span>',
        '  <span class="term-cmd">whoami</span>      who I am, in one breath',
        '  <span class="term-cmd">about</span>       the longer story',
        '  <span class="term-cmd">skills</span>      my tech arsenal',
        '  <span class="term-cmd">projects</span>    things I\'ve shipped',
        '  <span class="term-cmd">experience</span>  where I\'ve worked',
        '  <span class="term-cmd">research</span>    my published paper',
        '  <span class="term-cmd">education</span>   academic record',
        '  <span class="term-cmd">contact</span>     how to reach me',
        '  <span class="term-cmd">socials</span>     find me online',
        '  <span class="term-cmd">resume</span>      get my CV',
        '  <span class="term-cmd">goto</span> &lt;sec&gt;  jump to a section (e.g. goto projects)',
        '  <span class="term-cmd">sudo hire-me</span> ;)',
        '  <span class="term-cmd">clear</span>       wipe the screen',
      ],
      whoami: () => [
        '<span class="term-accent">Shubhang Srinivas Varda</span>',
        'Final-year B.Tech CSE (Data Science &amp; Engineering) @ RV University, Bengaluru.',
        'Full-stack + AI/ML engineer who ships products people actually use.',
        '<span class="term-ok">2</span> live internships · <span class="term-ok">5+</span> shipped builds · <span class="term-ok">1</span> Springer-published paper · CGPA <span class="term-ok">8.01</span>',
      ],
      about: () => [
        'I build software where <span class="term-accent">AI meets the real world</span> — not demos, but',
        'products with users: gyms running on my code, doctors training with my',
        'simulations, and kids learning languages through my apps.',
        '',
        'Currently juggling two internships — an AI gym platform at Catalyst To',
        'BeActive (MyGym) and healthcare communication simulators at First Drop Theatre.',
        'I co-authored a peer-reviewed paper on the "Paradox of Imperfection" in AI,',
        'published in Springer Nature\'s <span class="term-accent">AI &amp; Society</span> journal.',
      ],
      skills: () => [
        '<span class="term-warn">Full-Stack</span>   React · Next.js · TypeScript · Node · NestJS · Flask · FastAPI · Tailwind · Flutter',
        '<span class="term-warn">AI / ML</span>      MediaPipe · OpenCV · Pose Estimation · Gemini · OpenAI · Groq · Prompt Eng · AASIST',
        '<span class="term-warn">Data/Cloud</span>   MongoDB · PostgreSQL · Prisma · Supabase · AWS · Google Cloud · Modal · Vercel',
        '<span class="term-warn">Craft</span>        UI/UX · Figma · Git · System Architecture · Software Testing · Product Thinking',
      ],
      projects: () => [
        '<span class="term-accent">01.</span> MyGym — modular gym OS (Next.js · NestJS · PostgreSQL · Expo) ' + link('https://mygym.co.in', '↗ live'),
        '<span class="term-accent">02.</span> VaniCert — voice deepfake detector (AASIST · Silero-VAD · FastAPI/Modal) ' + link('https://vanicert.vercel.app', '↗ live'),
        '<span class="term-accent">03.</span> FirstDropAI — healthcare roleplay sim (Next.js · Gemini API) ' + link('https://firstdroptheatre.com', '↗ site'),
        '<span class="term-accent">04.</span> BhashaBuddy — language learning for NRI kids (React · Supabase · OpenAI) ' + link('https://parampara-one.vercel.app/', '↗ live'),
        '<span class="term-accent">05.</span> AI Gym UX overhaul — diet planner + posture engine (OpenCV · MediaPipe · Flask)',
        '',
        '<span class="term-out">tip: type</span> <span class="term-cmd">goto projects</span> <span class="term-out">for the full showcase.</span>',
      ],
      experience: () => [
        '<span class="term-ok">●</span> Technology Consultant @ First Drop Theatre   <span class="term-out">Jun 2026 — present</span>',
        '    AI healthcare-communication simulator · Next.js · Gemini · STT/TTS',
        '    ' + link('https://firstdroptheatre.com', 'firstdroptheatre.com'),
        '<span class="term-ok">●</span> Full Stack Developer @ Catalyst To BeActive   <span class="term-out">Mar 2025 — present</span>',
        '    AI gym platform · React/Flutter/Flask · MediaPipe + OpenCV workout validation',
        '    ' + link('https://mygym.co.in', 'mygym.co.in'),
      ],
      research: () => [
        '<span class="term-warn">📄 Peer-reviewed · Springer Nature · AI &amp; Society · Dec 2025</span>',
        '"Imperfection as a Constitutive Property of Artificial Intelligence"',
        'Introduces the Paradox of Imperfection: as AI grows more complex, errors',
        'don\'t vanish — they become deeper structural uncertainties. Bridges AI ethics,',
        'complexity theory, and real-world stakes in healthcare, law &amp; autonomy.',
        '→ Read it: ' + link('https://link.springer.com/article/10.1007/s00146-025-02837-2', 'link.springer.com/.../s00146-025-02837-2'),
      ],
      education: () => [
        'B.Tech CSE (Data Science) · RV University · 2023–2027 · CGPA 8.01/10',
        'Class XII · RV PU College · 80.83%',
        'Class X · St. Joseph\'s Boys\' High School · 91.10%',
      ],
      contact: () => [
        '<span class="term-accent">Email</span>     ' + link('mailto:vardashubhang@gmail.com', 'vardashubhang@gmail.com'),
        '<span class="term-accent">Academic</span>  ' + link('mailto:shubhangsv.btech23@rvu.edu.in', 'shubhangsv.btech23@rvu.edu.in'),
        '<span class="term-accent">Phone</span>     +91 83107 54365',
        '<span class="term-accent">Location</span>  Bengaluru, Karnataka, India',
      ],
      socials: () => [
        '<span class="term-accent">GitHub</span>    ' + link('https://github.com/BaconKage', 'github.com/BaconKage'),
        '<span class="term-accent">LinkedIn</span>  ' + link('https://www.linkedin.com/in/shubhang-srinivas-varda-322ba4297/', 'linkedin.com/in/shubhang-srinivas-varda'),
      ],
      resume: () => [
        '<span class="term-warn">Fetching résumé…</span>',
        'The freshest copy lives with me — drop a line and I\'ll send the latest PDF:',
        link('mailto:vardashubhang@gmail.com', 'vardashubhang@gmail.com'),
      ],
      socials_: null,
      ls: () => ['about.md  skills.json  projects/  experience.log  research.pdf  contact.vcf'],
      date: () => [new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' }) + ' IST'],
      banner: () => [
        '<span class="term-accent">',
        ' ____  _   _ _   _ ____  _   _   _    _   _  ____ ',
        '/ ___|| | | | | | | __ )| | | | / \\  | \\ | |/ ___|',
        '\\___ \\| |_| | | | |  _ \\| |_| |/ _ \\ |  \\| | |  _ ',
        ' ___) |  _  | |_| | |_) |  _  / ___ \\| |\\  | |_| |',
        '|____/|_| |_|\\___/|____/|_| |_/_/   \\_\\_| \\_|\\____|',
        '</span><span class="term-out">final-year CS · full-stack + AI · Bengaluru</span>',
      ],
      'sudo hire-me': () => [
        '<span class="term-out">[sudo] password for recruiter:</span> ********',
        '<span class="term-ok">✓ Authentication successful. Access granted.</span>',
        '',
        'Shubhang is <span class="term-ok">available</span> for internships &amp; new-grad roles.',
        'Great fit for: full-stack, AI/ML, computer vision, applied-AI product teams.',
        '→ Start the conversation: ' + link('mailto:vardashubhang@gmail.com', 'vardashubhang@gmail.com'),
      ],
      clear: () => { $$('.term-line', body).forEach((l) => l.remove()); return null; },
    };
    commands.contacts = commands.contact;
    commands.social = commands.socials;
    commands.exit = () => ['<span class="term-out">Nice try — you can\'t leave, we\'re just getting started. 😄</span>'];
    commands['rm -rf /'] = () => ['<span class="term-err">Whoa there. Deleting my portfolio would be a hiring red flag. Denied. 🛑</span>'];

    const run = (raw) => {
      const cmd = raw.trim();
      if (!cmd) return;
      printCmd(cmd);
      history.unshift(cmd); histIdx = -1;
      const lc = cmd.toLowerCase();
      if (lc.startsWith('goto')) {
        const target = lc.split(/\s+/)[1];
        const map = { home: 'hero', terminal: 'explore', explore: 'explore', console: 'explore', about: 'about', casestudy: 'casestudy', 'case': 'casestudy', mygym: 'casestudy', skills: 'skills', stack: 'skills', experience: 'experience', exp: 'experience', projects: 'projects', builds: 'projects', work: 'projects', research: 'research', beyond: 'beyond', contact: 'contact' };
        if (map[target]) { print('<span class="term-ok">→ jumping to ' + target + '…</span>'); scrollTo(map[target]); }
        else print('<span class="term-err">goto: unknown section "' + esc(target || '') + '". try: about, skills, projects, research, contact</span>');
        return;
      }
      const fn = commands[lc];
      if (fn) { const out = fn(); if (out) out.forEach(print); }
      else print('<span class="term-err">command not found: ' + esc(cmd) + '</span> — type <span class="term-cmd">help</span>');
    };

    let history = [], histIdx = -1;
    const cmdKeys = Object.keys(commands).concat(['goto']);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { run(input.value); input.value = ''; }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (histIdx < history.length - 1) input.value = history[++histIdx] || ''; }
      else if (e.key === 'ArrowDown') { e.preventDefault(); if (histIdx > 0) input.value = history[--histIdx] || ''; else { histIdx = -1; input.value = ''; } }
      else if (e.key === 'Tab') {
        e.preventDefault();
        const v = input.value.toLowerCase();
        const hit = cmdKeys.find((k) => k.startsWith(v) && v);
        if (hit) input.value = hit;
      }
    });

    body.addEventListener('click', (e) => { if (!e.target.closest('a')) input.focus(); });
    $$('.term-chip').forEach((chip) => chip.addEventListener('click', () => {
      const c = chip.dataset.cmd; input.value = ''; scrollTo('explore');
      run(c);
      input.focus();
    }));
    input.addEventListener('focus', () => win.classList.add('focused'));
    input.addEventListener('blur', () => win.classList.remove('focused'));

    // welcome sequence on first view
    let booted = false;
    const boot = () => {
      if (booted) return; booted = true;
      const lines = [
        '<span class="term-out">Last login: just now on ttys001</span>',
        'Welcome to <span class="term-accent">shubhang@portfolio</span> — an interactive résumé.',
        'Type <span class="term-cmd">help</span> to see what I can do, or try <span class="term-cmd">whoami</span>.',
        '',
      ];
      let i = 0;
      (function next() { if (i < lines.length) { print(lines[i++]); setTimeout(next, 320); } })();
    };
    new IntersectionObserver((es, obs) => es.forEach((en) => { if (en.isIntersecting) { boot(); obs.disconnect(); } }), { threshold: 0.3 }).observe(win);
  })();

  /* ─────────── COMMAND PALETTE (⌘K) ─────────── */
  (function palette() {
    const cmdk = $('#cmdk');
    const inp = $('#cmdkInput');
    const list = $('#cmdkList');
    if (!cmdk || !inp || !list) return;

    const go = (id) => () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    const open = (url) => () => window.open(url, '_blank', 'noopener');
    const items = [
      { ico: '🏠', label: 'Home', sub: 'top', run: go('hero') },
      { ico: '💻', label: 'Interactive Terminal', sub: 'explore', run: () => { go('explore')(); setTimeout(() => $('#termInput')?.focus(), 500); } },
      { ico: '👤', label: 'About', sub: 'who I am', run: go('about') },
      { ico: '🧬', label: 'Case Study', sub: 'MyGym architecture', run: go('casestudy') },
      { ico: '🧠', label: 'Stack', sub: 'weight matrix', run: go('skills') },
      { ico: '🚀', label: 'Experience', sub: 'where I shipped', run: go('experience') },
      { ico: '🛠️', label: 'Projects', sub: 'featured builds', run: go('projects') },
      { ico: '📄', label: 'Research', sub: 'Springer paper', run: go('research') },
      { ico: '🌍', label: 'Beyond Code', sub: 'leadership', run: go('beyond') },
      { ico: '✉️', label: 'Email me', sub: 'vardashubhang@gmail.com', run: open('mailto:vardashubhang@gmail.com') },
      { ico: '📋', label: 'Copy email', sub: 'to clipboard', run: () => { navigator.clipboard?.writeText('vardashubhang@gmail.com'); flash('email copied ✓'); } },
      { ico: '🐙', label: 'GitHub', sub: 'BaconKage', run: open('https://github.com/BaconKage') },
      { ico: '💼', label: 'LinkedIn', sub: 'connect', run: open('https://www.linkedin.com/in/shubhang-srinivas-varda-322ba4297/') },
      { ico: '📞', label: 'Call', sub: '+91 83107 54365', run: open('tel:+918310754365') },
    ];
    let filtered = items.slice(), sel = 0;

    const render = () => {
      list.innerHTML = '';
      if (!filtered.length) { list.innerHTML = '<div class="cmdk-empty">No matches. Try "projects" or "email".</div>'; return; }
      filtered.forEach((it, i) => {
        const el = document.createElement('div');
        el.className = 'cmdk-item' + (i === sel ? ' sel' : '');
        el.innerHTML = `<span class="cmdk-ico">${it.ico}</span><span>${it.label}</span><span class="cmdk-sub">${it.sub}</span>`;
        el.addEventListener('click', () => { close(); it.run(); });
        el.addEventListener('mousemove', () => { sel = i; markSel(); });
        list.appendChild(el);
      });
    };
    const markSel = () => $$('.cmdk-item', list).forEach((el, i) => el.classList.toggle('sel', i === sel));
    const filter = () => {
      const q = inp.value.trim().toLowerCase();
      filtered = q ? items.filter((it) => (it.label + ' ' + it.sub).toLowerCase().includes(q)) : items.slice();
      sel = 0; render();
    };
    const open_ = () => { cmdk.classList.add('open'); inp.value = ''; filter(); setTimeout(() => inp.focus(), 60); };
    const close = () => cmdk.classList.remove('open');
    const isOpen = () => cmdk.classList.contains('open');

    inp.addEventListener('input', filter);
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, filtered.length - 1); markSel(); scrollSel(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); markSel(); scrollSel(); }
      else if (e.key === 'Enter') { e.preventDefault(); const it = filtered[sel]; if (it) { close(); it.run(); } }
      else if (e.key === 'Escape') close();
    });
    const scrollSel = () => $$('.cmdk-item', list)[sel]?.scrollIntoView({ block: 'nearest' });
    cmdk.addEventListener('click', (e) => { if (e.target === cmdk) close(); });

    addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); isOpen() ? close() : open_(); }
      else if (e.key === 'Escape' && isOpen()) close();
    });
    $('#navCmdk')?.addEventListener('click', open_);
    $('#kbdHint')?.addEventListener('click', open_);

    // tiny toast for copy actions
    function flash(msg) {
      const t = document.createElement('div');
      t.textContent = msg;
      t.style.cssText = 'position:fixed;bottom:26px;left:50%;transform:translateX(-50%);z-index:99999;background:linear-gradient(100deg,#a855f7,#22d3ee);color:#0a0118;font-family:monospace;font-weight:600;padding:10px 20px;border-radius:100px;box-shadow:0 8px 40px rgba(168,85,247,.6)';
      document.body.appendChild(t);
      setTimeout(() => { t.style.transition = 'opacity .5s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 500); }, 1600);
    }
    render();
  })();

  /* ─────────── EFFECTS TOGGLE ─────────── */
  (function fxToggle() {
    const btn = $('#fxToggle');
    if (!btn) return;
    const stateEl = $('#fxState');
    const sync = () => {
      btn.classList.toggle('on', motionEnabled);
      btn.setAttribute('aria-pressed', String(motionEnabled));
      if (stateEl) stateEl.textContent = motionEnabled ? 'On' : 'Off';
      btn.title = motionEnabled ? 'Animations are on — click to calm things down' : 'Animations are off — click for the full experience';
    };
    sync();
    btn.addEventListener('click', () => {
      FX.set(!motionEnabled);
      sync();
      toast(motionEnabled ? '✦ Full effects on' : 'Effects paused');
    });
  })();

  /* ─────────── KONAMI EASTER EGG ─────────── */
  const seq = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let pos = 0;
  addEventListener('keydown', (e) => {
    pos = (e.key.toLowerCase() === seq[pos].toLowerCase()) ? pos + 1 : 0;
    if (pos === seq.length) {
      pos = 0;
      document.body.style.transition = 'filter 0.6s';
      document.body.style.filter = 'hue-rotate(180deg)';
      const note = document.createElement('div');
      note.textContent = '⚡ dev mode unlocked — nice.';
      note.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99999;background:linear-gradient(100deg,#a855f7,#22d3ee);color:#0a0118;font-family:monospace;font-weight:600;padding:12px 22px;border-radius:100px;box-shadow:0 8px 40px rgba(168,85,247,.6)';
      document.body.appendChild(note);
      setTimeout(() => { document.body.style.filter = ''; note.style.transition = 'opacity .5s'; note.style.opacity = '0'; setTimeout(() => note.remove(), 500); }, 2600);
    }
  });

  console.log('%c⚡ Built by Shubhang Srinivas Varda', 'color:#a855f7;font-size:14px;font-weight:bold');
  console.log('%cPro tip: press ⌘K / Ctrl+K, or scroll to the terminal and type "sudo hire-me"', 'color:#22d3ee');
})();

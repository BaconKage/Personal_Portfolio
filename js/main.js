/* ═══════════════════════════════════════════════════════
   SHUBHANG VARDA — PORTFOLIO · main.js
   preloader · cursor · aurora shader · particles · reveals
   tilt · magnetic · terminal · command palette · dot-nav
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

  /* ─────────── PRELOADER ─────────── */
  const preloader = $('#preloader');
  const hidePreloader = () => {
    if (!preloader || preloader.classList.contains('done')) return;
    preloader.classList.add('done');
    document.body.style.overflow = '';
    setTimeout(() => preloader.remove(), 800);
  };
  document.body.style.overflow = 'hidden';
  window.addEventListener('load', () => setTimeout(hidePreloader, prefersReduced ? 200 : 1900));
  setTimeout(hidePreloader, 4200);

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
  const clockEl = $('#istClock');
  if (clockEl) {
    const tick = () => {
      clockEl.textContent = new Date().toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Kolkata', hour12: false,
      });
    };
    tick();
    setInterval(tick, 1000);
  }

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

  /* ─────────── SKILL LOGO TILES ─────────── */
  (function skills() {
    const grids = $$('.skill-logos');
    if (!grids.length) return;
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
    const mono = (n) => `<span class="skill-mono">${n.slice(0, 2)}</span>`;
    grids.forEach((grid) => {
      const items = DATA[grid.dataset.cat] || [];
      items.forEach((it, i) => {
        const tile = document.createElement('div');
        tile.className = 'skill-tile';
        const logo = document.createElement('div');
        logo.className = 'skill-logo';
        logo.style.animationDelay = (-(i % 6) * 0.6).toFixed(2) + 's';
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
        label.className = 'skill-label';
        label.textContent = it.n;
        tile.appendChild(logo);
        tile.appendChild(label);
        grid.appendChild(tile);
      });
    });
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

  /* ─────────── HERO PARTICLE NETWORK ─────────── */
  const canvas = $('#particleCanvas');
  if (canvas && canvas.getContext) {
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, dpr, particles = [], raf = null, animating = false, inView = true;
    const mouse = { x: -9999, y: -9999 };
    const resize = () => {
      dpr = Math.min(devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect(); w = r.width; h = r.height;
      if (w < 2 || h < 2) { requestAnimationFrame(resize); return; } // wait for layout
      canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = clamp(Math.round((w * h) / 13000), 48, 108);
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.8 + 1.2,
      }));
      if (!motionEnabled || !animating) render(false); // redraw static constellation on resize
    };
    const LINK = 150;
    const render = (animate) => {
      if (!w || !h) return;
      if (animate) {
        for (const p of particles) {
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0 || p.x > w) p.vx *= -1;
          if (p.y < 0 || p.y > h) p.vy *= -1;
          const mdx = mouse.x - p.x, mdy = mouse.y - p.y;
          if (Math.hypot(mdx, mdy) < 180) { p.x += mdx * 0.0022; p.y += mdy * 0.0022; }
        }
      }
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j], d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < LINK) { ctx.strokeStyle = `rgba(160,135,250,${(1 - d / LINK) * 0.55})`; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
        }
        const dc = Math.hypot(a.x - mouse.x, a.y - mouse.y);
        if (dc < LINK + 60) { ctx.strokeStyle = `rgba(34,211,238,${(1 - dc / (LINK + 60)) * 0.85})`; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke(); }
      }
      ctx.shadowBlur = 8; ctx.shadowColor = 'rgba(140, 120, 255, 0.9)';
      for (const p of particles) {
        const md = Math.hypot(mouse.x - p.x, mouse.y - p.y);
        const near = md < 180 ? (1 - md / 180) : 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r + near * 1.6, 0, 6.283);
        ctx.fillStyle = near > 0.05
          ? `rgba(${Math.round(160 - near * 120)}, ${Math.round(200 + near * 30)}, 255, ${0.9 + near * 0.1})`
          : 'rgba(210, 195, 255, 0.92)';
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    };
    const loop = () => { if (!animating) return; render(true); raf = requestAnimationFrame(loop); };
    const startAnim = () => { if (animating || !motionEnabled || !inView) return; animating = true; loop(); };
    const stopAnim = () => { animating = false; cancelAnimationFrame(raf); };
    resize();
    addEventListener('resize', resize);
    addEventListener('mousemove', (e) => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
    addEventListener('mouseout', () => { mouse.x = -9999; mouse.y = -9999; });
    new IntersectionObserver((es) => es.forEach((en) => {
      inView = en.isIntersecting;
      if (!motionEnabled) return;
      if (inView) startAnim(); else stopAnim();
    }), { threshold: 0 }).observe(canvas);
    FX.register({
      enable: () => { if (inView) startAnim(); else render(false); },
      disable: () => { stopAnim(); render(false); },
    });
  }

  /* ─────────── WEBGL AURORA SHADER ─────────── */
  (function aurora() {
    const cv = $('#glCanvas');
    if (!cv) return;
    const fail = () => { cv.style.display = 'none'; document.body.classList.add('no-webgl'); };
    const opts = { antialias: false, alpha: false, depth: false, stencil: false,
      powerPreference: 'low-power', failIfMajorPerformanceCaveat: false,
      preserveDrawingBuffer: true }; // keep static frame visible when paused/toggled off
    let gl = null;
    try { gl = cv.getContext('webgl', opts) || cv.getContext('experimental-webgl', opts); } catch (e) { /* ignore */ }
    if (!gl) { fail(); return; }

    const vsrc = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    const fsrc = `
      #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      #else
      precision mediump float;
      #endif
      uniform vec2 u_res; uniform float u_time; uniform vec2 u_mouse;
      float hash(vec2 p){p=fract(p*vec2(123.34,345.45));p+=dot(p,p+34.345);return fract(p.x*p.y);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));vec2 u=f*f*(3.-2.*f);return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);}
      float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p*=2.02;a*=.5;}return v;}
      void main(){
        vec2 uv=gl_FragCoord.xy/u_res.xy; vec2 p=uv; p.x*=u_res.x/u_res.y;
        vec2 m=u_mouse; m.x*=u_res.x/u_res.y;
        float md=length(p-m);
        // the cursor disturbs the aurora field — ribbons swirl/push around it
        float infl=exp(-md*md*5.0);
        vec2 dir = md>0.0001 ? (p-m)/md : vec2(0.0);
        p += dir*0.14*infl;
        float t=u_time*0.045;
        vec2 q=vec2(fbm(p+t),fbm(p+vec2(5.2,1.3)-t));
        float n=fbm(p*2.0+q*2.4+t + infl*0.6);
        vec3 violet=vec3(0.66,0.33,0.97), cyan=vec3(0.13,0.83,0.93), pink=vec3(0.93,0.28,0.60);
        vec3 col=mix(violet,cyan,smoothstep(0.2,0.85,n));
        col=mix(col,pink,smoothstep(0.62,0.96,n)*0.5);
        float ribbons=pow(n,3.0);
        col*=ribbons*2.1;
        // luminous cursor halo — visible even in the dark gaps between ribbons
        float glow=smoothstep(0.5,0.0,md);
        col += mix(cyan,violet,0.35) * glow * (0.4 + ribbons*1.4);
        col*=smoothstep(1.2,0.1,length(uv-0.5));
        col*=0.74;
        gl_FragColor=vec4(col,1.0);
      }`;
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn('[aurora] shader compile failed:', gl.getShaderInfoLog(s)); return null; }
      return s;
    };
    const vs = sh(gl.VERTEX_SHADER, vsrc), fs = sh(gl.FRAGMENT_SHADER, fsrc);
    if (!vs || !fs) { fail(); return; }
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { fail(); return; }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(prog, 'u_res');
    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uMouse = gl.getUniformLocation(prog, 'u_mouse');
    let mx = 0.5, my = 0.6, tmx = 0.5, tmy = 0.6;
    const resize = () => {
      const cw = cv.clientWidth, ch = cv.clientHeight;
      if (cw < 2 || ch < 2) return; // ignore pre-layout / hidden sizes
      const scale = 0.5; // render at half-res, aurora is soft anyway
      cv.width = Math.max(2, Math.floor(cw * scale));
      cv.height = Math.max(2, Math.floor(ch * scale));
      gl.viewport(0, 0, cv.width, cv.height);
    };
    const drawStatic = () => {
      gl.uniform2f(uRes, cv.width, cv.height);
      gl.uniform1f(uTime, 8.0);           // a pleasant frozen moment
      gl.uniform2f(uMouse, 0.5, 0.62);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    let animating = false, inView = true, raf, start = performance.now();
    const frame = () => {
      if (!animating) return;
      mx = lerp(mx, tmx, 0.14); my = lerp(my, tmy, 0.14);
      gl.uniform2f(uRes, cv.width, cv.height);
      gl.uniform1f(uTime, (performance.now() - start) / 1000);
      gl.uniform2f(uMouse, mx, my);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    };
    const startAnim = () => { if (animating || !motionEnabled || !inView) return; animating = true; frame(); };
    const stopAnim = () => { animating = false; cancelAnimationFrame(raf); };
    const onResize = () => { resize(); if (!animating) drawStatic(); };
    resize();
    // keep the backing store in sync with actual layout on every machine
    if (window.ResizeObserver) new ResizeObserver(onResize).observe(cv);
    addEventListener('resize', onResize);
    addEventListener('load', onResize);
    addEventListener('mousemove', (e) => {
      const r = cv.getBoundingClientRect();
      tmx = (e.clientX - r.left) / r.width;
      tmy = 1 - (e.clientY - r.top) / r.height;
    });
    new IntersectionObserver((es) => es.forEach((en) => {
      inView = en.isIntersecting;
      if (!motionEnabled) return;
      if (inView) startAnim(); else stopAnim();
    }), { threshold: 0 }).observe(cv);
    FX.register({
      enable: () => { if (inView) startAnim(); else drawStatic(); },
      disable: () => { stopAnim(); drawStatic(); },
    });
  })();

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
        const map = { home: 'hero', terminal: 'explore', explore: 'explore', about: 'about', skills: 'skills', experience: 'experience', exp: 'experience', projects: 'projects', work: 'projects', research: 'research', beyond: 'beyond', contact: 'contact' };
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
      { ico: '🧠', label: 'Skills', sub: 'tech arsenal', run: go('skills') },
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

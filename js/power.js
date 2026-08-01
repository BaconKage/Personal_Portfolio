/* ═══════════════════════════════════════════════════════
   POWER — sleep, restart, shut down
   ───────────────────────────────────────────────────────
   The desktop metaphor taken to its conclusion: if the top
   of the page is a machine, it should be possible to turn
   it off. Three states, reachable from the menu bar, and a
   shut-down button at the foot of the document for anyone
   who reads all the way to the end.

   · Sleep     drifting colour until you touch something.
   · Restart   a real reload, with the boot flag cleared so
               the intro plays rather than being skipped as
               a returning visitor.
   · Shut down a CRT collapse, then the machine comes back
               up at the start screen — no reload, so the
               whole intro runs again from PRESS START.

   Shutting down leans on SystemBoot.replay() in main.js.
   The boot element is stowed rather than removed precisely
   so there is something to come back to.
   ═══════════════════════════════════════════════════════ */

(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const de = document.documentElement;

  const btn = $('#powerBtn');
  const menu = $('#powerMenu');
  const off = $('#pwrOff');
  const sleepEl = $('#pwrSleep');
  const endBtn = $('#endShutdown');
  if (!off || !sleepEl) return;

  const motionOn = () => !window.__fxOn || window.__fxOn();
  // the CRT collapse is 900ms of keyframes; with effects off there is nothing
  // to watch, so cut straight to the start screen
  const OFF_MS = 900;

  /* ── menu ── */
  let open = false;
  const setOpen = (v) => {
    if (!btn || !menu) return;
    open = v;
    menu.hidden = !v;
    btn.setAttribute('aria-expanded', String(v));
    if (v) menu.querySelector('.os-power-item')?.focus();
  };

  const onDocClick = (e) => {
    if (!open) return;
    if (menu.contains(e.target) || btn.contains(e.target)) return;
    setOpen(false);
  };

  /* ── sleep ── */
  let asleep = false;
  const wake = () => {
    if (!asleep) return;
    asleep = false;
    sleepEl.classList.remove('on');
    document.body.style.overflow = '';
    const done = () => { if (!asleep) sleepEl.hidden = true; };
    motionOn() ? setTimeout(done, 560) : done();
  };
  const sleep = () => {
    if (asleep) return;
    setOpen(false);
    asleep = true;
    sleepEl.hidden = false;
    document.body.style.overflow = 'hidden';
    /* Flush layout so the transition has a start value to run from, rather
       than waiting a frame for it. Deferring to rAF meant that if no frame
       arrived the overlay stayed at opacity 0 while already unhidden — an
       invisible sheet over the whole page, swallowing clicks. */
    void sleepEl.offsetHeight;
    sleepEl.classList.add('on');
  };

  /* ── restart ──
     Clearing the flag matters: main.js skips the whole intro for anyone it
     thinks has already seen it this session, so a plain reload would drop
     you straight onto the site. A restart should boot. */
  const restart = () => {
    setOpen(false);
    try { sessionStorage.removeItem('booted'); } catch (e) {}
    location.reload();
  };

  /* ── shut down ── */
  let goingDown = false;
  const shutdown = () => {
    if (goingDown) return;
    goingDown = true;
    setOpen(false);
    wake();

    const land = () => {
      window.SystemBoot?.replay();
      // one frame at the start screen before the black lifts, so the machine
      // is never caught mid-rebuild
      requestAnimationFrame(() => {
        off.classList.remove('on');
        goingDown = false;
      });
    };

    if (!motionOn()) { land(); return; }
    off.classList.add('on');
    setTimeout(land, OFF_MS);
  };

  /* ── wiring ── */
  btn?.addEventListener('click', (e) => { e.stopPropagation(); setOpen(!open); });
  menu?.addEventListener('click', (e) => {
    const item = e.target.closest('[data-power]');
    if (!item) return;
    ({ sleep, restart, shutdown })[item.dataset.power]?.();
  });
  document.addEventListener('click', onDocClick);

  endBtn?.addEventListener('click', shutdown);

  sleepEl.addEventListener('click', wake);
  sleepEl.addEventListener('pointerdown', wake);

  window.addEventListener('keydown', (e) => {
    if (asleep) { e.preventDefault(); wake(); return; }
    if (!open) return;
    const k = e.key.toLowerCase();
    if (e.key === 'Escape') { setOpen(false); btn?.focus(); return; }
    if (k === 'z') { e.preventDefault(); sleep(); }
    else if (k === 'r') { e.preventDefault(); restart(); }
    else if (k === 'q') { e.preventDefault(); shutdown(); }
  });

  // nothing to power down while the machine is still booting
  const syncAvailability = () => {
    const booted = de.classList.contains('booted');
    if (!booted && open) setOpen(false);
  };
  new MutationObserver(syncAvailability)
    .observe(de, { attributes: true, attributeFilter: ['class'] });
})();

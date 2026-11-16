/* HD on the Arsenal system: motion layer. Eases, durations and the scramble/header/menu logic are lifted from the
   Anduril clean-room rebuild (rebuild/js/site.js, values from TEARDOWN.md Module 6). Every module is guarded so a
   page without that surface skips it. */
(() => {
  const D = document, H = D.documentElement;
  H.classList.remove('no-js');
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMob = () => innerWidth < 769;
  const $ = (s, r = D) => r.querySelector(s), $$ = (s, r = D) => [...r.querySelectorAll(s)];

  const E = {
    easeOutExpo: t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
    easeOutCubic: t => 1 - Math.pow(1 - t, 3),
    easeOutQuart: t => 1 - Math.pow(1 - t, 4),
    easeInOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
    easeOutSine: t => Math.sin(t * Math.PI / 2),
    easeInSine: t => 1 - Math.cos(t * Math.PI / 2),
  };
  /* tween(from,to,ms,ease,delay,onUpdate); returns {promise, stop} so a newer tween on the same property can cancel */
  function tween(from, to, ms, ease, delay, onUpdate) {
    let stopped = false;
    const p = new Promise(res => {
      if (RM) { onUpdate(to); return res(); }
      const f = E[ease]; let t0 = null;
      const step = now => {
        if (stopped) return res();
        if (t0 === null) t0 = now + (delay || 0);
        const k = Math.min(1, Math.max(0, (now - t0) / ms));
        onUpdate(from + (to - from) * f(k));
        k < 1 ? requestAnimationFrame(step) : res();
      };
      requestAnimationFrame(step);
    });
    p.stop = () => { stopped = true; };
    return p;
  }
  const own = (el, key, t) => { if (el[key]) el[key].stop(); el[key] = t; return t; };
  const slideIn = (el, ms = 1000, delay = 0) => el && tween(0, 1, ms, 'easeOutExpo', delay, v => {
    el.style.opacity = v; el.style.transform = `translate3d(${-10 * (1 - v)}%,0,0)`;
  }).then(() => { el.style.transform = ''; });
  const drawRule = (el, ms) => el && tween(0, 1, ms, 'easeOutExpo', 0, v => el.style.transform = `scaleX(${v})`);
  const fade = (el, ms, ease = 'easeOutExpo', delay = 0, from = 0, to = 1) => tween(from, to, ms, ease, delay, v => el.style.opacity = v);

  function inView(el, cb, threshold = 0.05) {
    if (!el) return;
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { cb(); io.disconnect(); } }, { threshold });
    io.observe(el);
  }

  /* letter scramble at 20 fps, easeInOutSine; Icelandic letters keep their case, digits scramble with digits */
  const AZ = 'ABCDEFGHIJKLMNOPRSTUVÞÆÖÁÐÉÍÓÚÝ', KEEP = [' ', '/', '?', ',', '.', '+', '–', '-', ':', '&', '(', ')'];
  function scramble(el, ms = 500) {
    if (!el) return;
    const clean = el.dataset.clean || (el.dataset.clean = el.textContent);
    if (RM) { el.textContent = clean; return; }
    if (!el.getAttribute('aria-label') && el.dataset.aria !== 'off') el.setAttribute('aria-label', clean);
    const id = (el._sid = (el._sid || 0) + 1);
    let last = -1, t0 = performance.now(), tick = 0;
    const run = now => {
      if (id !== el._sid) return;
      if (now - tick >= 50) {
        tick = now;
        const p = Math.min(1, (now - t0) / ms), from = Math.round(E.easeInOutSine(p) * clean.length);
        if (from !== last) {
          last = from;
          el.textContent = clean.split('').map((c, i) => {
            if (i < from || KEEP.includes(c)) return c;
            const pool = /\d/.test(c) ? '0123456789' : AZ;
            const r = pool.charAt(Math.floor(Math.random() * pool.length));
            return c === c.toLowerCase() ? r.toLowerCase() : r;
          }).join('');
        }
        if (p >= 1) { el.textContent = clean; return; }
      }
      requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
  }

  /* Lenis: lerp false, duration .8, easeOutQuart, native touch, doubled clock */
  let lenis = null;
  if (!RM && matchMedia('(pointer: fine)').matches && window.Lenis) {
    lenis = new Lenis({ lerp: false, duration: 0.8, easing: E.easeOutQuart, syncTouch: false, autoResize: false });
    addEventListener('resize', () => lenis.resize());
    new ResizeObserver(() => lenis.resize()).observe(D.body);
    const raf = t => { lenis.raf(2 * t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
  const scrollY_ = () => lenis ? lenis.animatedScroll : scrollY;

  /* header: hides at half speed going down (desktop), returns at full speed; frosted after 30px */
  const hdr = $('#hdr'), wrap = $('#hdrWrap'), mhdr = $('#mhdr'), mbar = $('#mbar');
  let hidden = 0, last = 0, menuOpen = false, barH = { d: 71, m: 72 };
  const measure = () => { if (wrap) barH.d = $('.topnav', wrap).offsetHeight || 71; if (mbar) barH.m = mbar.offsetHeight || 72; };
  addEventListener('resize', measure); addEventListener('load', measure); measure();
  function headerTick() { // no layout reads per frame: bar heights are cached on load/resize
    const bar = isMob() ? mbar : wrap, host = isMob() ? mhdr : hdr;
    const h = isMob() ? barH.m : barH.d, y = Math.max(0, scrollY_());
    if (y !== last && !menuOpen) {
      let d = y - last; if (d > 0 && !isMob()) d /= 2;
      hidden = Math.min(1, Math.max(0, hidden + d / h));
      if (y < 10) hidden = 0;
    }
    if (menuOpen || H.dataset.kbd === '1') hidden = 0;
    last = y;
    bar.style.transform = `translate3d(0,${-h * hidden}px,0)`;
    host.style.setProperty('--frosted', (y > 30 || menuOpen) ? 1 : 0);
    requestAnimationFrame(headerTick);
  }
  if (wrap && mbar) requestAnimationFrame(headerTick);
  addEventListener('keydown', e => { if (e.key === 'Tab') H.dataset.kbd = '1'; });
  addEventListener('pointerdown', () => { H.dataset.kbd = '0'; });

  /* desktop mega menu: hover opens (no focus move); click/Enter toggles; keyboard open focuses first link */
  const mega = $('#mega'), overlay = $('#navOverlay'), center = $('#navCenter');
  const triggers = $$('.hdr [data-domain]');
  let current = null, closeT = null;
  function openPanel(name, viaKey) {
    clearTimeout(closeT);
    const panel = mega.querySelector(`[data-panel="${name}"]`); if (!panel) return;
    if (current !== name) {
      $$('.mega-panel', mega).forEach(p => { if (p !== panel) { p.style.opacity = 0; p.classList.remove('on'); } });
      panel.classList.add('on');
      const h0 = mega.offsetHeight, h1 = panel.offsetHeight;
      own(mega, '_th', tween(h0, h1, 500, 'easeOutCubic', 0, v => mega.style.height = v + 'px'));
      own(panel, '_tf', fade(panel, 500, 'easeOutCubic', current ? 0 : 100));
      if (!current) { overlay.style.display = 'block'; own(overlay, '_tf', fade(overlay, 600, 'easeOutCubic')); }
      hdr.classList.add('is-open'); center.classList.add('dim');
      triggers.forEach(t => { const on = t.dataset.domain === name; t.classList.toggle('on', on); t.setAttribute('aria-expanded', on); });
      current = name; menuOpen = true;
      if (lenis) lenis.stop();
    }
    if (viaKey) { const a = panel.querySelector('a'); a && a.focus({ preventScroll: true }); }
  }
  function closePanel(returnFocus) {
    if (!current) return;
    const panel = mega.querySelector(`[data-panel="${current}"]`), trig = triggers.find(t => t.dataset.domain === current);
    own(mega, '_th', tween(mega.offsetHeight, 0, 500, 'easeOutCubic', 0, v => mega.style.height = v + 'px'));
    own(panel, '_tf', fade(panel, 300, 'easeOutCubic', 0, 1, 0)).then(() => { if (current !== panel.dataset.panel) panel.classList.remove('on'); });
    own(overlay, '_tf', fade(overlay, 300, 'easeOutCubic', 0, .5, 0)).then(() => { if (!current) overlay.style.display = 'none'; });
    hdr.classList.remove('is-open'); center.classList.remove('dim');
    triggers.forEach(t => { t.classList.remove('on'); t.setAttribute('aria-expanded', 'false'); });
    current = null; menuOpen = false;
    if (lenis) lenis.start();
    if (returnFocus && trig) trig.focus({ preventScroll: true });
  }
  if (mega) {
    triggers.forEach(t => {
      t.addEventListener('mouseenter', () => { if (matchMedia('(hover: hover)').matches) openPanel(t.dataset.domain, false); });
      t.addEventListener('click', e => current === t.dataset.domain && e.detail !== 0 ? null : (current === t.dataset.domain ? closePanel() : openPanel(t.dataset.domain, e.detail === 0)));
    });
    wrap.addEventListener('mouseleave', () => { closeT = setTimeout(() => closePanel(false), 120); });
    wrap.addEventListener('mouseenter', () => clearTimeout(closeT));
    overlay.addEventListener('click', () => closePanel(false));
    addEventListener('keydown', e => { if (e.key === 'Escape' && current) closePanel(true); });
    wrap.addEventListener('focusout', e => { if (current && !wrap.contains(e.relatedTarget)) closePanel(false); });
  }

  /* mobile menu: open = slide x 100%->0 .3s ease-out; container focus on tap, first link on keyboard; close slides out */
  const burger = $('#burger'), mmenu = $('#mmenu');
  function setMobile(open, viaKey) {
    mhdr.classList.toggle('open', open); burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? 'Loka valmynd' : 'Opna valmynd');
    menuOpen = open; D.body.style.overflow = open ? 'hidden' : '';
    if (lenis) open ? lenis.stop() : lenis.start();
    if (open) {
      mhdr.classList.remove('closing');
      (viaKey ? mmenu.querySelector('a') : mmenu).focus({ preventScroll: true });
      scramble($('.contact .t-label', mmenu), 600);
    } else if (!RM) {
      mhdr.classList.add('closing'); setTimeout(() => mhdr.classList.remove('closing'), 300);
    }
  }
  if (burger) {
    burger.addEventListener('click', e => setMobile(!mhdr.classList.contains('open'), e.detail === 0));
    addEventListener('keydown', e => { if (e.key === 'Escape' && mhdr.classList.contains('open')) { setMobile(false); burger.focus(); } });
    $$('a', mmenu).forEach(a => a.addEventListener('click', () => setMobile(false)));
  }

  /* preloader (first visit of the session only), then hero: media fade 1000 easeOutExpo, title lines y 100%->0 stagger 100 */
  const loader = $('#loader');
  function heroIn() {
    const m = $('.hero .media, .imedia');
    if (m) fade(m, 1000);
    $$('.line>span').forEach((s, i) => { s.style.transform = 'translate3d(0,105%,0)'; tween(105, 0, 1000, 'easeOutExpo', 150 + 100 * i, v => s.style.transform = `translate3d(0,${v}%,0)`); });
    $$('[data-scr-load]').forEach(el => { fade(el, 500, 'easeOutExpo', 0, 0, .6); scramble(el, 500); });
  }
  let first = false; try { first = !sessionStorage.getItem('hd-seen'); sessionStorage.setItem('hd-seen', '1'); } catch (e) { first = true; }
  const boot = async () => {
    window.__pbar && window.__pbar.done();
    if (loader) { if (first && !RM) { await fade(loader, 300, 'easeOutCubic', 0, 1, 0); } loader.remove(); }
    heroIn();
  };
  if (!first && loader) { loader.remove(); window.__pbar && window.__pbar.done(); }
  D.readyState === 'complete' || !first ? (first ? boot() : heroIn()) : addEventListener('load', boot, { once: true });
  if (first && D.readyState !== 'complete') setTimeout(() => { if (D.getElementById('loader')) boot(); }, 2500);

  /* cards: fade 1000 in view; desktop hover opens descriptor (500 easeOutCubic) + scramble 750; phones open on first view */
  function cardFx(card) {
    const desc = $('.desc', card), ico = $('.ico', card);
    let open = false;
    const rem = () => parseFloat(getComputedStyle(H).fontSize);
    const animIn = () => {
      if (!desc || open) return; open = true;
      const target = isMob() ? desc.scrollHeight || 1.5 * rem() : 1.25 * rem();
      desc.style.whiteSpace = isMob() ? 'normal' : 'nowrap';
      own(desc, '_t', tween(0, 1, 500, 'easeOutCubic', 0, v => { desc.style.height = (isMob() ? 'auto' : v * target + 'px'); desc.style.marginTop = v * .5 * rem() + 'px'; desc.style.opacity = v; if (ico) ico.style.opacity = v; }));
      scramble(desc, 750);
    };
    const animOut = () => {
      if (isMob() || !open || !desc) return; open = false;
      const h0 = desc.offsetHeight;
      own(desc, '_t', tween(1, 0, 500, 'easeOutCubic', 0, v => { desc.style.height = v * h0 + 'px'; desc.style.marginTop = v * .5 * rem() + 'px'; desc.style.opacity = v; if (ico) ico.style.opacity = v; }));
    };
    card.addEventListener('mouseenter', () => { if (!isMob()) animIn(); });
    card.addEventListener('mouseleave', animOut);
    card.addEventListener('focus', animIn); card.addEventListener('blur', animOut);
    inView(card, () => { fade(card, 1000); if (isMob() || !matchMedia('(hover: hover)').matches) animIn(); });
  }
  $$('.card, .feat').forEach(cardFx);

  /* index rows: slide in from x -10%; hover opens the CTA (500 easeOutExpo) */
  $$('.arow').forEach(row => {
    const cta = $('.cta', row), inner = $('.ctaw', row);
    inView(row, () => slideIn(row, 1000));
    if (!cta) return;
    row.addEventListener('mouseenter', () => { if (!isMob()) own(cta, '_t', tween(cta.offsetHeight, inner.offsetHeight, 500, 'easeOutExpo', 0, v => cta.style.height = v + 'px')); });
    row.addEventListener('mouseleave', () => { if (!isMob()) own(cta, '_t', tween(cta.offsetHeight, 0, 500, 'easeOutExpo', 0, v => cta.style.height = v + 'px')); });
  });

  /* stat rows: slide in, number scrambles 500 (digits pool) */
  $$('.srow').forEach((r, i) => inView(r, () => { slideIn(r, 1000, 0); scramble($('.n .v', r), 500); }));
  $$('.orow, .nrow, .cert').forEach(r => inView(r, () => slideIn(r, 1000)));
  $$('.spec').forEach(s => inView(s, () => slideIn(s, 1000)));
  $$('.rv').forEach(s => inView(s, () => slideIn(s, 1000)));
  $$('.rule-in').forEach(r => inView(r, () => drawRule(r, 1500)));
  $$('[data-scr]').forEach(el => inView(el, () => scramble(el, +el.dataset.scr || 500)));

  /* news: rule draws 2000ms, columns slide in 200 + 100i */
  $$('.news').forEach(news => inView(news, () => {
    drawRule($('.rule', news), 2000);
    [$('.art .l', news), $('.art .img', news)].forEach((el, i) => slideIn(el, 1000, 200 + 100 * i));
  }));

  /* media link pair: rule 1500, top/label/image slide 100i */
  $$('.mcard').forEach(c => inView(c, () => {
    drawRule($('.rule', c), 1500);
    [$('.tw', c), $('.lab', c), $('.bw img', c)].forEach((el, i) => slideIn(el, 1000, 100 * i));
  }));

  /* link buttons: underline draws 300ms after entering view, replays on hover */
  $$('.lbtn .u').forEach(u => {
    inView(u, () => setTimeout(() => u.classList.add('play'), 300));
    u.closest('.lbtn').addEventListener('mouseenter', () => {
      if (!u.classList.contains('play')) return;
      u.classList.remove('replay'); void u.offsetWidth; u.classList.add('replay');
    });
  });

  /* footer accordions (phone) + contact title scramble 400 */
  $$('.foot .col .tw').forEach(b => b.addEventListener('click', () => {
    if (!isMob()) return;
    const col = b.parentElement, lw = $('.lw', col);
    col.style.setProperty('--lh', lw.scrollHeight + 16 + 'px');
    const o = col.classList.toggle('open'); b.setAttribute('aria-expanded', o);
  }));
  const fct = $('.foot .contact .t'); inView(fct, () => scramble(fct, 400));

  /* consent: nothing measures before a choice; refuse is as easy as accept; choice can be reopened from the footer */
  const ck = $('#cookie');
  const KEY = 'hd-consent';
  const get = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const set = v => { try { localStorage.setItem(KEY, v); } catch (e) {} };
  function analytics() { /* Prototype: HD's own measurement tag would load here, and only here, after "Samþykkja". No request is made in this preview. */ H.dataset.analytics = 'on'; }
  function showCk() { if (!ck) return; ck.hidden = false; requestAnimationFrame(() => ck.classList.add('visible')); }
  function hideCk() { ck.classList.remove('visible'); setTimeout(() => { ck.hidden = true; }, 300); }
  if (ck) {
    if (!get()) setTimeout(showCk, 600); else if (get() === 'granted') analytics();
    $('.no', ck).addEventListener('click', () => { set('denied'); H.dataset.analytics = 'off'; hideCk(); });
    $('.yes', ck).addEventListener('click', () => { set('granted'); analytics(); hideCk(); });
    $$('[data-cookie-open]').forEach(b => b.addEventListener('click', showCk));
  }

  /* page transition: black veil 350 easeOutSine + page scale 1.02, navigate; arrival: veil out 350 easeInSine from .98 */
  const veil = $('#veil'), main = $('main');
  try {
    if (veil && sessionStorage.getItem('hd-veil') === '1') {
      sessionStorage.removeItem('hd-veil');
      veil.style.opacity = 1; main.style.transform = 'scale(.98)';
      tween(.98, 1, 350, 'easeInSine', 0, v => main.style.transform = `scale(${v})`).then(() => main.style.transform = '');
      tween(1, 0, 350, 'easeInSine', 0, v => veil.style.opacity = v);
    }
  } catch (e) {}
  addEventListener('pageshow', e => { if (e.persisted && veil) { veil.style.opacity = 0; main.style.transform = ''; } });
  if (veil && !RM) D.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank' || a.hasAttribute('download')) return;
    const u = new URL(a.href, location.href);
    if (u.origin !== location.origin || u.protocol.indexOf('http') !== 0 || (u.pathname === location.pathname && u.hash)) return;
    e.preventDefault();
    const y = scrollY + innerHeight / 2;
    main.style.transformOrigin = `50vw ${y}px`;
    tween(1, 1.02, 350, 'easeOutSine', 0, v => main.style.transform = `scale(${v})`);
    tween(0, 1, 350, 'easeOutSine', 0, v => veil.style.opacity = v).then(() => {
      try { sessionStorage.setItem('hd-veil', '1'); } catch (err) {}
      location.href = u.href;
    });
  });
})();

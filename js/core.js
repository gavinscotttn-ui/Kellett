/* ============================================================
   Kellett Holdings — core helpers.

   Everything hangs off one global, KH, so the classic <script>
   tags stay order-dependent in exactly one obvious way and the
   whole thing still runs straight off the filesystem.
   ============================================================ */

window.KH = window.KH || {};

(function (KH) {
  'use strict';

  /* ---------- DOM ----------------------------------------------------
     h() is the only way anything in this app builds an element. Text is
     always set through textContent, never parsed as markup, so a name
     typed into Settings is a name and can never become script. There is
     deliberately no innerHTML helper to reach for.
     ------------------------------------------------------------------ */

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function h(tag, props, children) {
    var el = document.createElement(tag);
    applyProps(el, props);
    append(el, children);
    return el;
  }

  /* Paint properties that a chart may want to feed from a CSS custom
     property. A var() reference is NOT resolved inside an SVG
     presentation attribute, so those values are routed to the inline
     style declaration, where it is resolved correctly. */
  var PAINT_PROPS = { fill: 1, stroke: 1, color: 1, 'stop-color': 1, 'stop-opacity': 1, 'flood-color': 1 };

  function svg(tag, props, children) {
    var el = document.createElementNS(SVG_NS, tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v === null || v === undefined || v === false) return;
        var s = String(v);
        if (PAINT_PROPS[k] && s.indexOf('var(') !== -1) { el.style.setProperty(k, s); return; }
        el.setAttribute(k, s);
      });
    }
    append(el, children);
    return el;
  }

  function applyProps(el, props) {
    if (!props) return;
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') { el.className = v; return; }
      if (k === 'text') { el.textContent = String(v); return; }
      if (k === 'html') { throw new Error('h(): raw markup is not supported'); }
      if (k === 'style' && typeof v === 'object') { Object.assign(el.style, v); return; }
      if (k === 'dataset') { Object.assign(el.dataset, v); return; }
      if (k.slice(0, 2) === 'on' && typeof v === 'function') { el.addEventListener(k.slice(2), v); return; }
      if (v === true) { el.setAttribute(k, ''); return; }
      el.setAttribute(k, String(v));
    });
  }

  function append(el, children) {
    if (children === null || children === undefined || children === false) return;
    if (Array.isArray(children)) { children.forEach(function (c) { append(el, c); }); return; }
    if (children instanceof Node) { el.appendChild(children); return; }
    el.appendChild(document.createTextNode(String(children)));
  }

  function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }

  function fill(el, children) { clear(el); append(el, children); return el; }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /** An <svg><use> reference into the sprite defined once in index.html. */
  function icon(name, cls) {
    var s = svg('svg', { class: cls || '', 'aria-hidden': 'true', focusable: 'false' });
    var u = document.createElementNS(SVG_NS, 'use');
    u.setAttribute('href', '#i-' + name);
    s.appendChild(u);
    return s;
  }

  /* ---------- Numbers ------------------------------------------------ */

  /** Deterministic PRNG, so the same seed always builds the same book. */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Box–Muller, for price walks that look like prices and not sawtooth. */
  function gauss(rand) {
    var u = 0, v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function clamp(n, lo, hi) { return n < lo ? lo : n > hi ? hi : n; }

  function sum(list, pick) {
    return list.reduce(function (t, x) { return t + (pick ? pick(x) : x); }, 0);
  }

  /* ---------- Events -------------------------------------------------- */

  var listeners = {};

  function on(name, fn) {
    (listeners[name] = listeners[name] || []).push(fn);
    return function off() {
      listeners[name] = listeners[name].filter(function (f) { return f !== fn; });
    };
  }

  function emit(name, payload) {
    (listeners[name] || []).forEach(function (fn) {
      try { fn(payload); } catch (err) { console.error('handler for "' + name + '" failed', err); }
    });
  }

  /* ---------- Timing -------------------------------------------------- */

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  /** Observe an element's box, so charts redraw when their panel resizes. */
  function onResize(el, fn) {
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', debounce(fn, 120));
      return function () {};
    }
    var ro = new ResizeObserver(debounce(fn, 60));
    ro.observe(el);
    return function () { ro.disconnect(); };
  }

  KH.dom = { h: h, svg: svg, clear: clear, fill: fill, $: $, $$: $$, icon: icon, append: append, onResize: onResize };
  KH.util = { rng: rng, gauss: gauss, clamp: clamp, sum: sum, debounce: debounce };
  KH.bus = { on: on, emit: emit };
})(window.KH);

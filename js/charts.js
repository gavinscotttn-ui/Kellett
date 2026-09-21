/* ============================================================
   Charts.

   Hand-rolled inline SVG — nothing is fetched, nothing is bundled,
   and every mark is drawn against the same rules: thin marks, a
   recessive grid, tabular figures, a legend whenever more than one
   series is on screen, and a hover layer on anything with a plot.

   Series colours come from the --s1..--s8 tokens in fixed order and
   are never cycled or generated; the ninth category folds into
   "Other". Direction is always carried by a glyph and a sign as
   well as by colour.
   ============================================================ */

(function (KH) {
  'use strict';

  var svg = KH.dom.svg, h = KH.dom.h, clear = KH.dom.clear;

  var SERIES_SLOTS = ['--s1', '--s2', '--s3', '--s4', '--s5', '--s6', '--s7', '--s8'];

  function seriesColor(i) { return 'var(' + SERIES_SLOTS[i % SERIES_SLOTS.length] + ')'; }

  function normalise(points) {
    return points.map(function (p, i) {
      if (typeof p === 'number') return { t: i, v: p };
      return { t: p.t === undefined ? i : p.t, v: p.v };
    });
  }

  function extent(seriesList) {
    var lo = Infinity, hi = -Infinity;
    seriesList.forEach(function (s) {
      s.pts.forEach(function (p) {
        if (p.v < lo) lo = p.v;
        if (p.v > hi) hi = p.v;
      });
    });
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    if (lo === hi) { lo -= 1; hi += 1; }
    return [lo, hi];
  }

  function niceTicks(lo, hi, count) {
    var span = hi - lo;
    var step = Math.pow(10, Math.floor(Math.log10(span / count)));
    var err = (span / count) / step;
    if (err >= 7.5) step *= 10; else if (err >= 3.5) step *= 5; else if (err >= 1.5) step *= 2;
    var out = [], v = Math.ceil(lo / step) * step;
    for (; v <= hi + step * 0.001; v += step) out.push(Number(v.toFixed(10)));
    return out;
  }

  function box(el) {
    var r = el.getBoundingClientRect();
    return { w: Math.max(80, Math.round(r.width)), h: Math.max(40, Math.round(r.height)) };
  }

  /** Every chart lives in a .chart container that owns its own tooltip. */
  function mount(el) {
    el.classList.add('chart');
    var tip = el.querySelector('.chart-tip');
    if (!tip) {
      tip = h('div', { class: 'chart-tip', hidden: true, role: 'status', 'aria-live': 'off' });
      el.appendChild(tip);
    }
    // Anything that is not the tooltip is a previous render — an SVG, or
    // the placeholder shown while there was nothing to plot.
    Array.prototype.slice.call(el.childNodes).forEach(function (n) {
      if (n !== tip) el.removeChild(n);
    });
    return tip;
  }

  function showTip(tip, x, y, rows) {
    clear(tip);
    rows.forEach(function (r) {
      if (r.heading) { tip.appendChild(h('div', { class: 'tip-k', text: r.heading })); return; }
      tip.appendChild(h('div', { class: 'tip-row' }, [
        r.color ? h('span', { class: 'swatch', style: { background: r.color } }) : null,
        h('span', { class: 'tip-v', text: r.value }),
        r.label ? h('span', { style: { color: 'var(--text-secondary)' }, text: r.label }) : null
      ]));
    });
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
    tip.hidden = false;
  }

  /* ============================================================
     Time series — line, or line with a filled area beneath.
     ============================================================ */

  function timeSeries(el, opts) {
    var tip = mount(el);
    var dim = box(el);
    var W = dim.w, H = opts.height || dim.h;
    var padL = opts.padL === undefined ? 54 : opts.padL;
    var padR = 10, padT = 10, padB = opts.xLabels === false ? 8 : 22;

    var list = (opts.series || []).map(function (s, i) {
      return { name: s.name, color: s.color || seriesColor(i), pts: normalise(s.points || []) };
    }).filter(function (s) { return s.pts.length > 1; });

    if (!list.length) { el.appendChild(h('div', { class: 'empty', text: 'No data for this period' })); return; }

    var ex = extent(list);
    var lo = ex[0], hi = ex[1];
    var pad = (hi - lo) * 0.12;
    lo = opts.zeroBase ? Math.min(0, lo) : lo - pad;
    hi = hi + pad;

    var n = list[0].pts.length;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var xAt = function (i) { return padL + (plotW * i) / (n - 1); };
    var yAt = function (v) { return padT + plotH - ((v - lo) / (hi - lo)) * plotH; };

    var root = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img',
      'aria-label': opts.ariaLabel || (list.length + ' series') });

    var defs = svg('defs');
    root.appendChild(defs);

    // Grid — recessive, horizontal only.
    var ticks = niceTicks(lo, hi, opts.yTicks || 4);
    ticks.forEach(function (t) {
      var y = yAt(t);
      root.appendChild(svg('line', { class: 'grid-line', x1: padL, x2: W - padR, y1: y, y2: y }));
      if (opts.yLabels !== false) {
        root.appendChild(svg('text', { class: 'tick', x: padL - 7, y: y + 3.5, 'text-anchor': 'end' },
          (opts.yFormat || String)(t)));
      }
    });

    // Series
    list.forEach(function (s, si) {
      var d = '', dArea = '';
      s.pts.forEach(function (p, i) {
        var x = xAt(i), y = yAt(p.v);
        d += (i ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2) + ' ';
      });
      if (opts.area && list.length === 1) {
        var gid = 'g' + Math.random().toString(36).slice(2, 9);
        var grad = svg('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, [
          svg('stop', { offset: '0%', 'stop-color': s.color, 'stop-opacity': '0.34' }),
          svg('stop', { offset: '100%', 'stop-color': s.color, 'stop-opacity': '0.02' })
        ]);
        defs.appendChild(grad);
        dArea = d + 'L' + xAt(n - 1).toFixed(2) + ' ' + (padT + plotH) + ' L' + xAt(0).toFixed(2) + ' ' + (padT + plotH) + ' Z';
        root.appendChild(svg('path', { class: 'series-area', d: dArea, fill: 'url(#' + gid + ')' }));
      }
      root.appendChild(svg('path', { class: 'series-line', d: d, stroke: s.color }));
      s._x = xAt; s._y = yAt; s._si = si;
    });

    // Baseline
    root.appendChild(svg('line', { class: 'axis-line', x1: padL, x2: W - padR, y1: padT + plotH, y2: padT + plotH }));

    // X labels — first, middle and last only; never one per point.
    if (opts.xLabels !== false && opts.xFormat) {
      [0, Math.floor((n - 1) / 2), n - 1].forEach(function (i, k) {
        root.appendChild(svg('text', {
          class: 'tick', x: xAt(i), y: H - 6,
          'text-anchor': k === 0 ? 'start' : k === 2 ? 'end' : 'middle'
        }, opts.xFormat(list[0].pts[i].t, i)));
      });
    }

    // Hover layer: crosshair, markers and a tooltip.
    var cross = svg('line', { class: 'crosshair', y1: padT, y2: padT + plotH, x1: -20, x2: -20, opacity: 0 });
    root.appendChild(cross);
    var dots = list.map(function (s) {
      var c = svg('circle', { class: 'marker', r: 4.5, fill: s.color, cx: -20, cy: -20, opacity: 0 });
      root.appendChild(c);
      return c;
    });

    var hit = svg('rect', { x: padL, y: padT, width: Math.max(1, plotW), height: Math.max(1, plotH), fill: 'transparent', style: 'cursor:crosshair' });
    root.appendChild(hit);

    function hover(ev) {
      var r = root.getBoundingClientRect();
      var rel = ((ev.clientX - r.left) / (r.width || 1)) * W;
      var i = Math.round(((rel - padL) / plotW) * (n - 1));
      i = KH.util.clamp(i, 0, n - 1);
      var x = xAt(i);
      cross.setAttribute('x1', x); cross.setAttribute('x2', x); cross.setAttribute('opacity', 1);
      var rows = [{ heading: (opts.xFormat ? opts.xFormat(list[0].pts[i].t, i) : '#' + i) }];
      list.forEach(function (s, k) {
        var p = s.pts[Math.min(i, s.pts.length - 1)];
        dots[k].setAttribute('cx', x);
        dots[k].setAttribute('cy', yAt(p.v));
        dots[k].setAttribute('opacity', 1);
        rows.push({ color: s.color, value: (opts.tipFormat || opts.yFormat || String)(p.v), label: list.length > 1 ? s.name : '' });
      });
      showTip(tip, (x / W) * (r.width || W), yAt(list[0].pts[i].v) / H * (r.height || H), rows);
    }

    function leave() {
      cross.setAttribute('opacity', 0);
      dots.forEach(function (d) { d.setAttribute('opacity', 0); });
      tip.hidden = true;
    }

    hit.addEventListener('pointermove', hover);
    hit.addEventListener('pointerleave', leave);

    el.insertBefore(root, tip);
    return root;
  }

  /* ============================================================
     Sparkline — a mark, not a chart: no axes, no hover, no labels.
     ============================================================ */

  function spark(el, values, opts) {
    opts = opts || {};
    clear(el);
    el.classList.add('chart');
    var dim = box(el), W = dim.w, H = opts.height || dim.h;
    var pts = normalise(values);
    if (pts.length < 2) return;
    var ex = extent([{ pts: pts }]), lo = ex[0], hi = ex[1];
    var pad = (hi - lo) * 0.14 || 1;
    lo -= pad; hi += pad;
    var color = opts.color || seriesColor(0);
    var xAt = function (i) { return (W * i) / (pts.length - 1); };
    var yAt = function (v) { return H - ((v - lo) / (hi - lo)) * H; };

    var d = '', root = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, 'aria-hidden': 'true' });
    pts.forEach(function (p, i) { d += (i ? 'L' : 'M') + xAt(i).toFixed(2) + ' ' + yAt(p.v).toFixed(2) + ' '; });

    if (opts.area !== false) {
      var gid = 'sp' + Math.random().toString(36).slice(2, 9);
      root.appendChild(svg('defs', {}, svg('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, [
        svg('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': '0.34' }),
        svg('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': '0' })
      ])));
      root.appendChild(svg('path', { d: d + 'L' + xAt(pts.length - 1).toFixed(2) + ' ' + H + ' L0 ' + H + ' Z', fill: 'url(#' + gid + ')', stroke: 'none' }));
    }
    root.appendChild(svg('path', { d: d, fill: 'none', stroke: color, 'stroke-width': 1.75, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    root.appendChild(svg('circle', { cx: xAt(pts.length - 1), cy: yAt(pts[pts.length - 1].v), r: 2.4, fill: color }));
    el.appendChild(root);
  }

  /* ============================================================
     Ranked horizontal bars — magnitude, with the value beside the
     bar so the reading never depends on the colour or the axis.
     ============================================================ */

  function barsH(el, items, opts) {
    opts = opts || {};
    var tip = mount(el);
    var dim = box(el), W = dim.w;
    var rowH = opts.rowH || 26, gap = 2;
    var H = items.length * rowH;
    var labelW = opts.labelW || Math.min(190, Math.round(W * 0.42));
    var valueW = opts.valueW || 92;
    var trackW = Math.max(20, W - labelW - valueW - 12);
    var max = Math.max.apply(null, items.map(function (i) { return Math.abs(i.value); }).concat([1]));

    var root = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img',
      'aria-label': opts.ariaLabel || 'Ranked comparison' });

    items.forEach(function (it, i) {
      var y = i * rowH;
      var w = Math.max(3, (Math.abs(it.value) / max) * trackW);
      var color = it.color || seriesColor(i);

      root.appendChild(svg('text', { class: 'tick', x: 0, y: y + rowH / 2 + 3.5, fill: 'var(--text-secondary)' },
        it.label.length > 28 ? it.label.slice(0, 27) + '…' : it.label));

      root.appendChild(svg('rect', {
        x: labelW, y: y + gap + 2, width: trackW, height: rowH - gap * 2 - 4,
        rx: 3, fill: 'var(--grid)'
      }));
      var bar = svg('rect', {
        x: labelW, y: y + gap + 2, width: w, height: rowH - gap * 2 - 4,
        rx: 4, fill: color
      });
      bar.style.cursor = 'pointer';
      root.appendChild(bar);

      root.appendChild(svg('text', {
        class: 'tick', x: W, y: y + rowH / 2 + 3.5, 'text-anchor': 'end', fill: 'var(--text-primary)'
      }, opts.format ? opts.format(it.value) : String(it.value)));

      var hitRect = svg('rect', { x: 0, y: y, width: W, height: rowH, fill: 'transparent' });
      hitRect.addEventListener('pointermove', function (ev) {
        var r = root.getBoundingClientRect();
        showTip(tip, ev.clientX - r.left, y + 2, [
          { heading: it.label },
          { color: color, value: opts.format ? opts.format(it.value) : String(it.value), label: it.note || '' }
        ]);
      });
      hitRect.addEventListener('pointerleave', function () { tip.hidden = true; });
      root.appendChild(hitRect);
    });

    el.insertBefore(root, tip);
    el.style.height = H + 'px';
  }

  /* ============================================================
     Donut — identity plus share. Always shipped with a legend that
     carries the value, so it is never read by colour alone.
     ============================================================ */

  function donut(el, slices, opts) {
    opts = opts || {};
    var tip = mount(el);
    var dim = box(el);
    var size = Math.min(dim.w, opts.height || dim.h);
    var cx = dim.w / 2, cy = size / 2;
    var r = size / 2 - 6, inner = r * (opts.innerRatio || 0.62);
    var total = KH.util.sum(slices, function (s) { return s.value; }) || 1;

    var root = svg('svg', { viewBox: '0 0 ' + dim.w + ' ' + size, width: dim.w, height: size, role: 'img',
      'aria-label': opts.ariaLabel || 'Composition by share' });

    var angle = -Math.PI / 2;
    // A 2px surface gap between segments keeps adjacent fills apart.
    var gapRad = 0.016;

    slices.forEach(function (s, i) {
      var frac = s.value / total;
      var a0 = angle + gapRad / 2, a1 = angle + frac * Math.PI * 2 - gapRad / 2;
      angle += frac * Math.PI * 2;
      if (a1 <= a0) return;
      var color = s.color || seriesColor(i);
      var path = svg('path', { d: ring(cx, cy, r, inner, a0, a1), fill: color });
      path.style.cursor = 'pointer';
      path.addEventListener('pointermove', function (ev) {
        var b = root.getBoundingClientRect();
        showTip(tip, ev.clientX - b.left, ev.clientY - b.top, [
          { heading: s.label },
          { color: color, value: (opts.format ? opts.format(s.value) : String(s.value)), label: (frac * 100).toFixed(1) + '%' }
        ]);
      });
      path.addEventListener('pointerleave', function () { tip.hidden = true; });
      root.appendChild(path);
    });

    if (opts.centreTop || opts.centreBottom) {
      if (opts.centreTop) {
        root.appendChild(svg('text', { x: cx, y: cy - 2, 'text-anchor': 'middle',
          style: 'font-size:15px;font-weight:600;fill:var(--text-primary)' }, opts.centreTop));
      }
      if (opts.centreBottom) {
        root.appendChild(svg('text', { x: cx, y: cy + 14, 'text-anchor': 'middle',
          style: 'font-size:10px;letter-spacing:.12em;text-transform:uppercase;fill:var(--text-muted)' }, opts.centreBottom));
      }
    }

    el.insertBefore(root, tip);
  }

  function ring(cx, cy, rOuter, rInner, a0, a1) {
    var large = (a1 - a0) > Math.PI ? 1 : 0;
    var x0 = cx + rOuter * Math.cos(a0), y0 = cy + rOuter * Math.sin(a0);
    var x1 = cx + rOuter * Math.cos(a1), y1 = cy + rOuter * Math.sin(a1);
    var x2 = cx + rInner * Math.cos(a1), y2 = cy + rInner * Math.sin(a1);
    var x3 = cx + rInner * Math.cos(a0), y3 = cy + rInner * Math.sin(a0);
    return 'M' + x0 + ' ' + y0 +
      ' A' + rOuter + ' ' + rOuter + ' 0 ' + large + ' 1 ' + x1 + ' ' + y1 +
      ' L' + x2 + ' ' + y2 +
      ' A' + rInner + ' ' + rInner + ' 0 ' + large + ' 0 ' + x3 + ' ' + y3 + ' Z';
  }

  /** The legend that always accompanies a donut or a multi-series plot. */
  function legend(items, format) {
    return h('div', { class: 'legend' }, items.map(function (s, i) {
      return h('span', { class: 'item' }, [
        h('span', { class: 'swatch', style: { background: s.color || seriesColor(i) } }),
        h('span', { text: s.label || s.name }),
        format ? h('span', { class: 'val', text: format(s.value) }) : null
      ]);
    }));
  }

  /* ============================================================
     Stacked single bar — composition in a strip.
     ============================================================ */

  function stackedBar(el, slices, opts) {
    opts = opts || {};
    var tip = mount(el);
    var dim = box(el), W = dim.w, H = opts.height || 16;
    var total = KH.util.sum(slices, function (s) { return s.value; }) || 1;
    var root = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img',
      'aria-label': opts.ariaLabel || 'Composition' });
    var x = 0;
    slices.forEach(function (s, i) {
      var w = (s.value / total) * W;
      var color = s.color || seriesColor(i);
      var seg = svg('rect', { x: x + (i ? 1 : 0), y: 0, width: Math.max(1, w - (i ? 2 : 1)), height: H, rx: 3, fill: color });
      seg.style.cursor = 'pointer';
      seg.addEventListener('pointermove', function (ev) {
        var b = root.getBoundingClientRect();
        showTip(tip, ev.clientX - b.left, 0, [
          { heading: s.label },
          { color: color, value: opts.format ? opts.format(s.value) : String(s.value), label: ((s.value / total) * 100).toFixed(1) + '%' }
        ]);
      });
      seg.addEventListener('pointerleave', function () { tip.hidden = true; });
      root.appendChild(seg);
      x += w;
    });
    el.insertBefore(root, tip);
    el.style.height = H + 'px';
  }

  /* ============================================================
     Candles — open/high/low/close. Up and down are also carried by
     the body being hollow or filled, not by colour alone.
     ============================================================ */

  function candles(el, data, opts) {
    opts = opts || {};
    var tip = mount(el);
    var dim = box(el), W = dim.w, H = opts.height || dim.h;
    var padL = 54, padR = 10, padT = 10, padB = 22;
    if (!data.length) { el.appendChild(h('div', { class: 'empty', text: 'No data for this period' })); return; }

    var lo = Infinity, hi = -Infinity;
    data.forEach(function (c) { lo = Math.min(lo, c.l); hi = Math.max(hi, c.h); });
    var pad = (hi - lo) * 0.1 || 1;
    lo -= pad; hi += pad;

    var plotW = W - padL - padR, plotH = H - padT - padB;
    var step = plotW / data.length;
    var bw = Math.max(2, Math.min(11, step * 0.62));
    var yAt = function (v) { return padT + plotH - ((v - lo) / (hi - lo)) * plotH; };

    var root = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img',
      'aria-label': opts.ariaLabel || 'Open, high, low and close by session' });

    niceTicks(lo, hi, 4).forEach(function (t) {
      var y = yAt(t);
      root.appendChild(svg('line', { class: 'grid-line', x1: padL, x2: W - padR, y1: y, y2: y }));
      root.appendChild(svg('text', { class: 'tick', x: padL - 7, y: y + 3.5, 'text-anchor': 'end' }, (opts.yFormat || String)(t)));
    });

    data.forEach(function (c, i) {
      var x = padL + step * i + step / 2;
      var up = c.c >= c.o;
      var color = up ? 'var(--up)' : 'var(--down)';
      root.appendChild(svg('line', { x1: x, x2: x, y1: yAt(c.h), y2: yAt(c.l), stroke: color, 'stroke-width': 1 }));
      var top = yAt(Math.max(c.o, c.c)), bot = yAt(Math.min(c.o, c.c));
      root.appendChild(svg('rect', {
        x: x - bw / 2, y: top, width: bw, height: Math.max(1, bot - top), rx: 1,
        fill: up ? 'none' : color, stroke: color, 'stroke-width': 1.4
      }));
      var hitRect = svg('rect', { x: padL + step * i, y: padT, width: step, height: plotH, fill: 'transparent' });
      hitRect.addEventListener('pointermove', function () {
        showTip(tip, x, top, [
          { heading: opts.xFormat ? opts.xFormat(c.t, i) : 'Session ' + (i + 1) },
          { color: color, value: (opts.yFormat || String)(c.c), label: (up ? '▲' : '▼') + ' ' + (opts.yFormat || String)(c.o) + ' open' }
        ]);
      });
      hitRect.addEventListener('pointerleave', function () { tip.hidden = true; });
      root.appendChild(hitRect);
    });

    root.appendChild(svg('line', { class: 'axis-line', x1: padL, x2: W - padR, y1: padT + plotH, y2: padT + plotH }));
    if (opts.xFormat) {
      [0, Math.floor(data.length / 2), data.length - 1].forEach(function (i, k) {
        root.appendChild(svg('text', {
          class: 'tick', x: padL + step * i + step / 2, y: H - 6,
          'text-anchor': k === 0 ? 'start' : k === 2 ? 'end' : 'middle'
        }, opts.xFormat(data[i].t, i)));
      });
    }
    el.insertBefore(root, tip);
  }

  KH.charts = {
    timeSeries: timeSeries, spark: spark, barsH: barsH, donut: donut,
    stackedBar: stackedBar, candles: candles, legend: legend, seriesColor: seriesColor
  };
})(window.KH);

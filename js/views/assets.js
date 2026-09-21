/* ============================================================
   Asset register — the directly held book, its valuation
   history, and how the whole thing is spread.
   ============================================================ */

(function (KH) {
  'use strict';

  var h = KH.dom.h, icon = KH.dom.icon, fmt = KH.fmt;

  var el = {};
  var selected = null;
  var range = 36;

  function mount(root) {
    selected = selected || KH.assets.register[0].id;

    root.appendChild(h('div', { class: 'view-head' }, [
      h('div', { class: 'titles' }, [
        h('div', { class: 'eyebrow', text: 'Asset register' }),
        h('h1', { text: 'Directly held positions' })
      ]),
      h('div', { class: 'spacer' }),
      h('div', { class: 'actions' }, [
        el.rangeCtl = h('div', { class: 'segmented', role: 'group', 'aria-label': 'Valuation period' }, [12, 24, 36].map(function (n) {
          return h('button', { type: 'button', text: n + 'm', 'aria-pressed': n === range ? 'true' : 'false',
            onclick: function () { range = n; drawChart(); syncRange(); } });
        })),
        h('button', { class: 'btn', type: 'button', onclick: function () { KH.app.toast('Register exported', 'Valuation schedule queued for the custody team.'); } }, [
          icon('download'), h('span', { text: 'Export schedule' })
        ])
      ])
    ]));

    var layout = h('div', { class: 'assets-layout' });
    root.appendChild(layout);

    var main = h('div', { class: 'assets-main' });
    var side = h('div', { class: 'assets-side scroll' });
    layout.appendChild(main);
    layout.appendChild(side);

    el.tiles = h('div', { class: 'tiles' });
    main.appendChild(el.tiles);

    el.chart = h('div', { style: { height: '100%', minHeight: '190px' } });
    el.chartTitle = h('h2', { text: 'Valuation history' });
    el.chartSub = h('span', { class: 'sub' });
    main.appendChild(h('div', { class: 'panel', style: { flex: '1 1 250px', minHeight: '210px' } }, [
      h('div', { class: 'panel-head' }, [el.chartTitle, el.chartSub, h('div', { class: 'spacer' }), el.chartChip = h('span', { class: 'chip' })]),
      h('div', { class: 'panel-body', style: { flex: '1', minHeight: '0' } }, el.chart)
    ]));

    el.list = h('div', { class: 'rows' });
    main.appendChild(h('div', { class: 'panel', style: { flex: '1 1 260px', minHeight: '200px' } }, [
      h('div', { class: 'panel-head' }, [
        h('h2', { text: 'Holdings' }),
        h('span', { class: 'sub', text: KH.assets.register.length + ' positions' }),
        h('div', { class: 'spacer' }),
        el.totalChip = h('span', { class: 'chip accent' })
      ]),
      h('div', { class: 'scroll', style: { flex: '1', minHeight: '0' } }, el.list)
    ]));

    /* ---- Side ---- */
    el.detail = h('div', { class: 'panel-body' });
    side.appendChild(h('div', { class: 'panel' }, [
      h('div', { class: 'panel-head' }, [el.detailTitle = h('h2', { text: 'Position detail' })]),
      el.detail
    ]));

    el.donut = h('div', { style: { height: '146px' } });
    el.legend = h('div', { style: { marginTop: '10px' } });
    side.appendChild(h('div', { class: 'panel' }, [
      h('div', { class: 'panel-head' }, [h('h2', { text: 'Allocation by class' }), h('span', { class: 'sub', text: 'Share of register' })]),
      h('div', { class: 'panel-body' }, [el.donut, el.legend])
    ]));

    el.bars = h('div', {});
    side.appendChild(h('div', { class: 'panel' }, [
      h('div', { class: 'panel-head' }, [h('h2', { text: 'Twelve-month movement' }), h('span', { class: 'sub', text: 'By position' })]),
      h('div', { class: 'panel-body' }, el.bars)
    ]));

    KH.dom.onResize(layout, function () { drawChart(); drawDonut(); drawBars(); });
    refresh();
  }

  function syncRange() {
    if (!el.rangeCtl) return;
    KH.dom.$$('button', el.rangeCtl).forEach(function (b) {
      b.setAttribute('aria-pressed', b.textContent === range + 'm' ? 'true' : 'false');
    });
  }

  function drawTiles() {
    var total = KH.assets.total(), cost = KH.assets.cost();
    var hist = KH.assets.groupHistory();
    var yearAgo = hist[hist.length - 13] || hist[0];
    var yoy = ((total - yearAgo.v) / yearAgo.v) * 100;
    var best = KH.assets.register.slice().sort(function (a, b) { return b.gainPct - a.gainPct; })[0];

    KH.dom.fill(el.tiles, [
      { k: 'Register valuation', v: fmt.moneyShort(total), d: yoy, f: 'Twelve-month movement' },
      { k: 'Total cost', v: fmt.moneyShort(cost), d: null, f: 'Across ' + KH.assets.register.length + ' positions' },
      { k: 'Unrealised gain', v: fmt.signedShort(total - cost), d: ((total - cost) / cost) * 100, f: 'Against cost' },
      { k: 'Strongest position', v: best.name.split('—')[0].trim().slice(0, 18), d: best.gainPct, f: fmt.moneyShort(best.value) }
    ].map(function (t) {
      return h('div', { class: 'stat' }, [
        h('div', { class: 'k', text: t.k }),
        h('div', { class: 'v', text: t.v }),
        h('div', { class: 'f' }, [
          t.d === null ? null : h('span', { class: 'delta ' + fmt.dir(t.d) }, [
            h('span', { class: 'arrow', text: fmt.arrow(t.d), 'aria-hidden': 'true' }),
            h('span', { text: fmt.pct(t.d) })
          ]),
          h('span', { text: t.f })
        ])
      ]);
    }));

    if (el.totalChip) el.totalChip.textContent = fmt.money(total, 0);
  }

  function drawChart() {
    if (!el.chart) return;
    var a = KH.assets.get(selected);
    var points = a.history.slice(-range);
    el.chartTitle.textContent = a.name;
    el.chartSub.textContent = a.klass;
    el.chartChip.textContent = a.status;
    KH.charts.timeSeries(el.chart, {
      series: [{ name: a.name, points: points, color: a.color }],
      area: true,
      yFormat: fmt.moneyShort,
      tipFormat: function (v) { return fmt.money(v, 0); },
      xFormat: function (t) { return new Date(t).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }); },
      ariaLabel: 'Valuation of ' + a.name + ' over ' + range + ' months'
    });
  }

  function drawList() {
    var ordered = KH.assets.register.slice().sort(function (x, y) { return y.value - x.value; });
    KH.dom.fill(el.list, ordered.map(function (a) {
      var spark = h('span', { class: 'mini' });
      var row = h('button', {
        class: 'asset-row', type: 'button', 'aria-selected': a.id === selected ? 'true' : 'false',
        onclick: function () { selected = a.id; drawList(); drawChart(); drawDetail(); }
      }, [
        h('span', { class: 'swatch', style: { background: a.color } }),
        h('span', { class: 'nm' }, [h('b', { text: a.name }), h('span', { text: a.klass + ' · ' + a.where })]),
        spark,
        h('span', { class: 'figs' }, [
          h('b', { text: fmt.moneyShort(a.value) }),
          h('span', { class: 'delta ' + fmt.dir(a.yoy), style: { fontSize: 'var(--type-meta)' } }, [
            h('span', { class: 'arrow', text: fmt.arrow(a.yoy), 'aria-hidden': 'true' }),
            h('span', { text: fmt.pct(a.yoy, 1) })
          ])
        ])
      ]);
      // The sparkline needs a laid-out box before it can size itself.
      requestAnimationFrame(function () {
        KH.charts.spark(spark, a.history.slice(-24).map(function (p) { return p.v; }), { color: a.color });
      });
      return row;
    }));
  }

  function drawDetail() {
    if (!el.detail) return;
    var a = KH.assets.get(selected);
    el.detailTitle.textContent = 'Position detail';

    KH.dom.fill(el.detail, [
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' } }, [
        h('span', { class: 'avatar', style: { background: a.color }, text: a.klass.slice(0, 2).toUpperCase(), 'aria-hidden': 'true' }),
        h('span', { style: { minWidth: '0', lineHeight: '1.3' } }, [
          h('b', { style: { display: 'block', fontSize: '.9rem' }, text: a.name }),
          h('span', { style: { display: 'block', fontSize: 'var(--type-meta)', color: 'var(--text-muted)' }, text: a.note })
        ])
      ]),
      h('dl', { class: 'kv' }, [
        h('dt', { text: 'Current valuation' }), h('dd', { text: fmt.money(a.value, 0) }),
        h('dt', { text: 'Acquisition cost' }), h('dd', { text: fmt.money(a.cost, 0) }),
        h('dt', { text: 'Unrealised' }), h('dd', {}, h('span', { class: 'delta ' + fmt.dir(a.gain) }, [
          h('span', { class: 'arrow', text: fmt.arrow(a.gain), 'aria-hidden': 'true' }),
          h('span', { text: fmt.signed(a.gain, 0) })
        ])),
        h('dt', { text: 'Return on cost' }), h('dd', { text: fmt.pct(a.gainPct, 1) }),
        h('dt', { text: 'Twelve months' }), h('dd', { text: fmt.pct(a.yoy, 1) }),
        h('dt', { text: 'Asset class' }), h('dd', { text: a.klass }),
        h('dt', { text: 'Acquired' }), h('dd', { text: new Date(a.acquired).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }),
        h('dt', { text: 'Location' }), h('dd', { text: a.where }),
        h('dt', { text: 'Status' }), h('dd', { text: a.status }),
        h('dt', { text: 'Reference' }), h('dd', { text: a.ref })
      ]),
      h('div', { style: { marginTop: '12px' } }, [
        h('div', { style: { fontSize: 'var(--type-micro)', letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '5px' }, text: 'Share of register' }),
        (function () {
          var share = (a.value / KH.assets.total()) * 100;
          return h('div', {}, [
            h('div', { class: 'meter' }, h('i', { style: { width: share.toFixed(1) + '%' } })),
            h('div', { style: { fontSize: 'var(--type-meta)', marginTop: '4px', color: 'var(--text-secondary)' }, text: share.toFixed(1) + '% of ' + fmt.moneyShort(KH.assets.total()) })
          ]);
        })()
      ])
    ]);
  }

  function drawDonut() {
    if (!el.donut) return;
    var slices = KH.assets.byClass();
    var top = slices.slice(0, 6);
    var rest = slices.slice(6);
    if (rest.length) top.push({ label: 'Other (' + rest.length + ')', value: KH.util.sum(rest, function (s) { return s.value; }), color: 'var(--text-muted)' });
    KH.charts.donut(el.donut, top, {
      format: fmt.moneyShort,
      centreTop: String(slices.length),
      centreBottom: 'Classes',
      ariaLabel: 'Register split by asset class'
    });
    KH.dom.fill(el.legend, KH.charts.legend(top, fmt.moneyShort));
  }

  function drawBars() {
    if (!el.bars) return;
    var items = KH.assets.register.slice()
      .sort(function (a, b) { return b.yoy - a.yoy; })
      .map(function (a) { return { label: a.name.split('—')[0].trim(), value: a.yoy, color: a.color, note: fmt.moneyShort(a.value) }; });
    KH.charts.barsH(el.bars, items, {
      format: function (v) { return fmt.pct(v, 1); },
      labelW: 150, valueW: 62, rowH: 24,
      ariaLabel: 'Twelve-month movement by position'
    });
  }

  function refresh() {
    if (!el.tiles) return;
    drawTiles(); drawChart(); drawList(); drawDetail(); drawDonut(); drawBars(); syncRange();
  }

  KH.views = KH.views || {};
  KH.views.assets = {
    id: 'assets', label: 'Register', icon: 'briefcase',
    mount: mount,
    activate: refresh,
    refresh: refresh
  };
})(window.KH);

/* ============================================================
   Markets — the watchlist, the price plot, the dealing ticket
   and the account's own positions and blotter.
   ============================================================ */

(function (KH) {
  'use strict';

  var h = KH.dom.h, icon = KH.dom.icon, fmt = KH.fmt;

  var el = {};
  var rowRefs = {};
  var current = { sym: null, mode: 'intraday', tab: 'positions', query: '', qty: 1000 };
  var ticksSinceDraw = 0;

  function mount(root) {
    current.sym = current.sym || KH.market.book()[0].sym;

    root.appendChild(h('div', { class: 'view-head' }, [
      h('div', { class: 'titles' }, [
        h('div', { class: 'eyebrow', text: 'Kellett Global Exchange' }),
        h('h1', { text: 'Trading' })
      ]),
      h('div', { class: 'spacer' }),
      h('div', { class: 'actions' }, [
        el.sessionChip = h('span', { class: 'chip' }),
        el.cashChip = h('span', { class: 'chip accent' }),
        h('button', {
          class: 'btn', type: 'button',
          onclick: function () { KH.reports.marketSheet(); KH.app.toast('Market sheet exported', 'Saved as a PDF to your downloads.', 'check'); }
        }, [icon('download'), h('span', { text: 'Market sheet' })])
      ])
    ]));

    var layout = h('div', { class: 'mkt-layout' });
    root.appendChild(layout);

    /* ---- Watchlist ---- */
    el.watch = h('tbody');
    layout.appendChild(h('div', { class: 'mkt-left' }, [
      h('div', { class: 'panel', style: { flex: '1', minHeight: '0' } }, [
        h('div', { class: 'panel-head' }, [
          h('h2', { text: 'Watchlist' }),
          h('div', { class: 'spacer' }),
          h('span', { class: 'sub', text: KH.market.book().length + ' lines' })
        ]),
        h('div', { style: { padding: '8px var(--pad)', borderBottom: '1px solid var(--rule)' } },
          h('div', { class: 'search' }, [
            KH.dom.svg('svg', { 'aria-hidden': 'true' }, KH.dom.svg('use', { href: '#i-search' })),
            h('input', {
              class: 'field', type: 'search', placeholder: 'Filter instruments', 'aria-label': 'Filter instruments',
              oninput: KH.util.debounce(function (ev) { current.query = ev.target.value; renderWatch(); }, 120)
            })
          ])),
        h('div', { class: 'tbl-wrap scroll' },
          h('table', { class: 'tbl' }, [
            h('thead', {}, h('tr', {}, [
              h('th', { text: 'Code' }), h('th', { class: 'r', text: 'Last' }),
              h('th', { class: 'r', text: 'Change' }), h('th', { class: 'r', text: 'Score' })
            ])),
            el.watch
          ]))
      ])
    ]));

    /* ---- Quote and chart ---- */
    el.quoteHead = h('div', { class: 'quote-head' });
    el.chart = h('div', { style: { height: '100%', minHeight: '180px' } });
    el.tabBody = h('div', { class: 'tbl-wrap scroll' });

    layout.appendChild(h('div', { class: 'mkt-mid' }, [
      h('div', { class: 'panel', style: { flex: '1 1 300px', minHeight: '250px' } }, [
        el.quoteHead,
        h('div', { class: 'panel-body', style: { flex: '1', minHeight: '0' } }, el.chart)
      ]),
      h('div', { class: 'panel', style: { flex: '1 1 210px', minHeight: '170px' } }, [
        h('div', { class: 'panel-head' }, [
          el.tabCtl = h('div', { class: 'segmented', role: 'group', 'aria-label': 'Account view' }, [
            h('button', { type: 'button', text: 'Positions', 'aria-pressed': 'true', onclick: function () { current.tab = 'positions'; renderTabs(); } }),
            h('button', { type: 'button', text: 'Order blotter', 'aria-pressed': 'false', onclick: function () { current.tab = 'blotter'; renderTabs(); } })
          ]),
          h('div', { class: 'spacer' }),
          el.pnlChip = h('span', { class: 'chip' })
        ]),
        el.tabBody
      ])
    ]));

    /* ---- Ticket and depth ---- */
    el.ticket = h('div', { class: 'order-ticket' });
    el.depth = h('div', { class: 'depth', style: { padding: '8px 0' } });
    layout.appendChild(h('div', { class: 'mkt-right' }, [
      h('div', { class: 'panel' }, [
        h('div', { class: 'panel-head' }, [h('h2', { text: 'Order ticket' }), h('div', { class: 'spacer' }), icon('shield', 'sub')]),
        el.ticket
      ]),
      h('div', { class: 'panel', style: { flex: '1', minHeight: '0' } }, [
        h('div', { class: 'panel-head' }, [h('h2', { text: 'Market depth' }), h('div', { class: 'spacer' }), el.spreadChip = h('span', { class: 'chip plain' })]),
        h('div', { class: 'scroll', style: { flex: '1', minHeight: '0' } }, el.depth)
      ])
    ]));

    KH.dom.onResize(layout, drawChart);
    renderWatch();
    renderQuote();
    renderTicket();
    renderTabs();
    renderDepth();
    drawChart();
  }

  /* ---------- Watchlist ------------------------------------------------ */

  function renderWatch() {
    rowRefs = {};
    var q = current.query.trim().toLowerCase();
    var list = KH.market.book().filter(function (i) {
      return !q || (i.sym + ' ' + i.name + ' ' + i.sector).toLowerCase().indexOf(q) !== -1;
    });

    if (!list.length) {
      KH.dom.fill(el.watch, h('tr', {}, h('td', { colspan: '4' }, h('div', { class: 'empty', text: 'No instrument matches that filter' }))));
      return;
    }

    KH.dom.fill(el.watch, list.map(function (i) {
      var ch = KH.market.change(i);
      var sc = KH.sim.turnaroundScore(i.sym);
      var px = h('td', { class: 'r num', text: fmt.group(i.px, 2) });
      var delta = h('td', { class: 'r' }, h('span', { class: 'delta ' + fmt.dir(ch.pct) }, [
        h('span', { class: 'arrow', text: fmt.arrow(ch.pct), 'aria-hidden': 'true' }),
        h('span', { text: fmt.pct(ch.pct) })
      ]));
      var tr = h('tr', {
        class: 'clickable', tabindex: '0', 'aria-selected': i.sym === current.sym ? 'true' : 'false',
        onclick: function () { select(i.sym); },
        onkeydown: function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(i.sym); } }
      }, [
        h('td', {}, [
          h('div', { class: 'sym', text: i.sym }),
          h('div', { class: 'muted', style: { fontSize: 'var(--type-micro)' }, text: i.sector })
        ]),
        px, delta,
        h('td', { class: 'r' }, h('span', {
          class: 'score-pill ' + (sc <= 0 ? 'doomed' : sc < 35 ? 'hard' : sc < 65 ? 'fair' : 'good'),
          title: KH.sim.turnaroundLabel(sc), text: String(sc)
        }))
      ]);
      rowRefs[i.sym] = { tr: tr, px: px, delta: delta, last: i.px };
      return tr;
    }));
  }

  function updateWatch() {
    KH.market.book().forEach(function (i) {
      var r = rowRefs[i.sym];
      if (!r) return;
      var ch = KH.market.change(i);
      r.px.textContent = fmt.group(i.px, 2);
      KH.dom.fill(r.delta, h('span', { class: 'delta ' + fmt.dir(ch.pct) }, [
        h('span', { class: 'arrow', text: fmt.arrow(ch.pct), 'aria-hidden': 'true' }),
        h('span', { text: fmt.pct(ch.pct) })
      ]));
      if (Math.abs(i.px - r.last) > 1e-9) {
        var up = i.px > r.last;
        r.px.classList.remove('flash-up', 'flash-down');
        void r.px.offsetWidth;
        r.px.classList.add(up ? 'flash-up' : 'flash-down');
        r.last = i.px;
      }
    });
  }

  /* ---------- Quote ---------------------------------------------------- */

  function select(sym) {
    current.sym = sym;
    KH.dom.$$('tr', el.watch).forEach(function (tr) { tr.setAttribute('aria-selected', 'false'); });
    if (rowRefs[sym]) rowRefs[sym].tr.setAttribute('aria-selected', 'true');
    renderQuote(); renderTicket(); renderDepth(); drawChart();
  }

  function renderQuote() {
    var i = KH.market.get(current.sym);
    var ch = KH.market.change(i);
    var corp = KH.game.get().corps[i.sym];
    var own = KH.sim.ownership(i.sym);
    var score = KH.sim.turnaroundScore(i.sym);

    KH.dom.fill(el.quoteHead, [
      h('div', { class: 'q-name' }, [
        h('h3', { text: i.name }),
        h('span', { text: i.sym + ' · ' + i.sector + (i.house ? ' · Group holding' : '') })
      ]),
      h('div', { class: 'q-px' }, [
        el.bigPx = h('div', { class: 'px', text: fmt.group(i.px, 2) + 'p' }),
        el.bigDelta = h('div', { class: 'delta ' + fmt.dir(ch.pct) }, [
          h('span', { class: 'arrow', text: fmt.arrow(ch.pct), 'aria-hidden': 'true' }),
          h('span', { text: fmt.group(ch.abs, 2) + 'p (' + fmt.pct(ch.pct) + ')' })
        ])
      ]),
      h('div', { style: { width: '100%', display: 'flex', gap: '18px', flexWrap: 'wrap', paddingTop: '4px' } }, [
        stat('Open', fmt.group(i.open, 2) + 'p'),
        stat('Day high', fmt.group(i.high, 2) + 'p'),
        stat('Day low', fmt.group(i.low, 2) + 'p'),
        stat('Previous close', fmt.group(i.prevClose, 2) + 'p'),
        stat('Volume', fmt.shortNum(i.volume)),
        stat('Holding', corp && corp.shares ? (own * 100).toFixed(2) + '%' : 'None'),
        stat('Fair value', fmt.group(KH.sim.fairPrice(i), 2) + 'p'),
        stat('Turnaround', score + ' \u00b7 ' + KH.sim.turnaroundLabel(score)),
        h('div', { style: { marginLeft: 'auto' } }, el.modeCtl = h('div', { class: 'segmented', role: 'group', 'aria-label': 'Chart period' }, [
          h('button', { type: 'button', text: 'Intraday', 'aria-pressed': current.mode === 'intraday' ? 'true' : 'false', onclick: function () { current.mode = 'intraday'; syncMode(); drawChart(); } }),
          h('button', { type: 'button', text: '90 sessions', 'aria-pressed': current.mode === 'sessions' ? 'true' : 'false', onclick: function () { current.mode = 'sessions'; syncMode(); drawChart(); } })
        ]))
      ])
    ]);
  }

  function stat(k, v) {
    return h('div', { style: { lineHeight: '1.3' } }, [
      h('div', { style: { fontSize: 'var(--type-micro)', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }, text: k }),
      h('div', { class: 'num', style: { fontSize: 'var(--type-body)', fontWeight: '600' }, text: v })
    ]);
  }

  function syncMode() {
    if (!el.modeCtl) return;
    KH.dom.$$('button', el.modeCtl).forEach(function (b) {
      b.setAttribute('aria-pressed', (b.textContent === 'Intraday') === (current.mode === 'intraday') ? 'true' : 'false');
    });
  }

  function updateQuote() {
    var i = KH.market.get(current.sym);
    var ch = KH.market.change(i);
    if (el.bigPx) el.bigPx.textContent = fmt.group(i.px, 2) + 'p';
    if (el.bigDelta) {
      KH.dom.fill(el.bigDelta, [
        h('span', { class: 'arrow', text: fmt.arrow(ch.pct), 'aria-hidden': 'true' }),
        h('span', { text: fmt.group(ch.abs, 2) + 'p (' + fmt.pct(ch.pct) + ')' })
      ]);
      el.bigDelta.className = 'delta ' + fmt.dir(ch.pct);
    }
  }

  function drawChart() {
    if (!el.chart) return;
    var i = KH.market.get(current.sym);
    if (current.mode === 'sessions') {
      KH.charts.candles(el.chart, i.candles, {
        yFormat: function (v) { return fmt.group(v, 0); },
        xFormat: function (t) { return fmt.dayMonth(t); },
        ariaLabel: i.name + ' — 90 daily sessions'
      });
    } else {
      KH.charts.timeSeries(el.chart, {
        series: [{ name: i.sym, points: i.intraday, color: KH.market.change(i).pct >= 0 ? 'var(--up)' : 'var(--down)' }],
        area: true,
        yFormat: function (v) { return fmt.group(v, 0); },
        tipFormat: function (v) { return fmt.group(v, 2) + 'p'; },
        xFormat: function (t) { return fmt.time(t); },
        ariaLabel: i.name + ' — intraday'
      });
    }
  }

  /* ---------- Ticket --------------------------------------------------- */

  function renderTicket() {
    var i = KH.market.get(current.sym);
    var t = KH.game.get().treasury;

    var qtyInput = h('input', {
      class: 'field num', type: 'number', min: '1', step: '1', value: String(current.qty),
      'aria-label': 'Quantity in shares',
      oninput: function (ev) { current.qty = Math.max(0, Math.floor(Number(ev.target.value) || 0)); updateSummary(); }
    });

    var summary = h('dl', { class: 'order-summary' });
    el.summary = summary;

    function updateSummary() {
      var qty = current.qty;
      var q = KH.market.quote('buy', i.sym, qty || 0);
      KH.dom.fill(summary, [
        h('dt', { text: 'Price' }), h('dd', { text: fmt.group(i.px, 2) + 'p' }),
        h('dt', { text: 'Consideration' }), h('dd', { text: fmt.money(q.consideration) }),
        h('dt', { text: 'Commission' }), h('dd', { text: fmt.money(q.costs.commission) }),
        h('dt', { text: 'Stamp duty' }), h('dd', { text: fmt.money(q.costs.duty) }),
        h('dt', { text: 'Levy' }), h('dd', { text: fmt.money(q.costs.levy) }),
        h('dt', { style: { color: 'var(--text-primary)', fontWeight: '600' }, text: 'Total to pay' }),
        h('dd', { style: { color: 'var(--text-primary)' }, text: fmt.money(q.net) })
      ]);
    }

    function place(side) {
      var res = KH.market.deal(side, i.sym, current.qty);
      if (!res.ok) { KH.app.toast('Order rejected', res.reason, 'alert'); return; }
      KH.sound.play('trade');
      var q = res.quote;
      KH.app.toast(
        (side === 'buy' ? 'Bought ' : 'Sold ') + fmt.group(q.qty, 0) + ' ' + i.sym,
        (side === 'buy' ? 'Debited ' : 'Credited ') + fmt.money(q.net) + ' · ' + fmt.group(q.px * 100, 2) + 'p',
        'check'
      );
      renderQuote(); renderTicket(); renderTabs(); syncMode();
      KH.bus.emit('portfolio:changed');
    }

    var ownNow = KH.sim.ownership(i.sym);
    var ctrl = KH.mike.costToControl(i.sym);

    KH.dom.fill(el.ticket, [
      ownNow > 0 ? h('div', { class: 'callout ' + (ownNow >= KH.sim.CONTROL ? 'good' : '') }, [
        icon(ownNow >= KH.sim.CONTROL ? 'check' : 'info'),
        h('span', { text: ownNow >= KH.sim.CONTROL
          ? 'You control this company. Manage it from Empire.'
          : 'You hold ' + (ownNow * 100).toFixed(2) + '%. Control needs ' + fmt.group(ctrl.need, 0) + ' more shares, about ' + fmt.money(ctrl.cost, 0) + '.' })
      ]) : null,
      h('div', {}, [
        h('span', { class: 'lbl', text: 'Instrument' }),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
          h('span', { class: 'avatar sm', style: { background: 'var(--accent-deep)' }, text: i.sym.slice(0, 2), 'aria-hidden': 'true' }),
          h('span', { style: { minWidth: '0', lineHeight: '1.28' } }, [
            h('b', { style: { display: 'block', fontSize: '.86rem' }, text: i.sym }),
            h('span', { style: { display: 'block', fontSize: 'var(--type-meta)', color: 'var(--text-muted)' }, text: i.name })
          ])
        ])
      ]),
      h('div', {}, [
        h('span', { class: 'lbl', text: 'Quantity' }),
        h('div', { class: 'qty-row' }, [
          qtyInput,
          h('button', { class: 'btn sm', type: 'button', text: '×2', onclick: function () { current.qty = Math.max(1, current.qty * 2); qtyInput.value = String(current.qty); updateSummary(); } }),
          h('button', {
          class: 'btn sm', type: 'button', text: '50%', title: 'Enough shares to take control',
          onclick: function () { current.qty = Math.max(1, ctrl.need || 1); qtyInput.value = String(current.qty); updateSummary(); }
        }),
        h('button', { class: 'btn sm', type: 'button', text: 'Max', title: 'Largest whole quantity your cash covers', onclick: function () {
            var px = i.px / 100;
            var max = Math.floor((t.cash * 0.994) / px);
            current.qty = Math.max(0, max);
            qtyInput.value = String(current.qty);
            updateSummary();
          } })
        ])
      ]),
      h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } }, [100, 500, 1000, 5000, 25000].map(function (n) {
        return h('button', { class: 'btn sm ghost', type: 'button', text: fmt.shortNum(n), onclick: function () { current.qty = n; qtyInput.value = String(n); updateSummary(); } });
      })),
      summary,
      h('div', { class: 'order-buttons' }, [
        h('button', { class: 'btn buy', type: 'button', text: 'Buy', onclick: function () { place('buy'); } }),
        h('button', { class: 'btn sell', type: 'button', text: 'Sell', onclick: function () { place('sell'); } })
      ]),
      h('div', { style: { fontSize: 'var(--type-micro)', color: 'var(--text-muted)', lineHeight: '1.45' },
        text: 'Settled cash ' + fmt.money(KH.game.get().treasury.cash, 0) + '. Orders execute at the prevailing quote; costs are charged on both sides of a trade.' })
    ]);
    updateSummary();
  }

  /* ---------- Positions and blotter ------------------------------------ */

  function renderTabs() {
    if (!el.tabBody) return;
    KH.dom.$$('button', el.tabCtl).forEach(function (b) {
      b.setAttribute('aria-pressed', (b.textContent === 'Positions') === (current.tab === 'positions') ? 'true' : 'false');
    });

    var p = KH.market.portfolio();
    if (el.pnlChip) {
      el.pnlChip.textContent = 'Unrealised ' + fmt.signed(p.pnl, 0);
      el.pnlChip.className = 'chip ' + (p.pnl > 0 ? 'good' : p.pnl < 0 ? 'warn' : '');
    }
    if (el.cashChip) el.cashChip.textContent = 'Cash ' + fmt.moneyShort(p.cash);

    if (current.tab === 'positions') {
      if (!p.positions.length) {
        KH.dom.fill(el.tabBody, h('div', { class: 'empty' }, [icon('briefcase'), h('span', { text: 'No open positions. Use the ticket to place an order.' })]));
        return;
      }
      KH.dom.fill(el.tabBody, h('table', { class: 'tbl' }, [
        h('thead', {}, h('tr', {}, [
          h('th', { text: 'Code' }), h('th', { text: 'Instrument' }),
          h('th', { class: 'r', text: 'Stake' }),
          h('th', { class: 'r', text: 'Qty' }), h('th', { class: 'r', text: 'Avg cost' }),
          h('th', { class: 'r', text: 'Last' }), h('th', { class: 'r', text: 'Value' }),
          h('th', { class: 'r', text: 'Unrealised' })
        ])),
        h('tbody', {}, p.positions.map(function (r) {
          return h('tr', { class: 'clickable', onclick: function () { KH.app.go('empire'); KH.views.empire.select(r.sym); } }, [
            h('td', { class: 'sym', text: r.sym }),
            h('td', { class: 'muted', text: r.name }),
            h('td', { class: 'r num', text: (r.own * 100).toFixed(2) + '%' }),
            h('td', { class: 'r num', text: fmt.group(r.qty, 0) }),
            h('td', { class: 'r num', text: fmt.money(r.avg, 4) }),
            h('td', { class: 'r num', text: fmt.group(r.px * 100, 2) + 'p' }),
            h('td', { class: 'r num', text: fmt.money(r.value, 0) }),
            h('td', { class: 'r' }, h('span', { class: 'delta ' + fmt.dir(r.pnl) }, [
              h('span', { class: 'arrow', text: fmt.arrow(r.pnl), 'aria-hidden': 'true' }),
              h('span', { text: fmt.signed(r.pnl, 0) + ' (' + fmt.pct(r.pnlPct, 1) + ')' })
            ]))
          ]);
        }))
      ]));
    } else {
      var blotter = KH.game.get().ledger.filter(function (r) {
        return r.kind === 'dealing' || r.kind === 'property' || r.kind === 'lifestyle' || r.kind === 'bailout';
      }).slice(0, 80);
      if (!blotter.length) {
        KH.dom.fill(el.tabBody, h('div', { class: 'empty' }, [icon('archive'), h('span', { text: 'No transactions on this account yet.' })]));
        return;
      }
      KH.dom.fill(el.tabBody, h('table', { class: 'tbl' }, [
        h('thead', {}, h('tr', {}, [
          h('th', { text: 'Period' }), h('th', { text: 'Time' }), h('th', { text: 'Category' }),
          h('th', { text: 'Narrative' }), h('th', { class: 'r', text: 'Amount' })
        ])),
        h('tbody', {}, blotter.map(function (b) {
          return h('tr', {}, [
            h('td', { class: 'muted', text: 'Y' + b.year + ' W' + b.week }),
            h('td', { class: 'num muted', text: fmt.timeSec(b.at) }),
            h('td', {}, h('span', { class: 'chip ' + (b.amount >= 0 ? 'good' : ''), text: b.kind })),
            h('td', { class: 'muted', text: b.text }),
            h('td', { class: 'r' }, h('span', { class: 'delta ' + fmt.dir(b.amount) }, [
              h('span', { class: 'arrow', text: fmt.arrow(b.amount), 'aria-hidden': 'true' }),
              h('span', { text: fmt.signed(b.amount, 0) })
            ]))
          ]);
        }))
      ]));
    }
  }

  /* ---------- Depth ----------------------------------------------------- */

  function renderDepth() {
    if (!el.depth) return;
    var d = KH.market.depth(current.sym);
    var maxQty = Math.max.apply(null, d.bids.concat(d.asks).map(function (l) { return l.qty; }));
    if (el.spreadChip) el.spreadChip.textContent = 'Spread ' + d.spread.toFixed(2) + 'p';

    KH.dom.fill(el.depth, [
      h('div', { class: 'depth-row', style: { color: 'var(--text-muted)', fontSize: 'var(--type-micro)', letterSpacing: '.1em', textTransform: 'uppercase' } }, [
        h('span', { text: 'Size' }), h('span', { class: 'r', text: 'Price' }), h('span', { class: 'r', text: 'Orders' })
      ]),
      d.asks.slice().reverse().map(function (l) { return depthRow(l, 'ask', maxQty); }),
      h('div', { class: 'depth-mid' }, [
        h('span', { text: 'Touch' }),
        h('span', { text: fmt.group(KH.market.get(current.sym).px, 2) + 'p' })
      ]),
      d.bids.map(function (l) { return depthRow(l, 'bid', maxQty); })
    ]);
  }

  function depthRow(l, side, maxQty) {
    return h('div', { class: 'depth-row ' + side }, [
      h('span', { class: 'fill', style: { width: ((l.qty / maxQty) * 100).toFixed(1) + '%' } }),
      h('span', { text: fmt.group(l.qty, 0) }),
      h('span', { class: 'r', style: { color: side === 'bid' ? 'var(--up)' : 'var(--down)', fontWeight: '600' }, text: l.px.toFixed(2) }),
      h('span', { class: 'r', text: String(1 + (l.qty % 9)) })
    ]);
  }

  KH.views = KH.views || {};
  KH.views.markets = {
    id: 'markets', label: 'Markets', icon: 'chart',
    mount: mount,
    select: select,
    activate: function () { renderWatch(); renderQuote(); renderTicket(); renderTabs(); renderDepth(); drawChart(); },
    tick: function (payload) {
      if (!el.watch) return;
      if (el.sessionChip) {
        el.sessionChip.textContent = payload.session.label;
        el.sessionChip.className = 'chip ' + (payload.session.open ? 'good' : '');
      }
      updateWatch();
      updateQuote();
      if (++ticksSinceDraw % 3 === 0) {
        if (current.mode === 'intraday') drawChart();
        renderTabs();
        renderDepth();
        if (el.summary) {
          var i = KH.market.get(current.sym);
          var q = KH.market.quote('buy', i.sym, current.qty || 0);
          var dds = KH.dom.$$('dd', el.summary);
          if (dds.length === 6) {
            dds[0].textContent = fmt.group(i.px, 2) + 'p';
            dds[1].textContent = fmt.money(q.consideration);
            dds[2].textContent = fmt.money(q.costs.commission);
            dds[3].textContent = fmt.money(q.costs.duty);
            dds[4].textContent = fmt.money(q.costs.levy);
            dds[5].textContent = fmt.money(q.net);
          }
        }
      }
    },
    refresh: function () { if (el.watch) { renderWatch(); renderQuote(); renderTicket(); renderTabs(); } }
  };
})(window.KH);

/* ============================================================
   Markets — a screener, not a wall of flashing numbers.

   Every line on the exchange, with the figures you would actually
   screen on: capitalisation, margin, condition grade and what it
   would cost to take control. Sortable, filterable, and stable
   enough to read while it updates.
   ============================================================ */

(function (KH) {
  'use strict';

  var h = KH.dom.h, icon = KH.dom.icon, fmt = KH.fmt;

  var el = {};
  var rowRefs = {};
  var current = {
    sym: null, mode: 'intraday', tab: 'screen',
    query: '', sector: 'all', filter: 'all',
    sort: 'cap', dir: -1, qty: 1000
  };
  var ticks = 0;

  var COLUMNS = [
    { id: 'sym', label: 'Code', sort: function (i) { return i.sym; }, cls: 'sym' },
    { id: 'name', label: 'Company', sort: function (i) { return i.name; }, wide: true },
    { id: 'sector', label: 'Sector', sort: function (i) { return i.sector; }, hideNarrow: true },
    { id: 'px', label: 'Last', sort: function (i) { return i.px; }, num: true },
    { id: 'chg', label: 'Chg %', sort: function (i) { return KH.market.change(i).pct; }, num: true },
    { id: 'cap', label: 'Cap', sort: function (i) { return (i.px / 100) * i.shares; }, num: true },
    { id: 'margin', label: 'Margin', sort: function (i) { return i.f.margin; }, num: true, hideNarrow: true },
    { id: 'grade', label: 'Cond.', sort: function (i) { return KH.sim.turnaroundScore(i.sym); }, num: true },
    { id: 'held', label: 'Held', sort: function (i) { return KH.sim.ownership(i.sym); }, num: true },
    { id: 'ctrl', label: 'Control', sort: function (i) { return KH.mike.costToControl(i.sym).cost; }, num: true, hideNarrow: true }
  ];

  var FILTERS = [
    { id: 'all', label: 'All lines' },
    { id: 'held', label: 'My holdings' },
    { id: 'afford', label: 'Affordable' },
    { id: 'control', label: 'Control in reach' },
    { id: 'fixable', label: 'Turnaround candidates' }
  ];

  function sectors() {
    var seen = [];
    KH.market.book().forEach(function (i) { if (seen.indexOf(i.sector) === -1) seen.push(i.sector); });
    return seen.sort();
  }

  function screened() {
    var q = current.query.trim().toLowerCase();
    var cash = KH.game.get().treasury.cash;
    var list = KH.market.book().filter(function (i) {
      if (q && (i.sym + ' ' + i.name + ' ' + i.sector).toLowerCase().indexOf(q) === -1) return false;
      if (current.sector !== 'all' && i.sector !== current.sector) return false;
      if (current.filter === 'held') return KH.sim.ownership(i.sym) > 0;
      if (current.filter === 'afford') return (i.px / 100) * 1000 <= cash;
      if (current.filter === 'control') return KH.mike.costToControl(i.sym).cost <= cash;
      if (current.filter === 'fixable') {
        var sc = KH.sim.turnaroundScore(i.sym);
        return sc > 0 && sc < 62 && KH.sim.fairPrice(i) > i.px;
      }
      return true;
    });
    var col = COLUMNS.filter(function (c) { return c.id === current.sort; })[0] || COLUMNS[5];
    return list.sort(function (a, b) {
      var x = col.sort(a), y = col.sort(b);
      if (typeof x === 'string') return x.localeCompare(y) * current.dir;
      return (x - y) * current.dir;
    });
  }

  /* ============================================================
     Mount
     ============================================================ */

  function mount(root) {
    current.sym = current.sym || KH.market.book()[0].sym;

    root.appendChild(h('div', { class: 'view-head' }, [
      h('div', { class: 'titles' }, [
        h('div', { class: 'eyebrow', text: 'Kellett Global Exchange' }),
        h('h1', { text: 'Markets' })
      ]),
      h('div', { class: 'spacer' }),
      h('div', { class: 'actions' }, [
        el.sessionChip = h('span', { class: 'chip' }),
        el.cashChip = h('span', { class: 'chip accent' }),
        h('button', {
          class: 'btn', type: 'button',
          onclick: function () { KH.reports.marketSheet(); KH.app.toast('Market sheet exported', 'Saved as a PDF.', 'check'); }
        }, [icon('download'), h('span', { text: 'Market sheet' })])
      ])
    ]));

    var layout = h('div', { class: 'mkt-layout' });
    root.appendChild(layout);

    /* ---- Screener ---- */
    el.tbody = h('tbody');
    el.head = h('tr');

    var searchInput = h('input', {
      class: 'field', type: 'search', placeholder: 'Search code, company or sector',
      'aria-label': 'Search the exchange',
      oninput: KH.util.debounce(function (ev) { current.query = ev.target.value; renderScreen(); }, 140)
    });

    var sectorSelect = h('select', {
      class: 'field', 'aria-label': 'Sector',
      onchange: function (ev) { current.sector = ev.target.value; renderScreen(); }
    }, [h('option', { value: 'all', text: 'All sectors' })].concat(sectors().map(function (sec) {
      return h('option', { value: sec, text: sec });
    })));

    el.filterRow = h('div', { class: 'chip-row' }, FILTERS.map(function (f) {
      return h('button', {
        class: 'btn sm' + (current.filter === f.id ? ' primary' : ' ghost'), type: 'button',
        text: f.label, dataset: { filter: f.id },
        onclick: function () { current.filter = f.id; syncFilters(); renderScreen(); }
      });
    }));

    el.screenTabs = h('div', { class: 'segmented', role: 'group', 'aria-label': 'Market view' }, [
      h('button', { type: 'button', text: 'Screener', 'aria-pressed': 'true', dataset: { tab: 'screen' },
        onclick: function () { current.tab = 'screen'; renderScreen(); } }),
      h('button', { type: 'button', text: 'Positions', 'aria-pressed': 'false', dataset: { tab: 'positions' },
        onclick: function () { current.tab = 'positions'; renderScreen(); } }),
      h('button', { type: 'button', text: 'Transactions', 'aria-pressed': 'false', dataset: { tab: 'blotter' },
        onclick: function () { current.tab = 'blotter'; renderScreen(); } })
    ]);

    el.screenBody = h('div', { class: 'tbl-wrap scroll' });

    layout.appendChild(h('div', { class: 'panel mkt-screener' }, [
      h('div', { class: 'panel-head' }, [
        el.screenTabs,
        h('div', { class: 'spacer' }),
        el.countChip = h('span', { class: 'chip plain' }),
        el.pnlChip = h('span', { class: 'figure-chip' })
      ]),
      h('div', { class: 'screen-filters' }, [
        h('div', { class: 'search', style: { flex: '1 1 220px', minWidth: '0' } }, [
          KH.dom.svg('svg', { 'aria-hidden': 'true' }, KH.dom.svg('use', { href: '#i-search' })),
          searchInput
        ]),
        h('div', { style: { flex: '0 1 200px' } }, sectorSelect),
        el.filterRow
      ]),
      el.screenBody
    ]));

    /* ---- Detail ---- */
    el.quoteHead = h('div', { class: 'quote-head' });
    el.chart = h('div', { style: { height: '100%', minHeight: '150px' } });
    el.ticket = h('div', { class: 'order-ticket' });
    el.depth = h('div', { class: 'depth', style: { padding: '6px 0' } });

    layout.appendChild(h('div', { class: 'mkt-detail' }, [
      h('div', { class: 'panel', style: { minWidth: '0' } }, [
        el.quoteHead,
        h('div', { class: 'panel-body', style: { flex: '1', minHeight: '0' } }, el.chart)
      ]),
      h('div', { class: 'panel' }, [
        h('div', { class: 'panel-head' }, [h('h2', { text: 'Order ticket' }), h('div', { class: 'spacer' }), icon('shield', 'sub')]),
        el.ticket
      ]),
      h('div', { class: 'panel mkt-depth' }, [
        h('div', { class: 'panel-head' }, [h('h2', { text: 'Depth' }), h('div', { class: 'spacer' }), el.spreadChip = h('span', { class: 'chip plain' })]),
        h('div', { class: 'scroll', style: { flex: '1', minHeight: '0' } }, el.depth)
      ])
    ]));

    KH.dom.onResize(layout, drawChart);
    renderScreen();
    renderQuote();
    renderTicket();
    renderDepth();
    drawChart();
  }

  function syncFilters() {
    KH.dom.$$('button', el.filterRow).forEach(function (b) {
      b.className = 'btn sm' + (b.dataset.filter === current.filter ? ' primary' : ' ghost');
    });
  }

  function syncTabs() {
    KH.dom.$$('button', el.screenTabs).forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.tab === current.tab ? 'true' : 'false');
    });
  }

  /* ============================================================
     Screener
     ============================================================ */

  function renderScreen() {
    if (!el.screenBody) return;
    syncTabs();
    el.filterRow.parentNode.style.display = current.tab === 'screen' ? '' : 'none';

    var p = KH.market.portfolio();
    if (el.pnlChip) {
      KH.dom.fill(el.pnlChip, [
        h('span', { class: 'k', text: 'Unrealised' }),
        h('span', { class: 'delta ' + fmt.dir(p.pnl) }, [
          h('span', { class: 'arrow', text: fmt.arrow(p.pnl), 'aria-hidden': 'true' }),
          h('span', { text: fmt.signedShort(p.pnl) })
        ])
      ]);
    }
    if (el.cashChip) el.cashChip.textContent = 'Cash ' + fmt.moneyShort(p.cash);

    if (current.tab === 'positions') return renderPositions(p);
    if (current.tab === 'blotter') return renderBlotter();
    renderTable();
  }

  function renderTable() {
    rowRefs = {};
    var list = screened();
    var cash = KH.game.get().treasury.cash;
    if (el.countChip) el.countChip.textContent = list.length + ' of ' + KH.market.book().length + ' lines';

    KH.dom.fill(el.head, COLUMNS.map(function (c) {
      var active = current.sort === c.id;
      return h('th', {
        class: (c.num ? 'r ' : '') + 'sortable' + (active ? ' active' : '') + (c.hideNarrow ? ' hide-narrow' : ''),
        scope: 'col',
        'aria-sort': active ? (current.dir === 1 ? 'ascending' : 'descending') : 'none',
        tabindex: '0',
        onclick: function () { setSort(c.id); },
        onkeydown: function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setSort(c.id); } }
      }, [
        h('span', { text: c.label }),
        h('span', { class: 'sort-caret', text: active ? (current.dir === 1 ? '▲' : '▼') : '' })
      ]);
    }));

    if (!list.length) {
      KH.dom.fill(el.tbody, h('tr', {}, h('td', { colspan: String(COLUMNS.length) },
        h('div', { class: 'empty', text: 'No line matches that filter.' }))));
    } else {
      KH.dom.fill(el.tbody, list.map(function (i) { return screenRow(i, cash); }));
    }

    KH.dom.fill(el.screenBody, h('table', { class: 'tbl screener' }, [
      h('thead', {}, el.head), el.tbody
    ]));
  }

  function screenRow(i, cash) {
    var ch = KH.market.change(i);
    var own = KH.sim.ownership(i.sym);
    var score = KH.sim.turnaroundScore(i.sym);
    var ctrl = KH.mike.costToControl(i.sym);

    var px = h('td', { class: 'r num', text: fmt.group(i.px, 2) });
    var dArrow = h('span', { class: 'arrow', text: fmt.arrow(ch.pct), 'aria-hidden': 'true' });
    var dText = h('span', { text: fmt.pct(ch.pct) });
    var dWrap = h('span', { class: 'delta ' + fmt.dir(ch.pct) }, [dArrow, dText]);
    var cap = h('td', { class: 'r num', text: fmt.moneyShort((i.px / 100) * i.shares) });

    var tr = h('tr', {
      class: 'clickable', tabindex: '0',
      'aria-selected': i.sym === current.sym ? 'true' : 'false',
      onclick: function () { select(i.sym); },
      onkeydown: function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(i.sym); } }
    }, [
      h('td', { class: 'sym', text: i.sym }),
      h('td', { class: 'wrap', text: i.name }),
      h('td', { class: 'muted hide-narrow', text: i.sector }),
      px,
      h('td', { class: 'r' }, dWrap),
      cap,
      h('td', { class: 'r num hide-narrow', text: (i.f.margin * 100).toFixed(1) + '%' }),
      h('td', { class: 'r' }, h('span', { class: 'grade-pill ' + KH.app.gradeClass(score),
        title: KH.sim.turnaroundLabel(score) + ' (' + score + '/100)', text: KH.app.gradeOf(score) })),
      h('td', { class: 'r num' + (own > 0 ? '' : ' muted'), text: own > 0 ? (own * 100).toFixed(1) + '%' : '—' }),
      h('td', { class: 'r num hide-narrow' + (ctrl.cost <= cash ? ' affordable' : ' muted'),
        text: ctrl.need ? fmt.moneyShort(ctrl.cost) : 'Held' })
    ]);

    rowRefs[i.sym] = { tr: tr, px: px, cap: cap, wrap: dWrap, arrow: dArrow, text: dText, last: i.px, dir: fmt.dir(ch.pct) };
    return tr;
  }

  function setSort(id) {
    if (current.sort === id) current.dir = -current.dir;
    else { current.sort = id; current.dir = id === 'sym' || id === 'name' || id === 'sector' ? 1 : -1; }
    renderScreen();
    KH.sound.play('click');
  }

  /* Text in place, and a flash only on a move worth noticing. */
  function updateScreen() {
    KH.market.book().forEach(function (i) {
      var r = rowRefs[i.sym];
      if (!r) return;
      var ch = KH.market.change(i);
      var dir = fmt.dir(ch.pct);
      r.px.textContent = fmt.group(i.px, 2);
      r.text.textContent = fmt.pct(ch.pct);
      r.cap.textContent = fmt.moneyShort((i.px / 100) * i.shares);
      if (dir !== r.dir) { r.arrow.textContent = fmt.arrow(ch.pct); r.wrap.className = 'delta ' + dir; r.dir = dir; }
      var move = Math.abs(i.px - r.last) / (r.last || 1);
      if (move > 0.002) {
        var up = i.px > r.last;
        r.px.classList.remove('flash-up', 'flash-down');
        void r.px.offsetWidth;
        r.px.classList.add(up ? 'flash-up' : 'flash-down');
        r.last = i.px;
      }
    });
  }

  function renderPositions(p) {
    if (el.countChip) el.countChip.textContent = p.positions.length + ' open';
    if (!p.positions.length) {
      KH.dom.fill(el.screenBody, h('div', { class: 'empty' }, [icon('briefcase'),
        h('span', { text: 'No open positions. Screen the market above and use the ticket to place an order.' })]));
      return;
    }
    KH.dom.fill(el.screenBody, h('table', { class: 'tbl' }, [
      h('thead', {}, h('tr', {}, [
        h('th', { text: 'Code' }), h('th', { text: 'Company' }),
        h('th', { class: 'r', text: 'Stake' }), h('th', { class: 'r', text: 'Shares' }),
        h('th', { class: 'r', text: 'Avg cost' }), h('th', { class: 'r', text: 'Last' }),
        h('th', { class: 'r', text: 'Value' }), h('th', { class: 'r', text: 'Unrealised' })
      ])),
      h('tbody', {}, p.positions.map(function (r) {
        return h('tr', { class: 'clickable', onclick: function () { KH.app.go('empire'); KH.views.empire.select(r.sym); } }, [
          h('td', { class: 'sym', text: r.sym }),
          h('td', { class: 'muted', text: r.name }),
          h('td', { class: 'r num', text: (r.own * 100).toFixed(2) + '%' }),
          h('td', { class: 'r num', text: fmt.group(r.qty, 0) }),
          h('td', { class: 'r num', text: fmt.money(r.avg, 4) }),
          h('td', { class: 'r num', text: fmt.group(r.px * 100, 2) }),
          h('td', { class: 'r num', text: fmt.money(r.value, 0) }),
          h('td', { class: 'r' }, h('span', { class: 'delta ' + fmt.dir(r.pnl) }, [
            h('span', { class: 'arrow', text: fmt.arrow(r.pnl), 'aria-hidden': 'true' }),
            h('span', { text: fmt.signed(r.pnl, 0) + ' (' + fmt.pct(r.pnlPct, 1) + ')' })
          ]))
        ]);
      }))
    ]));
  }

  function renderBlotter() {
    var rows = KH.game.get().ledger.filter(function (r) {
      return r.kind === 'dealing' || r.kind === 'property' || r.kind === 'bailout';
    }).slice(0, 80);
    if (el.countChip) el.countChip.textContent = rows.length + ' entries';
    if (!rows.length) {
      KH.dom.fill(el.screenBody, h('div', { class: 'empty' }, [icon('archive'), h('span', { text: 'No transactions yet.' })]));
      return;
    }
    KH.dom.fill(el.screenBody, h('table', { class: 'tbl' }, [
      h('thead', {}, h('tr', {}, [
        h('th', { text: 'Period' }), h('th', { text: 'Time' }), h('th', { text: 'Category' }),
        h('th', { text: 'Narrative' }), h('th', { class: 'r', text: 'Amount' })
      ])),
      h('tbody', {}, rows.map(function (b) {
        return h('tr', {}, [
          h('td', { class: 'muted', text: 'FY' + b.year + ' W' + b.week }),
          h('td', { class: 'num muted', text: fmt.timeSec(b.at) }),
          h('td', {}, h('span', { class: 'chip plain', text: b.kind })),
          h('td', { class: 'muted', text: b.text }),
          h('td', { class: 'r' }, h('span', { class: 'delta ' + fmt.dir(b.amount) }, [
            h('span', { class: 'arrow', text: fmt.arrow(b.amount), 'aria-hidden': 'true' }),
            h('span', { text: fmt.signed(b.amount, 0) })
          ]))
        ]);
      }))
    ]));
  }

  /* ============================================================
     Detail
     ============================================================ */

  function select(sym) {
    current.sym = sym;
    Object.keys(rowRefs).forEach(function (k) { rowRefs[k].tr.setAttribute('aria-selected', k === sym ? 'true' : 'false'); });
    renderQuote(); renderTicket(); renderDepth(); drawChart();
  }

  function renderQuote() {
    var i = KH.market.get(current.sym);
    var ch = KH.market.change(i);
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
      h('div', { class: 'q-stats' }, [
        stat('Capitalisation', fmt.moneyShort((i.px / 100) * i.shares)),
        stat('Fair value', fmt.group(KH.sim.fairPrice(i), 2) + 'p'),
        stat('Margin', (i.f.margin * 100).toFixed(1) + '%'),
        stat('Condition', KH.app.gradeOf(score) + ' · ' + KH.sim.turnaroundLabel(score)),
        stat('Held', own > 0 ? (own * 100).toFixed(2) + '%' : 'None'),
        h('div', { style: { marginLeft: 'auto' } }, el.modeCtl = h('div', { class: 'segmented', role: 'group', 'aria-label': 'Chart period' }, [
          h('button', { type: 'button', text: 'Intraday', 'aria-pressed': current.mode === 'intraday' ? 'true' : 'false',
            onclick: function () { current.mode = 'intraday'; syncMode(); drawChart(); } }),
          h('button', { type: 'button', text: 'Sessions', 'aria-pressed': current.mode === 'sessions' ? 'true' : 'false',
            onclick: function () { current.mode = 'sessions'; syncMode(); drawChart(); } })
        ]))
      ])
    ]);
  }

  function stat(k, v) {
    return h('div', { class: 'q-stat' }, [
      h('div', { class: 'k', text: k }),
      h('div', { class: 'v num', text: v })
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
      KH.charts.candles(el.chart, i.candles.slice(-90), {
        yFormat: function (v) { return fmt.group(v, 0); },
        xFormat: function (t) { return fmt.dayMonth(t); },
        ariaLabel: i.name + ' by session'
      });
    } else {
      KH.charts.timeSeries(el.chart, {
        series: [{ name: i.sym, points: i.intraday, color: KH.market.change(i).pct >= 0 ? 'var(--up)' : 'var(--down)' }],
        area: true,
        yFormat: function (v) { return fmt.group(v, 0); },
        tipFormat: function (v) { return fmt.group(v, 2) + 'p'; },
        xFormat: function (t) { return fmt.time(t); },
        ariaLabel: i.name + ' intraday'
      });
    }
  }

  /* ============================================================
     Ticket
     ============================================================ */

  function renderTicket() {
    var i = KH.market.get(current.sym);
    var ownNow = KH.sim.ownership(i.sym);
    var ctrl = KH.mike.costToControl(i.sym);

    var qtyInput = h('input', {
      class: 'field num', type: 'number', min: '1', step: '1', value: String(current.qty),
      'aria-label': 'Quantity in shares',
      oninput: function (ev) { current.qty = Math.max(0, Math.floor(Number(ev.target.value) || 0)); updateSummary(); }
    });

    var summary = h('dl', { class: 'order-summary' });
    el.summary = summary;

    function updateSummary() {
      var q = KH.market.quote('buy', i.sym, current.qty || 0);
      KH.dom.fill(summary, [
        h('dt', { text: 'Price' }), h('dd', { text: fmt.group(i.px, 2) + 'p' }),
        h('dt', { text: 'Consideration' }), h('dd', { text: fmt.money(q.consideration) }),
        h('dt', { text: 'Charges' }), h('dd', { text: fmt.money(q.costs.total) }),
        h('dt', { style: { color: 'var(--text-primary)', fontWeight: '600' }, text: 'Total to pay' }),
        h('dd', { style: { color: 'var(--text-primary)' }, text: fmt.money(q.net) }),
        h('dt', { text: 'Resulting stake' }),
        h('dd', { text: (((KH.game.get().corps[i.sym] ? KH.game.get().corps[i.sym].shares : 0) + (current.qty || 0)) / i.shares * 100).toFixed(2) + '%' })
      ]);
    }

    function place(side) {
      var res = KH.market.deal(side, i.sym, current.qty);
      if (!res.ok) { KH.app.toast('Order rejected', res.reason, 'alert'); return; }
      KH.sound.play('trade');
      var q = res.quote;
      KH.app.toast((side === 'buy' ? 'Bought ' : 'Sold ') + fmt.group(q.qty, 0) + ' ' + i.sym,
        (side === 'buy' ? 'Debited ' : 'Credited ') + fmt.money(q.net), 'check');
      renderQuote(); renderTicket(); renderScreen();
      KH.bus.emit('portfolio:changed');
    }

    KH.dom.fill(el.ticket, [
      ownNow > 0 ? h('div', { class: 'callout ' + (ownNow >= KH.sim.CONTROL ? 'good' : ''), style: { margin: '0 0 4px' } }, [
        icon(ownNow >= KH.sim.CONTROL ? 'check' : 'info'),
        h('span', { text: ownNow >= KH.sim.CONTROL
          ? 'Controlled. Manage it from Holdings.'
          : (ownNow * 100).toFixed(2) + '% held. Control needs ' + fmt.group(ctrl.need, 0) + ' more, about ' + fmt.money(ctrl.cost, 0) + '.' })
      ]) : null,
      h('div', {}, [
        h('span', { class: 'lbl', text: 'Quantity' }),
        h('div', { class: 'qty-row' }, [
          qtyInput,
          h('button', { class: 'btn sm', type: 'button', text: '×2',
            onclick: function () { current.qty = Math.max(1, current.qty * 2); qtyInput.value = String(current.qty); updateSummary(); } }),
          h('button', { class: 'btn sm', type: 'button', text: '50%', title: 'Enough to take control',
            onclick: function () { current.qty = Math.max(1, ctrl.need || 1); qtyInput.value = String(current.qty); updateSummary(); } })
        ])
      ]),
      h('div', { style: { display: 'flex', gap: '5px', flexWrap: 'wrap' } }, [100, 1000, 10000, 100000].map(function (n) {
        return h('button', { class: 'btn sm ghost', type: 'button', text: fmt.shortNum(n),
          onclick: function () { current.qty = n; qtyInput.value = String(n); updateSummary(); } });
      })),
      summary,
      h('div', { class: 'order-buttons' }, [
        h('button', { class: 'btn buy', type: 'button', text: 'Buy', onclick: function () { place('buy'); } }),
        h('button', { class: 'btn sell', type: 'button', text: 'Sell', onclick: function () { place('sell'); } })
      ]),
      h('div', { style: { fontSize: 'var(--type-micro)', color: 'var(--text-muted)', lineHeight: '1.45' },
        text: 'Settled cash ' + fmt.money(KH.game.get().treasury.cash, 0) + '. Commission, stamp duty and levy are charged on both sides.' })
    ]);
    updateSummary();
  }

  /* ============================================================
     Depth
     ============================================================ */

  function renderDepth() {
    if (!el.depth) return;
    var d = KH.market.depth(current.sym);
    var maxQty = Math.max.apply(null, d.bids.concat(d.asks).map(function (l) { return l.qty; }));
    if (el.spreadChip) el.spreadChip.textContent = 'Spread ' + d.spread.toFixed(2) + 'p';

    KH.dom.fill(el.depth, [
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
    activate: function () { renderScreen(); renderQuote(); renderTicket(); renderDepth(); drawChart(); },
    tick: function (payload) {
      if (!el.screenBody) return;
      if (el.sessionChip) {
        el.sessionChip.textContent = payload.session.label;
        el.sessionChip.className = 'chip status' + (payload.session.open ? ' live' : '');
      }
      if (current.tab === 'screen') updateScreen();
      updateQuote();
      if (++ticks % 4 === 0 && current.mode === 'intraday') drawChart();
      if (ticks % 12 === 0) { renderDepth(); if (current.tab !== 'screen') renderScreen(); }
    },
    refresh: function () { if (el.screenBody) { renderScreen(); renderQuote(); renderTicket(); } }
  };
})(window.KH);

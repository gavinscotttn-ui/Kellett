/* ============================================================
   Overview — the single screen that answers "where does the
   group stand" without anybody having to click anything.
   ============================================================ */

(function (KH) {
  'use strict';

  var h = KH.dom.h, icon = KH.dom.icon, fmt = KH.fmt;

  var ENGAGEMENTS = [
    { at: '08:30', what: 'Treasury stand-up', who: 'Adaeze Okonjo · Room 4', slot: 0 },
    { at: '09:45', what: 'Project NIGHTINGALE — pre-committee read', who: 'Sir Tarquin Fitzwilliam-Smythe', slot: 1 },
    { at: '11:15', what: 'Caverton DC-04 — utilisation review', who: 'Operations · dial-in', slot: 2 },
    { at: '12:30', what: 'Lunch — Meridian Partners', who: 'Renée Vasquez · The Ninth', slot: 3 },
    { at: '14:00', what: 'Group risk committee', who: 'Dr. Evelyn Sterling · Boardroom', slot: 4 },
    { at: '15:30', what: 'Syndicate call — RCF pricing', who: 'Six lenders · secure bridge', slot: 5 },
    { at: '18:00', what: 'Board committee — NIGHTINGALE', who: 'Full board · Boardroom', slot: 6 }
  ];

  var FEED = [
    { mins: 3, text: 'Settlement confirmed', tail: ' — Northbank reference NB-8841204' },
    { mins: 11, text: 'Board pack v14 circulated', tail: ' — awaiting your signature on schedule 4' },
    { mins: 24, text: 'Valuation refreshed', tail: ' — Caverton Data Campus DC-04, +2.4% on the quarter' },
    { mins: 41, text: 'Covenant test passed', tail: ' — net leverage 2.1x against a 3.5x limit' },
    { mins: 58, text: 'Environmental report filed', tail: ' — Meridian Offshore Block 12, no material findings' },
    { mins: 96, text: 'Facility drawn', tail: ' — £12.0m under the revolving credit facility' },
    { mins: 140, text: 'Insurance renewed', tail: ' — marine and aviation lines, twelve-month term' },
    { mins: 190, text: 'Dividend declared', tail: ' — Panthera Fund IV, distribution to follow' }
  ];

  var el = {};
  var range = 36;

  function greeting() {
    var hr = new Date().getHours();
    if (hr < 12) return 'Good morning';
    if (hr < 18) return 'Good afternoon';
    return 'Good evening';
  }

  function mount(root) {
    var profile = KH.store.get('profile');
    var firstName = fmt.firstName(profile.name) || 'there';

    el.headline = h('h1', { text: greeting() + ', ' + firstName });

    root.appendChild(h('div', { class: 'view-head' }, [
      h('div', { class: 'titles' }, [
        h('div', { class: 'eyebrow', text: fmt.longDate(new Date()) }),
        el.headline
      ]),
      h('div', { class: 'spacer' }),
      h('div', { class: 'actions' }, [
        el.sessionChip = h('span', { class: 'chip', text: 'Markets loading' }),
        h('button', { class: 'btn', type: 'button', onclick: function () { KH.app.toast('Position refreshed', 'All lines revalued against the latest marks.'); refresh(); } }, [
          icon('refresh'), h('span', { text: 'Refresh' })
        ])
      ])
    ]));

    var body = h('div', { class: 'view-body scroll' });
    root.appendChild(body);

    el.tiles = h('div', { class: 'tiles', style: { marginBottom: '10px' } });
    body.appendChild(el.tiles);

    var grid = h('div', { class: 'overview-grid' });
    body.appendChild(grid);

    /* ---- Group position over time ---- */
    el.posChart = h('div', { style: { height: '236px' } });
    grid.appendChild(h('div', { class: 'panel span-8' }, [
      h('div', { class: 'panel-head' }, [
        h('h2', { text: 'Group net position' }),
        h('span', { class: 'sub', text: 'Monthly' }),
        h('div', { class: 'spacer' }),
        el.rangeCtl = h('div', { class: 'segmented', role: 'group', 'aria-label': 'Period' }, [12, 24, 36].map(function (n) {
          return h('button', {
            type: 'button', 'aria-pressed': n === range ? 'true' : 'false',
            text: n + 'm',
            onclick: function () { range = n; drawPosition(); syncRange(); }
          });
        }))
      ]),
      h('div', { class: 'panel-body' }, el.posChart)
    ]));

    /* ---- Allocation ---- */
    el.donut = h('div', { style: { height: '150px' } });
    el.donutLegend = h('div', { style: { marginTop: '10px' } });
    grid.appendChild(h('div', { class: 'panel span-4' }, [
      h('div', { class: 'panel-head' }, [h('h2', { text: 'Allocation by class' }), h('span', { class: 'sub', text: 'Share of register' })]),
      h('div', { class: 'panel-body' }, [el.donut, el.donutLegend])
    ]));

    /* ---- Engagements ---- */
    grid.appendChild(h('div', { class: 'panel span-4' }, [
      h('div', { class: 'panel-head' }, [h('h2', { text: 'Today’s engagements' }), h('div', { class: 'spacer' }), icon('calendar', 'sub')]),
      h('div', { class: 'agenda' }, ENGAGEMENTS.map(function (e) {
        return h('div', { class: 'agenda-item' }, [
          h('span', { class: 'time', text: e.at }),
          h('span', { class: 'rail', style: { background: KH.charts.seriesColor(e.slot) } }),
          h('span', { class: 'what' }, [h('b', { text: e.what }), h('span', { text: e.who })])
        ]);
      }))
    ]));

    /* ---- Correspondence requiring attention ---- */
    el.attention = h('div', { class: 'rows' });
    grid.appendChild(h('div', { class: 'panel span-4' }, [
      h('div', { class: 'panel-head' }, [
        h('h2', { text: 'Requires your attention' }), h('div', { class: 'spacer' }),
        h('button', { class: 'btn sm ghost', type: 'button', text: 'Open mail', onclick: function () { KH.app.go('mail'); } })
      ]),
      el.attention
    ]));

    /* ---- Movers ---- */
    el.movers = h('div', { class: 'rows' });
    grid.appendChild(h('div', { class: 'panel span-4' }, [
      h('div', { class: 'panel-head' }, [
        h('h2', { text: 'Session movers' }), h('div', { class: 'spacer' }),
        h('button', { class: 'btn sm ghost', type: 'button', text: 'Open markets', onclick: function () { KH.app.go('markets'); } })
      ]),
      el.movers
    ]));

    /* ---- Activity ---- */
    grid.appendChild(h('div', { class: 'panel span-12' }, [
      h('div', { class: 'panel-head' }, [h('h2', { text: 'Group activity' }), h('span', { class: 'sub', text: 'Last 24 hours' })]),
      h('div', { class: 'feed' }, FEED.map(function (f) {
        return h('div', { class: 'feed-item' }, [
          h('span', { class: 'ts', text: fmt.time(Date.now() - f.mins * 60000) }),
          h('span', { class: 'txt' }, [h('b', { text: f.text }), f.tail])
        ]);
      }))
    ]));

    KH.dom.onResize(body, function () { drawPosition(); drawDonut(); });
    refresh();
  }

  function syncRange() {
    KH.dom.$$('button', el.rangeCtl).forEach(function (b) {
      b.setAttribute('aria-pressed', b.textContent === range + 'm' ? 'true' : 'false');
    });
  }

  function drawPosition() {
    if (!el.posChart) return;
    var hist = KH.assets.groupHistory().slice(-range);
    var p = KH.market.portfolio();
    // The register plus the dealing account, marked to the current tape.
    var series = hist.map(function (pt, i) {
      var weight = i === hist.length - 1 ? p.total : p.total * (0.86 + (i / hist.length) * 0.14);
      return { t: pt.t, v: pt.v + weight };
    });
    KH.charts.timeSeries(el.posChart, {
      series: [{ name: 'Group net position', points: series, color: 'var(--s1)' }],
      area: true,
      yFormat: fmt.moneyShort,
      tipFormat: function (v) { return fmt.money(v, 0); },
      xFormat: function (t) { return new Date(t).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }); },
      ariaLabel: 'Group net position over the last ' + range + ' months'
    });
  }

  function drawDonut() {
    if (!el.donut) return;
    var slices = KH.assets.byClass();
    var top = slices.slice(0, 6);
    var rest = slices.slice(6);
    if (rest.length) {
      top.push({ label: 'Other (' + rest.length + ')', value: KH.util.sum(rest, function (s) { return s.value; }), color: 'var(--text-muted)' });
    }
    KH.charts.donut(el.donut, top, {
      format: fmt.moneyShort,
      centreTop: fmt.moneyShort(KH.assets.total()),
      centreBottom: 'Register',
      ariaLabel: 'Register split by asset class'
    });
    KH.dom.fill(el.donutLegend, KH.charts.legend(top, fmt.moneyShort));
  }

  function drawTiles() {
    var p = KH.market.portfolio();
    var reg = KH.assets.total();
    var regCost = KH.assets.cost();
    var net = reg + p.total;
    var unread = KH.mail.messages.filter(function (m) { return KH.app.isUnread(m); }).length;

    var tiles = [
      { k: 'Group net position', v: fmt.moneyShort(net), d: ((reg - regCost) / regCost) * 100, f: 'Register and dealing account' },
      { k: 'Assets under management', v: fmt.moneyShort(reg), d: null, f: KH.assets.register.length + ' directly held positions' },
      { k: 'Dealing account', v: fmt.moneyShort(p.total), d: p.pnlPct, f: fmt.money(p.cash, 0) + ' uninvested' },
      { k: 'Unrealised on positions', v: fmt.signedShort(p.pnl), d: p.pnlPct, f: p.positions.length + ' open lines' },
      { k: 'Correspondence', v: String(unread), d: null, f: unread === 1 ? 'item awaiting you' : 'items awaiting you' }
    ];

    KH.dom.fill(el.tiles, tiles.map(function (t) {
      return h('div', { class: 'stat' }, [
        h('div', { class: 'k', text: t.k }),
        h('div', { class: 'v', text: t.v }),
        h('div', { class: 'f' }, [
          t.d === null || !isFinite(t.d) ? null : h('span', { class: 'delta ' + fmt.dir(t.d) }, [
            h('span', { class: 'arrow', text: fmt.arrow(t.d), 'aria-hidden': 'true' }),
            h('span', { text: fmt.pct(t.d) })
          ]),
          h('span', { text: t.f })
        ])
      ]);
    }));
  }

  function drawAttention() {
    var items = KH.mail.messages
      .filter(function (m) { return KH.app.isUnread(m) && m.folder !== 'sent' && m.folder !== 'drafts'; })
      .sort(function (a, b) { return (b.priority ? 1 : 0) - (a.priority ? 1 : 0) || b.when - a.when; })
      .slice(0, 5);

    if (!items.length) {
      KH.dom.fill(el.attention, h('div', { class: 'empty' }, [icon('check'), h('span', { text: 'Nothing outstanding' })]));
      return;
    }

    KH.dom.fill(el.attention, items.map(function (m) {
      var p = KH.people.get(m.from);
      return h('button', {
        class: 'row unread', type: 'button',
        onclick: function () { KH.app.go('mail'); KH.views.mail.open(m.id); }
      }, [
        h('span', { class: 'avatar sm', style: { background: p.color }, text: p.initials, 'aria-hidden': 'true' }),
        h('span', { class: 'main' }, [
          h('span', { class: 'line1' }, [h('b', { text: p.name }), h('span', { class: 'when', text: fmt.whenShort(m.when) })]),
          h('span', { class: 'line2', text: m.subject })
        ]),
        m.priority ? h('span', { class: 'chip hot', text: 'Priority' }) : null
      ]);
    }));
  }

  function drawMovers() {
    var book = KH.market.book().slice().map(function (i) {
      return { inst: i, ch: KH.market.change(i) };
    }).sort(function (a, b) { return Math.abs(b.ch.pct) - Math.abs(a.ch.pct); }).slice(0, 5);

    KH.dom.fill(el.movers, book.map(function (r) {
      return h('button', {
        class: 'row', type: 'button',
        onclick: function () { KH.app.go('markets'); KH.views.markets.select(r.inst.sym); }
      }, [
        h('span', { class: 'main' }, [
          h('span', { class: 'line1' }, [h('b', { text: r.inst.sym }), h('span', { class: 'when', text: fmt.group(r.inst.px, 2) + 'p' })]),
          h('span', { class: 'line2', text: r.inst.name })
        ]),
        h('span', { class: 'delta ' + fmt.dir(r.ch.pct) }, [
          h('span', { class: 'arrow', text: fmt.arrow(r.ch.pct), 'aria-hidden': 'true' }),
          h('span', { text: fmt.pct(r.ch.pct) })
        ])
      ]);
    }));
  }

  function refresh() {
    if (!el.tiles) return;
    var profile = KH.store.get('profile');
    var firstName = fmt.firstName(profile.name) || 'there';
    el.headline.textContent = greeting() + ', ' + firstName;
    drawTiles(); drawPosition(); drawDonut(); drawAttention(); drawMovers(); syncRange();
  }

  var tickCount = 0;

  KH.views = KH.views || {};
  KH.views.overview = {
    id: 'overview', label: 'Overview', icon: 'grid',
    mount: mount,
    activate: refresh,
    tick: function (payload) {
      if (!el.tiles) return;
      if (el.sessionChip) {
        el.sessionChip.textContent = payload.session.label;
        el.sessionChip.className = 'chip ' + (payload.session.open ? 'good' : '');
      }
      if (++tickCount % 4 === 0) { drawTiles(); drawMovers(); }
    },
    refresh: refresh
  };
})(window.KH);

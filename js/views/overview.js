/* ============================================================
   Command — where the group stands, what it is doing, and the
   one thing that most needs doing next.
   ============================================================ */

(function (KH) {
  'use strict';

  var h = KH.dom.h, icon = KH.dom.icon, fmt = KH.fmt;
  var el = {};

  var PACE_LABEL = { paused: 'Paused', slow: 'Slow', normal: 'Normal', fast: 'Fast', rapid: 'Rapid' };

  function greeting() {
    var hr = new Date().getHours();
    return hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  }

  function mount(root) {
    var profile = KH.store.get('profile');

    el.headline = h('h1', { text: greeting() + ', ' + (fmt.firstName(profile.name) || 'there') });

    root.appendChild(h('div', { class: 'view-head' }, [
      h('div', { class: 'titles' }, [
        el.clock = h('div', { class: 'eyebrow' }),
        el.headline
      ]),
      h('div', { class: 'spacer' }),
      h('div', { class: 'actions' }, [
        el.paceChip = h('span', { class: 'chip' }),
        h('button', {
          class: 'btn', type: 'button', title: 'Advance the simulation by one week',
          onclick: function () { KH.clock.advance(true); KH.sound.play('week'); refresh(); }
        }, [icon('clock'), h('span', { text: 'Advance week' })]),
        h('button', {
          class: 'btn', type: 'button',
          onclick: function () { KH.reports.groupPosition(); KH.app.toast('Report exported', 'Group position saved as a PDF.', 'check'); }
        }, [icon('download'), h('span', { text: 'Position report' })])
      ])
    ]));

    var body = h('div', { class: 'view-body scroll' });
    root.appendChild(body);

    el.tiles = h('div', { class: 'tiles', style: { marginBottom: '10px' } });
    body.appendChild(el.tiles);

    var grid = h('div', { class: 'overview-grid' });
    body.appendChild(grid);

    el.action = h('div', { class: 'span-12' });
    grid.appendChild(el.action);

    el.chart = h('div', { style: { height: '220px' } });
    grid.appendChild(h('div', { class: 'panel span-8' }, [
      h('div', { class: 'panel-head' }, [h('h2', { text: 'Group net worth' }), h('span', { class: 'sub', text: 'Weekly' }),
        h('div', { class: 'spacer' }), el.worthChip = h('span', { class: 'chip accent' })]),
      h('div', { class: 'panel-body' }, el.chart)
    ]));

    el.mix = h('div', { style: { height: '150px' } });
    el.mixLegend = h('div', { style: { marginTop: '10px' } });
    grid.appendChild(h('div', { class: 'panel span-4' }, [
      h('div', { class: 'panel-head' }, [h('h2', { text: 'Where it sits' }), h('span', { class: 'sub', text: 'By class' })]),
      h('div', { class: 'panel-body' }, [el.mix, el.mixLegend])
    ]));

    el.flow = h('div', { class: 'panel-body' });
    grid.appendChild(h('div', { class: 'panel span-4' }, [
      h('div', { class: 'panel-head' }, [h('h2', { text: 'Weekly cash flow' }), h('div', { class: 'spacer' }), el.flowChip = h('span', { class: 'chip' })]),
      el.flow
    ]));

    el.standing = h('div', { class: 'panel-body' });
    grid.appendChild(h('div', { class: 'panel span-4' }, [
      h('div', { class: 'panel-head' }, [h('h2', { text: 'Standing' }), h('span', { class: 'sub', text: 'How you are seen' })]),
      el.standing
    ]));

    el.holdings = h('div', { class: 'rows' });
    grid.appendChild(h('div', { class: 'panel span-4' }, [
      h('div', { class: 'panel-head' }, [h('h2', { text: 'Largest holdings' }), h('div', { class: 'spacer' }),
        h('button', { class: 'btn sm ghost', type: 'button', text: 'Empire', onclick: function () { KH.app.go('empire'); } })]),
      el.holdings
    ]));

    el.news = h('div', { class: 'feed' });
    grid.appendChild(h('div', { class: 'panel span-8' }, [
      h('div', { class: 'panel-head' }, [h('h2', { text: 'Group news' }), h('span', { class: 'sub', text: 'Most recent first' })]),
      el.news
    ]));

    el.attention = h('div', { class: 'rows' });
    grid.appendChild(h('div', { class: 'panel span-4' }, [
      h('div', { class: 'panel-head' }, [h('h2', { text: 'Requires your attention' }), h('div', { class: 'spacer' }),
        h('button', { class: 'btn sm ghost', type: 'button', text: 'Mail', onclick: function () { KH.app.go('mail'); } })]),
      el.attention
    ]));

    KH.dom.onResize(body, function () { drawChart(); drawMix(); });
    refresh();
  }

  function refresh() {
    if (!el.tiles) return;
    var g = KH.game.get();
    var profile = KH.store.get('profile');
    el.headline.textContent = greeting() + ', ' + (fmt.firstName(profile.name) || 'there');
    el.clock.textContent = 'Week ' + g.clock.week + ' · Year ' + g.clock.year + ' · Q' + g.clock.quarter +
      ' · ' + fmt.longDate(new Date());
    if (el.paceChip) {
      el.paceChip.textContent = 'Time: ' + (PACE_LABEL[KH.clock.pace()] || 'Normal');
      el.paceChip.className = 'chip ' + (KH.clock.pace() === 'paused' ? 'warn' : 'good');
    }
    drawTiles(); drawAction(); drawChart(); drawMix(); drawFlow(); drawStanding(); drawHoldings(); drawNews(); drawAttention();
  }

  function drawTiles() {
    var g = KH.game.get();
    var w = KH.sim.netWorth();
    var f = KH.mike.weeklyFlow();
    var controlled = Object.keys(g.corps).filter(function (s) { return KH.sim.controls(s); }).length;
    var unread = KH.views.mail.badge();

    KH.dom.fill(el.tiles, [
      tile('Group net worth', fmt.moneyShort(w.total), null, g.stats.peakNetWorth ? 'Peak ' + fmt.moneyShort(g.stats.peakNetWorth) : ''),
      tile('Settled cash', fmt.moneyShort(w.cash), w.cash < 0 ? 'down' : null, w.debt ? 'State debt ' + fmt.moneyShort(w.debt) : 'No state debt'),
      tile('Weekly flow', fmt.signedShort(f.net), f.net >= 0 ? 'up' : 'down', fmt.moneyShort(f.income) + ' in'),
      tile('Companies', String(Object.keys(g.corps).length), null, controlled + ' controlled'),
      tile('Property', String(g.props.length), null, fmt.moneyShort(w.property)),
      tile('Correspondence', String(unread), null, unread === 1 ? 'item waiting' : 'items waiting')
    ]);
  }

  function tile(k, v, dir, foot) {
    return h('div', { class: 'stat' }, [
      h('div', { class: 'k', text: k }),
      h('div', { class: 'v' + (dir ? ' delta ' + dir : ''), text: v }),
      foot ? h('div', { class: 'f' }, h('span', { text: foot })) : null
    ]);
  }

  function drawAction() {
    var g = KH.game.get();
    var step = KH.mike.nextStep();
    var urgent = g.treasury.cash < 0;
    KH.dom.fill(el.action, h('div', { class: 'action-bar' + (urgent ? ' urgent' : '') }, [
      icon(urgent ? 'alert' : 'info'),
      h('div', { class: 'action-body' }, [
        h('b', { text: urgent ? 'The group is overdrawn' : 'Recommended next step' }),
        h('span', { text: step })
      ]),
      h('button', {
        class: 'btn sm', type: 'button', text: 'Ask Mike',
        onclick: function () { KH.app.go('messages'); KH.views.messages.open('mike'); }
      })
    ]));
  }

  function drawChart() {
    if (!el.chart) return;
    var g = KH.game.get();
    var pts = g.history.slice(-120);
    if (pts.length < 2) {
      KH.dom.fill(el.chart, h('div', { class: 'empty' }, [icon('chart'),
        h('span', { text: 'The series builds one point per simulated week. Advance the week, or let time run.' })]));
      if (el.worthChip) el.worthChip.textContent = fmt.moneyShort(KH.sim.netWorth().total);
      return;
    }
    var first = pts[0].total;
    var last = pts[pts.length - 1].total;
    if (el.worthChip) {
      el.worthChip.textContent = fmt.pct(((last - first) / Math.abs(first || 1)) * 100, 1) + ' over ' + pts.length + ' weeks';
    }
    KH.charts.timeSeries(el.chart, {
      series: [{ name: 'Net worth', points: pts.map(function (p) { return { t: p.w, v: p.total }; }), color: 'var(--s1)' }],
      area: true,
      yFormat: fmt.moneyShort,
      tipFormat: function (v) { return fmt.money(v, 0); },
      xFormat: function (t) { return 'Wk ' + t; },
      ariaLabel: 'Group net worth by week'
    });
  }

  function drawMix() {
    if (!el.mix) return;
    var w = KH.sim.netWorth();
    var slices = [
      { label: 'Listed equity', value: Math.max(0, w.equity) },
      { label: 'Asset register', value: Math.max(0, w.register) },
      { label: 'Property', value: Math.max(0, w.property) },
      { label: 'Cash', value: Math.max(0, w.cash) },
      { label: 'Personal', value: Math.max(0, w.toys) }
    ].filter(function (s) { return s.value > 0; });
    if (!slices.length) { KH.dom.fill(el.mix, h('div', { class: 'empty', text: 'Nothing to show yet' })); return; }
    KH.charts.donut(el.mix, slices, {
      format: fmt.moneyShort,
      centreTop: fmt.moneyShort(w.total),
      centreBottom: 'Net worth',
      ariaLabel: 'Net worth by asset class'
    });
    KH.dom.fill(el.mixLegend, KH.charts.legend(slices, fmt.moneyShort));
  }

  function drawFlow() {
    var f = KH.mike.weeklyFlow();
    if (el.flowChip) {
      el.flowChip.textContent = fmt.signed(f.net, 0) + ' / wk';
      el.flowChip.className = 'chip ' + (f.net >= 0 ? 'good' : 'warn');
    }
    var rows = f.detail.slice(0, 7);
    KH.dom.fill(el.flow, rows.length ? [
      h('div', { class: 'flow-list' }, rows.map(function (d) {
        return h('div', { class: 'flow-row' }, [
          h('span', { class: 'flow-what', text: d.what }),
          h('span', { class: 'delta ' + fmt.dir(d.amount) }, [
            h('span', { class: 'arrow', text: fmt.arrow(d.amount), 'aria-hidden': 'true' }),
            h('span', { text: fmt.signed(d.amount, 0) })
          ])
        ]);
      }))
    ] : h('div', { class: 'empty', text: 'No recurring income or costs yet.' }));
  }

  function drawStanding() {
    var g = KH.game.get();
    var bars = [
      { k: 'Reputation', v: g.standing.reputation, good: true, note: 'How the market reads you' },
      { k: 'Regulatory scrutiny', v: g.standing.scrutiny, good: false, note: 'How closely you are watched' },
      { k: 'Prestige', v: Math.min(100, g.standing.prestige), good: true, note: 'What the toys buy you' }
    ];
    KH.dom.fill(el.standing, bars.map(function (b) {
      var colour = b.good ? (b.v > 66 ? 'var(--up)' : b.v > 33 ? 'var(--warn)' : 'var(--down)')
                          : (b.v < 33 ? 'var(--up)' : b.v < 66 ? 'var(--warn)' : 'var(--down)');
      return h('div', { class: 'standing-row' }, [
        h('div', { class: 'standing-top' }, [h('span', { text: b.k }), h('b', { class: 'num', text: String(Math.round(b.v)) })]),
        h('div', { class: 'meter' }, h('i', { style: { width: KH.util.clamp(b.v, 0, 100) + '%', background: colour } })),
        h('span', { class: 'standing-note', text: b.note })
      ]);
    }));
  }

  function drawHoldings() {
    var pos = KH.market.positions().slice(0, 6);
    if (!pos.length) {
      KH.dom.fill(el.holdings, h('div', { class: 'empty' }, [icon('briefcase'),
        h('span', { text: 'No holdings. Buy a stake on the Markets desk.' })]));
      return;
    }
    KH.dom.fill(el.holdings, pos.map(function (p) {
      var score = KH.sim.turnaroundScore(p.sym);
      return h('button', {
        class: 'row', type: 'button',
        onclick: function () { KH.app.go('empire'); KH.views.empire.select(p.sym); }
      }, [
        h('span', { class: 'main' }, [
          h('span', { class: 'line1' }, [h('b', { text: p.sym }), h('span', { class: 'when', text: fmt.moneyShort(p.value) })]),
          h('span', { class: 'line2', text: p.name + ' · ' + (p.own * 100).toFixed(1) + '%' })
        ]),
        h('span', { class: 'score-pill ' + (score <= 0 ? 'doomed' : score < 35 ? 'hard' : score < 65 ? 'fair' : 'good'), text: String(score) })
      ]);
    }));
  }

  function drawNews() {
    var g = KH.game.get();
    var items = g.news.slice(0, 9);
    if (!items.length) {
      KH.dom.fill(el.news, h('div', { class: 'empty', text: 'Nothing has happened yet. Advance a week.' }));
      return;
    }
    KH.dom.fill(el.news, items.map(function (n) {
      return h('div', { class: 'feed-item' }, [
        h('span', { class: 'ts', text: 'W' + n.week }),
        h('span', { class: 'txt' }, [
          h('b', { class: n.tone === 'good' ? 'tone-good' : n.tone === 'bad' ? 'tone-bad' : '', text: n.head }),
          n.body ? ' — ' + n.body : ''
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
        m.choices && KH.game.get().inbox.handled[m.id] === undefined ? h('span', { class: 'chip warn tiny', text: 'Reply' }) : null
      ]);
    }));
  }

  KH.views = KH.views || {};
  KH.views.overview = {
    id: 'overview', label: 'Command', icon: 'grid',
    mount: mount, activate: refresh, refresh: refresh,
    tick: function () {}
  };
})(window.KH);

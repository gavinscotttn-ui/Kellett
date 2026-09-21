/* ============================================================
   Overview — the executive summary.

   Three questions, answered above the fold: where the group
   stands, what is wrong with it, and what to do next.
   ============================================================ */

(function (KH) {
  'use strict';

  var h = KH.dom.h, icon = KH.dom.icon, fmt = KH.fmt;
  var el = {};

  var PACES = [
    { id: 'paused', glyph: '‖', title: 'Paused' },
    { id: 'slow', glyph: '▶', title: 'Slow — a week every 45 seconds' },
    { id: 'normal', glyph: '▶▶', title: 'Normal — a week every 24 seconds' },
    { id: 'fast', glyph: '▶▶▶', title: 'Fast — a week every 12 seconds' },
    { id: 'rapid', glyph: '▶▶▶▶', title: 'Rapid — a week every 6 seconds' }
  ];

  function mount(root) {
    root.appendChild(h('div', { class: 'view-head' }, [
      h('div', { class: 'titles' }, [
        h('div', { class: 'eyebrow', text: 'Executive summary' }),
        el.headline = h('h1', { text: 'Overview' })
      ]),
      h('div', { class: 'spacer' }),
      h('div', { class: 'actions' }, [
        el.period = h('div', { class: 'period-bar' }),
        el.paceGroup = h('div', { class: 'pace-control', role: 'group', 'aria-label': 'Speed of time' },
          PACES.map(function (p) {
            return h('button', {
              type: 'button', class: 'pace-btn', title: p.title, 'aria-label': p.title,
              'aria-pressed': 'false', text: p.glyph, dataset: { pace: p.id },
              onclick: function () {
                KH.clock.setPace(p.id);
                KH.store.set('workspace', { simPace: p.id });
                KH.sound.play('click');
                syncPace();
              }
            });
          })),
        h('button', {
          class: 'btn', type: 'button', title: 'Settle one week and move on',
          onclick: function () { KH.clock.advance(true); KH.sound.play('week'); refresh(); }
        }, [icon('clock'), h('span', { text: 'Advance period' })]),
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

    /* ---- Operating plan ---- */
    el.plan = h('div', { class: 'panel-body flush' });
    el.planMeter = h('div', { class: 'plan-meter' });
    grid.appendChild(h('div', { class: 'panel span-7' }, [
      h('div', { class: 'panel-head' }, [
        h('h2', { text: 'Operating plan' }),
        h('div', { class: 'spacer' }),
        el.planChip = h('span', { class: 'chip' })
      ]),
      el.planMeter,
      el.plan
    ]));

    /* ---- Matters arising ---- */
    el.issues = h('div', { class: 'panel-body flush' });
    grid.appendChild(h('div', { class: 'panel span-5' }, [
      h('div', { class: 'panel-head' }, [
        h('h2', { text: 'Matters arising' }),
        h('div', { class: 'spacer' }),
        el.issueChip = h('span', { class: 'chip' })
      ]),
      el.issues
    ]));

    /* ---- Net worth ---- */
    el.chart = h('div', { style: { height: '210px' } });
    grid.appendChild(h('div', { class: 'panel span-8' }, [
      h('div', { class: 'panel-head' }, [h('h2', { text: 'Group net worth' }), h('span', { class: 'sub', text: 'Per period' }),
        h('div', { class: 'spacer' }), el.worthChip = h('span', { class: 'chip' })]),
      h('div', { class: 'panel-body' }, el.chart)
    ]));

    /* ---- Composition ---- */
    el.mix = h('div', { style: { height: '146px' } });
    el.mixLegend = h('div', { style: { marginTop: '10px' } });
    grid.appendChild(h('div', { class: 'panel span-4' }, [
      h('div', { class: 'panel-head' }, [h('h2', { text: 'Composition' }), h('span', { class: 'sub', text: 'By class' })]),
      h('div', { class: 'panel-body' }, [el.mix, el.mixLegend])
    ]));

    /* ---- Weekly result ---- */
    el.flow = h('div', { class: 'panel-body' });
    grid.appendChild(h('div', { class: 'panel span-4' }, [
      h('div', { class: 'panel-head' }, [h('h2', { text: 'Period result' }), h('div', { class: 'spacer' }), el.flowChip = h('span', { class: 'chip' })]),
      el.flow
    ]));

    /* ---- Standing ---- */
    el.standing = h('div', { class: 'panel-body' });
    grid.appendChild(h('div', { class: 'panel span-4' }, [
      h('div', { class: 'panel-head' }, [h('h2', { text: 'Standing' }), h('div', { class: 'spacer' }), el.gradeChip = h('span', { class: 'chip' })]),
      el.standing
    ]));

    /* ---- Holdings ---- */
    el.holdings = h('div', { class: 'rows' });
    grid.appendChild(h('div', { class: 'panel span-4' }, [
      h('div', { class: 'panel-head' }, [h('h2', { text: 'Principal holdings' }), h('div', { class: 'spacer' }),
        h('button', { class: 'btn sm ghost', type: 'button', text: 'All holdings', onclick: function () { KH.app.go('empire'); } })]),
      el.holdings
    ]));

    /* ---- News ---- */
    el.news = h('div', { class: 'feed' });
    grid.appendChild(h('div', { class: 'panel span-12' }, [
      h('div', { class: 'panel-head' }, [h('h2', { text: 'Group wire' }), h('span', { class: 'sub', text: 'Most recent first' })]),
      el.news
    ]));

    KH.dom.onResize(body, function () { drawChart(); drawMix(); });
    refresh();
  }

  function syncPace() {
    if (!el.paceGroup) return;
    var now = KH.clock.pace();
    KH.dom.$$('.pace-btn', el.paceGroup).forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.pace === now ? 'true' : 'false');
    });
  }

  function refresh() {
    if (!el.tiles) return;
    var g = KH.game.get();
    var p = KH.store.get('profile');
    el.headline.textContent = 'Overview — ' + (p.company || 'Kellett Holdings');
    KH.dom.fill(el.period, [
      h('span', { class: 'period-seg' }, [h('b', { text: 'FY' + g.clock.year }), h('span', { text: 'Year' })]),
      h('span', { class: 'period-seg' }, [h('b', { text: 'Q' + g.clock.quarter }), h('span', { text: 'Quarter' })]),
      h('span', { class: 'period-seg' }, [h('b', { text: 'WK' + g.clock.week }), h('span', { text: 'Week' })])
    ]);
    syncPace();
    drawTiles(); drawPlan(); drawIssues(); drawChart(); drawMix(); drawFlow(); drawStanding(); drawHoldings(); drawNews();
  }

  function drawTiles() {
    var g = KH.game.get();
    var w = KH.sim.netWorth();
    var f = KH.mike.weeklyFlow();
    var r = KH.sim.creditRating();
    var controlled = Object.keys(g.corps).filter(function (s) { return KH.sim.controls(s); }).length;

    KH.dom.fill(el.tiles, [
      tile('Group net worth', fmt.moneyShort(w.total), null, g.stats.peakNetWorth ? 'Peak ' + fmt.moneyShort(g.stats.peakNetWorth) : ''),
      tile('Settled cash', fmt.moneyShort(w.cash), w.cash < 0 ? 'down' : null, w.debt ? 'State debt ' + fmt.moneyShort(w.debt) : 'No state debt'),
      tile('Period result', fmt.signedShort(f.net), f.net >= 0 ? 'up' : 'down', fmt.moneyShort(f.income) + ' income'),
      tile('Credit rating', r.grade, null, r.note),
      tile('Companies', String(Object.keys(g.corps).length), null, controlled + ' controlled'),
      tile('Property', String(g.props.length), null, fmt.moneyShort(w.property))
    ]);
  }

  function tile(k, v, dir, foot) {
    return h('div', { class: 'stat' }, [
      h('div', { class: 'k', text: k }),
      h('div', { class: 'v' + (dir ? ' delta ' + dir : ''), text: v }),
      foot ? h('div', { class: 'f' }, h('span', { text: foot })) : null
    ]);
  }

  /* ---------- The plan ---------- */

  function drawPlan() {
    var prog = KH.flow.progress();
    if (el.planChip) el.planChip.textContent = prog.done + ' of ' + prog.total + ' complete';

    KH.dom.fill(el.planMeter, h('div', { class: 'plan-track', role: 'img',
      'aria-label': prog.done + ' of ' + prog.total + ' stages complete' },
      prog.stages.map(function (s) {
        return h('span', { class: 'plan-pip' + (s.done ? ' done' : ''), title: s.label });
      })));

    var next = prog.stages.filter(function (s) { return !s.done; }).slice(0, 3);
    if (!next.length) {
      KH.dom.fill(el.plan, h('div', { class: 'empty' }, [icon('check'),
        h('span', { text: 'Every stage of the plan is complete. The group is running on its own terms now — the rest is scale.' })]));
      return;
    }

    KH.dom.fill(el.plan, next.map(function (s, i) {
      return h('div', { class: 'plan-row' + (i === 0 ? ' now' : '') }, [
        h('span', { class: 'plan-index', text: String(prog.done + i + 1) }),
        h('span', { class: 'plan-body' }, [
          h('b', { text: s.label }),
          h('span', { text: s.detail })
        ]),
        h('button', {
          class: 'btn sm' + (i === 0 ? ' primary' : ''), type: 'button', text: s.action,
          onclick: function () { KH.app.go(s.panel); }
        })
      ]);
    }));
  }

  /* ---------- What is wrong ---------- */

  function drawIssues() {
    var list = KH.flow.issues();
    if (el.issueChip) {
      el.issueChip.textContent = list.length ? list.length + (list.length === 1 ? ' item' : ' items') : 'Clear';
      el.issueChip.className = 'chip ' + (list.some(function (i) { return i.severity === 'critical'; }) ? 'hot'
        : list.length ? 'warn' : 'good');
    }
    if (!list.length) {
      KH.dom.fill(el.issues, h('div', { class: 'empty' }, [icon('check'),
        h('span', { text: 'Nothing requires attention. Cash flow, governance and the property book are all in order.' })]));
      return;
    }
    KH.dom.fill(el.issues, list.slice(0, 6).map(function (m) {
      return h('div', { class: 'issue-row ' + m.severity }, [
        h('span', { class: 'issue-dot', 'aria-hidden': 'true' }),
        h('span', { class: 'issue-body' }, [h('b', { text: m.label }), h('span', { text: m.detail })]),
        h('button', {
          class: 'btn sm ghost', type: 'button', text: m.action,
          onclick: function () {
            KH.app.go(m.panel);
            if (m.sym && KH.views.empire) KH.views.empire.select(m.sym);
          }
        })
      ]);
    }));
  }

  function drawChart() {
    if (!el.chart) return;
    var g = KH.game.get();
    var pts = g.history.slice(-120);
    if (pts.length < 2) {
      KH.dom.fill(el.chart, h('div', { class: 'empty' }, [icon('chart'),
        h('span', { text: 'One point is recorded per settled period. Advance a period, or let the clock run.' })]));
      if (el.worthChip) el.worthChip.textContent = fmt.moneyShort(KH.sim.netWorth().total);
      return;
    }
    var first = pts[0].total, last = pts[pts.length - 1].total;
    if (el.worthChip) {
      el.worthChip.textContent = fmt.pct(((last - first) / Math.abs(first || 1)) * 100, 1) + ' over ' + pts.length + ' periods';
      el.worthChip.className = 'chip ' + (last >= first ? 'good' : 'warn');
    }
    KH.charts.timeSeries(el.chart, {
      series: [{ name: 'Net worth', points: pts.map(function (p) { return { t: p.w, v: p.total }; }), color: 'var(--s1)' }],
      area: true,
      yFormat: fmt.moneyShort,
      tipFormat: function (v) { return fmt.money(v, 0); },
      xFormat: function (t) { return 'WK ' + t; },
      ariaLabel: 'Group net worth by period'
    });
  }

  function drawMix() {
    if (!el.mix) return;
    var w = KH.sim.netWorth();
    var slices = [
      { label: 'Listed equity', value: Math.max(0, w.equity) },
      { label: 'Asset register', value: Math.max(0, w.register) },
      { label: 'Property', value: Math.max(0, w.property) },
      { label: 'Cash', value: Math.max(0, w.cash) }
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
      el.flowChip.textContent = fmt.signed(f.net, 0);
      el.flowChip.className = 'chip ' + (f.net >= 0 ? 'good' : 'warn');
    }
    var rows = f.detail.slice(0, 7);
    KH.dom.fill(el.flow, rows.length
      ? h('div', { class: 'flow-list' }, rows.map(function (d) {
          return h('div', { class: 'flow-row' }, [
            h('span', { class: 'flow-what', text: d.what.charAt(0).toUpperCase() + d.what.slice(1) }),
            h('span', { class: 'delta ' + fmt.dir(d.amount) }, [
              h('span', { class: 'arrow', text: fmt.arrow(d.amount), 'aria-hidden': 'true' }),
              h('span', { text: fmt.signed(d.amount, 0) })
            ])
          ]);
        }))
      : h('div', { class: 'empty', text: 'No recurring income or costs yet.' }));
  }

  function drawStanding() {
    var g = KH.game.get();
    var r = KH.sim.creditRating();
    if (el.gradeChip) {
      el.gradeChip.textContent = r.grade;
      el.gradeChip.className = 'chip ' + (r.score > 74 ? 'good' : r.score > 48 ? '' : 'warn');
    }
    var bars = [
      { k: 'Reputation', v: g.standing.reputation, good: true, note: 'How the market reads you' },
      { k: 'Regulatory scrutiny', v: g.standing.scrutiny, good: false, note: 'How closely you are watched' },
      { k: 'Credit standing', v: r.score, good: true, note: r.grade + ' · ' + r.note + ' · gearing ' + (r.gearing * 100).toFixed(0) + '%' }
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
        h('span', { text: 'No holdings yet. The market is the first stage of the plan.' })]));
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
          h('span', { class: 'line2', text: p.name + ' · ' + (p.own * 100).toFixed(1) + '% held' })
        ]),
        h('span', { class: 'grade-pill ' + KH.app.gradeClass(score), text: KH.app.gradeOf(score) })
      ]);
    }));
  }

  function drawNews() {
    var g = KH.game.get();
    var items = g.news.slice(0, 10);
    if (!items.length) {
      KH.dom.fill(el.news, h('div', { class: 'empty', text: 'Nothing has come over the wire yet. Advance a period.' }));
      return;
    }
    KH.dom.fill(el.news, items.map(function (n) {
      return h('div', { class: 'feed-item' }, [
        h('span', { class: 'ts', text: 'FY' + n.year + ' W' + n.week }),
        h('span', { class: 'txt' }, [
          h('b', { class: n.tone === 'good' ? 'tone-good' : n.tone === 'bad' ? 'tone-bad' : '', text: n.head }),
          n.body ? ' — ' + n.body : ''
        ])
      ]);
    }));
  }

  KH.views = KH.views || {};
  KH.views.overview = {
    id: 'overview', label: 'Overview', icon: 'grid',
    mount: mount, activate: refresh, refresh: refresh, tick: function () {}
  };
})(window.KH);

/* ============================================================
   Empire — the companies you hold, and the ones you actually run.

   Above a quarter of the shares you get a board seat and can
   appoint a chief executive and commission marketing. Above half
   you set strategy, pricing, specification and the payroll — and
   you fund the losses. Everything here moves the fundamentals,
   and the fundamentals move the price.
   ============================================================ */

(function (KH) {
  'use strict';

  var h = KH.dom.h, icon = KH.dom.icon, fmt = KH.fmt;
  var el = {};
  var current = { sym: null, tab: 'brief' };

  var TABS = [
    { id: 'brief', label: 'Briefing' },
    { id: 'strategy', label: 'Strategy' },
    { id: 'people', label: 'People' },
    { id: 'ranges', label: 'Ranges & pricing' },
    { id: 'marketing', label: 'Marketing' },
    { id: 'governance', label: 'Governance' }
  ];

  function held() {
    var g = KH.game.get();
    return Object.keys(g.corps)
      .map(function (sym) { return { sym: sym, corp: g.corps[sym], inst: KH.market.get(sym) }; })
      .filter(function (r) { return r.inst && (r.corp.shares > 0 || r.corp.staff.length || r.corp.ceo); })
      .sort(function (a, b) { return KH.sim.ownership(b.sym) - KH.sim.ownership(a.sym); });
  }

  function mount(root) {
    root.appendChild(h('div', { class: 'view-head' }, [
      h('div', { class: 'titles' }, [
        h('div', { class: 'eyebrow', text: 'Group operations' }),
        h('h1', { text: 'Empire' })
      ]),
      h('div', { class: 'spacer' }),
      h('div', { class: 'actions' }, [
        el.countChip = h('span', { class: 'chip' }),
        h('button', {
          class: 'btn', type: 'button',
          onclick: function () {
            if (!current.sym) { KH.app.toast('Nothing selected', 'Choose a company first.'); return; }
            KH.reports.boardPack(current.sym);
            KH.app.toast('Board pack exported', 'A PDF has been saved to your downloads.', 'check');
          }
        }, [icon('download'), h('span', { text: 'Board pack (PDF)' })]),
        h('button', { class: 'btn primary', type: 'button', onclick: function () { KH.app.go('markets'); } },
          [icon('plus'), h('span', { text: 'Acquire' })])
      ])
    ]));

    var layout = h('div', { class: 'empire-layout' });
    root.appendChild(layout);

    el.list = h('div', { class: 'rows scroll', style: { flex: '1', minHeight: '0' } });
    layout.appendChild(h('div', { class: 'panel' }, [
      h('div', { class: 'panel-head' }, [h('h2', { text: 'Holdings' }), h('div', { class: 'spacer' }), el.sub = h('span', { class: 'sub' })]),
      el.list
    ]));

    el.detail = h('div', { class: 'panel', style: { minWidth: '0' } });
    layout.appendChild(el.detail);

    refresh();
  }

  function refresh() {
    if (!el.list) return;
    var rows = held();
    if (el.countChip) el.countChip.textContent = rows.length + (rows.length === 1 ? ' holding' : ' holdings');
    var controlled = rows.filter(function (r) { return KH.sim.controls(r.sym); }).length;
    if (el.sub) el.sub.textContent = controlled + ' controlled';

    if (!rows.length) {
      KH.dom.fill(el.list, h('div', { class: 'empty' }, [
        icon('briefcase'),
        h('span', { text: 'You own no shares yet. Buy a stake on the Markets desk; past 25% you join the board, past 50% you run it.' })
      ]));
      renderDetail(null);
      return;
    }

    if (!current.sym || !rows.some(function (r) { return r.sym === current.sym; })) current.sym = rows[0].sym;

    KH.dom.fill(el.list, rows.map(function (r) {
      var own = KH.sim.ownership(r.sym);
      var ch = KH.market.change(r.inst);
      var score = KH.sim.turnaroundScore(r.sym);
      var stake = own >= KH.sim.CONTROL ? 'Controlled' : own >= KH.sim.BOARD ? 'Board seat' : 'Minority';
      return h('button', {
        class: 'asset-row', type: 'button', 'aria-selected': r.sym === current.sym ? 'true' : 'false',
        onclick: function () { current.sym = r.sym; refresh(); }
      }, [
        h('span', { class: 'swatch', style: { background: own >= KH.sim.CONTROL ? 'var(--accent)' : own >= KH.sim.BOARD ? 'var(--s4)' : 'var(--text-muted)' } }),
        h('span', { class: 'nm' }, [
          h('b', { text: r.inst.name }),
          h('span', { text: r.sym + ' · ' + stake + ' ' + (own * 100).toFixed(1) + '%' })
        ]),
        h('span', { class: 'figs' }, [
          h('b', { text: fmt.moneyShort((r.inst.px / 100) * r.corp.shares) }),
          h('span', { class: 'delta ' + fmt.dir(ch.pct), style: { fontSize: 'var(--type-meta)' } }, [
            h('span', { class: 'arrow', text: fmt.arrow(ch.pct), 'aria-hidden': 'true' }),
            h('span', { text: fmt.pct(ch.pct, 1) })
          ])
        ]),
        h('span', { class: 'score-pill ' + scoreClass(score), title: 'Turnaround score', text: String(score) })
      ]);
    }));

    renderDetail(current.sym);
  }

  function scoreClass(score) {
    if (score <= 0) return 'doomed';
    if (score < 35) return 'hard';
    if (score < 65) return 'fair';
    return 'good';
  }

  function renderDetail(sym) {
    if (!el.detail) return;
    if (!sym) {
      KH.dom.fill(el.detail, h('div', { class: 'empty', style: { margin: 'auto' } }, [
        icon('building'), h('span', { text: 'Select a holding' })
      ]));
      return;
    }
    var inst = KH.market.get(sym);
    var g = KH.game.get();
    var corp = g.corps[sym];
    var own = KH.sim.ownership(sym);
    var score = KH.sim.turnaroundScore(sym);

    KH.dom.fill(el.detail, [
      h('div', { class: 'panel-head', style: { flexWrap: 'wrap', gap: '8px' } }, [
        h('h2', { text: inst.name }),
        h('span', { class: 'sub', text: sym }),
        h('div', { class: 'spacer' }),
        h('span', { class: 'chip ' + (own >= KH.sim.CONTROL ? 'good' : own >= KH.sim.BOARD ? 'accent' : ''),
          text: (own * 100).toFixed(1) + '% held' }),
        h('span', { class: 'chip score-chip ' + scoreClass(score), text: 'Turnaround ' + score + ' · ' + KH.sim.turnaroundLabel(score) })
      ]),
      h('div', { class: 'tabstrip' }, TABS.map(function (t) {
        return h('button', {
          type: 'button', class: 'tabbtn', 'aria-pressed': t.id === current.tab ? 'true' : 'false',
          text: t.label, onclick: function () { current.tab = t.id; renderDetail(sym); }
        });
      })),
      h('div', { class: 'panel-body scroll', style: { flex: '1', minHeight: '0' } }, body(sym, inst, corp, own))
    ]);
  }

  function gate(own, need, what) {
    return h('div', { class: 'gate' }, [
      icon('lock'),
      h('span', { text: what + ' needs ' + Math.round(need * 100) + '% of the shares. You hold ' + (own * 100).toFixed(1) + '%.' }),
      h('button', { class: 'btn sm', type: 'button', text: 'Buy more', onclick: function () { KH.app.go('markets'); KH.views.markets.select(current.sym); } })
    ]);
  }

  function body(sym, inst, corp, own) {
    switch (current.tab) {
      case 'strategy': return own >= KH.sim.CONTROL ? strategyTab(sym, corp) : gate(own, KH.sim.CONTROL, 'Setting strategy');
      case 'people': return own >= KH.sim.CONTROL ? peopleTab(sym, corp) : gate(own, KH.sim.CONTROL, 'Appointing staff');
      case 'ranges': return own >= KH.sim.CONTROL ? rangesTab(sym, corp) : gate(own, KH.sim.CONTROL, 'Setting prices');
      case 'marketing': return own >= KH.sim.BOARD ? marketingTab(sym, corp) : gate(own, KH.sim.BOARD, 'Commissioning marketing');
      case 'governance': return own >= KH.sim.BOARD ? governanceTab(sym, corp) : gate(own, KH.sim.BOARD, 'Board appointments');
      default: return briefTab(sym, inst, corp, own);
    }
  }

  /* ---------- Briefing ---------- */

  function briefTab(sym, inst, corp, own) {
    var e = KH.sim.earningsOf(inst);
    var fair = KH.sim.fairPrice(inst);
    var chartHost = h('div', { style: { height: '170px', marginTop: '10px' } });
    requestAnimationFrame(function () {
      KH.charts.timeSeries(chartHost, {
        series: [{ name: sym, points: inst.intraday, color: KH.market.change(inst).pct >= 0 ? 'var(--up)' : 'var(--down)' }],
        area: true,
        yFormat: function (v) { return fmt.group(v, 0); },
        tipFormat: function (v) { return fmt.group(v, 2) + 'p'; },
        xFormat: function (t) { return fmt.time(t); },
        ariaLabel: inst.name + ' intraday'
      });
    });

    return [
      h('div', { class: 'tiles' }, [
        tile('Revenue, annualised', fmt.moneyShort(inst.f.revenue * inst.f.demand)),
        tile('Operating margin', (inst.f.margin * 100).toFixed(1) + '%', inst.f.margin >= 0 ? 'up' : 'down'),
        tile('Earnings', fmt.moneyShort(e), e >= 0 ? 'up' : 'down'),
        tile('Your stake', fmt.money((inst.px / 100) * (corp ? corp.shares : 0), 0)),
        tile('Fair value', fmt.group(fair, 2) + 'p'),
        tile('Workforce morale', Math.round(inst.f.morale) + '/100')
      ]),
      chartHost,
      h('div', { class: 'callout ' + (inst.cursed ? 'bad' : fair > inst.px ? 'good' : '') }, [
        icon(inst.cursed ? 'alert' : 'info'),
        h('span', {
          text: inst.cursed
            ? 'Every model run on this company returns to the same place inside a quarter. There is no turnaround here. There never will be.'
            : fair > inst.px
              ? 'Fair value is above the quote. The market has not yet priced in how this is being run.'
              : 'The quote is running ahead of the fundamentals. Either improve them, or expect the price to come back.'
        })
      ]),
      own >= KH.sim.CONTROL ? null : h('div', { class: 'callout' }, [
        icon('lock'),
        h('span', { text: own >= KH.sim.BOARD
          ? 'You hold a board seat. You can appoint a chief executive and commission marketing. Past 50% you set everything else.'
          : 'At 25% you get a board seat. At 50% you take control — and start funding the losses as well as taking the profits.' })
      ]),
      h('div', { style: { marginTop: '14px' } }, h('div', { class: 'legend' }, [
        h('span', { class: 'item' }, [h('span', { text: 'Sector' }), h('span', { class: 'val', text: inst.sector })]),
        h('span', { class: 'item' }, [h('span', { text: 'Shares in issue' }), h('span', { class: 'val', text: fmt.shortNum(inst.shares) })]),
        h('span', { class: 'item' }, [h('span', { text: 'Headcount' }), h('span', { class: 'val', text: fmt.group(inst.staff, 0) })]),
        h('span', { class: 'item' }, [h('span', { text: 'Risk rating' }), h('span', { class: 'val', text: inst.f.risk.toFixed(1) + ' / 5' })])
      ]))
    ];
  }

  function tile(k, v, dir) {
    return h('div', { class: 'stat' }, [
      h('div', { class: 'k', text: k }),
      h('div', { class: 'v' + (dir ? ' delta ' + dir : ''), text: v })
    ]);
  }

  /* ---------- Strategy ---------- */

  function strategyTab(sym, corp) {
    return [
      h('p', { class: 'tab-intro', text: 'A posture applies from the next week and takes several weeks to work through the numbers. Nothing here is free.' }),
      h('div', { class: 'card-grid' }, KH.simdata.strategies.map(function (s) {
        var on = corp.strategy === s.id;
        return h('button', {
          class: 'choice' + (on ? ' on' : ''), type: 'button',
          onclick: function () {
            var res = KH.sim.setStrategy(sym, s.id);
            if (!res.ok) { KH.app.toast('Not permitted', res.reason, 'alert'); return; }
            KH.app.toast('Strategy set', s.label + ' at ' + KH.market.get(sym).name, 'check');
            refresh();
          }
        }, [
          h('div', { class: 'choice-head' }, [h('b', { text: s.label }), on ? h('span', { class: 'chip good', text: 'Active' }) : null]),
          h('div', { class: 'choice-body', text: s.blurb }),
          h('div', { class: 'choice-stats' }, [
            statBadge('Margin', s.margin), statBadge('Demand', s.demand), statBadge('Risk', s.risk, true)
          ])
        ]);
      }))
    ];
  }

  function statBadge(label, value, inverted) {
    if (!value) return h('span', { class: 'badge-stat flat', text: label + ' —' });
    var good = inverted ? value < 0 : value > 0;
    return h('span', { class: 'badge-stat ' + (good ? 'up' : 'down'),
      text: label + ' ' + (value > 0 ? '+' : '') + (value * 100).toFixed(0) + '%' });
  }

  /* ---------- People ---------- */

  function peopleTab(sym, corp) {
    var pool = h('div', { class: 'card-grid' });

    function offerCandidates(role) {
      var three = KH.sim.candidates(role.id);
      KH.dom.fill(pool, [
        h('h3', { class: 'sub-head', text: 'Shortlist — ' + role.label }),
        h('div', { class: 'card-grid' }, three.map(function (p) {
          return h('div', { class: 'choice' }, [
            h('div', { class: 'choice-head' }, [h('b', { text: p.name }), h('span', { class: 'chip', text: (p.skill * 100).toFixed(0) + '/100' })]),
            h('div', { class: 'choice-body', text: role.blurb }),
            h('div', { class: 'choice-stats' }, [
              h('span', { class: 'badge-stat flat', text: fmt.money(p.salary, 0) + ' p.a.' })
            ]),
            h('button', {
              class: 'btn primary sm', type: 'button', text: 'Appoint',
              onclick: function () {
                var res = KH.sim.hire(sym, p);
                if (!res.ok) { KH.app.toast('Cannot appoint', res.reason, 'alert'); return; }
                KH.app.toast('Appointment made', p.name + ' — ' + p.role, 'check');
                KH.dom.clear(pool);
                refresh();
              }
            })
          ]);
        }))
      ]);
    }

    return [
      h('p', { class: 'tab-intro', text: 'Senior appointments move the numbers directly: operations take cost out, sales move volume, engineering raises what you can charge, and compliance makes it considerably harder for a chief executive to help themselves.' }),
      h('h3', { class: 'sub-head', text: 'Open a search' }),
      h('div', { class: 'chip-row' }, KH.simdata.roles.map(function (r) {
        return h('button', { class: 'btn sm', type: 'button', text: r.label + ' · ' + fmt.moneyShort(r.salary),
          onclick: function () { offerCandidates(r); } });
      })),
      pool,
      h('h3', { class: 'sub-head', text: 'Senior team (' + corp.staff.length + ')' }),
      corp.staff.length
        ? h('table', { class: 'tbl' }, [
            h('thead', {}, h('tr', {}, [
              h('th', { text: 'Name' }), h('th', { text: 'Role' }),
              h('th', { class: 'r', text: 'Capability' }), h('th', { class: 'r', text: 'Salary' }), h('th', { class: 'r', text: '' })
            ])),
            h('tbody', {}, corp.staff.map(function (p) {
              return h('tr', {}, [
                h('td', { text: p.name }),
                h('td', { class: 'muted', text: p.role }),
                h('td', { class: 'r num', text: (p.skill * 100).toFixed(0) }),
                h('td', { class: 'r num', text: fmt.money(p.salary, 0) }),
                h('td', { class: 'r' }, h('button', {
                  class: 'btn sm ghost', type: 'button', text: 'Dismiss',
                  onclick: function () {
                    var res = KH.sim.fire(sym, p.id);
                    if (!res.ok) { KH.app.toast('Cannot dismiss', res.reason, 'alert'); return; }
                    KH.app.toast('Dismissed', p.name + ' — settlement ' + fmt.money(res.payoff, 0), 'alert');
                    refresh();
                  }
                }))
              ]);
            }))
          ])
        : h('div', { class: 'empty', text: 'No senior appointments. The company is being run on its own momentum.' })
    ];
  }

  /* ---------- Ranges and pricing ---------- */

  function rangesTab(sym, corp) {
    return [
      h('p', { class: 'tab-intro', text: 'Price is an index where 100 is the market. Push it up and margin rises while volume falls; push it down and you buy share at somebody else’s expense — usually your own. Specification costs money now and earns it back in what you can charge.' }),
      h('div', { class: 'range-list' }, corp.ranges.map(function (r, i) {
        var priceOut = h('b', { class: 'num', text: String(r.price) });
        var qualOut = h('b', { class: 'num', text: String(r.quality) });
        return h('div', { class: 'range-row' }, [
          h('div', { class: 'range-name' }, [
            h('b', { text: r.label }),
            h('span', { text: 'Mix ' + (r.share * 100).toFixed(0) + '% of revenue' })
          ]),
          h('label', { class: 'range-ctl' }, [
            h('span', { class: 'lbl' }, [h('span', { text: 'Price index' }), priceOut]),
            h('input', {
              type: 'range', class: 'wealth-slider', min: '25', max: '400', step: '1', value: String(r.price),
              'aria-label': 'Price index for ' + r.label,
              oninput: function (ev) { priceOut.textContent = ev.target.value; ev.target.style.setProperty('--fill', ((ev.target.value - 25) / 375 * 100) + '%'); },
              onchange: function (ev) {
                KH.sim.setPrice(sym, i, ev.target.value);
                KH.sound.play('click');
              }
            })
          ]),
          h('label', { class: 'range-ctl' }, [
            h('span', { class: 'lbl' }, [h('span', { text: 'Specification' }), qualOut]),
            h('input', {
              type: 'range', class: 'wealth-slider', min: '10', max: '100', step: '1', value: String(r.quality),
              'aria-label': 'Specification for ' + r.label,
              oninput: function (ev) { qualOut.textContent = ev.target.value; ev.target.style.setProperty('--fill', ((ev.target.value - 10) / 90 * 100) + '%'); },
              onchange: function (ev) {
                var res = KH.sim.setQuality(sym, i, ev.target.value);
                if (!res.ok) { KH.app.toast('Not done', res.reason, 'alert'); ev.target.value = String(r.quality); qualOut.textContent = String(r.quality); return; }
                KH.sound.play('click');
              }
            })
          ])
        ]);
      }))
    ];
  }

  /* ---------- Marketing ---------- */

  function marketingTab(sym, corp) {
    var sloganField = h('input', {
      class: 'field', type: 'text', maxlength: '48',
      value: KH.simdata.slogans[Math.floor(Math.random() * KH.simdata.slogans.length)],
      'aria-label': 'Campaign line'
    });

    return [
      h('p', { class: 'tab-intro', text: 'A campaign lifts demand immediately and decays week by week. Television is expensive and lingers; influencer work spikes and is gone by Thursday. A marketing lead on the payroll makes every channel land harder.' }),
      h('label', { class: 'field-label' }, [h('span', { text: 'Campaign line' }), sloganField]),
      h('div', { class: 'card-grid' }, KH.simdata.channels.map(function (ch) {
        var scale = KH.util.clamp(Math.log10(Math.max(1e6, KH.market.get(sym).f.revenue)) / 8.5, 0.35, 2.4);
        var cost = Math.round(ch.cost * scale);
        return h('div', { class: 'choice' }, [
          h('div', { class: 'choice-head' }, [h('b', { text: ch.label }), h('span', { class: 'chip', text: fmt.moneyShort(cost) })]),
          h('div', { class: 'choice-body', text: ch.blurb }),
          h('div', { class: 'choice-stats' }, [
            h('span', { class: 'badge-stat up', text: 'Reach +' + (ch.reach * 100).toFixed(0) + '%' }),
            h('span', { class: 'badge-stat flat', text: 'Holds ' + Math.round(1 / (1 - ch.decay)) + ' wks' })
          ]),
          h('button', {
            class: 'btn primary sm', type: 'button', text: 'Commission',
            onclick: function () {
              var res = KH.sim.launchCampaign(sym, ch.id, sloganField.value.trim());
              if (!res.ok) { KH.app.toast('Campaign not booked', res.reason, 'alert'); return; }
              KH.app.toast('Campaign live', ch.label + ' — ' + fmt.money(res.cost, 0), 'check');
              refresh();
            }
          })
        ]);
      })),
      h('h3', { class: 'sub-head', text: 'In market' }),
      corp.campaigns.length
        ? h('table', { class: 'tbl' }, [
            h('thead', {}, h('tr', {}, [
              h('th', { text: 'Channel' }), h('th', { text: 'Line' }),
              h('th', { class: 'r', text: 'Spend' }), h('th', { class: 'r', text: 'Still working' })
            ])),
            h('tbody', {}, corp.campaigns.map(function (c) {
              var g = KH.game.get();
              var age = (g.clock.week + (g.clock.year - 1) * 52) - c.week;
              var left = Math.pow(c.decay, Math.max(0, age));
              return h('tr', {}, [
                h('td', { text: c.label }),
                h('td', { class: 'muted', text: '“' + c.slogan + '”' }),
                h('td', { class: 'r num', text: fmt.money(c.spend, 0) }),
                h('td', { class: 'r num', text: (left * 100).toFixed(0) + '%' })
              ]);
            }))
          ])
        : h('div', { class: 'empty', text: 'Nothing in market.' })
    ];
  }

  /* ---------- Governance ---------- */

  function governanceTab(sym, corp) {
    var exec = corp.ceo ? KH.simdata.executives.filter(function (e) { return e.id === corp.ceo; })[0] : null;
    var suspicion = Math.round(corp.suspicion);

    return [
      h('p', { class: 'tab-intro', text: 'A chief executive improves the company every week without being asked. Some of them also improve themselves. Watch the suspicion index, keep a compliance officer on the payroll, and audit before somebody else does it for you.' }),
      exec
        ? h('div', { class: 'ceo-card' }, [
            h('span', { class: 'avatar lg', text: fmt.initials(exec.name), 'aria-hidden': 'true' }),
            h('div', { class: 'ceo-body' }, [
              h('b', { text: exec.name }),
              h('span', { text: exec.pedigree }),
              h('p', { text: exec.note }),
              h('div', { class: 'choice-stats' }, [
                h('span', { class: 'badge-stat up', text: 'Competence ' + (exec.competence * 100).toFixed(0) }),
                h('span', { class: 'badge-stat ' + (exec.integrity > 0.6 ? 'up' : 'down'), text: 'Integrity ' + (exec.integrity * 100).toFixed(0) }),
                h('span', { class: 'badge-stat flat', text: fmt.moneyShort(exec.fee) + ' p.a.' })
              ])
            ]),
            h('div', { class: 'ceo-actions' }, [
              h('div', { class: 'suspicion' }, [
                h('span', { class: 'lbl', text: 'Suspicion ' + suspicion + '/100' }),
                h('div', { class: 'meter' }, h('i', { style: { width: suspicion + '%', background: suspicion > 55 ? 'var(--down)' : suspicion > 25 ? 'var(--warn)' : 'var(--up)' } }))
              ]),
              h('button', {
                class: 'btn sm', type: 'button', text: 'Commission forensic audit',
                onclick: function () {
                  var res = KH.sim.audit(sym);
                  if (!res.ok) { KH.app.toast('Audit not commissioned', res.reason, 'alert'); return; }
                  KH.app.toast(res.found ? 'Audit found a hole' : 'Audit came back clean',
                    res.found ? fmt.money(res.recovered, 0) + ' recovered. The chief executive is gone.'
                              : 'Nothing found. ' + fmt.money(res.cost, 0) + ' well spent.',
                    res.found ? 'alert' : 'check');
                  refresh();
                }
              }),
              h('button', {
                class: 'btn sm ghost', type: 'button', text: 'Terminate appointment',
                onclick: function () {
                  var res = KH.sim.dismissCeo(sym, false);
                  if (!res.ok) { KH.app.toast('Cannot terminate', res.reason, 'alert'); return; }
                  KH.app.toast('Chief executive removed', 'Settlement of ' + fmt.money(res.payoff, 0) + '.', 'alert');
                  refresh();
                }
              })
            ])
          ])
        : h('div', { class: 'callout' }, [icon('info'), h('span', { text: 'No chief executive in post. The company runs on whatever momentum it has.' })]),

      h('h3', { class: 'sub-head', text: 'Available candidates' }),
      h('div', { class: 'card-grid' }, KH.simdata.executives.filter(function (e) {
        return !exec || e.id !== exec.id;
      }).map(function (e) {
        return h('div', { class: 'choice' }, [
          h('div', { class: 'choice-head' }, [h('b', { text: e.name }), h('span', { class: 'chip', text: fmt.moneyShort(e.fee) })]),
          h('div', { class: 'choice-body', text: e.pedigree + ' — ' + e.note }),
          h('div', { class: 'choice-stats' }, [
            h('span', { class: 'badge-stat up', text: 'Comp ' + (e.competence * 100).toFixed(0) }),
            h('span', { class: 'badge-stat ' + (e.integrity > 0.6 ? 'up' : 'down'), text: 'Integ ' + (e.integrity * 100).toFixed(0) }),
            h('span', { class: 'badge-stat flat', text: 'Ambition ' + (e.ambition * 100).toFixed(0) })
          ]),
          h('button', {
            class: 'btn primary sm', type: 'button', text: 'Appoint',
            onclick: function () {
              var res = KH.sim.appointCeo(sym, e.id);
              if (!res.ok) { KH.app.toast('Cannot appoint', res.reason, 'alert'); return; }
              KH.app.toast('Appointed', e.name + ' takes the chair.', 'check');
              refresh();
            }
          })
        ]);
      }))
    ];
  }

  KH.views = KH.views || {};
  KH.views.empire = {
    id: 'empire', label: 'Empire', icon: 'building',
    mount: mount, activate: refresh, refresh: refresh,
    select: function (sym) { current.sym = sym; current.tab = 'brief'; refresh(); }
  };
})(window.KH);

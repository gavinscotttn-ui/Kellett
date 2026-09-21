/* ============================================================
   Property — buy it, let it, renovate it, sell it.

   Quotes come from four firms at once and no two agree. Cheap,
   fast and good is a choice of two, and the third one is always
   the one that bites.
   ============================================================ */

(function (KH) {
  'use strict';

  var h = KH.dom.h, icon = KH.dom.icon, fmt = KH.fmt;
  var el = {};
  var tab = 'book';
  var quoteFor = null;

  function mount(root) {
    root.appendChild(h('div', { class: 'view-head' }, [
      h('div', { class: 'titles' }, [
        h('div', { class: 'eyebrow', text: 'Real estate' }),
        h('h1', { text: 'Property' })
      ]),
      h('div', { class: 'spacer' }),
      h('div', { class: 'actions' }, [
        el.chip = h('span', { class: 'chip' }),
        el.yield = h('span', { class: 'chip accent' }),
        h('button', {
          class: 'btn', type: 'button',
          onclick: function () { KH.reports.propertySchedule(); KH.app.toast('Schedule exported', 'A PDF has been saved to your downloads.', 'check'); }
        }, [icon('download'), h('span', { text: 'Schedule (PDF)' })])
      ])
    ]));

    root.appendChild(h('div', { class: 'tabstrip flush' }, [
      ['book', 'Portfolio'], ['market', 'Market'], ['works', 'Works & quotes']
    ].map(function (t) {
      return h('button', { class: 'tabbtn', type: 'button', text: t[1], 'aria-pressed': tab === t[0] ? 'true' : 'false',
        onclick: function () { tab = t[0]; refresh(); } });
    })));

    el.body = h('div', { class: 'view-body scroll' });
    root.appendChild(el.body);
    refresh();
  }

  function refresh() {
    if (!el.body) return;
    var g = KH.game.get();
    var value = KH.util.sum(g.props, function (p) { return p.value; });
    var rent = KH.util.sum(g.props, function (p) { return p.tenanted && !p.works.length ? p.rent : 0; });
    if (el.chip) el.chip.textContent = g.props.length + (g.props.length === 1 ? ' property' : ' properties');
    if (el.yield) el.yield.textContent = value ? 'Yield ' + ((rent * 52 / value) * 100).toFixed(2) + '%' : 'No book';

    KH.dom.$$('.tabstrip.flush .tabbtn', el.body.parentNode).forEach(function (b) {
      b.setAttribute('aria-pressed', (b.textContent === 'Portfolio' && tab === 'book') ||
        (b.textContent === 'Market' && tab === 'market') || (b.textContent === 'Works & quotes' && tab === 'works') ? 'true' : 'false');
    });

    KH.dom.fill(el.body, tab === 'market' ? marketTab() : tab === 'works' ? worksTab() : bookTab());
  }

  /* ---------- Portfolio ---------- */

  function bookTab() {
    var g = KH.game.get();
    if (!g.props.length) {
      return h('div', { class: 'empty' }, [icon('building'),
        h('span', { text: 'You own no property. The market tab has twenty listings and some of them are even sensible.' })]);
    }
    var value = KH.util.sum(g.props, function (p) { return p.value; });
    var paid = KH.util.sum(g.props, function (p) { return p.paid; });
    var rent = KH.util.sum(g.props, function (p) { return p.tenanted && !p.works.length ? p.rent : 0; });

    return [
      h('div', { class: 'tiles', style: { marginBottom: '12px' } }, [
        stat('Book valuation', fmt.moneyShort(value)),
        stat('Total cost', fmt.moneyShort(paid)),
        stat('Unrealised', fmt.signedShort(value - paid), value >= paid ? 'up' : 'down'),
        stat('Weekly rent roll', fmt.money(rent, 0)),
        stat('Let', g.props.filter(function (p) { return p.tenanted && !p.works.length; }).length + ' of ' + g.props.length)
      ]),
      h('div', { class: 'card-grid wide' }, g.props.map(propertyCard))
    ];
  }

  function stat(k, v, dir) {
    return h('div', { class: 'stat' }, [h('div', { class: 'k', text: k }), h('div', { class: 'v' + (dir ? ' delta ' + dir : ''), text: v })]);
  }

  function propertyCard(p) {
    var rentField = h('input', {
      class: 'field num', type: 'number', min: '0', step: '10', value: String(p.rent),
      'aria-label': 'Weekly rent for ' + p.address,
      onchange: function (ev) { KH.sim.setRent(p.id, ev.target.value); refresh(); }
    });
    var active = p.works.length > 0;

    return h('div', { class: 'prop-card' }, [
      h('div', { class: 'prop-head' }, [
        h('div', { style: { minWidth: '0' } }, [
          h('b', { text: p.address }),
          h('span', { text: p.type })
        ]),
        h('span', { class: 'chip ' + (active ? 'warn' : p.tenanted ? 'good' : '') ,
          text: active ? 'Works on site' : p.tenanted ? 'Let' : 'Void ' + (p.void || 0) + 'w' })
      ]),
      h('dl', { class: 'kv' }, [
        h('dt', { text: 'Valuation' }), h('dd', { text: fmt.money(p.value, 0) }),
        h('dt', { text: 'Paid' }), h('dd', { text: fmt.money(p.paid, 0) }),
        h('dt', { text: 'Gain' }), h('dd', {}, h('span', { class: 'delta ' + fmt.dir(p.value - p.paid) }, [
          h('span', { class: 'arrow', text: fmt.arrow(p.value - p.paid), 'aria-hidden': 'true' }),
          h('span', { text: fmt.signed(p.value - p.paid, 0) })
        ])),
        h('dt', { text: 'Gross yield' }), h('dd', { text: ((p.rent * 52 / p.value) * 100).toFixed(2) + '%' })
      ]),
      h('div', { class: 'cond' }, [
        h('span', { class: 'lbl', text: 'Condition ' + Math.round(p.condition) + '/100' }),
        h('div', { class: 'meter' }, h('i', {
          style: { width: p.condition + '%', background: p.condition > 70 ? 'var(--up)' : p.condition > 40 ? 'var(--warn)' : 'var(--down)' }
        }))
      ]),
      active ? h('div', { class: 'works-strip' }, p.works.map(function (w) {
        return h('div', { class: 'work-row' }, [
          h('span', { text: w.label + ' · ' + w.builder }),
          h('span', { class: 'num', text: w.weeksLeft + ' wks left' + (w.overrun ? ' (+' + w.overrun + ' delay)' : '') })
        ]);
      })) : null,
      h('label', { class: 'field-label inline' }, [h('span', { text: 'Weekly rent' }), rentField]),
      h('div', { class: 'card-actions' }, [
        h('button', {
          class: 'btn sm', type: 'button', text: 'Get quotes',
          onclick: function () { quoteFor = p.id; tab = 'works'; refresh(); }
        }),
        h('button', {
          class: 'btn sm ghost', type: 'button', text: 'Sell',
          onclick: function () {
            var res = KH.sim.sellProperty(p.id);
            if (!res.ok) { KH.app.toast('Cannot sell', res.reason, 'alert'); return; }
            KH.app.toast('Sold', p.address + ' — ' + fmt.money(res.net, 0) + ' net', 'check');
            refresh();
          }
        })
      ])
    ]);
  }

  /* ---------- Market ---------- */

  function marketTab() {
    var g = KH.game.get();
    var ownedIds = g.props.map(function (p) { return p.id; });
    var available = KH.simdata.propertyMarket.filter(function (l) { return ownedIds.indexOf(l.id) === -1; });

    return [
      h('p', { class: 'tab-intro', text: 'Asking prices include nothing. Add roughly 5.8% for stamp duty, legals and a survey you should not skip. Condition below forty means it will not let until somebody has been in with a van.' }),
      h('div', { class: 'card-grid wide' }, available.map(function (l) {
        var price = KH.sim.askingPrice(l);
        var rent = KH.sim.marketRent(l);
        var fees = Math.round(price * 0.058);
        return h('div', { class: 'prop-card' }, [
          h('div', { class: 'prop-head' }, [
            h('div', { style: { minWidth: '0' } }, [h('b', { text: l.address }), h('span', { text: l.type })]),
            h('span', { class: 'chip', text: ((rent * 52 / price) * 100).toFixed(2) + '% yield' })
          ]),
          h('p', { class: 'prop-note', text: l.yieldNote }),
          h('dl', { class: 'kv' }, [
            h('dt', { text: 'Asking' }), h('dd', { text: fmt.money(price, 0) }),
            h('dt', { text: 'Fees' }), h('dd', { text: fmt.money(fees, 0) }),
            h('dt', { text: 'Total' }), h('dd', { text: fmt.money(price + fees, 0) }),
            h('dt', { text: 'Rent p.w.' }), h('dd', { text: fmt.money(rent, 0) })
          ]),
          h('div', { class: 'cond' }, [
            h('span', { class: 'lbl', text: 'Condition ' + l.condition + '/100' }),
            h('div', { class: 'meter' }, h('i', { style: { width: l.condition + '%', background: l.condition > 70 ? 'var(--up)' : l.condition > 40 ? 'var(--warn)' : 'var(--down)' } }))
          ]),
          h('div', { class: 'card-actions' }, [
            h('button', {
              class: 'btn primary sm', type: 'button', text: 'Purchase',
              onclick: function () {
                var res = KH.sim.buyProperty(l.id);
                if (!res.ok) { KH.app.toast('Purchase failed', res.reason, 'alert'); return; }
                KH.app.toast('Completed', l.address + ' — ' + fmt.money(res.price + res.fees, 0), 'check');
                tab = 'book';
                refresh();
              }
            })
          ])
        ]);
      }))
    ];
  }

  /* ---------- Works and quotes ---------- */

  function worksTab() {
    var g = KH.game.get();
    if (!g.props.length) {
      return h('div', { class: 'empty' }, [icon('building'), h('span', { text: 'Buy something before you renovate it.' })]);
    }

    var propSelect = h('select', { class: 'field', 'aria-label': 'Property' },
      g.props.map(function (p) { return h('option', { value: p.id, selected: p.id === quoteFor, text: p.address }); }));
    var workSelect = h('select', { class: 'field', 'aria-label': 'Works' },
      KH.simdata.works.map(function (w) { return h('option', { value: w.id, text: w.label }); }));

    var quotes = g.offers.slice();

    return [
      h('p', { class: 'tab-intro', text: 'Four firms will quote. The cheapest is cheap for a reason, the dearest will turn up every day, and the fastest will leave you a snagging list of biblical length. Works void the property while they are on site.' }),
      h('div', { class: 'quote-form' }, [
        h('label', { class: 'field-label' }, [h('span', { text: 'Property' }), propSelect]),
        h('label', { class: 'field-label' }, [h('span', { text: 'Works' }), workSelect]),
        h('button', {
          class: 'btn primary', type: 'button', text: 'Request quotes',
          onclick: function () {
            var res = KH.sim.requestQuotes(propSelect.value, workSelect.value);
            if (!res.ok) { KH.app.toast('No quotes', res.reason, 'alert'); return; }
            quoteFor = propSelect.value;
            KH.app.toast('Quotes received', res.count + ' firms have come back.', 'check');
            refresh();
          }
        })
      ]),
      h('h3', { class: 'sub-head', text: 'Quotes on the table' }),
      quotes.length
        ? h('div', { class: 'card-grid' }, quotes.map(function (q) {
            var b = KH.simdata.builders.filter(function (x) { return x.id === q.builderId; })[0];
            var w = KH.simdata.works.filter(function (x) { return x.id === q.workId; })[0];
            var p = g.props.filter(function (x) { return x.id === q.propId; })[0];
            return h('div', { class: 'choice' }, [
              h('div', { class: 'choice-head' }, [h('b', { text: b.name }), h('span', { class: 'chip', text: fmt.money(q.price, 0) })]),
              h('div', { class: 'choice-body', text: b.blurb }),
              h('div', { class: 'choice-stats' }, [
                h('span', { class: 'badge-stat flat', text: q.weeks + ' weeks' }),
                h('span', { class: 'badge-stat ' + (b.quality > 0.8 ? 'up' : 'down'), text: 'Quality ' + (b.quality * 100).toFixed(0) }),
                h('span', { class: 'badge-stat ' + (b.reliability > 0.8 ? 'up' : 'down'), text: 'Turns up ' + (b.reliability * 100).toFixed(0) + '%' })
              ]),
              h('div', { class: 'choice-body muted', text: (w ? w.label : '') + (p ? ' at ' + p.address : '') }),
              h('button', {
                class: 'btn primary sm', type: 'button', text: 'Accept · 35% deposit',
                onclick: function () {
                  var res = KH.sim.acceptQuote(q.id);
                  if (!res.ok) { KH.app.toast('Not accepted', res.reason, 'alert'); return; }
                  KH.app.toast('Contractor instructed', b.name + ' starts this week.', 'check');
                  tab = 'book';
                  refresh();
                }
              })
            ]);
          }))
        : h('div', { class: 'empty', text: 'No live quotes. Request some above.' }),

      h('h3', { class: 'sub-head', text: 'On site' }),
      (function () {
        var live = [];
        g.props.forEach(function (p) { p.works.forEach(function (w) { live.push({ p: p, w: w }); }); });
        if (!live.length) return h('div', { class: 'empty', text: 'No works in progress.' });
        return h('table', { class: 'tbl' }, [
          h('thead', {}, h('tr', {}, [
            h('th', { text: 'Property' }), h('th', { text: 'Works' }), h('th', { text: 'Contractor' }),
            h('th', { class: 'r', text: 'Weeks left' }), h('th', { class: 'r', text: 'Contract' }), h('th', { class: 'r', text: 'Paid' })
          ])),
          h('tbody', {}, live.map(function (r) {
            return h('tr', {}, [
              h('td', { text: r.p.address }),
              h('td', { class: 'muted', text: r.w.label }),
              h('td', { class: 'muted', text: r.w.builder }),
              h('td', { class: 'r num', text: String(r.w.weeksLeft) }),
              h('td', { class: 'r num', text: fmt.money(r.w.total, 0) }),
              h('td', { class: 'r num', text: fmt.money(r.w.paid, 0) })
            ]);
          }))
        ]);
      })()
    ];
  }

  KH.views = KH.views || {};
  KH.views.property = {
    id: 'property', label: 'Property', icon: 'building2',
    mount: mount, activate: refresh, refresh: refresh
  };
})(window.KH);

/* ============================================================
   Wealth management — the personal side of the balance sheet.

   Some of it appreciates, most of it does not, and two items are
   written to zero the moment you sign. All of it raises prestige,
   which is its own reward and not a financial one.
   ============================================================ */

(function (KH) {
  'use strict';

  var h = KH.dom.h, icon = KH.dom.icon, fmt = KH.fmt;
  var el = {};
  var filter = 'all';

  function categories() {
    var seen = [];
    KH.simdata.lifestyle.forEach(function (i) { if (seen.indexOf(i.cat) === -1) seen.push(i.cat); });
    return seen;
  }

  function mount(root) {
    root.appendChild(h('div', { class: 'view-head' }, [
      h('div', { class: 'titles' }, [
        h('div', { class: 'eyebrow', text: 'Private office' }),
        h('h1', { text: 'Wealth management' })
      ]),
      h('div', { class: 'spacer' }),
      h('div', { class: 'actions' }, [
        el.prestige = h('span', { class: 'chip accent' }),
        el.cash = h('span', { class: 'chip' })
      ])
    ]));

    el.body = h('div', { class: 'view-body scroll' });
    root.appendChild(el.body);
    refresh();
  }

  function refresh() {
    if (!el.body) return;
    var g = KH.game.get();
    if (el.prestige) el.prestige.textContent = 'Prestige ' + Math.round(g.standing.prestige);
    if (el.cash) el.cash.textContent = fmt.moneyShort(g.treasury.cash) + ' available';

    var owned = g.lifestyle;
    var ownedValue = KH.util.sum(owned, function (i) { return i.value; });
    var ownedPaid = KH.util.sum(owned, function (i) { return i.paid; });

    KH.dom.fill(el.body, [
      h('div', { class: 'tiles', style: { marginBottom: '12px' } }, [
        stat('Items owned', String(owned.length)),
        stat('Current value', fmt.moneyShort(ownedValue)),
        stat('Total paid', fmt.moneyShort(ownedPaid)),
        stat('Against cost', fmt.signedShort(ownedValue - ownedPaid), ownedValue >= ownedPaid ? 'up' : 'down'),
        stat('Prestige', String(Math.round(g.standing.prestige)))
      ]),

      owned.length ? h('div', { class: 'panel', style: { marginBottom: '12px' } }, [
        h('div', { class: 'panel-head' }, [h('h2', { text: 'Owned' }), h('div', { class: 'spacer' }),
          h('span', { class: 'sub', text: 'Valued weekly' })]),
        h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, [
          h('thead', {}, h('tr', {}, [
            h('th', { text: 'Item' }), h('th', { text: 'Category' }),
            h('th', { class: 'r', text: 'Paid' }), h('th', { class: 'r', text: 'Value' }),
            h('th', { class: 'r', text: 'Change' }), h('th', { class: 'r', text: '' })
          ])),
          h('tbody', {}, owned.map(function (item, i) {
            var delta = item.value - item.paid;
            return h('tr', {}, [
              h('td', { text: item.label }),
              h('td', { class: 'muted', text: item.cat }),
              h('td', { class: 'r num', text: fmt.money(item.paid, 0) }),
              h('td', { class: 'r num', text: fmt.money(item.value, 0) }),
              h('td', { class: 'r' }, h('span', { class: 'delta ' + fmt.dir(delta) }, [
                h('span', { class: 'arrow', text: fmt.arrow(delta), 'aria-hidden': 'true' }),
                h('span', { text: fmt.signed(delta, 0) })
              ])),
              h('td', { class: 'r' }, h('button', {
                class: 'btn sm ghost', type: 'button', text: 'Sell',
                onclick: function () {
                  var res = KH.sim.sellLifestyle(i);
                  if (!res.ok) { KH.app.toast('Cannot sell', res.reason, 'alert'); return; }
                  KH.app.toast('Sold', item.label + ' — ' + fmt.money(res.net, 0), 'check');
                  refresh();
                }
              }))
            ]);
          }))
        ]))
      ]) : null,

      h('div', { class: 'chip-row', style: { marginBottom: '10px' } },
        ['all'].concat(categories()).map(function (c) {
          return h('button', {
            class: 'btn sm' + (filter === c ? ' primary' : ' ghost'), type: 'button',
            text: c === 'all' ? 'Everything' : c,
            onclick: function () { filter = c; refresh(); }
          });
        })),

      h('div', { class: 'card-grid wide' }, KH.simdata.lifestyle
        .filter(function (i) { return filter === 'all' || i.cat === filter; })
        .map(function (item) {
          var price = KH.sim.lifestylePrice(item);
          var can = price <= g.treasury.cash;
          var app = item.appreciation;
          return h('div', { class: 'lux-card' }, [
            h('div', { class: 'lux-head' }, [
              h('div', { style: { minWidth: '0' } }, [
                h('b', { text: item.label }),
                h('span', { text: item.cat })
              ]),
              h('span', { class: 'chip ' + (app > 0.04 ? 'good' : app <= -1 ? 'warn' : ''),
                text: app <= -1 ? 'No resale' : (app >= 0 ? '+' : '') + (app * 100).toFixed(0) + '% p.a.' })
            ]),
            h('p', { class: 'prop-note', text: item.blurb }),
            h('div', { class: 'lux-foot' }, [
              h('span', { class: 'lux-price num', text: fmt.money(price, 0) }),
              h('span', { class: 'badge-stat flat', text: '+' + item.prestige + ' prestige' }),
              h('button', {
                class: 'btn sm ' + (can ? 'primary' : ''), type: 'button',
                disabled: !can, text: can ? 'Acquire' : 'Beyond reach',
                onclick: function () {
                  var res = KH.sim.buyLifestyle(item.id);
                  if (!res.ok) { KH.app.toast('Not purchased', res.reason, 'alert'); return; }
                  KH.app.toast('Acquired', item.label + ' — ' + fmt.money(res.price, 0), 'money');
                  refresh();
                }
              })
            ])
          ]);
        }))
    ]);
  }

  function stat(k, v, dir) {
    return h('div', { class: 'stat' }, [h('div', { class: 'k', text: k }), h('div', { class: 'v' + (dir ? ' delta ' + dir : ''), text: v })]);
  }

  KH.views = KH.views || {};
  KH.views.lifestyle = { id: 'lifestyle', label: 'Wealth', icon: 'gem', mount: mount, activate: refresh, refresh: refresh };
})(window.KH);

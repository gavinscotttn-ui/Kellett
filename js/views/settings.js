/* ============================================================
   Settings — identity, appearance, and the dealing account.
   ============================================================ */

(function (KH) {
  'use strict';

  var h = KH.dom.h, icon = KH.dom.icon, fmt = KH.fmt;

  var ACCENTS = [
    { id: 'default', label: 'Kellett blue', swatch: '#2f8fe0' },
    { id: 'ice', label: 'Ice', swatch: '#4fc8e0' },
    { id: 'emerald', label: 'Emerald', swatch: '#26a877' },
    { id: 'amber', label: 'Amber', swatch: '#d99a2b' },
    { id: 'crimson', label: 'Crimson', swatch: '#c9455c' }
  ];

  function row(title, note, control) {
    return h('div', { class: 'set-row' }, [
      h('div', { class: 'desc' }, [h('b', { text: title }), note ? h('span', { text: note }) : null]),
      h('div', { class: 'ctl' }, control)
    ]);
  }

  function textRow(title, note, section, key, opts) {
    opts = opts || {};
    var value = KH.store.get(section)[key];
    var input = h('input', {
      class: 'field', type: opts.type || 'text', value: value == null ? '' : String(value),
      maxlength: String(opts.max || 60), 'aria-label': title, autocomplete: 'off',
      oninput: KH.util.debounce(function (ev) {
        var v = ev.target.value.slice(0, opts.max || 60);
        var patch = {};
        patch[key] = v;
        KH.store.set(section, patch);
        KH.bus.emit('profile:changed');
      }, 160)
    });
    return h('div', { class: 'set-row' }, [
      h('div', { class: 'desc' }, [h('b', { text: title }), note ? h('span', { text: note }) : null]),
      h('div', { class: 'ctl wide' }, input)
    ]);
  }

  function selectRow(title, note, section, key, options, after) {
    var value = KH.store.get(section)[key];
    var sel = h('select', {
      class: 'field', 'aria-label': title,
      onchange: function (ev) {
        var patch = {};
        patch[key] = ev.target.value;
        KH.store.set(section, patch);
        if (after) after(ev.target.value);
      }
    }, options.map(function (o) { return h('option', { value: o.value, selected: o.value === value, text: o.label }); }));
    return row(title, note, sel);
  }

  function switchRow(title, note, section, key, after) {
    var value = !!KH.store.get(section)[key];
    var input = h('input', {
      type: 'checkbox', checked: value, 'aria-label': title,
      onchange: function (ev) {
        var patch = {};
        patch[key] = ev.target.checked;
        KH.store.set(section, patch);
        if (after) after(ev.target.checked);
      }
    });
    return row(title, note, h('label', { class: 'switch' }, [input, h('span', { class: 'track', 'aria-hidden': 'true' })]));
  }

  function segRow(title, note, section, key, options, after) {
    var value = KH.store.get(section)[key];
    var group = h('div', { class: 'segmented', role: 'group', 'aria-label': title });
    options.forEach(function (o) {
      group.appendChild(h('button', {
        type: 'button', text: o.label, 'aria-pressed': o.value === value ? 'true' : 'false',
        onclick: function () {
          var patch = {};
          patch[key] = o.value;
          KH.store.set(section, patch);
          KH.dom.$$('button', group).forEach(function (b) { b.setAttribute('aria-pressed', b.textContent === o.label ? 'true' : 'false'); });
          if (after) after(o.value);
        }
      }));
    });
    return row(title, note, group);
  }

  /* ---------- The group capitalisation dial ----------------------------
     A logarithmic slider, because the interesting decisions at the modest
     end of the range are the same size as the interesting decisions at the
     grand end, and a linear slider would bury the first hundred of them in
     the leftmost pixel.
     -------------------------------------------------------------------- */

  var STEPS = 1000;

  function posToNet(pos) {
    var r = KH.app.wealthRange;
    return Math.round(r.min * Math.pow(r.max / r.min, pos / STEPS));
  }

  function netToPos(net) {
    var r = KH.app.wealthRange;
    var n = KH.util.clamp(net, r.min, r.max);
    return Math.round((Math.log(n / r.min) / Math.log(r.max / r.min)) * STEPS);
  }

  /** How a figure of this size would be described in a room where people
      say things like "high net worth" without irony. */
  function standing(net) {
    if (net < 50000) return 'Emerging \u00b7 Retail client';
    if (net < 250000) return 'Established \u00b7 Affluent';
    if (net < 1000000) return 'Substantial \u00b7 Premier client';
    if (net < 3000000) return 'High net worth \u00b7 Private client';
    if (net < 8000000) return 'Very high net worth \u00b7 Private office';
    if (net < 13000000) return 'Ultra high net worth \u00b7 Family office';
    return 'Principal tier \u00b7 Institutional standing';
  }

  function wealthRow() {
    var current = KH.store.get('workspace').netWorth;

    var readout = h('b', { class: 'num', style: { fontSize: '1.42rem', fontWeight: '600', display: 'block', lineHeight: '1.2' } });
    var tier = h('span', { style: { display: 'block', fontSize: 'var(--type-meta)', color: 'var(--text-secondary)' } });
    var split = h('span', { style: { display: 'block', fontSize: 'var(--type-micro)', color: 'var(--text-muted)', marginTop: '2px' } });

    var slider = h('input', {
      type: 'range', min: '0', max: String(STEPS), step: '1', value: String(netToPos(current)),
      class: 'wealth-slider', 'aria-label': 'Group capitalisation',
      'aria-valuetext': fmt.money(current, 0)
    });

    function paint(net) {
      readout.textContent = fmt.money(net, 0);
      tier.textContent = standing(net);
      var f = KH.app.factorFor(net);
      split.textContent = 'Asset register ' + fmt.moneyShort(KH.assets.baseNet() * f - KH.assets.baseCash * f)
        + ' \u00b7 dealing account ' + fmt.moneyShort(KH.assets.baseCash * f);
      slider.setAttribute('aria-valuetext', fmt.money(net, 0));
      slider.style.setProperty('--fill', ((netToPos(net) / STEPS) * 100).toFixed(1) + '%');
    }

    slider.addEventListener('input', function () { paint(posToNet(Number(slider.value))); });
    slider.addEventListener('change', function () {
      var net = posToNet(Number(slider.value));
      KH.app.applyWealth(net, true);
      KH.app.refreshAll();
      paint(net);
      KH.sound.play('money');
    });

    var presets = h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' } },
      [15000, 100000, 750000, 2500000, 15000000].map(function (n) {
        return h('button', {
          class: 'btn sm ghost', type: 'button', text: fmt.moneyShort(n),
          onclick: function () {
            slider.value = String(netToPos(n));
            KH.app.applyWealth(n, true);
            KH.app.refreshAll();
            paint(n);
            KH.sound.play('money');
          }
        });
      }));

    paint(current);

    return h('div', { class: 'set-row', style: { flexDirection: 'column', alignItems: 'stretch', gap: '10px' } }, [
      h('div', { style: { display: 'flex', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap' } }, [
        h('div', { class: 'desc', style: { flex: '1' } }, [
          h('b', { text: 'Group capitalisation' }),
          h('span', { text: 'Rescales the asset register and the dealing account together, so every chart, tile and valuation moves with it. Remembered between sessions.' })
        ]),
        h('div', { style: { textAlign: 'right', flex: 'none' } }, [readout, tier, split])
      ]),
      slider,
      h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 'var(--type-micro)', color: 'var(--text-muted)', letterSpacing: '.1em', textTransform: 'uppercase' } }, [
        h('span', { text: fmt.money(KH.app.wealthRange.min, 0) }),
        h('span', { text: fmt.money(KH.app.wealthRange.max, 0) })
      ]),
      presets
    ]);
  }

  function mount(root) {
    root.appendChild(h('div', { class: 'view-head' }, [
      h('div', { class: 'titles' }, [
        h('div', { class: 'eyebrow', text: 'Configuration' }),
        h('h1', { text: 'Workspace settings' })
      ]),
      h('div', { class: 'spacer' }),
      h('div', { class: 'actions' }, [
        h('span', { class: 'chip', text: KH.store.isPersistent() ? 'Settings saved locally' : 'Session only' })
      ])
    ]));

    var wrap = h('div', { class: 'settings-wrap' });
    root.appendChild(h('div', { class: 'settings-scroll scroll' }, wrap));

    /* ---- Identity ---- */
    wrap.appendChild(h('div', { class: 'panel' }, [
      h('div', { class: 'panel-head' }, [icon('user', 'sub'), h('h2', { text: 'Identity' }), h('div', { class: 'spacer' }), h('span', { class: 'sub', text: 'Shown throughout the workspace' })]),
      h('div', { class: 'panel-body flush' }, [
        textRow('Display name', 'Appears on the sidebar, the lock screen and outgoing correspondence.', 'profile', 'name', { max: 48 }),
        textRow('Job title', 'Shown beneath your name.', 'profile', 'title', { max: 60 }),
        textRow('Division', 'Shown in the title bar.', 'profile', 'division', { max: 48 }),
        textRow('Organisation', 'Used on the workspace header.', 'profile', 'company', { max: 48 }),
        textRow('Location', 'Shown on the status bar.', 'profile', 'location', { max: 32 }),
        textRow('Email address', 'Used as the sender on outgoing correspondence.', 'profile', 'email', { max: 64, type: 'email' }),
        textRow('Reference', 'Your personal reference on documents.', 'profile', 'reference', { max: 16 })
      ])
    ]));

    /* ---- Appearance ---- */
    wrap.appendChild(h('div', { class: 'panel' }, [
      h('div', { class: 'panel-head' }, [icon('settings', 'sub'), h('h2', { text: 'Appearance' })]),
      h('div', { class: 'panel-body flush' }, [
        segRow('Theme', 'Follow the system setting, or pin one.', 'appearance', 'theme', [
          { value: 'dark', label: 'Midnight' }, { value: 'light', label: 'Daylight' }, { value: 'auto', label: 'Automatic' }
        ], function () { KH.app.applyAppearance(); }),
        row('Accent colour', 'Used for highlights, focus and the primary action.',
          h('div', { class: 'swatches', role: 'group', 'aria-label': 'Accent colour' }, ACCENTS.map(function (a) {
            return h('button', {
              type: 'button', class: 'swatch-btn', title: a.label, 'aria-label': a.label,
              'aria-pressed': KH.store.get('appearance').accent === a.id ? 'true' : 'false',
              style: { background: a.swatch },
              onclick: function (ev) {
                KH.store.set('appearance', { accent: a.id });
                KH.dom.$$('.swatch-btn', ev.target.parentNode).forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
                ev.target.setAttribute('aria-pressed', 'true');
                KH.app.applyAppearance();
              }
            });
          }))),
        segRow('Layout density', 'How much room each row is given.', 'appearance', 'density', [
          { value: 'compact', label: 'Compact' }, { value: 'normal', label: 'Normal' }, { value: 'roomy', label: 'Roomy' }
        ], function () { KH.app.applyAppearance(); }),
        switchRow('Glass and lighting effects', 'Turn off on a modest machine for a flatter, faster interface.', 'appearance', 'effects', function () { KH.app.applyAppearance(); }),
        switchRow('Interface motion', 'Background drift, transitions and the ticker tape.', 'appearance', 'motion', function () { KH.app.applyAppearance(); }),
        switchRow('Collapse navigation to icons', 'Gives the content pane the full width.', 'appearance', 'rail', function () { KH.app.applyAppearance(); })
      ])
    ]));

    /* ---- Workspace ---- */
    wrap.appendChild(h('div', { class: 'panel' }, [
      h('div', { class: 'panel-head' }, [icon('globe', 'sub'), h('h2', { text: 'Workspace' })]),
      h('div', { class: 'panel-body flush' }, [
        selectRow('Reporting currency', 'Applies to every figure in the workspace.', 'workspace', 'currency',
          fmt.currencies.map(function (c) { return { value: c, label: c }; }),
          function (v) { fmt.setCurrency(v); KH.app.refreshAll(); }),
        segRow('Market pace', 'How briskly quoted prices are refreshed.', 'workspace', 'marketSpeed', [
          { value: 'calm', label: 'Calm' }, { value: 'normal', label: 'Normal' }, { value: 'brisk', label: 'Brisk' }
        ], function (v) { KH.market.setSpeed(v); }),
        switchRow('Desktop notifications', 'Incoming messages raise a notice in the corner.', 'workspace', 'notifications'),
        switchRow('Interface sounds', 'Chimes on navigation, notices, orders and the lock screen.', 'workspace', 'sounds', function (on) {
          if (on) KH.sound.play('toast');
        }),
        switchRow('Ticker tape', 'The scrolling price strip along the status bar.', 'workspace', 'ticker', function () { KH.app.applyAppearance(); })
      ])
    ]));

    /* ---- Standing ---- */
    wrap.appendChild(h('div', { class: 'panel' }, [
      h('div', { class: 'panel-head' }, [icon('building', 'sub'), h('h2', { text: 'Group standing' }), h('div', { class: 'spacer' }), h('span', { class: 'sub', text: 'Scales the entire book' })]),
      h('div', { class: 'panel-body flush' }, [wealthRow()])
    ]));

    /* ---- Dealing account ---- */
    var t = KH.store.get('trading');
    wrap.appendChild(h('div', { class: 'panel' }, [
      h('div', { class: 'panel-head' }, [icon('chart', 'sub'), h('h2', { text: 'Dealing account' })]),
      h('div', { class: 'panel-body flush' }, [
        row('Opening capital', 'The balance the account is restored to when it is reset.',
          h('input', {
            class: 'field num', type: 'number', min: '0', step: '1000', value: String(t.startingCash),
            'aria-label': 'Opening capital',
            onchange: function (ev) {
              var v = Math.max(0, Math.floor(Number(ev.target.value) || 0));
              KH.store.set('trading', { startingCash: v });
              ev.target.value = String(v);
            }
          })),
        row('Settled cash', 'Currently available to invest.', h('span', { class: 'num', style: { fontWeight: '600' }, text: fmt.money(t.cash, 0) })),
        row('Reset dealing account', 'Closes every open position and restores the opening capital.',
          h('button', {
            class: 'btn', type: 'button', text: 'Reset account',
            onclick: function () {
              var start = KH.store.get('trading').startingCash;
              KH.store.set('trading', { cash: start, positions: {}, blotter: [] });
              KH.app.refreshAll();
              KH.app.toast('Dealing account reset', 'Positions closed and cash restored to ' + fmt.money(start, 0) + '.');
            }
          }))
      ])
    ]));

    /* ---- Data ---- */
    wrap.appendChild(h('div', { class: 'panel danger-zone' }, [
      h('div', { class: 'panel-head' }, [icon('alert', 'sub'), h('h2', { text: 'Stored data' })]),
      h('div', { class: 'panel-body flush' }, [
        row('Storage',
          KH.store.isPersistent()
            ? 'Settings, positions and read state are kept in this browser only. Nothing leaves this machine.'
            : 'This browser will not allow local storage, so changes will last only until the window is closed.',
          h('span', { class: 'chip ' + (KH.store.isPersistent() ? 'good' : 'warn'), text: KH.store.isPersistent() ? 'Local' : 'Session only' })),
        row('Clear everything', 'Restores the workspace to its original state, including your identity.',
          h('button', {
            class: 'btn', type: 'button', text: 'Restore defaults',
            onclick: function (ev) {
              var btn = ev.target;
              if (btn.dataset.armed !== '1') {
                btn.dataset.armed = '1';
                btn.textContent = 'Confirm — this cannot be undone';
                setTimeout(function () {
                  if (btn.isConnected) { btn.dataset.armed = '0'; btn.textContent = 'Restore defaults'; }
                }, 5000);
                return;
              }
              KH.store.reset();
              fmt.setCurrency(KH.store.get('workspace').currency);
              KH.app.applyAppearance();
              KH.app.refreshAll();
              KH.app.toast('Workspace restored', 'Every setting is back to its original value.');
            }
          }))
      ])
    ]));

    /* ---- About ---- */
    wrap.appendChild(h('div', { class: 'panel' }, [
      h('div', { class: 'panel-head' }, [icon('info', 'sub'), h('h2', { text: 'About' })]),
      h('div', { class: 'panel-body' }, [
        h('div', { style: { display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' } }, [
          h('img', { src: 'assets/kellett-logo-320.webp', alt: 'Kellett Holdings', style: { height: '54px', width: 'auto', filter: 'var(--logo-lift)' } }),
          h('div', { style: { minWidth: '0', lineHeight: '1.6', fontSize: 'var(--type-meta)', color: 'var(--text-secondary)' } }, [
            h('div', {}, [h('b', { style: { color: 'var(--text-primary)' }, text: 'Group Principal Workspace' }), ' · build 1.0.0']),
            h('div', { text: 'Runs entirely on this machine. It makes no network connections of any kind.' }),
            h('div', { text: 'Kellett Holdings — A Brighter Tomorrow. Together.' })
          ])
        ])
      ])
    ]));
  }

  KH.views = KH.views || {};
  KH.views.settings = {
    id: 'settings', label: 'Settings', icon: 'settings',
    mount: mount,
    remount: true,   // rebuilt on each visit so every control shows current state
    activate: function () {}
  };
})(window.KH);

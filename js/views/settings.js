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
        switchRow('Ticker tape', 'The scrolling price strip along the status bar.', 'workspace', 'ticker', function () { KH.app.applyAppearance(); })
      ])
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
          h('img', { src: 'assets/kellett-logo-320.png', alt: 'Kellett Holdings', style: { height: '54px', width: 'auto', filter: 'var(--logo-lift)' } }),
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

/* ============================================================
   The shell: start-up, navigation, the status bar, the ticker
   tape, the lock screen and the notification corner.
   ============================================================ */

(function (KH) {
  'use strict';

  var h = KH.dom.h, $ = KH.dom.$, icon = KH.dom.icon, fmt = KH.fmt;

  var ORDER = ['overview', 'empire', 'property', 'markets', 'lifestyle', 'assets', 'mail', 'messages', 'advisor', 'settings'];
  var mounted = {};
  var currentView = null;
  var navButtons = {};
  var tickerState = { offset: 0, items: [], raf: null, width: 0 };

  /* ============================================================
     Group capitalisation

     One dial scales the whole book. The register is rescaled from
     its authored values, and the dealing account moves with it in
     proportion so open positions and cash stay coherent.
     ============================================================ */

  var MIN_NET = 15000;
  var MAX_NET = 15000000;

  function clampNet(n) { return KH.util.clamp(Number(n) || MIN_NET, MIN_NET, MAX_NET); }
  function factorFor(net) { return clampNet(net) / KH.assets.baseNet(); }

  /** Apply the dial. `moveAccount` rescales cash as well, which is what
      you want when the dial is dragged and not when the app is opening. */
  function applyWealth(net, moveAccount) {
    net = clampNet(net);
    var before = KH.assets.scale();
    var after = factorFor(net);
    KH.assets.setScale(after);
    if (before > 0 && KH.sim.rescaleMarket) KH.sim.rescaleMarket(after / before);
    if (moveAccount && before > 0) {
      var t = KH.game.get().treasury;
      var ratio = after / before;
      t.cash = Math.round(t.cash * ratio * 100) / 100;
      t.opening = Math.round(t.opening * ratio * 100) / 100;
      t.debt = Math.round(t.debt * ratio * 100) / 100;
      KH.game.get().props.forEach(function (pr) {
        pr.value = Math.round(pr.value * ratio);
        pr.paid = Math.round(pr.paid * ratio);
        pr.rent = Math.round(pr.rent * ratio);
      });
      KH.game.get().lifestyle.forEach(function (l) {
        l.value = Math.round(l.value * ratio);
        l.paid = Math.round(l.paid * ratio);
      });
      KH.game.save();
    }
    KH.store.set('workspace', { netWorth: net });
  }

  /* ============================================================
     Appearance
     ============================================================ */

  var systemDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function resolveTheme(pref) {
    if (pref === 'auto') return systemDark && systemDark.matches ? 'dark' : 'light';
    return pref === 'light' ? 'light' : 'dark';
  }

  function applyAppearance() {
    var a = KH.store.get('appearance');
    var w = KH.store.get('workspace');
    var root = document.documentElement;

    root.setAttribute('data-theme', resolveTheme(a.theme));
    root.setAttribute('data-accent', a.accent || 'default');
    root.setAttribute('data-density', a.density || 'normal');
    root.style.setProperty('--speed', a.motion ? '1' : '0.001');

    document.body.classList.toggle('reduced-effects', !a.effects);
    document.body.classList.toggle('motion-off', !a.motion);
    document.body.classList.toggle('rail', !!a.rail);

    var ticker = $('#ticker');
    if (ticker) ticker.parentNode.style.display = w.ticker ? '' : 'none';

    var railBtn = $('#btn-rail');
    if (railBtn) railBtn.setAttribute('aria-pressed', a.rail ? 'true' : 'false');
  }

  if (systemDark && systemDark.addEventListener) {
    systemDark.addEventListener('change', function () {
      if (KH.store.get('appearance').theme === 'auto') { applyAppearance(); refreshAll(); }
    });
  }

  /* ============================================================
     Identity
     ============================================================ */

  function applyIdentity() {
    var p = KH.store.get('profile');
    var name = String(p.name || '').trim() || 'Unnamed';
    var ini = fmt.initials(name);

    $('#id-name').textContent = name;
    $('#id-title').textContent = p.title || '';
    $('#id-avatar').textContent = ini;
    $('#brand-sub').textContent = p.division || p.company || '';
    $('#lock-name').textContent = name;
    $('#lock-title').textContent = p.title || '';
    $('#lock-avatar').textContent = ini;
    $('#status-region').textContent = (p.location || 'London').toUpperCase();
    $('#clearance').textContent = 'Clearance: Tier 1 — ' + (p.title || 'Principal').split(' ').slice(-1)[0];
    document.title = (p.company || 'Kellett Holdings') + ' — ' + (p.division || 'Workspace');
  }

  /* ============================================================
     Mail state helpers, kept here so every view agrees
     ============================================================ */

  function mailState() { return KH.store.get('mail'); }

  function isUnread(m) {
    if (m.folder === 'sent' || m.folder === 'drafts') return false;
    return mailState().read.indexOf(m.id) === -1 && m.unread !== false;
  }
  function isFlagged(m) { return mailState().flagged.indexOf(m.id) !== -1; }
  function isDeleted(m) { return mailState().deleted.indexOf(m.id) !== -1; }

  function markRead(m) {
    var s = mailState();
    if (s.read.indexOf(m.id) === -1) { s.read.push(m.id); KH.store.save(); updateBadges(); }
  }
  function toggleFlag(m) {
    var s = mailState();
    var i = s.flagged.indexOf(m.id);
    if (i === -1) s.flagged.push(m.id); else s.flagged.splice(i, 1);
    KH.store.save();
  }
  function deleteMessage(m) {
    var s = mailState();
    if (s.deleted.indexOf(m.id) === -1) { s.deleted.push(m.id); KH.store.save(); updateBadges(); }
  }

  /* ============================================================
     Navigation
     ============================================================ */

  function buildNav() {
    var nav = $('#nav');
    KH.dom.clear(nav);
    ORDER.forEach(function (id) {
      var v = KH.views[id];
      if (!v) return;
      var badge = h('span', { class: 'badge', hidden: true });
      var btn = h('button', {
        class: 'nav-item', type: 'button', role: 'tab', id: 'tab-' + id,
        'aria-controls': 'view-' + id, 'aria-selected': 'false', tabindex: '-1',
        onclick: function () { go(id); },
        onkeydown: function (ev) { navKeys(ev, id); }
      }, [icon(v.icon), h('span', { class: 'label', text: v.label }), badge]);
      btn._badge = badge;
      navButtons[id] = btn;
      nav.appendChild(btn);
    });
  }

  function navKeys(ev, id) {
    var i = ORDER.indexOf(id);
    var next = null;
    if (ev.key === 'ArrowDown') next = ORDER[(i + 1) % ORDER.length];
    else if (ev.key === 'ArrowUp') next = ORDER[(i - 1 + ORDER.length) % ORDER.length];
    else if (ev.key === 'Home') next = ORDER[0];
    else if (ev.key === 'End') next = ORDER[ORDER.length - 1];
    if (next) { ev.preventDefault(); navButtons[next].focus(); go(next); }
  }

  function go(id) {
    if (!KH.views[id]) return;
    var view = KH.views[id];
    var section = $('#view-' + id);

    ORDER.forEach(function (other) {
      var s = $('#view-' + other);
      if (s) s.hidden = other !== id;
      var b = navButtons[other];
      if (b) {
        b.setAttribute('aria-selected', other === id ? 'true' : 'false');
        b.setAttribute('tabindex', other === id ? '0' : '-1');
        if (other === id) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
      }
    });

    if (!mounted[id] || view.remount) {
      KH.dom.clear(section);
      try { view.mount(section); mounted[id] = true; }
      catch (err) {
        console.error('view "' + id + '" failed to build', err);
        KH.dom.fill(section, h('div', { class: 'empty', style: { margin: 'auto' } }, [
          icon('alert'), h('span', { text: 'This panel could not be displayed.' })
        ]));
      }
    } else if (view.activate) {
      try { view.activate(); } catch (err) { console.error('view "' + id + '" failed to refresh', err); }
    }

    section.classList.remove('entering');
    void section.offsetWidth;
    section.classList.add('entering');
    if (currentView && currentView !== id) KH.sound.play('nav');
    currentView = id;
    updateBadges();
  }

  function updateBadges() {
    ORDER.forEach(function (id) {
      var v = KH.views[id], b = navButtons[id];
      if (!v || !b || !v.badge) return;
      var n = v.badge();
      b._badge.hidden = !n;
      b._badge.textContent = n > 99 ? '99+' : String(n);
    });
    var unread = KH.views.mail.badge() + KH.views.messages.badge();
    var p = KH.store.get('profile');
    document.title = (unread ? '(' + unread + ') ' : '') + (p.company || 'Kellett Holdings') + ' — ' + (p.division || 'Workspace');
  }

  /* ============================================================
     Status bar
     ============================================================ */

  function startClock() {
    function paint() {
      var now = new Date();
      $('#status-clock').textContent = fmt.timeSec(now);
      $('#lock-clock').textContent = fmt.time(now);
      $('#lock-date').textContent = fmt.longDate(now);
      var s = KH.market.session();
      $('#status-session').textContent = s.label;
    }
    paint();
    setInterval(paint, 1000);
  }

  function updateMiniStat() {
    var w = KH.sim.netWorth();
    var g = KH.game.get();
    $('#mini-net').textContent = fmt.moneyShort(w.total);
    var d = w.total - g.treasury.opening;
    var wk = $('#mini-week');
    if (wk) wk.textContent = 'Week ' + g.clock.week + ' \u00b7 Year ' + g.clock.year;
    KH.dom.fill($('#mini-delta'), h('span', { class: 'delta ' + fmt.dir(d), style: { fontSize: 'var(--type-meta)' } }, [
      h('span', { class: 'arrow', text: fmt.arrow(d), 'aria-hidden': 'true' }),
      h('span', { text: fmt.signedShort(d) + ' since start' })
    ]));
  }

  /* ============================================================
     Ticker tape
     ============================================================ */

  function buildTicker() {
    var track = $('#ticker-track');
    KH.dom.clear(track);
    tickerState.items = [];

    var lines = KH.market.tape().concat(KH.market.book().slice(0, 12));

    // Twice through, so the strip can wrap without a visible seam.
    for (var pass = 0; pass < 2; pass++) {
      lines.forEach(function (inst) {
        var px = h('span', { class: 't-px' });
        var delta = h('span', {});
        var item = h('span', { class: 'ticker-item' }, [
          h('span', { class: 't-sym', text: inst.sym }),
          px,
          h('span', { class: 't-sep', text: '│' }),
          delta
        ]);
        tickerState.items.push({ inst: inst, px: px, delta: delta });
        track.appendChild(item);
      });
    }
    paintTicker();
    requestAnimationFrame(function () {
      tickerState.width = track.scrollWidth / 2;
      startTickerLoop();
    });
  }

  function paintTicker() {
    tickerState.items.forEach(function (t) {
      var ch = KH.market.change(t.inst);
      t.px.textContent = (t.inst.unit === undefined ? '' : t.inst.unit) + fmt.group(t.inst.px, t.inst.dp === undefined ? 2 : t.inst.dp);
      KH.dom.fill(t.delta, h('span', { class: 'delta ' + fmt.dir(ch.pct) }, [
        h('span', { class: 'arrow', text: fmt.arrow(ch.pct), 'aria-hidden': 'true' }),
        h('span', { text: fmt.pct(ch.pct) })
      ]));
    });
  }

  function startTickerLoop() {
    var track = $('#ticker-track');
    var last = performance.now();
    cancelAnimationFrame(tickerState.raf);

    function frame(now) {
      var dt = Math.min(64, now - last);
      last = now;
      if (!document.hidden && KH.store.get('appearance').motion && KH.store.get('workspace').ticker) {
        tickerState.offset += (dt / 1000) * 46;
        if (tickerState.width && tickerState.offset >= tickerState.width) tickerState.offset -= tickerState.width;
        track.style.transform = 'translateX(' + (-tickerState.offset).toFixed(1) + 'px)';
      }
      tickerState.raf = requestAnimationFrame(frame);
    }
    tickerState.raf = requestAnimationFrame(frame);
  }

  /* ============================================================
     Notifications
     ============================================================ */

  var TOAST_SOUND = { alert: 'error', check: 'money', chat: 'message', info: 'toast' };

  function toast(title, detail, kind) {
    var host = $('#toasts');
    if (!host) return;
    KH.sound.play(TOAST_SOUND[kind] || 'toast');
    var node = h('div', { class: 'toast' }, [
      icon(kind || 'info'),
      h('div', { class: 't-body' }, [h('b', { text: title }), detail ? h('span', { text: detail }) : null])
    ]);
    host.appendChild(node);
    while (host.children.length > 2) host.removeChild(host.firstChild);
    setTimeout(function () {
      node.classList.add('out');
      setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 400);
    }, 5200);
  }

  /* ============================================================
     Window chrome and the lock screen
     ============================================================ */

  function wireChrome() {
    $('#win-min').addEventListener('click', function () {
      document.body.classList.toggle('minimised');
    });
    $('#win-max').addEventListener('click', function () {
      document.body.classList.toggle('maximised');
    });
    $('#win-close').addEventListener('click', lock);
    $('#btn-unlock').addEventListener('click', unlock);
    $('#btn-rail').addEventListener('click', function () {
      var a = KH.store.get('appearance');
      KH.store.set('appearance', { rail: !a.rail });
      applyAppearance();
    });

    $('#global-search').addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter') return;
      var q = ev.target.value.trim();
      if (!q) return;
      go('mail');
      KH.views.mail.search(q);
    });

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && document.body.classList.contains('minimised')) {
        document.body.classList.remove('minimised');
      }
      // 1-9 select the first nine panels and 0 selects the tenth. A string
      // comparison would read '4' as greater than '10' once there were ten.
      if ((ev.ctrlKey || ev.metaKey) && /^[0-9]$/.test(ev.key)) {
        var index = ev.key === '0' ? 9 : Number(ev.key) - 1;
        if (index < ORDER.length) {
          ev.preventDefault();
          go(ORDER[index]);
          navButtons[ORDER[index]].focus();
        }
      }
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'l') { ev.preventDefault(); lock(); }
    });
  }

  function lock() {
    KH.sound.play('lock');
    $('#lock').hidden = false;
    $('#shell').classList.add('is-hidden');
    setTimeout(function () { $('#btn-unlock').focus(); }, 60);
  }

  function unlock() {
    KH.sound.play('unlock');
    $('#lock').hidden = true;
    $('#shell').classList.remove('is-hidden');
    if (currentView && navButtons[currentView]) navButtons[currentView].focus();
  }

  /* ============================================================
     The floor: state support rather than a game over
     ============================================================ */

  var bailoutOpen = false;

  function offerBailout(offer) {
    if (bailoutOpen) return;
    bailoutOpen = true;
    KH.sound.play('alert');

    var host = $('#modal');
    host.hidden = false;
    KH.dom.fill(host, h('div', { class: 'modal-card glass', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Treasury stabilisation facility' }, [
      h('div', { class: 'modal-head' }, [
        icon('shield'),
        h('div', {}, [
          h('b', { text: 'Treasury stabilisation facility' }),
          h('span', { text: 'Round ' + offer.round + ' \u00b7 HM Treasury, Corporate Resilience Unit' })
        ])
      ]),
      h('div', { class: 'modal-body' }, [
        h('p', { text: 'The group has gone below zero. A company of this size will not be allowed to fail, and the Treasury has put terms on the table. They are not generous, and each round is worse than the last \u2014 but you remain in post, and there is no version of this where you lose.' }),
        h('dl', { class: 'kv modal-kv' }, [
          h('dt', { text: 'Facility offered' }), h('dd', { text: fmt.money(offer.amount, 0) }),
          h('dt', { text: 'Equity taken by the state' }), h('dd', { text: (offer.equity * 100).toFixed(0) + '%' }),
          h('dt', { text: 'Interest' }), h('dd', { text: (offer.rate * 100).toFixed(1) + '% per annum' }),
          h('dt', { text: 'Reputation cost' }), h('dd', { text: '-' + offer.reputation + ' points' }),
          h('dt', { text: 'Additional scrutiny' }), h('dd', { text: '+' + offer.scrutiny + ' points' }),
          h('dt', { text: 'Oversight period' }), h('dd', { text: offer.oversightWeeks + ' weeks' })
        ])
      ]),
      h('div', { class: 'modal-actions' }, [
        h('button', {
          class: 'btn', type: 'button', text: 'Decline and trade on',
          onclick: function () {
            close();
            toast('Facility declined', 'You are trading while overdrawn. The offer will come back, on worse terms.', 'alert');
          }
        }),
        h('button', {
          class: 'btn primary', type: 'button', text: 'Accept ' + fmt.moneyShort(offer.amount),
          onclick: function () {
            KH.sim.takeBailout();
            close();
            toast('State support drawn', fmt.money(offer.amount, 0) + ' received. The Treasury is now a shareholder.', 'money');
            refreshAll();
          }
        })
      ])
    ]));

    function close() {
      host.hidden = true;
      KH.dom.clear(host);
      bailoutOpen = false;
    }
  }

  /* ============================================================
     Refresh fan-out
     ============================================================ */

  function refreshAll() {
    applyIdentity();
    updateMiniStat();
    updateBadges();
    paintTicker();
    ORDER.forEach(function (id) {
      var v = KH.views[id];
      if (mounted[id] && v && v.refresh) {
        try { v.refresh(); } catch (err) { console.error('refresh of "' + id + '" failed', err); }
      }
    });
  }

  /* ============================================================
     Start-up
     ============================================================ */

  var STAGES = [
    { at: 0, text: 'Initialising workspace' },
    { at: 22, text: 'Establishing secure channel' },
    { at: 44, text: 'Authenticating principal' },
    { at: 62, text: 'Loading asset register' },
    { at: 78, text: 'Subscribing to market data' },
    { at: 92, text: 'Synchronising correspondence' },
    { at: 100, text: 'Ready' }
  ];

  function boot() {
    var a = KH.store.get('appearance');
    fmt.setCurrency(KH.store.get('workspace').currency);
    KH.assets.setScale(factorFor(KH.store.get('workspace').netWorth));
    applyAppearance();
    applyIdentity();

    KH.market.init();
    KH.assets.setScale(factorFor(KH.store.get('workspace').netWorth));

    buildNav();
    wireChrome();
    buildTicker();
    startClock();

    KH.bus.on('market:tick', function (payload) {
      paintTicker();
      updateMiniStat();
      var v = KH.views[currentView];
      if (v && v.tick) {
        try { v.tick(payload); } catch (err) { console.error('tick in "' + currentView + '" failed', err); }
      }
    });

    KH.bus.on('sim:week', function (p) {
      updateMiniStat();
      updateBadges();
      if (p.manual) return;
      var v = KH.views[currentView];
      if (v && v.refresh) { try { v.refresh(); } catch (err) { console.error(err); } }
    });
    KH.bus.on('sim:insolvent', offerBailout);
    KH.bus.on('sim:scandal', function (p) {
      toast('Whistleblower at ' + p.sym, p.exec + ' \u2014 ' + fmt.money(p.amount, 0) + ' unaccounted for.', 'alert');
    });
    // The news feed on Command is the record; only the things that need a
    // decision interrupt. A wall of notices is worse than none.
    KH.bus.on('game:news', function (n) {
      if (!KH.store.get('workspace').notifications) return;
      if (!/whistleblower|audit at|state support|control acquired|works paused|delay at/i.test(n.head)) return;
      toast(n.head, n.body, n.tone === 'bad' ? 'alert' : 'info');
    });
    KH.bus.on('chat:incoming', updateBadges);
    KH.bus.on('chat:read', updateBadges);
    KH.bus.on('mail:read', updateBadges);
    KH.bus.on('portfolio:changed', function () { updateMiniStat(); if (mounted.overview) KH.views.overview.refresh(); });
    KH.bus.on('profile:changed', applyIdentity);
    KH.bus.on('storage:unavailable', function () {
      toast('Settings will not persist', 'This browser is not allowing local storage, so changes last only for this session.', 'alert');
    });

    go('overview');
    updateMiniStat();

    var bar = $('#splash-progress');
    var label = $('#splash-status');
    var i = 0;
    var fast = !a.motion;

    function advance() {
      var stage = STAGES[i];
      bar.style.width = stage.at + '%';
      label.textContent = stage.text;
      i += 1;
      if (i < STAGES.length) {
        setTimeout(advance, fast ? 40 : 170 + Math.random() * 180);
      } else {
        setTimeout(finish, fast ? 60 : 420);
      }
    }

    function finish() {
      var splash = $('#splash');
      splash.classList.add('fade');
      $('#shell').classList.remove('is-hidden');
      setTimeout(function () { splash.hidden = true; }, 500);
      KH.market.start();
      KH.clock.start();
      KH.sound.playWhenAllowed('startup');
      KH.store.set('session', { firstRun: false, lastOpened: Date.now() });
      if (KH.store.get('workspace').notifications) {
        setTimeout(function () {
          toast('Board pack awaiting signature', 'Project NIGHTINGALE — schedule 4 requires your approval before 18:00.', 'alert');
        }, 2600);
      }
    }

    advance();
  }

  KH.app = {
    go: go, toast: toast, refreshAll: refreshAll, applyAppearance: applyAppearance,
    applyWealth: applyWealth, factorFor: factorFor, offerBailout: offerBailout,
    wealthRange: { min: MIN_NET, max: MAX_NET },
    isUnread: isUnread, isFlagged: isFlagged, isDeleted: isDeleted,
    markRead: markRead, toggleFlag: toggleFlag, deleteMessage: deleteMessage,
    updateBadges: updateBadges, lock: lock, unlock: unlock
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.KH);

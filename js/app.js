/* ============================================================
   The shell: start-up, navigation, the status bar, the ticker
   tape, the lock screen and the notification corner.
   ============================================================ */

(function (KH) {
  'use strict';

  var h = KH.dom.h, $ = KH.dom.$, icon = KH.dom.icon, fmt = KH.fmt;

  var ORDER = ['overview', 'mail', 'messages', 'assets', 'markets', 'settings'];
  var mounted = {};
  var currentView = null;
  var navButtons = {};
  var tickerState = { offset: 0, items: [], raf: null, width: 0 };

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
    var p = KH.market.portfolio();
    var net = KH.assets.total() + p.total;
    $('#mini-net').textContent = fmt.moneyShort(net);
    var d = p.sinceStart;
    KH.dom.fill($('#mini-delta'), h('span', { class: 'delta ' + fmt.dir(d), style: { fontSize: 'var(--type-meta)' } }, [
      h('span', { class: 'arrow', text: fmt.arrow(d), 'aria-hidden': 'true' }),
      h('span', { text: fmt.signed(d, 0) + ' on the account' })
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

  function toast(title, detail, kind) {
    var host = $('#toasts');
    if (!host) return;
    var node = h('div', { class: 'toast' }, [
      icon(kind || 'info'),
      h('div', { class: 't-body' }, [h('b', { text: title }), detail ? h('span', { text: detail }) : null])
    ]);
    host.appendChild(node);
    while (host.children.length > 4) host.removeChild(host.firstChild);
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
      if ((ev.ctrlKey || ev.metaKey) && ev.key >= '1' && ev.key <= String(ORDER.length)) {
        ev.preventDefault();
        go(ORDER[Number(ev.key) - 1]);
        navButtons[ORDER[Number(ev.key) - 1]].focus();
      }
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'l') { ev.preventDefault(); lock(); }
    });
  }

  function lock() {
    $('#lock').hidden = false;
    $('#shell').classList.add('is-hidden');
    setTimeout(function () { $('#btn-unlock').focus(); }, 60);
  }

  function unlock() {
    $('#lock').hidden = true;
    $('#shell').classList.remove('is-hidden');
    if (currentView && navButtons[currentView]) navButtons[currentView].focus();
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
    applyAppearance();
    applyIdentity();

    KH.market.init();

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
    isUnread: isUnread, isFlagged: isFlagged, isDeleted: isDeleted,
    markRead: markRead, toggleFlag: toggleFlag, deleteMessage: deleteMessage,
    updateBadges: updateBadges, lock: lock, unlock: unlock
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.KH);

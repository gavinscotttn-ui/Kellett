/* ============================================================
   Messaging — threads, a live queue of incoming replies, and a
   composer that actually gets an answer back.
   ============================================================ */

(function (KH) {
  'use strict';

  var h = KH.dom.h, icon = KH.dom.icon, fmt = KH.fmt;

  var el = {};
  var current = { id: null, typing: null };
  var unread = {};        // conversation id -> count
  var timers = [];
  var started = false;

  function lastMessage(c) { return c.messages[c.messages.length - 1]; }

  function mount(root) {
    root.appendChild(h('div', { class: 'view-head' }, [
      h('div', { class: 'titles' }, [
        h('div', { class: 'eyebrow', text: 'Secure messaging' }),
        h('h1', { text: 'Direct channels' })
      ]),
      h('div', { class: 'spacer' }),
      h('div', { class: 'actions' }, [
        h('span', { class: 'chip accent' }, [icon('shield'), h('span', { text: 'End-to-end' })])
      ])
    ]));

    var layout = h('div', { class: 'msg-layout' });
    root.appendChild(layout);

    el.list = h('div', { class: 'rows scroll', style: { flex: '1', minHeight: '0' } });
    layout.appendChild(h('div', { class: 'msg-list' }, el.list));

    el.thread = h('div', { class: 'msg-thread' });
    layout.appendChild(el.thread);

    renderList();
    select(KH.chats.all[0].id);
    startQueue();
  }

  function renderList() {
    if (!el.list) return;
    var ordered = KH.chats.all.slice().sort(function (a, b) {
      return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || lastMessage(b).when - lastMessage(a).when;
    });

    KH.dom.fill(el.list, ordered.map(function (c) {
      var last = lastMessage(c);
      var who = last.from === 'self' ? 'You' : fmt.firstName(KH.people.get(last.from).name);
      var n = unread[c.id] || 0;
      return h('button', {
        class: 'row' + (n ? ' unread' : ''), type: 'button',
        'aria-selected': c.id === current.id ? 'true' : 'false',
        onclick: function () { select(c.id); }
      }, [
        h('span', { class: 'avatar sm', style: { background: c.color }, text: c.initials, 'aria-hidden': 'true' }),
        h('span', { class: 'main' }, [
          h('span', { class: 'line1' }, [
            h('b', { text: c.name }),
            h('span', { class: 'when', text: fmt.whenShort(last.when) })
          ]),
          h('span', { class: 'line2', text: who + ': ' + last.text })
        ]),
        n ? h('span', { class: 'badge', text: String(n) }) : (c.pinned ? icon('pin', 'sub') : null)
      ]);
    }));
  }

  function select(id) {
    current.id = id;
    unread[id] = 0;
    renderList();
    renderThread();
    KH.bus.emit('chat:read');
  }

  function renderThread() {
    var c = KH.chats.get(current.id);
    if (!c) return;

    el.scroll = h('div', { class: 'thread-scroll scroll' });

    var input = h('textarea', {
      class: 'field', rows: 1, placeholder: 'Write a message…', 'aria-label': 'Message ' + c.name,
      onkeydown: function (ev) {
        if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); send(); }
      }
    });

    function send() {
      var text = input.value.trim();
      if (!text) return;
      input.value = '';
      c.messages.push({ from: 'self', text: text, when: Date.now() });
      renderThread();
      renderList();
      scheduleReply(c);
    }

    KH.dom.fill(el.thread, [
      h('div', { class: 'thread-head' }, [
        h('span', { class: 'avatar', style: { background: c.color }, text: c.initials, 'aria-hidden': 'true' }),
        h('span', { class: 'who' }, [h('b', { text: c.name }), h('span', { text: c.sub })]),
        h('div', { style: { flex: '1' } }),
        c.kind === 'group'
          ? h('span', { class: 'chip', text: c.members.length + 1 + ' participants' })
          : h('span', { class: 'chip good' }, [h('span', { class: 'dot-flag', style: { background: 'var(--up)' } }), h('span', { text: 'Available' })])
      ]),
      el.scroll,
      h('div', { class: 'composer' }, [
        input,
        h('button', { class: 'btn primary', type: 'button', onclick: send, 'aria-label': 'Send message' }, [icon('send'), h('span', { text: 'Send' })])
      ])
    ]);

    paintMessages(c);
  }

  function paintMessages(c) {
    if (!el.scroll) return;
    KH.dom.clear(el.scroll);
    var lastDay = '';

    c.messages.forEach(function (m) {
      var day = new Date(m.when).toDateString();
      if (day !== lastDay) {
        lastDay = day;
        var label = day === new Date().toDateString() ? 'Today' : fmt.dayMonth(m.when);
        el.scroll.appendChild(h('div', { class: 'day-sep', text: label }));
      }
      var mine = m.from === 'self';
      var p = mine ? null : KH.people.get(m.from);
      el.scroll.appendChild(h('div', { class: 'bubble-row' + (mine ? ' mine' : '') }, [
        mine ? null : h('span', { class: 'avatar sm', style: { background: p.color }, text: p.initials, 'aria-hidden': 'true' }),
        h('div', {}, [
          (!mine && c.kind === 'group') ? h('div', { class: 'who-tag', text: p.name }) : null,
          h('div', { class: 'bubble' }, [
            h('span', { text: m.text }),
            h('span', { class: 'stamp', text: fmt.time(m.when) })
          ])
        ])
      ]));
    });

    if (current.typing === c.id) {
      var p2 = KH.people.get(c.kind === 'dm' ? c.with : c.members[0]);
      el.scroll.appendChild(h('div', { class: 'bubble-row' }, [
        h('span', { class: 'avatar sm', style: { background: p2.color }, text: p2.initials, 'aria-hidden': 'true' }),
        h('div', { class: 'bubble' }, h('span', { class: 'typing', 'aria-label': 'Typing' }, [h('i'), h('i'), h('i')]))
      ]));
    }

    el.scroll.scrollTop = el.scroll.scrollHeight;
  }

  /* ---------- Incoming ------------------------------------------------ */

  function deliver(conv, from, text) {
    conv.messages.push({ from: from, text: text, when: Date.now() });
    if (conv.id !== current.id) unread[conv.id] = (unread[conv.id] || 0) + 1;
    renderList();
    if (conv.id === current.id) paintMessages(conv);
    KH.bus.emit('chat:incoming', { conv: conv });
    if (KH.store.get('workspace').notifications) {
      KH.app.toast(KH.people.get(from).name, text.length > 90 ? text.slice(0, 89) + '…' : text, 'chat');
    }
  }

  function showTyping(conv, ms, then) {
    current.typing = conv.id;
    if (conv.id === current.id) paintMessages(conv);
    timers.push(setTimeout(function () {
      current.typing = null;
      then();
    }, ms));
  }

  function startQueue() {
    if (started) return;
    started = true;
    KH.chats.all.forEach(function (c) {
      (c.incoming || []).forEach(function (q) {
        timers.push(setTimeout(function () {
          showTyping(c, q.typing || 2000, function () { deliver(c, q.from, q.text); });
        }, q.at * 1000));
      });
    });
  }

  function scheduleReply(conv) {
    var pool = conv.replies || [];
    if (!pool.length) return;
    var responder = conv.kind === 'dm' ? conv.with : conv.members[conv.replyIndex % conv.members.length];
    var text = pool[conv.replyIndex % pool.length];
    conv.replyIndex += 1;
    timers.push(setTimeout(function () {
      showTyping(conv, 1400 + Math.random() * 1400, function () { deliver(conv, responder, text); });
    }, 700 + Math.random() * 900));
  }

  function totalUnread() {
    return Object.keys(unread).reduce(function (t, k) { return t + (unread[k] || 0); }, 0);
  }

  KH.views = KH.views || {};
  KH.views.messages = {
    id: 'messages', label: 'Messaging', icon: 'chat',
    mount: mount,
    activate: function () { renderList(); },
    badge: totalUnread,
    stop: function () { timers.forEach(clearTimeout); timers = []; }
  };
})(window.KH);

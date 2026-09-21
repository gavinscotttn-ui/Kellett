/* ============================================================
   Correspondence — folders, list, reading pane and a composer.
   ============================================================ */

(function (KH) {
  'use strict';

  var h = KH.dom.h, icon = KH.dom.icon, fmt = KH.fmt;

  var el = {};
  var current = { folder: 'priority', message: null, query: '', composing: null };
  var sentExtra = [];   // replies written in this session

  function allMessages() { return KH.mail.messages.concat(sentExtra); }

  function folderCount(id) {
    return allMessages().filter(function (m) {
      return m.folder === id && !KH.app.isDeleted(m) && KH.app.isUnread(m);
    }).length;
  }

  function folderTotal(id) {
    return allMessages().filter(function (m) { return m.folder === id && !KH.app.isDeleted(m); }).length;
  }

  function listFor(folder, query) {
    var q = String(query || '').trim().toLowerCase();
    return allMessages()
      .filter(function (m) {
        if (KH.app.isDeleted(m)) return false;
        if (!q && m.folder !== folder) return false;
        if (!q) return true;
        var person = KH.people.get(m.from);
        var hay = (m.subject + ' ' + m.preview + ' ' + (m.from === 'self' ? 'me' : person.name + ' ' + person.org)).toLowerCase();
        return hay.indexOf(q) !== -1;
      })
      .sort(function (a, b) { return b.when - a.when; });
  }

  function mount(root) {
    root.appendChild(h('div', { class: 'view-head' }, [
      h('div', { class: 'titles' }, [
        h('div', { class: 'eyebrow', text: 'Correspondence' }),
        h('h1', { id: 'mail-title', text: 'Priority' })
      ]),
      h('div', { class: 'spacer' }),
      h('div', { class: 'actions' }, [
        el.countChip = h('span', { class: 'chip' }),
        h('button', { class: 'btn primary', type: 'button', onclick: function () { compose(null); } }, [
          icon('edit'), h('span', { text: 'New message' })
        ])
      ])
    ]));
    el.title = KH.dom.$('#mail-title', root);

    var layout = h('div', { class: 'mail-layout' });
    root.appendChild(layout);

    el.folders = h('div', { class: 'folder-group' });
    layout.appendChild(h('div', { class: 'mail-folders scroll' }, [
      h('div', { class: 'folder-group' }, h('div', { class: 'grp-title', text: 'Mailboxes' })),
      el.folders
    ]));

    el.list = h('div', { class: 'rows scroll', style: { flex: '1', minHeight: '0' } });
    layout.appendChild(h('div', { class: 'mail-list' }, [
      h('div', { class: 'mail-list-head' }, [
        h('div', { class: 'search', style: { flex: '1' } }, [
          KH.dom.svg('svg', { 'aria-hidden': 'true' }, KH.dom.svg('use', { href: '#i-search' })),
          el.search = h('input', {
            class: 'field', type: 'search', placeholder: 'Search correspondence', 'aria-label': 'Search correspondence',
            oninput: KH.util.debounce(function (ev) { current.query = ev.target.value; renderList(); }, 140)
          })
        ])
      ]),
      el.list
    ]));

    el.reader = h('div', { class: 'mail-reader' });
    layout.appendChild(el.reader);

    renderFolders();
    renderList();
    var first = listFor(current.folder, '')[0];
    if (first) open(first.id); else renderReader(null);
  }

  function renderFolders() {
    KH.dom.fill(el.folders, KH.mail.folders.map(function (f) {
      var unread = folderCount(f.id);
      var total = folderTotal(f.id);
      return h('button', {
        class: 'folder', type: 'button', 'aria-current': f.id === current.folder ? 'true' : 'false',
        onclick: function () {
          current.folder = f.id; current.query = ''; if (el.search) el.search.value = '';
          renderFolders(); renderList();
          var first = listFor(f.id, '')[0];
          if (first) open(first.id); else renderReader(null);
        }
      }, [
        icon(f.icon),
        h('span', { class: 'label', text: f.label }),
        unread ? h('span', { class: 'badge', text: String(unread) }) : (total ? h('span', { class: 'count', text: String(total) }) : null)
      ]);
    }));
  }

  function renderList() {
    var items = listFor(current.folder, current.query);
    var folder = KH.mail.folders.filter(function (f) { return f.id === current.folder; })[0];
    if (el.title) el.title.textContent = current.query ? 'Search results' : (folder ? folder.label : 'Correspondence');
    if (el.countChip) el.countChip.textContent = items.length + (items.length === 1 ? ' item' : ' items');

    if (!items.length) {
      KH.dom.fill(el.list, h('div', { class: 'empty' }, [icon('mail'), h('span', { text: current.query ? 'Nothing matches that search' : 'This mailbox is empty' })]));
      return;
    }

    KH.dom.fill(el.list, items.map(function (m) {
      var outgoing = m.from === 'self';
      var p = outgoing ? KH.people.get(m.to) : KH.people.get(m.from);
      var unread = KH.app.isUnread(m);
      return h('button', {
        class: 'row' + (unread ? ' unread' : ''), type: 'button',
        'aria-selected': current.message === m.id ? 'true' : 'false',
        onclick: function () { open(m.id); }
      }, [
        h('span', { class: 'avatar sm', style: { background: p.color }, text: p.initials, 'aria-hidden': 'true' }),
        h('span', { class: 'main' }, [
          h('span', { class: 'line1' }, [
            h('b', { text: (outgoing ? 'To: ' : '') + p.name }),
            h('span', { class: 'when', text: fmt.whenShort(m.when) })
          ]),
          h('span', { class: 'line2', text: m.subject }),
          h('span', { class: 'line3', text: m.preview })
        ]),
        h('span', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' } }, [
          unread ? h('span', { class: 'unread-dot', title: 'Unread' }) : null,
          m.choices && m.choices.length && KH.game.get().inbox.handled[m.id] === undefined
            ? h('span', { class: 'chip warn tiny', text: 'Reply' }) : null,
          m.attachments && m.attachments.length ? icon('attach', 'sub') : null,
          KH.app.isFlagged(m) ? icon('star', 'sub') : null
        ])
      ]);
    }));
  }

  function open(id) {
    var m = allMessages().filter(function (x) { return x.id === id; })[0];
    if (!m) return;
    current.message = id;
    current.composing = null;
    KH.app.markRead(m);
    renderList();
    renderReader(m);
    KH.bus.emit('mail:read');
  }

  /* ---------- Decisions ------------------------------------------------
     A reply is a choice with a consequence: cash moves, standing moves,
     and the answer that comes back depends on what you picked. The
     decision is recorded on the saved game so it is taken once.
     -------------------------------------------------------------------- */

  function decisionFor(m) {
    var handled = KH.game.get().inbox.handled;
    return handled[m.id] === undefined ? null : m.choices[handled[m.id]];
  }

  function applyChoice(m, index) {
    var choice = m.choices[index];
    var g = KH.game.get();
    var e = choice.effect || {};
    if (e.cash) KH.game.post('correspondence', 'Arising from: ' + m.subject, e.cash);
    if (e.reputation) g.standing.reputation = KH.util.clamp(g.standing.reputation + e.reputation, 0, 100);
    if (e.scrutiny) g.standing.scrutiny = KH.util.clamp(g.standing.scrutiny + e.scrutiny, 0, 100);
    if (e.prestige) g.standing.prestige = Math.max(0, g.standing.prestige + e.prestige);
    g.inbox.handled[m.id] = index;
    KH.game.save();

    var bits = [];
    if (e.cash) bits.push(KH.fmt.signed(e.cash, 0));
    if (e.reputation) bits.push((e.reputation > 0 ? '+' : '') + e.reputation + ' reputation');
    if (e.scrutiny) bits.push((e.scrutiny > 0 ? '+' : '') + e.scrutiny + ' scrutiny');
    if (e.prestige) bits.push((e.prestige > 0 ? '+' : '') + e.prestige + ' prestige');

    KH.game.headline('Replied: ' + m.subject, choice.label + (bits.length ? ' \u2014 ' + bits.join(', ') : ''),
      (e.reputation || 0) >= 0 ? 'good' : 'bad');
    KH.app.toast('Reply sent', bits.length ? bits.join(' \u00b7 ') : choice.label, 'check');
    KH.app.refreshAll();
    renderReader(m);
  }

  function decisionBlock(m) {
    var taken = decisionFor(m);
    if (taken) {
      return h('div', { class: 'decision done' }, [
        h('div', { class: 'decision-head' }, [icon('check'), h('b', { text: 'You replied' })]),
        h('p', { class: 'decision-chosen', text: taken.label }),
        h('div', { class: 'decision-reply' }, [
          h('span', { class: 'avatar sm', style: { background: KH.people.get(m.from).color }, text: KH.people.get(m.from).initials, 'aria-hidden': 'true' }),
          h('p', { text: taken.reply })
        ])
      ]);
    }
    return h('div', { class: 'decision' }, [
      h('div', { class: 'decision-head' }, [icon('reply'), h('b', { text: 'Your response' }),
        h('span', { class: 'chip warn', text: 'Consequential' })]),
      h('div', { class: 'decision-options' }, m.choices.map(function (c, i) {
        var e = c.effect || {};
        return h('button', { class: 'decision-opt', type: 'button', onclick: function () { applyChoice(m, i); } }, [
          h('span', { class: 'opt-label', text: c.label }),
          h('span', { class: 'opt-effects' }, [
            e.cash ? h('span', { class: 'badge-stat ' + (e.cash > 0 ? 'up' : 'down'), text: KH.fmt.signedShort(e.cash) }) : null,
            e.reputation ? h('span', { class: 'badge-stat ' + (e.reputation > 0 ? 'up' : 'down'), text: (e.reputation > 0 ? '+' : '') + e.reputation + ' rep' }) : null,
            e.scrutiny ? h('span', { class: 'badge-stat ' + (e.scrutiny > 0 ? 'down' : 'up'), text: (e.scrutiny > 0 ? '+' : '') + e.scrutiny + ' scrutiny' }) : null,
            e.prestige ? h('span', { class: 'badge-stat up', text: '+' + e.prestige + ' prestige' }) : null
          ])
        ]);
      }))
    ]);
  }

  function renderReader(m) {
    if (!m) {
      KH.dom.fill(el.reader, h('div', { class: 'empty', style: { margin: 'auto' } }, [
        icon('mail'), h('span', { text: 'Select an item to read it' })
      ]));
      return;
    }

    var outgoing = m.from === 'self';
    var p = outgoing ? KH.people.get(m.to) : KH.people.get(m.from);
    var profile = KH.store.get('profile');

    var body = h('div', { class: 'reader-body scroll' }, [
      m.attachments && m.attachments.length ? h('div', { class: 'attachments' }, m.attachments.map(function (a) {
        return h('div', { class: 'attach' }, [
          h('span', { class: 'ext ' + a.ext, text: a.ext.toUpperCase() }),
          h('span', { class: 'nm' }, [h('b', { text: a.name }), h('span', { text: a.size })])
        ]);
      })) : null,
      m.body.map(function (para) { return h('p', { text: para }); }),
      m.choices && m.choices.length ? decisionBlock(m) : null,
      m.sign ? h('p', { class: 'sig' }, m.sign.split('\n').map(function (line, i) {
        return i === 0 ? h('span', { text: line }) : [h('br'), h('span', { text: line })];
      })) : null
    ]);

    KH.dom.fill(el.reader, [
      h('div', { class: 'reader-head' }, [
        h('h2', { text: m.subject }),
        h('div', { class: 'reader-meta' }, [
          h('span', { class: 'avatar', style: { background: p.color }, text: p.initials, 'aria-hidden': 'true' }),
          h('span', { class: 'who' }, [
            h('b', { text: outgoing ? profile.name + ' (you)' : p.name }),
            h('span', { text: outgoing ? 'To: ' + p.name + ' · ' + p.email : p.role + ' · ' + p.org })
          ]),
          h('span', { class: 'when' }, [
            h('span', { text: fmt.stamp(m.when) }),
            h('br'),
            h('span', { style: { opacity: '.7' }, text: 'Ref ' + m.id.toUpperCase() + '-' + profile.reference })
          ])
        ]),
        m.tags && m.tags.length ? h('div', { class: 'reader-tags' }, m.tags.map(function (t) {
          var cls = t === 'Confidential' || t === 'Do not forward' || t === 'Private' ? 'chip warn'
            : t === 'Signature required' ? 'chip hot' : 'chip';
          return h('span', { class: cls, text: t });
        })) : null
      ]),
      body,
      h('div', { class: 'reader-actions' }, [
        h('button', { class: 'btn primary', type: 'button', onclick: function () { compose(m); } }, [icon('reply'), h('span', { text: 'Reply' })]),
        h('button', { class: 'btn', type: 'button', onclick: function () { compose(m, true); } }, [icon('forward'), h('span', { text: 'Forward' })]),
        h('button', {
          class: 'btn', type: 'button',
          onclick: function () { KH.app.toggleFlag(m); renderList(); renderReader(m); }
        }, [icon('star'), h('span', { text: KH.app.isFlagged(m) ? 'Unflag' : 'Flag' })]),
        h('div', { style: { flex: '1' } }),
        h('button', {
          class: 'btn ghost', type: 'button',
          onclick: function () { KH.reports.letter(m); KH.app.toast('Exported', 'Saved as a PDF to your downloads.', 'check'); }
        }, [icon('print'), h('span', { text: 'Export PDF' })]),
        h('button', {
          class: 'btn ghost', type: 'button',
          onclick: function () {
            KH.app.deleteMessage(m);
            renderFolders(); renderList();
            var next = listFor(current.folder, current.query)[0];
            if (next) open(next.id); else renderReader(null);
            KH.app.toast('Moved to deleted items', m.subject);
          }
        }, [icon('trash'), h('span', { text: 'Delete' })])
      ])
    ]);
  }

  /* ---------- Composer ---------------------------------------------- */

  function compose(replyTo, isForward) {
    var profile = KH.store.get('profile');
    var target = replyTo ? (replyTo.from === 'self' ? replyTo.to : replyTo.from) : '';
    var subject = replyTo
      ? (isForward ? 'FW: ' : /^(RE|FW):/i.test(replyTo.subject) ? '' : 'RE: ') + replyTo.subject
      : '';

    var toField = h('select', { class: 'field', 'aria-label': 'Recipient' },
      KH.people.all.filter(function (p) { return !p.system; }).map(function (p) {
        return h('option', { value: p.id, selected: p.id === target, text: p.name + ' — ' + p.org });
      }));
    var subjField = h('input', { class: 'field', type: 'text', value: subject, placeholder: 'Subject', 'aria-label': 'Subject' });
    var bodyField = h('textarea', {
      class: 'field', 'aria-label': 'Message', style: { minHeight: '180px' },
      placeholder: 'Write your message…'
    });
    if (replyTo && !isForward) bodyField.value = '\n\n———\nOn ' + fmt.stamp(replyTo.when) + ', ' + KH.people.get(replyTo.from).name + ' wrote:\n' + replyTo.body[0];
    if (isForward) bodyField.value = '\n\n——— Forwarded message ———\n' + replyTo.body.join('\n\n');

    KH.dom.fill(el.reader, [
      h('div', { class: 'reader-head' }, [
        h('h2', { text: replyTo ? (isForward ? 'Forward message' : 'Reply') : 'New message' }),
        h('div', { class: 'reader-meta' }, [
          h('span', { class: 'avatar', text: fmt.initials(profile.name), 'aria-hidden': 'true' }),
          h('span', { class: 'who' }, [h('b', { text: profile.name }), h('span', { text: profile.email })])
        ])
      ]),
      h('div', { class: 'reader-body scroll', style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, [
        h('label', { style: { display: 'block' } }, [h('span', { class: 'lbl', style: { display: 'block', fontSize: 'var(--type-micro)', letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }, text: 'To' }), toField]),
        h('label', { style: { display: 'block' } }, [h('span', { style: { display: 'block', fontSize: 'var(--type-micro)', letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }, text: 'Subject' }), subjField]),
        bodyField
      ]),
      h('div', { class: 'reader-actions' }, [
        h('button', {
          class: 'btn primary', type: 'button',
          onclick: function () {
            var to = toField.value;
            var text = bodyField.value.trim();
            if (!text) { KH.app.toast('Nothing to send', 'The message body is empty.'); return; }
            var msg = {
              id: 'x' + Date.now().toString(36), folder: 'sent', from: 'self', to: to,
              subject: subjField.value.trim() || '(no subject)',
              body: text.split(/\n{2,}/),
              tags: [], when: Date.now(), mins: 0, sign: '',
              preview: text.slice(0, 160)
            };
            sentExtra.unshift(msg);
            current.folder = 'sent';
            renderFolders(); renderList(); open(msg.id);
            KH.app.toast('Message sent', 'Delivered to ' + KH.people.get(to).name + '.');
          }
        }, [icon('send'), h('span', { text: 'Send' })]),
        h('button', {
          class: 'btn', type: 'button', text: 'Discard',
          onclick: function () {
            var m = allMessages().filter(function (x) { return x.id === current.message; })[0];
            renderReader(m || null);
          }
        })
      ])
    ]);
    bodyField.focus();
    bodyField.setSelectionRange(0, 0);
  }

  KH.views = KH.views || {};
  KH.views.mail = {
    id: 'mail', label: 'Correspondence', icon: 'mail',
    mount: mount,
    open: open,
    search: function (q) {
      current.query = q;
      if (el.search) el.search.value = q;
      renderList();
      var first = listFor(current.folder, q)[0];
      if (first) open(first.id); else renderReader(null);
    },
    activate: function () { renderFolders(); renderList(); },
    badge: function () {
      return KH.mail.messages.filter(function (m) {
        return KH.app.isUnread(m) && !KH.app.isDeleted(m) && m.folder !== 'sent' && m.folder !== 'drafts';
      }).length;
    },
    refresh: function () { if (el.folders) { renderFolders(); renderList(); } }
  };
})(window.KH);

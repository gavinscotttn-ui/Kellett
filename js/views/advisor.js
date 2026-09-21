/* ============================================================
   Advisory — Jimmy.

   Retained at enormous expense. Reads the live state of the group
   and reaches the wrong conclusion about all of it, at volume.
   ============================================================ */

(function (KH) {
  'use strict';

  var h = KH.dom.h, icon = KH.dom.icon;
  var el = {};
  var thread = [];

  var PROMPTS = [
    'What should I do with my cash?',
    'Who should I appoint as chief executive?',
    'Is JimmyVision a good investment?',
    'How should I price my ranges?',
    'Should I take the government money?',
    'What about the regulator?',
    'Talk to me about property.',
    'Should I be worried about the audit?'
  ];

  function mount(root) {
    root.appendChild(h('div', { class: 'view-head' }, [
      h('div', { class: 'titles' }, [
        h('div', { class: 'eyebrow', text: 'Retained advisory' }),
        h('h1', { text: 'Jimmy' })
      ]),
      h('div', { class: 'spacer' }),
      h('div', { class: 'actions' }, [
        h('span', { class: 'chip warn' }, [icon('alert'), h('span', { text: 'Unverified' })]),
        h('button', {
          class: 'btn', type: 'button', text: 'Unsolicited opinion',
          onclick: function () { push('jimmy', KH.jimmy.opener() + ' ' + KH.jimmy.nudge() + ' ' + KH.jimmy.closer()); }
        })
      ])
    ]));

    var wrap = h('div', { class: 'advisor-wrap' });
    root.appendChild(wrap);

    wrap.appendChild(h('div', { class: 'advisor-banner' }, [
      h('span', { class: 'avatar lg jimmy-av', text: 'J', 'aria-hidden': 'true' }),
      h('div', { style: { minWidth: '0' } }, [
        h('b', { text: 'Jimmy — Advisory Intelligence' }),
        h('span', { text: 'Retainer ' + KH.fmt.money(900000, 0) + ' per annum · JimmyVision Corp (JVIS)' }),
        h('p', { text: 'Every figure he quotes is pulled live from your group and is correct. Every conclusion he draws from those figures is his own. The group accepts no liability for either.' })
      ])
    ]));

    el.thread = h('div', { class: 'advisor-thread scroll' });
    wrap.appendChild(el.thread);

    wrap.appendChild(h('div', { class: 'chip-row', style: { padding: '0 var(--pad) 8px' } },
      PROMPTS.map(function (p) {
        return h('button', { class: 'btn sm ghost', type: 'button', text: p, onclick: function () { send(p); } });
      })));

    var input = h('textarea', {
      class: 'field', rows: '1', placeholder: 'Ask Jimmy anything. He will have an answer.',
      'aria-label': 'Ask Jimmy',
      onkeydown: function (ev) { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); send(input.value); input.value = ''; } }
    });
    el.input = input;

    wrap.appendChild(h('div', { class: 'composer' }, [
      input,
      h('button', { class: 'btn primary', type: 'button', onclick: function () { send(input.value); input.value = ''; } },
        [icon('send'), h('span', { text: 'Ask' })])
    ]));

    if (!thread.length) {
      push('jimmy', KH.jimmy.opener() + ' Jimmy here. Advisory intelligence, twenty-four hours a day, and I have never once been asleep or right. Ask me anything at all. ' + KH.jimmy.closer());
    } else {
      paint();
    }
  }

  function send(text) {
    var t = String(text || '').trim();
    if (!t) return;
    push('me', t);
    setTimeout(function () { push('jimmy', KH.jimmy.ask(t)); }, 420 + Math.random() * 500);
  }

  function push(who, text) {
    thread.push({ who: who, text: text, at: Date.now() });
    if (thread.length > 80) thread.shift();
    paint();
    if (who === 'jimmy') KH.sound.play('message');
  }

  function paint() {
    if (!el.thread) return;
    KH.dom.fill(el.thread, thread.map(function (m) {
      var mine = m.who === 'me';
      return h('div', { class: 'bubble-row' + (mine ? ' mine' : '') }, [
        mine ? null : h('span', { class: 'avatar sm jimmy-av', text: 'J', 'aria-hidden': 'true' }),
        h('div', {}, h('div', { class: 'bubble' + (mine ? '' : ' jimmy') }, [
          h('span', { text: m.text }),
          h('span', { class: 'stamp', text: KH.fmt.time(m.at) })
        ]))
      ]);
    }));
    el.thread.scrollTop = el.thread.scrollHeight;
  }

  KH.views = KH.views || {};
  KH.views.advisor = { id: 'advisor', label: 'Advisory', icon: 'sparkle', mount: mount, activate: paint, refresh: paint };
})(window.KH);

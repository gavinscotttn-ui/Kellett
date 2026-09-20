/* ============================================================
   Messaging.

   Each thread carries its history plus a short queue of replies
   that land while the workspace is open, so the panel is never a
   still photograph. `at` is seconds after the session started.
   ============================================================ */

(function (KH) {
  'use strict';

  var CONVERSATIONS = [
    {
      id: 'nightingale', kind: 'group', name: 'Project NIGHTINGALE — deal team',
      sub: 'Tarquin, Adaeze, Renée, Evelyn', members: ['tarquin', 'okonjo', 'vasquez', 'sterling'], slot: 0, pinned: true,
      messages: [
        { from: 'okonjo', text: 'Data room closes at six. Last three questions are all tax and all answerable.', mins: 214 },
        { from: 'vasquez', text: 'Their counsel has gone quiet on the warranty cap. In my experience that means they have accepted it and are trying to look wounded.', mins: 198 },
        { from: 'sterling', text: 'I need the environmental report before I can sign the risk memo. Not a formality — Block 12 has history.', mins: 172 },
        { from: 'okonjo', text: 'Report landed twenty minutes ago. Clean, bar a decommissioning provision that is already in the model.', mins: 164 },
        { from: 'self', text: 'Good. Hold the locked box date. Everything else is negotiable and they know it.', mins: 158 },
        { from: 'tarquin', text: 'Committee at 18:00. I have put you on first because you are better before the biscuits come out.', mins: 96 },
        { from: 'vasquez', text: 'Draft 14 is with you. Clean and marked.', mins: 88 }
      ],
      incoming: [
        { from: 'okonjo', text: 'Funds flow reconciled to the penny. Treasury are happy.', at: 26, typing: 2400 },
        { from: 'tarquin', text: 'Two of the committee have read the pack. That is historically a very good number.', at: 74, typing: 2800 },
        { from: 'sterling', text: 'Risk memo signed. On the condition I put in writing that I raised the concentration point again.', at: 168, typing: 3200 },
        { from: 'vasquez', text: 'They have countered at 21.5% and a five-month tail. That is them blinking.', at: 286, typing: 2600 }
      ]
    },
    {
      id: 'stobs', kind: 'dm', with: 'stobs', slot: 1,
      messages: [
        { from: 'stobs', text: 'The deck has 41 slides.', mins: 340 },
        { from: 'self', text: 'It is a complicated business.', mins: 338 },
        { from: 'stobs', text: 'No it is not. You have made it complicated so that it feels safe.', mins: 336 },
        { from: 'stobs', text: 'One slide. One number. One sentence about why the number is the number.', mins: 334 },
        { from: 'self', text: 'And the other forty slides?', mins: 330 },
        { from: 'stobs', text: 'An appendix nobody opens, which is what they have always been.', mins: 328 }
      ],
      incoming: [
        { from: 'stobs', text: 'Send me the one slide when you have it. Not a PDF. A photograph of it on a wall.', at: 52, typing: 3000 }
      ]
    },
    {
      id: 'business', kind: 'dm', with: 'business', slot: 2,
      messages: [
        { from: 'business', text: 'Good morning. Business.', mins: 190 },
        { from: 'self', text: 'Morning. Which part of it?', mins: 188 },
        { from: 'business', text: 'All of the business. That is why I am the Chief Business Officer.', mins: 186 },
        { from: 'business', text: 'I have circulated the business to the business team. They are across the business.', mins: 184 },
        { from: 'self', text: 'Wonderful.', mins: 180 }
      ],
      incoming: [
        { from: 'business', text: 'Quick one: are we still doing the business on Thursday, or has the business moved?', at: 38, typing: 2200 },
        { from: 'business', text: 'Never mind. Business has confirmed. Business.', at: 112, typing: 1800 }
      ]
    },
    {
      id: 'ramsey', kind: 'dm', with: 'ramsey', slot: 7,
      messages: [
        { from: 'ramsey', text: 'RIGHT. THE GUILDHALL KITCHEN.', mins: 60 },
        { from: 'ramsey', text: 'IT IS A CUPBOARD. THEY HAVE SENT ME A CUPBOARD AND CALLED IT A KITCHEN.', mins: 59 },
        { from: 'self', text: 'Can you work with it?', mins: 57 },
        { from: 'ramsey', text: 'I can work with anything. I once did 400 covers out of a shed in Watford. But I need two more induction points and a man who can be trusted with a sauce.', mins: 55 },
        { from: 'self', text: 'You have both. Send the invoice to Brenda.', mins: 50 }
      ],
      incoming: [
        { from: 'ramsey', text: 'BRENDA HAS ASKED ME FOR A RECEIPT.', at: 62, typing: 1600 },
        { from: 'ramsey', text: 'I RESPECT HER ENORMOUSLY. Menu is done. It is stunning. Wear the navy.', at: 148, typing: 2800 }
      ]
    },
    {
      id: 'sterling', kind: 'dm', with: 'sterling', slot: 0,
      messages: [
        { from: 'sterling', text: 'Concentration in digital infrastructure is now 13.3% of group NAV.', mins: 420 },
        { from: 'self', text: 'It is also our best performing line by some distance.', mins: 418 },
        { from: 'sterling', text: 'Those two statements are both true and that is precisely what worries me.', mins: 416 },
        { from: 'self', text: 'Noted. Genuinely.', mins: 410 },
        { from: 'sterling', text: 'You say that in a tone I have learned to interpret.', mins: 408 }
      ],
      incoming: [
        { from: 'sterling', text: 'DR site passed its test this morning for the first time since March. Nobody can tell me why.', at: 94, typing: 2600 }
      ]
    },
    {
      id: 'mazarus', kind: 'dm', with: 'mazarus', slot: 3,
      messages: [
        { from: 'mazarus', text: 'what if the holding company. but in orbit', mins: 500 },
        { from: 'self', text: 'What would that solve?', mins: 498 },
        { from: 'mazarus', text: 'jurisdiction', mins: 496 },
        { from: 'mazarus', text: 'also it would look incredible', mins: 495 },
        { from: 'self', text: 'Let me come back to you on that.', mins: 490 }
      ],
      incoming: [
        { from: 'mazarus', text: 'have come back to you on it myself. the answer is yes. i have named it Holdings', at: 206, typing: 2000 }
      ]
    },
    {
      id: 'trotter', kind: 'dm', with: 'trotter', slot: 4,
      messages: [
        { from: 'trotter', text: 'Alright Gav. You get my email?', mins: 610 },
        { from: 'self', text: 'I did.', mins: 605 },
        { from: 'trotter', text: 'And?', mins: 604 },
        { from: 'self', text: 'What is the item, Derek.', mins: 600 },
        { from: 'trotter', text: 'I can’t say in writing. But I can say it’s premium, it’s boxed, and it’s got a plug on it.', mins: 598 }
      ],
      incoming: [
        { from: 'trotter', text: 'They’ve got a plug on them but not the right plug. Slight hiccup. Still a bargain though.', at: 132, typing: 2400 }
      ]
    },
    {
      id: 'dave', kind: 'dm', with: 'dave', slot: 5,
      messages: [
        { from: 'dave', text: 'Patching Saturday 2am. Mail will blip.', mins: 744 },
        { from: 'self', text: 'Understood.', mins: 742 },
        { from: 'dave', text: 'Also I found the thing that was unplugged.', mins: 740 },
        { from: 'self', text: 'And?', mins: 739 },
        { from: 'dave', text: 'It’s plugged in now. Let’s leave it there.', mins: 738 }
      ],
      incoming: []
    },
    {
      id: 'board', kind: 'group', name: 'Board — private', sub: 'Tarquin, Evelyn', members: ['tarquin', 'sterling'], slot: 6,
      messages: [
        { from: 'tarquin', text: 'Succession item is back on the agenda. Third time this year.', mins: 1400 },
        { from: 'sterling', text: 'Because it keeps being deferred.', mins: 1398 },
        { from: 'tarquin', text: 'It keeps being deferred because the answer keeps being in the room.', mins: 1396 },
        { from: 'self', text: 'I am reading this, you know.', mins: 1390 },
        { from: 'tarquin', text: 'We were counting on it.', mins: 1388 }
      ],
      incoming: []
    },
    {
      id: 'partridge', kind: 'dm', with: 'partridge', slot: 1,
      messages: [
        { from: 'partridge', text: 'Did the deck arrive?', mins: 666 },
        { from: 'partridge', text: 'It’s 14.8 megabytes so it may have gone to junk. Check your junk.', mins: 665 },
        { from: 'partridge', text: 'Have you checked your junk?', mins: 640 },
        { from: 'self', text: 'I have it, Alan.', mins: 600 },
        { from: 'partridge', text: 'And?', mins: 599 }
      ],
      incoming: [
        { from: 'partridge', text: 'Youth Hostelling with Chris Eubank. That’s the one. Forget the monkeys.', at: 240, typing: 3400 }
      ]
    }
  ];

  /* Replies each correspondent has in them when you write to them.
     Picked in order so a thread does not repeat itself immediately. */
  var REPLIES = {
    nightingale: [
      'Noted. I will get that in front of committee.',
      'Agreed. Adaeze, can you reflect that in the model before six?',
      'That is the right call and it is the one I would have argued for.',
      'Understood \u2014 I will put it in the memo so it is on the record.'
    ],
    stobs: [
      'Still too many words.',
      'Better. Now take half of it away again.',
      'Good. That one I would put on a wall.',
      'I am not being difficult. I am being correct, which looks similar.'
    ],
    business: [
      'Understood. I will business that immediately.',
      'Excellent business. I have forwarded the business to the business.',
      'Business received. Business.',
      'I will get my assistant Business to action the business.'
    ],
    ramsey: [
      'RIGHT. GOOD. THAT IS A DECISION. I LIKE DECISIONS.',
      'DONE. AND I AM BRINGING MY OWN PANS.',
      'FINALLY. SOMEBODY IN THIS BUILDING WITH A PALATE.',
      'IF THE SAUCE IS LATE AGAIN I AM WALKING INTO THE NORTH SEA.'
    ],
    sterling: [
      'Recorded. I will note that you were told.',
      'That helps. It does not solve it, but it helps.',
      'Thank you. I will update the register accordingly.',
      'I would like that in writing, and I suspect you knew I would.'
    ],
    mazarus: [
      'love it. shipping it tonight',
      'ok but consider: bigger',
      'have already told three people this was my idea',
      'great call. deleting the old one now'
    ],
    trotter: [
      'Lovely jubbly. You won\u2019t regret it.',
      'Say no more. Consider it sorted.',
      'Trust me, Gav. When have I ever let you down. Don\u2019t answer that.',
      'He who dares, wins.'
    ],
    dave: [
      'Righto. On it.',
      'Ticket raised. It\u2019s number 4,412 if anyone asks.',
      'Have turned it off and on again. It\u2019s fine now.',
      'Will do. Don\u2019t tell Dr Sterling.'
    ],
    board: [
      'Duly noted for the minutes.',
      'That is acceptable to the chair.',
      'We will revisit at the next scheduled meeting.',
      'Thank you. That settles it for now.'
    ],
    partridge: [
      'So that\u2019s a maybe. I\u2019ll take a maybe.',
      'Brilliant. I\u2019ll have a treatment over by Thursday. It\u2019s mostly written.',
      'Can I just check \u2014 is that a yes-maybe or a no-maybe?',
      'Understood. I\u2019ll put Monkey Tennis on the back burner. Not off. Back.'
    ]
  };

  var opened = Date.now();

  CONVERSATIONS.forEach(function (c) {
    c.color = KH.charts.seriesColor(c.slot);
    c.replies = REPLIES[c.id] || ['Understood.', 'Noted, thank you.', 'Leave it with me.'];
    c.replyIndex = 0;
    c.messages.forEach(function (m) { m.when = opened - m.mins * 60000; });
    c.messages.sort(function (a, b) { return a.when - b.when; });
    if (c.kind === 'dm') {
      var p = KH.people.get(c.with);
      c.name = p.name;
      c.sub = p.role + (p.org ? ' · ' + p.org : '');
      c.initials = p.initials;
      c.color = p.color;
    } else {
      var words = c.name.replace(/[^A-Za-z ]/g, ' ').trim().split(/\s+/).filter(Boolean);
      c.initials = (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || '??').slice(0, 2)).toUpperCase();
    }
  });

  KH.chats = {
    all: CONVERSATIONS,
    get: function (id) { return CONVERSATIONS.filter(function (c) { return c.id === id; })[0] || CONVERSATIONS[0]; }
  };
})(window.KH);

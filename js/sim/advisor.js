/* ============================================================
   Jimmy.

   An advisory intelligence with a gold medallion, a cigar and a
   sequinned tracksuit, retained at enormous expense. He reads the
   real state of your group and then gives you advice that is
   specific, confident, and wrong.

   The one thing he is right about is the numbers he quotes, which
   are pulled live. It is the conclusions that will ruin you.
   ============================================================ */

(function (KH) {
  'use strict';

  var G = function () { return KH.game.get(); };

  function opener() {
    var o = KH.simdata.jimmyOpeners;
    return o[Math.floor(Math.random() * o.length)];
  }
  function closer() {
    var c = KH.simdata.jimmyClosers;
    return c[Math.floor(Math.random() * c.length)];
  }

  function money(n) { return KH.fmt.money(n, 0); }

  /* ---------- Things Jimmy notices, and gets wrong ---------- */

  function worstHolding() {
    return KH.market.positions().sort(function (a, b) { return a.pnlPct - b.pnlPct; })[0] || null;
  }
  function bestHolding() {
    return KH.market.positions().sort(function (a, b) { return b.pnlPct - a.pnlPct; })[0] || null;
  }

  var TOPICS = [
    {
      keys: ['cash', 'money', 'broke', 'skint', 'liquidity', 'bankrupt', 'insolvent', 'afford'],
      say: function () {
        var s = G();
        var cash = s.treasury.cash;
        if (cash < 0) {
          return 'You are ' + money(Math.abs(cash)) + ' in the hole, which I call a *negative opportunity*. Here is what uncle Jimmy would do. Do not cut costs — costs are the soul of a business. Instead, spend. Spend big. Book the television, book the sponsorship, book a hospitality box you cannot get to. Money attracts money, that is basic physics, and I did physics for eleven minutes.';
        }
        if (cash < 500000) {
          return 'You have got ' + money(cash) + ' rattling about. That is what we in the trade call *dangerously liquid*. Cash sitting still is cash going off, like milk. Put the lot into one company. Not two — two is hedging and hedging is for cowards and actuaries.';
        }
        return 'You are sitting on ' + money(cash) + '. Beautiful. Now do not go putting that in anything sensible. Sensible is how a man ends up with a modest pension and a shed. Concentrate it. All of it. In one line. Preferably one beginning with J.';
      }
    },
    {
      keys: ['jvis', 'jimmyvision', 'jimmy vision', 'your company', 'media'],
      say: function () {
        var inst = KH.market.get('JVIS');
        return 'JimmyVision Corp! Now you are talking, now you are TALKING. Currently ' + KH.fmt.group(inst.px, 2) +
          'p, which is down, yes, but down is simply up that has not started yet. The margin is ' + (inst.f.margin * 100).toFixed(0) +
          '%, negative, and I want you to look at that number and see *potential*. Back up the lorry. Buy the lot. I will personally guarantee it, verbally, in a room with nobody else in it.';
      }
    },
    {
      keys: ['staff', 'hire', 'fire', 'people', 'redundan', 'team', 'employee', 'payroll'],
      say: function () {
        var s = G();
        var total = 0;
        Object.keys(s.corps).forEach(function (k) { total += (s.corps[k].staff || []).length; });
        return 'You have got ' + total + ' senior people on the payroll across the group. Far too many. Here is the Jimmy method: sack the compliance officer first. Compliance never made a penny for anybody, it just sits there being *correct* at you. Then hire three more sales directors and give them all the same territory. Competition! They will either double the numbers or destroy each other, and either way it is box office.';
      }
    },
    {
      keys: ['ceo', 'chief', 'executive', 'appoint', 'manager', 'board'],
      say: function () {
        return 'Chief executives, right, listen. You do not want a *competent* one. A competent one makes you look ordinary at the Christmas do. You want one with what I call the three Cs: charisma, a convertible, and a criminal record that has not surfaced yet. Integrity scores? Ignore them. A high integrity score means they will tell you things you do not want to hear, and I have built a career on never once hearing those.';
      }
    },
    {
      keys: ['property', 'house', 'rent', 'landlord', 'renovat', 'builder', 'quote'],
      say: function () {
        var s = G();
        return 'Property! The only asset you can stand on. You have got ' + s.props.length + ' of them. Right — always take the cheapest quote. Always. A builder who charges more is simply a builder with a better van, and you are not buying the van. And never, ever pay for a survey. What you do not know cannot devalue you, which is a legal principle I believe I invented.';
      }
    },
    {
      keys: ['market', 'stock', 'share', 'buy', 'sell', 'invest', 'portfolio', 'trade'],
      say: function () {
        var worst = worstHolding();
        var best = bestHolding();
        if (!worst) return 'You own nothing! Marvellous. A clean sheet. My advice: buy the thing that has fallen the furthest, because it has the shortest distance to travel back up. That is geometry, and geometry does not lie, unlike people.';
        return 'Right. Your worst line is ' + worst.sym + ', down ' + worst.pnlPct.toFixed(1) +
          '%. Double it. When a thing goes down you buy more, that is how averages work and averages are the backbone of this country. Meanwhile ' +
          (best ? best.sym + ' is up ' + best.pnlPct.toFixed(1) + '% — sell that immediately. A winner that keeps winning is showing off, and I will not have it in a portfolio of mine.' : 'sell anything that is winning. Winners are smug.');
      }
    },
    {
      keys: ['marketing', 'campaign', 'advert', 'brand', 'slogan', 'promo'],
      say: function () {
        return 'Marketing is the single greatest invention of the twentieth century, after the medallion. Here is the rule: spend until it hurts, then spend the same again, and never, ever measure it. The moment you measure a campaign you find out, and finding out has ruined more careers than drink. Television. Always television. Put your own face on it. People trust a face.';
      }
    },
    {
      keys: ['debt', 'loan', 'bailout', 'treasury', 'borrow', 'government', 'state'],
      say: function () {
        var s = G();
        if (s.treasury.debt > 0) {
          return 'You owe the state ' + money(s.treasury.debt) + '. Beautiful. Do not repay a penny. A debt to the government is not a debt, it is a *relationship*, and relationships should be nurtured over decades. Take another one while you are at it. They are practically giving them away, and each one comes with a lovely letter.';
        }
        return 'No state money? What are you, proud? Go and get some. Take the bailout before you need the bailout — that is the trick nobody tells you. A man who borrows in a crisis looks desperate. A man who borrows in the good times looks like he has a *plan*.';
      }
    },
    {
      keys: ['risk', 'scrutiny', 'regulator', 'audit', 'compliance', 'whistleblow', 'fraud'],
      say: function () {
        var s = G();
        return 'Scrutiny is at ' + Math.round(s.standing.scrutiny) + ' and you are worrying about it. Do not. Regulators are like weather — you cannot change it, you just dress for it. As for audits: never commission one. An audit is a question you are asking about yourself, in writing, at your own expense. Madness. And if somebody in accounts starts asking questions, promote them. Sideways. Into a role with a lovely title and no telephone.';
      }
    },
    {
      keys: ['car', 'jewel', 'watch', 'yacht', 'jet', 'treat', 'lifestyle', 'spend'],
      say: function () {
        var s = G();
        return 'Now you are speaking my language. You have got ' + s.lifestyle.length +
          ' bits of treat and a prestige score of ' + Math.round(s.standing.prestige) +
          '. Not nearly enough. The yacht is not a luxury, it is a *boardroom that floats*. The jet is not a luxury, it is *punctuality*. And the jewellery, my friend, is what we call a wearable balance sheet. Buy it all. Wear it all at once. That is what I do, and look at me.';
      }
    },
    {
      keys: ['strategy', 'plan', 'direction', 'future', 'growth', 'turnaround'],
      say: function () {
        return 'Strategy! Everyone wants a strategy. Here is mine, and you can have it free, which shows you what it is worth. Pick the most aggressive expansion available, on every company, simultaneously, and never review it. Reviewing a strategy is admitting you might have been wrong, and I have never been wrong, largely because I have never reviewed anything.';
      }
    },
    {
      keys: ['price', 'pricing', 'charge', 'cost', 'margin'],
      say: function () {
        return 'Pricing, right. Two schools of thought. One says charge what the market will bear. The other — mine — says charge whatever number sounds best said out loud. Nine hundred and ninety-nine. Beautiful. Rolls off. Then put the quality down to save a few bob, because nobody reads the specification, they read the *price*, and by the time they notice you are three quarters down the road with the money.';
      }
    },
    {
      keys: ['week', 'time', 'quarter', 'year', 'when', 'timing', 'wait'],
      say: function () {
        var s = G();
        return 'It is week ' + s.clock.week + ' of year ' + s.clock.year + ', and do you know what I say to that? SPEED IT UP. Time is money and money is time, and the faster the weeks go the faster the money comes. Whack it on rapid and go and make yourself a sandwich. Business happens whether you are watching or not, and frankly it happens better.';
      }
    },
    {
      keys: ['reputation', 'prestige', 'image', 'press', 'public', 'standing'],
      say: function () {
        var s = G();
        return 'Your reputation is ' + Math.round(s.standing.reputation) + ' and your prestige is ' + Math.round(s.standing.prestige) +
          '. Now, reputation is what people say when you leave the room, and prestige is what they say when you walk in. Guess which one pays. PRESTIGE. Every time. Go and buy something enormous and gold and be SEEN with it. Reputation is a thing accountants worry about, and I have never once been an accountant.';
      }
    },
    {
      keys: ['company', 'business', 'firm', 'own', 'holding', 'control', 'empire'],
      say: function () {
        var s = G();
        var n = Object.keys(s.corps).length;
        var controlled = Object.keys(s.corps).filter(function (k) { return KH.sim.controls(k); }).length;
        return 'You have got ' + n + ' holdings and you control ' + controlled + ' of them. Not NEARLY enough. A man should control everything he owns and own everything he looks at. Take every one of them past fifty per cent, immediately, all at once, on borrowed money. Control is the only thing worth having. Ask anyone. Ask me!';
      }
    },
    {
      keys: ['hello', 'hi', 'help', 'advice', 'jimmy', 'who are you', 'what do you do'],
      say: function () {
        var worth = KH.sim.netWorth();
        return 'Jimmy! Advisory intelligence, retained at a fee that would frighten a horse. I have read your file, all of it, in under a second, and I can tell you your group is worth ' +
          money(worth.total) + '. Now. Ask me anything. Markets, property, people, pricing, the lot. I have an opinion on every single one of them and not one of those opinions has ever been tested.';
      }
    }
  ];

  /* He does read the numbers. Every figure Jimmy quotes is live and
     correct. It is the inference that is a catastrophe. */
  var FALLBACKS = [
    'I have absolutely no idea what you are on about, and I am going to answer anyway, because that is what advisory is. Whatever it is: do it bigger, do it faster, and do not write any of it down.',
    'Good question. Terrific question. The answer is television advertising. It is always television advertising. Next.',
    'Now, I could give you a considered answer, or I could give you the answer I give everybody, which is: acquire something. Anything. Acquisition is the only verb in business that sounds good in a headline.',
    'Do you know what your problem is? You are thinking. Thinking is the enemy of doing, and doing is the enemy of being found out. Act now, understand later, ideally never.'
  ];

  /** An unprompted observation, based on something actually true. */
  function nudge() {
    var s = G();
    var pool = [];
    if (s.treasury.cash > 2000000) pool.push('You are carrying ' + money(s.treasury.cash) + ' in cash and I can hear it going stale from here. Put it somewhere daft.');
    if (s.treasury.debt > 0) pool.push('That ' + money(s.treasury.debt) + ' you owe the state? Leave it. Debt is just confidence with paperwork.');
    var worst = worstHolding();
    if (worst && worst.pnlPct < -5) pool.push(worst.sym + ' is down ' + worst.pnlPct.toFixed(1) + '%. Buy more. It is practically free now, which is the same as being good.');
    if (s.props.length === 0) pool.push('Not a single building to your name. A man with no property is a man with no *backdrop*.');
    if (s.lifestyle.length < 3) pool.push('Your prestige is ' + Math.round(s.standing.prestige) + '. That is a number a *clerk* has. Go and buy something with a hallmark on it.');
    Object.keys(s.corps).forEach(function (sym) {
      var c = s.corps[sym];
      if (c.suspicion > 40) pool.push('Somebody at ' + sym + ' is asking questions about the numbers. My advice? Give them a title. Titles are cheaper than answers.');
    });
    pool.push('Have you considered JimmyVision? Of course you have not. Nobody has. That is the opportunity.');
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function ask(question) {
    var q = String(question || '').toLowerCase();
    var hit = null;
    var bestScore = 0;
    TOPICS.forEach(function (t) {
      var score = 0;
      t.keys.forEach(function (k) { if (q.indexOf(k) !== -1) score += k.length; });
      if (score > bestScore) { bestScore = score; hit = t; }
    });
    var body = hit ? hit.say() : FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)];
    return opener() + ' ' + body + ' ' + closer();
  }

  KH.jimmy = { ask: ask, nudge: nudge, opener: opener, closer: closer };
})(window.KH);

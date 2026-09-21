/* ============================================================
   The simulation.

   A week is the unit of everything. On each week the engine
   revalues every company from its own fundamentals, settles the
   payroll and the rent, advances the building works, lets the
   chief executives do whatever they were going to do, rolls the
   news, and marks the market to the result.

   The market is not decoration. A listed company's fair value is
   its earnings times a sector multiple divided by its shares in
   issue. Change the earnings — by pricing, marketing, hiring,
   strategy or sheer neglect — and the price follows. Anything you
   control, you move.
   ============================================================ */

(function (KH) {
  'use strict';

  var G = function () { return KH.game.get(); };

  /* Sector earnings multiples. Roughly where these things trade. */
  var PE = {
    'Technology': 24, 'Enterprise Software': 22, 'Digital Infrastructure': 21,
    'Life Sciences': 20, 'Pharmaceuticals': 17, 'Telecommunications': 14,
    'Consumer Luxury': 19, 'Aerospace & Defence': 16, 'Renewable Energy': 18,
    'Industrial Conglomerate': 15, 'Industrials': 13, 'Infrastructure': 15,
    'Financials': 11, 'Real Estate': 16, 'Energy': 10, 'Mining': 9,
    'Utilities': 12, 'Transport & Logistics': 11, 'Marine': 10,
    'Agriculture': 13, 'Paper & Packaging': 9, 'Construction': 8,
    'Wholesale & Retail': 10, 'Convenience Retail': 12, 'Food Service': 11,
    'Hospitality': 11, 'Beverages': 16, 'Apparel Manufacturing': 9,
    'Department Stores': 8, 'Diversified Media': 15, 'Cable & Broadband': 13,
    'Broadcast & Studio': 12, 'Film & Production': 13, 'Consumer Toys': 12,
    'Import & Export': 10, 'Specialist Services': 15, 'Equipment Hire': 11,
    'Diversified Holdings': 14
  };

  function peFor(sector) { return PE[sector] || 13; }

  var CONTROL = 0.5;   // control threshold
  var BOARD = 0.25;    // board influence threshold
  var PAYOUT = 0.42;   // share of earnings distributed

  /* ============================================================
     Fundamentals
     ============================================================ */

  /** Seed the trading book with a set of books. Called at start-up and
      whenever the capitalisation dial moves, so the companies on the
      exchange are always the right size relative to your own money. */
  function seedFundamentals() {
    var scale = KH.assets.scale();
    KH.market.book().forEach(function (inst) {
      if (inst.baseShares === undefined) inst.baseShares = inst.shares;
      inst.shares = Math.max(1000, Math.round(inst.baseShares * scale));
      var cap = (inst.px / 100) * inst.shares;
      var earnings = cap / peFor(inst.sector);
      var margin = inst.margin;
      var revenue = margin !== 0 ? Math.abs(earnings / margin) : cap;
      inst.f = {
        revenue: revenue,
        baseRevenue: revenue,
        margin: margin,
        baseMargin: margin,
        demand: 1,
        efficiency: 1,
        quality: 1,
        awareness: 0,
        risk: inst.risk,
        morale: 60 + (5 - inst.risk) * 5
      };
      inst.anchor = inst.px;
    });
  }

  function earningsOf(inst) {
    var f = inst.f;
    return f.revenue * f.demand * f.margin * f.efficiency;
  }

  function fairPrice(inst) {
    var e = earningsOf(inst);
    var pe = peFor(inst.sector);
    // A loss-making company is valued off its sales, not its losses,
    // with a heavy discount — which is why they are never quite free.
    var value = e > 0 ? e * pe : Math.max(inst.f.revenue * 0.22 + e * 1.6, inst.shares * 0.008);
    return KH.util.clamp((value / inst.shares) * 100, 1, 500000);
  }

  /** Resize the whole exchange when the dial moves, carrying every
      holding with it so nobody's percentage changes underneath them. */
  function rescaleMarket(ratio) {
    if (!isFinite(ratio) || ratio <= 0 || ratio === 1) return;
    KH.market.book().forEach(function (inst) {
      inst.shares = Math.max(1000, Math.round(inst.shares * ratio));
      if (inst.f) {
        inst.f.revenue *= ratio;
        inst.f.baseRevenue *= ratio;
      }
      inst.anchor = KH.sim.fairPrice(inst);
    });
    var g = KH.game.get();
    Object.keys(g.corps).forEach(function (sym) {
      var c = g.corps[sym];
      if (!c.shares) return;
      var next = Math.max(1, Math.round(c.shares * ratio));
      c.avgCost = (c.avgCost * c.shares) / next;
      c.shares = next;
    });
    KH.game.save();
  }

  function ownership(sym) {
    var c = G().corps[sym];
    if (!c || !c.shares) return 0;
    var inst = KH.market.get(sym);
    return inst ? c.shares / inst.shares : 0;
  }

  function controls(sym) { return ownership(sym) >= CONTROL; }
  function onBoard(sym) { return ownership(sym) >= BOARD; }

  /** 0 (hopeless) to 100 (straightforward). Shown as a turnaround score. */
  function turnaroundScore(sym) {
    var inst = KH.market.get(sym);
    if (!inst) return 0;
    if (inst.cursed) return 0;
    var f = inst.f;
    var marginPart = KH.util.clamp((f.margin + 0.1) / 0.45, 0, 1) * 38;
    var riskPart = (5 - f.risk) / 4 * 26;
    var moralePart = (f.morale / 100) * 18;
    var scalePart = KH.util.clamp(Math.log10(f.revenue) / 10, 0, 1) * 18;
    return Math.round(KH.util.clamp(marginPart + riskPart + moralePart + scalePart, 1, 100));
  }

  function turnaroundLabel(score) {
    if (score <= 0) return 'Beyond rescue';
    if (score < 20) return 'Very hard';
    if (score < 40) return 'Hard';
    if (score < 60) return 'Demanding';
    if (score < 78) return 'Achievable';
    return 'Straightforward';
  }

  /* ============================================================
     Company operations
     ============================================================ */

  function strategy(id) {
    return KH.simdata.strategies.filter(function (s) { return s.id === id; })[0] || KH.simdata.strategies[0];
  }

  function setStrategy(sym, id) {
    if (!controls(sym)) return { ok: false, reason: 'You need more than 50% of the shares before you can set strategy.' };
    var c = KH.game.corp(sym, true);
    c.strategy = strategy(id).id;
    KH.game.save();
    KH.game.headline(KH.market.get(sym).name + ' adopts ' + strategy(id).label.toLowerCase(),
      'The board has approved a change of direction at your instruction.', 'neutral');
    KH.bus.emit('sim:corp', { sym: sym });
    return { ok: true };
  }

  var FIRST = ['Alan', 'Brenda', 'Carla', 'Derek', 'Eileen', 'Fiona', 'Gail', 'Hank', 'Iris', 'Jack', 'Kenneth', 'Liz', 'Moe', 'Nadia', 'Otto', 'Priya', 'Quentin', 'Roy', 'Sally', 'Tracy', 'Una', 'Victor', 'Winston', 'Xenia', 'Yasmin', 'Zoe', 'Boycie', 'Denji', 'Makoto', 'Navid', 'Isa', 'Jack', 'Tony', 'Rita', 'Norris'];
  var LAST = ['Barlow', 'Platt', 'Connor', 'Trotter', 'Griffin', 'Simpson', 'Donaghy', 'Lemon', 'Scorpio', 'Burns', 'De Santa', 'Yagami', 'Hayakawa', 'Cole', 'Sugden', 'Duffy', 'Brent', 'Reynholm', 'Rumbold', 'Okonjo', 'Sterling', 'Fanshaw', 'Pewterschmidt', 'Webster', 'McDonald', 'Battersby', 'Ogden'];

  function inventStaff(role) {
    var rand = Math.random;
    var name = FIRST[Math.floor(rand() * FIRST.length)] + ' ' + LAST[Math.floor(rand() * LAST.length)];
    var skill = 0.35 + rand() * 0.6;
    return {
      id: 's' + Date.now().toString(36) + Math.floor(rand() * 1000).toString(36),
      name: name,
      roleId: role.id,
      role: role.label,
      skill: Math.round(skill * 100) / 100,
      salary: Math.round(role.salary * (0.78 + skill * 0.6) / 1000) * 1000,
      hiredWeek: G().clock.week
    };
  }

  /** Three candidates, so hiring is a choice rather than a button. */
  function candidates(roleId) {
    var role = KH.simdata.roles.filter(function (r) { return r.id === roleId; })[0];
    if (!role) return [];
    return [inventStaff(role), inventStaff(role), inventStaff(role)];
  }

  function hire(sym, person) {
    if (!controls(sym)) return { ok: false, reason: 'You cannot appoint staff to a company you do not control.' };
    var c = KH.game.corp(sym, true);
    if (c.staff.length >= 14) return { ok: false, reason: 'The executive team is already at fourteen. Any more and it is a committee.' };
    var s = G();
    if (s.treasury.cash < person.salary * 0.25) {
      return { ok: false, reason: 'There is not enough cash to cover the first quarter of that salary.' };
    }
    c.staff.push(person);
    s.stats.hires += 1;
    KH.game.post('payroll', 'Signing costs — ' + person.name + ', ' + person.role, -Math.round(person.salary * 0.08));
    KH.game.headline(person.name + ' joins ' + KH.market.get(sym).name,
      person.role + ' at ' + KH.fmt.money(person.salary, 0) + ' a year.', 'good');
    KH.bus.emit('sim:corp', { sym: sym });
    return { ok: true };
  }

  function fire(sym, staffId) {
    var c = KH.game.corp(sym);
    if (!c) return { ok: false, reason: 'No such holding.' };
    var i = c.staff.map(function (p) { return p.id; }).indexOf(staffId);
    if (i === -1) return { ok: false, reason: 'That person has already left.' };
    var person = c.staff[i];
    var payoff = Math.round(person.salary * 0.42);
    c.staff.splice(i, 1);
    c.morale = KH.util.clamp(c.morale - 6, 0, 100);
    var inst = KH.market.get(sym);
    inst.f.morale = KH.util.clamp(inst.f.morale - 4, 0, 100);
    G().stats.fires += 1;
    KH.game.post('payroll', 'Settlement — ' + person.name, -payoff);
    KH.game.headline(person.name + ' leaves ' + inst.name,
      'Settled at ' + KH.fmt.money(payoff, 0) + '. Morale takes the usual knock.', 'bad');
    KH.bus.emit('sim:corp', { sym: sym });
    return { ok: true, payoff: payoff };
  }

  function setPrice(sym, rangeIndex, price) {
    if (!controls(sym)) return { ok: false, reason: 'Pricing is a matter for whoever controls the company.' };
    var c = KH.game.corp(sym, true);
    var r = c.ranges[rangeIndex];
    if (!r) return { ok: false, reason: 'No such range.' };
    r.price = KH.util.clamp(Math.round(Number(price) || 100), 25, 400);
    KH.game.save();
    KH.bus.emit('sim:corp', { sym: sym });
    return { ok: true };
  }

  function setQuality(sym, rangeIndex, quality) {
    if (!controls(sym)) return { ok: false, reason: 'Specification is a matter for whoever controls the company.' };
    var c = KH.game.corp(sym, true);
    var r = c.ranges[rangeIndex];
    if (!r) return { ok: false, reason: 'No such range.' };
    var target = KH.util.clamp(Math.round(Number(quality) || 50), 10, 100);
    var delta = target - r.quality;
    if (delta > 0) {
      var cost = Math.round(delta * KH.market.get(sym).f.revenue * 0.00018);
      if (G().treasury.cash < cost) return { ok: false, reason: 'Raising specification costs ' + KH.fmt.money(cost, 0) + ' and the cash is not there.' };
      KH.game.post('capex', 'Specification uplift — ' + r.label, -cost);
    }
    r.quality = target;
    KH.game.save();
    KH.bus.emit('sim:corp', { sym: sym });
    return { ok: true };
  }

  function launchCampaign(sym, channelId, slogan) {
    if (!onBoard(sym)) return { ok: false, reason: 'You need at least a quarter of the shares to commission marketing.' };
    var channel = KH.simdata.channels.filter(function (ch) { return ch.id === channelId; })[0];
    if (!channel) return { ok: false, reason: 'No such channel.' };
    var s = G();
    var scale = KH.util.clamp(Math.log10(Math.max(1e6, KH.market.get(sym).f.revenue)) / 8.5, 0.35, 2.4);
    var cost = Math.round(channel.cost * scale);
    if (s.treasury.cash < cost) return { ok: false, reason: 'That campaign costs ' + KH.fmt.money(cost, 0) + ' and there is ' + KH.fmt.money(s.treasury.cash, 0) + ' available.' };
    var c = KH.game.corp(sym, true);
    var mktLead = c.staff.filter(function (p) { return p.roleId === 'mkt'; })[0];
    var power = channel.reach * (mktLead ? 1 + mktLead.skill * 0.5 : 1);
    c.campaigns.unshift({
      channelId: channel.id, label: channel.label, slogan: slogan || KH.simdata.slogans[0],
      power: power, decay: channel.decay, week: s.clock.week, spend: cost
    });
    if (c.campaigns.length > 8) c.campaigns.length = 8;
    s.stats.campaigns += 1;
    KH.game.post('marketing', channel.label + ' campaign — ' + KH.market.get(sym).name, -cost);
    KH.game.headline('"' + (slogan || '') + '" goes live',
      channel.label + ' for ' + KH.market.get(sym).name + ', at ' + KH.fmt.money(cost, 0) + '.', 'good');
    KH.bus.emit('sim:corp', { sym: sym });
    return { ok: true, cost: cost };
  }

  /* ---------- Chief executives ---------- */

  function appointCeo(sym, execId) {
    if (!onBoard(sym)) return { ok: false, reason: 'A quarter of the shares is the minimum for a board appointment.' };
    var exec = KH.simdata.executives.filter(function (e) { return e.id === execId; })[0];
    if (!exec) return { ok: false, reason: 'No such candidate.' };
    var taken = null;
    Object.keys(G().corps).forEach(function (k) { if (G().corps[k].ceo === execId && k !== sym) taken = k; });
    if (taken) return { ok: false, reason: exec.name + ' is already running ' + KH.market.get(taken).name + '.' };
    var s = G();
    var signing = Math.round(exec.fee * 0.25);
    if (s.treasury.cash < signing) return { ok: false, reason: 'The signing package alone is ' + KH.fmt.money(signing, 0) + '.' };
    var c = KH.game.corp(sym, true);
    c.ceo = execId;
    c.ceoSince = s.clock.week;
    c.suspicion = 0;
    c.stolen = 0;
    KH.game.post('payroll', 'Signing package — ' + exec.name, -signing);
    KH.game.headline(exec.name + ' appointed chief executive of ' + KH.market.get(sym).name,
      exec.note, 'good');
    KH.bus.emit('sim:corp', { sym: sym });
    return { ok: true };
  }

  function dismissCeo(sym, forCause) {
    var c = KH.game.corp(sym);
    if (!c || !c.ceo) return { ok: false, reason: 'There is no chief executive in post.' };
    var exec = KH.simdata.executives.filter(function (e) { return e.id === c.ceo; })[0];
    var payoff = forCause ? 0 : Math.round(exec.fee * 0.8);
    c.ceo = null;
    c.suspicion = 0;
    if (payoff) KH.game.post('payroll', 'Termination — ' + exec.name, -payoff);
    G().stats.sacked += 1;
    KH.game.headline(exec.name + ' leaves ' + KH.market.get(sym).name,
      forCause ? 'Dismissed for cause. No settlement was paid, and the lawyers are already writing.'
               : 'By mutual agreement, at a cost of ' + KH.fmt.money(payoff, 0) + '.',
      forCause ? 'bad' : 'neutral');
    KH.bus.emit('sim:corp', { sym: sym });
    return { ok: true, payoff: payoff };
  }

  /** A forensic audit: expensive, and the only way to find the money early. */
  function audit(sym) {
    var c = KH.game.corp(sym);
    if (!c) return { ok: false, reason: 'No such holding.' };
    var inst = KH.market.get(sym);
    var cost = Math.round(Math.max(45000, inst.f.revenue * 0.0016));
    var s = G();
    if (s.treasury.cash < cost) return { ok: false, reason: 'A forensic audit costs ' + KH.fmt.money(cost, 0) + '.' };
    KH.game.post('professional', 'Forensic audit — ' + inst.name, -cost);
    c.audited = s.clock.week;
    if (c.stolen > 0) {
      var recovered = Math.round(c.stolen * 0.62);
      KH.game.post('recovery', 'Recovered from ' + inst.name + ' audit', recovered);
      var name = execName(c.ceo);
      c.stolen = 0;
      c.suspicion = 0;
      var out = dismissCeo(sym, true);
      KH.game.headline('Audit at ' + inst.name + ' finds a hole',
        KH.fmt.money(recovered, 0) + ' recovered. ' + name + ' has been removed for cause.', 'bad');
      s.standing.scrutiny = KH.util.clamp(s.standing.scrutiny + 4, 0, 100);
      KH.bus.emit('sim:corp', { sym: sym });
      return { ok: true, found: true, recovered: recovered, cost: cost };
    }
    c.suspicion = Math.max(0, c.suspicion - 30);
    KH.game.headline('Audit at ' + inst.name + ' comes back clean',
      'Nothing found. ' + KH.fmt.money(cost, 0) + ' spent on peace of mind.', 'good');
    KH.bus.emit('sim:corp', { sym: sym });
    return { ok: true, found: false, cost: cost };
  }

  function execName(id) {
    var e = KH.simdata.executives.filter(function (x) { return x.id === id; })[0];
    return e ? e.name : 'The chief executive';
  }

  /* ============================================================
     Property
     ============================================================ */

  function listingFor(id) {
    return KH.simdata.propertyMarket.filter(function (p) { return p.id === id; })[0] || null;
  }

  function scaleOf() {
    // Property is priced against the same dial as everything else.
    return KH.util.clamp(KH.assets.scale(), 0.0005, 40);
  }

  function askingPrice(listing) { return Math.round(listing.ask * scaleOf() * 6.2); }
  function marketRent(listing) { return Math.round(listing.rent * scaleOf() * 6.2); }

  function buyProperty(id) {
    var listing = listingFor(id);
    if (!listing) return { ok: false, reason: 'That listing has been withdrawn.' };
    var s = G();
    if (s.props.some(function (p) { return p.id === id; })) return { ok: false, reason: 'You already own it.' };
    var price = askingPrice(listing);
    var fees = Math.round(price * 0.058);   // stamp duty, legals, survey
    if (s.treasury.cash < price + fees) {
      return { ok: false, reason: 'The purchase needs ' + KH.fmt.money(price + fees, 0) + ' including fees, and ' + KH.fmt.money(s.treasury.cash, 0) + ' is available.' };
    }
    KH.game.post('property', 'Acquisition — ' + listing.address, -(price + fees));
    s.props.push({
      id: id, address: listing.address, type: listing.type,
      paid: price, value: price, rent: marketRent(listing), condition: listing.condition,
      tenanted: listing.condition > 40, void: 0, works: [], boughtWeek: s.clock.week, note: listing.yieldNote
    });
    s.stats.deals += 1;
    KH.game.headline('Acquired ' + listing.address,
      KH.fmt.money(price, 0) + ' plus ' + KH.fmt.money(fees, 0) + ' of fees.', 'good');
    KH.bus.emit('sim:property');
    return { ok: true, price: price, fees: fees };
  }

  function sellProperty(id) {
    var s = G();
    var i = s.props.map(function (p) { return p.id; }).indexOf(id);
    if (i === -1) return { ok: false, reason: 'You do not own that.' };
    var p = s.props[i];
    if (p.works.length) return { ok: false, reason: 'You cannot sell with works on site. Cancel them or wait.' };
    var fees = Math.round(p.value * 0.022);
    KH.game.post('property', 'Disposal — ' + p.address, p.value - fees);
    s.props.splice(i, 1);
    KH.game.headline('Sold ' + p.address,
      KH.fmt.money(p.value - fees, 0) + ' net of fees, against ' + KH.fmt.money(p.paid, 0) + ' paid.',
      p.value > p.paid ? 'good' : 'bad');
    KH.bus.emit('sim:property');
    return { ok: true, net: p.value - fees };
  }

  /** Three firms, three quotes, and no way to have all three of cheap,
      fast and good. Quotes are held on the state so they can be compared. */
  function requestQuotes(propId, workId) {
    var s = G();
    var p = s.props.filter(function (x) { return x.id === propId; })[0];
    var work = KH.simdata.works.filter(function (w) { return w.id === workId; })[0];
    if (!p || !work) return { ok: false, reason: 'Nothing to quote for.' };

    var picked = KH.simdata.builders.slice().sort(function () { return Math.random() - 0.5; }).slice(0, 4);
    s.offers = s.offers.filter(function (o) { return o.propId !== propId; });
    picked.forEach(function (b) {
      var noise = 0.88 + Math.random() * 0.3;
      s.offers.push({
        id: 'q' + Date.now().toString(36) + b.id,
        propId: propId, workId: workId, builderId: b.id,
        price: Math.round(p.value * work.base * b.rate * noise),
        weeks: Math.max(1, Math.round(work.weeks / b.speed * (0.9 + Math.random() * 0.25))),
        quality: b.quality, reliability: b.reliability,
        week: s.clock.week
      });
    });
    KH.game.save();
    KH.bus.emit('sim:property');
    return { ok: true, count: picked.length };
  }

  function acceptQuote(quoteId) {
    var s = G();
    var q = s.offers.filter(function (o) { return o.id === quoteId; })[0];
    if (!q) return { ok: false, reason: 'That quote has expired.' };
    var p = s.props.filter(function (x) { return x.id === q.propId; })[0];
    if (!p) return { ok: false, reason: 'You no longer own that property.' };
    var deposit = Math.round(q.price * 0.35);
    if (s.treasury.cash < deposit) return { ok: false, reason: 'The deposit alone is ' + KH.fmt.money(deposit, 0) + '.' };

    var work = KH.simdata.works.filter(function (w) { return w.id === q.workId; })[0];
    var builder = KH.simdata.builders.filter(function (b) { return b.id === q.builderId; })[0];
    KH.game.post('property', 'Deposit — ' + work.label + ', ' + p.address, -deposit);
    p.works.push({
      workId: q.workId, label: work.label, builderId: q.builderId, builder: builder.name,
      total: q.price, paid: deposit, weeksLeft: q.weeks, weeks: q.weeks,
      quality: q.quality, reliability: q.reliability,
      condition: work.condition, value: work.value, overrun: 0
    });
    p.tenanted = false;   // you cannot renovate round a tenant
    s.offers = s.offers.filter(function (o) { return o.propId !== q.propId; });
    s.stats.renovations += 1;
    KH.game.headline(builder.name + ' on site at ' + p.address,
      work.label + ', ' + q.weeks + ' weeks, ' + KH.fmt.money(q.price, 0) + '.', 'neutral');
    KH.bus.emit('sim:property');
    return { ok: true };
  }

  function setRent(propId, rent) {
    var p = G().props.filter(function (x) { return x.id === propId; })[0];
    if (!p) return { ok: false, reason: 'You do not own that.' };
    p.rent = Math.max(0, Math.round(Number(rent) || 0));
    KH.game.save();
    KH.bus.emit('sim:property');
    return { ok: true };
  }

  /* ============================================================
     Lifestyle
     ============================================================ */

  function buyLifestyle(id) {
    var item = KH.simdata.lifestyle.filter(function (l) { return l.id === id; })[0];
    if (!item) return { ok: false, reason: 'No such item.' };
    var s = G();
    var price = Math.round(item.price * scaleOf() * 6.2);
    if (s.treasury.cash < price) return { ok: false, reason: 'That is ' + KH.fmt.money(price, 0) + ' and you have ' + KH.fmt.money(s.treasury.cash, 0) + '.' };
    KH.game.post('lifestyle', item.label, -price);
    s.lifestyle.push({ id: id, label: item.label, cat: item.cat, paid: price, value: price, week: s.clock.week });
    s.standing.prestige += item.prestige;
    KH.game.headline('Acquired: ' + item.label,
      KH.fmt.money(price, 0) + '. ' + item.blurb, 'good');
    KH.bus.emit('sim:lifestyle');
    return { ok: true, price: price };
  }

  function sellLifestyle(index) {
    var s = G();
    var owned = s.lifestyle[index];
    if (!owned) return { ok: false, reason: 'Nothing to sell.' };
    var item = KH.simdata.lifestyle.filter(function (l) { return l.id === owned.id; })[0];
    var net = Math.round(owned.value * 0.92);
    KH.game.post('lifestyle', 'Sold — ' + owned.label, net);
    s.standing.prestige = Math.max(0, s.standing.prestige - (item ? item.prestige : 0));
    s.lifestyle.splice(index, 1);
    KH.bus.emit('sim:lifestyle');
    return { ok: true, net: net };
  }

  /* ============================================================
     The treasury, and the thing that stops it ever being over
     ============================================================ */

  function netWorth() {
    var s = G();
    var equity = 0;
    Object.keys(s.corps).forEach(function (sym) {
      var inst = KH.market.get(sym);
      if (inst) equity += (inst.px / 100) * s.corps[sym].shares;
    });
    var property = KH.util.sum(s.props, function (p) { return p.value; });
    var toys = KH.util.sum(s.lifestyle, function (l) { return l.value; });
    var register = KH.assets.total();
    return {
      cash: s.treasury.cash, equity: equity, property: property, toys: toys,
      register: register, debt: s.treasury.debt,
      total: s.treasury.cash + equity + property + toys + register - s.treasury.debt
    };
  }

  /** The state will not let a company of this size fail. It will,
      however, make it extremely unpleasant. */
  function bailoutOffer() {
    var s = G();
    var shortfall = Math.max(0, -s.treasury.cash);
    var floor = Math.max(250000, s.treasury.opening * 0.12);
    var amount = Math.round(shortfall + floor);
    var round = s.treasury.bailouts.length;
    return {
      amount: amount,
      equity: Math.min(0.42, 0.08 + round * 0.06),
      rate: 0.055 + round * 0.015,
      reputation: 9 + round * 4,
      scrutiny: 12 + round * 6,
      oversightWeeks: 12 + round * 8,
      round: round + 1
    };
  }

  function takeBailout() {
    var s = G();
    var offer = bailoutOffer();
    s.treasury.bailouts.push({ week: s.clock.week, amount: offer.amount, equity: offer.equity, rate: offer.rate });
    s.treasury.debt += offer.amount;
    s.treasury.oversightUntil = s.clock.week + offer.oversightWeeks;
    s.standing.reputation = KH.util.clamp(s.standing.reputation - offer.reputation, 0, 100);
    s.standing.scrutiny = KH.util.clamp(s.standing.scrutiny + offer.scrutiny, 0, 100);
    s.stats.bailouts += 1;
    KH.game.post('bailout', 'Treasury stabilisation facility, round ' + offer.round, offer.amount);
    KH.game.headline('State support drawn: ' + KH.fmt.money(offer.amount, 0),
      'The Treasury takes ' + (offer.equity * 100).toFixed(0) + '% of the group, at ' + (offer.rate * 100).toFixed(1) +
      '% interest, with oversight for ' + offer.oversightWeeks + ' weeks. You remain in post. Just.', 'bad');
    KH.bus.emit('sim:treasury');
    return { ok: true, offer: offer };
  }

  function repayDebt(amount) {
    var s = G();
    var pay = Math.min(Math.max(0, Math.round(Number(amount) || 0)), s.treasury.debt, s.treasury.cash);
    if (pay <= 0) return { ok: false, reason: 'There is nothing to repay, or nothing to repay it with.' };
    s.treasury.debt -= pay;
    KH.game.post('financing', 'Repayment of state facility', -pay);
    if (s.treasury.debt <= 0) {
      s.treasury.debt = 0;
      s.standing.reputation = KH.util.clamp(s.standing.reputation + 8, 0, 100);
      KH.game.headline('State facility repaid in full',
        'The Treasury is out. Reputation recovers some of what it cost.', 'good');
    }
    KH.bus.emit('sim:treasury');
    return { ok: true, paid: pay };
  }

  KH.sim = {
    seedFundamentals: seedFundamentals, rescaleMarket: rescaleMarket,
    earningsOf: earningsOf, fairPrice: fairPrice, peFor: peFor,
    ownership: ownership, controls: controls, onBoard: onBoard,
    turnaroundScore: turnaroundScore, turnaroundLabel: turnaroundLabel,
    strategy: strategy, setStrategy: setStrategy,
    candidates: candidates, hire: hire, fire: fire,
    setPrice: setPrice, setQuality: setQuality, launchCampaign: launchCampaign,
    appointCeo: appointCeo, dismissCeo: dismissCeo, audit: audit, execName: execName,
    listingFor: listingFor, askingPrice: askingPrice, marketRent: marketRent,
    buyProperty: buyProperty, sellProperty: sellProperty,
    requestQuotes: requestQuotes, acceptQuote: acceptQuote, setRent: setRent,
    buyLifestyle: buyLifestyle, sellLifestyle: sellLifestyle, lifestylePrice: function (i) { return Math.round(i.price * scaleOf() * 6.2); },
    netWorth: netWorth, bailoutOffer: bailoutOffer, takeBailout: takeBailout, repayDebt: repayDebt,
    CONTROL: CONTROL, BOARD: BOARD, PAYOUT: PAYOUT
  };
})(window.KH);

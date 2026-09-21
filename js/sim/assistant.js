/* ============================================================
   Mike L — principal assistant.

   Where Jimmy is confident and wrong, Mike is quiet and right.
   He reads the live state of the group, does the arithmetic, and
   answers with the actual numbers and the actual next step.

   Everything here is offline: an intent matcher over a weighted
   keyword model, entity extraction for tickers, properties and
   figures, and a set of handlers that compute rather than recite.
   ============================================================ */

(function (KH) {
  'use strict';

  var G = function () { return KH.game.get(); };
  var fmt = KH.fmt;

  function money(n) { return fmt.money(n, 0); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }

  /** A runway only means something over a sensible horizon. */
  function runwayPhrase(weeks) {
    if (weeks === Infinity) return 'Cash flow is positive. No runway concern.';
    if (weeks > 260) return 'Cash covers the burn for years at this rate. Not a concern.';
    if (weeks > 52) return 'About ' + Math.round(weeks / 52) + ' years of cash at this burn.';
    if (weeks > 12) return 'About ' + weeks + ' weeks of cash left \u2014 roughly ' + Math.round(weeks / 4.3) + ' months.';
    return 'Only ' + weeks + ' weeks of cash left. That is the number that matters this morning.';
  }
  function pct(n, dp) { return (n >= 0 ? '+' : '') + n.toFixed(dp === undefined ? 1 : dp) + '%'; }

  /* ============================================================
     Analysis — the arithmetic behind every answer
     ============================================================ */

  /** A non-mutating estimate of the coming week's cash movement. */
  function weeklyFlow() {
    var g = G();
    var income = 0, outgo = 0, detail = [];

    Object.keys(g.corps).forEach(function (sym) {
      var c = g.corps[sym];
      var inst = KH.market.get(sym);
      if (!inst || !c.shares) return;
      var own = KH.sim.ownership(sym);
      var weekly = KH.sim.earningsOf(inst) / 52;
      if (weekly >= 0) {
        var div = weekly * own * KH.sim.PAYOUT;
        income += div;
        if (div > 1) detail.push({ what: 'Dividend from ' + sym, amount: div });
      } else if (own >= KH.sim.CONTROL) {
        var fund = Math.abs(weekly) * own;
        outgo += fund;
        detail.push({ what: 'funding the losses at ' + sym, amount: -fund });
      }
      if (own >= KH.sim.CONTROL) {
        var pay = KH.util.sum(c.staff, function (p) { return p.salary; }) / 52;
        if (pay > 0) { outgo += pay; detail.push({ what: 'the payroll at ' + sym, amount: -pay }); }
        if (c.ceo) {
          var exec = KH.simdata.executives.filter(function (e) { return e.id === c.ceo; })[0];
          if (exec) { outgo += exec.fee / 52; detail.push({ what: 'the package for ' + exec.name + ' at ' + sym, amount: -exec.fee / 52 }); }
        }
      }
    });

    g.props.forEach(function (p) {
      if (p.tenanted && !p.works.length) { income += p.rent; detail.push({ what: 'Rent, ' + p.address, amount: p.rent }); }
      outgo += p.value * 0.00022;
      p.works.forEach(function (w) {
        var inst = (w.total - w.paid) / Math.max(1, w.weeksLeft);
        outgo += inst;
        detail.push({ what: w.label + ' at ' + p.address, amount: -inst });
      });
    });

    if (g.treasury.debt > 0) {
      var rate = g.treasury.bailouts.length ? g.treasury.bailouts[g.treasury.bailouts.length - 1].rate : 0.06;
      var interest = (g.treasury.debt * rate) / 52;
      outgo += interest;
      detail.push({ what: 'Interest on the state facility', amount: -interest });
    }

    detail.sort(function (a, b) { return Math.abs(b.amount) - Math.abs(a.amount); });
    return { income: income, outgo: outgo, net: income - outgo, detail: detail };
  }

  function runway() {
    var g = G();
    var flow = weeklyFlow();
    if (flow.net >= 0) return { weeks: Infinity, flow: flow };
    return { weeks: Math.floor(g.treasury.cash / Math.abs(flow.net)), flow: flow };
  }

  /** Every line ranked by how far the quote sits below fair value. */
  function opportunities(limit) {
    return KH.market.book().map(function (inst) {
      var fair = KH.sim.fairPrice(inst);
      return {
        inst: inst, fair: fair,
        upside: ((fair - inst.px) / inst.px) * 100,
        score: KH.sim.turnaroundScore(inst.sym)
      };
    }).filter(function (r) { return !r.inst.cursed && r.upside > 0; })
      .sort(function (a, b) { return (b.upside * 0.7 + b.score * 0.6) - (a.upside * 0.7 + a.score * 0.6); })
      .slice(0, limit || 5);
  }

  function overvalued(limit) {
    return KH.market.positions().map(function (p) {
      var fair = KH.sim.fairPrice(p.inst);
      return { pos: p, fair: fair, downside: ((p.inst.px - fair) / fair) * 100 };
    }).filter(function (r) { return r.downside > 4; })
      .sort(function (a, b) { return b.downside - a.downside; })
      .slice(0, limit || 4);
  }

  function costToControl(sym) {
    var inst = KH.market.get(sym);
    var g = G();
    var have = g.corps[sym] ? g.corps[sym].shares : 0;
    var need = Math.max(0, Math.ceil(inst.shares * KH.sim.CONTROL) + 1 - have);
    var q = KH.market.quote('buy', sym, Math.max(1, need));
    return { need: need, cost: need ? q.net : 0, have: have, own: KH.sim.ownership(sym) };
  }

  /** The lever a company is most short of, and what to do about it. */
  function weakestLever(sym) {
    var g = G();
    var c = g.corps[sym];
    var inst = KH.market.get(sym);
    if (!c || !inst) return null;
    var has = {};
    (c.staff || []).forEach(function (p) { has[p.roleId] = (has[p.roleId] || 0) + p.skill; });
    var gaps = [];
    if (inst.f.margin < 0.08) gaps.push({ role: 'fin', why: 'the margin is ' + (inst.f.margin * 100).toFixed(1) + '%, which is the binding problem' });
    if (inst.f.demand < 1) gaps.push({ role: 'sales', why: 'demand is running at ' + (inst.f.demand * 100).toFixed(0) + '% of normal' });
    if (inst.f.efficiency < 1.05) gaps.push({ role: 'ops', why: 'there is cost in the line nobody is taking out' });
    if (inst.f.morale < 55) gaps.push({ role: 'hr', why: 'morale is ' + Math.round(inst.f.morale) + ' and falling through the numbers' });
    if (c.ceo && c.suspicion > 20 && !has.comp) gaps.push({ role: 'comp', why: 'suspicion is at ' + Math.round(c.suspicion) + ' and there is no compliance officer' });
    if (!c.campaigns.length && !has.mkt) gaps.push({ role: 'mkt', why: 'nothing is in market and nobody is running it' });
    gaps = gaps.filter(function (gp) { return !has[gp.role]; });
    if (!gaps.length) return null;
    var role = KH.simdata.roles.filter(function (r) { return r.id === gaps[0].role; })[0];
    return { role: role, why: gaps[0].why };
  }

  function atRisk() {
    var g = G();
    return Object.keys(g.corps).map(function (sym) {
      var c = g.corps[sym];
      return { sym: sym, corp: c, suspicion: c.suspicion, ceo: c.ceo };
    }).filter(function (r) { return r.ceo && r.suspicion > 18; })
      .sort(function (a, b) { return b.suspicion - a.suspicion; });
  }

  function voids() {
    return G().props.filter(function (p) { return !p.tenanted || p.works.length; });
  }

  function bestWorks(prop) {
    // Return on works = value uplift over cost, at a decent builder's rate.
    return KH.simdata.works.map(function (w) {
      var cost = prop.value * w.base;
      var uplift = prop.value * w.value * 0.9;
      var rentUp = prop.rent * w.value * 0.8 * 52;
      return { work: w, cost: cost, uplift: uplift, rentUp: rentUp, ratio: (uplift + rentUp) / cost };
    }).sort(function (a, b) { return b.ratio - a.ratio; });
  }

  /* ============================================================
     Entity extraction
     ============================================================ */

  function findTicker(q) {
    var upper = q.toUpperCase();
    var book = KH.market.book();
    var bySym = book.filter(function (i) { return new RegExp('\\b' + i.sym + '\\b').test(upper); })[0];
    if (bySym) return bySym;
    var lower = q.toLowerCase();
    var byName = book.filter(function (i) {
      var first = i.name.toLowerCase().split(/[\s,]+/)[0];
      return first.length > 3 && lower.indexOf(first) !== -1;
    }).sort(function (a, b) { return b.name.length - a.name.length; })[0];
    return byName || null;
  }

  function findProperty(q) {
    var lower = q.toLowerCase();
    return G().props.filter(function (p) {
      return p.address.toLowerCase().split(/[\s,]+/).some(function (w) { return w.length > 4 && lower.indexOf(w) !== -1; });
    })[0] || null;
  }

  /* ============================================================
     Intents
     ============================================================ */

  function bullets(lines) { return lines.filter(Boolean).map(function (l) { return '• ' + l; }).join('\n'); }

  var INTENTS = [];
  function intent(id, keys, fn) { INTENTS.push({ id: id, keys: keys, fn: fn }); }

  intent('brief', ['status', 'briefing', 'brief', 'situation', 'how are we', 'how am i', 'overview', 'summary', 'where do we stand', 'catch me up', 'update'], function () {
    var g = G(), w = KH.sim.netWorth(), f = weeklyFlow(), r = runway();
    var controlled = Object.keys(g.corps).filter(function (s) { return KH.sim.controls(s); });
    var risk = atRisk();
    var v = voids();
    return 'Week ' + g.clock.week + ', year ' + g.clock.year + '. Here is where you stand.\n\n' + bullets([
      'Net worth ' + money(w.total) + '. Cash ' + money(w.cash) + (w.debt ? ', state debt ' + money(w.debt) : ', no debt'),
      'Weekly flow ' + (f.net >= 0 ? '+' : '') + money(f.net) + ' (' + money(f.income) + ' in, ' + money(f.outgo) + ' out)',
      runwayPhrase(r.weeks),
      plural(controlled.length, 'company', 'companies') + ' controlled, ' + plural(Object.keys(g.corps).length, 'holding') + ' in total',
      plural(g.props.length, 'property', 'properties') + ', ' + v.length + ' not currently earning',
      risk.length ? risk.length + ' chief executive(s) showing elevated suspicion — highest is ' + risk[0].sym + ' at ' + Math.round(risk[0].suspicion) : 'No governance concerns flagged',
      'Reputation ' + Math.round(g.standing.reputation) + ', scrutiny ' + Math.round(g.standing.scrutiny)
    ]) + '\n\n' + nextStep();
  });

  intent('cash', ['cash', 'money', 'liquidity', 'runway', 'burn', 'afford', 'broke', 'skint', 'how much', 'balance'], function () {
    var g = G(), r = runway(), f = r.flow;
    var top = f.detail.slice(0, 5).map(function (d) {
      return d.what + ': ' + (d.amount >= 0 ? '+' : '') + money(d.amount) + ' a week';
    });
    var advice;
    if (g.treasury.cash < 0) {
      var offer = KH.sim.bailoutOffer();
      advice = 'You are overdrawn. The Treasury will put in ' + money(offer.amount) + ' for ' +
        (offer.equity * 100).toFixed(0) + '% of the group at ' + (offer.rate * 100).toFixed(1) +
        '%. Before you take it: sell your worst-performing holding, and stop funding any controlled company that is loss-making.';
    } else if (f.net < 0) {
      advice = 'You are losing ' + money(Math.abs(f.net)) + ' a week. The single biggest drain is ' +
        f.detail[0].what + ' at ' + money(Math.abs(f.detail[0].amount)) +
        '. Fix that one and the rest is manageable.';
    } else {
      advice = 'You are ' + money(f.net) + ' a week ahead. That is ' + money(f.net * 52) +
        ' a year of deployable cash. Sitting in the account it earns nothing.';
    }
    return 'Cash is ' + money(g.treasury.cash) + '.\n\nWeekly movement:\n' + bullets(top) + '\n\n' + advice;
  });

  intent('buy', ['buy', 'acquire', 'invest', 'opportunit', 'undervalued', 'cheap', 'what should i', 'recommend', 'worth buying', 'good value'], function () {
    var ops = opportunities(5);
    var g = G();
    if (!ops.length) return 'Nothing on the board is trading below fair value right now. That happens. Hold your cash — ' + money(g.treasury.cash) + ' — and wait a few weeks; the news cycle repriced three sectors last month and it will do it again.';
    var lines = ops.map(function (o) {
      return o.inst.sym + ' — ' + o.inst.name + '. Quote ' + fmt.group(o.inst.px, 2) +
        'p against fair value ' + fmt.group(o.fair, 2) + 'p, so ' + pct(o.upside) +
        ' of catch-up. Turnaround score ' + o.score + ' (' + KH.sim.turnaroundLabel(o.score).toLowerCase() + ').';
    });
    var best = ops[0];
    var ctrl = costToControl(best.inst.sym);
    return 'Five lines where the quote is behind the fundamentals:\n\n' + bullets(lines) +
      '\n\nIf you want one: ' + best.inst.sym + '. Taking control outright needs ' +
      fmt.group(ctrl.need, 0) + ' shares at about ' + money(ctrl.cost) + '. You have ' + money(g.treasury.cash) + '. ' +
      (ctrl.cost <= g.treasury.cash ? 'That is affordable today.' : 'That is beyond you today — take a board stake at 25% first, which costs roughly ' + money(ctrl.cost / 2) + '.');
  });

  intent('sell', ['sell', 'dispose', 'get rid', 'exit', 'overvalued', 'dump', 'offload'], function () {
    var over = overvalued(4);
    var g = G();
    var cursed = KH.market.positions().filter(function (p) { return p.inst.cursed; });
    var lines = over.map(function (o) {
      return o.pos.sym + ' — quote ' + fmt.group(o.pos.inst.px, 2) + 'p against fair value ' +
        fmt.group(o.fair, 2) + 'p, so ' + o.downside.toFixed(1) + '% ahead of itself. Position worth ' + money(o.pos.value) + '.';
    });
    var out = [];
    if (cursed.length) out.push('Sell ' + cursed[0].sym + ' immediately and at any price. It cannot be fixed, and if you control it you are funding the losses every single week.');
    if (lines.length) out.push('Trading ahead of fundamentals:\n\n' + bullets(lines));
    if (!out.length) out.push('Nothing you hold is materially overvalued. Your worst line on fundamentals is ' +
      (KH.market.positions().sort(function (a, b) { return a.pnlPct - b.pnlPct; })[0] || { sym: 'nothing' }).sym +
      ', but that is a performance problem rather than a pricing one — fix it, do not sell it.');
    return out.join('\n\n');
  });

  intent('control', ['control', 'take over', 'takeover', 'majority', 'how much do i need', '50%', 'stake', 'board seat'], function (q) {
    var inst = findTicker(q);
    if (!inst) {
      return 'Control is more than 50% of the shares in issue; a board seat is 25%. Name a company and I will price it. At 25% you can appoint a chief executive and commission marketing. At 50% you set strategy, pricing, specification and the payroll — and you start funding the losses as well as taking the profits.';
    }
    var c = costToControl(inst.sym);
    var g = G();
    var boardShares = Math.max(0, Math.ceil(inst.shares * KH.sim.BOARD) + 1 - c.have);
    var boardCost = boardShares ? KH.market.quote('buy', inst.sym, boardShares).net : 0;
    return inst.name + ' (' + inst.sym + ').\n\n' + bullets([
      'You hold ' + fmt.group(c.have, 0) + ' shares, ' + (c.own * 100).toFixed(2) + '% of ' + fmt.shortNum(inst.shares) + ' in issue',
      c.own >= KH.sim.BOARD ? 'You already have a board seat' : 'Board seat at 25%: ' + fmt.group(boardShares, 0) + ' more shares, about ' + money(boardCost),
      c.own >= KH.sim.CONTROL ? 'You already control it' : 'Control at 50%: ' + fmt.group(c.need, 0) + ' more shares, about ' + money(c.cost),
      'Cash available ' + money(g.treasury.cash),
      'Turnaround score ' + KH.sim.turnaroundScore(inst.sym) + ' — ' + KH.sim.turnaroundLabel(KH.sim.turnaroundScore(inst.sym))
    ]) + '\n\n' + (inst.cursed
      ? 'My advice is do not. This one cannot be turned around, and control means funding it.'
      : c.cost <= g.treasury.cash ? 'Affordable today. Buying in one go will move the price against you, so do it over a few weeks.'
        : 'Not affordable today. Take the board seat first — a chief executive and a campaign will lift the earnings, and you can buy the rest later out of the dividends.');
  });

  intent('company', ['analyse', 'analyze', 'look at', 'tell me about', 'what about', 'how is', 'opinion on', 'thoughts on'], function (q) {
    var inst = findTicker(q);
    if (!inst) return null;
    return analyse(inst);
  });

  intent('turnaround', ['turn around', 'turnaround', 'fix', 'rescue', 'improve', 'save', 'failing', 'losing money', 'plan for'], function (q) {
    var inst = findTicker(q);
    var g = G();
    if (!inst) {
      var worst = Object.keys(g.corps).map(function (s) { return KH.market.get(s); })
        .filter(Boolean).sort(function (a, b) { return KH.sim.earningsOf(a) - KH.sim.earningsOf(b); })[0];
      if (!worst) return 'You do not control anything yet, so there is nothing to turn around. Buy past 50% of something with a turnaround score above 60 and I will write you a plan.';
      inst = worst;
    }
    if (inst.cursed) {
      return inst.name + ' cannot be turned around. I have run every combination of strategy, pricing, specification and leadership against it and they all decay back inside a quarter. The margin is ' +
        (inst.f.margin * 100).toFixed(0) + '% and it gets worse whatever you do.\n\nThe correct plan is to sell, take the loss, and put the money somewhere with a pulse.';
    }
    var sym = inst.sym;
    var own = KH.sim.ownership(sym);
    if (own < KH.sim.CONTROL) {
      var c = costToControl(sym);
      return 'You do not control ' + inst.name + ' yet, so you cannot set the plan. ' +
        fmt.group(c.need, 0) + ' more shares, about ' + money(c.cost) + ', gets you there. Ask me again once you have it.';
    }
    var lever = weakestLever(sym);
    var corp = g.corps[sym];
    var steps = [];
    steps.push('Strategy: ' + (inst.f.margin < 0.04
      ? 'switch to Turnaround programme. It costs margin up front and takes the risk rating down hard, which is what you need first.'
      : inst.f.demand < 0.95 ? 'switch to Aggressive expansion. Margin is adequate; volume is the gap.'
        : 'Premium repositioning. Margin and demand are both sound, so take the price up.'));
    if (lever) steps.push('Hire a ' + lever.role.label.toLowerCase() + ' — ' + lever.why + '. About ' + money(lever.role.salary) + ' a year.');
    if (!corp.ceo) steps.push('Appoint a chief executive. For this one I would take Adaeze Okonjo or Dr Sterling — lower fee, very high integrity, and you will not be auditing them at midnight.');
    var lowRange = (corp.ranges || []).slice().sort(function (a, b) { return a.quality - b.quality; })[0];
    if (lowRange && lowRange.quality < 45) steps.push('Specification on "' + lowRange.label + '" is ' + lowRange.quality + '. Take it to 60. It costs money now and it is what lets you charge more later.');
    if (!corp.campaigns.length) steps.push('Nothing is in market. Trade press is ' + money(KH.simdata.channels.filter(function (x) { return x.id === 'press'; })[0].cost) + ' and holds for months — the cheapest demand you will ever buy.');
    return 'Plan for ' + inst.name + ' (score ' + KH.sim.turnaroundScore(sym) + ', ' + KH.sim.turnaroundLabel(KH.sim.turnaroundScore(sym)).toLowerCase() + '):\n\n' +
      bullets(steps) + '\n\nGive it six to eight weeks. The fundamentals move first, the price follows.' +
      '\n\nOne disclosure, because you should know where my advice comes from: I have not considered cost leadership or harvesting. I never do. If the fastest route to margin here is gutting the cost base, you will have to see that yourself and set it yourself \u2014 I am not the right adviser for that decision and I would rather say so than give you a blind spot you did not know about.';
  });

  intent('hire', ['hire', 'recruit', 'staff', 'appoint', 'who should i hire', 'team', 'headcount', 'people'], function (q) {
    var inst = findTicker(q);
    var g = G();
    var syms = Object.keys(g.corps).filter(function (s) { return KH.sim.controls(s); });
    if (!syms.length) return 'You control nothing, so you cannot appoint anybody. Get past 50% of something first.';
    var target = inst && KH.sim.controls(inst.sym) ? inst.sym : syms[0];
    var lever = weakestLever(target);
    var instT = KH.market.get(target);
    if (!lever) {
      return 'The senior team at ' + instT.name + ' covers every lever that is currently binding. Margin ' +
        (instT.f.margin * 100).toFixed(1) + '%, demand ' + (instT.f.demand * 100).toFixed(0) + '%, morale ' +
        Math.round(instT.f.morale) + '. Adding more people now is cost without effect. Spend it on marketing or specification instead.';
    }
    return 'At ' + instT.name + ' the missing lever is a ' + lever.role.label.toLowerCase() + '.\n\n' + bullets([
      'Why: ' + lever.why,
      'What it does: ' + lever.role.blurb,
      'Cost: around ' + money(lever.role.salary) + ' a year, plus 8% signing',
      'Where: Empire → ' + target + ' → People → ' + lever.role.label
    ]) + '\n\nTake the highest capability score on the shortlist unless the salary gap is more than about 30%. Capability compounds every week; salary is a one-off annoyance.';
  });

  intent('ceo', ['ceo', 'chief executive', 'executive', 'who should run', 'leader', 'donaghy', 'burns', 'scorpio', 'makima', 'yagami'], function (q) {
    var inst = findTicker(q);
    var g = G();
    var named = KH.simdata.executives.filter(function (e) {
      return q.toLowerCase().indexOf(e.name.toLowerCase().split(' ')[e.name.split(' ').length - 1].toLowerCase()) !== -1;
    })[0];
    if (named) {
      var risk = (1 - named.integrity) * (0.6 + named.ambition * 0.5);
      return named.name + ' — ' + named.pedigree + '.\n\n' + bullets([
        'Competence ' + (named.competence * 100).toFixed(0) + '/100 — that is what he adds to margin every week',
        'Integrity ' + (named.integrity * 100).toFixed(0) + '/100',
        'Fee ' + money(named.fee) + ' a year, plus 25% on signing',
        'Embezzlement pressure: ' + (risk > 0.45 ? 'high' : risk > 0.25 ? 'moderate' : 'low') + ' (' + (risk * 100).toFixed(0) + ')'
      ]) + '\n\n' + (risk > 0.4
        ? 'If you appoint him, put a compliance officer on the payroll the same week. It roughly halves what he can take, and it is cheaper than the audit.'
        : 'Low risk. You can leave this one alone and check in monthly.');
    }
    var pool = KH.simdata.executives.slice().sort(function (a, b) {
      return (b.competence - (1 - b.integrity) * 0.7) - (a.competence - (1 - a.integrity) * 0.7);
    }).slice(0, 4);
    return (inst ? 'For ' + inst.name + ', on' : 'On') + ' a competence-minus-risk basis:\n\n' + bullets(pool.map(function (e) {
      return e.name + ' — competence ' + (e.competence * 100).toFixed(0) + ', integrity ' + (e.integrity * 100).toFixed(0) +
        ', ' + money(e.fee) + ' a year. ' + e.note;
    })) + '\n\nThe trade is simple: the brilliant ones steal and the honest ones are slower. A compliance officer on the payroll lets you have the first kind safely.';
  });

  intent('fraud', ['embezzl', 'steal', 'stole', 'fraud', 'suspicion', 'audit', 'whistleblow', 'corrupt', 'missing money', 'governance'], function () {
    var risk = atRisk();
    var g = G();
    if (!risk.length) {
      return 'Nothing is flagged. No chief executive in the group is above a suspicion index of 18.\n\nWorth knowing: suspicion builds when a chief executive with low integrity has no compliance officer above them. A forensic audit costs about 0.16% of revenue and recovers 62% of anything found. A whistleblower recovers 34% and costs you eleven points of reputation, so auditing first is always cheaper.';
    }
    var lines = risk.map(function (r) {
      var inst = KH.market.get(r.sym);
      var cost = Math.round(Math.max(45000, inst.f.revenue * 0.0016));
      return r.sym + ' — ' + KH.sim.execName(r.ceo) + ', suspicion ' + Math.round(r.suspicion) +
        '/100. Audit costs about ' + money(cost) + '.';
    });
    return 'Flagged:\n\n' + bullets(lines) + '\n\nAudit the top one now. Above 55 a whistleblower can go public at any week, and that costs you eleven reputation points and fifteen of scrutiny on top of the money. ' +
      (risk[0].suspicion > 55 ? 'The first one is already in the danger band. Do it this week.' : 'You have a little time, but not much.');
  });

  intent('property', ['property', 'house', 'building', 'landlord', 'portfolio', 'yield', 'buy to let', 'real estate'], function (q) {
    var g = G();
    var prop = findProperty(q);
    if (prop) return propertyAdvice(prop);
    var owned = KH.util.sum(g.props, function (p) { return p.value; });
    var rent = KH.util.sum(g.props, function (p) { return p.tenanted && !p.works.length ? p.rent : 0; });
    var best = KH.simdata.propertyMarket.filter(function (l) {
      return !g.props.some(function (p) { return p.id === l.id; });
    }).map(function (l) {
      var price = KH.sim.askingPrice(l);
      return { l: l, price: price, yield: (KH.sim.marketRent(l) * 52 / price) * 100 };
    }).filter(function (r) { return r.price + r.price * 0.058 <= g.treasury.cash; })
      .sort(function (a, b) { return b.yield - a.yield; }).slice(0, 3);

    var v = voids();
    return 'Property book: ' + g.props.length + ' held, ' + money(owned) + ' valuation, ' + money(rent) + ' a week coming in' +
      (owned ? ' — a gross yield of ' + ((rent * 52 / owned) * 100).toFixed(2) + '%' : '') + '.\n\n' +
      (v.length ? 'Not earning: ' + v.map(function (p) { return p.address + (p.works.length ? ' (works on site)' : ' (void ' + (p.void || 0) + ' weeks, condition ' + Math.round(p.condition) + ')'); }).join('; ') + '.\n\n' : '') +
      (best.length
        ? 'Best yields you can afford today:\n\n' + bullets(best.map(function (r) {
            return r.l.address + ' — ' + money(r.price) + ', ' + r.yield.toFixed(2) + '% gross, condition ' + r.l.condition + '.';
          })) + '\n\nCondition under 40 will not let until it has been done up, so budget the works into the purchase price, not after it.'
        : 'Nothing in the market is affordable on current cash of ' + money(g.treasury.cash) + '.');
  });

  intent('renovate', ['renovat', 'renovate', 'renovation', 'refurbish', 'works', 'builder',
    'quote', 'refurb', 'do up', 'contractor', 'extension', 'kitchen', 'rewire', 'roof'], function (q) {
    var prop = findProperty(q);
    var g = G();
    if (!g.props.length) return 'You own no property, so there is nothing to renovate.';
    if (!prop) {
      prop = g.props.slice().sort(function (a, b) { return a.condition - b.condition; })[0];
    }
    var ranked = bestWorks(prop).slice(0, 3);
    var live = g.offers.filter(function (o) { return o.propId === prop.id; });
    var out = 'For ' + prop.address + ' (condition ' + Math.round(prop.condition) + '/100, valued ' + money(prop.value) + '):\n\n' +
      bullets(ranked.map(function (r) {
        return r.work.label + ' — about ' + money(r.cost) + ', adds roughly ' + money(r.uplift) +
          ' of value and ' + money(r.rentUp / 52) + ' a week of rent. Return ' + r.ratio.toFixed(2) + 'x.';
      }));
    if (live.length) {
      var sorted = live.slice().sort(function (a, b) {
        return (b.quality * b.reliability) / b.price - (a.quality * a.reliability) / a.price;
      });
      var pick = sorted[0];
      var b = KH.simdata.builders.filter(function (x) { return x.id === pick.builderId; })[0];
      out += '\n\nOf the quotes on the table I would take ' + b.name + ' at ' + money(pick.price) + ' over ' + pick.weeks +
        ' weeks. Best quality-and-reliability per pound. ' +
        (live.some(function (o) { return o.price < pick.price * 0.7; })
          ? 'There is a cheaper one, and it is cheaper because it will not turn up — every missed week is another week of no rent.'
          : '');
    } else {
      out += '\n\nNo quotes on the table. Request some on Property → Works & quotes; four firms come back at once.';
    }
    return out + '\n\nRemember the property goes void while works are on site, so the rent stops before the value arrives.';
  });

  intent('marketing', ['marketing', 'campaign', 'advertis', 'promote', 'brand', 'awareness'], function (q) {
    var inst = findTicker(q);
    var g = G();
    var syms = Object.keys(g.corps).filter(function (s) { return KH.sim.onBoard(s); });
    if (!syms.length) return 'Marketing needs at least a 25% stake. You do not have one anywhere yet.';
    var sym = inst && KH.sim.onBoard(inst.sym) ? inst.sym : syms[0];
    var target = KH.market.get(sym);
    var scale = KH.util.clamp(Math.log10(Math.max(1e6, target.f.revenue)) / 8.5, 0.35, 2.4);
    var ranked = KH.simdata.channels.map(function (ch) {
      var cost = Math.round(ch.cost * scale);
      var weeks = 1 / (1 - ch.decay);
      var lift = ch.reach * weeks * target.f.revenue * target.f.margin / 52;
      return { ch: ch, cost: cost, value: lift, ratio: lift / cost };
    }).sort(function (a, b) { return b.ratio - a.ratio; });
    return 'For ' + target.name + ', ranked by return per pound:\n\n' + bullets(ranked.slice(0, 4).map(function (r) {
      return r.ch.label + ' — ' + money(r.cost) + ', reach +' + (r.ch.reach * 100).toFixed(0) + '%, holds about ' +
        Math.round(1 / (1 - r.ch.decay)) + ' weeks. Return ' + r.ratio.toFixed(2) + 'x.';
    })) + '\n\nThe trap is television: biggest reach, worst ratio at this revenue. ' + ranked[0].ch.label +
      ' is the efficient answer here. A marketing lead on the payroll multiplies every channel by up to 1.5, so hire before you spend.';
  });

  intent('pricing', ['price', 'pricing', 'charge', 'margin', 'elastic', 'too expensive', 'discount'], function (q) {
    var inst = findTicker(q);
    var g = G();
    var syms = Object.keys(g.corps).filter(function (s) { return KH.sim.controls(s); });
    if (!syms.length) return 'Pricing needs control — more than 50% of the shares. You have none yet.';
    var sym = inst && KH.sim.controls(inst.sym) ? inst.sym : syms[0];
    var corp = g.corps[sym];
    var target = KH.market.get(sym);
    var lines = corp.ranges.map(function (r) {
      var rec;
      if (target.f.margin < 0.05 && r.price < 130) rec = 'take the price up to about ' + Math.min(150, r.price + 25) + ' — margin is the binding constraint';
      else if (target.f.demand < 0.9 && r.price > 100) rec = 'bring the price down to about ' + Math.max(80, r.price - 20) + ' — volume is the problem, not margin';
      else if (r.quality < 45) rec = 'leave the price and lift specification to 60 first; you cannot charge more for this as it stands';
      else rec = 'leave it — it is close to right';
      return r.label + ' (price ' + r.price + ', spec ' + r.quality + '): ' + rec;
    });
    return 'Pricing at ' + target.name + '. Margin is ' + (target.f.margin * 100).toFixed(1) +
      '%, demand ' + (target.f.demand * 100).toFixed(0) + '% of normal.\n\n' + bullets(lines) +
      '\n\nThe mechanic: every ten points of price is roughly nine points of volume and three and a half of margin. Specification pulls the other way — it costs cash now and buys you pricing room later.';
  });

  intent('debt', ['debt', 'bailout', 'loan', 'borrow', 'treasury', 'government', 'repay', 'owe'], function () {
    var g = G();
    if (g.treasury.debt <= 0) {
      var offer = KH.sim.bailoutOffer();
      return 'No state debt. Good.\n\nFor reference, if you ever go overdrawn the Treasury will step in with ' + money(offer.amount) +
        ' for ' + (offer.equity * 100).toFixed(0) + '% of the group at ' + (offer.rate * 100).toFixed(1) +
        '%, plus ' + offer.reputation + ' reputation points and ' + offer.oversightWeeks +
        ' weeks of oversight. Each round after that is worse. It is a floor, not a plan — you never lose, but you can end up owning very little of what you built.';
    }
    var rate = g.treasury.bailouts[g.treasury.bailouts.length - 1].rate;
    var interest = (g.treasury.debt * rate) / 52;
    var f = weeklyFlow();
    return 'You owe ' + money(g.treasury.debt) + ' at ' + (rate * 100).toFixed(1) + '%, costing ' + money(interest) +
      ' a week in interest.\n\n' + bullets([
        'That is ' + money(interest * 52) + ' a year going nowhere',
        'Weekly cash flow is ' + (f.net >= 0 ? '+' : '') + money(f.net),
        f.net > interest ? 'You can service it comfortably and should start repaying' : 'You cannot service it out of operations yet',
        'Clearing it in full returns eight reputation points'
      ]) + '\n\n' + (f.net > 0
        ? 'Repay in chunks rather than all at once — keep six weeks of costs in cash as a buffer, which is about ' + money(Math.abs(f.outgo) * 6) + '.'
        : 'Fix the operating deficit before you repay a penny. Paying down debt while burning cash just brings the next bailout forward.');
  });

  intent('credit', ['credit rating', 'rating', 'gearing', 'leverage', 'creditworth', 'borrow against', 'covenant', 'grade'], function () {
    var r = KH.sim.creditRating();
    var g = G();
    var f = weeklyFlow();
    return 'Credit rating ' + r.grade + ' \u2014 ' + r.note.toLowerCase() + ' (' + r.score + '/100).\n\n' + bullets([
      'Gearing ' + (r.gearing * 100).toFixed(1) + '% of enterprise value',
      'State debt ' + money(g.treasury.debt) + ', cash ' + money(g.treasury.cash),
      'Weekly flow ' + (f.net >= 0 ? '+' : '') + money(f.net),
      'Reputation ' + Math.round(g.standing.reputation) + ', scrutiny ' + Math.round(g.standing.scrutiny)
    ]) + '\n\n' + (r.score > 74
      ? 'That is investment grade and it is not at risk. Nothing to do.'
      : r.score > 48
        ? 'Lower medium grade. Clearing debt and getting the weekly flow positive are the two levers that move it.'
        : 'Speculative. The binding constraint is ' + (g.treasury.debt > 0 ? 'the state facility' : 'the operating deficit') + '.');
  });

  intent('worth', ['net worth', 'worth', 'how rich', 'performance', 'how am i doing', 'total', 'wealth', 'assets'], function () {
    var w = KH.sim.netWorth(), g = G();
    var parts = [
      ['Cash', w.cash], ['Listed equity', w.equity], ['Asset register', w.register],
      ['Property', w.property]
    ];
    var lines = parts.map(function (p) {
      return p[0] + ': ' + money(p[1]) + ' (' + ((p[1] / (w.total + w.debt)) * 100).toFixed(1) + '%)';
    });
    if (w.debt) lines.push('Less state debt: ' + money(-w.debt));
    var peak = g.stats.peakNetWorth;
    return 'Net worth ' + money(w.total) + '.\n\n' + bullets(lines) + '\n\n' +
      (w.total >= peak ? 'That is a new high.' : 'Down ' + money(peak - w.total) + ' from your peak of ' + money(peak) + '.') +
      ' Over ' + g.stats.weeksRun + ' weeks that is ' +
      (g.stats.weeksRun ? money((w.total - g.treasury.opening) / g.stats.weeksRun) + ' a week.' : 'too early to annualise.');
  });

  intent('jimmy', ['jimmy', 'jimmyvision', 'jvis', 'advisor', 'advice from jimmy'], function () {
    var inst = KH.market.get('JVIS');
    return 'Jimmy is retained as an advisory intelligence and I would treat everything he says as a contrary indicator.\n\n' + bullets([
      'JimmyVision Corp (JVIS) trades at ' + fmt.group(inst.px, 2) + 'p with a margin of ' + (inst.f.margin * 100).toFixed(0) + '%',
      'Its margin deteriorates every week regardless of strategy, pricing, leadership or investment',
      'Turnaround score 0. It is the only company on the board that is genuinely unfixable',
      'If you take control of it, you fund its losses every week out of your own cash'
    ]) + '\n\nHe will tell you to buy it. Do not buy it.';
  });

  intent('explain', ['how does', 'how do', 'explain', 'what is', 'what does', 'mechanic', 'work', 'rules', 'dividend', 'fair value'], function (q) {
    var lower = q.toLowerCase();
    if (lower.indexOf('fair value') !== -1 || lower.indexOf('price') !== -1) {
      return 'Fair value is earnings times a sector multiple, divided by the shares in issue. Earnings are revenue times demand times margin times efficiency — every one of which you can move on a company you control.\n\nEach week the price anchor steps 19% of the way toward fair value, and the tape walks around that anchor between weeks. So improving a company does not move the price today; it moves it over the following month or so. That lag is the whole game.';
    }
    if (lower.indexOf('dividend') !== -1 || lower.indexOf('income') !== -1) {
      return 'Each week every holding pays you its share of 42% of its earnings, in proportion to what you own. If a company you control is loss-making you fund your share of the loss instead — that is the cost of control, and it is why a cheap failing company is rarely cheap.';
    }
    if (lower.indexOf('turnaround score') !== -1 || lower.indexOf('score') !== -1) {
      return 'The turnaround score runs from 1 to 100 and blends four things: operating margin (38 points), risk rating (26), workforce morale (18) and scale (18). Above 78 is straightforward; below 20 is very hard. JimmyVision scores zero and always will.';
    }
    if (lower.indexOf('whistle') !== -1 || lower.indexOf('suspicion') !== -1) {
      return 'A chief executive with low integrity and no compliance officer above them starts moving money. Each time they do, suspicion rises. Above 55 a whistleblower can go public in any given week: you recover 34% and lose eleven reputation points. Audit first and you recover 62% and lose nothing.';
    }
    if (lower.indexOf('bailout') !== -1 || lower.indexOf('lose') !== -1 || lower.indexOf('game over') !== -1) {
      return 'There is no game over. Go below zero and the Treasury steps in with enough to clear the hole plus a floor, in exchange for equity, interest, reputation and a period of oversight. Each round is more expensive than the last. You cannot lose; you can only end up owning less and less of what you built.';
    }
    if (lower.indexOf('time') !== -1 || lower.indexOf('week') !== -1 || lower.indexOf('speed') !== -1 || lower.indexOf('pace') !== -1) {
      var g = G();
      return 'It is week ' + g.clock.week + ' of year ' + g.clock.year + '. Time runs at whatever pace you set in Settings → Simulation: paused, slow, normal, fast or rapid. You can also step a single week at a time from the Command bar, which is what I would do when you are making changes and want to see each one land.';
    }
    return null;
  });

  intent('pdf', ['pdf', 'export', 'print', 'report', 'download', 'board pack', 'paperwork'], function () {
    return 'Everything exports as a real PDF, offline:\n\n' + bullets([
      'Command → Group position report: net worth, holdings, property and commentary',
      'Empire → Board pack: one company, its fundamentals, team, ranges and governance',
      'Property → Schedule: the full book with works in progress',
      'Markets → Market sheet: all ' + KH.market.book().length + ' lines with turnaround scores',
      'Settings → Ledger: the transaction history'
    ]) + '\n\nThey are proper documents with headers, page numbers and a signature block. You can print them.';
  });

  intent('help', ['help', 'what can you do', 'who are you', 'hello', 'hi ', 'mike', 'commands', 'options'], function () {
    var g = G();
    return 'Mike L, principal assistant. I read the live state of the group and do the arithmetic, so ask me anything specific.\n\nThings I am good at:\n\n' + bullets([
      '"How are we doing" — a full situation report',
      '"What should I buy" — ranked against fair value, with the cost of control',
      '"How do I take over TNET" — exact shares and cost',
      '"Fix CVTN" — a step-by-step turnaround plan',
      '"Who should I hire" — the lever the company is actually short of',
      '"Is anyone stealing" — suspicion, audit costs and timing',
      '"Best property yield" or "renovate Coronation Street" — with returns',
      '"Which marketing channel" — ranked by return per pound',
      '"How does fair value work" — or dividends, scores, whistleblowers, bailouts'
    ]) + '\n\nTwo things you should know about me, because a biased adviser you understand is worth more than a neutral one you do not. I will not recommend outsourcing, offshoring or cost-cutting your way to margin \u2014 ever, on principle, and it will cost you money sometimes. And I can read every figure in the group but none of the ones in the future; events land at random and I find out when you do.' +
      '\n\nYou are on week ' + g.clock.week + ', year ' + g.clock.year + ', with ' + money(g.treasury.cash) + ' in cash. Where would you like to start?';
  });

  /* ---------- Company analysis, shared by several intents ---------- */

  function analyse(inst) {
    var sym = inst.sym;
    var g = G();
    var corp = g.corps[sym];
    var own = KH.sim.ownership(sym);
    var fair = KH.sim.fairPrice(inst);
    var score = KH.sim.turnaroundScore(sym);
    var e = KH.sim.earningsOf(inst);
    var lines = [
      'Quote ' + fmt.group(inst.px, 2) + 'p, fair value ' + fmt.group(fair, 2) + 'p — ' + pct(((fair - inst.px) / inst.px) * 100) + ' of gap',
      'Revenue ' + fmt.moneyShort(inst.f.revenue * inst.f.demand) + ', margin ' + (inst.f.margin * 100).toFixed(1) + '%, earnings ' + fmt.moneyShort(e),
      'Market capitalisation ' + fmt.moneyShort((inst.px / 100) * inst.shares) + ' on ' + fmt.shortNum(inst.shares) + ' shares',
      'Turnaround score ' + score + ' — ' + KH.sim.turnaroundLabel(score),
      'Morale ' + Math.round(inst.f.morale) + ', risk ' + inst.f.risk.toFixed(1) + '/5',
      own > 0 ? 'You hold ' + (own * 100).toFixed(2) + '%, worth ' + money((inst.px / 100) * corp.shares) : 'You hold none of it'
    ];
    var verdict;
    if (inst.cursed) verdict = 'Verdict: avoid entirely. This is the one company on the board that cannot be turned around.';
    else if (fair > inst.px * 1.12 && score > 45) verdict = 'Verdict: buy. The gap to fair value is real and the company is fixable.';
    else if (fair > inst.px * 1.12) verdict = 'Verdict: cheap, but hard work. The gap is there; closing it will take a proper turnaround programme.';
    else if (fair < inst.px * 0.9) verdict = 'Verdict: expensive. If you hold it, take something off the table.';
    else verdict = 'Verdict: fairly priced. Only worth owning if you intend to run it better than it is being run.';
    return inst.name + ' (' + sym + ') — ' + inst.sector + '.\n\n' + bullets(lines) + '\n\n' + verdict;
  }

  /* ---------- The single most useful next action ---------- */

  function nextStep() {
    var g = G();
    var risk = atRisk();
    var f = weeklyFlow();
    if (g.treasury.cash < 0) return 'Next: you are overdrawn. Sell something or take the Treasury facility — ask me about the bailout terms first.';
    if (risk.length && risk[0].suspicion > 50) return 'Next: audit ' + risk[0].sym + '. Suspicion is ' + Math.round(risk[0].suspicion) + ' and a whistleblower costs you far more than the audit does.';
    if (f.net < 0) return 'Next: you are burning ' + money(Math.abs(f.net)) + ' a week. The biggest single drain is ' + f.detail[0].what + '.';
    if (!Object.keys(g.corps).length) return 'Next: buy your first stake. Ask me "what should I buy" and I will rank the board for you.';
    var uncontrolled = Object.keys(g.corps).filter(function (s) { return !KH.sim.controls(s) && KH.sim.ownership(s) > 0.2; })[0];
    if (uncontrolled) return 'Next: you are at ' + (KH.sim.ownership(uncontrolled) * 100).toFixed(1) + '% of ' + uncontrolled + '. Push past 50% and you can actually run it.';
    var noCeo = Object.keys(g.corps).filter(function (s) { return KH.sim.controls(s) && !g.corps[s].ceo; })[0];
    if (noCeo) return 'Next: ' + noCeo + ' has no chief executive. Appointing one improves it every week without you touching it.';
    if (!g.props.length) return 'Next: buy a property. Rent is the only income in this group that does not depend on the market being in a good mood.';
    return 'Next: nothing is on fire. Deploy the cash — ask me what to buy.';
  }

  /* ============================================================
     Reading what was meant rather than what was typed

     Keyboards are imperfect and people are in a hurry. Every
     keyword is matched three ways: as a substring, against the
     normalised text, and token by token with an edit-distance
     tolerance that scales with word length. "embezelment",
     "turnarond" and "propery" all land where they should.
     ============================================================ */

  function normalise(text) {
    return ' ' + String(text || '')
      .toLowerCase()
      .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
      .replace(/[^a-z0-9'\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() + ' ';
  }

  /** Damerau-style edit distance, bounded so long words stay cheap. */
  function editDistance(a, b, max) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur[0] = i;
      var best = cur[0];
      for (j = 1; j <= b.length; j++) {
        var cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (cur[j] < best) best = cur[j];
      }
      if (best > max) return max + 1;
      prev = cur.slice();
    }
    return prev[b.length];
  }

  function tolerance(word) {
    if (word.length <= 4) return 0;
    if (word.length <= 7) return 1;
    return 2;
  }

  /** Does this text contain this keyword, allowing for a typo? */
  function fuzzyHas(tokens, norm, key) {
    if (norm.indexOf(key) !== -1) return key.length + 2;
    var parts = key.trim().split(' ');
    if (parts.length > 1) {
      // A phrase matches if every word of it is present, near enough.
      var all = parts.every(function (part) {
        return tokens.some(function (t) { return editDistance(t, part, tolerance(part)) <= tolerance(part); });
      });
      return all ? key.length : 0;
    }
    var word = parts[0];
    if (word.length < 4) return 0;
    var stem = word.slice(0, 5);
    var hit = tokens.some(function (t) {
      // A shared stem catches the endings people invent: "embezelment",
      // "renovating", "marketted". The distance check catches the rest.
      if (word.length >= 5 && t.length >= 5 && t.slice(0, 5) === stem) return true;
      return Math.abs(t.length - word.length) <= 2 && editDistance(t, word, tolerance(word)) <= tolerance(word);
    });
    return hit ? Math.max(3, word.length - 1) : 0;
  }

  /* ============================================================
     BlackBerry: the one subject on which he is delighted
     ============================================================ */

  var BERRY = ['blackberry', 'black berry', 'bbm', 'qwerty', 'physical keyboard', 'keyboard phone',
    'bold 9000', 'trackball', 'trackpad', 'enterprise server'];
  var BERRY_WORDS = ['rim', 'bes', 'curve', 'passport'];
  var STORM = ['blackberry storm', 'surepress', '9530'];
  var STORM_WORDS = ['storm'];

  /** A short acronym only counts as a whole word. "the BESt property"
      is a property question, not a nostalgia trip. */
  function hasWord(norm, word) { return norm.indexOf(' ' + word + ' ') !== -1; }

  var BERRY_JOY = [
    'Now you are talking. A physical keyboard. Thirty-five keys, every one of them where your thumb already thinks it is, and you can write a four-paragraph email under a boardroom table without once looking down.',
    'Battery. Five days. FIVE. Not "all day" \u2014 all week. Because the radio was efficient, the display was modest, and nobody had decided a telephone needed to render a cinema.',
    'The compression was the trick. We pushed mail through a fraction of the bandwidth everyone else needed, which is why it worked on a train, in a lift, in a basement in Frankfurt, when nothing else did.',
    'And it was secure. Genuinely secure. Own network, own servers, own encryption, and every government in the world eventually asked us to weaken it. We said no. That is the whole company in one word.',
    'BBM. Delivered and read receipts, years before anyone else, on a network that did not care whether you had signal or merely the memory of signal.'
  ];

  var STORM_PAIN = [
    'Do not. Do not say that word to me.',
    'We were told the market wanted glass. So we gave them glass that clicked \u2014 the whole screen depressed, so you would know you had hit the key. On paper it was elegant. In the hand it was a door.',
    'It shipped before it was ready. I knew it. I signed it anyway. That is the part that does not go away \u2014 not that it failed, but that I let it go out knowing.',
    'A million units, and the returns came back faster than the orders went out. I have thought about it most weeks since.'
  ];

  function berryCheck(q) {
    var norm = normalise(q);
    if (STORM.some(function (k) { return norm.indexOf(k) !== -1; }) ||
        STORM_WORDS.some(function (k) { return hasWord(norm, k); })) {
      var pain = STORM_PAIN.slice(0, 2).concat(STORM_PAIN.slice(2).sort(function () { return Math.random() - 0.5; }).slice(0, 1));
      return pain.join('\n\n') + '\n\nAnyway. Ask me something about the group. I would rather be useful than remembered.';
    }
    if (!BERRY.some(function (k) { return norm.indexOf(k) !== -1; }) &&
        !BERRY_WORDS.some(function (k) { return hasWord(norm, k); })) return null;
    var joy = BERRY_JOY.slice().sort(function () { return Math.random() - 0.5; }).slice(0, 2);
    return 'Ha! Right. Yes. Sit down.\n\n' + joy.join('\n\n') +
      '\n\nI could go on and I usually do. What did you actually want to know?';
  }

  /* ============================================================
     The blind spot

     He is the best analyst in the building and he has one
     immovable conviction: you build it yourself, where you are,
     with people you can walk over to. It is the reason the group
     will never take the cheapest route to margin while he is
     advising, and the reason he is not a cheat code. Override him
     when the numbers say to. He will not enjoy it.
     ============================================================ */

  var OFFSHORE = [
    'outsourc', 'out source', 'offshore', 'off shore', 'china', 'chinese', 'shenzhen',
    'contract manufactur', 'cheap labour', 'cheap labor', 'low cost country', 'move production',
    'move manufacturing', 'overseas factory', 'third party factory', 'foxconn', 'sweatshop',
    'labour arbitrage', 'labor arbitrage', 'offshoring'
  ];

  var OFFSHORE_RANT = [
    'No. We build it here. We build it in a building we own, with people I can walk over to and ask a question, and if a board comes off the line wrong I can hold it in my hand the same afternoon.',
    'The moment you ship your manufacturing eight thousand miles away you have not saved money, you have bought a delay. Every fix is a flight. Every revision is a quarter. Every problem arrives as a spreadsheet instead of a part on your desk.',
    'You know what they tell you? Forty per cent on unit cost. You know what they do not tell you? That you have handed somebody else the only thing that was actually yours, and they are already making it for your competitor on the next line along.',
    'I have watched companies do this. They all say the same thing \u2014 we keep the design, we just move the making. Within three years they cannot make anything, they cannot fix anything, and the people who could have left.',
    'And the quality goes. Not immediately. Slowly, in a way that does not show up until the returns do, and by then you have no factory to put it right in.'
  ];

  function offshoreCheck(q) {
    var norm = normalise(q);
    if (!OFFSHORE.some(function (k) { return norm.indexOf(k) !== -1; })) return null;
    var rest = OFFSHORE_RANT.slice(1).sort(function () { return Math.random() - 0.5; }).slice(0, 2);
    var rant = [OFFSHORE_RANT[0]].concat(rest);
    return rant.join('\n\n') +
      '\n\nI will tell you plainly: outsourcing and offshoring are the one thing I will not model for you. Cost leadership and harvesting are on the strategy list and you can set either of them yourself in two clicks. I will not be the one who recommends it, and if you ask me whether it would work, you will get this answer again.\n\nAsk me about anything else and I am the most useful thing in this building.';
  }

  /* ============================================================
     The one subject on which Mike is not calm

     He is, by every other measure, the most level-headed voice in
     the building. Mention the fruit company and something goes.
     ============================================================ */

  var APPLE = [
    'apple', 'iphone', 'ipad', 'ipod', 'macbook', 'imac', ' mac ', 'macos', ' ios ', 'ios ',
    'app store', 'appstore', 'airpod', 'cupertino', 'tim cook', 'steve jobs', 'jeve stobs',
    'bitten fruit', 'touchscreen', 'touch screen', 'facetime', 'icloud', 'airdrop', 'siri',
    'retina display', 'lightning cable', 'usb-c'
  ];

  var RAGE = [
    'A TOUCHSCREEN. On a business device. You cannot type on glass. You have never been able to type on glass. Every single person who tells you they can is typing at forty words a minute and correcting eleven of them.',
    'Do you know what happens to the battery? It dies. At two in the afternoon. In a negotiation. Mine ran for FIVE DAYS and it had a keyboard you could touch-type on in the dark, in a taxi, under a desk.',
    'Encryption. End to end, on our own network, on our own servers, and not one government on earth could read it. Then everybody decided they would rather have a device that shows you photographs of your lunch.',
    'They sold it on the STORE. Not the security, not the network, not the battery, not the keyboard \u2014 the store. A shop. Inside a telephone. And the entire enterprise market queued up for it.',
    'A sealed battery. A SEALED battery. In a device you are meant to run a company on. Try explaining that to a board with nine thousand handsets on a fleet contract.',
    'And the cable. They changed the cable. Twice. On purpose. Every drawer in every office in the world is full of dead cables and somebody in Cupertino called that a product strategy.'
  ];

  function appleRage(q) {
    var lower = normalise(q);
    if (!APPLE.some(function (k) { return lower.indexOf(k.trim()) !== -1; })) return null;
    // The keyboard line always leads. It is the one he actually cares about.
    var rant = [RAGE[0]].concat(RAGE.slice(1).sort(function () { return Math.random() - 0.5; }).slice(0, 1));
    var stripped = q.replace(new RegExp(APPLE.join('|'), 'gi'), ' ').trim();

    // He will still do his job. He will just be extremely unhappy about it.
    var rest = null;
    if (stripped.length > 8) {
      var scored = INTENTS.map(function (it) {
        var sc = 0;
        it.keys.forEach(function (k) { if ((' ' + stripped.toLowerCase() + ' ').indexOf(k) !== -1) sc += k.length; });
        return { it: it, score: sc };
      }).filter(function (r) { return r.score > 0; }).sort(function (a, b) { return b.score - a.score; })[0];
      if (scored) rest = scored.it.fn(stripped);
    }

    return 'No.\n\n' + rant.join('\n\n') +
      (rest ? '\n\n—\n\nRight. I have had a moment. To your actual question:\n\n' + rest
            : '\n\nAsk me something about the group and we will both feel better.');
  }

  /* ============================================================
     Executing, not just advising

     Mike is a principal assistant, so an instruction is carried out
     rather than explained back. Quantities, amounts, tickers,
     addresses, roles, strategies, channels and executives are all
     parsed out of plain English, the action is performed against
     the live game, and he reports exactly what he did and what it
     cost. If he cannot do it, he says why in one line.
     ============================================================ */

  var ACTION_WORDS = /\b(buy|purchase|acquire|take|get|sell|dump|dispose|offload|hire|recruit|appoint|install|fire|dismiss|sack|audit|investigate|switch|adopt|set|change|raise|increase|cut|lower|drop|reduce|launch|run|commission|advance|skip|pause|resume|speed|slow|repay|pay|export|download|accept|request|quote)\b/;

  /** "5k", "2,500", "\u00a3100k", "1.2m", "half a million" \u2014 all of it. */
  function parseAmount(text) {
    var m = text.match(/(?:\u00a3|\$|\u20ac)?\s*([\d][\d,]*(?:\.\d+)?)\s*(k|m|bn|b|thousand|million|billion)?/i);
    if (!m) return null;
    var n = parseFloat(m[1].replace(/,/g, ''));
    if (!isFinite(n)) return null;
    var unit = (m[2] || '').toLowerCase();
    if (unit === 'k' || unit === 'thousand') n *= 1e3;
    else if (unit === 'm' || unit === 'million') n *= 1e6;
    else if (unit === 'bn' || unit === 'b' || unit === 'billion') n *= 1e9;
    return { value: n, isMoney: /[\u00a3$\u20ac]/.test(m[0]) };
  }

  function findRole(norm, tokens) {
    var best = null, score = 0;
    KH.simdata.roles.forEach(function (r) {
      var sc = fuzzyHas(tokens, norm, r.label.toLowerCase().split(' ')[0]) +
        (norm.indexOf(r.label.toLowerCase()) !== -1 ? 12 : 0) +
        (norm.indexOf(' ' + r.id + ' ') !== -1 ? 6 : 0);
      if (r.id === 'ops' && /operation|efficien|cost/.test(norm)) sc += 8;
      if (r.id === 'sales' && /sales|volume|demand|revenue/.test(norm)) sc += 8;
      if (r.id === 'eng' && /engineer|quality|technical|spec/.test(norm)) sc += 8;
      if (r.id === 'fin' && /financ|controller|margin|account/.test(norm)) sc += 8;
      if (r.id === 'hr' && /people|hr|morale|staff director/.test(norm)) sc += 8;
      if (r.id === 'comp' && /complian|governance|oversight|risk officer/.test(norm)) sc += 8;
      if (r.id === 'mkt' && /marketing|brand|campaign lead/.test(norm)) sc += 8;
      if (sc > score) { score = sc; best = r; }
    });
    return score > 4 ? best : null;
  }

  function findExec(norm) {
    var best = null, score = 0;
    KH.simdata.executives.forEach(function (e) {
      e.name.toLowerCase().split(/[\s.]+/).forEach(function (part) {
        if (part.length > 3 && norm.indexOf(part) !== -1 && part.length > score) { score = part.length; best = e; }
      });
    });
    return best;
  }

  function findStrategy(norm) {
    var best = null, score = 0;
    KH.simdata.strategies.forEach(function (st) {
      var words = st.label.toLowerCase().split(' ');
      var sc = 0;
      words.forEach(function (w) { if (w.length > 3 && norm.indexOf(w) !== -1) sc += w.length; });
      if (st.id === 'turn' && /turnaround|rescue|stabilis|stabiliz/.test(norm)) sc += 10;
      if (st.id === 'cost' && /cost|squeeze|efficien|lean/.test(norm)) sc += 8;
      if (st.id === 'expand' && /expan|aggress|grow|share/.test(norm)) sc += 8;
      if (st.id === 'premium' && /premium|upmarket|reposition/.test(norm)) sc += 8;
      if (st.id === 'harvest' && /harvest|milk|strip/.test(norm)) sc += 8;
      if (st.id === 'invest' && /reinvest|invest in/.test(norm)) sc += 8;
      if (st.id === 'steady' && /steady|nothing|hold/.test(norm)) sc += 6;
      if (sc > score) { score = sc; best = st; }
    });
    return score > 4 ? best : null;
  }

  function findChannel(norm) {
    var best = null, score = 0;
    KH.simdata.channels.forEach(function (ch) {
      var sc = 0;
      ch.label.toLowerCase().split(/[\s&]+/).forEach(function (w) { if (w.length > 3 && norm.indexOf(w) !== -1) sc += w.length; });
      if (ch.id === 'tv' && /\btv\b|telly|television/.test(norm)) sc += 10;
      if (ch.id === 'press' && /press|trade|magazine/.test(norm)) sc += 8;
      if (ch.id === 'digital' && /digital|online|search|performance/.test(norm)) sc += 8;
      if (ch.id === 'outdoor' && /outdoor|billboard|poster|transport/.test(norm)) sc += 8;
      if (ch.id === 'influencer' && /influencer|social|creator/.test(norm)) sc += 8;
      if (ch.id === 'sponsor' && /sponsor/.test(norm)) sc += 8;
      if (ch.id === 'rebrand' && /rebrand|logo|identity/.test(norm)) sc += 8;
      if (sc > score) { score = sc; best = ch; }
    });
    return score > 4 ? best : null;
  }

  function findListing(norm) {
    var owned = G().props.map(function (p) { return p.id; });
    var best = null, score = 0;
    KH.simdata.propertyMarket.forEach(function (l) {
      if (owned.indexOf(l.id) !== -1) return;
      var sc = 0;
      l.address.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).forEach(function (w) {
        if (w.length > 3 && norm.indexOf(w) !== -1) sc += w.length;
      });
      if (sc > score) { score = sc; best = l; }
    });
    return score >= 5 ? best : null;
  }

  function done(text) { KH.app.refreshAll(); return text; }

  /* "Buy 5,000 TNET" is an instruction. "How do I buy TNET?" is not.
     Polite framing is stripped first, so "could you buy 5,000 TNET"
     still counts as an instruction. */
  var POLITE = /^\s*(please\s+)?(can|could|would|will)\s+you\s+(please\s+)?|^\s*please\s+|^\s*(i\s+(want|need|would like|'d like)\s+you\s+to\s+)|^\s*(go ahead and\s+)/i;
  var QUESTION = /^(how|what|which|who|why|when|where|should|shall|is|are|was|were|do|does|did|am|any|tell|explain|thoughts|opinion|advice|worth|any ?one|anybody)\b/i;

  function execute(q) {
    var raw = String(q).trim();
    var stripped = raw.replace(POLITE, '').trim();
    var wasPolite = stripped !== raw;
    if (!wasPolite && (QUESTION.test(raw) || /\?\s*$/.test(raw))) return null;

    q = stripped || raw;
    var norm = normalise(q);
    var tokens = norm.trim().split(' ').filter(Boolean);
    if (!ACTION_WORDS.test(norm)) return null;

    var inst = findTicker(q);
    var amount = parseAmount(q);
    var g = G();

    /* ---- Time ---- */
    if (/\b(advance|skip|next week|move on|step forward)\b/.test(norm)) {
      var howMany = amount && !amount.isMoney && amount.value <= 26 ? Math.max(1, Math.round(amount.value)) : 1;
      var before = KH.sim.netWorth().total;
      for (var w = 0; w < howMany; w++) KH.clock.advance(true);
      var after = KH.sim.netWorth().total;
      return done('Advanced ' + howMany + ' week' + (howMany > 1 ? 's' : '') + '. It is now week ' + G().clock.week +
        ' of year ' + G().clock.year + '.\n\nNet worth moved ' + fmt.signed(after - before, 0) + ' to ' + money(after) +
        '. Cash is ' + money(G().treasury.cash) + '.');
    }
    if (/\b(pause|stop|freeze|hold)\b/.test(norm) && /\b(time|clock|game|sim)\b/.test(norm)) {
      KH.clock.setPace('paused');
      KH.store.set('workspace', { simPace: 'paused' });
      return done('Time paused. Nothing will move until you say so.');
    }
    if (/\b(speed|faster|hurry|quicker)\b/.test(norm)) {
      KH.clock.setPace('fast'); KH.store.set('workspace', { simPace: 'fast' });
      return done('Time set to fast \u2014 a week every twelve seconds.');
    }
    if (/\b(slow|slower|steady)\b/.test(norm) && /\b(time|down|clock|pace)\b/.test(norm)) {
      KH.clock.setPace('slow'); KH.store.set('workspace', { simPace: 'slow' });
      return done('Time set to slow \u2014 a week every forty-five seconds.');
    }
    if (/\b(resume|unpause|start|carry on|continue)\b/.test(norm) && /\b(time|clock|game|sim)\b/.test(norm)) {
      KH.clock.setPace('normal'); KH.store.set('workspace', { simPace: 'normal' });
      return done('Running again at normal pace.');
    }

    /* ---- Reports ---- */
    if (/\b(export|download|print|generate)\b/.test(norm) && /\b(report|pdf|pack|schedule|ledger|sheet|statement|paper)\b/.test(norm)) {
      if (/\bledger|transaction|statement\b/.test(norm)) { KH.reports.ledger(120); return 'Ledger exported as a PDF.'; }
      if (/\bpropert|schedule\b/.test(norm)) { KH.reports.propertySchedule(); return 'Property schedule exported as a PDF.'; }
      if (/\bmarket|sheet\b/.test(norm)) { KH.reports.marketSheet(); return 'Market sheet exported as a PDF \u2014 all ' + KH.market.book().length + ' lines with turnaround scores.'; }
      if (inst && /\bboard|pack\b/.test(norm)) { KH.reports.boardPack(inst.sym); return 'Board pack for ' + inst.name + ' exported as a PDF.'; }
      KH.reports.groupPosition();
      return 'Group position report exported as a PDF \u2014 net worth, holdings, property and commentary.';
    }

    /* ---- Treasury ---- */
    if (/\b(repay|pay off|pay down|clear)\b/.test(norm) && /\b(debt|facility|treasury|loan|government|state)\b/.test(norm)) {
      if (g.treasury.debt <= 0) return 'There is no state debt to repay.';
      var want = amount && amount.value ? amount.value : Math.min(g.treasury.debt, g.treasury.cash);
      var r = KH.sim.repayDebt(want);
      if (!r.ok) return 'I could not do that: ' + r.reason;
      return done('Repaid ' + money(r.paid) + ' of the state facility. Outstanding is now ' + money(G().treasury.debt) +
        ', cash ' + money(G().treasury.cash) + '.');
    }
    if (/\b(take|accept|draw|get)\b/.test(norm) && /\bbailout|state (money|support|aid)|rescue|facility\b/.test(norm)) {
      var offer = KH.sim.bailoutOffer();
      KH.sim.takeBailout();
      return done('Drawn ' + money(offer.amount) + ' under the Treasury facility. The state now holds ' +
        (offer.equity * 100).toFixed(0) + '% at ' + (offer.rate * 100).toFixed(1) + '%, reputation is down ' +
        offer.reputation + ' and you are under oversight for ' + offer.oversightWeeks +
        ' weeks.\n\nCash is ' + money(G().treasury.cash) + '. My advice is to fix the operating deficit before the next round, because the next round is worse.');
    }

    /* ---- Dealing ---- */
    var wantsControl = /\b(control|majority|take over|takeover|51|50%|over half)\b/.test(norm);
    if (/\b(buy|purchase|acquire|pick up|take)\b/.test(norm) && inst) {
      var qty;
      if (wantsControl) {
        qty = costToControl(inst.sym).need;
        if (!qty) return 'You already control ' + inst.name + '.';
      } else if (amount && amount.isMoney) {
        qty = Math.floor(amount.value / (inst.px / 100));
      } else if (amount && !amount.isMoney) {
        qty = Math.round(amount.value);
      } else {
        return 'How many ' + inst.sym + ' shares, or how much would you like to spend? The price is ' +
          fmt.group(inst.px, 2) + 'p, and control would need ' + fmt.group(costToControl(inst.sym).need, 0) + ' shares.';
      }
      var res = KH.market.deal('buy', inst.sym, qty);
      if (!res.ok) return 'The order was rejected: ' + res.reason;
      var own = KH.sim.ownership(inst.sym);
      return done('Bought ' + fmt.group(qty, 0) + ' ' + inst.sym + ' at ' + fmt.group(res.quote.px * 100, 2) +
        'p. Total cost ' + money(res.quote.net) + ' including ' + money(res.quote.costs.total) + ' of charges.\n\n' +
        'You now hold ' + (own * 100).toFixed(2) + '% of ' + inst.name + '. Cash is ' + money(G().treasury.cash) + '.' +
        (own >= KH.sim.CONTROL ? '\n\nThat is control. Strategy, pricing, people and the chief executive are yours \u2014 and so are the losses if it makes any.' :
          own >= KH.sim.BOARD ? '\n\nThat is a board seat. You can appoint a chief executive and commission marketing.' : ''));
    }

    if (/\b(sell|dump|dispose|offload|liquidate)\b/.test(norm) && inst) {
      var held = g.corps[inst.sym];
      if (!held || !held.shares) return 'You do not hold any ' + inst.sym + '.';
      var sellQty;
      if (/\b(all|everything|the lot|whole|entire|out)\b/.test(norm)) sellQty = held.shares;
      else if (/\bhalf\b/.test(norm)) sellQty = Math.floor(held.shares / 2);
      else if (amount && amount.isMoney) sellQty = Math.floor(amount.value / (inst.px / 100));
      else if (amount && !amount.isMoney) sellQty = Math.round(amount.value);
      else sellQty = held.shares;
      var sres = KH.market.deal('sell', inst.sym, sellQty);
      if (!sres.ok) return 'The order was rejected: ' + sres.reason;
      return done('Sold ' + fmt.group(sellQty, 0) + ' ' + inst.sym + ' at ' + fmt.group(sres.quote.px * 100, 2) +
        'p. Proceeds ' + money(sres.quote.net) + ' after ' + money(sres.quote.costs.total) + ' of charges.\n\nCash is now ' +
        money(G().treasury.cash) + '.');
    }

    /* ---- Governance ---- */
    if (/\b(audit|investigate|forensic|check the books)\b/.test(norm)) {
      var target = inst || (atRisk()[0] ? KH.market.get(atRisk()[0].sym) : null);
      if (!target) return 'Nothing is flagged and you have not named a company. Tell me which one and I will instruct the auditors.';
      var ares = KH.sim.audit(target.sym);
      if (!ares.ok) return 'I could not instruct that: ' + ares.reason;
      return done(ares.found
        ? 'The audit at ' + target.name + ' found a hole. ' + money(ares.recovered) + ' recovered, ' +
          'the chief executive removed for cause with no settlement, and the cost of the work was ' + money(ares.cost) + '.'
        : 'The audit at ' + target.name + ' came back clean. ' + money(ares.cost) + ' spent, suspicion reset.');
    }

    if (/\b(appoint|install|hire|make|put)\b/.test(norm) && /\b(ceo|chief|executive|boss|in charge|to run)\b/.test(norm)) {
      var exec = findExec(norm);
      var sym = inst ? inst.sym : Object.keys(g.corps).filter(function (k) { return KH.sim.onBoard(k) && !g.corps[k].ceo; })[0];
      if (!sym) return 'Which company? You need at least a 25% stake to make a board appointment.';
      if (!exec) {
        var pool = KH.simdata.executives.filter(function (e) {
          return !Object.keys(g.corps).some(function (k) { return g.corps[k].ceo === e.id; });
        }).sort(function (a, b) { return (b.competence - (1 - b.integrity) * 0.7) - (a.competence - (1 - a.integrity) * 0.7); });
        exec = pool[0];
      }
      var cres = KH.sim.appointCeo(sym, exec.id);
      if (!cres.ok) return 'I could not make that appointment: ' + cres.reason;
      var risk = (1 - exec.integrity) * (0.6 + exec.ambition * 0.5);
      return done(exec.name + ' is appointed chief executive of ' + KH.market.get(sym).name + ' at ' + money(exec.fee) +
        ' a year, plus ' + money(exec.fee * 0.25) + ' on signing.\n\nCompetence ' + (exec.competence * 100).toFixed(0) +
        ', integrity ' + (exec.integrity * 100).toFixed(0) + '. ' +
        (risk > 0.4 ? 'I would put a compliance officer above him this week. That halves what he can take.'
                    : 'Low risk. I will keep an eye on the suspicion index and tell you if it moves.'));
    }

    if (/\b(fire|dismiss|sack|remove|terminate|get rid)\b/.test(norm) && /\b(ceo|chief|executive|boss)\b/.test(norm)) {
      var fsym = inst ? inst.sym : Object.keys(g.corps).filter(function (k) { return g.corps[k].ceo; })[0];
      if (!fsym) return 'There is no chief executive in post anywhere to remove.';
      var fres = KH.sim.dismissCeo(fsym, false);
      if (!fres.ok) return 'I could not do that: ' + fres.reason;
      return done('Removed from ' + KH.market.get(fsym).name + '. Settlement of ' + money(fres.payoff) +
        ' paid.\n\nCash is ' + money(G().treasury.cash) + '. The company will drift until you put somebody else in.');
    }

    /* ---- Staff ---- */
    if (/\b(hire|recruit|appoint|find me|get me|bring in)\b/.test(norm)) {
      var role = findRole(norm, tokens);
      var hsym = inst ? inst.sym : Object.keys(g.corps).filter(function (k) { return KH.sim.controls(k); })[0];
      if (!hsym) return 'You do not control anything yet, so there is nobody to appoint to.';
      if (!role) {
        var lever = weakestLever(hsym);
        if (!lever) return 'The team at ' + KH.market.get(hsym).name + ' already covers every binding lever. Adding people now is cost without effect.';
        role = lever.role;
      }
      var shortlist = KH.sim.candidates(role.id).sort(function (a, b) { return b.skill - a.skill; });
      var pick = shortlist[0];
      var hres = KH.sim.hire(hsym, pick);
      if (!hres.ok) return 'I could not make that appointment: ' + hres.reason;
      return done('Appointed ' + pick.name + ' as ' + role.label.toLowerCase() + ' at ' + KH.market.get(hsym).name +
        '.\n\nCapability ' + (pick.skill * 100).toFixed(0) + '/100, ' + money(pick.salary) +
        ' a year. I interviewed three and took the strongest.\n\n' + role.blurb);
    }

    /* ---- Strategy ---- */
    if (/\b(strategy|switch|adopt|change direction|posture|set)\b/.test(norm)) {
      var st = findStrategy(norm);
      if (st) {
        var ssym = inst ? inst.sym : Object.keys(g.corps).filter(function (k) { return KH.sim.controls(k); })[0];
        if (!ssym) return 'You do not control anything, so there is no strategy to set.';
        var sres2 = KH.sim.setStrategy(ssym, st.id);
        if (!sres2.ok) return 'I could not set that: ' + sres2.reason;
        var grumble = (st.id === 'cost' || st.id === 'harvest')
          ? '\n\nDone, because you asked. On the record: I think squeezing the cost base is how a company stops being able to do the thing it was good at. The margin will improve and something else will quietly stop working. Do not say I did not say so.'
          : '';
        return done(KH.market.get(ssym).name + ' is now on ' + st.label.toLowerCase() + '. ' + st.blurb +
          '\n\nIt applies from next week and works through the numbers over six to eight weeks.' + grumble);
      }
    }

    /* ---- Pricing ---- */
    if (/\b(price|pricing|charge)\b/.test(norm) && /\b(raise|increase|put up|cut|lower|drop|reduce|set)\b/.test(norm)) {
      var psym = inst ? inst.sym : Object.keys(g.corps).filter(function (k) { return KH.sim.controls(k); })[0];
      if (!psym) return 'Pricing needs control of the company. You do not have it anywhere yet.';
      var corp = g.corps[psym];
      var up = /\b(raise|increase|put up|up)\b/.test(norm);
      var step = amount && !amount.isMoney && amount.value <= 400 ? Math.round(amount.value) : null;
      var moved = [];
      corp.ranges.forEach(function (r, i) {
        var target = step !== null && /\bto\b/.test(norm) ? step : r.price + (up ? 15 : -15);
        var rres = KH.sim.setPrice(psym, i, target);
        if (rres.ok) moved.push(r.label + ' \u2192 ' + corp.ranges[i].price);
      });
      return done('Repriced every range at ' + KH.market.get(psym).name + ':\n\n' + bullets(moved) +
        '\n\nRoughly, ten points of price is nine points of volume and three and a half of margin. I will tell you in a few weeks whether it landed.');
    }

    /* ---- Marketing ---- */
    if (/\b(campaign|advertis|market|promote|launch|commission)\b/.test(norm) && !/\bmarket sheet\b/.test(norm)) {
      var ch = findChannel(norm);
      var msym = inst ? inst.sym : Object.keys(g.corps).filter(function (k) { return KH.sim.onBoard(k); })[0];
      if (!msym) return 'Marketing needs at least a 25% stake and you do not have one yet.';
      if (!ch) {
        var target2 = KH.market.get(msym);
        var scale = KH.util.clamp(Math.log10(Math.max(1e6, target2.f.revenue)) / 8.5, 0.35, 2.4);
        ch = KH.simdata.channels.map(function (c) {
          var cost = c.cost * scale;
          return { c: c, ratio: (c.reach * (1 / (1 - c.decay))) / cost };
        }).sort(function (a, b) { return b.ratio - a.ratio; })[0].c;
      }
      var slogan = KH.simdata.slogans[Math.floor(Math.random() * KH.simdata.slogans.length)];
      var mres = KH.sim.launchCampaign(msym, ch.id, slogan);
      if (!mres.ok) return 'The campaign was not booked: ' + mres.reason;
      return done('Booked ' + ch.label.toLowerCase() + ' for ' + KH.market.get(msym).name + ' at ' + money(mres.cost) +
        '.\n\nThe line is "' + slogan + '". Reach goes up about ' + (ch.reach * 100).toFixed(0) +
        '% immediately and decays each week from there. ' + ch.blurb);
    }

    /* ---- Property ---- */
    if (/\b(buy|purchase|acquire)\b/.test(norm)) {
      var listing = findListing(norm);
      if (listing) {
        var pres = KH.sim.buyProperty(listing.id);
        if (!pres.ok) return 'The purchase did not complete: ' + pres.reason;
        return done('Completed on ' + listing.address + ' at ' + money(pres.price) + ' plus ' + money(pres.fees) +
          ' of fees.\n\nCondition ' + listing.condition + '/100, rent ' + money(KH.sim.marketRent(listing)) +
          ' a week. Cash is now ' + money(G().treasury.cash) + '.' +
          (listing.condition < 40 ? '\n\nIt will not let in that condition. Say the word and I will get quotes in.' : ''));
      }
    }

    if (/\b(quote|quotes|tender|estimate)\b/.test(norm) && /\b(get|request|obtain|find|need)\b/.test(norm)) {
      var prop = findProperty(q) || g.props.slice().sort(function (a, b) { return a.condition - b.condition; })[0];
      if (!prop) return 'You own no property to quote for.';
      var work = KH.simdata.works.filter(function (wk) {
        return wk.label.toLowerCase().split(/[\s&]+/).some(function (t) { return t.length > 3 && norm.indexOf(t) !== -1; });
      })[0] || bestWorks(prop)[0].work;
      var qres = KH.sim.requestQuotes(prop.id, work.id);
      if (!qres.ok) return 'No quotes: ' + qres.reason;
      var offers = G().offers.filter(function (o) { return o.propId === prop.id; })
        .sort(function (a, b) { return a.price - b.price; });
      return done(qres.count + ' firms have quoted for ' + work.label.toLowerCase() + ' at ' + prop.address + ':\n\n' +
        bullets(offers.map(function (o) {
          var b = KH.simdata.builders.filter(function (x) { return x.id === o.builderId; })[0];
          return b.name + ' \u2014 ' + money(o.price) + ', ' + o.weeks + ' weeks, quality ' +
            (b.quality * 100).toFixed(0) + ', turns up ' + (b.reliability * 100).toFixed(0) + '% of the time.';
        })) + '\n\nSay "accept the best quote" and I will instruct the one with the best quality and reliability per pound.');
    }

    if (/\b(accept|instruct|go with|take)\b/.test(norm) && /\bquote|builder|contractor|tender\b/.test(norm)) {
      var live = g.offers.slice();
      if (!live.length) return 'There are no quotes on the table.';
      var chosen;
      if (/\bcheapest|lowest|cheap\b/.test(norm)) chosen = live.sort(function (a, b) { return a.price - b.price; })[0];
      else if (/\bfastest|quickest|soonest\b/.test(norm)) chosen = live.sort(function (a, b) { return a.weeks - b.weeks; })[0];
      else chosen = live.sort(function (a, b) {
        return (b.quality * b.reliability) / b.price - (a.quality * a.reliability) / a.price;
      })[0];
      var ares2 = KH.sim.acceptQuote(chosen.id);
      if (!ares2.ok) return 'Not instructed: ' + ares2.reason;
      var bld = KH.simdata.builders.filter(function (x) { return x.id === chosen.builderId; })[0];
      var pr = G().props.filter(function (x) { return x.id === chosen.propId; })[0];
      return done('Instructed ' + bld.name + ' at ' + pr.address + ': ' + money(chosen.price) + ' over ' + chosen.weeks +
        ' weeks, 35% deposit paid today.\n\nThe property goes void while they are on site, so the rent stops before the value arrives.' +
        (bld.reliability < 0.6 ? '\n\nFor the record, I would not have chosen them. They turn up ' + (bld.reliability * 100).toFixed(0) + '% of the time.' : ''));
    }

    if (/\b(rent|let)\b/.test(norm) && /\b(raise|increase|put up|cut|lower|drop|reduce|set)\b/.test(norm)) {
      var rprop = findProperty(q) || g.props[0];
      if (!rprop) return 'You own no property.';
      var upr = /\b(raise|increase|put up)\b/.test(norm);
      var newRent = amount && amount.isMoney ? Math.round(amount.value)
        : Math.round(rprop.rent * (upr ? 1.1 : 0.9));
      KH.sim.setRent(rprop.id, newRent);
      return done('Rent at ' + rprop.address + ' set to ' + money(newRent) + ' a week, a gross yield of ' +
        ((newRent * 52 / rprop.value) * 100).toFixed(2) + '%.' +
        (!rprop.tenanted ? ' It is void at the moment; a lower asking rent lets faster.' : ''));
    }

    return null;
  }

  /* ============================================================
     The matcher
     ============================================================ */

  function ask(question) {
    var q = String(question || '').trim();
    if (!q) return 'Ask me anything about the group. Try "how are we doing".';

    var offshore = offshoreCheck(q);
    if (offshore) return offshore;

    var berry = berryCheck(q);
    if (berry) return berry;

    var rage = appleRage(q);
    if (rage) return rage;

    // An instruction is carried out before it is discussed.
    var acted = null;
    try { acted = execute(q); }
    catch (err) { console.error('assistant action failed', err); acted = 'Something went wrong carrying that out. Nothing has been changed.'; }
    if (acted) return acted;

    var norm = normalise(q);
    var tokens = norm.trim().split(' ').filter(Boolean);

    var scored = INTENTS.map(function (it) {
      var score = 0;
      it.keys.forEach(function (k) { score += fuzzyHas(tokens, norm, k); });
      return { it: it, score: score };
    }).filter(function (r) { return r.score > 0; })
      .sort(function (a, b) { return b.score - a.score; });

    for (var i = 0; i < scored.length; i++) {
      var out = scored[i].it.fn(q);
      if (out) return hedge(out);
    }

    // Nothing matched by keyword, but a company was named — analyse it.
    var inst = findTicker(q);
    if (inst) return analyse(inst);

    var prop = findProperty(q);
    if (prop) return propertyAdvice(prop);

    return 'I am not certain what you are after, so here is where things stand and what I would do next.\n\n' +
      INTENTS[0].fn(q);
  }

  function propertyAdvice(p) {
    var ranked = bestWorks(p).slice(0, 2);
    return p.address + ' — ' + p.type + '.\n\n' + bullets([
      'Valued ' + money(p.value) + ', cost ' + money(p.paid) + ' (' + pct(((p.value - p.paid) / p.paid) * 100) + ')',
      'Condition ' + Math.round(p.condition) + '/100',
      p.works.length ? 'Works on site: ' + p.works.map(function (w) { return w.label + ', ' + w.weeksLeft + ' weeks left'; }).join('; ')
        : p.tenanted ? 'Let at ' + money(p.rent) + ' a week — ' + ((p.rent * 52 / p.value) * 100).toFixed(2) + '% gross'
          : 'Void for ' + (p.void || 0) + ' weeks',
      'Best works by return: ' + ranked[0].work.label + ' at about ' + money(ranked[0].cost) + ' for ' + ranked[0].ratio.toFixed(2) + 'x'
    ]) + '\n\n' + (p.condition < 40
      ? 'Condition is the problem. Below forty it will not let, so the works are not optional — they are the only way this earns anything.'
      : p.tenanted ? 'It is working. Leave it alone and put the rent into something that is not.'
        : 'It is in lettable condition and still void. Drop the rent by about 8% and it will go.');
  }

  /* He is extremely good at what is in front of him and completely
     blind to what has not happened yet. He says so, rather than
     inventing a forecast. */
  var LIMITS = [
    'I should say: I can read every number in the group and none of the ones in the future. Events land at random and I do not see them coming.',
    'Worth flagging \u2014 that is what the figures say today. A sector shock could land next week and I would know about it at the same moment you do.',
    'That is analysis, not prophecy. I can tell you what the book says; I cannot tell you what the market will feel about it on Thursday.'
  ];

  function hedge(answer) {
    if (Math.random() > 0.28) return answer;
    return answer + '\n\n' + LIMITS[Math.floor(Math.random() * LIMITS.length)];
  }

  KH.mike = {
    ask: ask, execute: execute, weeklyFlow: weeklyFlow, runway: runway, opportunities: opportunities,
    costToControl: costToControl, weakestLever: weakestLever, atRisk: atRisk, nextStep: nextStep
  };
})(window.KH);

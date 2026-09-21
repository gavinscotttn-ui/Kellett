/* ============================================================
   The week.

   Everything that changes, changes here: fundamentals, payroll,
   rent, building works, chief executives and their expenses, the
   news, and the price the market puts on all of it.
   ============================================================ */

(function (KH) {
  'use strict';

  var G = function () { return KH.game.get(); };

  var PACE = {
    paused: 0,
    slow: 45000,
    normal: 24000,
    fast: 12000,
    rapid: 6000
  };

  var timer = null;
  var pace = 'normal';
  var lastTick = 0;

  /* ============================================================
     How a company you run actually performs
     ============================================================ */

  function staffPower(corp, effect) {
    var total = 0;
    (corp.staff || []).forEach(function (p) {
      var role = KH.simdata.roles.filter(function (r) { return r.id === p.roleId; })[0];
      if (role && role.effect === effect) total += p.skill * role.power;
    });
    return total;
  }

  function awarenessOf(corp, week) {
    var total = 0;
    (corp.campaigns || []).forEach(function (c) {
      var age = Math.max(0, week - c.week);
      total += c.power * Math.pow(c.decay, age);
    });
    return Math.min(0.9, total);
  }

  /** Price and specification, resolved into demand and margin. */
  function rangeEffect(corp) {
    var demand = 0, margin = 0, weight = 0;
    (corp.ranges || []).forEach(function (r) {
      var w = r.share || 0.25;
      var priceDemand = KH.util.clamp((215 - r.price) / 115, 0.05, 1.55);
      var qualityDemand = 0.55 + (r.quality / 100) * 0.8;
      demand += priceDemand * qualityDemand * w;
      margin += (((r.price - 100) / 100) * 0.34 - ((r.quality - 50) / 100) * 0.16) * w;
      weight += w;
    });
    if (!weight) return { demand: 1, margin: 0 };
    return { demand: demand / weight, margin: margin / weight };
  }

  /** Apply everything the player is doing to a company they control. */
  function applyManagement(inst, corp, week) {
    var f = inst.f;
    var strat = KH.sim.strategy(corp.strategy);
    var ranges = rangeEffect(corp);
    var awareness = awarenessOf(corp, week);

    var opsSkill = staffPower(corp, 'efficiency');
    var salesSkill = staffPower(corp, 'demand');
    var engSkill = staffPower(corp, 'quality');
    var finSkill = staffPower(corp, 'margin');
    var hrSkill = staffPower(corp, 'morale');

    var exec = corp.ceo ? KH.simdata.executives.filter(function (e) { return e.id === corp.ceo; })[0] : null;
    var execLift = exec ? (exec.competence - 0.5) * 0.9 : 0;

    var targetDemand = ranges.demand * (1 + awareness) * (1 + strat.demand) * (1 + salesSkill * 0.035) * (1 + execLift * 0.06);
    var targetMargin = f.baseMargin + ranges.margin + strat.margin + finSkill * 0.014 + opsSkill * 0.010 + execLift * 0.03 - (strat.cost || 0);
    var targetEff = 1 + opsSkill * 0.03 + (strat.quality || 0) * 0.3 + execLift * 0.05;

    // Nothing moves overnight. Everything converges.
    f.demand += (targetDemand - f.demand) * 0.16;
    f.margin += (targetMargin - f.margin) * 0.14;
    f.efficiency += (targetEff - f.efficiency) * 0.12;
    f.awareness = awareness;

    var moraleTarget = 58 + hrSkill * 9 + (strat.morale || 0) * 100 + (exec ? exec.integrity * 14 : 0) - corp.staff.length * 0.4;
    f.morale += (KH.util.clamp(moraleTarget, 5, 98) - f.morale) * 0.18;
    corp.morale = Math.round(f.morale);

    var riskTarget = KH.util.clamp(inst.risk + (strat.risk || 0) * 6 - (f.margin > 0.08 ? 0.7 : 0) - (f.morale > 75 ? 0.5 : 0) + (f.margin < 0 ? 1.2 : 0), 1, 5);
    f.risk += (riskTarget - f.risk) * 0.15;

    corp.efficiency = Math.round((f.efficiency - 1) * 100);
    corp.quality = Math.round(ranges.demand * 100) / 100;
    corp.awareness = Math.round(awareness * 100);

    // The one that cannot be fixed. Every gain rots by Friday.
    if (inst.cursed) {
      f.margin = Math.min(f.margin, -0.18) - 0.004;
      f.demand = Math.min(f.demand, 0.85) * 0.995;
      f.morale = Math.max(6, f.morale - 1.2);
      f.risk = 5;
    }
  }

  /** A company nobody is steering drifts on its own sector's terms. */
  function driftUnmanaged(inst) {
    var f = inst.f;
    f.margin += ((f.baseMargin + (inst.bias / 52) * 0.4) - f.margin) * 0.05 + (Math.random() - 0.5) * 0.004;
    f.demand += (1 - f.demand) * 0.05 + (Math.random() - 0.5) * 0.012;
    f.revenue *= 1 + inst.bias / 52 + (Math.random() - 0.5) * 0.006;
    f.morale += (60 - f.morale) * 0.04;
    if (inst.cursed) {
      f.margin -= 0.006;
      f.revenue *= 0.992;
    }
  }

  /* ============================================================
     Chief executives: what they do while you are not looking
     ============================================================ */

  function runExecutives(week) {
    var s = G();
    Object.keys(s.corps).forEach(function (sym) {
      var corp = s.corps[sym];
      if (!corp.ceo || !KH.sim.onBoard(sym)) return;
      var exec = KH.simdata.executives.filter(function (e) { return e.id === corp.ceo; })[0];
      if (!exec) { corp.ceo = null; return; }
      var inst = KH.market.get(sym);
      if (!inst) return;

      // They earn their fee, mostly.
      var lift = (exec.competence - 0.45) * 0.006 * (1 + exec.ambition * 0.4);
      inst.f.margin += inst.cursed ? 0 : lift;
      inst.f.revenue *= 1 + (inst.cursed ? 0 : lift * 0.8);

      // And they help themselves, in proportion to how little integrity
      // they have and how little supervision there is.
      var oversight = staffPower(corp, 'oversight') * 0.22 + (s.standing.scrutiny / 100) * 0.18;
      var appetite = (1 - exec.integrity) * (0.6 + exec.ambition * 0.5) - oversight;
      if (appetite > 0.06 && Math.random() < appetite * 0.55) {
        var take = Math.round(inst.f.revenue * 0.0006 * appetite * (0.5 + Math.random()));
        if (take > 0) {
          corp.stolen += take;
          corp.suspicion = KH.util.clamp(corp.suspicion + 3 + appetite * 9, 0, 100);
          KH.game.post('leakage', 'Unreconciled outflow — ' + inst.name, -take);
        }
      } else if (corp.suspicion > 0) {
        corp.suspicion = Math.max(0, corp.suspicion - 0.6);
      }

      // Somebody in accounts has had enough.
      if (corp.suspicion > 55 && Math.random() < (corp.suspicion - 55) / 100 * 0.22) {
        whistleblow(sym, corp, exec, inst);
      }
    });
  }

  function whistleblow(sym, corp, exec, inst) {
    var s = G();
    var exposed = corp.stolen;
    var recovered = Math.round(exposed * 0.34);
    corp.stolen = 0;
    corp.suspicion = 0;
    corp.ceo = null;
    s.stats.whistleblowers += 1;
    s.standing.reputation = KH.util.clamp(s.standing.reputation - 11, 0, 100);
    s.standing.scrutiny = KH.util.clamp(s.standing.scrutiny + 15, 0, 100);
    if (recovered > 0) KH.game.post('recovery', 'Partial recovery — ' + inst.name, recovered);
    inst.f.morale = KH.util.clamp(inst.f.morale - 12, 0, 100);
    KH.game.headline('Whistleblower exposes ' + exec.name + ' at ' + inst.name,
      KH.fmt.money(exposed, 0) + ' unaccounted for. ' + KH.fmt.money(recovered, 0) +
      ' recovered, the rest is gone, and the regulator now has your file on the top of the pile.', 'bad');
    KH.bus.emit('sim:scandal', { sym: sym, exec: exec.name, amount: exposed });
  }

  /* ============================================================
     Settlement
     ============================================================ */

  function settle(week) {
    var s = G();
    var income = 0, outgo = 0;

    // --- Holdings: dividends up, deficits down ---
    Object.keys(s.corps).forEach(function (sym) {
      var corp = s.corps[sym];
      if (!corp.shares) return;
      var inst = KH.market.get(sym);
      if (!inst) return;
      var own = KH.sim.ownership(sym);
      var weekly = KH.sim.earningsOf(inst) / 52;
      if (weekly >= 0) {
        income += weekly * own * KH.sim.PAYOUT;
      } else if (own >= KH.sim.CONTROL) {
        outgo += Math.abs(weekly) * own;   // control means funding it
      }
      // Payroll and the chief executive are yours once you control it.
      if (own >= KH.sim.CONTROL) {
        outgo += KH.util.sum(corp.staff, function (p) { return p.salary; }) / 52;
        if (corp.ceo) {
          var exec = KH.simdata.executives.filter(function (e) { return e.id === corp.ceo; })[0];
          if (exec) outgo += exec.fee / 52;
        }
      }
    });

    // --- Property ---
    s.props.forEach(function (p) {
      var active = p.works.length > 0;
      if (p.tenanted && !active) {
        income += p.rent;
        p.void = 0;
      } else {
        p.void = (p.void || 0) + 1;
        if (!active && p.condition > 35 && Math.random() < 0.10 + (p.condition / 500)) {
          p.tenanted = true;
          KH.game.headline('Let agreed at ' + p.address,
            KH.fmt.money(p.rent, 0) + ' a week on a new tenancy.', 'good');
        }
      }
      outgo += p.value * 0.00022;                       // holding costs
      p.condition = Math.max(2, p.condition - 0.09);    // everything rots

      // Works progress, and the occasional builder who does not turn up.
      p.works = p.works.filter(function (w) {
        var instalment = (w.total - w.paid) / Math.max(1, w.weeksLeft);
        if (s.treasury.cash - outgo + income < instalment) {
          w.overrun += 1;
          if (w.overrun === 1) {
            KH.game.headline('Works paused at ' + p.address,
              w.builder + ' has downed tools pending payment.', 'bad');
          }
          return true;
        }
        outgo += instalment;
        w.paid += instalment;
        if (Math.random() > w.reliability) {
          w.overrun += 1;
          if (w.overrun === 3) {
            KH.game.headline('Delay at ' + p.address,
              w.builder + ' cites weather, materials and a man called Gary.', 'bad');
          }
          return true;
        }
        w.weeksLeft -= 1;
        if (w.weeksLeft <= 0) {
          var gained = Math.round(w.condition * w.quality);
          p.condition = KH.util.clamp(p.condition + gained, 2, 100);
          p.value = Math.round(p.value * (1 + w.value * w.quality));
          p.rent = Math.round(p.rent * (1 + w.value * w.quality * 0.8));
          KH.game.headline(w.label + ' complete at ' + p.address,
            'Condition now ' + Math.round(p.condition) + '. Valuation ' + KH.fmt.money(p.value, 0) +
            ', rent ' + KH.fmt.money(p.rent, 0) + ' a week.', 'good');
          return false;
        }
        return true;
      });

      // Property drifts with its own market.
      p.value = Math.round(p.value * (1 + (0.0009 + (p.condition - 50) * 0.000012) + (Math.random() - 0.5) * 0.002));
    });

    // --- Financing ---
    if (s.treasury.debt > 0) {
      var rate = s.treasury.bailouts.length ? s.treasury.bailouts[s.treasury.bailouts.length - 1].rate : 0.06;
      outgo += (s.treasury.debt * rate) / 52;
    }

    // --- Standing drifts back towards the middle ---
    s.standing.scrutiny = KH.util.clamp(s.standing.scrutiny - 0.35, 0, 100);
    s.standing.reputation = KH.util.clamp(s.standing.reputation + (s.treasury.debt > 0 ? -0.05 : 0.09), 0, 100);

    var net = Math.round(income - outgo);
    if (net !== 0) {
      KH.game.post('operating', 'Weekly settlement — income ' + KH.fmt.money(income, 0) + ', costs ' + KH.fmt.money(outgo, 0), net);
    }
    return { income: income, outgo: outgo, net: net };
  }

  /* ============================================================
     News
     ============================================================ */

  function rollEvent() {
    if (Math.random() > 0.34) return;
    var ev = KH.simdata.events[Math.floor(Math.random() * KH.simdata.events.length)];
    var sign = Math.random() < 0.5 ? -1 : 1;
    var impact = ev.impact * (ev.impact < 0 ? 1 : sign);
    KH.market.book().forEach(function (inst) {
      if (ev.scope === 'sector' && inst.sector !== ev.sector) return;
      inst.f.demand *= 1 + impact * 0.5;
      inst.f.margin += impact * 0.02;
    });
    KH.game.headline(ev.head + (ev.scope === 'sector' ? ' — ' + ev.sector : ''), ev.body,
      impact >= 0 ? 'good' : 'bad');
  }

  /* ============================================================
     The tick
     ============================================================ */

  function advance(manual) {
    var s = G();
    s.clock.week += 1;
    if (s.clock.week > 52) { s.clock.week = 1; s.clock.year += 1; }
    s.clock.quarter = Math.min(4, Math.ceil(s.clock.week / 13));
    s.stats.weeksRun += 1;
    var week = s.clock.week + (s.clock.year - 1) * 52;

    KH.market.book().forEach(function (inst) {
      if (!inst.f) return;
      var corp = s.corps[inst.sym];
      if (corp && KH.sim.controls(inst.sym)) applyManagement(inst, corp, week);
      else driftUnmanaged(inst);
      // Revenue responds to demand over time, not instantly.
      inst.f.revenue *= 1 + (inst.f.demand - 1) * 0.02;
      inst.f.margin = KH.util.clamp(inst.f.margin, -0.6, 0.62);
      inst.f.demand = KH.util.clamp(inst.f.demand, 0.15, 3.2);
      inst.f.efficiency = KH.util.clamp(inst.f.efficiency, 0.55, 1.9);
      // The anchor walks toward fair value; the tape walks around the anchor.
      var fair = KH.sim.fairPrice(inst);
      inst.anchor = inst.anchor + (fair - inst.anchor) * 0.19;
      inst.fair = fair;

      // A week is a week whether or not anybody watched it pass. The quote
      // closes most of the gap to the anchor here rather than waiting on
      // the fast tick to walk it there in real time, and the intraday tail
      // is rebased by the same proportion so a fast-forwarded month reads
      // as a rising line rather than a cliff at the right-hand edge.
      var was = inst.px;
      inst.px = Math.max(0.5, inst.px + (inst.anchor - inst.px) * 0.55);
      var lift = inst.px / was;
      if (isFinite(lift) && lift > 0) {
        inst.intraday.forEach(function (pt) { pt.v *= lift; });
        inst.open *= lift;
        inst.high = Math.max(inst.high * lift, inst.px);
        inst.low = Math.min(inst.low * lift, inst.px);
      }
      inst.prevClose = was;

      // One more session on the 90-day chart, so the history keeps growing.
      if (inst.candles && inst.candles.length) {
        var last = inst.candles[inst.candles.length - 1];
        inst.candles.push({
          t: last.t + 86400000,
          o: was, c: inst.px,
          h: Math.max(was, inst.px) * (1 + Math.random() * inst.vol * 0.5),
          l: Math.min(was, inst.px) * (1 - Math.random() * inst.vol * 0.5)
        });
        if (inst.candles.length > 120) inst.candles.shift();
      }
    });

    runExecutives(week);
    rollEvent();
    var result = settle(week);

    var worth = KH.sim.netWorth();
    if (worth.total > s.stats.peakNetWorth) s.stats.peakNetWorth = worth.total;
    s.history.push({
      w: s.stats.weeksRun, t: Date.now(), total: worth.total, cash: worth.cash,
      equity: worth.equity, property: worth.property
    });
    if (s.history.length > 520) s.history.shift();

    if (s.treasury.cash < 0) KH.bus.emit('sim:insolvent', KH.sim.bailoutOffer());

    KH.game.save();
    KH.bus.emit('sim:week', { week: s.clock.week, year: s.clock.year, result: result, manual: !!manual });
    return result;
  }

  function schedule() {
    clearInterval(timer);
    var ms = PACE[pace];
    if (!ms) return;
    timer = setInterval(function () {
      if (document.hidden) return;
      advance(false);
    }, ms);
  }

  function setPace(next) {
    pace = PACE[next] === undefined ? 'normal' : next;
    G().clock.running = pace !== 'paused';
    KH.game.save();
    schedule();
    KH.bus.emit('sim:pace', { pace: pace });
  }

  function start() {
    pace = KH.store.get('workspace').simPace || 'normal';
    schedule();
  }

  function progress() {
    var ms = PACE[pace];
    if (!ms) return 0;
    return KH.util.clamp((Date.now() - lastTick) / ms, 0, 1);
  }

  KH.bus.on('sim:week', function () { lastTick = Date.now(); });

  KH.clock = {
    start: start, advance: advance, setPace: setPace,
    pace: function () { return pace; }, paces: Object.keys(PACE), progress: progress,
    stop: function () { clearInterval(timer); }
  };
})(window.KH);

/* ============================================================
   Operating plan.

   The one thing a dashboard like this normally fails to say is
   "and what should I do now". This resolves the live state of the
   group into an ordered plan: eleven stages of building the
   business, each with a plain description, the panel it happens
   on, and a test that says whether it is done.

   Nothing here is a tutorial and nothing pops up. It is a
   checklist, the way an operating committee would keep one.
   ============================================================ */

(function (KH) {
  'use strict';

  var G = function () { return KH.game.get(); };

  function holdings() { return Object.keys(G().corps).filter(function (s) { return G().corps[s].shares > 0; }); }
  function bestStake() {
    return holdings().reduce(function (best, s) { return Math.max(best, KH.sim.ownership(s)); }, 0);
  }
  function controlled() { return holdings().filter(function (s) { return KH.sim.controls(s); }); }

  var STAGES = [
    {
      id: 'position', label: 'Open a position',
      detail: 'Buy shares in any listed company. Dividends start the same week.',
      panel: 'markets', action: 'Open the market',
      done: function () { return holdings().length > 0; }
    },
    {
      id: 'board', label: 'Take a board seat',
      detail: 'A quarter of the shares gets you a seat, a chief executive appointment and a marketing budget.',
      panel: 'markets', action: 'Build the stake',
      done: function () { return bestStake() >= KH.sim.BOARD; }
    },
    {
      id: 'control', label: 'Take control',
      detail: 'Past half the shares you set strategy, pricing, specification and the payroll — and you fund the losses.',
      panel: 'markets', action: 'Go to 50%',
      done: function () { return controlled().length > 0; }
    },
    {
      id: 'ceo', label: 'Appoint a chief executive',
      detail: 'A chief executive improves the company every week without being asked. Watch the integrity score.',
      panel: 'empire', action: 'Open governance',
      done: function () { return holdings().some(function (s) { return G().corps[s].ceo; }); }
    },
    {
      id: 'strategy', label: 'Set a strategy',
      detail: 'Seven postures, each trading margin against volume against risk. It takes six to eight weeks to land.',
      panel: 'empire', action: 'Choose a posture',
      done: function () { return controlled().some(function (s) { return G().corps[s].strategy !== 'steady'; }); }
    },
    {
      id: 'team', label: 'Build a senior team',
      detail: 'Each role moves one lever: cost, volume, quality, margin, morale or oversight.',
      panel: 'empire', action: 'Open a search',
      done: function () { return holdings().some(function (s) { return G().corps[s].staff.length > 0; }); }
    },
    {
      id: 'price', label: 'Take pricing in hand',
      detail: 'Ten points of price is about nine points of volume and three and a half of margin.',
      panel: 'empire', action: 'Review the ranges',
      done: function () {
        return controlled().some(function (s) {
          return G().corps[s].ranges.some(function (r) { return r.price !== 100; });
        });
      }
    },
    {
      id: 'campaign', label: 'Go to market',
      detail: 'A campaign lifts demand immediately and decays week by week. Trade press is the cheapest demand there is.',
      panel: 'empire', action: 'Commission one',
      done: function () { return holdings().some(function (s) { return G().corps[s].campaigns.length > 0; }); }
    },
    {
      id: 'property', label: 'Acquire a building',
      detail: 'Rent is the only income here that does not depend on the market being in a good mood.',
      panel: 'property', action: 'Open the listings',
      done: function () { return G().props.length > 0; }
    },
    {
      id: 'works', label: 'Commission works',
      detail: 'Four builders quote at once. Cheap, fast and good is a choice of two.',
      panel: 'property', action: 'Request quotes',
      done: function () { return G().stats.renovations > 0; }
    },
    {
      id: 'profit', label: 'Trade at a profit',
      detail: 'Get the weekly settlement positive: dividends and rent above payroll, fees and funding.',
      panel: 'overview', action: 'Review cash flow',
      done: function () { return KH.mike.weeklyFlow().net > 0; }
    }
  ];

  /** Stages, with completion sticky once reached. */
  function stages() {
    var g = G();
    if (!g.stats.milestones) g.stats.milestones = {};
    var dirty = false;
    var out = STAGES.map(function (st) {
      var done = !!g.stats.milestones[st.id];
      if (!done) {
        try { done = !!st.done(); } catch (err) { done = false; }
        if (done) { g.stats.milestones[st.id] = g.clock.week + (g.clock.year - 1) * 52; dirty = true; }
      }
      return { id: st.id, label: st.label, detail: st.detail, panel: st.panel, action: st.action, done: done };
    });
    if (dirty) KH.game.save();
    return out;
  }

  function progress() {
    var list = stages();
    return { done: list.filter(function (s) { return s.done; }).length, total: list.length, stages: list };
  }

  /* ---------- Things that are wrong right now ---------------------------
     Separate from the plan: the plan is what to build next, this is what
     is on fire. Ordered by how expensive it is to keep ignoring.
     --------------------------------------------------------------------- */

  function issues() {
    var g = G();
    var out = [];

    if (g.treasury.cash < 0) {
      out.push({
        severity: 'critical', label: 'The group is overdrawn',
        detail: 'Cash is ' + KH.fmt.money(g.treasury.cash, 0) + '. The Treasury will step in, at a price.',
        panel: 'markets', action: 'Raise cash'
      });
    }

    KH.mike.atRisk().forEach(function (r) {
      if (r.suspicion < 35) return;
      out.push({
        severity: r.suspicion > 55 ? 'critical' : 'warning',
        label: 'Suspicion at ' + r.sym + ' is ' + Math.round(r.suspicion),
        detail: KH.sim.execName(r.ceo) + ' is moving money. An audit recovers 62%; a whistleblower recovers 34% and costs eleven reputation points.',
        panel: 'empire', action: 'Audit', sym: r.sym
      });
    });

    var flow = KH.mike.weeklyFlow();
    if (flow.net < 0 && g.treasury.cash >= 0) {
      var weeks = Math.floor(g.treasury.cash / Math.abs(flow.net));
      if (weeks < 26) {
        out.push({
          severity: weeks < 8 ? 'critical' : 'warning',
          label: 'Burning ' + KH.fmt.money(Math.abs(flow.net), 0) + ' a week',
          detail: 'About ' + weeks + ' weeks of cash left. The largest drain is ' + flow.detail[0].what + '.',
          panel: 'overview', action: 'Review'
        });
      }
    }

    g.props.forEach(function (p) {
      if (p.tenanted || p.works.length) return;
      if ((p.void || 0) < 6) return;
      out.push({
        severity: 'warning', label: p.address + ' has been void ' + p.void + ' weeks',
        detail: p.condition < 40
          ? 'Condition is ' + Math.round(p.condition) + '. It will not let until works are done.'
          : 'It is lettable. A lower asking rent will move it.',
        panel: 'property', action: 'Open the book'
      });
    });

    holdings().forEach(function (sym) {
      var inst = KH.market.get(sym);
      if (!inst || !KH.sim.controls(sym)) return;
      if (KH.sim.earningsOf(inst) >= 0) return;
      out.push({
        severity: inst.cursed ? 'critical' : 'warning',
        label: inst.name + ' is loss-making',
        detail: inst.cursed
          ? 'This one cannot be turned around, and control means funding it every week. Sell it.'
          : 'You control it, so you are funding your share of the deficit weekly. It needs a turnaround programme.',
        panel: 'empire', action: 'Open', sym: sym
      });
    });

    var unhandled = KH.mail.messages.filter(function (m) {
      return m.choices && m.choices.length && g.inbox.handled[m.id] === undefined && m.priority;
    }).length;
    if (unhandled) {
      out.push({
        severity: 'info', label: unhandled + ' priority ' + (unhandled === 1 ? 'item needs' : 'items need') + ' a reply',
        detail: 'Decisions in the mailbox move cash and reputation.',
        panel: 'mail', action: 'Open the mailbox'
      });
    }

    var rank = { critical: 0, warning: 1, info: 2 };
    return out.sort(function (a, b) { return rank[a.severity] - rank[b.severity]; });
  }

  KH.flow = { stages: stages, progress: progress, issues: issues };
})(window.KH);

/* ============================================================
   The exchange.

   Two clocks drive a price. The weekly clock moves an anchor
   toward the company's fair value — earnings times a sector
   multiple over shares in issue — and the fast clock walks the
   quoted price around that anchor so the tape is alive between
   weeks. Run a company well and the anchor climbs; the tape
   follows it whether the market likes you or not.

   Cash and shareholdings live on the saved game, so a trade here
   and a dividend in the simulation are the same pound.
   ============================================================ */

(function (KH) {
  'use strict';

  var SESSIONS = 90;
  var INTRADAY = 150;

  /* Slower and smaller than it was. Fifty-two lines all moving twice a
     second reads as noise, not as a market. */
  var SPEEDS = {
    calm: { interval: 4500, scale: 0.45 },
    normal: { interval: 2600, scale: 0.8 },
    brisk: { interval: 1400, scale: 1.3 }
  };

  var state = { running: false, timer: null, speed: 'normal' };
  var book = [];
  var tape = [];
  var bySym = {};

  function hashSeed(sym) {
    var s = 0;
    for (var i = 0; i < sym.length; i++) s = (s * 31 + sym.charCodeAt(i)) >>> 0;
    return s;
  }

  function buildCandles(inst) {
    var rand = KH.util.rng(hashSeed(inst.sym));
    var px = inst.px, raw = [];
    for (var i = 0; i < SESSIONS; i++) {
      var drift = inst.bias / 252 - (inst.vol * inst.vol) / 2;
      var step = Math.exp(drift + inst.vol * KH.util.gauss(rand));
      var o = px;
      px = px * step;
      var spread = Math.abs(o - px) + o * inst.vol * (0.3 + rand() * 0.7);
      raw.push({ o: o, c: px, h: Math.max(o, px) + spread * rand() * 0.6, l: Math.min(o, px) - spread * rand() * 0.6 });
    }
    var k = inst.px / px;
    var day = new Date();
    day.setHours(0, 0, 0, 0);
    return raw.map(function (c, i) {
      return { t: day.getTime() - (SESSIONS - 1 - i) * 86400000, o: c.o * k, c: c.c * k, h: c.h * k, l: c.l * k };
    });
  }

  function buildIntraday(inst) {
    var rand = KH.util.rng(hashSeed(inst.sym) ^ 0x9e3779b9);
    var px = inst.prevClose, out = [];
    var now = Date.now();
    for (var i = 0; i < INTRADAY; i++) {
      px = px * Math.exp(-(inst.vol * inst.vol) / (2 * INTRADAY) + (inst.vol / Math.sqrt(INTRADAY)) * KH.util.gauss(rand));
      out.push({ t: now - (INTRADAY - 1 - i) * 60000, v: px });
    }
    var k = inst.px / out[out.length - 1].v;
    out.forEach(function (p) { p.v *= k; });
    return out;
  }

  function prepare(inst, quotedOnly) {
    inst.quotedOnly = !!quotedOnly;
    inst.dp = inst.dp === undefined ? 2 : inst.dp;
    if (!quotedOnly) {
      inst.candles = buildCandles(inst);
      inst.prevClose = inst.candles[inst.candles.length - 2].c;
    } else {
      inst.prevClose = inst.px / (1 + (KH.util.rng(hashSeed(inst.sym))() - 0.45) * inst.vol * 3);
    }
    inst.intraday = buildIntraday(inst);
    inst.open = inst.intraday[0].v;
    inst.high = Math.max.apply(null, inst.intraday.map(function (p) { return p.v; }));
    inst.low = Math.min.apply(null, inst.intraday.map(function (p) { return p.v; }));
    inst.anchor = inst.px;
    inst.lastMove = 0;
    inst.volume = Math.round(180000 + KH.util.rng(hashSeed(inst.sym))() * 3400000);
    return inst;
  }

  function init() {
    book = KH.instruments.list.map(function (i) { return prepare(Object.assign({}, i), false); });
    tape = KH.instruments.tape.map(function (i) { return prepare(Object.assign({}, i), true); });
    bySym = {};
    book.concat(tape).forEach(function (i) { bySym[i.sym] = i; });
    if (KH.sim && KH.sim.seedFundamentals) KH.sim.seedFundamentals();
    setSpeed(KH.store.get('workspace').marketSpeed || 'normal');
  }

  function sessionState(now) {
    var d = now ? new Date(now) : new Date();
    var day = d.getDay();
    var mins = d.getHours() * 60 + d.getMinutes();
    if (day === 0 || day === 6) return { open: false, label: 'Weekend — indicative pricing' };
    if (mins >= 480 && mins < 990) return { open: true, label: 'Open · continuous trading' };
    if (mins >= 450 && mins < 480) return { open: false, label: 'Pre-open auction' };
    return { open: false, label: 'After hours — indicative pricing' };
  }

  /** A walk around the anchor, pulled gently back toward it. */
  function step(inst, scale, damp) {
    var sigma = inst.vol * scale * damp * 0.06;
    var before = inst.px;
    var pull = inst.anchor ? (inst.anchor - inst.px) * 0.035 : 0;
    inst.px = Math.max(0.5, inst.px * Math.exp(-(sigma * sigma) / 2 + sigma * (Math.random() * 2 - 1) * 1.7) + pull);
    inst.lastMove = inst.px - before;
    if (inst.px > inst.high) inst.high = inst.px;
    if (inst.px < inst.low) inst.low = inst.px;
    inst.intraday.push({ t: Date.now(), v: inst.px });
    if (inst.intraday.length > INTRADAY) inst.intraday.shift();
    inst.volume += Math.round(Math.abs(inst.lastMove / inst.px) * 4200000 + Math.random() * 900);
  }

  function tick() {
    var s = SPEEDS[state.speed] || SPEEDS.normal;
    var session = sessionState();
    var damp = session.open ? 1 : 0.32;
    book.forEach(function (i) { step(i, s.scale, damp); });
    tape.forEach(function (i) { step(i, s.scale, damp); });
    KH.bus.emit('market:tick', { session: session });
  }

  function start() { if (state.running) return; state.running = true; schedule(); }

  function schedule() {
    clearInterval(state.timer);
    var s = SPEEDS[state.speed] || SPEEDS.normal;
    state.timer = setInterval(function () { if (!document.hidden) tick(); }, s.interval);
  }

  function stop() { state.running = false; clearInterval(state.timer); }
  function setSpeed(speed) { state.speed = SPEEDS[speed] ? speed : 'normal'; if (state.running) schedule(); }

  function get(sym) { return bySym[sym] || book[0]; }
  function change(inst) { return { abs: inst.px - inst.prevClose, pct: ((inst.px - inst.prevClose) / inst.prevClose) * 100 }; }

  /* ---------- Dealing ------------------------------------------------- */

  var COMMISSION_BPS = 12;
  var MIN_COMMISSION = 12.5;
  var STAMP_BPS = 50;

  function costs(side, consideration) {
    var commission = Math.max(MIN_COMMISSION, (consideration * COMMISSION_BPS) / 10000);
    var duty = side === 'buy' ? (consideration * STAMP_BPS) / 10000 : 0;
    var levy = consideration > 10000 ? 1.0 : 0;
    return { commission: commission, duty: duty, levy: levy, total: commission + duty + levy };
  }

  function quote(side, sym, qty) {
    var inst = get(sym);
    var px = inst.px / 100;
    var consideration = px * qty;
    var c = costs(side, consideration);
    return {
      inst: inst, px: px, qty: qty, consideration: consideration, costs: c,
      net: side === 'buy' ? consideration + c.total : consideration - c.total
    };
  }

  function deal(side, sym, qty) {
    qty = Math.floor(Number(qty));
    if (!isFinite(qty) || qty <= 0) return { ok: false, reason: 'Enter a whole number of shares greater than zero.' };
    var inst = get(sym);
    if (!inst || inst.quotedOnly) return { ok: false, reason: 'That line is quoted for information and cannot be dealt.' };

    var g = KH.game.get();
    var held = g.corps[sym];
    var q = quote(side, sym, qty);

    if (qty > inst.shares) return { ok: false, reason: 'There are only ' + KH.fmt.group(inst.shares, 0) + ' shares in issue.' };
    if (side === 'buy') {
      var after = (held ? held.shares : 0) + qty;
      if (after > inst.shares) return { ok: false, reason: 'That would take you past 100% of the company.' };
      if (q.net > g.treasury.cash) {
        return { ok: false, reason: 'Insufficient settled cash. This order needs ' + KH.fmt.money(q.net) + ' and ' + KH.fmt.money(g.treasury.cash) + ' is available.' };
      }
    }
    if (side === 'sell' && (!held || held.shares < qty)) {
      return { ok: false, reason: 'You hold ' + (held ? KH.fmt.group(held.shares, 0) : '0') + ' ' + sym + '. Short selling is not enabled on this account.' };
    }

    var wasControl = KH.sim.controls(sym);

    if (side === 'buy') {
      var rec = KH.game.corp(sym, true);
      rec.avgCost = (rec.avgCost * rec.shares + q.consideration + q.costs.total) / (rec.shares + qty);
      rec.shares += qty;
      KH.game.post('dealing', 'Bought ' + KH.fmt.group(qty, 0) + ' ' + sym, -q.net);
    } else {
      held.shares -= qty;
      KH.game.post('dealing', 'Sold ' + KH.fmt.group(qty, 0) + ' ' + sym, q.net);
      if (held.shares <= 0) {
        // Keep the record if it carries staff or a chief executive; a
        // sold-down company still has people you signed contracts with.
        if (!held.staff.length && !held.ceo) delete g.corps[sym];
        else held.shares = 0;
      }
    }

    g.stats.deals += 1;
    var nowControl = KH.sim.controls(sym);
    if (!wasControl && nowControl) {
      KH.game.headline('Control acquired: ' + inst.name,
        'You now hold more than half of ' + sym + '. Strategy, pricing, people and the chief executive are yours.', 'good');
      KH.bus.emit('sim:control', { sym: sym, gained: true });
    } else if (wasControl && !nowControl) {
      KH.game.headline('Control relinquished: ' + inst.name,
        'You are below 50% of ' + sym + ' and no longer set its direction.', 'neutral');
      KH.bus.emit('sim:control', { sym: sym, gained: false });
    }

    KH.game.save();
    KH.bus.emit('trading:changed', { side: side, sym: sym, qty: qty });
    return { ok: true, quote: q };
  }

  /* ---------- Portfolio ----------------------------------------------- */

  function positions() {
    var g = KH.game.get();
    return Object.keys(g.corps).filter(function (sym) { return g.corps[sym].shares > 0; }).map(function (sym) {
      var c = g.corps[sym];
      var inst = get(sym);
      var px = inst.px / 100;
      var value = px * c.shares;
      var cost = c.avgCost * c.shares;
      return {
        sym: sym, name: inst.name, qty: c.shares, avg: c.avgCost, px: px,
        value: value, cost: cost, pnl: value - cost,
        pnlPct: cost ? ((value - cost) / cost) * 100 : 0,
        dayPct: change(inst).pct, own: KH.sim.ownership(sym), inst: inst
      };
    }).sort(function (a, b) { return b.value - a.value; });
  }

  function portfolio() {
    var g = KH.game.get();
    var pos = positions();
    var invested = KH.util.sum(pos, function (p) { return p.value; });
    var cost = KH.util.sum(pos, function (p) { return p.cost; });
    return {
      cash: g.treasury.cash, invested: invested, cost: cost,
      total: g.treasury.cash + invested,
      pnl: invested - cost,
      pnlPct: cost ? ((invested - cost) / cost) * 100 : 0,
      sinceStart: g.treasury.cash + invested - g.treasury.opening,
      positions: pos
    };
  }

  function depth(sym) {
    var inst = get(sym);
    var mid = inst.px, tickSize = Math.max(0.05, mid * 0.00035);
    var rand = KH.util.rng(hashSeed(sym) + Math.floor(Date.now() / 4000));
    var bids = [], asks = [];
    for (var i = 0; i < 5; i++) {
      bids.push({ px: mid - tickSize * (i + 1), qty: Math.round(400 + rand() * 9000) });
      asks.push({ px: mid + tickSize * (i + 1), qty: Math.round(400 + rand() * 9000) });
    }
    return { bids: bids, asks: asks, spread: asks[0].px - bids[0].px };
  }

  KH.market = {
    init: init, start: start, stop: stop, tick: tick, setSpeed: setSpeed,
    book: function () { return book; }, tape: function () { return tape; },
    get: get, change: change, quote: quote, deal: deal, costs: costs,
    positions: positions, portfolio: portfolio, depth: depth, session: sessionState
  };
})(window.KH);

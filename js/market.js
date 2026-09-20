/* ============================================================
   The pricing engine.

   Prices follow a geometric random walk with a small per-line
   drift: log-normal steps, so a price can drift a long way but
   can never walk through zero, and consecutive ticks look like
   a market rather than a sawtooth.

   History is built once from a fixed seed per instrument, so the
   charts are the same every time the workspace opens; only the
   live tail moves.
   ============================================================ */

(function (KH) {
  'use strict';

  var SESSIONS = 90;     // daily candles behind each line
  var INTRADAY = 150;    // minute-ish points in the live series

  var SPEEDS = {
    calm: { interval: 3000, scale: 0.5 },
    normal: { interval: 1600, scale: 1 },
    brisk: { interval: 800, scale: 1.7 }
  };

  var state = {
    running: false,
    timer: null,
    speed: 'normal',
    lastTick: 0
  };

  var book = [];   // tradable instruments
  var tape = [];   // quoted-only lines

  function hashSeed(sym) {
    var s = 0;
    for (var i = 0; i < sym.length; i++) s = (s * 31 + sym.charCodeAt(i)) >>> 0;
    return s;
  }

  /** Build SESSIONS daily candles ending at the instrument's quoted price. */
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
    // Rescale the whole path so the last close is the quoted price.
    var k = inst.px / px;
    var day = new Date();
    day.setHours(0, 0, 0, 0);
    return raw.map(function (c, i) {
      return {
        t: day.getTime() - (SESSIONS - 1 - i) * 86400000,
        o: c.o * k, c: c.c * k, h: c.h * k, l: c.l * k
      };
    });
  }

  /** Build the intraday tail, ending exactly on the quoted price. */
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
    inst.lastMove = 0;
    inst.volume = Math.round(180000 + KH.util.rng(hashSeed(inst.sym))() * 3400000);
    return inst;
  }

  function init() {
    book = KH.instruments.list.map(function (i) { return prepare(Object.assign({}, i), false); });
    tape = KH.instruments.tape.map(function (i) { return prepare(Object.assign({}, i), true); });
    setSpeed(KH.store.get('workspace').marketSpeed || 'normal');
  }

  /** London cash session, used for the status label and to damp
      overnight moves. Prices still breathe outside it. */
  function sessionState(now) {
    var d = now ? new Date(now) : new Date();
    var day = d.getDay();
    var mins = d.getHours() * 60 + d.getMinutes();
    if (day === 0 || day === 6) return { open: false, label: 'Weekend — indicative pricing' };
    if (mins >= 480 && mins < 990) return { open: true, label: 'Open · continuous trading' };
    if (mins >= 450 && mins < 480) return { open: false, label: 'Pre-open auction' };
    return { open: false, label: 'After hours — indicative pricing' };
  }

  function step(inst, scale, damp) {
    var sigma = inst.vol * scale * damp * 0.09;
    var drift = (inst.bias || 0) / 252 / 400;
    var before = inst.px;
    inst.px = inst.px * Math.exp(drift - (sigma * sigma) / 2 + sigma * (Math.random() * 2 - 1) * 1.7);
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
    state.lastTick = Date.now();
    KH.bus.emit('market:tick', { session: session });
  }

  function start() {
    if (state.running) return;
    state.running = true;
    schedule();
  }

  function schedule() {
    clearInterval(state.timer);
    var s = SPEEDS[state.speed] || SPEEDS.normal;
    state.timer = setInterval(function () {
      if (document.hidden) return;   // a hidden tab burns nothing
      tick();
    }, s.interval);
  }

  function stop() { state.running = false; clearInterval(state.timer); }

  function setSpeed(speed) {
    state.speed = SPEEDS[speed] ? speed : 'normal';
    if (state.running) schedule();
  }

  function get(sym) { return book.filter(function (i) { return i.sym === sym; })[0] || book[0]; }

  function change(inst) {
    return { abs: inst.px - inst.prevClose, pct: ((inst.px - inst.prevClose) / inst.prevClose) * 100 };
  }

  /* ---------- Dealing ------------------------------------------------
     Costs are charged on the way in and on the way out, because a
     position that ignores them flatters itself.
     ------------------------------------------------------------------ */

  var COMMISSION_BPS = 12;     // 0.12%
  var MIN_COMMISSION = 12.5;
  var STAMP_BPS = 50;          // 0.5%, charged on purchases only

  function costs(side, consideration) {
    var commission = Math.max(MIN_COMMISSION, (consideration * COMMISSION_BPS) / 10000);
    var duty = side === 'buy' ? (consideration * STAMP_BPS) / 10000 : 0;
    var levy = consideration > 10000 ? 1.0 : 0;
    return { commission: commission, duty: duty, levy: levy, total: commission + duty + levy };
  }

  function quote(side, sym, qty) {
    var inst = get(sym);
    var px = inst.px / 100;                     // quoted in pence, dealt in pounds
    var consideration = px * qty;
    var c = costs(side, consideration);
    return {
      inst: inst, px: px, qty: qty,
      consideration: consideration,
      costs: c,
      net: side === 'buy' ? consideration + c.total : consideration - c.total
    };
  }

  function deal(side, sym, qty) {
    qty = Math.floor(Number(qty));
    if (!isFinite(qty) || qty <= 0) return { ok: false, reason: 'Enter a whole number of shares greater than zero.' };
    if (qty > 10000000) return { ok: false, reason: 'Order exceeds the single-ticket limit of 10,000,000 shares.' };

    var t = KH.store.get('trading');
    var q = quote(side, sym, qty);
    var held = t.positions[sym];

    if (side === 'buy' && q.net > t.cash) {
      return { ok: false, reason: 'Insufficient settled cash. This order needs ' + KH.fmt.money(q.net) + ' and ' + KH.fmt.money(t.cash) + ' is available.' };
    }
    if (side === 'sell' && (!held || held.qty < qty)) {
      return { ok: false, reason: 'You hold ' + (held ? KH.fmt.group(held.qty, 0) : '0') + ' ' + sym + '. Short selling is not enabled on this account.' };
    }

    if (side === 'buy') {
      t.cash -= q.net;
      if (held) {
        held.avg = (held.avg * held.qty + q.consideration + q.costs.total) / (held.qty + qty);
        held.qty += qty;
      } else {
        t.positions[sym] = { qty: qty, avg: (q.consideration + q.costs.total) / qty };
      }
    } else {
      t.cash += q.net;
      held.qty -= qty;
      if (held.qty <= 0) delete t.positions[sym];
    }

    t.blotter.unshift({
      id: 'KH' + Date.now().toString(36).toUpperCase(),
      ts: Date.now(), side: side, sym: sym, name: q.inst.name,
      qty: qty, px: q.px, consideration: q.consideration,
      fees: q.costs.total, net: q.net
    });
    if (t.blotter.length > 120) t.blotter.length = 120;

    KH.store.save();
    KH.bus.emit('trading:changed', { side: side, sym: sym, qty: qty });
    return { ok: true, quote: q };
  }

  /* ---------- Portfolio ---------------------------------------------- */

  function positions() {
    var t = KH.store.get('trading');
    return Object.keys(t.positions).map(function (sym) {
      var p = t.positions[sym];
      var inst = get(sym);
      var px = inst.px / 100;
      var value = px * p.qty;
      var cost = p.avg * p.qty;
      return {
        sym: sym, name: inst.name, qty: p.qty, avg: p.avg, px: px,
        value: value, cost: cost, pnl: value - cost,
        pnlPct: cost ? ((value - cost) / cost) * 100 : 0,
        dayPct: change(inst).pct, inst: inst
      };
    }).sort(function (a, b) { return b.value - a.value; });
  }

  function portfolio() {
    var t = KH.store.get('trading');
    var pos = positions();
    var invested = KH.util.sum(pos, function (p) { return p.value; });
    var cost = KH.util.sum(pos, function (p) { return p.cost; });
    return {
      cash: t.cash,
      invested: invested,
      cost: cost,
      total: t.cash + invested,
      pnl: invested - cost,
      pnlPct: cost ? ((invested - cost) / cost) * 100 : 0,
      sinceStart: t.cash + invested - t.startingCash,
      positions: pos
    };
  }

  /** A synthetic order book around the touch — five levels a side. */
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
    book: function () { return book; },
    tape: function () { return tape; },
    get: get, change: change, quote: quote, deal: deal, costs: costs,
    positions: positions, portfolio: portfolio, depth: depth,
    session: sessionState
  };
})(window.KH);

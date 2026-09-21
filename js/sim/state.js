/* ============================================================
   The save game.

   One object holds everything: the clock, the treasury, every
   shareholding and how it is being run, the property book, the
   toys, the ledger and the news. It is written to local storage
   on a debounce and can be exported to a file and read back.
   ============================================================ */

(function (KH) {
  'use strict';

  var KEY = 'kellett.game.v1';
  var VERSION = 1;

  var state = null;
  var persistent = true;
  var flushTimer = null;

  function blank() {
    return {
      v: VERSION,
      started: Date.now(),
      name: 'Kellett Holdings',
      clock: { week: 1, quarter: 1, year: 1, running: true, elapsed: 0 },
      treasury: {
        cash: 1896099,
        opening: 1896099,
        debt: 0,
        facility: 0,
        rating: 'A',
        bailouts: []
      },
      standing: { reputation: 64, scrutiny: 6, prestige: 0, morale: 70 },
      corps: {},        // sym -> holding + how it is being run
      props: [],        // owned property
      offers: [],       // live builder quotes
      lifestyle: [],    // things bought for oneself
      ledger: [],       // money in, money out
      history: [],      // one net-worth point per week
      news: [],         // what happened
      inbox: { handled: {} },  // correspondence decisions taken
      stats: {
        peakNetWorth: 0, weeksRun: 0, deals: 0, hires: 0, fires: 0,
        campaigns: 0, renovations: 0, bailouts: 0, whistleblowers: 0, sacked: 0
      }
    };
  }

  /** A holding record, created the first time you own a share of something. */
  function corpRecord(sym) {
    var inst = KH.market.get(sym);
    return {
      sym: sym,
      shares: 0,
      avgCost: 0,
      strategy: 'steady',
      staff: [],
      ranges: KH.instruments.rangesFor(inst ? inst.sector : '').map(function (label, i) {
        return { label: label, price: 100, quality: 50 + i * 3, share: 0.25 };
      }),
      campaigns: [],
      ceo: null,
      ceoSince: 0,
      suspicion: 0,
      stolen: 0,
      audited: 0,
      morale: 62,
      efficiency: 0,
      quality: 0,
      awareness: 0,
      riskDelta: 0,
      sinceWeek: 0
    };
  }

  function get() {
    if (state) return state;
    var raw = null;
    try { raw = window.localStorage.getItem(KEY); }
    catch (err) { persistent = false; }
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        state = (parsed && parsed.v === VERSION) ? hydrate(parsed) : blank();
      } catch (err) {
        console.warn('the stored game could not be read; starting a new one');
        state = blank();
      }
    } else {
      state = blank();
    }
    return state;
  }

  /** Fill in anything a save from an earlier session is missing. */
  function hydrate(save) {
    var base = blank();
    Object.keys(base).forEach(function (k) {
      if (save[k] === undefined) { save[k] = base[k]; return; }
      if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
        Object.keys(base[k]).forEach(function (k2) {
          if (save[k][k2] === undefined) save[k][k2] = base[k][k2];
        });
      }
    });
    Object.keys(save.corps || {}).forEach(function (sym) {
      var c = save.corps[sym], fresh = corpRecord(sym);
      Object.keys(fresh).forEach(function (k) { if (c[k] === undefined) c[k] = fresh[k]; });
    });
    return save;
  }

  function corp(sym, create) {
    var s = get();
    if (!s.corps[sym] && create) {
      s.corps[sym] = corpRecord(sym);
      s.corps[sym].sinceWeek = s.clock.week;
    }
    return s.corps[sym] || null;
  }

  function save() {
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, 400);
  }

  function flush() {
    if (!state) return;
    try { window.localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (err) {
      if (persistent) {
        persistent = false;
        console.warn('this game cannot be written to disk; progress will last for this session only');
        KH.bus.emit('storage:unavailable');
      }
    }
  }

  function reset() {
    state = blank();
    var cash = KH.store.get('trading').startingCash;
    state.treasury.cash = cash;
    state.treasury.opening = cash;
    flush();
    KH.bus.emit('game:reset');
  }

  /** Money in and out, with a note, so the ledger is never a mystery. */
  function post(kind, text, amount) {
    var s = get();
    s.treasury.cash += amount;
    s.ledger.unshift({ week: s.clock.week, year: s.clock.year, kind: kind, text: text, amount: amount, at: Date.now() });
    if (s.ledger.length > 400) s.ledger.length = 400;
    save();
    return s.treasury.cash;
  }

  function headline(head, body, tone) {
    var s = get();
    s.news.unshift({ week: s.clock.week, year: s.clock.year, head: head, body: body || '', tone: tone || 'neutral', at: Date.now() });
    if (s.news.length > 160) s.news.length = 160;
    KH.bus.emit('game:news', s.news[0]);
  }

  /* ---------- Export and import, so a game can outlive a browser ---------- */

  function exportSave() {
    return JSON.stringify(get(), null, 2);
  }

  function importSave(text) {
    var parsed;
    try { parsed = JSON.parse(text); }
    catch (err) { return { ok: false, reason: 'That file is not readable as a saved game.' }; }
    if (!parsed || typeof parsed !== 'object' || !parsed.clock || !parsed.treasury) {
      return { ok: false, reason: 'That file does not look like a Kellett saved game.' };
    }
    if (parsed.v !== VERSION) {
      return { ok: false, reason: 'That save was written by a different version of the workspace.' };
    }
    state = hydrate(parsed);
    flush();
    KH.bus.emit('game:loaded');
    return { ok: true };
  }

  KH.game = {
    get: get, corp: corp, corpRecord: corpRecord, save: save, flush: flush,
    reset: reset, post: post, headline: headline,
    exportSave: exportSave, importSave: importSave,
    isPersistent: function () { return persistent; },
    version: VERSION
  };

  window.addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush();
  });
})(window.KH);

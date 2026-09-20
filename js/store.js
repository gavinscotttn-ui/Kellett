/* ============================================================
   Persistence.

   Storage is treated as a privilege, never a guarantee: a private
   window, cleared site data or a locked-down profile all make it
   throw or come back empty. Every read and write is guarded and
   falls back to an in-memory copy, so the workspace always opens.
   ============================================================ */

(function (KH) {
  'use strict';

  var KEY = 'kellett.workspace.v1';
  var memory = null;          // the in-memory mirror, always authoritative
  var persistent = true;      // flipped false the first time storage refuses

  var DEFAULTS = {
    profile: {
      name: 'Gavin Scott',
      title: 'Group Principal & Chief Executive',
      division: 'Office of the Chairman',
      company: 'Kellett Holdings',
      location: 'London EC2',
      email: 'g.scott@kellettholdings.com',
      reference: 'KH-0001'
    },
    appearance: {
      theme: 'dark',            // 'dark' | 'light' | 'auto'
      accent: 'default',
      density: 'normal',
      effects: true,
      motion: true,
      rail: false
    },
    workspace: {
      currency: 'GBP',
      marketSpeed: 'normal',    // 'calm' | 'normal' | 'brisk'
      notifications: true,
      sounds: false,
      ticker: true
    },
    trading: {
      cash: 84250000,
      startingCash: 84250000,
      positions: {},            // symbol -> { qty, avg }
      blotter: []               // most recent first, capped
    },
    mail: { read: [], flagged: [], deleted: [] },
    chat: { sent: {}, lastRead: {} },
    session: { firstRun: true, lastOpened: null }
  };

  function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

  /** Merge stored values over the defaults, key by key, so a partial or
      older payload can never leave a branch of the tree missing. */
  function merge(base, incoming) {
    var out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    if (!incoming || typeof incoming !== 'object') return out;
    Object.keys(base).forEach(function (k) {
      var b = base[k], v = incoming[k];
      if (v === undefined) return;
      if (Array.isArray(b)) { if (Array.isArray(v)) out[k] = v.slice(); return; }
      if (b && typeof b === 'object') { out[k] = merge(b, v); return; }
      if (typeof v === typeof b) out[k] = v;
    });
    // Free-form maps (positions, sent, lastRead) keep their own keys.
    ['positions', 'sent', 'lastRead'].forEach(function (k) {
      if (incoming[k] && typeof incoming[k] === 'object' && out[k]) out[k] = Object.assign({}, incoming[k]);
    });
    return out;
  }

  function read() {
    if (memory) return memory;
    var raw = null;
    try { raw = window.localStorage.getItem(KEY); }
    catch (err) { persistent = false; }
    if (raw) {
      try { memory = merge(DEFAULTS, JSON.parse(raw)); }
      catch (err) { console.warn('stored workspace was unreadable; starting clean'); memory = deepClone(DEFAULTS); }
    } else {
      memory = deepClone(DEFAULTS);
    }
    return memory;
  }

  var flushTimer = null;

  function save() {
    read();
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, 180);
  }

  function flush() {
    if (!memory) return;
    try { window.localStorage.setItem(KEY, JSON.stringify(memory)); }
    catch (err) {
      if (persistent) {
        persistent = false;
        console.warn('this workspace cannot be written to disk; changes will last for this session only');
        KH.bus.emit('storage:unavailable');
      }
    }
  }

  /** Read a branch. Always returns the live object, never a copy. */
  function get(section) { var s = read(); return section ? s[section] : s; }

  /** Patch a branch and persist. */
  function set(section, patch) {
    var s = read();
    if (!s[section]) s[section] = {};
    Object.assign(s[section], patch);
    save();
    KH.bus.emit('store:changed', { section: section, patch: patch });
    return s[section];
  }

  function reset(section) {
    var s = read();
    if (section) { s[section] = deepClone(DEFAULTS[section]); }
    else { memory = deepClone(DEFAULTS); }
    save();
    KH.bus.emit('store:changed', { section: section || '*', reset: true });
  }

  function isPersistent() { return persistent; }

  KH.store = {
    get: get, set: set, save: save, flush: flush, reset: reset,
    isPersistent: isPersistent, defaults: DEFAULTS
  };

  // Never lose the last few moments of work to a closing tab.
  window.addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush();
  });
})(window.KH);

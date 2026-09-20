/* ============================================================
   Formatting. One place decides how a number or a date looks,
   so the currency setting has a single lever to pull.
   ============================================================ */

(function (KH) {
  'use strict';

  var CURRENCIES = {
    GBP: { symbol: '£', code: 'GBP', locale: 'en-GB' },
    USD: { symbol: '$', code: 'USD', locale: 'en-US' },
    EUR: { symbol: '€', code: 'EUR', locale: 'en-IE' },
    CHF: { symbol: 'CHF ', code: 'CHF', locale: 'de-CH' }
  };

  var state = { currency: 'GBP' };

  function cur() { return CURRENCIES[state.currency] || CURRENCIES.GBP; }

  function setCurrency(code) { if (CURRENCIES[code]) state.currency = code; }

  function group(n, dp) {
    if (!isFinite(n)) return '—';
    return n.toLocaleString(cur().locale, { minimumFractionDigits: dp, maximumFractionDigits: dp });
  }

  /** Full money, e.g. £1,284,300.00 */
  function money(n, dp) {
    if (!isFinite(n)) return '—';
    var d = dp === undefined ? 2 : dp;
    return (n < 0 ? '-' : '') + cur().symbol + group(Math.abs(n), d);
  }

  /** Abbreviated money for tiles and axes, e.g. £1.28m */
  function moneyShort(n) {
    if (!isFinite(n)) return '—';
    var abs = Math.abs(n), s = cur().symbol, sign = n < 0 ? '-' : '';
    if (abs >= 1e9) return sign + s + (abs / 1e9).toFixed(2) + 'bn';
    if (abs >= 1e6) return sign + s + (abs / 1e6).toFixed(2) + 'm';
    if (abs >= 1e3) return sign + s + (abs / 1e3).toFixed(1) + 'k';
    return sign + s + abs.toFixed(0);
  }

  function shortNum(n) {
    var abs = Math.abs(n), sign = n < 0 ? '-' : '';
    if (abs >= 1e9) return sign + (abs / 1e9).toFixed(2) + 'bn';
    if (abs >= 1e6) return sign + (abs / 1e6).toFixed(2) + 'm';
    if (abs >= 1e3) return sign + (abs / 1e3).toFixed(1) + 'k';
    return sign + abs.toFixed(0);
  }

  function pct(n, dp) {
    if (!isFinite(n)) return '—';
    var d = dp === undefined ? 2 : dp;
    return (n >= 0 ? '+' : '') + n.toFixed(d) + '%';
  }

  /** Short signed money for a tile, e.g. +£143.40m */
  function signedShort(n) {
    if (!isFinite(n)) return '\u2014';
    return (n >= 0 ? '+' : '-') + moneyShort(Math.abs(n));
  }

  function signed(n, dp) {
    if (!isFinite(n)) return '—';
    return (n >= 0 ? '+' : '-') + cur().symbol + group(Math.abs(n), dp === undefined ? 2 : dp);
  }

  /** The direction glyph. Colour reinforces this; it never replaces it. */
  function arrow(n) { return n > 0 ? '▲' : n < 0 ? '▼' : '▬'; }
  function dir(n) { return n > 0 ? 'up' : n < 0 ? 'down' : 'flat'; }

  function time(d) {
    return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  function timeSec(d) {
    return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  }

  function dayMonth(d) {
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  function longDate(d) {
    return new Date(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function stamp(d) {
    return new Date(d).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  }

  /** "14:05" today, "Tue" this week, "4 Mar" beyond. */
  function whenShort(d) {
    var then = new Date(d), now = new Date();
    var sameDay = then.toDateString() === now.toDateString();
    if (sameDay) return time(then);
    var days = (now - then) / 86400000;
    if (days < 6) return then.toLocaleDateString('en-GB', { weekday: 'short' });
    return dayMonth(then);
  }

  /* An honorific is not a name, so it is skipped when picking initials
     or a first name — "Sir Reginald Fanshaw-Bennett" is RF, not SF. */
  var HONORIFIC = /^(sir|dame|lord|lady|dr|doctor|mr|mrs|ms|miss|prof|professor|rev|hon|capt|captain|major|col|colonel|gen|general)\.?$/i;

  function nameParts(name) {
    var parts = String(name || '').trim().split(/\s+/)
      .map(function (w) { return w.replace(/[^\p{L}\p{M}'-]/gu, ''); })
      .filter(Boolean);
    while (parts.length > 1 && HONORIFIC.test(parts[0])) parts.shift();
    return parts;
  }

  function initials(name) {
    var parts = nameParts(name);
    if (!parts.length) return '—';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function firstName(name) { return nameParts(name)[0] || ''; }

  KH.fmt = {
    setCurrency: setCurrency,
    symbol: function () { return cur().symbol; },
    code: function () { return cur().code; },
    group: group, money: money, moneyShort: moneyShort, shortNum: shortNum,
    pct: pct, signed: signed, signedShort: signedShort, arrow: arrow, dir: dir,
    time: time, timeSec: timeSec, dayMonth: dayMonth, longDate: longDate, stamp: stamp,
    whenShort: whenShort, initials: initials, firstName: firstName,
    currencies: Object.keys(CURRENCIES)
  };
})(window.KH);

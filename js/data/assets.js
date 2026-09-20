/* ============================================================
   The asset register: the group's directly held positions, with
   a 36-month valuation history built deterministically from each
   asset's own seed so the charts are stable between sessions.
   ============================================================ */

(function (KH) {
  'use strict';

  var REGISTER = [
    { id: 'kh-sq', name: '1 Kellett Square, EC2', klass: 'Commercial Real Estate', slot: 0, value: 96500000, cost: 71200000, acquired: '2016-04-11', where: 'London, United Kingdom', ref: 'KH-RE-0114', status: 'Held', note: '18 floors, 41,200 sq ft let to eight tenants', vol: 0.014, trend: 0.042, seed: 8117 },
    { id: 'panthera', name: 'Panthera Fund IV — LP interest', klass: 'Private Equity', slot: 1, value: 88740000, cost: 52000000, acquired: '2018-09-02', where: 'Luxembourg', ref: 'KH-PE-0031', status: 'Committed', note: '12.4% of a £715m buy-out vehicle', vol: 0.027, trend: 0.101, seed: 3312 },
    { id: 'caverton', name: 'Caverton Data Campus DC-04', klass: 'Digital Infrastructure', slot: 2, value: 77320000, cost: 44800000, acquired: '2019-11-20', where: 'Slough, United Kingdom', ref: 'KH-DI-0008', status: 'Operating', note: '38 MW contracted, 96% utilisation', vol: 0.019, trend: 0.118, seed: 5561 },
    { id: 'meridian-12', name: 'Meridian Offshore Block 12', klass: 'Energy', slot: 3, value: 63100000, cost: 58400000, acquired: '2015-06-30', where: 'North Sea', ref: 'KH-EN-0002', status: 'Producing', note: 'Non-operated 9.5% working interest', vol: 0.041, trend: 0.018, seed: 9204 },
    { id: 'northgate', name: 'Northgate Logistics Park', klass: 'Industrial Property', slot: 4, value: 54830000, cost: 39900000, acquired: '2017-02-14', where: 'Leeds, United Kingdom', ref: 'KH-RE-0207', status: 'Held', note: 'Six units, 612,000 sq ft, WAULT 9.2 years', vol: 0.013, trend: 0.048, seed: 7743 },
    { id: 'grenville', name: 'Grenville Residential Portfolio', klass: 'Residential Property', slot: 5, value: 45210000, cost: 36750000, acquired: '2014-10-08', where: 'Home Counties', ref: 'KH-RE-0044', status: 'Held', note: '144 units across nine addresses', vol: 0.011, trend: 0.036, seed: 2288 },
    { id: 'yacht', name: 'M/Y Brighter Tomorrow (52m)', klass: 'Marine', slot: 6, value: 41200000, cost: 47500000, acquired: '2021-05-19', where: 'Port Hercule, Monaco', ref: 'KH-MA-0001', status: 'In service', note: '52m tri-deck, twelve berths, crew of eleven', vol: 0.010, trend: -0.031, seed: 6620 },
    { id: 'sterling-land', name: 'Sterling Farms (4,200 ha)', klass: 'Agricultural Land', slot: 7, value: 31940000, cost: 21600000, acquired: '2013-03-25', where: 'Lincolnshire, United Kingdom', ref: 'KH-AG-0011', status: 'Let', note: 'Grade 1 and 2 arable, twelve tenancies', vol: 0.008, trend: 0.051, seed: 4109 },
    { id: 'ashcombe', name: 'The Ashcombe Collection', klass: 'Fine Art', slot: 0, value: 29450000, cost: 18300000, acquired: '2012-07-01', where: 'Geneva Freeport', ref: 'KH-AR-0003', status: 'In storage', note: '31 lots, post-war and contemporary', vol: 0.016, trend: 0.058, seed: 1875 },
    { id: 'bullion', name: 'Vault 7 — bullion allocation', klass: 'Precious Metals', slot: 1, value: 22680000, cost: 16900000, acquired: '2020-01-16', where: 'Zurich, Switzerland', ref: 'KH-PM-0006', status: 'Allocated', note: '9,380 oz fine gold, segregated', vol: 0.021, trend: 0.062, seed: 3947 },
    { id: 'jet', name: 'Hawker 4000 — G-KLTT', klass: 'Aviation', slot: 2, value: 18420000, cost: 24100000, acquired: '2019-08-07', where: 'Farnborough, United Kingdom', ref: 'KH-AV-0001', status: 'In service', note: '3,190 airframe hours, managed charter', vol: 0.012, trend: -0.042, seed: 8830 },
    { id: 'zagato', name: '1962 Ashton DB-Series Zagato', klass: 'Classic Automobilia', slot: 3, value: 12860000, cost: 7400000, acquired: '2011-11-30', where: 'Newport Pagnell, United Kingdom', ref: 'KH-CA-0002', status: 'In storage', note: 'One of nineteen, matching numbers', vol: 0.018, trend: 0.071, seed: 5504 }
  ];

  var MONTHS = 36;

  /** A plausible valuation path: a steady trend plus monthly noise,
      pinned so the final point is exactly the stated valuation. */
  function buildHistory(asset) {
    var rand = KH.util.rng(asset.seed);
    var raw = [1];
    for (var i = 1; i < MONTHS; i++) {
      var drift = asset.trend / 12;
      var shock = KH.util.gauss(rand) * asset.vol;
      raw.push(raw[i - 1] * (1 + drift + shock));
    }
    var scale = asset.value / raw[raw.length - 1];
    var now = new Date();
    return raw.map(function (r, i) {
      var d = new Date(now.getFullYear(), now.getMonth() - (MONTHS - 1 - i), 1);
      return { t: d.getTime(), v: Math.round(r * scale) };
    });
  }

  /* The register is authored at full size and then scaled as a whole, so
     the shape of every curve and every relative weighting survives however
     the group capitalisation dial is set. */
  var BASE_CASH = 84250000;
  var scale = 1;

  REGISTER.forEach(function (a) {
    a.color = KH.charts.seriesColor(a.slot);
    a.baseValue = a.value;
    a.baseCost = a.cost;
    a.baseHistory = buildHistory(a);
  });

  var BASE_REGISTER = KH.util.sum(REGISTER, function (a) { return a.baseValue; });

  function setScale(f) {
    scale = isFinite(f) && f > 0 ? f : 1;
    REGISTER.forEach(function (a) {
      a.value = a.baseValue * scale;
      a.cost = a.baseCost * scale;
      a.history = a.baseHistory.map(function (p) { return { t: p.t, v: p.v * scale }; });
      a.gain = a.value - a.cost;
      a.gainPct = (a.gain / a.cost) * 100;
      var yearAgo = a.history[a.history.length - 13] || a.history[0];
      a.yoy = ((a.value - yearAgo.v) / yearAgo.v) * 100;
    });
  }

  setScale(1);

  function byClass() {
    var map = {};
    REGISTER.forEach(function (a) {
      if (!map[a.klass]) map[a.klass] = { label: a.klass, value: 0, count: 0, color: a.color };
      map[a.klass].value += a.value;
      map[a.klass].count += 1;
    });
    return Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (x, y) { return y.value - x.value; })
      .map(function (s, i) { s.color = KH.charts.seriesColor(i); return s; });
  }

  /** The whole register rolled into one monthly series. */
  function groupHistory() {
    var out = [];
    for (var i = 0; i < MONTHS; i++) {
      var total = 0;
      REGISTER.forEach(function (a) { total += a.history[i].v; });
      out.push({ t: REGISTER[0].history[i].t, v: total });
    }
    return out;
  }

  KH.assets = {
    register: REGISTER,
    setScale: setScale,
    scale: function () { return scale; },
    baseCash: BASE_CASH,
    baseNet: function () { return BASE_REGISTER + BASE_CASH; },
    total: function () { return KH.util.sum(REGISTER, function (a) { return a.value; }); },
    cost: function () { return KH.util.sum(REGISTER, function (a) { return a.cost; }); },
    byClass: byClass,
    groupHistory: groupHistory,
    get: function (id) { return REGISTER.filter(function (a) { return a.id === id; })[0] || REGISTER[0]; }
  };
})(window.KH);

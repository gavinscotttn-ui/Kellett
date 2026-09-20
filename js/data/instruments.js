/* ============================================================
   The instrument book behind the Markets view: the tradable
   list, plus the index, commodity and currency lines that run
   along the ticker tape.
   ============================================================ */

(function (KH) {
  'use strict';

  /* vol  — daily volatility, as a fraction
     bias — a small annualised drift, so the book is not a coin toss */
  var INSTRUMENTS = [
    { sym: 'KHLD', name: 'Kellett Holdings PLC', sector: 'Diversified Holdings', px: 1842.50, vol: 0.013, bias: 0.16, lot: 1, house: true },
    { sym: 'NRTH', name: 'Northgate Industrial Group', sector: 'Industrials', px: 964.20, vol: 0.016, bias: 0.09 },
    { sym: 'ZEPH', name: 'Zephyr Aerospace', sector: 'Aerospace & Defence', px: 2310.75, vol: 0.019, bias: 0.12 },
    { sym: 'MRDN', name: 'Meridian Resources', sector: 'Energy', px: 587.40, vol: 0.024, bias: 0.04 },
    { sym: 'BLTC', name: 'Baltic Shipping & Freight', sector: 'Transport & Logistics', px: 412.85, vol: 0.021, bias: 0.06 },
    { sym: 'CVTN', name: 'Caverton Data Centres', sector: 'Digital Infrastructure', px: 3176.00, vol: 0.017, bias: 0.19 },
    { sym: 'AURM', name: 'Aurum Metals Group', sector: 'Mining', px: 1093.60, vol: 0.022, bias: 0.05 },
    { sym: 'STRL', name: 'Sterling Agricultural', sector: 'Agriculture', px: 748.15, vol: 0.012, bias: 0.07 },
    { sym: 'QNTA', name: 'Quanta Photonics', sector: 'Technology', px: 5204.30, vol: 0.028, bias: 0.24 },
    { sym: 'VLDR', name: 'Valdaro Luxury Group', sector: 'Consumer Luxury', px: 1655.90, vol: 0.015, bias: 0.11 },
    { sym: 'HELX', name: 'Helix Biosciences', sector: 'Life Sciences', px: 2788.45, vol: 0.026, bias: 0.14 },
    { sym: 'TRDN', name: 'Trident Marine Holdings', sector: 'Marine', px: 621.30, vol: 0.018, bias: 0.03 },
    { sym: 'OBLK', name: 'Obelisk Infrastructure', sector: 'Infrastructure', px: 1427.05, vol: 0.011, bias: 0.08 },
    { sym: 'PNTH', name: 'Panthera Capital Partners', sector: 'Financials', px: 3942.80, vol: 0.020, bias: 0.13 },
    { sym: 'GRNV', name: 'Grenville Property Trust', sector: 'Real Estate', px: 336.70, vol: 0.014, bias: 0.02 },
    { sym: 'SXTN', name: 'Saxton Pharmaceuticals', sector: 'Pharmaceuticals', px: 1978.25, vol: 0.023, bias: 0.10 },
    { sym: 'ARGN', name: 'Argentum Private Credit', sector: 'Financials', px: 884.55, vol: 0.010, bias: 0.06 },
    { sym: 'LMNR', name: 'Luminar Renewables', sector: 'Renewable Energy', px: 1204.40, vol: 0.025, bias: 0.17 },
    { sym: 'VNDL', name: 'Vandelay Industries', sector: 'Import & Export', px: 742.60, vol: 0.019, bias: 0.05 },
    { sym: 'INTK', name: 'Initech Solutions', sector: 'Enterprise Software', px: 1516.95, vol: 0.021, bias: 0.09 },
    { sym: 'HOOL', name: 'Hooli Global', sector: 'Technology', px: 4180.10, vol: 0.027, bias: 0.15 },
    { sym: 'DUND', name: 'Dunder Paper Group', sector: 'Paper & Packaging', px: 289.35, vol: 0.017, bias: 0.01 },
    { sym: 'BLUT', name: 'Bluth Development Co.', sector: 'Construction', px: 158.20, vol: 0.030, bias: -0.04 },
    { sym: 'TITL', name: 'Trotters Independent', sector: 'Wholesale & Retail', px: 97.45, vol: 0.034, bias: 0.22 }
  ];

  /* The tape lines. These are quoted, never traded. */
  var TAPE = [
    { sym: 'KGX 100', name: 'Kellett Global Exchange 100', px: 8427.16, vol: 0.007, dp: 2 },
    { sym: 'CONT 50', name: 'Continental 50', px: 5192.44, vol: 0.008, dp: 2 },
    { sym: 'PACIFIC', name: 'Pacific Composite', px: 3877.90, vol: 0.010, dp: 2 },
    { sym: 'XAU', name: 'Gold, per troy ounce', px: 2418.60, vol: 0.009, dp: 2, unit: '$' },
    { sym: 'BRENT', name: 'Brent-equivalent crude', px: 81.44, vol: 0.016, dp: 2, unit: '$' },
    { sym: 'GBP/USD', name: 'Sterling / US dollar', px: 1.2684, vol: 0.005, dp: 4, unit: '' },
    { sym: 'EUR/GBP', name: 'Euro / sterling', px: 0.8471, vol: 0.004, dp: 4, unit: '' },
    { sym: 'GBP/CHF', name: 'Sterling / Swiss franc', px: 1.1208, vol: 0.005, dp: 4, unit: '' },
    { sym: 'UK 10Y', name: 'Ten-year gilt yield', px: 4.128, vol: 0.011, dp: 3, unit: '' }
  ];

  KH.instruments = { list: INSTRUMENTS, tape: TAPE };
})(window.KH);

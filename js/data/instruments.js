/* ============================================================
   The investable universe.

   Every line is a real corporate with fundamentals behind it:
   revenue, margin, headcount, product ranges and a turnaround
   difficulty. Buy enough of one and you control it, at which
   point those fundamentals become your problem.

   vol   — weekly volatility as a fraction
   bias  — structural drift per year
   shares— shares in issue, which sets the market capitalisation
   risk  — 1 (steady) to 5 (on fire); drives the turnaround score
   ============================================================ */

(function (KH) {
  'use strict';

  var INSTRUMENTS = [
    // ---- The group's own line and its core holdings ----
    { sym: 'KHLD', name: 'Kellett Holdings PLC', sector: 'Diversified Holdings', px: 1842.50, vol: 0.013, bias: 0.16, shares: 41000000, risk: 1, margin: 0.19, staff: 1240, house: true },
    { sym: 'TNET', name: 'Telecom Networks PLC', sector: 'Telecommunications', px: 2914.60, vol: 0.017, bias: 0.23, shares: 28000000, risk: 2, margin: 0.22, staff: 3100 },

    // ---- Industry ----
    { sym: 'NRTH', name: 'Northgate Industrial Group', sector: 'Industrials', px: 964.20, vol: 0.016, bias: 0.09, shares: 52000000, risk: 2, margin: 0.11, staff: 4800 },
    { sym: 'ZEPH', name: 'Zephyr Aerospace', sector: 'Aerospace & Defence', px: 2310.75, vol: 0.019, bias: 0.12, shares: 19000000, risk: 3, margin: 0.14, staff: 2600 },
    { sym: 'MRDN', name: 'Meridian Resources', sector: 'Energy', px: 587.40, vol: 0.024, bias: 0.04, shares: 88000000, risk: 3, margin: 0.17, staff: 1900 },
    { sym: 'BLTC', name: 'Baltic Shipping & Freight', sector: 'Transport & Logistics', px: 412.85, vol: 0.021, bias: 0.06, shares: 74000000, risk: 3, margin: 0.08, staff: 5400 },
    { sym: 'CVTN', name: 'Caverton Data Centres', sector: 'Digital Infrastructure', px: 3176.00, vol: 0.017, bias: 0.19, shares: 15000000, risk: 1, margin: 0.31, staff: 640 },
    { sym: 'AURM', name: 'Aurum Metals Group', sector: 'Mining', px: 1093.60, vol: 0.022, bias: 0.05, shares: 44000000, risk: 3, margin: 0.13, staff: 3300 },
    { sym: 'STRL', name: 'Sterling Agricultural', sector: 'Agriculture', px: 748.15, vol: 0.012, bias: 0.07, shares: 36000000, risk: 2, margin: 0.10, staff: 1450 },
    { sym: 'QNTA', name: 'Quanta Photonics', sector: 'Technology', px: 5204.30, vol: 0.028, bias: 0.24, shares: 9000000, risk: 3, margin: 0.27, staff: 890 },
    { sym: 'VLDR', name: 'Valdaro Luxury Group', sector: 'Consumer Luxury', px: 1655.90, vol: 0.015, bias: 0.11, shares: 31000000, risk: 2, margin: 0.24, staff: 2100 },
    { sym: 'HELX', name: 'Helix Biosciences', sector: 'Life Sciences', px: 2788.45, vol: 0.026, bias: 0.14, shares: 17000000, risk: 4, margin: 0.09, staff: 1180 },
    { sym: 'TRDN', name: 'Trident Marine Holdings', sector: 'Marine', px: 621.30, vol: 0.018, bias: 0.03, shares: 48000000, risk: 3, margin: 0.07, staff: 2750 },
    { sym: 'OBLK', name: 'Obelisk Infrastructure', sector: 'Infrastructure', px: 1427.05, vol: 0.011, bias: 0.08, shares: 39000000, risk: 1, margin: 0.20, staff: 1600 },
    { sym: 'PNTH', name: 'Panthera Capital Partners', sector: 'Financials', px: 3942.80, vol: 0.020, bias: 0.13, shares: 12000000, risk: 2, margin: 0.35, staff: 420 },
    { sym: 'GRNV', name: 'Grenville Property Trust', sector: 'Real Estate', px: 336.70, vol: 0.014, bias: 0.02, shares: 96000000, risk: 2, margin: 0.28, staff: 310 },
    { sym: 'SXTN', name: 'Saxton Pharmaceuticals', sector: 'Pharmaceuticals', px: 1978.25, vol: 0.023, bias: 0.10, shares: 22000000, risk: 3, margin: 0.18, staff: 2400 },
    { sym: 'ARGN', name: 'Argentum Private Credit', sector: 'Financials', px: 884.55, vol: 0.010, bias: 0.06, shares: 41000000, risk: 1, margin: 0.41, staff: 180 },
    { sym: 'LMNR', name: 'Luminar Renewables', sector: 'Renewable Energy', px: 1204.40, vol: 0.025, bias: 0.17, shares: 27000000, risk: 3, margin: 0.12, staff: 970 },

    // ---- Distinguished houses of the screen ----
    { sym: 'VNDL', name: 'Vandelay Industries', sector: 'Import & Export', px: 742.60, vol: 0.019, bias: 0.05, shares: 33000000, risk: 3, margin: 0.09, staff: 640 },
    { sym: 'INTK', name: 'Initech Solutions', sector: 'Enterprise Software', px: 1516.95, vol: 0.021, bias: 0.09, shares: 24000000, risk: 3, margin: 0.16, staff: 1120 },
    { sym: 'HOOL', name: 'Hooli Global', sector: 'Technology', px: 4180.10, vol: 0.027, bias: 0.15, shares: 14000000, risk: 3, margin: 0.21, staff: 5600 },
    { sym: 'DUND', name: 'Dunder Paper Group', sector: 'Paper & Packaging', px: 289.35, vol: 0.017, bias: 0.01, shares: 62000000, risk: 4, margin: 0.05, staff: 890 },
    { sym: 'BLUT', name: 'Bluth Development Co.', sector: 'Construction', px: 158.20, vol: 0.030, bias: -0.04, shares: 71000000, risk: 5, margin: 0.02, staff: 430 },
    { sym: 'TITL', name: 'Trotters Independent Traders', sector: 'Wholesale & Retail', px: 97.45, vol: 0.034, bias: 0.22, shares: 54000000, risk: 5, margin: 0.04, staff: 3 },
    { sym: 'SHWG', name: 'Sheinhardt Wig Company', sector: 'Diversified Media', px: 2645.80, vol: 0.018, bias: 0.13, shares: 21000000, risk: 2, margin: 0.18, staff: 7400 },
    { sym: 'KBLT', name: 'Kabletown Communications', sector: 'Cable & Broadband', px: 1387.25, vol: 0.016, bias: 0.08, shares: 45000000, risk: 2, margin: 0.15, staff: 11200 },
    { sym: 'TGSL', name: 'TGS Live Productions', sector: 'Broadcast & Studio', px: 486.90, vol: 0.031, bias: 0.03, shares: 28000000, risk: 4, margin: 0.03, staff: 210 },
    { sym: 'PWTR', name: 'Pewterschmidt Industries', sector: 'Industrial Conglomerate', px: 4726.55, vol: 0.020, bias: 0.11, shares: 16000000, risk: 2, margin: 0.23, staff: 18400 },
    { sym: 'HGLT', name: 'Happy-Go-Lucky Toys, Quahog', sector: 'Consumer Toys', px: 214.70, vol: 0.029, bias: 0.06, shares: 58000000, risk: 4, margin: 0.06, staff: 1240 },
    { sym: 'QHOG', name: 'Quahog Brewing & Taverns', sector: 'Hospitality', px: 176.30, vol: 0.026, bias: 0.04, shares: 49000000, risk: 4, margin: 0.07, staff: 760 },
    { sym: 'GLBX', name: 'Globex Corporation', sector: 'Industrial Conglomerate', px: 6210.40, vol: 0.022, bias: 0.20, shares: 11000000, risk: 2, margin: 0.29, staff: 9800 },
    { sym: 'SPNC', name: 'Springfield Nuclear Power', sector: 'Utilities', px: 812.65, vol: 0.019, bias: 0.02, shares: 51000000, risk: 5, margin: 0.14, staff: 640 },
    { sym: 'KWIK', name: 'Kwik-E Retail Group', sector: 'Convenience Retail', px: 243.15, vol: 0.020, bias: 0.07, shares: 67000000, risk: 3, margin: 0.06, staff: 4100 },
    { sym: 'DUFF', name: 'Duff Beverages International', sector: 'Beverages', px: 934.80, vol: 0.017, bias: 0.09, shares: 38000000, risk: 2, margin: 0.19, staff: 2900 },
    { sym: 'UWTX', name: 'Underworld Textiles, Weatherfield', sector: 'Apparel Manufacturing', px: 128.55, vol: 0.028, bias: 0.05, shares: 44000000, risk: 5, margin: 0.04, staff: 62 },
    { sym: 'ROYS', name: "Roy's Rolls Catering Group", sector: 'Food Service', px: 84.20, vol: 0.024, bias: 0.06, shares: 52000000, risk: 4, margin: 0.05, staff: 41 },
    { sym: 'STCR', name: 'Streetcars Private Hire', sector: 'Transport & Logistics', px: 61.90, vol: 0.031, bias: 0.03, shares: 48000000, risk: 5, margin: 0.03, staff: 128 },
    { sym: 'QVIC', name: 'Queen Vic Taverns', sector: 'Hospitality', px: 142.35, vol: 0.025, bias: 0.02, shares: 41000000, risk: 5, margin: 0.04, staff: 96 },
    { sym: 'CLNS', name: 'Clansman Hospitality, Craiglang', sector: 'Hospitality', px: 73.60, vol: 0.027, bias: 0.05, shares: 39000000, risk: 4, margin: 0.06, staff: 34 },
    { sym: 'NAVD', name: "Navid's Convenience Group", sector: 'Convenience Retail', px: 118.45, vol: 0.021, bias: 0.08, shares: 43000000, risk: 3, margin: 0.07, staff: 58 },
    { sym: 'DSNT', name: 'De Santa Entertainment', sector: 'Film & Production', px: 1094.25, vol: 0.033, bias: 0.12, shares: 23000000, risk: 4, margin: 0.11, staff: 340 },
    { sym: 'LFIN', name: 'Lifeinvader Social', sector: 'Technology', px: 672.40, vol: 0.036, bias: 0.09, shares: 56000000, risk: 4, margin: 0.08, staff: 1420 },
    { sym: 'MERY', name: 'Merryweather Security', sector: 'Aerospace & Defence', px: 1583.70, vol: 0.024, bias: 0.14, shares: 26000000, risk: 3, margin: 0.20, staff: 3800 },
    { sym: 'YOTS', name: 'Yotsuba Group', sector: 'Industrial Conglomerate', px: 3418.60, vol: 0.023, bias: 0.18, shares: 19000000, risk: 3, margin: 0.25, staff: 12600 },
    { sym: 'PSDX', name: 'Public Safety Devil Extermination', sector: 'Specialist Services', px: 2247.90, vol: 0.038, bias: 0.21, shares: 13000000, risk: 5, margin: 0.16, staff: 540 },
    { sym: 'DNJI', name: 'Denji Chainsaw Rentals', sector: 'Equipment Hire', px: 96.80, vol: 0.041, bias: 0.15, shares: 47000000, risk: 5, margin: 0.03, staff: 22 },
    { sym: 'WHOG', name: 'Wernham Hogg Paper', sector: 'Paper & Packaging', px: 132.70, vol: 0.022, bias: -0.02, shares: 51000000, risk: 5, margin: 0.03, staff: 320 },
    { sym: 'RYNH', name: 'Reynholm Industries', sector: 'Enterprise Software', px: 908.15, vol: 0.029, bias: 0.07, shares: 34000000, risk: 4, margin: 0.12, staff: 2200 },
    { sym: 'GRCB', name: 'Grace Brothers Retail', sector: 'Department Stores', px: 187.25, vol: 0.020, bias: 0.01, shares: 46000000, risk: 4, margin: 0.05, staff: 1870 },
    { sym: 'CHRM', name: 'Chromotron UK', sector: 'Broadcast & Studio', px: 521.40, vol: 0.030, bias: 0.16, shares: 29000000, risk: 3, margin: 0.13, staff: 480 },

    // ---- And the one that cannot be saved ----
    { sym: 'JVIS', name: 'JimmyVision Corp', sector: 'Diversified Media', px: 38.15, vol: 0.052, bias: -0.46, shares: 210000000, risk: 5, margin: -0.34, staff: 1, cursed: true }
  ];

  /* The tape lines. Quoted, never traded. */
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

  /* Product ranges are generated per sector, so a company you take
     control of always has something to actually manage. */
  var RANGES = {
    'Telecommunications': ['Consumer broadband', 'Business connectivity', 'Mobile airtime', 'Wholesale backhaul'],
    'Technology': ['Core platform', 'Enterprise licences', 'Developer tooling', 'Support contracts'],
    'Enterprise Software': ['Perpetual licences', 'Subscription tier', 'Implementation services', 'Support & maintenance'],
    'Digital Infrastructure': ['Colocation racks', 'Managed hosting', 'Interconnect', 'Power contracts'],
    'Industrials': ['Heavy fabrication', 'Precision components', 'Aftermarket parts', 'Service contracts'],
    'Industrial Conglomerate': ['Industrial division', 'Consumer division', 'Defence division', 'Licensing'],
    'Aerospace & Defence': ['Airframe assemblies', 'Avionics', 'Government contracts', 'MRO services'],
    'Energy': ['Upstream production', 'Refined products', 'Trading book', 'Decommissioning services'],
    'Utilities': ['Domestic supply', 'Industrial supply', 'Grid services', 'Safety inspections'],
    'Renewable Energy': ['Onshore wind', 'Solar farms', 'Storage', 'Power purchase agreements'],
    'Mining': ['Primary ore', 'Refined metal', 'Tailings recovery', 'Royalty streams'],
    'Transport & Logistics': ['Contract haulage', 'Groupage', 'Warehousing', 'Last mile'],
    'Marine': ['Charter fleet', 'Port services', 'Salvage', 'Dry dock'],
    'Infrastructure': ['Concessions', 'Availability contracts', 'Maintenance', 'Development pipeline'],
    'Financials': ['Advisory fees', 'Managed funds', 'Carried interest', 'Lending book'],
    'Real Estate': ['Office portfolio', 'Industrial portfolio', 'Retail portfolio', 'Development'],
    'Consumer Luxury': ['Leather goods', 'Timepieces', 'Ready-to-wear', 'Fragrance licensing'],
    'Life Sciences': ['Clinical pipeline', 'Diagnostics', 'Research services', 'Licensed compounds'],
    'Pharmaceuticals': ['Branded portfolio', 'Generics', 'Over the counter', 'Licensing'],
    'Agriculture': ['Arable output', 'Livestock', 'Land rents', 'Agronomy services'],
    'Import & Export': ['Latex importing', 'Architectural consulting', 'Marine biology division', 'General import'],
    'Paper & Packaging': ['Office paper', 'Industrial board', 'Speciality print', 'Recycling'],
    'Construction': ['Residential build', 'Commercial fit-out', 'Groundworks', 'The banana stand'],
    'Wholesale & Retail': ['Clearance lines', 'Luxury imports', 'Novelty goods', 'Chandelier cleaning'],
    'Diversified Media': ['Television network', 'Streaming', 'Publishing', 'Microwave oven programming'],
    'Cable & Broadband': ['Residential cable', 'Premium channels', 'Broadband', 'Set-top rental'],
    'Broadcast & Studio': ['Studio hire', 'Live production', 'Format licensing', 'Post-production'],
    'Film & Production': ['Feature slate', 'Streaming originals', 'Back catalogue', 'Merchandising'],
    'Consumer Toys': ['Action figures', 'Board games', 'Plush', 'Licensed ranges'],
    'Hospitality': ['Wet sales', 'Food', 'Accommodation', 'Functions'],
    'Convenience Retail': ['Grocery', 'Tobacco & vape', 'Hot food', 'Lottery & services'],
    'Food Service': ['Counter service', 'Outside catering', 'Wholesale bakery', 'Franchising'],
    'Beverages': ['Core lager', 'Premium range', 'Low alcohol', 'Export'],
    'Apparel Manufacturing': ['Bulk contracts', 'Own label', 'Premium line', 'Export orders'],
    'Department Stores': ['Menswear', 'Ladies’ wear', 'Furniture & bedding', 'Food hall'],
    'Specialist Services': ['Public contracts', 'Private retainers', 'Emergency call-out', 'Training'],
    'Equipment Hire': ['Daily hire', 'Long-term contracts', 'Consumables', 'Operator hire'],
    'Diversified Holdings': ['Portfolio management', 'Corporate services', 'Treasury', 'Advisory']
  };

  var DEFAULT_RANGE = ['Core range', 'Premium range', 'Value range', 'Services'];

  function rangesFor(sector) { return RANGES[sector] || DEFAULT_RANGE; }

  KH.instruments = { list: INSTRUMENTS, tape: TAPE, rangesFor: rangesFor, ranges: RANGES };
})(window.KH);

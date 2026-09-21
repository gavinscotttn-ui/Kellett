/* ============================================================
   Simulation content: the people you can hire, the property you
   can buy, the firms who will quote for the work, the things you
   can spend it on, and the news that happens to you anyway.
   ============================================================ */

(function (KH) {
  'use strict';

  /* ---------- Executives ---------------------------------------------
     competence  how much they improve a company each quarter
     integrity   how unlikely they are to help themselves
     ambition    how hard they push, and how fast the risk builds
     fee         annual package
     ------------------------------------------------------------------ */

  var EXECUTIVES = [
    { id: 'donaghy', name: 'Jack Donaghy', pedigree: 'Sheinhardt Wig Company', competence: 0.94, integrity: 0.72, ambition: 0.90, fee: 1850000, note: 'Six Sigma. Decides standing up. Owns forty identical suits.' },
    { id: 'burns', name: 'C. Montgomery Burns', pedigree: 'Springfield Nuclear Power', competence: 0.88, integrity: 0.09, ambition: 0.96, fee: 620000, note: 'Ruthless, ancient, and will expense a hound.' },
    { id: 'scorpio', name: 'Hank Scorpio', pedigree: 'Globex Corporation', competence: 0.97, integrity: 0.58, ambition: 0.99, fee: 2400000, note: 'Wonderful to work for. Do not ask about the east wing.' },
    { id: 'connor', name: 'Carla Connor', pedigree: 'Underworld Textiles', competence: 0.86, integrity: 0.78, ambition: 0.84, fee: 410000, note: 'Knows the factory floor and every excuse made on it.' },
    { id: 'yagami', name: 'Light Yagami', pedigree: 'Yotsuba Group', competence: 0.98, integrity: 0.22, ambition: 1.00, fee: 980000, note: 'Flawless strategist. Keeps an unusually detailed notebook.' },
    { id: 'makima', name: 'Makima', pedigree: 'Public Safety Devil Extermination', competence: 0.96, integrity: 0.18, ambition: 0.97, fee: 1150000, note: 'Total control of the org chart within a fortnight.' },
    { id: 'desanta', name: 'Michael De Santa', pedigree: 'De Santa Entertainment', competence: 0.71, integrity: 0.44, ambition: 0.62, fee: 740000, note: 'Semi-retired. Says so roughly nine times a day.' },
    { id: 'pewter', name: 'Carter Pewterschmidt', pedigree: 'Pewterschmidt Industries', competence: 0.90, integrity: 0.51, ambition: 0.88, fee: 2100000, note: 'Eleven billion dollars and no interest in being liked.' },
    { id: 'brent', name: 'David Brent', pedigree: 'Wernham Hogg Paper', competence: 0.21, integrity: 0.74, ambition: 0.77, fee: 96000, note: 'A friend first, a boss second, probably an entertainer third.' },
    { id: 'reynholm', name: 'Denholm Reynholm', pedigree: 'Reynholm Industries', competence: 0.48, integrity: 0.39, ambition: 0.81, fee: 540000, note: 'Big ideas. Bigger discrepancies in the pension fund.' },
    { id: 'boycie', name: 'Terrance Boyce', pedigree: 'Boyce Autos, Peckham', competence: 0.63, integrity: 0.31, ambition: 0.70, fee: 180000, note: 'Marvellous. Simply marvellous. Check the mileage.' },
    { id: 'sugden', name: 'Winnie Sugden', pedigree: 'Craiglang Community Trust', competence: 0.68, integrity: 0.93, ambition: 0.41, fee: 145000, note: 'Straight as a die. Will tell the board exactly what it is.' },
    { id: 'lemon', name: 'Liz Lemon', pedigree: 'TGS Live Productions', competence: 0.79, integrity: 0.91, ambition: 0.55, fee: 330000, note: 'Keeps chaos in a holding pattern. Wants to go home.' },
    { id: 'grace', name: 'Cuthbert Rumbold', pedigree: 'Grace Brothers Retail', competence: 0.42, integrity: 0.66, ambition: 0.52, fee: 128000, note: 'Are you free? He very much is.' },
    { id: 'okonjo', name: 'Adaeze Okonjo', pedigree: 'Kellett Holdings', competence: 0.89, integrity: 0.95, ambition: 0.72, fee: 480000, note: 'Internal. Already knows where every body is buried, and buried none of them.' },
    { id: 'sterling', name: 'Dr. Evelyn Sterling', pedigree: 'Kellett Holdings', competence: 0.85, integrity: 0.99, ambition: 0.48, fee: 460000, note: 'Will not sign anything she has not read. Slower. Safer.' },
    { id: 'scorpion', name: 'Fenella Ravensworth', pedigree: 'Panthera Capital Partners', competence: 0.82, integrity: 0.63, ambition: 0.86, fee: 890000, note: 'Cuts costs the way a surgeon cuts, and charges like one.' },
    { id: 'duffy', name: 'Dennis Duffy', pedigree: 'The Beeper King', competence: 0.14, integrity: 0.55, ambition: 0.93, fee: 45000, note: 'Technology is cyclical. He is not.' }
  ];

  /* ---------- Staff roles you can hire into a company ---------- */

  var ROLES = [
    { id: 'ops', label: 'Operations manager', salary: 62000, effect: 'efficiency', power: 0.9, blurb: 'Takes cost out of the line without breaking it.' },
    { id: 'sales', label: 'Sales director', salary: 88000, effect: 'demand', power: 1.1, blurb: 'Moves volume. Will want a car.' },
    { id: 'eng', label: 'Head of engineering', salary: 95000, effect: 'quality', power: 1.2, blurb: 'Raises quality, which raises what you can charge.' },
    { id: 'fin', label: 'Finance controller', salary: 74000, effect: 'margin', power: 1.0, blurb: 'Finds the leak before the auditor does.' },
    { id: 'hr', label: 'People director', salary: 68000, effect: 'morale', power: 1.3, blurb: 'Keeps the good ones and manages out the rest.' },
    { id: 'comp', label: 'Compliance officer', salary: 71000, effect: 'oversight', power: 1.4, blurb: 'Makes embezzlement considerably harder work.' },
    { id: 'mkt', label: 'Marketing lead', salary: 66000, effect: 'awareness', power: 1.0, blurb: 'Makes the campaigns land instead of merely running.' }
  ];

  /* ---------- Strategic postures ---------- */

  var STRATEGIES = [
    { id: 'steady', label: 'Steady state', blurb: 'No change. Nothing breaks, nothing improves.', margin: 0, demand: 0, risk: 0, cost: 0 },
    { id: 'cost', label: 'Cost leadership', blurb: 'Squeeze the cost base. Margin up, morale down.', margin: 0.055, demand: -0.03, risk: 0.10, cost: 0, morale: -0.09 },
    { id: 'premium', label: 'Premium repositioning', blurb: 'Fewer units, better ones, higher price.', margin: 0.07, demand: -0.10, risk: 0.06, cost: 0.02, quality: 0.08 },
    { id: 'expand', label: 'Aggressive expansion', blurb: 'Buy share now, pay for it in margin.', margin: -0.05, demand: 0.16, risk: 0.18, cost: 0.05 },
    { id: 'turn', label: 'Turnaround programme', blurb: 'Stabilise a failing line. Expensive, and it works.', margin: 0.03, demand: 0.02, risk: -0.26, cost: 0.06, morale: -0.04 },
    { id: 'invest', label: 'Reinvest in the business', blurb: 'Nothing this year. Rather a lot the year after.', margin: -0.04, demand: 0.05, risk: -0.10, cost: 0.04, quality: 0.06, morale: 0.06 },
    { id: 'harvest', label: 'Harvest for cash', blurb: 'Strip it for cash flow and accept the decline.', margin: 0.10, demand: -0.14, risk: 0.22, cost: -0.03, morale: -0.14 }
  ];

  /* ---------- Marketing channels ---------- */

  var CHANNELS = [
    { id: 'tv', label: 'Television', cost: 850000, reach: 0.22, decay: 0.80, blurb: 'Expensive, broad, and it makes your mother proud.' },
    { id: 'outdoor', label: 'Outdoor & transport', cost: 320000, reach: 0.11, decay: 0.86, blurb: 'Forty-eight sheets. Nobody remembers, everybody sees.' },
    { id: 'digital', label: 'Digital performance', cost: 180000, reach: 0.09, decay: 0.72, blurb: 'Measurable to four decimal places, all of them invented.' },
    { id: 'press', label: 'Trade press', cost: 95000, reach: 0.05, decay: 0.90, blurb: 'Reaches eleven people. All eleven sign contracts.' },
    { id: 'sponsor', label: 'Sponsorship', cost: 640000, reach: 0.15, decay: 0.94, blurb: 'Your name on a stand. Very hard to measure, very hard to resist.' },
    { id: 'influencer', label: 'Influencer partnerships', cost: 240000, reach: 0.13, decay: 0.58, blurb: 'Enormous spike. Gone by Thursday.' },
    { id: 'rebrand', label: 'Corporate rebrand', cost: 1900000, reach: 0.26, decay: 0.97, blurb: 'A new logo, a new font, and a consultancy in Shoreditch.' }
  ];

  var SLOGANS = [
    'A Brighter Tomorrow. Together.', 'Built For What Comes Next.', 'Quietly Everywhere.',
    'The Standard Others Are Measured By.', 'Serious About The Ordinary.', 'Now In More Places.',
    'We Do The Difficult Bit.', 'Since Before You Asked.', 'Think Bigger, Then Bigger.',
    'Because Good Enough Never Is.', 'The Future, But On Time.', 'Nobody Does It Quieter.'
  ];

  /* ---------- The property market ---------- */

  var PROPERTY_MARKET = [
    { id: 'p-coro', address: '1 Coronation Street, Weatherfield', type: 'Terraced residential', ask: 168000, rent: 178, condition: 62, yieldNote: 'Sitting tenant, forty years, pays on the day.' },
    { id: 'p-rovers', address: 'The Rovers Return Inn, Weatherfield', type: 'Licensed premises', ask: 495000, rent: 714, condition: 48, yieldNote: 'Wet-led. Eventful. Insurance is not cheap.' },
    { id: 'p-ever', address: '742 Evergreen Terrace, Springfield', type: 'Detached residential', ask: 214000, rent: 206, condition: 31, yieldNote: 'Structurally sound. Everything else is not.' },
    { id: 'p-spoon', address: '31 Spooner Street, Quahog', type: 'Detached residential', ask: 289000, rent: 267, condition: 44, yieldNote: 'Family in situ. Loud. Occasionally on fire.' },
    { id: 'p-moes', address: "Moe's Tavern, Springfield", type: 'Licensed premises', ask: 132000, rent: 216, condition: 22, yieldNote: 'Negative kerb appeal. Extraordinary regulars.' },
    { id: 'p-clans', address: 'The Clansman, Craiglang', type: 'Licensed premises', ask: 158000, rent: 243, condition: 37, yieldNote: 'Four customers, all of them permanent.' },
    { id: 'p-osb', address: 'Osprey Heights, Craiglang', type: 'Residential block (24 units)', ask: 1240000, rent: 1717, condition: 41, yieldNote: 'Lift works most days. Twenty-four tenancies.' },
    { id: 'p-rock', address: '3671 Whispymound Drive, Rockford Hills', type: 'Luxury residential', ask: 4850000, rent: 3171, condition: 88, yieldNote: 'Pool, tennis court, a man on the sofa.' },
    { id: 'p-30r', address: '30 Rockwell Plaza, Floors 48–52', type: 'Prime office', ask: 32400000, rent: 37385, condition: 91, yieldNote: 'Studio tenant on a fifteen-year lease.' },
    { id: 'p-yots', address: 'Yotsuba Tower, Nishi-Shinjuku', type: 'Prime office', ask: 47800000, rent: 47800, condition: 95, yieldNote: 'Immaculate. The eighth floor is never booked.' },
    { id: 'p-ware', address: 'Unit 4, Trotter Industrial Estate, Peckham', type: 'Light industrial', ask: 340000, rent: 575, condition: 29, yieldNote: 'Three-wheeled van included in the sale.' },
    { id: 'p-navid', address: "Navid's Parade, Craiglang", type: 'Retail parade (6 units)', ask: 720000, rent: 1052, condition: 55, yieldNote: 'Six shops, one of which sells everything.' },
    { id: 'p-grace', address: 'Grace Brothers Building, W1', type: 'Department store', ask: 18600000, rent: 19315, condition: 67, yieldNote: 'Grand, draughty, and listed to the rafters.' },
    { id: 'p-vic', address: 'The Queen Victoria, Albert Square', type: 'Licensed premises', ask: 610000, rent: 845, condition: 53, yieldNote: 'Never a dull Christmas.' },
    { id: 'p-wern', address: 'Wernham Hogg House, Slough', type: 'Secondary office', ask: 2900000, rent: 4573, condition: 38, yieldNote: 'Open plan. Very open plan.' },
    { id: 'p-kwik', address: 'Kwik-E Retail Park, Springfield', type: 'Retail park', ask: 8200000, rent: 10723, condition: 72, yieldNote: 'Anchor tenant on an index-linked lease.' },
    { id: 'p-dock', address: 'Baltic Dock Warehousing, Hull', type: 'Distribution', ask: 14700000, rent: 18092, condition: 76, yieldNote: 'Twelve loading bays, WAULT 8.4 years.' },
    { id: 'p-mews', address: '7 Kellett Mews, Belgravia', type: 'Prime residential', ask: 9400000, rent: 5062, condition: 94, yieldNote: 'Discreet. Two doors from an ambassador.' },
    { id: 'p-farm', address: 'Sugden Farm, Emmersdale', type: 'Agricultural', ask: 2350000, rent: 1627, condition: 58, yieldNote: 'Four hundred acres and an unresolved boundary.' },
    { id: 'p-dcx', address: 'Caverton DC-07 shell, Slough', type: 'Data centre shell', ask: 21500000, rent: 28942, condition: 81, yieldNote: 'Powered shell, 22 MW consented.' }
  ];

  /* ---------- Builders. Cheap, fast, good: pick approximately one. ---------- */

  var BUILDERS = [
    { id: 'bannister', name: 'Bannister Plant & Aggregates', rate: 1.00, speed: 1.00, quality: 0.80, reliability: 0.86, blurb: 'Steady. Will mention the skip.' },
    { id: 'duncwin', name: 'Duncan & Winston Contracts', rate: 0.62, speed: 0.55, quality: 0.52, reliability: 0.44, blurb: 'Cheapest quote you will ever receive. There is a reason.' },
    { id: 'barlow', name: 'Barlow & Nephew Joinery', rate: 1.18, speed: 0.92, quality: 0.94, reliability: 0.91, blurb: 'Proper craftsmen. Proper invoice.' },
    { id: 'wolfe', name: 'Wolfe & Sons Restoration', rate: 1.65, speed: 0.78, quality: 0.99, reliability: 0.97, blurb: 'Heritage specialists. Museum standard, museum pricing.' },
    { id: 'grims', name: 'Grimsdale Contractors', rate: 0.84, speed: 1.35, quality: 0.68, reliability: 0.62, blurb: 'Astonishingly fast. Snagging list of biblical length.' },
    { id: 'norris', name: 'Cole Groundworks & Civils', rate: 0.95, speed: 0.88, quality: 0.85, reliability: 0.93, blurb: 'Talks a great deal. Delivers on the day.' },
    { id: 'scorp', name: 'Globex Facilities Division', rate: 1.42, speed: 1.28, quality: 0.93, reliability: 0.95, blurb: 'Turn-key, in-house, faintly unsettling efficiency.' },
    { id: 'trotter', name: 'Trotters Building Services', rate: 0.48, speed: 1.10, quality: 0.34, reliability: 0.29, blurb: 'He who dares. You, in this instance, are daring.' }
  ];

  var WORKS = [
    { id: 'cosmetic', label: 'Cosmetic refresh', base: 0.018, weeks: 3, condition: 14, value: 0.03, blurb: 'Paint, carpet, and a photograph that sells it.' },
    { id: 'kitchen', label: 'Kitchens & bathrooms', base: 0.045, weeks: 6, condition: 22, value: 0.07, blurb: 'The two rooms anybody actually looks at.' },
    { id: 'systems', label: 'Mechanical & electrical', base: 0.062, weeks: 8, condition: 26, value: 0.08, blurb: 'Rewire, boiler, and a certificate that stops the lawyers.' },
    { id: 'fabric', label: 'Roof & external fabric', base: 0.090, weeks: 11, condition: 31, value: 0.11, blurb: 'Nobody sees it. Everybody notices when it is not done.' },
    { id: 'extend', label: 'Extension & reconfiguration', base: 0.155, weeks: 18, condition: 24, value: 0.21, blurb: 'More square feet, which is the only reliable trick in property.' },
    { id: 'convert', label: 'Full conversion to units', base: 0.280, weeks: 28, condition: 45, value: 0.38, blurb: 'One building in, several tenancies out.' },
    { id: 'green', label: 'Energy retrofit to EPC B', base: 0.075, weeks: 9, condition: 18, value: 0.09, blurb: 'Compulsory eventually. Cheaper now than then.' }
  ];

  /* ---------- Weekly news. Some of it is your fault. ---------- */

  var EVENTS = [
    { id: 'e-rates', head: 'Base rate moves', body: 'The committee has moved the base rate. Financing costs across the market reprice accordingly.', sector: 'Financials', impact: 0.05, scope: 'sector' },
    { id: 'e-chips', head: 'Component shortage eases', body: 'A twelve-month squeeze on components has broken. Technology margins recover.', sector: 'Technology', impact: 0.07, scope: 'sector' },
    { id: 'e-oil', head: 'Supply shock in crude', body: 'An outage has taken capacity offline. Energy repricing is immediate and unhelpful.', sector: 'Energy', impact: 0.09, scope: 'sector' },
    { id: 'e-strike', head: 'Industrial action announced', body: 'A ballot has passed. Logistics and industrials face disruption for several weeks.', sector: 'Transport & Logistics', impact: -0.08, scope: 'sector' },
    { id: 'e-spectrum', head: 'Spectrum auction concludes', body: 'Bandwidth has changed hands at a price nobody wanted to pay and everybody did.', sector: 'Telecommunications', impact: 0.06, scope: 'sector' },
    { id: 'e-recall', head: 'Product recall across the sector', body: 'A safety notice has forced a recall. Consumer confidence takes the hit first.', sector: 'Consumer Toys', impact: -0.12, scope: 'sector' },
    { id: 'e-heat', head: 'Record summer lifts wet sales', body: 'Fourteen consecutive days above thirty. Hospitality has never been happier.', sector: 'Hospitality', impact: 0.11, scope: 'sector' },
    { id: 'e-planning', head: 'Planning reform clears committee', body: 'Consent timescales fall. Development land reprices upward on the announcement.', sector: 'Real Estate', impact: 0.08, scope: 'sector' },
    { id: 'e-ai', head: 'Compute demand overwhelms supply', body: 'Every rack in the country is spoken for. Digital infrastructure is the only game.', sector: 'Digital Infrastructure', impact: 0.14, scope: 'sector' },
    { id: 'e-probe', head: 'Regulator opens a market study', body: 'The regulator is taking an interest. Nobody involved has slept well since.', impact: -0.05, scope: 'market' },
    { id: 'e-boom', head: 'Sentiment turns decisively positive', body: 'Confidence surveys have gone from grim to giddy without pausing at reasonable.', impact: 0.06, scope: 'market' },
    { id: 'e-crash', head: 'Broad risk-off across the market', body: 'Everything is down and nobody can say precisely why, which is the worst kind.', impact: -0.09, scope: 'market' },
    { id: 'e-budget', head: 'Fiscal statement lands', body: 'The Chancellor has been to the despatch box. Expect three weeks of recalculation.', impact: 0.03, scope: 'market' },
    { id: 'e-tax', head: 'Corporation tax consultation', body: 'A consultation, which is how a tax rise introduces itself politely.', impact: -0.04, scope: 'market' }
  ];

  /* ---------- Jimmy's catalogue of advice. All of it is wrong. ---------- */

  var JIMMY_OPENERS = [
    'Now then, now then \u2014',
    'Now then, now then, guys and gals \u2014',
    'Now then! Now THEN. Sit yourself down \u2014',
    'Now then, now then, and a very good afternoon to you \u2014',
    'Ooh, lovely stuff, lovely stuff. Now then \u2014',
    'Howzabout that then, eh? Howzabout THAT \u2014',
    'Right. Uncle Jimmy here, medallion on, cigar lit \u2014',
    'Well hello there, boys and girls of the boardroom \u2014',
    'Goodness me, what a question. What a question. Now then \u2014',
    'Ohhh, marvellous, marvellous. Now then, now then \u2014'
  ];

  var JIMMY_CLOSERS = [
    'And that, my friend, is how it is done. Jangle jangle!',
    'Trust Jimmy. Jimmy has never been wrong, and Jimmy has never checked.',
    'Put it on the JimmyVision expenses. Nobody reads those. Nobody DARES.',
    'You can thank me at the awards do. I have already written my speech and I have already cried.',
    'That will be nine hundred thousand pounds, consultancy, plus the cigar. Lovely.',
    'And if it goes wrong \u2014 and it will \u2014 blame the market. Everybody does. Ooh!',
    'Now then. That is your lot. Be lucky, be lovely, and be liquid.',
    'Simple as that. Simple. As. That. Next caller!',
    'Ooh, I have given myself goosebumps. Goosebumps, at my age.',
    'Write that down. Frame it. Show it to a judge one day, possibly.'
  ];

  KH.simdata = {
    executives: EXECUTIVES,
    roles: ROLES,
    strategies: STRATEGIES,
    channels: CHANNELS,
    slogans: SLOGANS,
    propertyMarket: PROPERTY_MARKET,
    builders: BUILDERS,
    works: WORKS,
    events: EVENTS,
    jimmyOpeners: JIMMY_OPENERS,
    jimmyClosers: JIMMY_CLOSERS
  };
})(window.KH);

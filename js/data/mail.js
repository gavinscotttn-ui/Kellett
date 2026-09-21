/* ============================================================
   Correspondence.

   `mins` is minutes before the moment the workspace opened, so
   the folder always reads as current rather than as a fixture
   with last year's dates on it.
   ============================================================ */

(function (KH) {
  'use strict';

  var FOLDERS = [
    { id: 'priority', label: 'Priority', icon: 'star' },
    { id: 'inbox', label: 'Inbox', icon: 'mail' },
    { id: 'board', label: 'Board Papers', icon: 'folder' },
    { id: 'deals', label: 'Transactions', icon: 'briefcase' },
    { id: 'legal', label: 'Legal & Compliance', icon: 'shield' },
    { id: 'sent', label: 'Sent Items', icon: 'send' },
    { id: 'drafts', label: 'Drafts', icon: 'edit' },
    { id: 'archive', label: 'Archive', icon: 'archive' }
  ];

  var MESSAGES = [
    {
      id: 'm01', folder: 'priority', from: 'tarquin', mins: 14, unread: true, priority: true,
      subject: 'Project NIGHTINGALE — board pack circulated, your sign-off required by 18:00',
      tags: ['Confidential', 'Signature required'],
      attachments: [{ name: 'NIGHTINGALE_BoardPack_v14.pdf', size: '8.4 MB', ext: 'pdf' }, { name: 'Valuation_Bridge.xlsx', size: '1.2 MB', ext: 'xls' }],
      body: [
        'The revised pack went round at ten past. Nothing in it will surprise you — the bridge is where we left it on Tuesday and the leverage test still clears with room to spare.',
        'The only outstanding item is your signature on schedule 4. Committee will not sit without it and I would rather not spend the evening explaining why.',
        'I have told them you will have read it properly. Do make an honest man of me.'
      ],
      sign: 'Sir Tarquin Fitzwilliam-Smythe\nNon-Executive Chairman\nKellett Holdings'
    },
    {
      id: 'm02', folder: 'priority', from: 'stobs', mins: 38, unread: true, priority: true,
      subject: 'Re: the thing we discussed',
      tags: ['External', 'Do not forward'],
      body: [
        'I have looked at it.',
        'It needs to be thinner.',
        'Not the document. The company.'
      ],
      sign: 'Jeve Stobs\nFounder & Chief Visionary\nBitten Fruit Systems\nSent from a device I designed'
    },
    {
      id: 'm03', folder: 'priority', from: 'ramsey', mins: 52, unread: true,
      subject: 'RE: CANAPÉ SPECIFICATION — AGM, GUILDHALL',
      tags: ['Hospitality'],
      body: [
        'RIGHT. I HAVE READ YOUR CATERING BRIEF AND I HAVE SOME NOTES.',
        'THREE HUNDRED GUESTS. FOURTEEN COURSES. ONE KITCHEN THE SIZE OF A DOWNSTAIRS TOILET. IT IS RAW. THE WHOLE PLAN IS RAW.',
        'ALSO, AND I CANNOT STRESS THIS ENOUGH: WHERE IS THE LAMB SAUCE.',
        'Send me a floor plan by four and I will fix it. It will be beautiful. It will cost you.'
      ],
      sign: 'Gordon Ramsey\nGroup Executive Chef\nRamsey Hospitality Holdings'
    },
    {
      id: 'm04', folder: 'inbox', from: 'business', mins: 71, unread: true,
      subject: 'RE: RE: FW: RE: the business (business)',
      tags: ['External'],
      body: [
        'Good morning. I am writing to you about business.',
        'As discussed at the business meeting, the business is performing businesswise in line with business. I have actioned the business and circulated it to the business team, who are across the business.',
        'Could you confirm receipt of the business so that I may proceed with the business? I am on a plane from 14:00 but my assistant is also called Business.'
      ],
      sign: 'Mr. Business\nChief Business Officer\nBusiness Business Business Ltd'
    },
    {
      id: 'm05', folder: 'legal', from: 'hillman', mins: 96, unread: true,
      subject: 'Life assurance — updated beneficiary schedule for your signature',
      tags: ['Private', 'Signature required'],
      attachments: [{ name: 'Beneficiary_Schedule_rev3.docx', size: '412 KB', ext: 'doc' }],
      body: [
        'Following our chat, I have restructured the policy so the cover sits outside the estate. It is all very standard and I have taken care of everything, as I always do.',
        'I have also taken the liberty of arranging the survey on the conservatory. No need for you to be there. In fact it is better if you are not.',
        'Sign where I have pencilled the little crosses and leave the rest with me. You have absolutely nothing to worry about.'
      ],
      sign: 'Richard Hillman\nSenior Partner, Estate Planning\nHillman Life & Legacy'
    },
    {
      id: 'm06', folder: 'deals', from: 'vasquez', mins: 128, unread: true,
      subject: 'Meridian — term sheet draft 14 (clean and marked)',
      tags: ['Transaction', 'Confidential'],
      attachments: [
        { name: 'Meridian_TermSheet_d14_CLEAN.pdf', size: '2.1 MB', ext: 'pdf' },
        { name: 'Meridian_TermSheet_d14_MARKED.pdf', size: '2.4 MB', ext: 'pdf' },
        { name: 'Funds_Flow.xlsx', size: '880 KB', ext: 'xls' }
      ],
      body: [
        'Draft 14 attached, clean and marked against 12 — you will recall we never circulated 13 for reasons of superstition on their side.',
        'They have conceded on the ratchet and moved the locked box date to the 30th. In exchange they want the warranty cap at 22% and a six-month tail. My advice is to take it; we are arguing about a rounding error at this point.',
        'Funds flow is attached for completeness. Signing Thursday, completion the following Tuesday, assuming nobody discovers anything interesting in the data room over the weekend.'
      ],
      sign: 'Renée Vasquez\nManaging Director, Capital Markets\nMeridian Partners'
    },
    {
      id: 'm29', folder: 'deals', from: 'tnet', mins: 47, unread: true, priority: true,
      subject: 'Telecom Networks \u2014 strategic stake, and the fibre build',
      tags: ['Transaction', 'Confidential'],
      attachments: [{ name: 'TNET_Investor_Pack_Q3.pdf', size: '5.9 MB', ext: 'pdf' }, { name: 'Fibre_Buildout_Model.xlsx', size: '2.7 MB', ext: 'xls' }],
      body: [
        'Thank you for the time yesterday. To put it plainly: we would rather have you on the register than a fund that will be gone in eighteen months.',
        'The fibre build is ahead of programme and under budget, which I appreciate is the sort of sentence that invites scepticism. The model is attached so you can be sceptical with the actual numbers in front of you.',
        'We are offering the stake at a 6% discount to the closing price, with a twelve-month lock-up and a board observer seat. TNET is the strongest line on your watchlist and I do not think that is an accident.',
        'If the answer is yes, it needs to be yes by Friday. If the answer is no, I would like to hear it from you rather than from your corporate finance team.'
      ],
      sign: 'Imogen Hartley-Rowe\nChief Executive\nTelecom Networks PLC'
    },
    {
      id: 'm07', folder: 'inbox', from: 'mazarus', mins: 163, unread: true,
      subject: 'acquiring your company (again)',
      tags: ['External'],
      body: [
        'hey. so i have been thinking about kellett holdings and i would like to buy all of it. cash. today.',
        'i have not looked at the accounts and i would prefer not to. the vibes are good and that is usually enough.',
        'if this is a no, i will simply start a competing holding company from first principles. it will be called Holdings and it will be better.',
        'let me know either way. i am awake.'
      ],
      sign: 'Elmo Mazarus\nChief Executive\nTessellate Dynamics'
    },
    {
      id: 'm08', folder: 'board', from: 'sterling', mins: 201, unread: false,
      subject: 'Group risk register — Q3 amber items and one red',
      tags: ['Board', 'Confidential'],
      attachments: [{ name: 'Risk_Register_Q3.xlsx', size: '3.6 MB', ext: 'xls' }],
      body: [
        'Eleven ambers, down from fourteen. Concentration in digital infrastructure remains the one genuinely material exposure and I am obliged to keep saying so until somebody does something about it.',
        'The red is operational: our disaster recovery site has been failing its quarterly test since March because a contractor unplugged something and nobody has been able to establish which contractor, or indeed which something.',
        'I have asked for a remediation plan by the 30th. I would appreciate your visible support on this one at committee — it gets solved considerably faster when the request comes from your end of the table.'
      ],
      sign: 'Dr. Evelyn Sterling\nChief Risk Officer\nKellett Holdings'
    },
    {
      id: 'm09', folder: 'deals', from: 'okonjo', mins: 244, unread: false,
      subject: 'RCF refinancing — pricing grid agreed at SONIA + 185',
      tags: ['Treasury'],
      body: [
        'Good news. The syndicate has come back at 185 over on the revolver, down from 220, with the step-down at 2.5x rather than 2.0x. That is roughly £1.9m a year back in our pocket on current drawings.',
        'Documentation is with counsel. I do not expect drama, but I never do and I am occasionally wrong.',
        'One ask: the lenders would like a short call with you personally before signing. Fifteen minutes, entirely ceremonial. They want to hear the strategy from the top.'
      ],
      sign: 'Adaeze Okonjo\nGroup Head of Corporate Finance\nKellett Holdings'
    },
    {
      id: 'm10', folder: 'inbox', from: 'doors', mins: 310, unread: false,
      subject: 'RE: enterprise licensing — 11,400 seats',
      tags: ['Procurement'],
      body: [
        'We can do 11,400 seats on the enterprise agreement at the rate discussed, with the caveat that the rate discussed was discussed in 2019.',
        'I have attached nothing, because the attachment exceeded the limit on your own mail system, which I should point out is also ours.',
        'Happy to renew for three years. Happier to renew for five.'
      ],
      sign: 'Bill Doors\nChairman Emeritus\nMicrodoor Corporation'
    },
    {
      id: 'm11', folder: 'inbox', from: 'bozos', mins: 366, unread: false,
      subject: 'Warehouse 9 — a small clarification regarding delivery windows',
      tags: ['Logistics'],
      body: [
        'Thank you for the note about the delivery window. I want to be clear that we do offer a delivery window, and that the window is Tuesday.',
        'If Tuesday is inconvenient, we can also offer Tuesday.',
        'On the wider partnership: yes. Let us do it. My people will send your people a document of quite remarkable length.'
      ],
      sign: 'Jeff Bozos\nProprietor\nRiverlarge Global Logistics'
    },
    {
      id: 'm12', folder: 'inbox', from: 'sucrose', mins: 421, unread: false,
      subject: 'You’re hired (conditional, pending due diligence)',
      tags: ['External'],
      body: [
        'I have watched you operate for six months now and I will be straight with you, because that is what I do.',
        'Your margins are respectable. Your overheads are not. You spent £40,000 on a hospitality box and I have seen the guest list — half of them could not find your head office with a map and a torch.',
        'Fix the overheads and there is a deal here. Do not fix them and I will still be interested, but at a considerably ruder price.'
      ],
      sign: 'Lord Alan Sucrose\nChairman\nAmstradivarius Group'
    },
    {
      id: 'm13', folder: 'inbox', from: 'buffet', mins: 488, unread: false,
      subject: 'A short note on patience',
      tags: ['External'],
      body: [
        'You asked what I would do with the digital infrastructure position. I would do nothing, which is the hardest thing there is and the only thing I have ever been good at.',
        'The market will offer you a price for it roughly four times a year. Three of those prices will be silly. You only need to be right about the fourth.',
        'Give my regards to the North Sea.'
      ],
      sign: 'Warren Buffét\nOracle\nOmahaha Capital'
    },
    {
      id: 'm26', folder: 'priority', from: 'donaghy', mins: 63, unread: true, priority: true,
      subject: 'Synergy \u2014 and a frank word about your suit',
      tags: ['External', 'Confidential'],
      body: [
        'Scott. Good. You answered before the second ring, which tells me everything I need to know about you and almost everything I need to know about your company.',
        'Here is the situation. Sheinhardt has a microwave oven programming division, a television network and, for reasons that predate me and a lawsuit, a wig concern. Kabletown wants all three. I want your balance sheet standing behind me when I tell them the price.',
        'I have run the numbers through Six Sigma. The wheel does not lie: Focus, Teamwork, Insight, Brutality. Your holding company scores well on three of those and I suspect we both know which one needs work.',
        'Dinner Thursday. Wear the navy with the peak lapel \u2014 the notch lapel is for men who have given up.'
      ],
      sign: 'Jack Donaghy\nVice President, East Coast Television & Microwave Oven Programming\nSheinhardt Wig Company'
    },
    {
      id: 'm27', folder: 'deals', from: 'pewterschmidt', mins: 188, unread: true,
      subject: 'RE: joint venture \u2014 Pewterschmidt Industries',
      tags: ['Transaction', 'External'],
      attachments: [{ name: 'Pewterschmidt_Heads_of_Terms.pdf', size: '1.8 MB', ext: 'pdf' }],
      body: [
        'I have had my people look at your proposal and I will be honest with you, because at my age and net worth there is no percentage in being anything else.',
        'It is a good deal. Not a great deal. A good one. I have made eleven billion dollars by knowing the difference, and by never, under any circumstances, letting my daughter marry into a business I am financing.',
        'Come to the estate. Bring the term sheet, bring a swimming costume, and do not bring anybody from Quahog. I have had quite enough of Quahog.'
      ],
      sign: 'Carter Pewterschmidt\nChairman & Principal Shareholder\nPewterschmidt Industries'
    },
    {
      id: 'm28', folder: 'inbox', from: 'duffy', mins: 505, unread: false,
      subject: 'the beeper market is coming back',
      tags: ['External'],
      body: [
        'Hey. Technology is cyclical. Everything that goes around comes around, and right now what is coming around is the beeper.',
        'Hospitals. Drug dealers. Nostalgia. Three vertical markets, one product, zero competition, because everyone else quit. I did not quit. I am the Beeper King.',
        'I am looking for a strategic partner with deep pockets and no questions. You are two for two.'
      ],
      sign: 'Dennis Duffy\nProprietor \u2014 The Beeper King\n“Technology is cyclical”'
    },
    {
      id: 'm14', folder: 'inbox', from: 'drax', mins: 540, unread: false,
      subject: 'Orbital logistics — a private matter',
      tags: ['External', 'Confidential'],
      body: [
        'Mr Scott. You have a most impressive balance sheet, and I have a most impressive launch facility. I feel we should combine them before somebody less imaginative does.',
        'I am hosting a small gathering at the estate on the 14th. There will be shooting, there will be an orchid house, and there will be a conversation about the future of the species that I think you will find invigorating.',
        'Do come alone. The helicopter seats one.'
      ],
      sign: 'Hugo Drax\nGroup Chairman\nDrax Aerospace Industries'
    },
    {
      id: 'm15', folder: 'inbox', from: 'trotter', mins: 602, unread: false,
      subject: 'Business opportunity — ground floor, mate',
      tags: ['External'],
      body: [
        'Dear Sir, I hope this finds you well and that the yacht is behaving itself.',
        'I have come into a quantity of stock — all above board, all documented, don’t you worry about that — and I am offering my associates first refusal before it goes to the wider market. We are talking 4,000 units of a premium consumer electronics item that I am not at liberty to name in writing.',
        'Put twenty grand in and this time next year, Gavin, this time next year.'
      ],
      sign: 'Derek Trotter\nManaging Director\nTrotters Independent Traders\nNew York · Paris · Peckham'
    },
    {
      id: 'm16', folder: 'inbox', from: 'partridge', mins: 664, unread: false,
      subject: 'Monkey Tennis — format proposal (2nd submission)',
      tags: ['External'],
      attachments: [{ name: 'Formats_Deck_FINAL_FINAL_v9.pptx', size: '14.8 MB', ext: 'ppt' }],
      body: [
        'Further to my previous eleven emails, and the voicemail, and the thing I put through your letterbox.',
        'Youth Hostelling with Chris Eubank. Cooking in Prison. Inner-City Sumo. Arm Wrestling with Chas and Dave. And the jewel in the crown, the one you keep not replying about: Monkey Tennis.',
        'I only need a first-look deal and a modest facility fee. I have a garage full of equipment and a blazer that tests extremely well with the 45-to-60s.',
        'Smell my cheese.'
      ],
      sign: 'Alan Partridge\nHead of Programming\nPeartree Productions'
    },
    {
      id: 'm17', folder: 'inbox', from: 'brenda', mins: 700, unread: true,
      subject: 'Expenses claim KH-0001 — missing receipt (£4.20)',
      tags: ['Finance'],
      body: [
        'Morning. I have your expenses claim here for the quarter. It is all in order apart from one item.',
        'There is a coffee on the 11th for £4.20 with no receipt attached. I cannot process the claim without it. I am afraid this applies to everybody, including the gentleman whose name is on the building.',
        'The £312,000 chartered flight was fine. It had a receipt.'
      ],
      sign: 'Brenda Cutlass\nAccounts Payable\nKellett Holdings'
    },
    {
      id: 'm18', folder: 'inbox', from: 'dave', mins: 742, unread: false,
      subject: 'Scheduled maintenance — Saturday 02:00 to 04:00',
      tags: ['IT'],
      body: [
        'Evening all. We are patching the estate on Saturday between 02:00 and 04:00. Mail and messaging will be briefly unavailable. Market data will not be affected.',
        'While I have you: the disaster recovery thing. It was me. I unplugged it in March to charge a vacuum cleaner and I have been carrying it around ever since.',
        'I have plugged it back in. Please do not mention this to Dr Sterling.'
      ],
      sign: 'Dave\nInfrastructure & Support\nKellett Holdings'
    },
    {
      id: 'm19', folder: 'inbox', from: 'bannister', mins: 800, unread: false,
      subject: 'Re: the skip',
      tags: ['Facilities'],
      body: [
        'Skip is still there. Been there since Thursday.',
        'I can move it Monday but it’ll be a permit job now and the permit is with the council, and the council is the council.',
        'Let us know.'
      ],
      sign: 'Clive Bannister\nBannister Plant & Aggregates'
    },
    {
      id: 'm20', folder: 'legal', from: 'sterling', mins: 900, unread: false,
      subject: 'Market abuse — annual attestation due',
      tags: ['Compliance', 'Signature required'],
      body: [
        'Your annual attestation is outstanding. It takes four minutes and it keeps a great many people considerably calmer than they would otherwise be.',
        'The wording has not changed since last year. Neither, I notice, has your enthusiasm for completing it.'
      ],
      sign: 'Dr. Evelyn Sterling\nChief Risk Officer\nKellett Holdings'
    },
    {
      id: 'm21', folder: 'archive', from: 'custodian', mins: 1320, unread: false,
      subject: 'Settlement confirmation — reference NB-8841204',
      tags: ['Automated'],
      body: [
        'This is an automated confirmation. Settlement has completed for the instruction referenced above. No action is required.',
        'Holdings and cash balances have been updated in your custody record. A full statement is available on request through your relationship team.'
      ],
      sign: 'Northbank Custody Services\nAutomated settlement notice — please do not reply'
    },
    {
      id: 'm22', folder: 'board', from: 'tarquin', mins: 1560, unread: false,
      subject: 'Dates for next year — please do not move them again',
      tags: ['Board'],
      body: [
        'Attached, the proposed calendar. Four scheduled meetings, two strategy days and the AGM.',
        'You have moved the February meeting three times in as many years, on each occasion for a reason involving an aircraft. I am asking, chairman to chief executive, that you do not do it a fourth time.'
      ],
      sign: 'Sir Tarquin Fitzwilliam-Smythe\nNon-Executive Chairman\nKellett Holdings'
    },
    {
      id: 'm23', folder: 'sent', from: 'self', to: 'tarquin', mins: 8, unread: false,
      subject: 'RE: Project NIGHTINGALE — board pack circulated, your sign-off required by 18:00',
      tags: ['Confidential'],
      body: [
        'Read it twice. Schedule 4 signed and returned separately.',
        'I want one change before committee: the synergies line moves out of year one entirely. If we are wrong about it in year one we are wrong in public, and I would rather be quietly right in year two.',
        'Otherwise, proceed.'
      ],
      sign: ''
    },
    {
      id: 'm24', folder: 'sent', from: 'self', to: 'vasquez', mins: 96, unread: false,
      subject: 'RE: Meridian — term sheet draft 14',
      tags: ['Transaction'],
      body: [
        'Take the cap at 22% and the six-month tail. Hold firm on the locked box date — the 30th works for us and moving it costs them nothing to concede.',
        'I will do Thursday in person. Book the room with the good chairs, not the one with the flipchart.'
      ],
      sign: ''
    },
    {
      id: 'm25', folder: 'drafts', from: 'self', to: 'partridge', mins: 40, unread: false, draft: true,
      subject: 'RE: Monkey Tennis — format proposal (2nd submission)',
      tags: ['Draft'],
      body: [
        'Alan,',
        'Thank you for the deck. And the voicemail. And the item through the letterbox.',
        'I have to be honest with you about Monkey Tennis'
      ],
      sign: ''
    }
  ];

  /* ---------- Replies that actually do something -------------------
     Each option carries an effect on the group and the answer that
     comes back. Decisions are recorded on the saved game, so a
     mailbox is a record of what you chose, not a list of buttons.
     ------------------------------------------------------------------ */

  var CHOICES = {
    m01: [
      { label: 'Sign schedule 4 tonight', effect: { reputation: 4, scrutiny: -1 },
        reply: 'Signed and returned within the hour. Committee sat at six and the chairman noted it.' },
      { label: 'Sign, but move synergies out of year one', effect: { reputation: 6, scrutiny: -2 },
        reply: 'Redrafted at your instruction. The chairman called it the first honest forecast he has seen in four years.' },
      { label: 'Refuse to sign until the model is re-run', effect: { reputation: -3, scrutiny: -4 },
        reply: 'Committee stood down. Irritation all round, and a materially better set of numbers by Friday.' }
    ],
    m02: [
      { label: 'Cut the deck to one slide', effect: { reputation: 5 },
        reply: 'One slide. One number. He photographed it and sent it back with a single word: yes.' },
      { label: 'Explain why the detail matters', effect: { reputation: -2 },
        reply: 'He did not reply for six days. When he did, it said: "41 slides. Still 41 slides."' }
    ],
    m03: [
      { label: 'Approve two more induction points', effect: { cash: -46000, reputation: 4 },
        reply: 'BEAUTIFUL. ABSOLUTELY BEAUTIFUL. THREE HUNDRED COVERS AND NOT ONE COMPLAINT. THE LAMB SAUCE WAS FOUND.' },
      { label: 'Tell him to work with the kitchen as it is', effect: { reputation: -3 },
        reply: 'HE WORKED WITH IT. IT WAS FINE. FINE IS THE WORST WORD IN THE ENGLISH LANGUAGE AND YOU DID THIS.' }
    ],
    m05: [
      { label: 'Sign the beneficiary schedule', effect: { cash: -12000, scrutiny: 3 },
        reply: 'Lovely. All filed. You really have nothing at all to worry about now. Nothing whatsoever.' },
      { label: 'Ask your own solicitor to review it first', effect: { reputation: 3, scrutiny: -2 },
        reply: 'Of course. Entirely sensible. There is no rush at all. None. Take all the time you need.' },
      { label: 'Decline and cancel the conservatory survey', effect: { reputation: 4 },
        reply: 'A shame. I had cleared the whole afternoon. Do let me know if you change your mind.' }
    ],
    m06: [
      { label: 'Accept the cap at 22% and the six-month tail', effect: { cash: -180000, reputation: 5 },
        reply: 'Signed Thursday. Completion the following Tuesday. Clean process, and they did not find the thing in the data room.' },
      { label: 'Hold firm at 18% and risk the deal', effect: { reputation: -4, scrutiny: 2 },
        reply: 'They walked, came back in nine days, and settled at 20%. It cost you a fortnight and the chairman\u2019s patience.' }
    ],
    m07: [
      { label: 'Decline politely', effect: { reputation: 2 },
        reply: 'ok. no hard feelings. i am starting a competing holding company. it is called Holdings. it will be better' },
      { label: 'Name an absurd price', effect: {  reputation: 3 },
        reply: 'love it. respect. i am not paying that but i am going to tell people you asked for it' }
    ],
    m17: [
      { label: 'Find the \u00a34.20 receipt', effect: { reputation: 3 },
        reply: 'Received and processed. Thank you. I have marked the claim complete. Everyone is treated the same here.' },
      { label: 'Tell her to write it off', effect: { reputation: -6, scrutiny: 4 },
        reply: 'I have written it off as instructed and noted on the file that it was written off at your instruction.' }
    ],
    m26: [
      { label: 'Accept dinner and the navy suit', effect: {  reputation: 9 },
        reply: 'Correct on both counts. Kabletown came up two turns before the dessert. You are now a man I return calls to.' },
      { label: 'Decline — you do not need Sheinhardt', effect: { reputation: -2 },
        reply: 'A mistake, but an honest one. I respect the decision and I will remember it for exactly as long as it suits me.' }
    ],
    m27: [
      { label: 'Fly out to the estate', effect: { cash: -84000, reputation: 8 },
        reply: 'Good. We swam, we argued, and we signed. You are harder work than you look, which in my book is a compliment.' },
      { label: 'Send the corporate finance team instead', effect: { reputation: -3 },
        reply: 'I do not deal with teams. I deal with principals. The offer stands, three per cent worse.' }
    ],
    m29: [
      { label: 'Take the stake at the 6% discount', effect: { cash: -260000, reputation: 8 },
        reply: 'Papered this afternoon. Welcome to the register, and I will see you at the first board meeting in October.' },
      { label: 'Negotiate for a full board seat now', effect: { reputation: -1 },
        reply: 'No. Observer at twelve months or nothing. I said best and final and I meant it. The offer closes Friday.' },
      { label: 'Decline — buy in the market instead', effect: { scrutiny: 5 },
        reply: 'Then buy quietly and stay under three per cent, or we both end up making an announcement neither of us wants.' }
    ],
    m28: [
      { label: 'Invest \u00a325,000 in the beeper market', effect: { cash: -25000, reputation: -4 },
        reply: 'YES. You will not regret this. Technology is cyclical. I will send quarterly updates. There were no quarterly updates.' },
      { label: 'Decline', effect: { reputation: 1 },
        reply: 'Your loss. Literally. In about eighteen months. Mark this email.' }
    ],
    m15: [
      { label: 'Put twenty thousand in', effect: { cash: -20000, reputation: -2 },
        reply: 'Lovely jubbly! They\u2019ve got a plug on them. Slight issue with which country the plug is for. Still a bargain though.' },
      { label: 'Decline', effect: {},
        reply: 'No worries, Gav. This time next year, eh? This time next year.' }
    ],
    m16: [
      { label: 'Commission a pilot of Monkey Tennis', effect: { cash: -140000, reputation: -2 },
        reply: 'YES! Monkey Tennis is GO. I have booked a court, six monkeys and a man from the zoo who says it will not work.' },
      { label: 'Offer a first-look deal on Youth Hostelling', effect: { cash: -60000, reputation: 2 },
        reply: 'Chris Eubank has said yes. Chris Eubank has said yes! I am going to be sick. In a good way. Mostly.' },
      { label: 'Pass', effect: {},
        reply: 'Understood. I shall put Monkey Tennis on the back burner. Not off the hob. Back.' }
    ]
  };

  var opened = Date.now();

  MESSAGES.forEach(function (m) {
    m.when = opened - m.mins * 60000;
    m.preview = m.body[0].slice(0, 160);
    m.choices = CHOICES[m.id] || null;
  });

  function inFolder(id) {
    return MESSAGES.filter(function (m) { return m.folder === id; })
      .sort(function (a, b) { return b.when - a.when; });
  }

  KH.mail = {
    folders: FOLDERS,
    choices: CHOICES,
    messages: MESSAGES,
    inFolder: inFolder,
    get: function (id) { return MESSAGES.filter(function (m) { return m.id === id; })[0] || null; }
  };
})(window.KH);

/* ============================================================
   The address book. Everyone the workspace can show a message
   from, with the initials and colour slot used for their tile.
   ============================================================ */

(function (KH) {
  'use strict';

  var PEOPLE = [
    { id: 'stobs', name: 'Jeve Stobs', role: 'Founder & Chief Visionary', org: 'Bitten Fruit Systems', email: 'j.stobs@bittenfruit.com', slot: 0, vip: true },
    { id: 'mazarus', name: 'Elmo Mazarus', role: 'Chief Executive', org: 'Tessellate Dynamics', email: 'e.mazarus@tessellate.io', slot: 1, vip: true },
    { id: 'business', name: 'Mr. Business', role: 'Chief Business Officer', org: 'Business Business Business Ltd', email: 'business@business.business', slot: 2, vip: true },
    { id: 'hillman', name: 'Richard Hillman', role: 'Senior Partner, Estate Planning', org: 'Hillman Life & Legacy', email: 'r.hillman@hillmanlegacy.co.uk', slot: 3, vip: true },
    { id: 'ramsey', name: 'Gordon Ramsey', role: 'Group Executive Chef', org: 'Ramsey Hospitality Holdings', email: 'g.ramsey@ramseyhospitality.com', slot: 7, vip: true },
    { id: 'doors', name: 'Bill Doors', role: 'Chairman Emeritus', org: 'Microdoor Corporation', email: 'b.doors@microdoor.com', slot: 4, vip: true },
    { id: 'bozos', name: 'Jeff Bozos', role: 'Proprietor', org: 'Riverlarge Global Logistics', email: 'j.bozos@riverlarge.com', slot: 5, vip: true },
    { id: 'sucrose', name: 'Lord Alan Sucrose', role: 'Chairman', org: 'Amstradivarius Group', email: 'a.sucrose@amstradivarius.co.uk', slot: 6, vip: true },
    { id: 'buffet', name: 'Warren Buffét', role: 'Oracle', org: 'Omahaha Capital', email: 'w.buffet@omahaha.com', slot: 2, vip: true },
    { id: 'trotter', name: 'Derek Trotter', role: 'Managing Director', org: 'Trotters Independent Traders (NY, Paris, Peckham)', email: 'delboy@tit.co.uk', slot: 3, vip: false },
    { id: 'partridge', name: 'Alan Partridge', role: 'Head of Programming', org: 'Peartree Productions', email: 'a.partridge@peartree.tv', slot: 1, vip: false },
    { id: 'donaghy', name: 'Jack Donaghy', role: 'Vice President, East Coast Television & Microwave Oven Programming', org: 'Sheinhardt Wig Company', email: 'j.donaghy@sheinhardtwig.com', slot: 0, vip: true },
    { id: 'pewterschmidt', name: 'Carter Pewterschmidt', role: 'Chairman & Principal Shareholder', org: 'Pewterschmidt Industries', email: 'c.pewterschmidt@pewterschmidt.com', slot: 5, vip: true },
    { id: 'duffy', name: 'Dennis Duffy', role: 'Proprietor', org: 'The Beeper King \u2014 Beeper Sales & Service', email: 'dennis@beeperking.biz', slot: 4, vip: false },
    { id: 'mike', name: 'Mike L', role: 'Principal Assistant', org: 'Office of the Chairman', email: 'm.l@kellettholdings.com', slot: 2, vip: false, internal: true, assistant: true },
    { id: 'homer', name: 'Homer Simpson', role: 'Safety Inspector, Sector 7-G', org: 'Springfield Nuclear Power', email: 'h.simpson@spnc.com', slot: 3, vip: false },
    { id: 'peter', name: 'Peter Griffin', role: 'Son-in-law', org: 'Pewterschmidt Industries', email: 'p.griffin@pewterschmidt.com', slot: 1, vip: false },
    { id: 'jarvis', name: 'Jack Jarvis', role: 'Proprietor', org: 'Jarvis & McDade, Craiglang', email: 'jack@craiglang.co.uk', slot: 6, vip: false },
    { id: 'desanta', name: 'Michael De Santa', role: 'Executive Producer', org: 'De Santa Entertainment', email: 'm.desanta@desanta.com', slot: 7, vip: true },
    { id: 'cropper', name: 'Roy Cropper', role: 'Proprietor', org: "Roy's Rolls, Weatherfield", email: 'roy@roysrolls.co.uk', slot: 4, vip: false },
    { id: 'drax', name: 'Hugo Drax', role: 'Group Chairman', org: 'Drax Aerospace Industries', email: 'h.drax@draxaero.com', slot: 7, vip: true },
    { id: 'sterling', name: 'Dr. Evelyn Sterling', role: 'Chief Risk Officer', org: 'Kellett Holdings', email: 'e.sterling@kellettholdings.com', slot: 0, vip: false, internal: true },
    { id: 'tarquin', name: 'Sir Tarquin Fitzwilliam-Smythe', role: 'Non-Executive Chairman', org: 'Kellett Holdings', email: 't.fitzwilliam-smythe@kellettholdings.com', slot: 6, vip: true, internal: true },
    { id: 'tnet', name: 'Imogen Hartley-Rowe', role: 'Chief Executive', org: 'Telecom Networks PLC', email: 'i.hartley-rowe@telecomnetworks.co.uk', slot: 3, vip: true },
    { id: 'okonjo', name: 'Adaeze Okonjo', role: 'Group Head of Corporate Finance', org: 'Kellett Holdings', email: 'a.okonjo@kellettholdings.com', slot: 2, vip: false, internal: true },
    { id: 'vasquez', name: 'Renée Vasquez', role: 'Managing Director, Capital Markets', org: 'Meridian Partners', email: 'r.vasquez@meridianpartners.com', slot: 4, vip: false },
    { id: 'brenda', name: 'Brenda Cutlass', role: 'Accounts Payable', org: 'Kellett Holdings', email: 'b.cutlass@kellettholdings.com', slot: 5, vip: false, internal: true },
    { id: 'dave', name: 'Dave (IT)', role: 'Infrastructure & Support', org: 'Kellett Holdings', email: 'it.helpdesk@kellettholdings.com', slot: 3, vip: false, internal: true },
    { id: 'bannister', name: 'Clive Bannister', role: 'Proprietor', org: 'Bannister Plant & Aggregates', email: 'clive@bannisterplant.co.uk', slot: 1, vip: false },
    { id: 'custodian', name: 'Northbank Custody', role: 'Automated Settlement Notice', org: 'Northbank Custody Services', email: 'noreply@northbankcustody.com', slot: 0, vip: false, system: true }
  ];

  var byId = {};
  PEOPLE.forEach(function (p) {
    p.initials = KH.fmt.initials(p.name);
    p.color = KH.charts.seriesColor(p.slot);
    byId[p.id] = p;
  });

  KH.people = {
    all: PEOPLE,
    get: function (id) { return byId[id] || { id: id, name: id, role: '', org: '', initials: '??', color: 'var(--s1)' }; }
  };
})(window.KH);

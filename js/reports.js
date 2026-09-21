/* ============================================================
   Board papers.

   Every "export" in the workspace comes through here and produces
   a real PDF you can open, print or send. Nothing is decorative.
   ============================================================ */

(function (KH) {
  'use strict';

  var fmt = KH.fmt;

  function stamp() {
    var g = KH.game.get();
    return 'Week ' + g.clock.week + ', year ' + g.clock.year + ' · ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function principal() {
    var p = KH.store.get('profile');
    return { name: p.name, role: p.title, org: p.company || 'Kellett Holdings' };
  }

  function doc(title, subtitle) {
    var who = principal();
    return KH.pdf.create({ title: title, subtitle: subtitle || stamp(), org: who.org });
  }

  function filename(base) {
    var g = KH.game.get();
    return base.replace(/[^\w-]+/g, '_') + '_Y' + g.clock.year + 'W' + g.clock.week + '.pdf';
  }

  function pct(n) { return (n >= 0 ? '+' : '') + n.toFixed(1) + '%'; }

  /* ---------- 1. Group position ---------- */

  function groupPosition() {
    var g = KH.game.get();
    var who = principal();
    var w = KH.sim.netWorth();
    var p = KH.market.portfolio();
    var d = doc('Group Position Report');

    d.title('Group Position Report', who.org + ' · ' + stamp());
    d.kv([
      ['Net worth', fmt.money(w.total, 0)],
      ['Settled cash', fmt.money(w.cash, 0)],
      ['Listed equity', fmt.money(w.equity, 0)],
      ['State debt', fmt.money(w.debt, 0)]
    ], 4);
    d.kv([
      ['Asset register', fmt.money(w.register, 0)],
      ['Property book', fmt.money(w.property, 0)],
      ['Credit rating', KH.sim.creditRating().grade],
      ['Peak net worth', fmt.money(g.stats.peakNetWorth, 0)]
    ], 4);

    d.heading('Standing');
    d.kv([
      ['Reputation', Math.round(g.standing.reputation) + ' / 100'],
      ['Regulatory scrutiny', Math.round(g.standing.scrutiny) + ' / 100'],
      ['Credit assessment', KH.sim.creditRating().note],
      ['Weeks in post', String(g.stats.weeksRun)]
    ], 4);

    if (p.positions.length) {
      d.heading('Shareholdings');
      d.table([
        { label: 'Code', width: 0.10, bold: true },
        { label: 'Company', width: 0.34 },
        { label: 'Shares', width: 0.14, align: 'right' },
        { label: 'Holding', width: 0.10, align: 'right' },
        { label: 'Value', width: 0.16, align: 'right' },
        { label: 'Unrealised', width: 0.16, align: 'right' }
      ], p.positions.map(function (r) {
        return [r.sym, r.name, fmt.group(r.qty, 0), (r.own * 100).toFixed(1) + '%',
          fmt.money(r.value, 0), fmt.signed(r.pnl, 0) + ' (' + pct(r.pnlPct) + ')'];
      }));
    }

    if (g.props.length) {
      d.heading('Property');
      d.table([
        { label: 'Address', width: 0.42 },
        { label: 'Type', width: 0.22 },
        { label: 'Condition', width: 0.12, align: 'right' },
        { label: 'Rent p.w.', width: 0.12, align: 'right' },
        { label: 'Valuation', width: 0.12, align: 'right' }
      ], g.props.map(function (r) {
        return [r.address, r.type, Math.round(r.condition) + '/100',
          r.tenanted ? fmt.money(r.rent, 0) : 'Void', fmt.money(r.value, 0)];
      }));
    }

    d.heading('Commentary');
    d.para('The group net position stands at ' + fmt.money(w.total, 0) + ', against a peak of ' +
      fmt.money(g.stats.peakNetWorth, 0) + '. ' +
      (w.debt > 0 ? 'State support of ' + fmt.money(w.debt, 0) + ' remains outstanding and carries the associated oversight conditions. '
                  : 'The group carries no state debt. ') +
      'Reputation stands at ' + Math.round(g.standing.reputation) + ' and regulatory scrutiny at ' +
      Math.round(g.standing.scrutiny) + '.');
    d.note('Unaudited. Prepared on a basis consistent with prior periods. Valuations are marked to the prevailing quote.');
    d.signature(who.name, who.role);
    d.save(filename('Group_Position'));
    return d;
  }

  /* ---------- 2. Board pack for one company ---------- */

  function boardPack(sym) {
    var inst = KH.market.get(sym);
    var g = KH.game.get();
    var corp = g.corps[sym];
    var who = principal();
    var d = doc('Board Pack — ' + inst.name);

    d.title(inst.name, sym + ' · ' + inst.sector + ' · ' + stamp());

    var own = KH.sim.ownership(sym);
    var e = KH.sim.earningsOf(inst);
    d.kv([
      ['Quoted price', fmt.group(inst.px, 2) + 'p'],
      ['Market capitalisation', fmt.moneyShort((inst.px / 100) * inst.shares)],
      ['Your holding', (own * 100).toFixed(1) + '%'],
      ['Position value', fmt.money(corp ? (inst.px / 100) * corp.shares : 0, 0)]
    ], 4);
    d.kv([
      ['Revenue (annualised)', fmt.moneyShort(inst.f.revenue * inst.f.demand)],
      ['Operating margin', (inst.f.margin * 100).toFixed(1) + '%'],
      ['Earnings', fmt.moneyShort(e)],
      ['Fair value', fmt.group(KH.sim.fairPrice(inst), 2) + 'p']
    ], 4);

    d.heading('Condition');
    var score = KH.sim.turnaroundScore(sym);
    d.kv([
      ['Turnaround score', score + ' / 100'],
      ['Assessment', KH.sim.turnaroundLabel(score)],
      ['Risk rating', inst.f.risk.toFixed(1) + ' / 5'],
      ['Workforce morale', Math.round(inst.f.morale) + ' / 100']
    ], 4);

    if (corp && KH.sim.controls(sym)) {
      d.heading('Management');
      var exec = corp.ceo ? KH.sim.execName(corp.ceo) : 'No chief executive in post';
      d.kv([
        ['Strategy', KH.sim.strategy(corp.strategy).label],
        ['Chief executive', exec],
        ['Senior appointments', String(corp.staff.length)],
        ['Live campaigns', String(corp.campaigns.length)]
      ], 4);

      if (corp.ranges.length) {
        d.heading('Product ranges');
        d.table([
          { label: 'Range', width: 0.46 },
          { label: 'Price index', width: 0.18, align: 'right' },
          { label: 'Specification', width: 0.18, align: 'right' },
          { label: 'Mix', width: 0.18, align: 'right' }
        ], corp.ranges.map(function (r) {
          return [r.label, String(r.price), String(r.quality), (r.share * 100).toFixed(0) + '%'];
        }));
      }

      if (corp.staff.length) {
        d.heading('Senior team');
        d.table([
          { label: 'Name', width: 0.34, bold: true },
          { label: 'Role', width: 0.34 },
          { label: 'Capability', width: 0.16, align: 'right' },
          { label: 'Salary', width: 0.16, align: 'right' }
        ], corp.staff.map(function (p) {
          return [p.name, p.role, (p.skill * 100).toFixed(0) + '/100', fmt.money(p.salary, 0)];
        }));
      }

      if (corp.suspicion > 20) {
        d.heading('Matters requiring attention');
        d.para('Internal controls at this company are showing strain. The suspicion index stands at ' +
          Math.round(corp.suspicion) + ' out of 100. The board is advised to consider a forensic audit ' +
          'before the matter is raised by somebody else.');
      }
    }

    d.heading('Commentary');
    d.para(inst.cursed
      ? 'No credible path to profitability has been identified. Every intervention modelled returns to the same place within a single quarter. The board is advised that this company cannot be turned around and that further investment would be an act of faith rather than of commerce.'
      : 'On present trajectory the company is valued at ' + fmt.group(KH.sim.fairPrice(inst), 2) +
        'p against a quoted price of ' + fmt.group(inst.px, 2) + 'p. ' +
        (KH.sim.fairPrice(inst) > inst.px ? 'The market has yet to reflect the improvement.' : 'The quote is running ahead of the fundamentals.'));
    d.note('Prepared for internal use. Not for onward distribution.');
    d.signature(who.name, who.role);
    d.save(filename('Board_Pack_' + sym));
    return d;
  }

  /* ---------- 3. Property schedule ---------- */

  function propertySchedule() {
    var g = KH.game.get();
    var who = principal();
    var d = doc('Property Schedule');
    d.title('Property Schedule', who.org + ' · ' + stamp());

    var value = KH.util.sum(g.props, function (p) { return p.value; });
    var rent = KH.util.sum(g.props, function (p) { return p.tenanted ? p.rent : 0; });
    var paid = KH.util.sum(g.props, function (p) { return p.paid; });
    d.kv([
      ['Properties held', String(g.props.length)],
      ['Book valuation', fmt.money(value, 0)],
      ['Weekly rent roll', fmt.money(rent, 0)],
      ['Gross yield', value ? ((rent * 52 / value) * 100).toFixed(2) + '%' : '—']
    ], 4);

    if (!g.props.length) {
      d.heading('Schedule');
      d.para('No property is held at the date of this schedule.');
    } else {
      d.heading('Schedule of properties');
      d.table([
        { label: 'Address', width: 0.34 },
        { label: 'Type', width: 0.18 },
        { label: 'Acquired', width: 0.10, align: 'right' },
        { label: 'Cost', width: 0.13, align: 'right' },
        { label: 'Valuation', width: 0.13, align: 'right' },
        { label: 'Rent p.w.', width: 0.12, align: 'right' }
      ], g.props.map(function (p) {
        return [p.address, p.type, 'W' + p.boughtWeek, fmt.money(p.paid, 0), fmt.money(p.value, 0),
          p.tenanted ? fmt.money(p.rent, 0) : 'Void'];
      }));

      var live = [];
      g.props.forEach(function (p) {
        p.works.forEach(function (w) {
          live.push([p.address, w.label, w.builder, w.weeksLeft + ' wks', fmt.money(w.total, 0), fmt.money(w.total - w.paid, 0)]);
        });
      });
      if (live.length) {
        d.heading('Works in progress');
        d.table([
          { label: 'Property', width: 0.28 },
          { label: 'Works', width: 0.22 },
          { label: 'Contractor', width: 0.22 },
          { label: 'Remaining', width: 0.10, align: 'right' },
          { label: 'Contract', width: 0.09, align: 'right' },
          { label: 'Unpaid', width: 0.09, align: 'right' }
        ], live);
      }
    }
    d.note('Valuations are the group’s own and are not a formal RICS opinion.');
    d.signature(who.name, who.role);
    d.save(filename('Property_Schedule'));
    return d;
  }

  /* ---------- 4. Ledger ---------- */

  function ledger(limit) {
    var g = KH.game.get();
    var who = principal();
    var rows = g.ledger.slice(0, limit || 80);
    var d = doc('Transaction Ledger');
    d.title('Transaction Ledger', who.org + ' · ' + stamp());
    d.kv([
      ['Entries shown', String(rows.length)],
      ['Closing cash', fmt.money(g.treasury.cash, 0)],
      ['Opening capital', fmt.money(g.treasury.opening, 0)],
      ['State debt', fmt.money(g.treasury.debt, 0)]
    ], 4);
    d.heading('Entries, most recent first');
    d.table([
      { label: 'Period', width: 0.12 },
      { label: 'Category', width: 0.16 },
      { label: 'Narrative', width: 0.52 },
      { label: 'Amount', width: 0.20, align: 'right' }
    ], rows.map(function (r) {
      return ['Y' + r.year + ' W' + r.week, r.kind, r.text, fmt.signed(r.amount, 0)];
    }));
    d.note('Extracted from the group ledger. Figures are as posted and have not been audited.');
    d.signature(who.name, who.role);
    d.save(filename('Ledger'));
    return d;
  }

  /* ---------- 5. A message, as a formal letter ---------- */

  function letter(message) {
    var who = principal();
    var from = message.from === 'self' ? null : KH.people.get(message.from);
    var d = doc('Correspondence — ' + message.subject);
    d.title(message.subject, (from ? from.name + ', ' + from.org : who.name) + ' · ' + fmt.stamp(message.when));
    if (message.tags && message.tags.length) d.note(message.tags.join(' · '));
    message.body.forEach(function (para) { d.para(para); });
    if (message.sign) {
      d.spacer(6);
      message.sign.split('\n').forEach(function (l) { d.note(l); });
    }
    if (message.attachments && message.attachments.length) {
      d.heading('Enclosures');
      d.table([{ label: 'File', width: 0.7 }, { label: 'Size', width: 0.3, align: 'right' }],
        message.attachments.map(function (a) { return [a.name, a.size]; }));
    }
    d.save(filename('Letter_' + message.id));
    return d;
  }

  /* ---------- 6. Market sheet ---------- */

  function marketSheet() {
    var who = principal();
    var d = doc('Market Sheet');
    d.title('Market Sheet', 'Kellett Global Exchange · ' + stamp());
    var rows = KH.market.book().slice().sort(function (a, b) {
      return (b.px / 100) * b.shares - (a.px / 100) * a.shares;
    });
    d.table([
      { label: 'Code', width: 0.09, bold: true },
      { label: 'Company', width: 0.30 },
      { label: 'Sector', width: 0.21 },
      { label: 'Last', width: 0.11, align: 'right' },
      { label: 'Change', width: 0.10, align: 'right' },
      { label: 'Cap', width: 0.10, align: 'right' },
      { label: 'Score', width: 0.09, align: 'right' }
    ], rows.map(function (i) {
      return [i.sym, i.name, i.sector, fmt.group(i.px, 2) + 'p',
        pct(KH.market.change(i).pct), fmt.moneyShort((i.px / 100) * i.shares),
        String(KH.sim.turnaroundScore(i.sym))];
    }));
    d.note('Score is the group’s own assessment of how straightforward a turnaround would be, on a scale of one hundred.');
    d.signature(who.name, who.role);
    d.save(filename('Market_Sheet'));
    return d;
  }

  KH.reports = {
    groupPosition: groupPosition, boardPack: boardPack, propertySchedule: propertySchedule,
    ledger: ledger, letter: letter, marketSheet: marketSheet
  };
})(window.KH);

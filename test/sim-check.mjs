/* Simulation checks: the economy, operations, the assistant and the PDFs.
   Needs Playwright and a Chromium build:  npx playwright install chromium
   Run with:  node test/sim-check.mjs [index.html|dist/KellettHoldings.html] */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APP = 'file://' + resolve(ROOT, process.argv[2] || 'index.html');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
const problems = [];
page.on('console', m => { if (m.type() === 'error') problems.push(`[error] ${m.text()}`); });
page.on('pageerror', e => problems.push(`[pageerror] ${e.message}`));

let failures = 0;
const ok = (label, cond, extra = '') => {
  if (!cond) failures += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  — ' + extra : ''}`);
};

await page.goto(APP);
await page.waitForSelector('#splash[hidden]', { state: 'attached', timeout: 20000 });
await page.waitForTimeout(700);
// Start from a clean game and plenty of capital so every path is reachable.
await page.evaluate(() => {
  KH.clock.setPace('paused');
  KH.game.reset();
  KH.app.applyWealth(15000000, true);
  KH.game.get().treasury.cash = 40000000;
  KH.app.refreshAll();
});

/* ---------- Economy ---------- */
const fund = await page.evaluate(() => {
  const i = KH.market.get('TNET');
  return { rev: i.f.revenue, margin: i.f.margin, fair: KH.sim.fairPrice(i), px: i.px, score: KH.sim.turnaroundScore('TNET') };
});
ok('Fundamentals are seeded', fund.rev > 0 && isFinite(fund.fair), `rev ${Math.round(fund.rev)}, fair ${fund.fair.toFixed(1)}p vs ${fund.px.toFixed(1)}p`);
ok('Fair value is near the quote at the start', Math.abs(fund.fair - fund.px) / fund.px < 0.45, `${fund.fair.toFixed(0)} vs ${fund.px.toFixed(0)}`);
ok('Turnaround score is scored', fund.score > 0 && fund.score <= 100, `TNET ${fund.score}`);
ok('JimmyVision is unfixable by design', await page.evaluate(() => KH.sim.turnaroundScore('JVIS') === 0 && KH.market.get('JVIS').f.margin < 0));

/* ---------- Control ---------- */
const ctrl = await page.evaluate(() => {
  const need = KH.mike.costToControl('UWTX');
  const res = KH.market.deal('buy', 'UWTX', need.need);
  return { ok: res.ok, reason: res.reason, own: KH.sim.ownership('UWTX'), controls: KH.sim.controls('UWTX') };
});
ok('Buying past 50% takes control', ctrl.ok && ctrl.controls, ctrl.reason || `${(ctrl.own * 100).toFixed(1)}%`);

/* ---------- Operations ---------- */
ok('Strategy can be set on a controlled company', await page.evaluate(() => KH.sim.setStrategy('UWTX', 'turn').ok));
ok('Strategy is refused without control', await page.evaluate(() => KH.sim.setStrategy('GLBX', 'turn').ok === false));
const hired = await page.evaluate(() => {
  const c = KH.sim.candidates('fin');
  const res = KH.sim.hire('UWTX', c[0]);
  return { ok: res.ok, reason: res.reason, n: KH.game.get().corps.UWTX.staff.length };
});
ok('Staff can be appointed', hired.ok && hired.n === 1, hired.reason || '');
ok('Staff can be dismissed with a settlement', await page.evaluate(() => {
  const id = KH.game.get().corps.UWTX.staff[0].id;
  const before = KH.game.get().treasury.cash;
  const res = KH.sim.fire('UWTX', id);
  return res.ok && res.payoff > 0 && KH.game.get().treasury.cash < before;
}));
ok('Pricing changes stick', await page.evaluate(() => {
  KH.sim.setPrice('UWTX', 0, 140);
  return KH.game.get().corps.UWTX.ranges[0].price === 140;
}));
const camp = await page.evaluate(() => {
  const before = KH.game.get().treasury.cash;
  const res = KH.sim.launchCampaign('UWTX', 'press', 'Serious About The Ordinary.');
  return { ok: res.ok, spent: before - KH.game.get().treasury.cash, reason: res.reason };
});
ok('A campaign costs money and books', camp.ok && camp.spent > 0, camp.reason || `spent ${Math.round(camp.spent)}`);

/* ---------- Governance ---------- */
ok('A chief executive can be appointed', await page.evaluate(() => KH.sim.appointCeo('UWTX', 'burns').ok));
ok('The same executive cannot run two companies', await page.evaluate(() => {
  const roys = KH.market.get('ROYS');
  const afford = Math.floor((KH.game.get().treasury.cash * 0.3) / (roys.px / 100));
  const need = Math.ceil(roys.shares * 0.51);
  KH.market.deal('buy', 'ROYS', Math.min(afford, need));
  return KH.sim.appointCeo('ROYS', 'burns').ok === false;
}));
const theft = await page.evaluate(() => {
  const c = KH.game.get().corps.UWTX;
  c.stolen = 500000; c.suspicion = 70;
  const before = KH.game.get().treasury.cash;
  const res = KH.sim.audit('UWTX');
  return { found: res.found, recovered: res.recovered, ceoGone: !KH.game.get().corps.UWTX.ceo, gained: KH.game.get().treasury.cash > before - res.cost };
});
ok('An audit recovers money and removes the culprit', theft.found && theft.recovered > 0 && theft.ceoGone,
   `recovered ${theft.recovered}`);

/* ---------- The market responds to management ---------- */
const responds = await page.evaluate(() => {
  const inst = KH.market.get('UWTX');
  const before = KH.sim.fairPrice(inst);
  KH.sim.setStrategy('UWTX', 'premium');
  KH.sim.setPrice('UWTX', 0, 180);
  KH.sim.setPrice('UWTX', 1, 180);
  for (let i = 0; i < 12; i++) KH.clock.advance(true);
  return { before, after: KH.sim.fairPrice(inst), anchor: inst.anchor, px: inst.px };
});
ok('Management moves fair value', Math.abs(responds.after - responds.before) > 0.01,
   `${responds.before.toFixed(2)}p → ${responds.after.toFixed(2)}p`);
ok('The quoted price tracks the anchor', Math.abs(responds.px - responds.anchor) / responds.anchor < 0.35,
   `px ${responds.px.toFixed(1)} vs anchor ${responds.anchor.toFixed(1)}`);

/* ---------- Property ---------- */
const prop = await page.evaluate(() => {
  const listing = KH.simdata.propertyMarket.find(l => KH.sim.askingPrice(l) < KH.game.get().treasury.cash / 3);
  const buy = KH.sim.buyProperty(listing.id);
  const q = KH.sim.requestQuotes(listing.id, 'kitchen');
  const offers = KH.game.get().offers.filter(o => o.propId === listing.id);
  const accept = KH.sim.acceptQuote(offers.sort((a, b) => (b.quality * b.reliability) / b.price - (a.quality * a.reliability) / a.price)[0].id);
  const p = KH.game.get().props.find(x => x.id === listing.id);
  return { buy: buy.ok, quotes: offers.length, accept: accept.ok, works: p.works.length, void: !p.tenanted, id: listing.id, cond: p.condition, val: p.value };
});
ok('Property completes', prop.buy);
ok('Four builders quote', prop.quotes === 4, `${prop.quotes} quotes`);
ok('Works are instructed and void the property', prop.accept && prop.works === 1 && prop.void);
const finished = await page.evaluate((id) => {
  for (let i = 0; i < 60; i++) KH.clock.advance(true);
  const p = KH.game.get().props.find(x => x.id === id);
  return { works: p.works.length, cond: p.condition, val: p.value };
}, prop.id);
ok('Works complete and improve the asset', finished.works === 0 && finished.cond > prop.cond,
   `condition ${Math.round(prop.cond)} → ${Math.round(finished.cond)}`);

/* ---------- Credit rating ---------- */
const credit = await page.evaluate(() => {
  const clean = KH.sim.creditRating();
  KH.game.get().treasury.debt = KH.sim.netWorth().total * 0.8;
  const geared = KH.sim.creditRating();
  KH.game.get().treasury.debt = 0;
  return { clean, geared };
});
ok('A credit rating is graded', /^(AAA|AA|A|BBB|BB|B|CCC|D)$/.test(credit.clean.grade), credit.clean.grade + ' ' + credit.clean.score);
ok('Gearing downgrades the rating', credit.geared.score < credit.clean.score,
   `${credit.clean.score} \u2192 ${credit.geared.score}`);

/* ---------- The operating plan ---------- */
const plan = await page.evaluate(() => {
  const p = KH.flow.progress();
  return { total: p.total, done: p.done, next: p.stages.find(s => !s.done), issues: KH.flow.issues().length };
});
ok('The plan has stages and knows which are done', plan.total === 11 && plan.done > 0, `${plan.done}/${plan.total} done`);
ok('The plan names the next step and where to do it', !!plan.next && !!plan.next.panel, plan.next ? plan.next.label : 'all complete');
ok('Matters arising are computed', plan.issues >= 0, plan.issues + ' items');
ok('Completed stages stay completed', await page.evaluate(() => {
  const before = KH.flow.progress().done;
  const held = {};
  Object.keys(KH.game.get().corps).forEach(s => { held[s] = KH.game.get().corps[s].shares; KH.game.get().corps[s].shares = 0; });
  const after = KH.flow.progress().done;
  Object.keys(held).forEach(s => { KH.game.get().corps[s].shares = held[s]; });
  return after >= before;
}));

/* ---------- The bailout floor ---------- */
const bail = await page.evaluate(() => {
  KH.game.get().treasury.cash = -500000;
  const offer = KH.sim.bailoutOffer();
  KH.sim.takeBailout();
  const g = KH.game.get();
  return { cash: g.treasury.cash, debt: g.treasury.debt, rep: g.standing.reputation, offer: offer.amount };
});
ok('State support clears the overdraft', bail.cash > 0 && bail.debt > 0, `cash ${Math.round(bail.cash)}, debt ${Math.round(bail.debt)}`);
ok('Repaying the facility works', await page.evaluate(() => {
  const g = KH.game.get();
  g.treasury.cash = g.treasury.debt + 1000;
  const res = KH.sim.repayDebt(g.treasury.debt);
  return res.ok && KH.game.get().treasury.debt === 0;
}));

/* ---------- Mike: advice ---------- */
const mike = await page.evaluate(() => ({
  brief: KH.mike.ask('how are we doing'),
  typo: KH.mike.ask('whats the best propery to renovait'),
  control: KH.mike.ask('how do i take over glbx'),
  fraud: KH.mike.ask('is anyone embezelling'),
  apple: KH.mike.ask('should we buy an iphone for every employee'),
  berry: KH.mike.ask('what did you think of the blackberry bold'),
  berryMany: Array.from({ length: 12 }, () => KH.mike.ask('tell me about blackberry')).every(t => !/^No\./.test(t)),
  storm: KH.mike.ask('tell me about the storm'),
  china: KH.mike.ask('should we outsource manufacturing to china'),
  unknown: KH.mike.ask('wibble wobble flange')
}));
ok('Mike gives a real briefing', /Week \d+/.test(mike.brief) && mike.brief.length > 200);
ok('Mike tolerates typos', /renovat|works|condition/i.test(mike.typo), mike.typo.slice(0, 70));
ok('Mike prices control exactly', /shares/.test(mike.control) && /%/.test(mike.control));
ok('Mike answers on governance', /suspicion|audit|flagged/i.test(mike.fraud));
ok('Mike loses his temper about Apple', /^No\./.test(mike.apple) && /glass/i.test(mike.apple));
ok('Mike lights up about BlackBerry', /keyboard|battery|compression|BBM|encryption|secure/i.test(mike.berry) && mike.berryMany);
ok('The Storm still stings', /ready|returns|door|glass/i.test(mike.storm));
ok('Mike refuses to recommend offshoring', /build it here|outsourc|offshor/i.test(mike.china) && /will not/i.test(mike.china));
ok('Mike falls back gracefully', mike.unknown.length > 80);

/* ---------- Mike: acting as a PA ---------- */
const pa = await page.evaluate(() => {
  const g = KH.game.get();
  g.treasury.cash = 30000000;
  const out = {};
  out.buy = KH.mike.ask('buy £400k of GLBX');
  out.ownGLBX = KH.sim.ownership('GLBX');
  out.week = KH.mike.ask('advance 2 weeks');
  out.weekNo = KH.game.get().clock.week;
  out.hire = KH.mike.ask('hire a compliance officer at UWTX');
  out.staff = KH.game.get().corps.UWTX.staff.length;
  out.ceo = KH.mike.ask('appoint a chief executive at UWTX');
  out.hasCeo = !!KH.game.get().corps.UWTX.ceo;
  out.strat = KH.mike.ask('switch UWTX to aggressive expansion');
  out.stratId = KH.game.get().corps.UWTX.strategy;
  KH.market.deal('buy', 'DNJI', 20000);
  out.sell = KH.mike.ask('sell all DNJI');
  out.holdsDnji = (KH.game.get().corps.DNJI || {}).shares || 0;
  out.pause = KH.mike.ask('pause time');
  out.paced = KH.clock.pace();
  out.grumble = KH.mike.ask('switch UWTX to cost leadership');
  return out;
});
ok('PA: buys by cash amount', /Bought/.test(pa.buy) && pa.ownGLBX > 0, `${(pa.ownGLBX * 100).toFixed(2)}% GLBX`);
ok('PA: advances the clock', /Advanced 2 weeks/.test(pa.week));
ok('PA: hires into the named company', /Appointed/.test(pa.hire) && pa.staff >= 1);
ok('PA: appoints a chief executive', pa.hasCeo && /chief executive/i.test(pa.ceo));
ok('PA: sets strategy', pa.stratId === 'expand', pa.stratId);
ok('PA: sells a whole line', /Sold/.test(pa.sell) && pa.holdsDnji === 0, pa.sell.slice(0, 60));
ok('PA: controls time', pa.paced === 'paused');
ok('PA: obeys but objects to cost-cutting', /on the record/i.test(pa.grumble));

/* ---------- Jimmy ---------- */
const jimmy = await page.evaluate(() => {
  // Every configured opener, so the check does not drift when one is added.
  const ten = Array.from({ length: 24 }, () => KH.jimmy.ask('what should I do with my cash'));
  return {
    open: ten[0],
    allOpen: ten.every(t => KH.simdata.jimmyOpeners.some(o => t.startsWith(o))),
    nowThen: ten.some(t => /^Now then/.test(t)),
    jvis: KH.jimmy.ask('is jimmyvision a good investment'),
    nudge: KH.jimmy.nudge()
  };
});
ok('Jimmy always opens in character', jimmy.allOpen, jimmy.open.slice(0, 44));
ok('Jimmy reaches for "now then"', jimmy.nowThen);
ok('Jimmy quotes live figures', /£[\d,]/.test(jimmy.open) || /£[\d,]/.test(jimmy.jvis));
ok('Jimmy pushes JimmyVision', /JimmyVision|JVIS/i.test(jimmy.jvis));
ok('Jimmy has unprompted opinions', jimmy.nudge.length > 20);

/* ---------- PDFs ---------- */
const pdfs = await page.evaluate(async () => {
  const sizes = {};
  for (const [name, fn] of Object.entries({
    position: () => KH.reports.groupPosition(),
    board: () => KH.reports.boardPack('UWTX'),
    property: () => KH.reports.propertySchedule(),
    ledger: () => KH.reports.ledger(60),
    market: () => KH.reports.marketSheet()
  })) {
    const doc = fn();
    const blob = doc.blob();
    const buf = new Uint8Array(await blob.arrayBuffer());
    const head = String.fromCharCode(...buf.slice(0, 8));
    const tail = String.fromCharCode(...buf.slice(-6));
    sizes[name] = { bytes: buf.length, head, eof: tail.includes('%%EOF') };
  }
  return sizes;
});
Object.entries(pdfs).forEach(([name, r]) => {
  ok(`PDF: ${name} is a valid document`, r.head === '%PDF-1.4' && r.eof && r.bytes > 1200, `${(r.bytes / 1024).toFixed(1)} KB`);
});

/* ---------- Persistence ---------- */
await page.evaluate(() => KH.game.flush());
const saved = await page.evaluate(() => ({ json: KH.game.exportSave().length, week: KH.game.get().clock.week }));
await page.reload();
await page.waitForSelector('#splash[hidden]', { state: 'attached', timeout: 20000 });
await page.waitForTimeout(500);
const reloaded = await page.evaluate(() => ({
  week: KH.game.get().clock.week,
  corps: Object.keys(KH.game.get().corps).length,
  props: KH.game.get().props.length
}));
ok('The game survives a reload', reloaded.week === saved.week && reloaded.corps > 0 && reloaded.props > 0,
   `week ${reloaded.week}, ${reloaded.corps} holdings, ${reloaded.props} properties`);
ok('The save exports as readable JSON', saved.json > 1000, `${(saved.json / 1024).toFixed(1)} KB`);
ok('Import round-trips', await page.evaluate(() => {
  const text = KH.game.exportSave();
  return KH.game.importSave(text).ok && KH.game.importSave('not json').ok === false;
}));

console.log('\nConsole errors:', problems.length ? '\n' + problems.join('\n') : '(none)');
await browser.close();
if (failures || problems.length) {
  console.error(`\n${failures} check(s) failed, ${problems.length} console error(s).`);
  process.exit(1);
}
console.log('\nAll simulation checks passed.');

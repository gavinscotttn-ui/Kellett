/* Walks the workspace and writes a screenshot of every view, in both
   themes, to test/shots/.  Needs Playwright and a Chromium build:
     npx playwright install chromium
   Run with:  node test/screenshots.mjs [index.html|dist/KellettHoldings.html] */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = 'file://' + resolve(HERE, '..', process.argv[2] || 'index.html');
const OUT = resolve(HERE, 'shots');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
const problems = [];
page.on('console', m => { if (m.type() === 'error') problems.push(`[error] ${m.text()}`); });
page.on('pageerror', e => problems.push(`[pageerror] ${e.message}`));

await page.goto(APP);
await page.waitForSelector('#splash[hidden]', { state: 'attached', timeout: 20000 });
await page.waitForTimeout(800);

/* Seed a group worth photographing: a controlled company with a team and a
   chief executive, a couple of minority stakes, a renovated building and a
   few toys, then let a season run so the charts have something in them. */
await page.evaluate(() => {
  KH.clock.setPace('paused');
  KH.game.reset();
  KH.app.applyWealth(15000000, true);
  const g = KH.game.get();
  g.treasury.cash = 60000000;

  const lead = 'UWTX';
  KH.market.deal('buy', lead, Math.ceil(KH.market.get(lead).shares * 0.54));
  KH.sim.setStrategy(lead, 'turn');
  KH.sim.appointCeo(lead, 'connor');
  ['ops', 'sales', 'fin', 'comp'].forEach(r => KH.sim.hire(lead, KH.sim.candidates(r).sort((a, b) => b.skill - a.skill)[0]));
  KH.sim.launchCampaign(lead, 'press', 'Quietly Everywhere.');
  KH.sim.setPrice(lead, 0, 128);
  KH.sim.setQuality(lead, 0, 72);

  KH.market.deal('buy', 'TNET', Math.ceil(KH.market.get('TNET').shares * 0.18));
  KH.market.deal('buy', 'CVTN', Math.ceil(KH.market.get('CVTN').shares * 0.06));
  KH.market.deal('buy', 'JVIS', Math.ceil(KH.market.get('JVIS').shares * 0.04));

  KH.sim.buyProperty('p-coro');
  KH.sim.buyProperty('p-navid');
  KH.sim.buyProperty('p-rovers');
  KH.sim.requestQuotes('p-rovers', 'kitchen');
  const offers = KH.game.get().offers.filter(o => o.propId === 'p-rovers');
  KH.sim.acceptQuote(offers.sort((a, b) => (b.quality * b.reliability) / b.price - (a.quality * a.reliability) / a.price)[0].id);

  ['l-watch2', 'l-car1', 'l-wine', 'l-club'].forEach(id => KH.sim.buyLifestyle(id));

  for (let i = 0; i < 34; i++) KH.clock.advance(true);
  g.treasury.cash = Math.max(g.treasury.cash, 4200000);
  KH.app.refreshAll();
});
await page.waitForTimeout(900);

async function shot(name) { await page.screenshot({ path: `${OUT}/${name}.png` }); }

const views = [
  ['overview', '01-command'], ['empire', '02-empire'], ['property', '03-property'],
  ['markets', '04-markets'], ['lifestyle', '05-wealth'], ['assets', '06-register'],
  ['mail', '07-mail'], ['messages', '08-messaging'], ['advisor', '09-advisory'], ['settings', '10-settings']
];
for (const [tab, name] of views) {
  await page.click(`#tab-${tab}`);
  await page.waitForTimeout(950);
  await shot(name);
}

/* Empire, deeper in */
await page.click('#tab-empire'); await page.waitForTimeout(600);
await page.evaluate(() => KH.views.empire.select('UWTX'));
await page.waitForTimeout(400);
for (const [label, name] of [['Strategy', '11-strategy'], ['People', '12-people'], ['Ranges & pricing', '13-pricing'], ['Governance', '14-governance']]) {
  await page.click(`.tabbtn:has-text("${label}")`);
  await page.waitForTimeout(650);
  await shot(name);
}

/* Mike actually working */
await page.click('#tab-messages'); await page.waitForTimeout(500);
await page.evaluate(() => KH.views.messages.open('mike'));
await page.waitForTimeout(400);
await page.fill('.composer textarea', 'how are we doing');
await page.click('.composer .btn.primary');
await page.waitForTimeout(3200);
await shot('15-mike');
await page.fill('.composer textarea', 'should we outsource manufacturing to china');
await page.click('.composer .btn.primary');
await page.waitForTimeout(3600);
await shot('16-mike-china');

/* The Treasury arriving */
await page.evaluate(() => { KH.game.get().treasury.cash = -800000; KH.app.offerBailout(KH.sim.bailoutOffer()); });
await page.waitForTimeout(700);
await shot('17-bailout');
await page.click('.modal-actions .btn:not(.primary)');
await page.waitForTimeout(400);

/* Light theme */
await page.evaluate(() => { KH.game.get().treasury.cash = 4200000; KH.store.set('appearance', { theme: 'light' }); KH.app.applyAppearance(); KH.app.refreshAll(); });
for (const [tab, name] of [['overview', '18-light-command'], ['empire', '19-light-empire'], ['property', '20-light-property'], ['markets', '21-light-markets']]) {
  await page.click(`#tab-${tab}`);
  await page.waitForTimeout(950);
  await shot(name);
}

/* Narrow */
await page.setViewportSize({ width: 1100, height: 800 });
await page.evaluate(() => { KH.store.set('appearance', { theme: 'dark' }); KH.app.applyAppearance(); });
await page.click('#tab-overview'); await page.waitForTimeout(900); await shot('22-narrow');

console.log('Console problems:', problems.length ? '\n' + problems.join('\n') : '(none)');
await browser.close();

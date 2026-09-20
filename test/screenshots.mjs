/* Walks the workspace and writes a screenshot of every view, in both
   themes, to test/shots/.  Needs Playwright and a Chromium build:
     npx playwright install chromium
   Run with:  node test/screenshots.mjs                                  */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const TARGET = process.argv[2] || 'index.html';
const APP = 'file://' + resolve(HERE, '..', TARGET);
const OUT = resolve(HERE, 'shots');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 950 }, deviceScaleFactor: 1 });

const problems = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => problems.push(`[pageerror] ${e.message}\n${(e.stack||'').split('\n').slice(0,4).join('\n')}`));

await page.goto(APP);
await page.waitForSelector('#splash[hidden]', { state: 'attached', timeout: 15000 }).catch(() => problems.push('[timeout] splash never finished'));
await page.waitForTimeout(1200);

async function shot(name) { await page.screenshot({ path: `${OUT}/${name}.png` }); }

await shot('01-overview');

for (const [tab, name] of [['mail','02-mail'],['messages','03-messages'],['assets','04-assets'],['markets','05-markets'],['settings','06-settings']]) {
  await page.click(`#tab-${tab}`);
  await page.waitForTimeout(900);
  await shot(name);
}

// Trade a line, then check the blotter picked it up.
await page.click('#tab-markets');
await page.waitForTimeout(500);
const cashBefore = await page.evaluate(() => KH.store.get('trading').cash);
await page.click('button.btn.buy');
await page.waitForTimeout(600);
const after = await page.evaluate(() => ({ cash: KH.store.get('trading').cash, pos: KH.store.get('trading').positions, blot: KH.store.get('trading').blotter.length }));
console.log('TRADE: cash', cashBefore, '->', after.cash, 'positions', JSON.stringify(after.pos), 'blotter', after.blot);
await shot('07-markets-after-trade');

// Light theme
await page.evaluate(() => { KH.store.set('appearance', { theme: 'light' }); KH.app.applyAppearance(); KH.app.refreshAll(); });
await page.waitForTimeout(700);
await page.click('#tab-overview'); await page.waitForTimeout(800); await shot('08-light-overview');
await page.click('#tab-assets'); await page.waitForTimeout(900); await shot('09-light-assets');
await page.click('#tab-mail'); await page.waitForTimeout(700); await shot('10-light-mail');

// Messaging: send one and wait for the reply.
await page.evaluate(() => { KH.store.set('appearance', { theme: 'dark' }); KH.app.applyAppearance(); });
await page.click('#tab-messages'); await page.waitForTimeout(600);
await page.fill('.composer textarea', 'Proceed on that basis.');
await page.click('.composer .btn.primary');
await page.waitForTimeout(4200);
const bubbles = await page.locator('.bubble').count();
console.log('BUBBLES after send+reply:', bubbles);
await shot('11-messages-reply');

// Lock screen
await page.click('#win-close'); await page.waitForTimeout(600); await shot('12-lock');
await page.click('#btn-unlock'); await page.waitForTimeout(400);

// Settings rename -> identity must follow
await page.click('#tab-settings'); await page.waitForTimeout(600);
await page.fill('.settings-wrap input[aria-label="Display name"]', 'Sir Reginald Fanshaw-Bennett');
await page.waitForTimeout(500);
const idName = await page.textContent('#id-name');
const lockName = await page.textContent('#lock-name');
console.log('IDENTITY:', JSON.stringify(idName), '| lock:', JSON.stringify(lockName));
await shot('13-settings');

// Narrow viewport
await page.setViewportSize({ width: 1024, height: 760 });
await page.click('#tab-overview'); await page.waitForTimeout(900); await shot('14-narrow');

console.log('\n=== CONSOLE PROBLEMS ===');
console.log(problems.length ? problems.join('\n---\n') : '(none)');

await browser.close();

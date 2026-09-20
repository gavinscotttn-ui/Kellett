/* Behavioural checks for the workspace.
   Needs Playwright and a Chromium build:  npx playwright install chromium
   Run with:  node test/ui-check.mjs                                        */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/* Point at the bundle with:  node test/ui-check.mjs dist/KellettHoldings.html */
const TARGET = process.argv[2] || 'index.html';
const APP = 'file://' + resolve(ROOT, TARGET);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 } });
const page = await ctx.newPage();
const problems = [];
page.on('console', m => { if (m.type() === 'error') problems.push(`[error] ${m.text()}`); });
page.on('pageerror', e => problems.push(`[pageerror] ${e.message}`));

let failures = 0;
const ok = (label, cond, extra = '') => {
  if (!cond) failures += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  \u2014 ' + extra : ''}`);
};

await page.goto(APP);
await page.waitForSelector('#splash[hidden]', { state: 'attached', timeout: 15000 });
await page.waitForTimeout(500);

// --- Keyboard navigation ---
await page.keyboard.press('Control+4');
await page.waitForTimeout(400);
ok('Ctrl+4 opens Assets', await page.getAttribute('#tab-assets', 'aria-selected') === 'true');
await page.keyboard.press('Control+1');
await page.waitForTimeout(300);
ok('Ctrl+1 returns to Overview', await page.getAttribute('#tab-overview', 'aria-selected') === 'true');
await page.focus('#tab-overview');
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(300);
ok('ArrowDown moves to Correspondence', await page.getAttribute('#tab-mail', 'aria-selected') === 'true');

// --- Ctrl+L locks ---
await page.keyboard.press('Control+l');
await page.waitForTimeout(400);
ok('Ctrl+L locks the workstation', !(await page.getAttribute('#lock', 'hidden') !== null));
await page.click('#btn-unlock'); await page.waitForTimeout(300);

// --- Rail / maximise ---
await page.click('#btn-rail'); await page.waitForTimeout(300);
ok('Rail collapses the nav', await page.evaluate(() => document.body.classList.contains('rail')));
ok('Rail shows the square mark only', await page.evaluate(() => getComputedStyle(document.querySelector('.sidebar-brand .full')).display === 'none'
  && getComputedStyle(document.querySelector('.sidebar-brand .mark')).display !== 'none'));
await page.click('#btn-rail'); await page.waitForTimeout(250);
await page.click('#win-max'); await page.waitForTimeout(250);
ok('Maximise removes the window inset', await page.evaluate(() => document.querySelector('.shell').getBoundingClientRect().top === 0));
await page.click('#win-max'); await page.waitForTimeout(250);

// --- Order rejections ---
await page.click('#tab-markets'); await page.waitForTimeout(600);
const sellNothing = await page.evaluate(() => KH.market.deal('sell', 'NRTH', 500));
ok('Selling stock you do not hold is refused', sellNothing.ok === false, sellNothing.reason);
const tooBig = await page.evaluate(() => KH.market.deal('buy', 'QNTA', 99999999));
ok('An order beyond the ticket limit is refused', tooBig.ok === false, tooBig.reason);
const noCash = await page.evaluate(() => KH.market.deal('buy', 'QNTA', 9000000));
ok('An order beyond settled cash is refused', noCash.ok === false, noCash.reason);
const zero = await page.evaluate(() => KH.market.deal('buy', 'QNTA', 0));
ok('A zero-share order is refused', zero.ok === false, zero.reason);
const junk = await page.evaluate(() => KH.market.deal('buy', 'QNTA', 'twelve'));
ok('A non-numeric quantity is refused', junk.ok === false, junk.reason);

// --- Round trip: buy then sell everything ---
const trip = await page.evaluate(() => {
  const before = KH.store.get('trading').cash;
  const b = KH.market.deal('buy', 'STRL', 2000);
  const held = KH.store.get('trading').positions.STRL.qty;
  const s = KH.market.deal('sell', 'STRL', held);
  const after = KH.store.get('trading').cash;
  return { ok: b.ok && s.ok, before, after, stillHeld: !!KH.store.get('trading').positions.STRL };
});
ok('Buy then sell closes the line', trip.ok && trip.stillHeld === false);
ok('A round trip costs money (dealing costs)', trip.after < trip.before,
   `${trip.before.toFixed(2)} -> ${trip.after.toFixed(2)}`);

// --- The group capitalisation dial ---
const wealth = await page.evaluate(() => {
  KH.app.applyWealth(15000, true);
  const low = { register: KH.assets.total(), cash: KH.store.get('trading').cash };
  KH.app.applyWealth(15000000, true);
  const high = { register: KH.assets.total(), cash: KH.store.get('trading').cash };
  return { low, high, stored: KH.store.get('workspace').netWorth };
});
ok('The dial rescales the asset register', wealth.high.register > wealth.low.register * 900,
   `${Math.round(wealth.low.register)} -> ${Math.round(wealth.high.register)}`);
ok('The dial moves the dealing account with it', wealth.high.cash > wealth.low.cash * 900,
   `${wealth.low.cash.toFixed(0)} -> ${wealth.high.cash.toFixed(0)}`);
ok('The dial clamps to its range', await page.evaluate(() => {
  KH.app.applyWealth(999999999, true);
  const over = KH.store.get('workspace').netWorth;
  KH.app.applyWealth(-5, true);
  const under = KH.store.get('workspace').netWorth;
  KH.app.applyWealth(15000000, true);
  return over === 15000000 && under === 15000;
}));

// --- Sounds ---
const snd = await page.evaluate(() => {
  try {
    const before = KH.sound.enabled();
    KH.sound.play('trade'); KH.sound.play('nav'); KH.sound.play('startup');
    return { ok: true, enabled: before };
  } catch (e) { return { ok: false, err: String(e) }; }
});
ok('Sounds are on by default', snd.enabled === true);
ok('The sound engine plays without throwing', snd.ok === true, snd.err || '');
ok('Muting silences it', await page.evaluate(() => {
  KH.store.set('workspace', { sounds: false });
  const quiet = KH.sound.enabled() === false;
  KH.store.set('workspace', { sounds: true });
  return quiet;
}));

// --- Persistence across a reload ---
await page.evaluate(() => { KH.store.set('profile', { name: 'Marjorie Pemberton-Wicks' }); KH.store.set('appearance', { accent: 'emerald' }); KH.store.flush(); });
await page.reload();
await page.waitForSelector('#splash[hidden]', { state: 'attached', timeout: 15000 });
await page.waitForTimeout(400);
ok('Identity survives a reload', (await page.textContent('#id-name')) === 'Marjorie Pemberton-Wicks');
ok('Accent survives a reload', (await page.getAttribute('html', 'data-accent')) === 'emerald');
ok('Blotter survives a reload', (await page.evaluate(() => KH.store.get('trading').blotter.length)) >= 2);
ok('Capitalisation survives a reload', (await page.evaluate(() => KH.store.get('workspace').netWorth)) === 15000000);

// --- Currency switch ---
await page.evaluate(() => { KH.store.set('workspace', { currency: 'USD' }); KH.fmt.setCurrency('USD'); KH.app.refreshAll(); });
await page.waitForTimeout(400);
ok('Currency switch reaches the sidebar figure', (await page.textContent('#mini-net')).includes('$'));
await page.evaluate(() => { KH.store.set('workspace', { currency: 'GBP' }); KH.fmt.setCurrency('GBP'); KH.app.refreshAll(); });

// --- Search ---
await page.fill('#global-search', 'monkey tennis');
await page.keyboard.press('Enter');
await page.waitForTimeout(600);
ok('Global search finds correspondence', (await page.textContent('.reader-head h2')).toLowerCase().includes('monkey tennis'));

// --- XSS: a hostile display name stays text ---
const xss = await page.evaluate(() => {
  KH.store.set('profile', { name: '<img src=x onerror="window.__pwned=1">Bob' });
  KH.app.refreshAll();
  const el = document.querySelector('#id-name');
  return { pwned: !!window.__pwned, imgs: el.querySelectorAll('img').length, text: el.textContent };
});
ok('A hostile display name is rendered as text', !xss.pwned && xss.imgs === 0, JSON.stringify(xss.text));

// --- Reduced effects ---
await page.evaluate(() => { KH.store.set('profile', { name: 'Gavin Scott' }); KH.store.set('appearance', { effects: false, motion: false }); KH.app.applyAppearance(); });
await page.waitForTimeout(300);
ok('Reduced effects drops the backdrop filter', await page.evaluate(() => getComputedStyle(document.querySelector('.shell')).backdropFilter === 'none'));

// --- Deleting mail updates the count ---
const del = await page.evaluate(() => {
  const before = KH.views.mail.badge();
  const m = KH.mail.messages.find(x => x.folder === 'inbox' && KH.app.isUnread(x));
  KH.app.deleteMessage(m);
  return { before, after: KH.views.mail.badge() };
});
ok('Deleting an unread item lowers the badge', del.after === del.before - 1, `${del.before} -> ${del.after}`);

// --- No network was ever attempted ---
let requests = [];
page.on('request', r => { if (!r.url().startsWith('file://')) requests.push(r.url()); });
await page.reload();
await page.waitForTimeout(3500);
ok('No non-file requests are made', requests.length === 0, requests.join(', '));

console.log('\nConsole errors:', problems.length ? '\n' + problems.join('\n') : '(none)');
await browser.close();

if (failures || problems.length) {
  console.error(`\n${failures} check(s) failed, ${problems.length} console error(s).`);
  process.exit(1);
}
console.log('\nAll checks passed.');

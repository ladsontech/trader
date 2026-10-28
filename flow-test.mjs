// Clicks through Plan → Pay → Broker → Dashboard in the preview build (mock backend).
// Run: npx vite build --config vite.preview.config.ts --outDir ../preview-dist && node flow-test.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('preview-dist');
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let file = path.join(dist, url.pathname);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
  const type = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(file)] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  res.end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(4401, r));

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
fs.mkdirSync('shots', { recursive: true });
let n = 0;
const step = (s) => console.log(`${++n}. ${s}`);

try {
  await page.goto('http://127.0.0.1:4401/?screen=flow');
  await page.waitForURL('**/subscribe');
  await page.getByText('Choose your plan').waitFor();
  step('Signed-in, unpaid user lands on Choose your plan (step 2), no menu');
  if (await page.getByText('Trades', { exact: true }).count()) throw new Error('nav visible during setup');

  await page.getByRole('button', { name: /Standard/ }).first().click();
  await page.getByText('UGX 50,000').last().waitFor();
  await page.getByRole('button', { name: 'Send payment request' }).click();
  await page.getByText('Check your phone').waitFor();
  await page.screenshot({ path: 'shots/flow-1-waiting.png', fullPage: true });
  step('Send payment request → "Check your phone"');
  const calls = await page.evaluate(() => window.__calls);
  if (calls[0][1] !== 'standard') throw new Error('wrong plan sent: ' + calls[0][1]);
  step('Chosen plan (standard) sent to the server');

  await page.getByText('Payment received').waitFor({ timeout: 25000 });
  await page.screenshot({ path: 'shots/flow-2-paid.png', fullPage: true });
  step('Payment confirmed by the server → "Payment received"');

  await page.getByRole('link', { name: 'Connect my broker' }).click();
  await page.waitForURL('**/broker');
  await page.getByText('Connect your broker').waitFor();
  step('Step 3: Connect your broker');

  await page.locator('input').nth(0).fill('81234567');
  await page.locator('input[type=password]').fill('wrong');
  await page.locator('input').nth(2).fill('Exness-MT5Trial9');
  await page.getByRole('button', { name: /Connect Exness account/ }).click();
  await page.getByText(/rejected these credentials/).waitFor();
  step('Wrong password shows a clear error');

  await page.locator('input[type=password]').fill('Right#Pass1');
  await page.getByRole('button', { name: /Connect Exness account/ }).click();
  await page.getByText('Broker connection').waitFor({ timeout: 10000 });
  step('Correct details → broker connected, full menu appears');
  await page.getByRole('link', { name: 'Dashboard' }).first().click();
  await page.getByText('Bot is running on Exness').waitFor();
  await page.screenshot({ path: 'shots/flow-3-dashboard.png', fullPage: true });
  step('Step 4: Dashboard — bot running, balance and open trades');
} catch (e) {
  console.error('FAILED:', e.message);
  await page.screenshot({ path: 'shots/flow-failure.png', fullPage: true });
  process.exitCode = 1;
}
console.log('Errors:', errors.length ? errors : 'none');
await browser.close();
server.close();

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
  // ── Sign-up form ──
  await page.goto('http://127.0.0.1:4401/?screen=auth');
  await page.getByText('Start auto-trading').waitFor();
  if (!(await page.getByText('+256', { exact: true }).isVisible())) throw new Error('default code is not +256');
  if (await page.getByRole('button', { name: /Kenya/ }).count()) throw new Error('country buttons still shown');
  step('Sign-up opens with +256 (Uganda) as the default code, no country buttons');
  await page.getByLabel('Country').selectOption('254');
  await page.getByText('+254', { exact: true }).waitFor();
  step('Country picker switches the code to +254');
  await page.getByLabel('Country').selectOption({ label: '🌍 Other country — type code' });
  await page.getByLabel('Country code').fill('233');
  await page.locator('#auth-phone').fill('12');
  await page.locator('#auth-password').fill('secret1');
  await page.locator('#auth-submit').click();
  await page.getByText('Enter a valid phone number.').waitFor();
  step('Other country: code typed by hand (+233), short number rejected');
  await page.locator('#auth-phone').fill('+254 712 345 678');
  await page.getByText('+254', { exact: true }).waitFor();
  if ((await page.locator('#auth-phone').inputValue()) !== '712345678') throw new Error('pasted code not split');
  step('Pasting "+254 712…" moves the code into the picker');
  await page.screenshot({ path: 'shots/flow-0-signup.png', fullPage: true });

  await page.goto('http://127.0.0.1:4401/?screen=flow');
  await page.waitForURL('**/subscribe');
  await page.getByText('Choose your plan').waitFor();
  step('Signed-in, unpaid user lands on Choose your plan (step 2), no menu');
  if (await page.getByText('Trades', { exact: true }).count()) throw new Error('nav visible during setup');

  await page.getByRole('radio', { name: /Standard/ }).click();
  await page.getByText('UGX 50,000').last().waitFor();
  await page.getByRole('button', { name: 'Send payment request' }).click();
  await page.getByText('Waiting for your PIN').waitFor();
  await page.screenshot({ path: 'shots/flow-1-waiting.png', fullPage: true });
  step('Send payment request → "Waiting for your PIN"');
  const calls = await page.evaluate(() => window.__calls);
  if (calls[0][1] !== 'standard') throw new Error('wrong plan sent: ' + calls[0][1]);
  step('Chosen plan (standard) sent to the server');

  await page.getByRole('button', { name: 'Cancel payment' }).click();
  await page.getByText('Payment cancelled').waitFor();
  step('Cancel payment → back to plan screen with "Payment cancelled"');

  await page.getByRole('button', { name: 'Send payment request' }).click();
  await page.getByText('Waiting for your PIN').waitFor();
  step('Pay again → "Waiting for your PIN"');

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

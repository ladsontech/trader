import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('preview-dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let file = path.join(dist, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(4400, r));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const screens = ['auth', 'onboarding', 'subscribe', 'dashboard', 'trades', 'broker', 'settings'];
fs.mkdirSync('shots', { recursive: true });

for (const [name, size] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  for (const screen of screens) {
    await page.goto(`http://127.0.0.1:4400/?screen=${screen}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    await page.screenshot({ path: `shots/${name}-${screen}.png`, fullPage: true });
  }
  await ctx.close();
}
await browser.close();
server.close();
console.log('done');

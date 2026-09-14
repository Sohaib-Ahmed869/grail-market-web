const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  await page.goto('http://localhost:3000/admin/login', { waitUntil: 'networkidle' });
  await page.waitForSelector('.gm-login-aside .gm-mock', { timeout: 10000 });

  const logoCount = await page.locator('.gm-login-aside img').count();

  const asideBox = await page.locator('.gm-login-aside').boundingBox();
  const mockBox = await page.locator('.gm-login-aside .gm-mock').boundingBox();
  const pagerBox = await page.locator('.gm-login-aside .gm-mock-pager').boundingBox();

  await page.screenshot({ path: 'C:/Users/bushr/AppData/Local/Temp/verify/01-initial-1440.png' });

  const shots = [];
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(3000);
    const introVisible = await page.locator('.gm-mock-intro.is-on').count();
    const railBox = await page.locator('.gm-mock-rail').boundingBox();
    const path = `C:/Users/bushr/AppData/Local/Temp/verify/loop-${i}.png`;
    await page.screenshot({ path });
    shots.push({ i, introVisible, railWidth: railBox ? railBox.width : null, path });
  }

  const overflow1440 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  await page.setViewportSize({ width: 390, height: 900 });
  await page.waitForTimeout(500);
  const overflow390 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await page.screenshot({ path: 'C:/Users/bushr/AppData/Local/Temp/verify/02-mobile-390.png' });

  console.log(JSON.stringify({
    logoCount, asideBox, mockBox, pagerBox, shots, overflow1440, overflow390, consoleErrors
  }, null, 2));

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });

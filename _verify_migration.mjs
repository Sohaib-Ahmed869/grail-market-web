import { chromium } from "playwright";
import fs from "node:fs";

const TOKEN = "u_P-4yEMW_c-EU.1791961194327.zNzbhdXnZDzEb-su_zey4uOlbDOwQ97N6oUcC-fh3y4";
const OUT = "C:\\Users\\bushr\\Documents\\Grail-Market\\grail-market-web\\_verify_out";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: false });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript((t) => localStorage.setItem("gm-admin-token", t), TOKEN);
const page = await ctx.newPage();

const results = [];

async function overflow() {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function buttonInfo(sel) {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      text: el.textContent?.trim().slice(0, 40),
      height: Math.round(r.height),
      width: Math.round(r.width),
      radius: cs.borderRadius,
      bg: cs.backgroundImage !== "none" ? "gradient/image" : cs.backgroundColor,
      borderColor: cs.borderColor,
    };
  }, sel);
}

// ---- 1. login ----
await page.goto("http://localhost:3000/admin/login", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector("#gm-login-email", { timeout: 45000 });
await page.fill("#gm-login-email", "test@example.com");
await page.fill("#gm-login-password", "hunter2test");
await page.click(".gm-login-reveal");
const revealed = await page.inputValue("#gm-login-password").catch(() => null);
const pwType = await page.getAttribute("#gm-login-password", "type");
await page.screenshot({ path: `${OUT}\\1-login.png` });
results.push({
  page: "login",
  overflow: await overflow(),
  emailBtn: await buttonInfo("#gm-login-email"),
  pwBtn: await buttonInfo("#gm-login-password"),
  loginBtn: await buttonInfo(".gm-login-go"),
  revealWorked: pwType === "text",
});

// ---- 2. thresholds ----
await page.goto("http://localhost:3000/admin/thresholds", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector("h2", { timeout: 30000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}\\2-thresholds.png` });
const editThresholdsBtn = await page.locator("button:has-text('Edit thresholds')").first();
let modalInfo = null;
if (await editThresholdsBtn.count()) {
  await editThresholdsBtn.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}\\2b-thresholds-modal.png` });
  modalInfo = {
    input: await buttonInfo("#th-grail-floor"),
    doneBtn: await buttonInfo(".gm-dialog button:has-text('Done')"),
  };
  await page.keyboard.press("Escape").catch(() => {});
}
results.push({
  page: "thresholds",
  overflow: await overflow(),
  discardBtn: await buttonInfo("button:has-text('Discard')"),
  saveBtn: await buttonInfo("button:has-text('Save')"),
  modalInfo,
});

// ---- 3. policy ----
await page.goto("http://localhost:3000/admin/policy", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector("h2", { timeout: 30000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}\\3-policy.png` });
const editPolicyBtn = await page.locator("button:has-text('Edit policy')").first();
let policyModalInfo = null;
if (await editPolicyBtn.count()) {
  await editPolicyBtn.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}\\3b-policy-modal.png` });
  policyModalInfo = { doneBtn: await buttonInfo(".gm-dialog button:has-text('Done')") };
  await page.keyboard.press("Escape").catch(() => {});
}
results.push({ page: "policy", overflow: await overflow(), policyModalInfo });

// ---- 4. dashboard ----
await page.goto("http://localhost:3000/admin", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}\\4-dashboard.png` });
results.push({ page: "dashboard", overflow: await overflow() });

// ---- 5. members ----
await page.goto("http://localhost:3000/admin/members?scope=market", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}\\5-members.png` });
const msgBtn = await page.locator("button:has-text('Message')").first();
let composeInfo = null;
if (await msgBtn.count()) {
  await msgBtn.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}\\5b-members-compose.png` });
  composeInfo = {
    sendBtn: await buttonInfo(".gm-dialog button:has-text('Send')"),
    cancelBtn: await buttonInfo(".gm-dialog button:has-text('Cancel')"),
    subjectField: await buttonInfo("#gm-subject"),
    bodyField: await buttonInfo("#gm-body"),
  };
  await page.keyboard.press("Escape").catch(() => {});
}
results.push({ page: "members", overflow: await overflow(), composeInfo });

// ---- 6. listings ----
await page.goto("http://localhost:3000/admin/listings", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}\\6-listings.png` });
const rowIconBtn = await buttonInfo(".gm-rowact .gm-btn--icon, .gm-rowact button");
results.push({
  page: "listings",
  overflow: await overflow(),
  exportBtn: await buttonInfo("button:has-text('Export')"),
  rowIconBtn,
});

fs.writeFileSync(`${OUT}\\results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));

await browser.close();

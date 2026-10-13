import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const url = process.env.TEST_URL || "http://127.0.0.1:4318/";
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--enable-webgl", "--use-gl=angle", "--use-angle=metal"],
});
await fs.mkdir("artifacts", { recursive: true });
const errors = [];
let checks = 0;
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
page.on("pageerror", (e) => errors.push(e.message));
async function setRange(id, value) {
  await page.locator("#" + id).fill(String(value));
}
try {
  await page.goto(url);
  await page.waitForFunction(() => window.irisLab?.ready);
  checks++;
  await page.screenshot({ path: "artifacts/desktop.png", fullPage: true });
  assert.equal(await page.evaluate(() => window.irisLab.irisCount), 9);
  checks++;
  const before = await page.evaluate(() => window.irisLab.joints);
  await setRange("zoom", 1);
  const zoom = await page.evaluate(() => window.irisLab.joints);
  assert.ok(
    Math.abs(zoom.g1.position[0] - before.g1.position[0] - 0.006) < 1e-6,
  );
  assert.deepEqual(zoom.g3.position, before.g3.position);
  checks++;
  await setRange("focus", 1);
  assert.notDeepEqual(
    await page.evaluate(() => window.irisLab.joints.g3.position),
    before.g3.position,
  );
  checks++;
  await setRange("aperture", 0.8);
  assert.match(await page.locator("#aperture-value").textContent(), /ƒ\//);
  checks++;
  await page.getByRole("button", { name: "X-ray", exact: true }).click();
  await setRange("explode", 0.65);
  await page.screenshot({ path: "artifacts/exploded.png", fullPage: true });
  const shared = page.url(),
    saved = await page.evaluate(() => window.irisLab.state);
  await page.reload();
  await page.waitForFunction(() => window.irisLab.ready);
  assert.deepEqual(await page.evaluate(() => window.irisLab.state), saved);
  checks++;
  await page.getByRole("button", { name: "Wireframe", exact: true }).click();
  assert.equal(await page.evaluate(() => window.irisLab.state.mode), "wire");
  checks++;
  await page.locator('[data-part="iris"]').click();
  assert.equal(await page.evaluate(() => window.irisLab.state.view), "front");
  checks++;
  await page.getByRole("button", { name: "Reset ↺" }).click();
  const after = await page.evaluate(() => window.irisLab.joints);
  assert.deepEqual(before, after);
  checks++;
  await page.getByRole("button", { name: "Portrait", exact: true }).click();
  assert.equal(await page.evaluate(() => window.irisLab.state.zoom), 0.78);
  checks++;
  await page.locator("#tour").click();
  await page.waitForTimeout(400);
  assert.match(await page.locator("#tour").textContent(), /Pause/);
  await setRange("zoom", 0.5);
  assert.match(await page.locator("#tour").textContent(), /Play/);
  checks++;
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#snapshot").click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "iris-camera.png");
  checks++;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Reset ↺" }).click();
  await page.screenshot({ path: "artifacts/mobile.png", fullPage: true });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  checks++;
  await page.locator("#zoom").focus();
  await page.keyboard.press("ArrowRight");
  assert.ok((await page.evaluate(() => window.irisLab.state.zoom)) > 0);
  checks++;
  assert.deepEqual(errors, []);
  checks++;
  console.log(
    JSON.stringify(
      { checksPassed: checks, errors, sharedStateURL: shared },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}

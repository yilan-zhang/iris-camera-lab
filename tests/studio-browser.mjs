import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const url = process.env.TEST_URL || "http://127.0.0.1:4318/";
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--use-gl=angle", "--use-angle=metal"],
});
await fs.mkdir("artifacts", { recursive: true });
const errors = [];
let checks = 0;
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on("pageerror", (e) => errors.push(e.message));
const ready = (id) =>
  page.waitForFunction(
    (id) => window.irisStudio?.ready && window.irisStudio.asset === id,
    id,
  );
const state = () => page.evaluate(() => window.irisStudio.config);
try {
  await page.goto(url);
  await ready("camera");
  assert.equal(await page.locator("[data-asset]").count(), 3);
  assert.equal((await state()).channels.length, 6);
  checks++;
  await page.screenshot({ path: "artifacts/studio.png", fullPage: true });
  for (const id of ["bicycle", "gripper"]) {
    await page.locator(`[data-asset="${id}"]`).click();
    await ready(id);
    assert.equal((await state()).channels.length, 3);
    await page.locator("#channel-0").fill("0.9");
    assert.equal((await state()).channels[0].value, 0.9);
    await page.screenshot({ path: `artifacts/${id}.png`, fullPage: true });
    checks++;
  }
  await page.locator("#search").fill("Left jaw");
  await page.locator(".tree-node").click();
  await page.locator("#motion-name").fill("Custom finger travel");
  await page.locator("#motion-max").fill("0.5");
  await page.locator("#motion-form button[type=submit]").click();
  assert.equal((await state()).channels[0].max, 0.5);
  await page.locator("#channel-0").fill("0.8");
  checks++;
  await page.locator("#motion-min").fill("3");
  await page.locator("#motion-form button[type=submit]").click();
  assert.match(await page.locator("#form-error").textContent(), /limits/);
  assert.equal((await state()).channels[0].max, 0.5);
  checks++;
  await page.locator("#project-name").fill("Saved gripper test");
  await page.locator("#save-project").click();
  await page.locator("#saved-projects button").first().waitFor();
  const saved = await state();
  await page.reload();
  await ready("camera");
  await page
    .locator("#saved-projects button")
    .filter({ hasText: "Saved gripper test" })
    .click();
  await ready("gripper");
  assert.deepEqual(await state(), saved);
  checks++;
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export-config").click();
  const d = await downloadPromise;
  await d.saveAs("artifacts/recipe.json");
  await page.locator("#reset").click();
  await page.locator("#config-file").setInputFiles("artifacts/recipe.json");
  await page.waitForFunction(
    () => window.irisStudio.config.channels[0].value === 0.8,
  );
  checks++;
  await page.locator('[data-asset="bicycle"]').click();
  await ready("bicycle");
  await page.locator("#config-file").setInputFiles("artifacts/recipe.json");
  await page.waitForFunction(() =>
    document.querySelector("#toast").textContent.includes("different model"),
  );
  assert.equal((await state()).channels[0].name, "Wheel rotation");
  checks++;
  await page.locator("#model-file").setInputFiles("public/models/camera.glb");
  await ready("imported");
  assert.equal((await state()).channels.length, 0);
  await page.locator("#search").fill("DOF_zoom");
  await page.locator(".tree-node").click();
  await page.locator("#motion-name").fill("Imported zoom");
  await page.locator("#motion-max").fill("55");
  await page.locator("#motion-form button[type=submit]").click();
  await page.locator("#channel-0").fill("0.6");
  assert.equal((await state()).channels.length, 1);
  checks++;
  await page.locator("#project-name").fill("Imported model saved");
  await page.locator("#save-project").click();
  await page
    .locator("#saved-projects button")
    .filter({ hasText: "Imported model saved" })
    .waitFor();
  await page.reload();
  await ready("camera");
  await page
    .locator("#saved-projects button")
    .filter({ hasText: "Imported model saved" })
    .click();
  await ready("imported");
  assert.equal((await state()).channels[0].value, 0.6);
  checks++;
  await page
    .locator("#model-file")
    .setInputFiles({
      name: "broken.glb",
      mimeType: "model/gltf-binary",
      buffer: Buffer.from("invalid"),
    });
  await page.waitForFunction(() =>
    document.querySelector("#toast").textContent.includes("valid binary"),
  );
  assert.equal((await state()).channels.length, 1);
  checks++;
  await page.locator("#play").click();
  await page.waitForTimeout(150);
  assert.match(await page.locator("#play").textContent(), /Pause/);
  await page.locator("#channel-0").fill("0.4");
  assert.match(await page.locator("#play").textContent(), /Play/);
  checks++;
  await page.locator("#search").fill("DOF_zoom");
  await page.locator(".tree-node").click();
  await page.locator("#remove-motion").click();
  assert.equal((await state()).channels.length, 0);
  checks++;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-asset="bicycle"]').click();
  await ready("bicycle");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({
    path: "artifacts/studio-mobile.png",
    fullPage: true,
  });
  await page.locator("#channel-0").focus();
  await page.keyboard.press("ArrowRight");
  assert.ok((await state()).channels[0].value > 0);
  checks++;
  assert.deepEqual(errors, []);
  checks++;
  console.log(JSON.stringify({ checksPassed: checks, pageErrors: errors }));
} finally {
  await browser.close();
}

import { chromium } from "playwright";

const url = "http://127.0.0.1:50010/";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(url, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const d = document.getElementById("test-page-notice-dialog");
  if (d?.close) d.close();
});
await page.waitForSelector("#exhTrack .exh-card", { timeout: 15000 });
await page.locator("#exhibition").scrollIntoViewIfNeeded();

const init = await page.evaluate(() => ({
  prevDisabled: document.querySelector(".exh-prev")?.disabled,
  nextDisabled: document.querySelector(".exh-next")?.disabled,
  cardCount: document.querySelectorAll("#exhTrack .exh-card").length,
  dots: document.getElementById("exhDots"),
}));
console.log("INIT", init);

await page.click(".exh-next");
await page.waitForTimeout(600);
const afterNext = await page.evaluate(() => ({
  prevDisabled: document.querySelector(".exh-prev")?.disabled,
  nextDisabled: document.querySelector(".exh-next")?.disabled,
}));
console.log("AFTER NEXT", afterNext);

for (let i = 0; i < 20; i++) {
  const next = document.querySelector(".exh-next");
  if (next?.disabled) break;
  await page.click(".exh-next");
  await page.waitForTimeout(200);
}

const atEnd = await page.evaluate(() => ({
  prevDisabled: document.querySelector(".exh-prev")?.disabled,
  nextDisabled: document.querySelector(".exh-next")?.disabled,
}));
console.log("AT END", atEnd);

await browser.close();

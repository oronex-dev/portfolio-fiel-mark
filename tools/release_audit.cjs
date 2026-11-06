/* Additional release checks; runs locally and never submits a message. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const base =
  process.env.PORTFOLIO_URL || "http://127.0.0.1:4173/portfolio-fiel-mark/";
const output = path.resolve(
  process.env.QA_OUTPUT || ".test-results/release-final",
);
fs.mkdirSync(output, { recursive: true });
const records = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../assets/certificates.json")),
);
const result = {
  checks: [],
  performance: [],
  limitations:
    "Unthrottled localhost lab samples; not field Core Web Vitals or a production performance score.",
};
const pass = (name) => {
  result.checks.push({ name, passed: true });
  console.log("PASS", name);
};
let browser;
(async () => {
  browser = await chromium.launch({
    headless: true,
    timeout: 60000,
    ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {}),
  });
  const context = await browser.newContext({
    reducedMotion: "reduce",
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const errors = [];
  const failures = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.url().startsWith(base) && response.status() >= 400)
      failures.push({ url: response.url(), status: response.status() });
  });
  await page.goto(base, { waitUntil: "networkidle" });
  const cards = await page.locator(".certificate-card").evaluateAll((cards) =>
    cards.map((card) => ({
      title: card.querySelector("h3").textContent.replace(/\s+/g, " ").trim(),
      issuer: [...card.querySelectorAll(".certificate-issuer")]
        .at(-1)
        .textContent.trim(),
      date: card.querySelector("time").dateTime,
      image: card.querySelector("img").getAttribute("src"),
      pdf: card.querySelector("[data-pdf]").dataset.pdf,
      verify:
        card
          .querySelector(".certificate-links a[target]")
          ?.getAttribute("href") || null,
    })),
  );
  assert.equal(cards.length, 10);
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    assert.deepEqual(cards[i], {
      title: record.title,
      issuer: record.issuer,
      date: record.date,
      image: record.image,
      pdf: record.pdf,
      verify:
        record.verificationStatus === "unavailable" ? null : record.verify,
    });
  }
  pass(
    "All ten rendered certificate titles, issuers, dates, images, PDF and verification links match source records",
  );
  for (let i = 0; i < records.length; i++) {
    await page.locator(".certificate-links [data-document]").nth(i).click();
    await page.locator("dialog img").evaluate((image) => image.decode());
    assert.ok(
      (await page.locator("#document-open").getAttribute("href")).endsWith(
        records[i].pdf,
      ),
    );
    assert.ok(
      (await page.locator("#document-download").getAttribute("href")).endsWith(
        records[i].pdf,
      ),
    );
    await page.keyboard.press("Escape");
  }
  pass(
    "Every certificate lightbox loads its actual preview and opens/downloads the corresponding original PDF",
  );

  for (const [title, filename] of [
    ["Web Developer Resume", "Oronos_Resume_WebDev_Final.pdf"],
    ["Administrative Support Resume", "Oronos_Resume_AdminSupport_Final.pdf"],
  ]) {
    const card = page
      .locator(".resume-card")
      .filter({ has: page.getByRole("heading", { name: title.replace(" Resume", ""), exact: true }) });
    const preview = card.locator('a[data-kind="pdf"]');
    const downloadLink = card.locator("a[download]");
    const expectedPath = `assets/resumes/${filename}`;
    assert.ok((await preview.getAttribute("href")).endsWith(expectedPath));
    assert.equal(await downloadLink.getAttribute("download"), filename);
    await preview.click();
    assert.equal(await page.locator("#dialog-title").textContent(), title);
    assert.ok(
      await page
        .locator("dialog iframe")
        .evaluate((frame, path) => frame.src.endsWith("/" + path), expectedPath),
    );
    assert.ok(
      (await page.locator("#document-open").getAttribute("href")).endsWith(
        expectedPath,
      ),
    );
    await page.locator(".dialog-close").click();
    const downloadEvent = page.waitForEvent("download");
    await downloadLink.click();
    const file = await downloadEvent;
    assert.equal(file.suggestedFilename(), filename);
    assert.equal(
      fs.readFileSync(await file.path()).subarray(0, 5).toString(),
      "%PDF-",
    );
  }
  pass(
    "Both supplied role resumes preview the matching document and download valid PDF bytes under the expected names",
  );

  assert.equal(await page.locator('[data-title="Original general resume"]').count(), 0);
  assert.equal(await page.locator('a[download="RESUME-Oronos-Fiel.pdf"]').count(), 0);
  if (process.env.PORTFOLIO_EXPECT_EXCLUSIONS === "1") {
    const legacyResume = await page.request.get(
      new URL("RESUME-Oronos-Fiel.pdf", base).toString(),
    );
    assert.equal(legacyResume.status(), 404);
  }
  pass(
    "Legacy general resume with personal contact fields is absent from the public interface and excluded from the release build",
  );
  const seo = await page.evaluate(() => ({
    title: document.title,
    canonical: document.querySelector('link[rel="canonical"]').href,
    image: document.querySelector('meta[property="og:image"]').content,
    language: document.documentElement.lang,
    structured: JSON.parse(
      document.querySelector('script[type="application/ld+json"]').textContent,
    ),
  }));
  assert.equal(
    seo.canonical,
    "https://oronex-dev.github.io/portfolio-fiel-mark/",
  );
  assert.equal(seo.image, seo.canonical + "assets/images/social-preview.png");
  assert.equal(seo.language, "en");
  assert.equal(seo.structured["@type"], "Person");
  assert.equal(seo.structured.url, seo.canonical);
  assert.ok(seo.structured.sameAs.includes("https://www.linkedin.com/in/fielmarkoronos/"));
  const linkedIn = page.locator('.hero-socials a[aria-label="Visit my LinkedIn profile"]');
  assert.equal(await linkedIn.getAttribute("href"), "https://www.linkedin.com/in/fielmarkoronos/");
  assert.equal(await linkedIn.getAttribute("target"), "_blank");
  assert.equal(await linkedIn.getAttribute("rel"), "noopener noreferrer");
  const projects = await page.locator(".project-card h3").allTextContents();
  assert.deepEqual(projects, ["HiCOOL PH", "SBAA School Management Portal", "Mindful Journal", "Twogethera"]);
  const twogethera = page.locator('.project-card[data-project-id="twogethera"]');
  assert.equal(await twogethera.locator('.product-showcase-icon[src$="twogethera-icon.png"]').count(), 1);
  assert.equal(await twogethera.locator('.product-phone img[src$="twogethera-phone-design-preview.webp"]').count(), 1);
  assert.equal(await twogethera.locator('.product-showcase-capture[src$="twogethera-live-dashboard.webp"]').count(), 1);
  assert.equal(await page.locator('.project-card[data-project-id="portfolio"]').count(), 0);
  assert.equal(await page.locator("#twogethera-details").count(), 0);
  pass(
    "SEO and LinkedIn structured data are consistent; four project cards include Twogethera’s authentic icon and supplied app previews",
  );
  await page.goto(base);
  await page.keyboard.press("Tab");
  assert.ok(
    await page
      .locator(".skip-link")
      .evaluate((el) => el === document.activeElement),
  );
  await page.keyboard.press("Enter");
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "main-content",
  );
  pass("Keyboard skip link moves focus to main content");
  for (const width of [320, 375, 430]) {
    await page.setViewportSize({ width, height: 568 });
    await page.locator(".menu-toggle").click();
    const dimensions = await page
      .locator(".nav-panel")
      .evaluate((el) => ({
        top: el.getBoundingClientRect().top,
        bottom: el.getBoundingClientRect().bottom,
        viewport: innerHeight,
      }));
    assert.ok(dimensions.top >= 0 && dimensions.bottom <= dimensions.viewport);
    await page.keyboard.press("Escape");
  }
  pass(
    "Mobile navigation controls fit short 568px screens at 320, 375 and 430px widths",
  );
  const failedScript = await context.newPage();
  await failedScript.setViewportSize({ width: 375, height: 900 });
  await failedScript.route("**/script.js", (route) => route.abort());
  await failedScript.goto(base, { waitUntil: "networkidle" });
  assert.ok(
    await failedScript.locator('#nav-panel a[href="#experience"]').isVisible(),
  );
  await failedScript.close();
  pass(
    "If the enhancement script cannot load, full mobile navigation is restored",
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(failures, []);
  pass(
    "No local HTTP failures or JavaScript runtime errors in release scenarios",
  );
  for (const width of [1440, 768, 375]) {
    const lab = await context.newPage({ viewport: { width, height: 900 } });
    await lab.setViewportSize({ width, height: 900 });
    await lab.emulateMedia({ reducedMotion: "no-preference" });
    await lab.addInitScript(() => {
      window.lab = { lcp: null, cls: 0, longTasks: 0 };
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        window.lab.lcp = entries.at(-1).startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          if (!entry.hadRecentInput) window.lab.cls += entry.value;
      }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((list) => {
        window.lab.longTasks += list.getEntries().length;
      }).observe({ type: "longtask", buffered: true });
    });
    await lab.goto(base, { waitUntil: "networkidle" });
    await lab.waitForTimeout(1000);
    const metrics = await lab.evaluate(() => ({
      ...window.lab,
      domContentLoaded:
        performance.getEntriesByType("navigation")[0].domContentLoadedEventEnd,
      transferBytes: performance
        .getEntriesByType("resource")
        .reduce((n, r) => n + r.transferSize, 0),
      requests: performance.getEntriesByType("resource").length,
    }));
    assert.ok(
      metrics.cls < 0.05,
      `Unexpected ${width}px startup layout shift: ${metrics.cls}`,
    );
    result.performance.push({ width, ...metrics });
    await lab.close();
  }
  pass(
    "Collected local LCP, layout shift, long task and resource samples at desktop/tablet/mobile widths",
  );
  fs.writeFileSync(
    path.join(output, "release-audit.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result.performance));
  await browser.close();
})().catch(async (error) => {
  console.error(error);
  await browser?.close();
  process.exit(1);
});

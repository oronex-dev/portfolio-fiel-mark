/* Browser regression checks. No messages are sent: configured endpoints are intercepted.
   Run with a local server; see docs/IMPLEMENTATION.md for prerequisites. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const BASE =
  process.env.PORTFOLIO_URL || "http://127.0.0.1:4173/portfolio-fiel-mark/";
const OUTPUT = path.resolve(process.env.QA_OUTPUT || ".test-results");
fs.mkdirSync(OUTPUT, { recursive: true });
const results = [];
const check = (name, detail = "") => {
  results.push({ name, passed: true, detail });
  console.log("PASS", name, detail);
};
const TURNSTILE_MOCK = `(() => {
  let input;
  let options;
  let token = "";
  let resetCount = 0;
  window.turnstile = {
    render(container, settings) {
      options = settings;
      input = document.createElement("input");
      input.type = "hidden";
      input.name = "cf-turnstile-response";
      container.closest("form").append(input);
      const frame = document.createElement("div");
      frame.setAttribute("role", "group");
      frame.setAttribute("aria-label", "Mock Turnstile challenge");
      frame.textContent = "Mock Turnstile challenge";
      frame.style.cssText = "box-sizing:border-box;width:100%;height:65px;max-width:300px;border:1px solid #586886;border-radius:4px;padding:20px;color:#c5cee0";
      container.append(frame);
      window.__turnstileMock = {
        sitekey: settings.sitekey,
        solve(value) {
          token = value;
          input.value = value;
          options.callback(value);
        },
        expire() {
          token = "";
          input.value = "";
          options["expired-callback"]();
        },
        fail() {
          token = "";
          input.value = "";
          options["error-callback"]();
        },
        get resetCount() { return resetCount; },
      };
      return "mock-turnstile-widget";
    },
    getResponse() { return token; },
    reset() {
      token = "";
      if (input) input.value = "";
      resetCount++;
    },
  };
})();`;
let browser;
(async () => {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {}),
  });
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await context.route(
    /^https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit$/,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: TURNSTILE_MOCK,
      }),
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const response = await page.goto(BASE, { waitUntil: "networkidle" });
  assert.equal(response.status(), 200);
  check("GitHub Pages project subpath serves HTML");

  await page.setViewportSize({ width: 375, height: 812 });
  const actionTargetHeights = await page
    .locator(".button, .text-link, .project-card:not([data-project-id='twogethera']) .project-links a, .service-card a, .certificate-links a")
    .evaluateAll((links) => links.filter((link) => !link.closest("[hidden]") && link.getClientRects().length).map((link) => link.getBoundingClientRect().height));
  assert.ok(actionTargetHeights.every((height) => height >= 44), JSON.stringify(actionTargetHeights));
  const heroAction = page.locator(".hero .button").first();
  await heroAction.focus();
  assert.ok(await heroAction.evaluate((el) => el.matches(":focus-visible")));
  const focusStyle = await heroAction.evaluate((el) => getComputedStyle(el).outlineStyle);
  assert.equal(focusStyle, "solid");
  const footerCopySize = await page.locator(".site-footer p").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  assert.ok(footerCopySize >= 12, `footer copy is only ${footerCopySize}px`);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.mouse.move(2, 2);
  await heroAction.scrollIntoViewIfNeeded();
  await heroAction.hover();
  await page.waitForTimeout(420);
  assert.match(await heroAction.evaluate((el) => getComputedStyle(el).backgroundPosition), /^100%/);
  assert.equal(await heroAction.evaluate((el) => getComputedStyle(el, "::before").opacity), "1");
  assert.notEqual(await heroAction.evaluate((el) => getComputedStyle(el, "::before").content), "none");
  const sheen = await heroAction.evaluate((el) => ({
    overflow: getComputedStyle(el).overflow,
    clip: getComputedStyle(el, "::before").clipPath,
    gradient: getComputedStyle(el, "::before").backgroundImage,
  }));
  assert.equal(sheen.overflow, "hidden");
  assert.match(sheen.clip, /inset/);
  assert.match(sheen.gradient, /165, 131, 250/);
  assert.match(sheen.gradient, /80, 105, 237/);
  await page.mouse.move(2, 2);
  await page.waitForTimeout(420);
  assert.match(await heroAction.evaluate((el) => getComputedStyle(el).backgroundPosition), /^0%/);
  const actionBox = await heroAction.boundingBox();
  await page.mouse.move(actionBox.x + actionBox.width / 2, actionBox.y + actionBox.height / 2);
  await page.mouse.down();
  await page.waitForFunction(
    () =>
      getComputedStyle(document.querySelector(".hero .button")).transform ===
      "matrix(1, 0, 0, 1, 0, 0)",
  );
  assert.equal(await heroAction.evaluate((el) => getComputedStyle(el).transform), "matrix(1, 0, 0, 1, 0, 0)");
  await page.mouse.up();
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await heroAction.evaluate((el) => getComputedStyle(el).transitionDuration), "0s");
  assert.equal(await heroAction.evaluate((el) => getComputedStyle(el, "::before").display), "none");
  check("Readable footer, 44px action targets, visible keyboard focus, contained blue-violet sheen, smooth return, and reduced-motion support");

  for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(async () => {
      const images = [...document.images];
      images.forEach((img) => (img.loading = "eager"));
      await Promise.all(images.map((img) => img.decode().catch(() => {})));
    });
    const layout = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      broken: [...document.images]
        .filter((img) => !img.naturalWidth)
        .map((img) => img.src),
      overflow: [...document.querySelectorAll("main *")]
        .filter((el) => {
          if (el.closest('[hidden], [aria-hidden="true"]')) return false;
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1);
        })
        .map((el) => el.tagName + "." + el.className)
        .slice(0, 10),
    }));
    assert.ok(layout.scroll <= width, JSON.stringify(layout));
    assert.deepEqual(layout.overflow, [], JSON.stringify(layout));
    assert.deepEqual(layout.broken, []);
    await page.screenshot({
      path: path.join(OUTPUT, `layout-${width}.png`),
      fullPage: true,
    });
    check(`Responsive ${width}px`, "no overflow or broken images");
    if (width === 375 || width === 1440) {
      const { default: AxeBuilder } = require(
        process.env.AXE_MODULE || "@axe-core/playwright",
      );
      const scan = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      fs.writeFileSync(
        path.join(OUTPUT, `axe-${width}.json`),
        JSON.stringify(
          { violations: scan.violations, incomplete: scan.incomplete },
          null,
          2,
        ),
      );
      assert.deepEqual(
        scan.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        })),
        [],
      );
      check(
        `Automated WCAG 2.1 AA scan ${width}px`,
        "zero violations; manual checks still required",
      );
    }
  }
  const resources = await page.evaluate(() => [
    ...new Set(
      [
        ...document.querySelectorAll(
          'img[src],script[src],link[rel="stylesheet"],link[rel="icon"],a[download],a[data-document]',
        ),
      ]
        .map((el) => el.src || el.href)
        .filter(Boolean),
    ),
  ]);
  const localResources = resources.filter(
    (url) => new URL(url).origin === new URL(BASE).origin,
  );
  for (const url of localResources) {
    const r = await context.request.get(url);
    assert.equal(r.status(), 200, url);
  }
  check(
    "All referenced local images, scripts, CSS, and certificate PDFs return HTTP 200",
    String(localResources.length) + " local resources",
  );
  const brokenAnchors = await page.evaluate(() =>
    [...document.querySelectorAll('a[href^="#"]')]
      .map((a) => a.getAttribute("href"))
      .filter((href) => !document.getElementById(href.slice(1))),
  );
  assert.deepEqual(brokenAnchors, []);
  assert.equal(await page.locator("h1").count(), 1);
  check("Internal anchors and single page heading");
  assert.equal(
    await page.locator('a[href*="docs.google.com/spreadsheets"]').count(),
    0,
  );
  assert.equal(await page.locator('a[href*="Fiel-Mark15"]').count(), 0);
  check("Business sheet URLs and obsolete profile links absent");

  const linkedIn = page.locator(
    '.hero-socials a[aria-label="Visit my LinkedIn profile"]',
  );
  assert.equal(await linkedIn.getAttribute("href"), "https://www.linkedin.com/in/fielmarkoronos/");
  assert.equal(await linkedIn.getAttribute("target"), "_blank");
  assert.equal(await linkedIn.getAttribute("rel"), "noopener noreferrer");
  assert.equal(await linkedIn.locator("svg[aria-hidden='true']").count(), 1);
  const sameAs = await page.locator('script[type="application/ld+json"]').evaluate((el) => JSON.parse(el.textContent).sameAs);
  assert.ok(sameAs.includes("https://www.linkedin.com/in/fielmarkoronos/"));
  check("LinkedIn profile uses exact accessible new-tab URL and structured data");

  await page.locator('[data-project-filter="application"]').click();
  assert.equal(await page.locator(".project-card:visible").count(), 3);
  await page.locator('[data-project-filter="website"]').click();
  assert.equal(await page.locator(".project-card:visible").count(), 1);
  await page.locator('[data-project-filter="all"]').click();
  assert.equal(await page.locator(".project-card:visible").count(), 4);
  const visibleTitles = await page.locator(".project-card h3").allTextContents();
  assert.deepEqual(visibleTitles, ["HiCOOL PH", "SBAA School Management Portal", "Mindful Journal", "Twogethera"]);
  const twogethera = page.locator('.project-card[data-project-id="twogethera"]');
  assert.equal(await twogethera.count(), 1);
  assert.equal(await page.locator('.project-card[data-project-id="portfolio"]').count(), 0);
  assert.equal(await page.locator("#twogethera-details").count(), 0);
  assert.equal(await twogethera.locator('.product-showcase-icon[src$="twogethera-icon.png"]').count(), 1);
  const mobilePreview = twogethera.locator('.product-phone img[src$="twogethera-phone-design-preview.webp"]');
  assert.equal(await mobilePreview.count(), 1);
  assert.deepEqual(await mobilePreview.evaluate((img) => [img.naturalWidth, img.naturalHeight]), [390, 844]);
  assert.equal(await twogethera.locator('.product-showcase-capture[src$="twogethera-live-dashboard.webp"]').count(), 1);
  assert.deepEqual(await twogethera.locator('.product-showcase-capture').evaluate((img) => [img.naturalWidth, img.naturalHeight]), [2396, 1426]);
  assert.equal(await twogethera.locator('.project-links a[href="#contact"]').count(), 1);
  assert.equal(await twogethera.locator('a[href*="github.com"]').count(), 0);
  assert.match(await twogethera.innerText(), /private shared-planning application/i);
  assert.doesNotMatch(await twogethera.innerText(), /App Store|Google Play/i);
  for (const [id, image] of [["hicool", "hicool.webp"], ["sbaa", "sbaa-admin-dashboard.webp"], ["mindful-journal", "mindful-home.webp"]]) {
    assert.ok((await page.locator(`.project-card[data-project-id="${id}"] img`).first().getAttribute("src")).endsWith(image));
  }
  const mindful = page.locator('.project-card[data-project-id="mindful-journal"]');
  assert.equal(await mindful.locator(".mindful-showcase").count(), 1);
  assert.equal(await mindful.locator('.mindful-phone--home img[src$="mindful-home.webp"]').count(), 1);
  assert.equal(await mindful.locator('.mindful-phone--calendar img[src$="mindful-calendar.webp"]').count(), 1);
  assert.deepEqual(await mindful.locator(".mindful-phone img").evaluateAll((imgs) => imgs.map((img) => [img.naturalWidth, img.naturalHeight])), [[519, 1050], [513, 1050]]);
  assert.equal(await mindful.locator(".mindful-screen-gallery").count(), 1);
  assert.equal(await mindful.getByRole("link", { name: /home and calendar screens/i }).count(), 1);
  assert.match(await mindful.innerText(), /Mood check-ins[\s\S]*Personal journaling[\s\S]*Calendar history[\s\S]*Search and filtering[\s\S]*Profile preferences/);
  assert.match(await mindful.innerText(), /Flutter/);
  assert.equal(await mindful.locator('.project-links a[href="https://mindful-journal-fiel.web.app"]').count(), 1);
  const sbaa = page.locator('.project-card[data-project-id="sbaa"]');
  assert.equal(await sbaa.locator(".sbaa-browser").count(), 1);
  assert.equal(await sbaa.locator('.sbaa-browser img[src$="sbaa-admin-dashboard.webp"]').count(), 1);
  assert.deepEqual(await sbaa.locator(".sbaa-browser img").evaluate((img) => [img.naturalWidth, img.naturalHeight]), [1400, 752]);
  assert.match(await sbaa.locator(".sbaa-browser img").getAttribute("alt"), /fictional demonstration data/i);
  assert.match(await sbaa.innerText(), /Role-based access[\s\S]*Student and faculty workflows[\s\S]*Academic records[\s\S]*Class and schedule management/);
  assert.match(await sbaa.innerText(), /academic team project in ongoing development/i);
  assert.doesNotMatch(await sbaa.innerText(), /production dashboard|deployed for the school/i);
  assert.equal(await sbaa.locator('.project-links a[href="https://sbaa-school-portal.pages.dev/login"]').count(), 1);
  check("Mindful Journal and SBAA use their supplied authentic screenshots, project-specific showcase frames, verified feature summaries, and correct destinations");
  check("Twogethera replaces only the portfolio card with authentic icon, mobile preview, and supplied app capture; other project cards remain");
  await page.locator('[data-certificate-filter="Cybersecurity"]').click();
  assert.equal(await page.locator(".certificate-card:visible").count(), 1);
  await page.locator('[data-certificate-filter="all"]').click();
  assert.equal(await page.locator(".certificate-card:visible").count(), 10);
  check("Project and certificate filters update visible content");

  for (const id of [
    "about",
    "projects",
    "skills",
    "services",
    "experience",
    "resume",
    "certifications",
    "contact",
  ]) {
    if (["experience", "resume", "certifications"].includes(id))
      await page.locator(".nav-more").evaluate((el) => (el.open = true));
    await page.locator(`#nav-panel a[href="#${id}"]`).click();
    await page.waitForFunction(
      (section) =>
        document
          .querySelector(`#nav-panel a[href="#${section}"]`)
          .getAttribute("aria-current") === "location",
      id,
    );
    const top = await page
      .locator(`#${id}`)
      .evaluate((el) => el.getBoundingClientRect().top);
    assert.ok(
      top >= 0 && top <= 104,
      `${id}: incorrect desktop anchor offset ${top}`,
    );
  }
  check(
    "Every desktop navigation destination has the correct scroll offset and active indication",
  );

  const certTrigger = page
    .locator(".certificate-links [data-document]")
    .first();
  await certTrigger.click();
  assert.ok(await page.locator("dialog").evaluate((el) => el.open));
  assert.equal(await page.locator("dialog img").count(), 1);
  assert.ok(
    (await page.locator("#document-open").getAttribute("href")).endsWith(
      "assets/certificates/cybersecurity.pdf",
    ),
  );
  const downloadEvent = page.waitForEvent("download");
  await page.locator("#document-download").click();
  const downloadedCertificate = await downloadEvent;
  assert.equal(downloadedCertificate.suggestedFilename(), "cybersecurity.pdf");
  assert.equal(
    fs
      .readFileSync(await downloadedCertificate.path())
      .subarray(0, 5)
      .toString(),
    "%PDF-",
  );
  check(
    "Certificate original link and actual downloaded file point to the real PDF",
  );

  await page.locator("#document-download").focus();
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement.className),
    "dialog-close",
  );
  await page.keyboard.press("Shift+Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "document-download",
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("dialog").evaluate((el) => el.open), false);
  assert.ok(await certTrigger.evaluate((el) => el === document.activeElement));
  check(
    "Certificate viewer: real image, keyboard containment, Escape and focus restoration",
  );
  await certTrigger.click();
  await page.mouse.click(1, 1);
  assert.equal(await page.locator("dialog").evaluate((el) => el.open), false);
  check("Dialog backdrop closes viewer");
  const roleResumes = [
    {
      title: "Web Developer Resume",
      filename: "Oronos_Resume_WebDev_Final.pdf",
    },
    {
      title: "Administrative Support Resume",
      filename: "Oronos_Resume_AdminSupport_Final.pdf",
    },
  ];
  for (let i = 0; i < roleResumes.length; i++) {
    const { title, filename } = roleResumes[i];
    const card = page.locator(".resume-card").nth(i);
    const previewLink = card.locator('a[data-kind="pdf"]');
    const downloadLink = card.locator("a[download]");
    const expectedPath = `assets/resumes/${filename}`;
    assert.ok((await previewLink.getAttribute("href")).endsWith(expectedPath));
    assert.ok(
      (await downloadLink.getAttribute("href")).endsWith(expectedPath),
    );
    assert.equal(await downloadLink.getAttribute("download"), filename);
    await previewLink.click();
    assert.ok(await page.locator("dialog").evaluate((el) => el.open));
    assert.equal(await page.locator("#dialog-title").textContent(), title);
    assert.ok(
      await page
        .locator("dialog iframe")
        .evaluate((el, path) => el.src.endsWith("/" + path), expectedPath),
    );
    assert.ok(
      (await page.locator("#document-open").getAttribute("href")).endsWith(
        expectedPath,
      ),
    );
    assert.ok(
      (await page.locator("#document-download").getAttribute("href")).endsWith(
        expectedPath,
      ),
    );
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("dialog").evaluate((el) => el.open), false);
    assert.ok(await previewLink.evaluate((el) => el === document.activeElement));
    const downloadEvent = page.waitForEvent("download");
    await downloadLink.click();
    const download = await downloadEvent;
    assert.equal(download.suggestedFilename(), filename);
    assert.equal(
      fs.readFileSync(await download.path()).subarray(0, 5).toString(),
      "%PDF-",
    );
  }
  check(
    "Both supplied role resumes preview their matching PDFs and download valid bytes with expected filenames",
  );

  const gcfCard = page.locator(".certificate-card").filter({
    hasText: "Excel 2016",
  });
  const gcfTrigger = gcfCard.locator("a[data-document]").first();
  assert.ok(
    (await gcfTrigger.getAttribute("href")).endsWith(
      "assets/certificates/excel-2016.pdf",
    ),
  );
  assert.equal(await gcfCard.locator('a[target="_blank"]').count(), 0);
  assert.match(await gcfCard.innerText(), /Issuer verification unavailable/);
  await gcfTrigger.click();
  assert.ok(await page.locator("dialog").evaluate((el) => el.open));
  assert.ok(
    await page
      .locator("dialog img")
      .evaluate((el) => el.src.endsWith("assets/images/certificates/excel-2016.webp")),
  );
  assert.ok(
    (await page.locator("#document-open").getAttribute("href")).endsWith(
      "assets/certificates/excel-2016.pdf",
    ),
  );
  const gcfDownloadEvent = page.waitForEvent("download");
  await page.locator("#document-download").click();
  const gcfDownload = await gcfDownloadEvent;
  assert.equal(gcfDownload.suggestedFilename(), "excel-2016.pdf");
  assert.equal(
    fs.readFileSync(await gcfDownload.path()).subarray(0, 5).toString(),
    "%PDF-",
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("dialog").evaluate((el) => el.open), false);
  assert.ok(await gcfTrigger.evaluate((el) => el === document.activeElement));
  await page.setViewportSize({ width: 390, height: 700 });
  await gcfTrigger.click();
  assert.ok(
    await page.locator("dialog img").evaluate((el) => el.complete && el.naturalWidth > 0),
  );
  await page.screenshot({
    path: path.join(OUTPUT, "gcf-certificate-dialog-mobile.png"),
  });
  await page.locator(".dialog-close").click();
  check(
    "GCFGlobal certificate opens its real image and source PDF, clearly marks verification unavailable, and works on mobile",
  );

  assert.equal(await page.locator('[data-title="Original general resume"]').count(), 0);
  assert.equal(await page.locator('a[download="RESUME-Oronos-Fiel.pdf"]').count(), 0);
  assert.equal(await page.locator(".resume-card a[download]").count(), 2);
  check(
    "Legacy general resume with address/contact fields is not linked; both current role resumes remain available",
  );

  await page.setViewportSize({ width: 375, height: 900 });
  await page.locator(".menu-toggle").click();
  assert.equal(
    await page.locator(".menu-toggle").getAttribute("aria-expanded"),
    "true",
  );
  assert.ok(await page.locator("main").evaluate((el) => el.inert));
  await page.locator(".menu-toggle").focus();
  await page.keyboard.press("Tab");
  assert.ok(
    await page
      .locator(".nav .brand")
      .evaluate((el) => el === document.activeElement),
  );
  await page.keyboard.press("Shift+Tab");
  assert.ok(
    await page
      .locator(".menu-toggle")
      .evaluate((el) => el === document.activeElement),
  );
  await page.keyboard.press("Escape");
  assert.equal(
    await page.locator(".menu-toggle").getAttribute("aria-expanded"),
    "false",
  );
  assert.equal(await page.locator("main").evaluate((el) => el.inert), false);
  await page.locator(".menu-toggle").click();
  await page.locator('#nav-panel a[href="#skills"]').click();
  assert.equal(
    await page.locator(".menu-toggle").getAttribute("aria-expanded"),
    "false",
  );
  await page.waitForFunction(
    () =>
      document
        .querySelector('#nav-panel a[href="#skills"]')
        .getAttribute("aria-current") === "location",
  );
  assert.ok(
    await page
      .locator("#skills")
      .evaluate((el) => el.getBoundingClientRect().top >= 65),
  );
  check(
    "Mobile navigation: focus loop, Escape, background inert, anchor offsets and active section",
  );
  await page.locator(".menu-toggle").click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForFunction(() => !document.querySelector("main").inert);
  check("Mobile-to-desktop resize clears menu scroll and inert state");

  await page.locator("#contact-form").scrollIntoViewIfNeeded();
  await page.waitForFunction(
    () => document.querySelector("#turnstile-widget").dataset.ready === "true",
  );
  assert.equal(
    await page.evaluate(() => window.__turnstileMock.sitekey),
    "0x4AAAAAAF1qpZilMPBx7Q2A",
  );
  assert.equal(
    await page.locator("#turnstile-status").getAttribute("aria-live"),
    "polite",
  );
  await page.locator("#contact-submit").click();
  assert.equal(await page.locator('[aria-invalid="true"]').count(), 3);
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "contact-name",
  );
  await page.locator("#contact-name").fill("QA Visitor");
  await page.locator("#contact-email").fill("not-an-email");
  await page
    .locator("#contact-message")
    .fill("Please discuss a sample portfolio project.");
  let submissionCount = 0;
  let submittedBody = "";
  let submittedHeaders = {};
  let submittedMethod = "";
  let submittedUrl = "";
  let releaseSubmission;
  await page.route("https://formspree.io/f/mrppjrwz", async (route) => {
    submissionCount++;
    submittedBody = route.request().postData() || "";
    submittedHeaders = await route.request().allHeaders();
    submittedMethod = route.request().method();
    submittedUrl = route.request().url();
    await new Promise((resolve) => {
      releaseSubmission = resolve;
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.locator("#contact-submit").click();
  assert.equal(await page.locator('#contact-email[aria-invalid="true"]').count(), 1);
  assert.equal(submissionCount, 0);
  await page.locator("#contact-email").fill("visitor@example.com");
  await page.locator("#contact-submit").click();
  assert.equal(submissionCount, 0);
  assert.match(
    await page.locator("#turnstile-status").textContent(),
    /Complete the security check/,
  );
  assert.equal(
    await page.evaluate(() => document.querySelector("#contact-message").value),
    "Please discuss a sample portfolio project.",
  );
  await page.evaluate(() =>
    window.__turnstileMock.solve("mock-main-success-token"),
  );
  await page.locator("#contact-submit").click();
  await page.waitForFunction(
    () => document.querySelector("#contact-submit").disabled,
  );
  assert.equal(await page.locator("#contact-form").getAttribute("aria-busy"), "true");
  while (!releaseSubmission)
    await new Promise((resolve) => setTimeout(resolve, 10));
  await page.locator("#contact-form").evaluate((form) =>
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  assert.equal(submissionCount, 1);
  assert.equal(submittedMethod, "POST");
  assert.equal(submittedUrl, "https://formspree.io/f/mrppjrwz");
  assert.match(submittedHeaders["content-type"], /^multipart\/form-data;/);
  assert.equal(submittedHeaders.accept, "application/json");
  assert.match(submittedBody, /name="name"[\s\S]*?QA Visitor/);
  assert.match(submittedBody, /name="email"[\s\S]*?visitor@example\.com/);
  assert.match(submittedBody, /name="subject"[\s\S]*?Portfolio inquiry from QA Visitor/);
  assert.match(submittedBody, /name="_subject"[\s\S]*?Portfolio inquiry from QA Visitor/);
  assert.match(submittedBody, /name="message"[\s\S]*?Please discuss a sample portfolio project\./);
  assert.match(submittedBody, /name="_gotcha"\r?\n\r?\n/);
  assert.match(
    submittedBody,
    /name="cf-turnstile-response"[\s\S]*?mock-main-success-token/,
  );
  // The `email` field is Formspree's documented Reply-To source.
  releaseSubmission();
  await page.locator('#form-status[data-state="success"]').waitFor();
  assert.equal(await page.locator("#contact-message").inputValue(), "");
  assert.equal(
    await page.locator("#form-status").textContent(),
    "Thank you for getting in touch! We've received your message and will get back to you as soon as possible.",
  );
  check("Configured Formspree POST includes Turnstile token and expected fields; validation, duplicate prevention, and confirmed success work");
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator("#contact-form").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(OUTPUT, `contact-turnstile-${width}.png`),
    });
  }

  const configuredPage = await context.newPage();
  await configuredPage.route("**/config.js", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'window.ORONEX_CONFIG={formEndpoint:"https://formspree.io/f/oronexqa",turnstileSiteKey:"0x4AAAAAAF1qpZilMPBx7Q2A"};',
    }),
  );
  let answer = {
    status: 403,
    body: {
      error:
        "In order to submit via AJAX, you need to set a custom key or reCAPTCHA must be disabled in this form's settings page.",
    },
  };
  let pendingRelease;
  let hold = false;
  let requests = 0;
  const submittedBodies = [];
  await configuredPage.route(
    "https://formspree.io/f/oronexqa",
    async (route) => {
      requests++;
      submittedBodies.push(route.request().postData() || "");
      if (hold)
        await new Promise((resolve) => {
          pendingRelease = resolve;
        });
      if (answer.abort) return route.abort();
      await route.fulfill({
        status: answer.status,
        contentType: "application/json",
        body: JSON.stringify(answer.body),
      });
    },
  );
  await configuredPage.goto(BASE);
  await configuredPage.locator("#contact-form").scrollIntoViewIfNeeded();
  await configuredPage.waitForFunction(
    () => document.querySelector("#turnstile-widget").dataset.ready === "true",
  );
  assert.equal(
    await configuredPage.evaluate(() => window.__turnstileMock.sitekey),
    "0x4AAAAAAF1qpZilMPBx7Q2A",
  );
  await configuredPage.locator("#contact-name").fill("QA Visitor");
  await configuredPage.locator("#contact-email").fill("visitor@example.com");
  await configuredPage
    .locator("#contact-message")
    .fill("This message must never leave the test browser.");
  await configuredPage.locator("#contact-submit").click();
  assert.equal(requests, 0);
  assert.match(
    await configuredPage.locator("#turnstile-status").textContent(),
    /Complete the security check/,
  );
  await configuredPage.evaluate(() => {
    window.__turnstileMock.solve("expired-test-token");
    window.__turnstileMock.expire();
  });
  assert.match(
    await configuredPage.locator("#turnstile-status").textContent(),
    /expired/i,
  );
  await configuredPage.locator("#contact-submit").click();
  assert.equal(requests, 0);
  assert.match(
    await configuredPage.locator("#turnstile-status").textContent(),
    /Complete the security check/,
  );
  await configuredPage.evaluate(() => window.__turnstileMock.fail());
  assert.match(
    await configuredPage.locator("#turnstile-status").textContent(),
    /failed to load/i,
  );
  check("Missing and expired Turnstile tokens are blocked before any provider request");
  const solveConfiguredTurnstile = (token) =>
    configuredPage.evaluate((value) => window.__turnstileMock.solve(value), token);
  await solveConfiguredTurnstile("fresh-token-403");
  await configuredPage.locator("#contact-submit").click();
  await configuredPage.locator('#form-status[data-state="error"]').waitFor();
  await configuredPage.waitForFunction(
    () => !document.querySelector("#contact-submit").disabled,
  );
  assert.match(
    await configuredPage.locator("#contact-message").inputValue(),
    /must never leave/,
  );
  assert.match(
    await configuredPage.locator("#form-status").textContent(),
    /HTTP 403/,
  );
  assert.match(
    await configuredPage.locator("#form-status").textContent(),
    /In order to submit via AJAX, you need to set a custom key or reCAPTCHA must be disabled/,
  );
  assert.equal(await configuredPage.locator("#form-status").getAttribute("role"), "status");
  assert.equal(await configuredPage.locator("#form-status").getAttribute("aria-live"), "polite");
  assert.match(submittedBodies[0], /name="cf-turnstile-response"[\s\S]*?fresh-token-403/);
  assert.equal(await configuredPage.locator("#turnstile-status").getAttribute("role"), "status");
  assert.ok(await configuredPage.evaluate(() => window.__turnstileMock.resetCount >= 1));
  check("HTTP 403 reason is accessible, input is preserved, and consumed CAPTCHA token is reset");
  await configuredPage.locator("#contact-submit").click();
  assert.equal(requests, 1);
  await solveConfiguredTurnstile("fresh-token-400");
  answer = {
    status: 400,
    body: { errors: [{ field: "email", message: "Email is invalid." }] },
  };
  await configuredPage.locator("#contact-submit").click();
  await configuredPage.waitForFunction(
    () => document.querySelector("#form-status").textContent.includes("HTTP 400"),
  );
  await configuredPage.waitForFunction(
    () => !document.querySelector("#contact-submit").disabled,
  );
  assert.match(await configuredPage.locator("#form-status").textContent(), /HTTP 400/);
  assert.match(await configuredPage.locator("#form-status").textContent(), /Email is invalid\./);
  assert.match(await configuredPage.locator("#contact-message").inputValue(), /must never leave/);
  assert.match(submittedBodies[1], /name="cf-turnstile-response"[\s\S]*?fresh-token-400/);
  check("HTTP 400 provider validation details remain readable and input is preserved");
  answer = { status: 200, body: {} };
  await solveConfiguredTurnstile("fresh-token-unconfirmed");
  await configuredPage.locator("#contact-submit").click();
  await configuredPage.waitForFunction(() =>
    document.querySelector("#form-status").textContent.includes("did not confirm acceptance"),
  );
  await configuredPage.waitForFunction(
    () => !document.querySelector("#contact-submit").disabled,
  );
  assert.equal(
    await configuredPage.locator("#form-status").getAttribute("data-state"),
    "error",
  );
  assert.match(
    await configuredPage.locator("#form-status").textContent(),
    /did not confirm acceptance/i,
  );
  check("HTTP 200 without explicit provider success is rejected");
  answer = { abort: true };
  await solveConfiguredTurnstile("fresh-token-network");
  await configuredPage.locator("#contact-submit").click();
  await configuredPage.waitForFunction(() =>
    document.querySelector("#form-status").textContent.includes("network error"),
  );
  await configuredPage.waitForFunction(
    () => !document.querySelector("#contact-submit").disabled,
  );
  assert.equal(
    await configuredPage.locator("#form-status").getAttribute("data-state"),
    "error",
  );
  assert.match(
    await configuredPage.locator("#form-status").textContent(),
    /network error/i,
  );
  check("Mocked network failure recovers the submit button");
  answer = { status: 200, body: { ok: true } };
  hold = true;
  await solveConfiguredTurnstile("fresh-token-success");
  await configuredPage.locator("#contact-submit").click();
  await configuredPage.waitForFunction(
    () => document.querySelector("#contact-submit").disabled,
  );
  assert.equal(
    await configuredPage.locator("#contact-form").getAttribute("aria-busy"),
    "true",
  );
  while (!pendingRelease)
    await new Promise((resolve) => setTimeout(resolve, 10));
  await configuredPage.locator("#contact-form").evaluate((form) =>
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  assert.equal(requests, 5);
  pendingRelease();
  await configuredPage.locator('#form-status[data-state="success"]').waitFor();
  assert.equal(
    await configuredPage.locator("#contact-message").inputValue(),
    "",
  );
  assert.match(submittedBodies[4], /name="cf-turnstile-response"[\s\S]*?fresh-token-success/);
  assert.ok(await configuredPage.evaluate(() => window.__turnstileMock.resetCount >= 5));
  assert.equal(requests, 5);
  check("Unique fresh tokens support retry; mocked success resets the form; duplicate submit is ignored");
  for (const width of [320, 375, 768, 1440]) {
    await configuredPage.setViewportSize({ width, height: 900 });
    const geometry = await configuredPage.evaluate(() => {
      const rect = document.querySelector("#turnstile-widget").getBoundingClientRect();
      return { viewport: innerWidth, scroll: document.documentElement.scrollWidth, left: rect.left, right: rect.right };
    });
    assert.ok(geometry.scroll <= width, JSON.stringify(geometry));
    assert.ok(geometry.left >= -1 && geometry.right <= width + 1, JSON.stringify(geometry));
  }
  check("Turnstile container fits mobile, tablet, and desktop viewport widths without horizontal overflow");
  await configuredPage.close();

  const unavailableTurnstilePage = await context.newPage();
  let blockedProviderRequests = 0;
  await unavailableTurnstilePage.route(
    /^https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit$/,
    (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/javascript",
        body: "/* simulated Turnstile load failure */",
      }),
  );
  await unavailableTurnstilePage.route(
    "https://formspree.io/f/mrppjrwz",
    (route) => {
      blockedProviderRequests++;
      return route.abort();
    },
  );
  await unavailableTurnstilePage.goto(BASE);
  await unavailableTurnstilePage.locator("#contact-form").scrollIntoViewIfNeeded();
  await unavailableTurnstilePage.waitForFunction(() =>
    document.querySelector("#turnstile-status").textContent.includes("could not load"),
  );
  await unavailableTurnstilePage.locator("#contact-name").fill("QA Visitor");
  await unavailableTurnstilePage.locator("#contact-email").fill("visitor@example.com");
  await unavailableTurnstilePage.locator("#contact-message").fill("Keep this message when verification cannot load.");
  await unavailableTurnstilePage.locator("#contact-submit").click();
  assert.equal(blockedProviderRequests, 0);
  assert.match(await unavailableTurnstilePage.locator("#turnstile-status").textContent(), /unavailable/i);
  assert.match(await unavailableTurnstilePage.locator("#contact-message").inputValue(), /Keep this message/);
  check("Turnstile network failure blocks Formspree and preserves visitor input");
  await unavailableTurnstilePage.close();

  const noJs = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 375, height: 900 },
  });
  const staticPage = await noJs.newPage();
  await staticPage.goto(BASE);
  assert.equal(await staticPage.locator(".project-card").count(), 4);
  assert.equal(await staticPage.locator(".certificate-card").count(), 10);
  assert.ok(
    await staticPage.locator('#nav-panel a[href="#projects"]').isVisible(),
  );
  assert.ok(
    await staticPage.locator('#nav-panel a[href="#experience"]').isVisible(),
  );
  assert.ok(
    await staticPage
      .locator(".certificate-links a")
      .first()
      .getAttribute("href"),
  );
  assert.equal(await staticPage.locator("#contact-submit").isDisabled(), true);
  assert.equal(await staticPage.locator("#contact-form").getAttribute("method"), "post");
  assert.equal(
    await staticPage.locator("#contact-form").evaluate((form) => form.action),
    "https://formspree.io/f/mrppjrwz",
  );
  assert.equal(await staticPage.locator("#prepared-email").count(), 0);
  assert.match(await staticPage.locator("noscript").textContent(), /JavaScript is required/);
  check("Without JavaScript, form submission is safely disabled and the visitor is told verification requires JavaScript");
  await noJs.close();

  await page.setViewportSize({ width: 375, height: 700 });
  await certTrigger.click();
  await page.screenshot({
    path: path.join(OUTPUT, "certificate-dialog-mobile.png"),
  });
  const { default: ModalAxeBuilder } = require(
    process.env.AXE_MODULE || "@axe-core/playwright",
  );
  const modalScan = await new ModalAxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  assert.deepEqual(
    modalScan.violations.map((v) => v.id),
    [],
  );
  await page.keyboard.press("Escape");
  await page.locator('[data-title="Web Developer Resume"]').click();
  await page.screenshot({
    path: path.join(OUTPUT, "resume-dialog-mobile.png"),
  });
  assert.ok(await page.locator("#document-open").isVisible());
  await page.locator(".dialog-close").click();
  check(
    "Mobile certificate/PDF dialogs: screenshot review artifacts, direct-open fallback and zero automated dialog violations",
  );

  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollBehavior,
    ),
    "auto",
  );
  const animations = await page.evaluate(
    () =>
      document.getAnimations().filter((a) => a.playState === "running").length,
  );
  assert.equal(animations, 0);
  assert.deepEqual(errors, []);
  check(
    "Reduced motion disables animation and smooth scrolling; no runtime errors",
  );

  fs.writeFileSync(
    path.join(OUTPUT, "results.json"),
    JSON.stringify(results, null, 2),
  );
  await browser.close();
  console.log(
    `${results.length} checks passed. Screenshots and scan details: ${OUTPUT}`,
  );
})().catch(async (error) => {
  console.error(error);
  await browser?.close();
  process.exit(1);
});

/* Public Formspree endpoint only; never place an email password or private API key here. */
(() => {
  const formEndpoint = "https://formspree.io/f/mrppjrwz";
  // Turnstile site keys are public. The secret stays in Formspree's dashboard.
  const turnstileSiteKey = "0x4AAAAAAF1qpZilMPBx7Q2A";
  // Allow fiel-mark15.github.io and localhost in Cloudflare. This repository's
  // canonical/live Pages host is oronex-dev.github.io; allow it too if retained.
  window.ORONEX_CONFIG = Object.freeze({ formEndpoint, turnstileSiteKey });
  const form = document.getElementById("contact-form");
  if (form) form.action = formEndpoint;
})();

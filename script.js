/* ORONEX: progressive enhancement. All core content and links work without JS. */
(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [
    ...root.querySelectorAll(selector),
  ];
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const mobile = matchMedia("(max-width: 680px)");
  const initIntro = () => {
    const root = document.documentElement;
    if (!root.classList.contains("intro-pending")) return;

    const startedAt = performance.now();
    let closing = false;
    let fallbackTimer;
    let dismissTimer;
    const pageRegions = $$(".site-header, main, .site-footer");
    pageRegions.forEach((region) => {
      region.inert = true;
    });
    const dismiss = (immediate = false) => {
      if (immediate) {
        closing = true;
        window.clearTimeout(dismissTimer);
        window.clearTimeout(fallbackTimer);
        root.classList.remove("intro-pending");
        pageRegions.forEach((region) => {
          region.inert = false;
        });
        return;
      }
      if (closing) return;
      closing = true;
      const minimum = motion.matches ? 120 : 430;
      const delay = Math.max(0, minimum - (performance.now() - startedAt));
      dismissTimer = window.setTimeout(() => {
        root.classList.remove("intro-pending");
        pageRegions.forEach((region) => {
          region.inert = false;
        });
        window.clearTimeout(fallbackTimer);
      }, delay);
    };

    if (document.readyState === "complete") dismiss();
    else window.addEventListener("load", () => dismiss(), { once: true });
    fallbackTimer = window.setTimeout(() => dismiss(), 1600);
    window.addEventListener(
      "pageshow",
      (event) => {
        if (event.persisted) dismiss(true);
      }
    );
  };
  initIntro();
  const menuButton = $(".menu-toggle");
  const menu = $("#nav-panel");
  const more = $(".nav-more");
  const main = $("main");
  const footer = $("footer");
  const dialog = $("#document-dialog");

  const updateScrollLock = () => {
    document.body.classList.toggle(
      "modal-open",
      dialog.open || menuButton.getAttribute("aria-expanded") === "true",
    );
  };
  const setMenu = (open, restoreFocus = false) => {
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute(
      "aria-label",
      open ? "Close navigation" : "Open navigation",
    );
    menu.classList.toggle("is-open", open);
    main.inert = open;
    footer.inert = open;
    if (mobile.matches) more.open = true;
    updateScrollLock();
    if (restoreFocus) menuButton.focus();
  };
  $(".nav .brand").addEventListener("click", () => setMenu(false));
  menuButton.addEventListener("click", () =>
    setMenu(menuButton.getAttribute("aria-expanded") !== "true"),
  );
  $$('a[href^="#"]', menu).forEach((link) =>
    link.addEventListener("click", () => {
      const target = $(link.getAttribute("href"));
      if (mobile.matches) setMenu(false);
      more.open = false;
      // Move keyboard focus to the destination without interrupting native anchor scrolling.
      if (target) {
        target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
        target.addEventListener(
          "blur",
          () => target.removeAttribute("tabindex"),
          { once: true },
        );
      }
    }),
  );
  document.addEventListener("click", (event) => {
    if (!more.contains(event.target) && !mobile.matches) more.open = false;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (menuButton.getAttribute("aria-expanded") === "true")
        setMenu(false, true);
      else if (more.open) {
        more.open = false;
        $("summary", more).focus();
      }
    }
    if (
      event.key === "Tab" &&
      mobile.matches &&
      menuButton.getAttribute("aria-expanded") === "true"
    ) {
      const focusable = [$$(".nav .brand")[0], ...$$("a", menu), menuButton];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  const syncMenu = () => {
    setMenu(false);
    more.open = mobile.matches;
  };
  mobile.addEventListener("change", syncMenu);
  syncMenu();

  // Scroll spy uses a single scheduled read and covers tall sections and page boundaries.
  const sections = $$("main section[id]");
  const navLinks = $$('a[href^="#"]', menu);
  let scrollScheduled = false;
  const updateActiveSection = () => {
    const offset =
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--header"),
      ) + 90;
    let active = sections[0].id;
    for (const section of sections)
      if (section.getBoundingClientRect().top <= offset) active = section.id;
    navLinks.forEach((link) => {
      if (link.getAttribute("href") === "#" + active)
        link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
    scrollScheduled = false;
  };
  addEventListener(
    "scroll",
    () => {
      if (!scrollScheduled) {
        scrollScheduled = true;
        requestAnimationFrame(updateActiveSection);
      }
    },
    { passive: true },
  );
  addEventListener("resize", updateActiveSection, { passive: true });
  updateActiveSection();

  const setupFilters = (
    attribute,
    cardSelector,
    categoryAttribute,
    statusSelector,
  ) => {
    const buttons = $$(`[${attribute}]`);
    const cards = $$(cardSelector);
    buttons.forEach((button) =>
      button.addEventListener("click", () => {
        const filter = button.getAttribute(attribute);
        buttons.forEach((item) =>
          item.setAttribute("aria-pressed", String(item === button)),
        );
        let shown = 0;
        cards.forEach((card) => {
          card.hidden =
            filter !== "all" && card.getAttribute(categoryAttribute) !== filter;
          if (!card.hidden) shown++;
        });
        $(statusSelector).textContent =
          `${shown} ${cardSelector === ".project-card" ? "projects" : "certificates"} shown.`;
      }),
    );
  };
  setupFilters(
    "data-project-filter",
    ".project-card",
    "data-category",
    "#project-status",
  );
  setupFilters(
    "data-certificate-filter",
    ".certificate-card",
    "data-category",
    "#certificate-status",
  );

  // Native modal dialogs handle inert background, Escape, and keyboard containment.
  let documentTrigger = null;
  const preview = $("#document-preview");
  $$("[data-document]").forEach((trigger) =>
    trigger.addEventListener("click", (event) => {
      if (typeof dialog.showModal !== "function") {
        if (trigger.tagName !== "A")
          window.open(trigger.dataset.document, "_blank", "noopener");
        return;
      }
      event.preventDefault();
      documentTrigger = trigger;
      $("#dialog-title").textContent = trigger.dataset.title;
      $("#document-open").href =
        trigger.dataset.pdf || trigger.dataset.document;
      $("#document-download").href =
        trigger.dataset.pdf || trigger.dataset.document;
      const content = document.createElement(
        trigger.dataset.kind === "pdf" ? "iframe" : "img",
      );
      if (content.tagName === "IFRAME") {
        content.title = trigger.dataset.title + " PDF preview";
        content.src = trigger.dataset.document;
      } else {
        content.src = trigger.dataset.document;
        content.alt =
          trigger.dataset.title + " — supplied course completion certificate";
        content.addEventListener(
          "error",
          () => {
            const note = document.createElement("p");
            note.className = "missing-image";
            note.textContent =
              "Preview unavailable. Please open the original PDF below.";
            preview.replaceChildren(note);
          },
          { once: true },
        );
      }
      preview.replaceChildren(content);
      dialog.showModal();
      updateScrollLock();
      $(".dialog-close").focus();
    }),
  );
  $(".dialog-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    const bounds = dialog.getBoundingClientRect();
    if (
      event.target === dialog &&
      (event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom)
    )
      dialog.close();
  });
  // Keep Tab within visible controls, including when a browser would briefly
  // move focus to its own chrome at the end of a native dialog's tab order.
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const controls = $$("button:not([disabled]), a[href], iframe", dialog);
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  dialog.addEventListener("close", () => {
    preview.replaceChildren();
    updateScrollLock();
    documentTrigger?.focus({ preventScroll: true });
  });

  // Missing assets remain understandable rather than exposing broken-image icons.
  $$("img[data-fallback]").forEach((img) => {
    const fallback = () => {
      const note = document.createElement("span");
      note.className = "missing-image";
      note.textContent = img.dataset.fallback;
      img.replaceWith(note);
    };
    img.addEventListener("error", fallback, { once: true });
    if (img.complete && !img.naturalWidth) fallback();
  });

  if ("IntersectionObserver" in window && !motion.matches) {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.08 },
    );
    $$(".reveal").forEach((item) => observer.observe(item));
  }
  // A finite role rotation finishes within five seconds; no perpetual animation.
  const roleLabel = $(".portrait-note span:last-child");
  const roleTimers = [];
  if (!motion.matches) {
    ["Responsive Website Designer", "Digital Solutions Builder"].forEach(
      (role, index) => {
        roleTimers.push(
          setTimeout(
            () => {
              roleLabel.textContent = role;
              $(".hero-visual").classList.add("role-ready");
            },
            1500 * (index + 1),
          ),
        );
      },
    );
  }
  motion.addEventListener("change", () => {
    if (motion.matches) roleTimers.forEach(clearTimeout);
  });
  $("#year").textContent = new Date().getFullYear();

  const form = $("#contact-form");
  const send = $("#contact-submit");
  const status = $("#form-status");
  const turnstileContainer = $("#turnstile-widget");
  const turnstileStatus = $("#turnstile-status");
  const endpointValue =
    window.ORONEX_CONFIG?.formEndpoint || form.action || "";
  const turnstileSiteKey = window.ORONEX_CONFIG?.turnstileSiteKey || "";
  // The only supported provider is Formspree; reject accidentally pasted arbitrary URLs.
  const configured = /^https:\/\/formspree\.io\/f\/[a-zA-Z0-9]+$/.test(
    endpointValue,
  );
  let turnstileWidgetId = null;
  let activeTurnstileToken = "";
  let turnstileLoadPromise = null;
  let turnstileLoadFailed = false;
  let submissionInFlight = false;
  const updateSubmitState = () => {
    send.disabled = !configured || submissionInFlight;
  };
  const setTurnstileStatus = (state, message) => {
    turnstileStatus.dataset.state = state;
    turnstileStatus.textContent = message;
  };
  const clearTurnstileToken = () => {
    activeTurnstileToken = "";
    try {
      if (turnstileWidgetId !== null && window.turnstile)
        window.turnstile.reset(turnstileWidgetId);
    } catch {
      // Keep submission recovery available even if the widget reset throws.
    }
  };
  const renderTurnstile = () => {
    if (turnstileWidgetId !== null) return;
    if (!window.turnstile || !turnstileSiteKey) {
      setTurnstileStatus(
        "error",
        "Security verification is unavailable. Please refresh the page and try again.",
      );
      return;
    }
    try {
      turnstileWidgetId = window.turnstile.render(turnstileContainer, {
        sitekey: turnstileSiteKey,
        theme: "dark",
        size: "flexible",
        tabindex: 0,
        callback: (token) => {
          if (typeof token !== "string" || !token) {
            activeTurnstileToken = "";
            setTurnstileStatus(
              "error",
              "Security verification did not return a token. Please try again.",
            );
            return;
          }
          activeTurnstileToken = token;
          setTurnstileStatus("success", "Security verification complete.");
        },
        "expired-callback": () => {
          activeTurnstileToken = "";
          setTurnstileStatus(
            "pending",
            "Security verification expired. Complete the refreshed check before sending.",
          );
          try {
            if (turnstileWidgetId !== null)
              window.turnstile.reset(turnstileWidgetId);
          } catch {
            // The visitor can still refresh the page if the widget cannot restart.
          }
        },
        "error-callback": () => {
          activeTurnstileToken = "";
          setTurnstileStatus(
            "error",
            "Security verification failed to load. Please retry the check.",
          );
        },
        "timeout-callback": () => {
          activeTurnstileToken = "";
          setTurnstileStatus(
            "error",
            "Security verification timed out. Please complete the check again.",
          );
        },
      });
      turnstileContainer.dataset.ready = "true";
      setTurnstileStatus(
        "pending",
        "Complete the security check before sending your message.",
      );
    } catch {
      turnstileWidgetId = null;
      turnstileLoadFailed = true;
      setTurnstileStatus(
        "error",
        "Security verification could not start. Please refresh the page and try again.",
      );
    }
  };
  const loadTurnstile = () => {
    if (!configured || !turnstileSiteKey || turnstileWidgetId !== null) return;
    if (window.turnstile?.render) {
      renderTurnstile();
      return;
    }
    if (turnstileLoadPromise) return;
    setTurnstileStatus("pending", "Loading security verification…");
    turnstileLoadPromise = new Promise((resolve, reject) => {
      const api = document.createElement("script");
      api.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      api.async = true;
      api.addEventListener("load", resolve, { once: true });
      api.addEventListener("error", reject, { once: true });
      document.head.append(api);
    })
      .then(() => {
        if (!window.turnstile?.render) throw new Error("TURNSTILE_UNAVAILABLE");
        renderTurnstile();
      })
      .catch(() => {
        turnstileLoadFailed = true;
        setTurnstileStatus(
          "error",
          "Security verification could not load. Check your connection and refresh the page.",
        );
      });
  };
  if (configured && turnstileSiteKey) {
    if ("IntersectionObserver" in window) {
      const turnstileObserver = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            turnstileObserver.disconnect();
            loadTurnstile();
          }
        },
        { rootMargin: "200px 0px" },
      );
      turnstileObserver.observe(turnstileContainer);
    } else {
      loadTurnstile();
    }
  } else {
    setTurnstileStatus(
      "error",
      "Security verification is not configured. This form cannot be submitted.",
    );
  }
  form.noValidate = true;
  const setSubmitLabel = (label) => {
    const textNode = [...send.childNodes].find(
      (node) => node.nodeType === Node.TEXT_NODE,
    );
    if (textNode) textNode.textContent = label;
  };
  updateSubmitState();
  if (configured) {
    setSubmitLabel("Send Message ");
    $("#form-note").textContent =
      "Your message will be sent through Formspree. Please do not include sensitive information.";
  } else {
    $("#form-note").textContent =
      "Online message submission is unavailable right now.";
  }
  const fields = [
    $("#contact-name"),
    $("#contact-email"),
    $("#contact-message"),
  ];
  const validateField = (field) => {
    let error = "";
    const value = field.value.trim();
    if (field.name === "name" && !value) error = "Please enter your name.";
    if (
      field.name === "email" &&
      (!value ||
        field.validity.typeMismatch ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    )
      error = "Please enter a valid email address.";
    if (field.name === "message" && value.length < 10)
      error = "Please write a message of at least 10 characters.";
    if (field.validity.tooLong)
      error = "Please shorten this field to the allowed length.";
    field.setAttribute("aria-invalid", String(Boolean(error)));
    $("#" + field.name + "-error").textContent = error;
    return !error;
  };
  const readProviderError = (payload) => {
    if (typeof payload?.error === "string" && payload.error.trim()) {
      return payload.error.trim().slice(0, 420);
    }
    if (Array.isArray(payload?.errors)) {
      const messages = payload.errors
        .map((item) => (typeof item?.message === "string" ? item.message.trim() : ""))
        .filter(Boolean);
      if (messages.length) return messages.join(" ").slice(0, 420);
    }
    return "";
  };
  fields.forEach((field) =>
    field.addEventListener("input", () => {
      if (field.getAttribute("aria-invalid") === "true") validateField(field);
    }),
  );
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submissionInFlight || send.disabled) return;
    status.dataset.state = "";
    const validity = fields.map(validateField);
    if (validity.includes(false)) {
      status.textContent = "Please check the highlighted fields.";
      fields[validity.indexOf(false)].focus();
      return;
    }
    if ($("#company-site").value) {
      status.textContent =
        "Unable to submit this message. Please review the form and try again.";
      return;
    }
    if (!configured) {
      status.dataset.state = "error";
      status.textContent =
        "Online message submission is unavailable right now.";
      return;
    }
    let providerToken = "";
    try {
      if (turnstileWidgetId !== null && window.turnstile?.getResponse)
        providerToken = window.turnstile.getResponse(turnstileWidgetId);
    } catch {
      providerToken = "";
    }
    if (
      !activeTurnstileToken ||
      !providerToken ||
      providerToken !== activeTurnstileToken
    ) {
      activeTurnstileToken = "";
      if (turnstileWidgetId === null) loadTurnstile();
      if (turnstileLoadFailed) {
        setTurnstileStatus(
          "error",
          "Security verification is unavailable. Check your connection and refresh the page.",
        );
      } else {
        setTurnstileStatus(
          "pending",
          turnstileWidgetId === null
            ? "Security verification is still loading. Please wait and complete the check."
            : "Complete the security check before sending your message.",
        );
      }
      return;
    }
    submissionInFlight = true;
    send.disabled = true;
    setSubmitLabel("Sending… ");
    form.setAttribute("aria-busy", "true");
    status.textContent = "Sending your message…";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const [name] = fields.map((field) => field.value.trim());
      const submission = new FormData(form);
      const subject = `Portfolio inquiry from ${name}`;
      // Keep the visible design unchanged while providing a useful email subject.
      submission.set("subject", subject);
      submission.set("_subject", subject);
      // Include the current one-use Turnstile response explicitly in FormData.
      submission.set("cf-turnstile-response", providerToken);
      activeTurnstileToken = "";
      let response;
      try {
        response = await fetch(endpointValue, {
          method: "POST",
          body: submission,
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
      } catch (error) {
        if (error.name === "AbortError") throw error;
        throw new Error("NETWORK_FAILURE");
      }
      let result = null;
      try {
        result = await response.json();
      } catch {
        // Non-JSON replies cannot confirm that Formspree accepted this message.
      }
      if (!response.ok) {
        const rejection = new Error(`FORMSPREE_HTTP_${response.status}`);
        rejection.providerMessage = readProviderError(result);
        throw rejection;
      }
      // A 2xx error payload must not be treated as a successful submission.
      if (!result || result.errors || result.ok !== true)
        throw new Error("FORMSPREE_UNCONFIRMED");
      status.dataset.state = "success";
      status.textContent =
        "Thank you for getting in touch! We've received your message and will get back to you as soon as possible.";
      form.reset();
      fields.forEach((field) => field.removeAttribute("aria-invalid"));
    } catch (error) {
      status.dataset.state = "error";
      if (error.name === "AbortError") {
        status.textContent =
          "The request timed out before Formspree confirmed it. Your text is saved; please try again.";
      } else if (error.message.startsWith("FORMSPREE_HTTP_")) {
        const responseCode = error.message.replace("FORMSPREE_HTTP_", "");
        const detail = error.providerMessage ? `: ${error.providerMessage}` : "";
        status.textContent =
          `Formspree rejected the request (HTTP ${responseCode})${detail} Your text is saved; please review it and try again.`;
      } else if (error.message === "NETWORK_FAILURE") {
        status.textContent =
          "A network error prevented confirmation from Formspree. Your text is saved; check your connection and retry.";
      } else {
        status.textContent =
          "Formspree did not confirm acceptance of this message. Your text is saved; please try again.";
      }
    } finally {
      clearTimeout(timeout);
      submissionInFlight = false;
      clearTurnstileToken();
      setTurnstileStatus(
        "pending",
        "Complete a fresh security check before sending another message.",
      );
      updateSubmitState();
      setSubmitLabel("Send Message ");
      form.removeAttribute("aria-busy");
    }
  });
})();

/* ==========================================================================
   Fiel Mark E. Oronos — Portfolio
   script.js
   Vanilla JS, ES2024. No frameworks, no libraries.
   ========================================================================== */

(() => {
  'use strict';

  /* ------------------------------------------------------------------------
     Utilities
     ------------------------------------------------------------------------ */
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const debounce = (fn, wait = 150) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  };

  const throttle = (fn, limit = 100) => {
    let inThrottle = false;
    let queuedArgs = null;
    return (...args) => {
      if (!inThrottle) {
        fn(...args);
        inThrottle = true;
        setTimeout(() => {
          inThrottle = false;
          if (queuedArgs) {
            fn(...queuedArgs);
            queuedArgs = null;
          }
        }, limit);
      } else {
        queuedArgs = args;
      }
    };
  };

  const clamp = (val, min, max) => Math.min(Math.max(val, min), max);
  const lerp = (a, b, t) => a + (b - a) * t;

  const on = (el, evt, handler, opts = {}) => {
    if (!el) return;
    el.addEventListener(evt, handler, { passive: true, ...opts });
  };

  const qs = (sel, ctx = document) => ctx.querySelector(sel);
  const qsa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ------------------------------------------------------------------------
     1. LOADER
     ------------------------------------------------------------------------ */
  const initLoader = () => {
    const loader = document.getElementById('loader');
    const progressBar = document.getElementById('loader-progress');
    if (!loader) return;

    let progress = 0;
    const target = 100;
    const tick = () => {
      progress += Math.random() * 18 + 6;
      if (progress >= target) {
        progress = target;
        if (progressBar) progressBar.style.width = `${progress}%`;
        finishLoading();
        return;
      }
      if (progressBar) progressBar.style.width = `${progress}%`;
      setTimeout(tick, 120);
    };

    const finishLoading = () => {
      setTimeout(() => {
        loader.classList.add('loaded');
        document.body.classList.remove('no-scroll');
        loader.addEventListener('transitionend', () => {
          loader.setAttribute('aria-hidden', 'true');
          loader.style.display = 'none';
        }, { once: true });
        // Kick off entrance-dependent features once loader is gone.
        window.dispatchEvent(new CustomEvent('portfolio:loaded'));
      }, 250);
    };

    document.body.classList.add('no-scroll');

    if (document.readyState === 'complete') {
      tick();
    } else {
      window.addEventListener('load', tick, { once: true });
      // Safety net in case 'load' takes too long.
      setTimeout(tick, 1200);
    }
  };

  /* ------------------------------------------------------------------------
     2. TYPING EFFECT
     ------------------------------------------------------------------------ */
  const initTypingEffect = () => {
    const target = document.getElementById('typedRole');
    if (!target) return;

    const roles = [
      'Frontend Developer',
      'Computer Science Student',
      'AI Enthusiast',
      'Future Full Stack Developer',
    ];

    if (prefersReducedMotion) {
      target.textContent = roles[0];
      return;
    }

    let roleIndex = 0;
    let charIndex = 0;
    let deleting = false;

    const TYPE_SPEED = 65;
    const DELETE_SPEED = 35;
    const HOLD_TIME = 1600;
    const SWAP_PAUSE = 350;

    const step = () => {
      const currentRole = roles[roleIndex];

      if (!deleting) {
        charIndex++;
        target.textContent = currentRole.slice(0, charIndex);
        if (charIndex === currentRole.length) {
          deleting = true;
          setTimeout(step, HOLD_TIME);
          return;
        }
        setTimeout(step, TYPE_SPEED);
      } else {
        charIndex--;
        target.textContent = currentRole.slice(0, charIndex);
        if (charIndex === 0) {
          deleting = false;
          roleIndex = (roleIndex + 1) % roles.length;
          setTimeout(step, SWAP_PAUSE);
          return;
        }
        setTimeout(step, DELETE_SPEED);
      }
    };

    setTimeout(step, 400);
  };

  /* ------------------------------------------------------------------------
     3. INTERSECTION OBSERVER REVEAL
     ------------------------------------------------------------------------ */
  const initRevealObserver = () => {
    const items = qsa('.reveal-up');
    if (!items.length) return;

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('in-view'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
    );

    items.forEach((el) => observer.observe(el));
  };

  /* ------------------------------------------------------------------------
     4. ANIMATED SKILL BARS
     ------------------------------------------------------------------------ */
  const initSkillBars = () => {
    const bars = qsa('.bar-fill');
    if (!bars.length) return;

    if (!('IntersectionObserver' in window)) {
      bars.forEach((bar) => {
        bar.style.width = `${bar.dataset.value}%`;
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const bar = entry.target;
            const value = bar.dataset.value || '0';
            requestAnimationFrame(() => {
              bar.style.width = `${value}%`;
            });
            observer.unobserve(bar);
          }
        });
      },
      { threshold: 0.4 }
    );

    bars.forEach((bar) => observer.observe(bar));
  };

  /* ------------------------------------------------------------------------
     5. ANIMATED COUNTERS
     ------------------------------------------------------------------------ */
  const initCounters = () => {
    const counters = qsa('.counter-num');
    if (!counters.length) return;

    const animateCounter = (el) => {
      const target = parseInt(el.dataset.target, 10) || 0;
      if (prefersReducedMotion) {
        el.textContent = String(target);
        return;
      }
      const duration = 1500;
      const startTime = performance.now();

      const step = (now) => {
        const elapsed = now - startTime;
        const progress = clamp(elapsed / duration, 0, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = Math.round(lerp(0, target, eased));
        el.textContent = String(value);
        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          el.textContent = String(target);
        }
      };
      requestAnimationFrame(step);
    };

    if (!('IntersectionObserver' in window)) {
      counters.forEach(animateCounter);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );

    counters.forEach((el) => observer.observe(el));
  };

  /* ------------------------------------------------------------------------
     6. PROJECT FILTERING
     ------------------------------------------------------------------------ */
  const initProjectFilters = () => {
    const filterBtns = qsa('.filter-btn');
    const grid = document.getElementById('projectsGrid');
    if (!filterBtns.length || !grid) return;

    const cards = qsa('.project-card', grid);

    filterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;

        filterBtns.forEach((b) => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');

        cards.forEach((card) => {
          const category = card.dataset.category;
          const show = filter === 'all' || category === filter;
          card.classList.toggle('is-hidden', !show);
        });
      });
    });
  };

  /* ------------------------------------------------------------------------
     7. NAVBAR ACTIVE LINKS (scroll spy)
     ------------------------------------------------------------------------ */
  const initScrollSpy = () => {
    const sections = qsa('main section[id]');
    const navLinks = qsa('.nav-links a');
    if (!sections.length || !navLinks.length) return;

    const linkFor = (id) => navLinks.find((a) => a.getAttribute('href') === `#${id}`);

    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const link = linkFor(entry.target.id);
          if (!link) return;
          if (entry.isIntersecting) {
            navLinks.forEach((a) => a.classList.remove('active'));
            link.classList.add('active');
          }
        });
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
    );

    sections.forEach((section) => observer.observe(section));
  };

  /* ------------------------------------------------------------------------
     8. SMOOTH SCROLLING (anchor links)
     ------------------------------------------------------------------------ */
  const initSmoothScroll = () => {
    const anchors = qsa('a[href^="#"]');
    anchors.forEach((anchor) => {
      anchor.addEventListener('click', (e) => {
        const hash = anchor.getAttribute('href');
        if (!hash || hash === '#') return;
        const target = document.querySelector(hash);
        if (!target) return;
        e.preventDefault();

        const header = document.getElementById('siteHeader');
        const offset = (header?.offsetHeight || 84) - 8;
        const top = target.getBoundingClientRect().top + window.pageYOffset - offset;

        window.scrollTo({
          top,
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
        });

        // Close mobile menu if open
        closeMobileMenu();

        // Move focus for accessibility after scroll settles
        setTimeout(() => {
          target.setAttribute('tabindex', '-1');
          target.focus({ preventScroll: true });
        }, prefersReducedMotion ? 0 : 500);
      });
    });
  };

  /* ------------------------------------------------------------------------
     9. MOBILE NAVIGATION + HAMBURGER
     ------------------------------------------------------------------------ */
  let closeMobileMenu = () => {};

  const initMobileNav = () => {
    const hamburger = document.getElementById('hamburgerBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    if (!hamburger || !mobileMenu) return;

    const open = () => {
      hamburger.classList.add('active');
      hamburger.setAttribute('aria-expanded', 'true');
      hamburger.setAttribute('aria-label', 'Close menu');
      mobileMenu.classList.add('open');
      mobileMenu.setAttribute('aria-hidden', 'false');
      document.body.classList.add('menu-open');
    };

    const close = () => {
      hamburger.classList.remove('active');
      hamburger.setAttribute('aria-expanded', 'false');
      hamburger.setAttribute('aria-label', 'Open menu');
      mobileMenu.classList.remove('open');
      mobileMenu.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('menu-open');
    };

    closeMobileMenu = close;

    hamburger.addEventListener('click', () => {
      const isOpen = mobileMenu.classList.contains('open');
      isOpen ? close() : open();
    });

    qsa('a', mobileMenu).forEach((link) => {
      link.addEventListener('click', close);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileMenu.classList.contains('open')) {
        close();
        hamburger.focus();
      }
    });
  };

  /* ------------------------------------------------------------------------
     10. STICKY HEADER + HIDE/SHOW ON SCROLL
     ------------------------------------------------------------------------ */
  const initHeaderScrollBehavior = () => {
    const header = document.getElementById('siteHeader');
    if (!header) return;

    let lastScroll = window.pageYOffset;
    let ticking = false;

    const update = () => {
      const current = window.pageYOffset;

      header.classList.toggle('scrolled', current > 40);

      if (current > lastScroll && current > 160) {
        header.classList.add('hide');
      } else {
        header.classList.remove('hide');
      }

      lastScroll = current;
      ticking = false;
    };

    on(window, 'scroll', () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    });

    update();
  };

  /* ------------------------------------------------------------------------
     11. BACK TO TOP
     ------------------------------------------------------------------------ */
  const initBackToTop = () => {
    const btn = document.getElementById('backToTop');
    if (!btn) return;

    const toggleVisibility = throttle(() => {
      btn.style.opacity = window.pageYOffset > 500 ? '1' : '0.4';
    }, 150);

    on(window, 'scroll', toggleVisibility);
    toggleVisibility();

    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    });
  };

  /* ------------------------------------------------------------------------
     12. MAGNETIC BUTTONS
     ------------------------------------------------------------------------ */
  const initMagneticButtons = () => {
    if (prefersReducedMotion || window.matchMedia('(hover: none)').matches) return;

    const magnets = qsa('.magnetic');
    magnets.forEach((el) => {
      let rafId = null;

      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;

        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          el.style.transform = `translate(${x * 0.25}px, ${y * 0.35}px)`;
        });
      });

      el.addEventListener('mouseleave', () => {
        if (rafId) cancelAnimationFrame(rafId);
        el.style.transform = 'translate(0, 0)';
      });
    });
  };

  /* ------------------------------------------------------------------------
     13. RIPPLE EFFECT
     ------------------------------------------------------------------------ */
  const initRippleEffect = () => {
    const buttons = qsa('.btn');
    buttons.forEach((btn) => {
      btn.style.position = btn.style.position || 'relative';
      btn.style.overflow = 'hidden';

      btn.addEventListener('click', (e) => {
        if (prefersReducedMotion) return;
        const rect = btn.getBoundingClientRect();
        const ripple = document.createElement('span');
        const size = Math.max(rect.width, rect.height);
        ripple.className = 'ripple';
        ripple.style.width = `${size}px`;
        ripple.style.height = `${size}px`;
        ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
        ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
        btn.appendChild(ripple);
        ripple.addEventListener('animationend', () => ripple.remove());
      });
    });
  };

  /* ------------------------------------------------------------------------
     14. CURSOR GLOW
     ------------------------------------------------------------------------ */
  const initCursorGlow = () => {
    const glow = document.getElementById('cursorGlow');
    if (!glow || prefersReducedMotion || window.matchMedia('(hover: none)').matches) return;

    let mouseX = 0;
    let mouseY = 0;
    let glowX = 0;
    let glowY = 0;
    let active = false;

    on(window, 'mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!active) {
        active = true;
        glow.classList.add('active');
      }
    });

    on(document, 'mouseleave', () => {
      active = false;
      glow.classList.remove('active');
    }, { passive: true });

    const animate = () => {
      glowX = lerp(glowX, mouseX, 0.12);
      glowY = lerp(glowY, mouseY, 0.12);
      glow.style.transform = `translate(${glowX}px, ${glowY}px) translate(-50%, -50%)`;
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  };

  /* ------------------------------------------------------------------------
     15. CARD TILT
     ------------------------------------------------------------------------ */
  const initCardTilt = () => {
    if (prefersReducedMotion || window.matchMedia('(hover: none)').matches) return;

    const cards = qsa('[data-tilt]');
    const MAX_TILT = 8;

    cards.forEach((card) => {
      let rafId = null;

      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width;
        const py = (e.clientY - rect.top) / rect.height;
        const rotateX = (0.5 - py) * MAX_TILT;
        const rotateY = (px - 0.5) * MAX_TILT;

        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
        });
      });

      card.addEventListener('mouseleave', () => {
        if (rafId) cancelAnimationFrame(rafId);
        card.style.transform = 'perspective(800px) rotateX(0) rotateY(0) translateY(0)';
      });
    });
  };

  /* ------------------------------------------------------------------------
     16. PARALLAX (hero shapes)
     ------------------------------------------------------------------------ */
  const initParallax = () => {
    if (prefersReducedMotion) return;

    const shapes = qsa('.hero-shape');
    if (!shapes.length) return;

    let ticking = false;

    const update = () => {
      const scrollY = window.pageYOffset;
      shapes.forEach((shape, i) => {
        const speed = i % 2 === 0 ? 0.15 : 0.25;
        shape.style.transform = `translateY(${scrollY * speed}px)`;
      });
      ticking = false;
    };

    on(window, 'scroll', () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    });
  };

  /* ------------------------------------------------------------------------
     17. AURORA CANVAS ANIMATION + FLOATING PARTICLES
     ------------------------------------------------------------------------ */
  const initAuroraCanvas = () => {
    const canvas = document.getElementById('aurora-canvas');
    if (!canvas || !canvas.getContext) return;

    const ctx = canvas.getContext('2d');
    let width, height, dpr;
    let particles = [];
    let animationId = null;

    const colors = ['#6366f1', '#06b6d4', '#8b5cf6'];

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const createParticles = () => {
      const count = Math.round((width * height) / 90000);
      particles = Array.from({ length: clamp(count, 18, 46) }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.6 + 0.6,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: Math.random() * 0.4 + 0.15,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      animationId = requestAnimationFrame(draw);
    };

    resize();
    createParticles();

    if (prefersReducedMotion) {
      draw();
      cancelAnimationFrame(animationId);
    } else {
      draw();
    }

    on(window, 'resize', debounce(() => {
      resize();
      createParticles();
    }, 200));

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        cancelAnimationFrame(animationId);
      } else if (!prefersReducedMotion) {
        draw();
      }
    });
  };

  /* ------------------------------------------------------------------------
     18. DYNAMIC YEAR
     ------------------------------------------------------------------------ */
  const initDynamicYear = () => {
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());
  };

  /* ------------------------------------------------------------------------
     19. TOAST NOTIFICATIONS
     ------------------------------------------------------------------------ */
  const showToast = (message, type = 'success') => {
    const existing = qs('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast${type === 'error' ? ' toast-error' : ''}`;
    toast.setAttribute('role', 'status');
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      setTimeout(() => toast.remove(), 400);
    }, 3200);
  };

  /* ------------------------------------------------------------------------
     20. CONTACT FORM VALIDATION
     ------------------------------------------------------------------------ */
  const initContactForm = () => {
    const form = document.getElementById('contactForm');
    const submitBtn = document.getElementById('cf-submit');
    const status = document.getElementById('formStatus');
    if (!form || !submitBtn) return;

    const nameInput = document.getElementById('cf-name');
    const emailInput = document.getElementById('cf-email');
    const messageInput = document.getElementById('cf-message');

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const setRowState = (input, isValid, message) => {
      const row = input.closest('.form-row');
      if (!row) return;
      row.classList.toggle('error', !isValid);

      let errorEl = row.querySelector('.field-error');
      if (!isValid) {
        if (!errorEl) {
          errorEl = document.createElement('p');
          errorEl.className = 'field-error';
          row.appendChild(errorEl);
        }
        errorEl.textContent = message;
      } else if (errorEl) {
        errorEl.textContent = '';
      }
    };

    const validate = () => {
      let valid = true;

      if (!nameInput.value.trim()) {
        setRowState(nameInput, false, 'Please enter your name.');
        valid = false;
      } else {
        setRowState(nameInput, true);
      }

      if (!emailInput.value.trim() || !emailPattern.test(emailInput.value.trim())) {
        setRowState(emailInput, false, 'Please enter a valid email address.');
        valid = false;
      } else {
        setRowState(emailInput, true);
      }

      if (!messageInput.value.trim() || messageInput.value.trim().length < 10) {
        setRowState(messageInput, false, 'Message should be at least 10 characters.');
        valid = false;
      } else {
        setRowState(messageInput, true);
      }

      return valid;
    };

    [nameInput, emailInput, messageInput].forEach((input) => {
      input.addEventListener('blur', () => {
        if (input.closest('.form-row').classList.contains('error')) {
          validate();
        }
      });
    });

    submitBtn.addEventListener('click', () => {
      if (!validate()) {
        if (status) {
          status.textContent = 'Please fix the highlighted fields.';
          status.className = 'form-status error';
        }
        return;
      }

      submitBtn.disabled = true;
      const originalLabel = submitBtn.querySelector('span')?.textContent || 'Send Message';
      const labelSpan = submitBtn.querySelector('span');
      if (labelSpan) labelSpan.textContent = 'Sending...';

      // Simulated send — no backend wired up.
      setTimeout(() => {
        if (status) {
          status.textContent = `Thanks, ${nameInput.value.trim()}! Your message has been noted.`;
          status.className = 'form-status success';
        }
        showToast('Message sent successfully.');
        form.reset();
        [nameInput, emailInput, messageInput].forEach((input) => setRowState(input, true));
        submitBtn.disabled = false;
        if (labelSpan) labelSpan.textContent = originalLabel;
      }, 900);
    });
  };

  /* ------------------------------------------------------------------------
     21. LAZY LOADING (images with data-src, if any are added later)
     ------------------------------------------------------------------------ */
  const initLazyLoading = () => {
    const lazyImages = qsa('img[data-src]');
    if (!lazyImages.length) return;

    if (!('IntersectionObserver' in window)) {
      lazyImages.forEach((img) => {
        img.src = img.dataset.src;
      });
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          observer.unobserve(img);
        }
      });
    });

    lazyImages.forEach((img) => observer.observe(img));
  };

  /* ------------------------------------------------------------------------
     INIT
     ------------------------------------------------------------------------ */
  const init = () => {
    initLoader();
    initTypingEffect();
    initRevealObserver();
    initSkillBars();
    initCounters();
    initProjectFilters();
    initScrollSpy();
    initSmoothScroll();
    initMobileNav();
    initHeaderScrollBehavior();
    initBackToTop();
    initMagneticButtons();
    initRippleEffect();
    initCursorGlow();
    initCardTilt();
    initParallax();
    initAuroraCanvas();
    initDynamicYear();
    initContactForm();
    initLazyLoading();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
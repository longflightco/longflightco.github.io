/* LongFlight — shared UI behaviors */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Page-load fade ---------- */
  document.documentElement.classList.remove("no-js");
  window.addEventListener("DOMContentLoaded", function () {
    document.body.classList.add("is-ready");
  });

  /* ---------- Nav: transparent → solid on scroll ---------- */
  var nav = document.querySelector(".nav");
  var hero = document.querySelector("[data-hero]");
  var heroIsDark = hero && hero.hasAttribute("data-hero-dark");

  function onScroll() {
    if (!nav) return;
    var solid = window.scrollY > 24;
    nav.classList.toggle("is-solid", solid);
    if (heroIsDark) {
      // Only treat nav as "over dark" while the dark hero is still behind it.
      var overHero = window.scrollY < (hero.offsetHeight - 90);
      nav.classList.toggle("is-over-dark", overHero && !solid);
    }
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- Mobile menu ---------- */
  var toggle = document.querySelector(".nav__toggle");
  var mobile = document.querySelector(".nav__mobile");
  function setMenu(open) {
    document.body.classList.toggle("menu-open", open);
    if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
    document.body.style.overflow = open ? "hidden" : "";
  }
  if (toggle) {
    toggle.addEventListener("click", function () {
      setMenu(!document.body.classList.contains("menu-open"));
    });
  }
  if (mobile) {
    mobile.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { setMenu(false); });
    });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && document.body.classList.contains("menu-open")) setMenu(false);
  });

  /* ---------- Reveal on scroll ---------- */
  var reveals = document.querySelectorAll(".reveal");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -8% 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Current year ---------- */
  var yr = document.querySelectorAll("[data-year]");
  yr.forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- Cart → Shopify checkout (Option C) ---------- */
  // Shopify storefront that owns the cart + checkout. If you later move the
  // store to a different domain (e.g. shop.longflight.shop), change ONLY this.
  var SHOP_DOMAIN = "shop.longflight.shop";

  // The real cart lives on Shopify (a different domain), so the count can't be
  // read here — show a plain "Bag" and link it to the Shopify cart page.
  document.querySelectorAll("[data-cart-count]").forEach(function (c) {
    if (c.parentElement) c.parentElement.textContent = "Bag";
  });
  document.querySelectorAll(".nav__cart").forEach(function (el) {
    el.style.cursor = "pointer";
    el.addEventListener("click", function () {
      window.location.href = "https://" + SHOP_DOMAIN + "/cart";
    });
  });

  // PDP: selected option(s) → exact Shopify variant → straight to checkout.
  // Reads every option group (Colour + size selectors) in DOM order and joins
  // them into the variant key, e.g. "Grey|M|L" or "Grey|M" or "M".
  var lfVariants = document.querySelector("[data-lf-variants]");
  if (lfVariants) {
    var VMAP = null;
    try { VMAP = JSON.parse(lfVariants.textContent); } catch (e) { VMAP = null; }
    if (VMAP) {
      var optionGroups = Array.prototype.slice.call(document.querySelectorAll(".pdp__info .sizes"));
      var selectedVariant = function () {
        var parts = optionGroups.map(function (g) {
          var b = g.querySelector('[aria-pressed="true"]');
          return b ? b.textContent.trim() : null;
        });
        if (parts.indexOf(null) !== -1) return null;
        return VMAP[parts.join("|")] || null;
      };
      var currentQty = function () {
        var i = document.querySelector("[data-qty-input]");
        var v = i ? parseInt(i.value, 10) : 1;
        return (isNaN(v) || v < 1) ? 1 : v;
      };
      document.querySelectorAll("[data-add-to-cart]").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          var v = selectedVariant();
          if (!v) return;
          window.location.href = "https://" + SHOP_DOMAIN + "/cart/" + v + ":" + currentQty();
        });
      });
    }
  }

  /* ---------- Product option toggles ---------- */
  function groupToggle(selector) {
    document.querySelectorAll(selector).forEach(function (group) {
      var items = group.querySelectorAll("[aria-pressed]");
      items.forEach(function (item) {
        item.addEventListener("click", function () {
          items.forEach(function (i) { i.setAttribute("aria-pressed", "false"); });
          item.setAttribute("aria-pressed", "true");
        });
      });
    });
  }
  groupToggle(".sizes");

  /* ---------- Size-chart modal ---------- */
  document.querySelectorAll("[data-sizechart-open]").forEach(function (btn) {
    var dlg = document.getElementById(btn.getAttribute("data-sizechart-open"));
    if (!dlg) return;
    btn.addEventListener("click", function () {
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
    });
    dlg.querySelectorAll("[data-dialog-close]").forEach(function (c) {
      c.addEventListener("click", function () { dlg.close ? dlg.close() : dlg.removeAttribute("open"); });
    });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) (dlg.close ? dlg.close() : dlg.removeAttribute("open")); });
  });

  /* ---------- Quantity stepper ---------- */
  document.querySelectorAll("[data-qty]").forEach(function (q) {
    var input = q.querySelector("[data-qty-input]");
    var dec = q.querySelector("[data-qty-dec]");
    var inc = q.querySelector("[data-qty-inc]");
    function clampVal() {
      var v = parseInt(input.value, 10);
      if (isNaN(v) || v < 1) v = 1;
      input.value = v;
    }
    if (dec) dec.addEventListener("click", function () { input.value = Math.max(1, (parseInt(input.value, 10) || 1) - 1); });
    if (inc) inc.addEventListener("click", function () { input.value = (parseInt(input.value, 10) || 1) + 1; });
    if (input) input.addEventListener("change", clampVal);
  });

  /* ---------- Product gallery: thumb → main swap ---------- */
  var pdpMain = document.querySelector("[data-pdp-main]");
  var thumbs = document.querySelectorAll("[data-pdp-thumb]");
  if (pdpMain && thumbs.length) {
    thumbs.forEach(function (t) {
      t.addEventListener("click", function () {
        var src = t.getAttribute("data-src");
        if (!src) return;
        pdpMain.src = src;
        thumbs.forEach(function (x) { x.setAttribute("aria-current", "false"); });
        t.setAttribute("aria-current", "true");
      });
    });
  }

  /* ---------- PDP image gallery: mobile dots + optional colour swap ---------- */
  var gallery = document.querySelector(".pdp__gallery");
  if (gallery) {
    var allSlides = Array.prototype.slice.call(gallery.querySelectorAll(".media"));
    var isColorGallery = gallery.hasAttribute("data-color-gallery");

    var visibleSlides = function () {
      return allSlides.filter(function (m) { return m.style.display !== "none"; });
    };
    var slideOffset = function (slide) {
      return slide.getBoundingClientRect().left - gallery.getBoundingClientRect().left + gallery.scrollLeft;
    };

    // Build (or rebuild) the mobile pagination dots for the currently-visible slides.
    var dots = null, dotBtns = [];
    var buildDots = function () {
      if (dots && dots.parentNode) dots.parentNode.removeChild(dots);
      dots = null; dotBtns = [];
      var slides = visibleSlides();
      if (slides.length < 2) return;
      dots = document.createElement("div");
      dots.className = "pdp__dots";
      dots.setAttribute("aria-label", "Product image navigation");
      slides.forEach(function (slide, i) {
        var b = document.createElement("button");
        b.type = "button";
        b.setAttribute("aria-label", "View image " + (i + 1) + " of " + slides.length);
        b.setAttribute("aria-current", i === 0 ? "true" : "false");
        b.addEventListener("click", function () {
          gallery.scrollTo({ left: slideOffset(slide), behavior: "smooth" });
        });
        dots.appendChild(b);
      });
      gallery.insertAdjacentElement("afterend", dots);
      dotBtns = dots.querySelectorAll("button");
    };

    // Colour swap: show only the chosen colour's media; the first visible one is the hero.
    var applyColour = function (color) {
      color = color.toLowerCase();
      allSlides.forEach(function (m) {
        var c = m.getAttribute("data-color");
        m.style.display = (!c || c === color) ? "" : "none";
        m.classList.remove("is-hero");
      });
      var vis = visibleSlides();
      if (vis[0]) vis[0].classList.add("is-hero");
      gallery.scrollLeft = 0;
      buildDots();
    };

    if (isColorGallery) {
      var colourGroup = document.querySelector('.sizes[aria-label="Colour"]');
      var pressed = colourGroup && colourGroup.querySelector('[aria-pressed="true"]');
      applyColour(pressed ? pressed.textContent.trim() : "grey");
      if (colourGroup) {
        colourGroup.querySelectorAll("button").forEach(function (btn) {
          btn.addEventListener("click", function () { applyColour(btn.textContent.trim()); });
        });
      }
    } else {
      buildDots();
    }

    var ticking = false;
    gallery.addEventListener("scroll", function () {
      if (ticking || !dots) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        ticking = false;
        var slides = visibleSlides();
        var gLeft = gallery.getBoundingClientRect().left;
        var idx = 0, min = Infinity;
        slides.forEach(function (s, i) {
          var d = Math.abs(s.getBoundingClientRect().left - gLeft);
          if (d < min) { min = d; idx = i; }
        });
        dotBtns.forEach(function (d, i) { d.setAttribute("aria-current", i === idx ? "true" : "false"); });
      });
    }, { passive: true });
  }

  /* ---------- Mobile floating buy bar (PDP) ---------- */
  var buybar = document.querySelector(".buybar");
  var mobileBar = document.querySelector(".addbar-mobile");
  if (buybar && mobileBar && "IntersectionObserver" in window) {
    var barObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        // Show floating bar once the inline buybar has scrolled out of view.
        mobileBar.classList.toggle("is-visible", !entry.isIntersecting && window.innerWidth < 960);
      });
    }, { threshold: 0 });
    barObserver.observe(buybar);
  }
})();

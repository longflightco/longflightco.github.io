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

  /* ---------- On-site cart (checks out to Shopify) ---------- */
  // The cart lives in the browser (localStorage) so shoppers can collect items
  // across pages, then check out all at once via one Shopify multi-item link:
  //   https://SHOP_DOMAIN/cart/{v1}:{q1},{v2}:{q2},...
  // If the store ever moves domains, change ONLY this line.
  var SHOP_DOMAIN = "shop.longflight.shop";
  var CART_KEY = "lf_cart_v1";

  function readCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch (e) { return []; }
  }
  function writeCart(items) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch (e) {}
  }
  function cartCount(items) {
    return items.reduce(function (n, it) { return n + it.qty; }, 0);
  }
  function money(n) { return "$" + (Math.round(n * 100) / 100).toFixed(2); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var drawer, overlay, itemsEl, subtotalEl, footEl;

  function buildDrawer() {
    overlay = document.createElement("div");
    overlay.className = "cart-overlay";
    drawer = document.createElement("aside");
    drawer.className = "cart-drawer";
    drawer.setAttribute("aria-label", "Shopping bag");
    drawer.setAttribute("aria-hidden", "true");
    drawer.innerHTML =
      '<div class="cart-drawer__head"><h2>Your bag</h2>' +
        '<button class="cart-drawer__close" type="button" aria-label="Close bag">&times;</button></div>' +
      '<div class="cart-drawer__body"></div>' +
      '<div class="cart-drawer__foot">' +
        '<div class="cart-drawer__row"><span>Subtotal</span><span class="cart-drawer__subtotal">$0.00</span></div>' +
        '<p class="cart-drawer__note">Taxes and shipping calculated at checkout.</p>' +
        '<button class="btn cart-drawer__checkout" type="button">Checkout</button>' +
        '<button class="cart-drawer__continue" type="button">Continue shopping</button>' +
      '</div>';
    document.body.appendChild(overlay);
    document.body.appendChild(drawer);
    itemsEl = drawer.querySelector(".cart-drawer__body");
    subtotalEl = drawer.querySelector(".cart-drawer__subtotal");
    footEl = drawer.querySelector(".cart-drawer__foot");

    overlay.addEventListener("click", closeCart);
    drawer.querySelector(".cart-drawer__close").addEventListener("click", closeCart);
    drawer.querySelector(".cart-drawer__continue").addEventListener("click", closeCart);
    drawer.querySelector(".cart-drawer__checkout").addEventListener("click", checkout);
    itemsEl.addEventListener("click", function (e) {
      var row = e.target.closest("[data-id]");
      if (!row) return;
      var id = row.getAttribute("data-id");
      if (e.target.closest("[data-cart-remove]")) bumpQty(id, -1e9);
      else if (e.target.closest("[data-cart-inc]")) bumpQty(id, 1);
      else if (e.target.closest("[data-cart-dec]")) bumpQty(id, -1);
    });
  }

  function openCart() { if (drawer) { renderCart(); document.body.classList.add("cart-open"); drawer.setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden"; } }
  function closeCart() { if (drawer) { document.body.classList.remove("cart-open"); drawer.setAttribute("aria-hidden", "true"); document.body.style.overflow = ""; } }

  function renderCount() {
    var n = cartCount(readCart());
    document.querySelectorAll("[data-cart-count]").forEach(function (c) { c.textContent = n; });
  }

  function renderCart() {
    var items = readCart();
    if (!items.length) {
      itemsEl.innerHTML = '<p class="cart-empty">Your bag is empty.</p>';
      footEl.classList.add("is-empty");
      subtotalEl.textContent = money(0);
      renderCount();
      return;
    }
    footEl.classList.remove("is-empty");
    var sub = 0;
    itemsEl.innerHTML = items.map(function (it) {
      sub += it.price * it.qty;
      var img = it.image ? '<a class="cart-item__img" href="' + esc(it.url) + '"><img src="' + esc(it.image) + '" alt="" /></a>' : '<span class="cart-item__img"></span>';
      return '<div class="cart-item" data-id="' + esc(it.id) + '">' +
        img +
        '<div class="cart-item__info">' +
          '<a class="cart-item__name" href="' + esc(it.url) + '">' + esc(it.name) + '</a>' +
          (it.variant ? '<div class="cart-item__variant">' + esc(it.variant) + '</div>' : '') +
          '<div class="cart-item__ctl">' +
            '<div class="cart-qty">' +
              '<button type="button" data-cart-dec aria-label="Decrease quantity">&minus;</button>' +
              '<span class="cart-qty__v">' + it.qty + '</span>' +
              '<button type="button" data-cart-inc aria-label="Increase quantity">+</button>' +
            '</div>' +
            '<span class="cart-item__price">' + money(it.price * it.qty) + '</span>' +
          '</div>' +
        '</div>' +
        '<button class="cart-item__remove" type="button" data-cart-remove aria-label="Remove item">Remove</button>' +
      '</div>';
    }).join("");
    subtotalEl.textContent = money(sub);
    renderCount();
  }

  function addItem(item) {
    var items = readCart(), found = null;
    for (var i = 0; i < items.length; i++) { if (items[i].id === item.id) { found = items[i]; break; } }
    if (found) found.qty += item.qty; else items.push(item);
    writeCart(items);
    renderCount();
  }
  function bumpQty(id, delta) {
    var items = readCart();
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) {
        items[i].qty += delta;
        if (items[i].qty < 1) items.splice(i, 1);
        break;
      }
    }
    writeCart(items);
    renderCart();
  }
  function checkout() {
    var items = readCart();
    if (!items.length) return;
    var path = items.map(function (it) { return it.id + ":" + it.qty; }).join(",");
    window.location.href = "https://" + SHOP_DOMAIN + "/cart/" + path;
  }

  buildDrawer();
  renderCount();

  // Bag button(s) open the on-site drawer — never navigate away to Shopify.
  document.querySelectorAll(".nav__cart").forEach(function (el) {
    el.style.cursor = "pointer";
    el.addEventListener("click", function (e) { e.preventDefault(); openCart(); });
  });
  // Mobile menu "Bag (N)" line also opens the drawer.
  var mfoot = document.querySelector(".nav__mobile-foot [data-cart-count]");
  if (mfoot && mfoot.parentElement) {
    mfoot.parentElement.style.cursor = "pointer";
    mfoot.parentElement.addEventListener("click", function () { setMenu(false); openCart(); });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && document.body.classList.contains("cart-open")) closeCart();
  });

  // PDP: selected option(s) → exact Shopify variant → add to the on-site bag.
  // Reads every option group (Colour + size selectors) in DOM order and joins
  // them into the variant key, e.g. "Grey|M|L" or "Grey|M" or "M".
  var lfVariants = document.querySelector("[data-lf-variants]");
  if (lfVariants) {
    var VMAP = null;
    try { VMAP = JSON.parse(lfVariants.textContent); } catch (e) { VMAP = null; }
    if (VMAP) {
      var optionGroups = Array.prototype.slice.call(document.querySelectorAll(".pdp__info .sizes"));
      var selectedParts = function () {
        return optionGroups.map(function (g) {
          var b = g.querySelector('[aria-pressed="true"]');
          return b ? b.textContent.trim() : null;
        });
      };
      var selectedVariant = function () {
        var parts = selectedParts();
        if (parts.indexOf(null) !== -1) return null;
        return VMAP[parts.join("|")] || null;
      };
      var currentQty = function () {
        var i = document.querySelector("[data-qty-input]");
        var v = i ? parseInt(i.value, 10) : 1;
        return (isNaN(v) || v < 1) ? 1 : v;
      };
      var pdpName = function () {
        var h = document.querySelector(".pdp__info h1");
        return h ? h.textContent.trim() : "Item";
      };
      var pdpPrice = function () {
        var p = document.querySelector(".pdp__price");
        var m = p && p.textContent.match(/\$([0-9]+(?:\.[0-9]{1,2})?)/);
        return m ? parseFloat(m[1]) : 0;
      };
      var pdpImage = function () {
        var hero = document.querySelector(".pdp__gallery .media.is-hero img");
        if (!hero) {
          var vis = Array.prototype.slice.call(document.querySelectorAll(".pdp__gallery .media"))
            .filter(function (m) { return m.style.display !== "none"; });
          hero = (vis[0] && vis[0].querySelector("img")) || document.querySelector(".pdp__gallery img");
        }
        return hero ? hero.getAttribute("src") : "";
      };
      document.querySelectorAll("[data-add-to-cart]").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          var v = selectedVariant();
          if (!v) return;
          var parts = selectedParts().filter(Boolean);
          addItem({
            id: String(v),
            name: pdpName(),
            variant: parts.join(" / "),
            price: pdpPrice(),
            qty: currentQty(),
            image: pdpImage(),
            url: (window.location.pathname.split("/").pop() || "index.html")
          });
          openCart();
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

/* LongFlight — Meta Pixel base code + ad-click passthrough
   Fill in PIXEL_ID below (and PIXEL_ID_PLACEHOLDER in every .html file's
   noscript tag) once the Pixel exists in Meta Events Manager. */
(function () {
  "use strict";

  var PIXEL_ID = "PIXEL_ID_PLACEHOLDER";

  /* eslint-disable */
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', PIXEL_ID);
  fbq('track', 'PageView');
  /* eslint-enable */

  // The checkout hand-off (in main.js) happens on shop.longflight.shop, a
  // different domain from this site. Meta's own click-id cookie doesn't
  // cross that boundary, so we stash ?fbclid=... here and hand it back to
  // main.js to append to the Shopify checkout URL — Shopify's own Meta
  // pixel picks it up and re-establishes attribution on its side.
  var FBCLID_KEY = "lf_fbclid";
  var FBCLID_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
  try {
    var m = window.location.search.match(/[?&]fbclid=([^&]+)/);
    if (m) localStorage.setItem(FBCLID_KEY, m[1] + "|" + Date.now());
  } catch (e) {}

  window.lfFbclid = function () {
    try {
      var raw = localStorage.getItem(FBCLID_KEY);
      if (!raw) return null;
      var parts = raw.split("|");
      if (Date.now() - parseInt(parts[1], 10) > FBCLID_MAX_AGE_MS) return null;
      return parts[0];
    } catch (e) { return null; }
  };

  // ViewContent on product pages (any page with the variant map main.js uses).
  var lfVariants = document.querySelector("[data-lf-variants]");
  if (lfVariants) {
    var priceEl = document.querySelector(".pdp__price");
    var priceMatch = priceEl && priceEl.textContent.match(/\$([0-9]+(?:\.[0-9]{1,2})?)/);
    var nameEl = document.querySelector(".pdp__info h1");
    fbq('track', 'ViewContent', {
      content_name: nameEl ? nameEl.textContent.trim() : document.title,
      content_type: "product",
      currency: "CAD",
      value: priceMatch ? parseFloat(priceMatch[1]) : undefined
    });
  }
})();

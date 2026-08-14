/* ============================================================
   Content binding.
   content.json is the single source of truth. Decap writes it,
   this file applies it to the DOM and exposes it to the 3D layer.

   Markup carries data-c="path.to.field" and is filled at load.
   Nothing here knows about motion; the 3D scene reads window.VITS
   for the packaging strings so both stay in sync from one file.
   ============================================================ */
(function () {
  'use strict';

  function get(obj, path) {
    return path.split('.').reduce(function (o, k) {
      if (o == null) return undefined;
      return Array.isArray(o) && /^\d+$/.test(k) ? o[+k] : o[k];
    }, obj);
  }

  /* data-c fills text, data-c-html allows inline <b>/<em>, data-c-src fills images */
  function apply(root, data) {
    root.querySelectorAll('[data-c]').forEach(function (el) {
      var v = get(data, el.getAttribute('data-c'));
      if (v != null && v !== '') el.textContent = v;
    });
    root.querySelectorAll('[data-c-html]').forEach(function (el) {
      var v = get(data, el.getAttribute('data-c-html'));
      if (v != null && v !== '') el.innerHTML = v;
    });
    root.querySelectorAll('[data-c-src]').forEach(function (el) {
      var v = get(data, el.getAttribute('data-c-src'));
      if (v) el.setAttribute('src', v);
    });
    root.querySelectorAll('[data-c-href]').forEach(function (el) {
      var v = get(data, el.getAttribute('data-c-href'));
      if (v) el.setAttribute('href', v);
    });
    /* hide any element whose bound field is empty, so blank red-gate flags vanish */
    root.querySelectorAll('[data-c-if]').forEach(function (el) {
      var v = get(data, el.getAttribute('data-c-if'));
      if (v == null || v === '') el.style.display = 'none';
    });
  }

  /* Loaded before the 3D module runs, so the pack can draw from it on first paint. */
  window.VITS_READY = fetch('content.json', { cache: 'no-cache' })
    .then(function (r) {
      if (!r.ok) throw new Error('content.json ' + r.status);
      return r.json();
    })
    .then(function (data) {
      window.VITS = data;
      apply(document, data);
      document.dispatchEvent(new CustomEvent('vits:content', { detail: data }));
      return data;
    })
    .catch(function (err) {
      /* The page ships with its copy already in the markup, so a failed fetch
         degrades to the hard-coded text rather than an empty page. */
      console.warn('Content layer unavailable, using built-in copy:', err.message);
      window.VITS = null;
      return null;
    });
})();

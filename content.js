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

  /* data-c fills text, data-c-html allows inline <b>/<em>, data-c-src fills images
     force: reflect cleared fields too. Live editing needs to show an emptied box
     as empty; a normal page load must keep the built-in copy instead. */
  function apply(root, data, force) {
    function live(v) { return v != null && (force || v !== ''); }
    root.querySelectorAll('[data-c]').forEach(function (el) {
      var v = get(data, el.getAttribute('data-c'));
      if (live(v)) el.textContent = v;
    });
    root.querySelectorAll('[data-c-html]').forEach(function (el) {
      var v = get(data, el.getAttribute('data-c-html'));
      if (live(v)) el.innerHTML = v;
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

  /* In the CMS the page runs inside the preview iframe. The draft arrives by
     postMessage a beat after load, but the 3D pack reads its artwork exactly
     once at startup — so when framed, hold the ready signal for that first
     message. Without this the pack would boot from the last saved file and
     ignore whatever the editor is typing. Capped, so a preview never hangs. */
  var framed = window.parent !== window;

  /* The latest draft posted by the CMS. It always outranks the saved file:
     the fetch below and the first postMessage race each other on iframe
     reload, and when the message won, the fetch was clobbering the editor's
     unsaved work with the file — the pack then booted showing stale artwork. */
  var draft = null;

  function firstDraft() {
    return new Promise(function (resolve) {
      if (draft) { resolve(); return; }   /* already arrived; don't wait */
      var settled = false;
      function done() { if (!settled) { settled = true; resolve(); } }
      window.addEventListener('message', function (e) {
        if (e.origin === window.location.origin && e.data && e.data.type === 'vits:preview') done();
      });
      setTimeout(done, 1500);
    });
  }

  /* Each prototype owns its content file, so editing one cannot disturb another.
     The page names its own via data-content on the script tag; prototype 1 keeps
     the original name, so nothing has to change there. */
  var SRC = (document.currentScript &&
             document.currentScript.getAttribute('data-content')) || 'content.json';

  /* Loaded before the 3D module runs, so the pack can draw from it on first paint. */
  window.VITS_READY = fetch(SRC, { cache: 'no-cache' })
    .then(function (r) {
      if (!r.ok) throw new Error(SRC + ' ' + r.status);
      return r.json();
    })
    .then(function (data) {
      if (draft) return draft;   /* the editor's unsaved work is newer than the file */
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

  if (framed) {
    window.VITS_READY = window.VITS_READY
      .then(firstDraft)
      .then(function () { return window.VITS; });
  }

  /* ============================================================
     CMS preview channel.
     Decap renders this page in an iframe beside the edit form and
     posts the draft on every keystroke, so an editor sees their copy
     land in the real layout instead of reading a list of field names.
     Inert in normal browsing: nothing ever posts these messages.
     ============================================================ */

  function findBound(path) {
    return document.querySelector(
      '[data-c="' + path + '"],[data-c-html="' + path + '"],[data-c-src="' + path + '"]'
    );
  }

  /* Ring the element the editor is currently typing into and bring it on screen.
     Lenis owns the scroll position when it is running, so ask it rather than
     fighting it with scrollIntoView. */
  function reveal(path) {
    var el = findBound(path);
    if (!el) return;
    if (window.__lenis) window.__lenis.scrollTo(el, { offset: -140 });
    else el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('vits-cms-focus');
    void el.offsetWidth; /* reflow, so retyping in one field re-triggers the flash */
    el.classList.add('vits-cms-focus');
  }

  function installFocusStyle() {
    if (document.getElementById('vits-cms-style')) return;
    var s = document.createElement('style');
    s.id = 'vits-cms-style';
    s.textContent =
      '.vits-cms-focus{outline:2px solid #e2231a;outline-offset:6px;border-radius:2px;' +
      'animation:vitsCmsFocus 1.8s ease-out forwards}' +
      '@keyframes vitsCmsFocus{0%,70%{outline-color:#e2231a}100%{outline-color:transparent}}';
    document.head.appendChild(s);
  }

  window.addEventListener('message', function (e) {
    if (e.origin !== window.location.origin) return;
    var msg = e.data;
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'vits:preview' && msg.data) {
      installFocusStyle();
      draft = msg.data;
      window.VITS = msg.data;
      apply(document, msg.data, true);
      document.dispatchEvent(new CustomEvent('vits:content', { detail: msg.data }));
    } else if (msg.type === 'vits:reveal' && msg.path) {
      reveal(msg.path);
    }
  });
})();

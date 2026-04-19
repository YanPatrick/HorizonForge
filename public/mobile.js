(function () {
  /* ─── Mobile detection ──────────────────────────────────────
     Matches same condition as mobile.css media queries.
     pointer: coarse = real touch device.
     Early-return on desktop so zero JS runs there.
  ─────────────────────────────────────────────────────────── */
  var MQ = window.matchMedia('(max-width: 480px) and (pointer: coarse)');
  if (!MQ.matches) return;

  /* ─── Rotate overlay ───────────────────────────────────────
     The CSS shows/hides it based on orientation media query.
     We just inject the DOM element here.
  ─────────────────────────────────────────────────────────── */
  var rotateOverlay = document.createElement('div');
  rotateOverlay.id = 'mobile-rotate-msg';
  rotateOverlay.innerHTML =
    '<div class="mrm-icon">📱</div>' +
    '<p>Rotate your device to portrait to play</p>';
  document.body.appendChild(rotateOverlay);

  /* ─── Log overlay ──────────────────────────────────────────
     Slide-up overlay that holds the battle log (#log).
     #log is moved here from #center-col on DOMContentLoaded.
     mobile.css hides #log globally; #mobile-log-overlay #log
     overrides that to display it inside the overlay.
  ─────────────────────────────────────────────────────────── */
  var logOverlay = document.createElement('div');
  logOverlay.id = 'mobile-log-overlay';
  logOverlay.innerHTML =
    '<div class="mlo-header">' +
      '<span class="mlo-title">Battle Log</span>' +
      '<button id="mobile-log-close" type="button">✕</button>' +
    '</div>';
  document.body.appendChild(logOverlay);

  function setupLog() {
    var log = document.getElementById('log');
    if (log) logOverlay.appendChild(log);

    var closeBtn = document.getElementById('mobile-log-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        logOverlay.classList.remove('open');
      });
    }
  }

  /* ─── Log toggle button in header ─────────────────────────
     Appended to #hdr so it sits next to existing header items.
  ─────────────────────────────────────────────────────────── */
  function injectLogBtn() {
    var hdr = document.getElementById('hdr');
    if (!hdr) return;
    var btn = document.createElement('button');
    btn.id = 'mobile-log-btn';
    btn.setAttribute('type', 'button');
    btn.textContent = '▼ Log';
    btn.addEventListener('click', function () {
      logOverlay.classList.toggle('open');
    });
    hdr.appendChild(btn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setupLog();
      injectLogBtn();
    });
  } else {
    setupLog();
    injectLogBtn();
  }

  /* ─── Tap-select cell highlight ────────────────────────────
     battle.html handles the actual swap via G.fieldSel.
     mobile.js tracks selection independently (mSel) and adds
     CSS classes for visual feedback after each render() call.

     Classes added to #pfield .cell elements:
       .m-selected   — gold border on the selected cell
       .m-valid-drop — green tint on valid destination cells

     window.render is global (function declaration in non-module
     <script>) — safe to wrap after defer load.
  ─────────────────────────────────────────────────────────── */
  var mSel = null; // index (data-i) of selected pfield cell, or null

  function applyHighlight() {
    var cells = document.querySelectorAll('#pfield .cell');
    cells.forEach(function (cell) {
      cell.classList.remove('m-selected', 'm-valid-drop');
    });
    if (mSel === null) return;
    cells.forEach(function (cell) {
      var idx = parseInt(cell.getAttribute('data-i'), 10);
      if (idx === mSel) {
        cell.classList.add('m-selected');
      } else {
        cell.classList.add('m-valid-drop');
      }
    });
  }

  // Wrap window.render to re-apply highlights after every render cycle
  var _origRender = window.render;
  if (typeof _origRender === 'function') {
    window.render = function () {
      _origRender.apply(this, arguments);
      applyHighlight();
    };
  }

  // Event delegation: track selection on pfield clicks
  document.addEventListener('click', function (e) {
    var cell = e.target.closest('#pfield .cell');

    if (!cell) {
      // Clicked outside pfield — clear selection
      if (mSel !== null) {
        mSel = null;
        applyHighlight();
      }
      return;
    }

    var idx = parseInt(cell.getAttribute('data-i'), 10);

    if (mSel === null) {
      // Select occupied cell only
      if (cell.classList.contains('occ')) {
        mSel = idx;
      }
    } else {
      // Any second click on pfield = swap completed or cancelled by battle.html
      mSel = null;
    }
    applyHighlight();
  }, false);

})();

(function () {
  /* ─── Layout is always vertical (single unified layout) ───────
     Signal the combat engine to use player-at-bottom targeting.
  ─────────────────────────────────────────────────────────── */
  window.mobileVertical = true;

  var isTouch = window.matchMedia('(pointer: coarse)').matches;

  /* ─── Rotate overlay (touch only) ─────────────────────────
     CSS shows/hides based on orientation media query.
  ─────────────────────────────────────────────────────────── */
  if (isTouch) {
    var rotateOverlay = document.createElement('div');
    rotateOverlay.id = 'mobile-rotate-msg';
    rotateOverlay.innerHTML =
      '<div class="mrm-icon">📱</div>' +
      '<p>Rotate your device to portrait to play</p>';
    document.body.appendChild(rotateOverlay);
  }

  /* ─── Log overlay (touch only) ────────────────────────────
     Slide-up bottom sheet holding the battle log (#log).
     Only on touch devices — desktop keeps #log inline in #center-col.
  ─────────────────────────────────────────────────────────── */
  if (isTouch) {
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
  }

  /* ─── Tap-select cell highlight (touch only) ───────────────
     Adds CSS classes for visual feedback after each render().
       .m-selected   — gold border on the selected pfield cell
       .m-valid-drop — green tint on valid destination cells
  ─────────────────────────────────────────────────────────── */
  if (!isTouch) return;

  var mSel = null;

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

  var _origRender = window.render;
  if (typeof _origRender === 'function') {
    window.render = function () {
      _origRender.apply(this, arguments);
      applyHighlight();
    };
  }

  document.addEventListener('click', function (e) {
    var cell = e.target.closest('#pfield .cell');

    if (!cell) {
      if (mSel !== null) {
        mSel = null;
        applyHighlight();
      }
      return;
    }

    var idx = parseInt(cell.getAttribute('data-i'), 10);

    if (mSel === null) {
      if (cell.classList.contains('occ')) {
        mSel = idx;
      }
    } else {
      mSel = null;
    }
    applyHighlight();
  }, false);

})();

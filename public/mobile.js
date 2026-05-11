(function () {
  /* ─── Layout is horizontal (player left, enemy right) ─────────
     Combat engine uses same-row targeting without row inversion.
  ─────────────────────────────────────────────────────────── */
  window.mobileVertical = false;

  // Guard against re-evaluation across React remounts. Each /lobby ↔ /battle
  // round-trip re-evaluates this script; without these flags we'd stack
  // duplicate rotate overlays, log buttons, and render() wrappers.
  var alreadySetup = window.__hfMobileSetup === true;
  window.__hfMobileSetup = true;

  var isTouch = window.matchMedia('(pointer: coarse)').matches;
  var isMobile = window.matchMedia('(max-width: 768px)').matches;

  /* ─── Rotate overlay (touch only) ─────────────────────────
     CSS shows/hides based on orientation media query.
  ─────────────────────────────────────────────────────────── */
  if (isTouch && !alreadySetup) {
    var rotateOverlay = document.createElement('div');
    rotateOverlay.id = 'mobile-rotate-msg';
    rotateOverlay.innerHTML =
      '<div class="mrm-icon">📱</div>' +
      '<p>Rotate your device to portrait to play</p>';
    document.body.appendChild(rotateOverlay);
  }

  /* ─── Log overlay ─────────────────────────────────────────
     Slide-up bottom sheet holding the battle log (#log).
     The overlay element is injected by React JSX; we just
     wire up the close button and move #log into it.
  ─────────────────────────────────────────────────────────── */
  if ((isTouch || isMobile) && !alreadySetup) {
    function setupLog() {
      var logOverlay = document.getElementById('mobile-log-overlay');
      if (!logOverlay) return;

      // Do NOT move the #log element into the overlay here —
      // togglePanel() copies #log.innerHTML into #mobile-log-entries
      // when the overlay is opened. Moving the element earlier caused
      // the same content to appear twice (element + copied HTML).
      // Keep #log in-place and let togglePanel handle the sync.

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
        var logOverlay = document.getElementById('mobile-log-overlay');
        if (logOverlay) logOverlay.classList.toggle('open');
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

  // Wrap window.render exactly once (never on remount). battle.js loads
  // before this script (per BattlePage.jsx's serialized chain), so
  // window.render is guaranteed to exist by the time we run.
  if (!alreadySetup) {
    var _origRender = window.render;
    if (typeof _origRender === 'function') {
      window.render = function () {
        _origRender.apply(this, arguments);
        applyHighlight();
      };
    }
  }

  if (alreadySetup) return;

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

// Touch drag: field → barracks
// Detects a drag gesture starting from a field unit. On touchmove, highlights
// #benchwrap when the finger is over it. On touchend over benchwrap, calls
// window.retBench to return the hero to barracks.
(function () {
  var _touchDragSlot = null;
  var bw = null;

  function getBenchWrap() {
    return bw || (bw = document.getElementById('benchwrap'));
  }

  function isTouchOverBenchwrap(touch) {
    var el = document.elementFromPoint(touch.clientX, touch.clientY);
    var bench = getBenchWrap();
    return bench && el && (el === bench || bench.contains(el));
  }

  document.addEventListener('touchstart', function (e) {
    var unit = e.target.closest('#pfield .cell.occ .unit');
    if (!unit) return;
    var cell = unit.closest('.cell');
    if (!cell) return;
    _touchDragSlot = parseInt(cell.getAttribute('data-i'), 10);
  }, { passive: true });

  document.addEventListener('touchmove', function (e) {
    if (_touchDragSlot === null) return;
    // Note: _fieldLpTimer is a local var inside battle.js's _bootBattle scope.
    // React's onTouchMove on the .unit element already calls window.fieldTouchMove()
    // which clears it — no action needed here.
    var touch = e.touches[0];
    if (!touch) return;
    var bench = getBenchWrap();
    if (!bench) return;
    if (isTouchOverBenchwrap(touch)) {
      bench.classList.add('bench-touch-over');
    } else {
      bench.classList.remove('bench-touch-over');
    }
  }, { passive: true });

  document.addEventListener('touchend', function (e) {
    if (_touchDragSlot === null) return;
    var slot = _touchDragSlot;
    _touchDragSlot = null;
    var bench = getBenchWrap();
    if (bench) bench.classList.remove('bench-touch-over');
    var touch = e.changedTouches[0];
    if (!touch) return;
    if (isTouchOverBenchwrap(touch)) {
      window.retBench?.(slot);
    }
  }, { passive: true });

  document.addEventListener('touchcancel', function () {
    _touchDragSlot = null;
    var bench = getBenchWrap();
    if (bench) bench.classList.remove('bench-touch-over');
  }, { passive: true });
})();

})();

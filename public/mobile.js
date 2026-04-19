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
  var overlay = document.createElement('div');
  overlay.id = 'mobile-rotate-msg';
  overlay.innerHTML =
    '<div class="mrm-icon">📱</div>' +
    '<p>Rotate your device to portrait to play</p>';
  document.body.appendChild(overlay);

  /* ─── FAB Battle button ────────────────────────────────────
     Mirrors the hidden #bfight button (inside #center-col).
     MutationObserver keeps disabled state and text in sync.
  ─────────────────────────────────────────────────────────── */
  var fab = document.createElement('button');
  fab.id = 'mobile-fab';
  fab.className = 'btn bbtn'; // reuse battle.html button styles
  fab.textContent = 'Battle!';
  fab.setAttribute('type', 'button');
  fab.addEventListener('click', function () {
    if (typeof startBattle === 'function') startBattle();
  });
  document.body.appendChild(fab);

  // Sync FAB state once #bfight is available (render() creates it)
  function syncFab() {
    var bfight = document.getElementById('bfight');
    if (!bfight) return;

    // Initial sync
    fab.disabled = bfight.disabled;
    fab.textContent = bfight.textContent || 'Battle!';

    // Keep in sync as battle.html updates #bfight
    new MutationObserver(function () {
      fab.disabled = bfight.disabled;
      fab.textContent = bfight.textContent || 'Battle!';
    }).observe(bfight, { attributes: true, childList: true, subtree: true });
  }

  // #bfight exists in HTML but render() may update its state on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncFab);
  } else {
    syncFab();
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
    // applyHighlight() will run via the wrapped render() that battle.html calls
    // after its own click handler. Call it here too for instant feedback.
    applyHighlight();
  }, false);

})();

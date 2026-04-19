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

})();

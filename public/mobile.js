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

})();

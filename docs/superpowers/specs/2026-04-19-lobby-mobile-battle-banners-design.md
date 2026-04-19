# Lobby Mobile — Battle Banners Design Spec

**Data:** 2026-04-19
**Escopo:** Adaptação mobile da view Battle Banners (Duel) do lobby — topnav compacto, bottom tabs e banners sempre expandidos

---

## Contexto

`public/lobby.html` foi construído desktop-first. O topnav tem logo + 5 links de navegação + saldo HIVE + badge de usuário + botão Exit — em 390px isso estoura completamente. Os banners AI/PvP expandem no hover, que não existe em touch. Esta spec cobre a infraestrutura de navegação mobile (bottom tabs) e os overrides específicos da view Battle Banners.

As views Grimoire, Formation, Heroes e Settings serão cobertas em specs separadas.

---

## Decisões de Design

- **Nav mobile:** Bottom Tabs fixas no rodapé (5 abas: Duel, Grimoire, Formation, Heroes, Config)
- **TopNav mobile:** Apenas logo + badge de usuário. Exit move para a view Settings.
- **Banner expand:** Sempre visível no mobile — sem animação de hover/reveal
- **Sphere art:** Reduzida de 150px para 80px
- **Implementação:** HTML em `lobby.html` + overrides em `mobile.css`. Zero mudança no desktop.

---

## Mudanças

### 1. `public/lobby.html` — HTML das Bottom Tabs

Adicionar ao final de `.lobby-wrap` (antes do `</div>` de fechamento):

```html
<nav class="mobile-bottom-tabs" id="mobile-bottom-tabs">
  <button class="mbt-tab" data-nav="home" onclick="showView('view-home')">
    <span class="mbt-ico">⚔️</span>
    <span class="mbt-lbl">Duel</span>
  </button>
  <button class="mbt-tab" data-nav="grimoire" onclick="openGrimoire()">
    <span class="mbt-ico">📖</span>
    <span class="mbt-lbl">Grimoire</span>
  </button>
  <button class="mbt-tab" data-nav="formation" onclick="openFormation()">
    <span class="mbt-ico">🏰</span>
    <span class="mbt-lbl">Formation</span>
  </button>
  <button class="mbt-tab" data-nav="heroes" onclick="openHeroes()">
    <span class="mbt-ico">🦸</span>
    <span class="mbt-lbl">Heroes</span>
  </button>
  <button class="mbt-tab" data-nav="settings" onclick="openSettings()">
    <span class="mbt-ico">⚙️</span>
    <span class="mbt-lbl">Config</span>
  </button>
</nav>
```

### 2. `public/lobby.html` — Helper JS `_syncMobileTabs`

Adicionar no bloco `<script>` existente, antes do `})()` de fechamento do IIFE:

```js
function _syncMobileTabs(navId) {
  document.querySelectorAll('.mbt-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.nav === navId);
  });
}
```

Adicionar chamada `_syncMobileTabs('home')` dentro da função que abre a view home/duel.
Adicionar chamada `_syncMobileTabs('grimoire')` dentro de `openGrimoire()`.
Adicionar chamada `_syncMobileTabs('formation')` dentro de `openFormation()`.
Adicionar chamada `_syncMobileTabs('heroes')` dentro de `openHeroes()`.
Adicionar chamada `_syncMobileTabs('settings')` dentro de `openSettings()`.

Chamar `_syncMobileTabs('home')` na inicialização (após DOM pronto), já que a view inicial é home.

### 3. `public/mobile.css` — Lobby overrides

Adicionar novo bloco ao final do arquivo, **fora** do `@media (max-width: 480px)` existente (que é `pointer: coarse` de battle.html):

```css
/* ══════════════════════════════════════════
   LOBBY MOBILE OVERRIDES
   Aplica apenas a lobby.html em touch portrait
   ══════════════════════════════════════════ */
@media (max-width: 480px) and (pointer: coarse) {

  /* ── TopNav: ocultar centro e direita ── */
  .topnav .nav-center,
  .topnav .hive-bal,
  .topnav .btn-exit {
    display: none !important;
  }

  .topnav {
    padding: 0 14px;
    justify-content: space-between;
  }

  /* ── Bottom Tabs ── */
  .mobile-bottom-tabs {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 56px;
    background: rgba(6, 3, 20, 0.97);
    border-top: 1px solid rgba(180, 130, 255, 0.14);
    backdrop-filter: blur(18px);
    z-index: 99;
    padding-bottom: env(safe-area-inset-bottom);
    align-items: stretch;
  }

  .mbt-tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    background: none;
    border: none;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    padding: 4px 0;
  }

  .mbt-ico {
    font-size: 18px;
  }

  .mbt-lbl {
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: rgba(190, 170, 240, 0.45);
    font-family: "Exo 2", system-ui, sans-serif;
  }

  .mbt-tab.active .mbt-lbl {
    color: #ffd700;
  }

  .mbt-tab.active .mbt-ico {
    filter: drop-shadow(0 0 6px rgba(255, 215, 0, 0.55));
  }

  /* Ocultar no desktop (padrão: não exibido) */

  /* ── Lobby wrap: padding para não ficar atrás das tabs ── */
  .lobby-wrap {
    padding-bottom: calc(56px + env(safe-area-inset-bottom));
  }

  /* ── Banner expand: sempre visível ── */
  .banner-expand {
    max-height: none !important;
    opacity: 1 !important;
    overflow: visible !important;
  }

  /* ── Desabilitar hover transform em touch ── */
  .banner-ai:hover,
  .banner-pvp:hover {
    transform: none !important;
    box-shadow: none !important;
  }

  /* ── Sphere menor ── */
  .banner-sphere {
    width: 80px !important;
    height: 80px !important;
    margin-bottom: 12px !important;
  }

  .banner-ai .sph-ring.r1 {
    width: 80px !important;
    height: 80px !important;
    margin: -40px 0 0 -40px !important;
  }

  .banner-ai .sph-ring.r2,
  .banner-pvp .sph-ring.r2 {
    width: 60px !important;
    height: 60px !important;
    margin: -30px 0 0 -30px !important;
  }

  .banner-ai .sph-ring.r3,
  .banner-pvp .sph-ring.r3 {
    width: 40px !important;
    height: 40px !important;
    margin: -20px 0 0 -20px !important;
  }

  .banner-pvp .sph-ring.r1 {
    width: 80px !important;
    height: 80px !important;
    margin: -40px 0 0 -40px !important;
  }

  .sph-core {
    font-size: 22px !important;
  }
}

/* Bottom tabs ocultas por padrão no desktop */
.mobile-bottom-tabs {
  display: none;
}
```

---

## Escopo Fora do Spec

- Views Grimoire, Formation, Heroes, Settings: specs separadas
- Lógica de pills (BO3/BO5/bet), matchmaking, HIVE balance: sem alteração
- Layout desktop: sem alteração
- `mobile.js`: sem alteração

---

## Critérios de Aceite

- [ ] No desktop (pointer: fine), topnav permanece idêntico; bottom tabs não aparecem
- [ ] No mobile portrait (≤480px touch), topnav mostra apenas logo + badge de usuário
- [ ] Bottom tabs aparecem fixas no rodapé com 5 abas
- [ ] Aba ativa tem label dourado e ícone com glow
- [ ] Trocar de aba sincroniza o estado ativo corretamente
- [ ] Banners AI e PvP mostram expand (formato/bet + botão) sem precisar de hover
- [ ] Sphere art tem ~80px no mobile
- [ ] Conteúdo da view não fica escondido atrás das bottom tabs (padding-bottom aplicado)
- [ ] safe-area-inset-bottom aplicado nas tabs (suporte a notch)

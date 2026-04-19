# Lobby Mobile — Battle Banners Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adaptar a view Battle Banners do lobby para mobile — bottom tabs fixas no rodapé, topnav compacto, e banners sempre expandidos sem depender de hover.

**Architecture:** Três mudanças independentes: (1) HTML das bottom tabs inserido em `lobby.html`, (2) `showView()` atualizado para sincronizar o estado ativo das tabs, (3) overrides CSS em `mobile.css`. Nenhuma mudança no desktop — tudo dentro de `@media (pointer: coarse)`.

**Tech Stack:** HTML, CSS, JavaScript vanilla — sem dependências externas.

---

## Arquivos Modificados

| Arquivo | Mudança |
|---|---|
| `public/lobby.html` | Adicionar HTML das bottom tabs + sync em `showView()` |
| `public/mobile.css` | Adicionar bloco de overrides de lobby ao final |

---

### Task 1: HTML das Bottom Tabs em lobby.html

**Files:**
- Modify: `public/lobby.html:3592` (antes do `</div><!-- /lobby-wrap -->`)

- [ ] **Step 1: Localizar o ponto de inserção**

  Ler as linhas 3589-3595 de `public/lobby.html` para confirmar a estrutura:
  ```
  3590:       </div>
  3591:       <!-- /view-settings -->
  3592:     </div>
  3593:     <!-- /lobby-wrap -->
  ```
  A inserção vai ANTES da linha 3592 (`</div>` que fecha `.lobby-wrap`).

- [ ] **Step 2: Inserir o HTML das bottom tabs**

  Em `public/lobby.html`, substituir a linha 3592 (`    </div>`) pela seguinte sequência:

  ```html
      <nav class="mobile-bottom-tabs" id="mobile-bottom-tabs">
        <button class="mbt-tab active" data-nav="home" onclick="showView('view-home')">
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
    </div>
  ```

  Nota: o `</div>` no final fecha o `.lobby-wrap` — não remover.

- [ ] **Step 3: Verificar estrutura HTML**

  Confirmar que as linhas inseridas ficaram dentro de `.lobby-wrap` e que `<!-- /lobby-wrap -->` ainda segue imediatamente após o `</div>` de fechamento.

- [ ] **Step 4: Commit**

  ```bash
  git add public/lobby.html
  git commit -m "feat(lobby-mobile): adicionar HTML das bottom tabs"
  ```

---

### Task 2: Sync de aba ativa em showView()

**Files:**
- Modify: `public/lobby.html` — função `showView` (em torno da linha 3722)

- [ ] **Step 1: Localizar showView**

  Ler linhas 3722-3742 de `public/lobby.html`. A função atual:

  ```js
  window.showView = function showView(id) {
    document
      .querySelectorAll(".lv")
      .forEach((v) => v.classList.remove("active"));
    document.getElementById(id).classList.add("active");
    document
      .getElementById("nav-btn-home")
      .classList.toggle("active", id === "view-home");
    document
      .getElementById("nav-btn-grimoire")
      .classList.toggle("active", id === "view-grimoire");
    document
      .getElementById("nav-btn-heroes")
      .classList.toggle("active", id === "view-heroes");
    document
      .getElementById("nav-btn-formation")
      .classList.toggle("active", id === "view-formation");
    document
      .getElementById("nav-btn-settings")
      .classList.toggle("active", id === "view-settings");
  };
  ```

- [ ] **Step 2: Adicionar sync das mobile tabs ao final de showView**

  Substituir o `};` de fechamento de `showView` pelo seguinte (mantendo tudo que já existe, adicionando só as últimas 5 linhas antes do `}`):

  ```js
  window.showView = function showView(id) {
    document
      .querySelectorAll(".lv")
      .forEach((v) => v.classList.remove("active"));
    document.getElementById(id).classList.add("active");
    document
      .getElementById("nav-btn-home")
      .classList.toggle("active", id === "view-home");
    document
      .getElementById("nav-btn-grimoire")
      .classList.toggle("active", id === "view-grimoire");
    document
      .getElementById("nav-btn-heroes")
      .classList.toggle("active", id === "view-heroes");
    document
      .getElementById("nav-btn-formation")
      .classList.toggle("active", id === "view-formation");
    document
      .getElementById("nav-btn-settings")
      .classList.toggle("active", id === "view-settings");
    const navKey = id.replace("view-", "");
    document.querySelectorAll(".mbt-tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.nav === navKey);
    });
  };
  ```

  A lógica: extrai o nome da view (`view-home` → `home`) e compara com o `data-nav` de cada tab.

- [ ] **Step 3: Verificar que a aba inicial (Duel) começa ativa**

  O HTML da Task 1 já adiciona `class="mbt-tab active"` ao botão Duel — a view inicial é `view-home` com `class="lv active"` no HTML. Confirmar que o atributo `active` está na tab Duel no HTML inserido na Task 1.

- [ ] **Step 4: Verificar que openGrimoire/openHeroes/openFormation/openSettings sincronizam**

  Todas essas funções chamam `showView(viewId)` internamente (já verificado). Portanto o sync das tabs acontece automaticamente — sem modificar cada função individualmente.

- [ ] **Step 5: Commit**

  ```bash
  git add public/lobby.html
  git commit -m "feat(lobby-mobile): sincronizar aba ativa das bottom tabs em showView"
  ```

---

### Task 3: CSS de lobby mobile em mobile.css

**Files:**
- Modify: `public/mobile.css` — adicionar ao final do arquivo (após o bloco `@media (max-width: 380px)`)

- [ ] **Step 1: Confirmar fim do arquivo**

  Ler as últimas 10 linhas de `public/mobile.css` para confirmar que terminam com:
  ```css
  @media (max-width: 380px) and (pointer: coarse) {
    :root { --s: 0.44; }
  }
  ```

- [ ] **Step 2: Adicionar overrides de lobby ao final de mobile.css**

  Adicionar ao final de `public/mobile.css`:

  ```css

  /* ══════════════════════════════════════════
     LOBBY MOBILE OVERRIDES
     Aplica apenas a lobby.html em touch portrait
     ══════════════════════════════════════════ */

  /* Bottom tabs: ocultas por padrão (desktop) */
  .mobile-bottom-tabs { display: none; }

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

    .banner-ai .sph-ring.r1,
    .banner-pvp .sph-ring.r1 {
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

    .banner-sphere .sph-core {
      font-size: 22px !important;
    }
  }
  ```

- [ ] **Step 3: Verificar que o CSS não afeta battle.html**

  As classes `.topnav`, `.banner-expand`, `.banner-sphere` existem apenas em `lobby.html`. Confirmar que `battle.html` não usa essas classes (usar grep: `grep -n "topnav\|banner-expand\|banner-sphere" public/battle.html` — deve retornar vazio).

- [ ] **Step 4: Verificar no DevTools (390px touch)**

  Abrir `lobby.html` no DevTools com viewport 390px e `pointer: coarse`. Verificar:
  - TopNav mostra apenas logo + badge de usuário
  - Bottom tabs aparecem no rodapé com 5 abas
  - Aba "Duel" está ativa (label dourado)
  - Clicar em "Grimoire" → abre a view, aba "Grimoire" ativa
  - Banners AI e PvP mostram pills + botão sem hover
  - Sphere art com ~80px

- [ ] **Step 5: Verificar desktop inalterado**

  Trocar viewport para 1280px. TopNav completo, sem bottom tabs, banners com hover expand normal.

- [ ] **Step 6: Commit**

  ```bash
  git add public/mobile.css
  git commit -m "feat(lobby-mobile): CSS bottom tabs, topnav compacto e banners expandidos"
  ```

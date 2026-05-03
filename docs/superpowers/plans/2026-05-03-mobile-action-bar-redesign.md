# Mobile Action Bar Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir dois bugs (battle button sumindo no LOG, log iniciando no meio da tela) e modernizar o estilo visual da action bar mobile com pill indicator.

**Architecture:** Três arquivos afetados — `battle.js` (remover lógica de ocultação), `battle.css` (altura do log overlay + estilo do pill indicator), `mobile.css` (remover regra `hidden-while-log` obsoleta). Nenhuma mecânica de jogo é alterada.

**Tech Stack:** CSS (battle.css, mobile.css), JavaScript vanilla (battle.js). Build via Vite (`npm run build`).

---

## File Map

| Arquivo | O que muda |
|---|---|
| `public/js/battle.js` | Remove bloco que oculta `#mobile-battle-btn` e adiciona `hidden-while-log` em `togglePanel()` |
| `public/css/battle.css` | Altura do log overlay: `48%` → `38dvh`; active state: color gold → pill indicator roxo |
| `public/mobile.css` | Remove regra `.mobile-actions.hidden-while-log` (e chave de fechamento mal posicionada no `#mobile-log-btn`) |

---

## Task 1: Corrigir togglePanel() — battle button nunca some

**Files:**
- Modify: `public/js/battle.js` (~linha 3782–3798)

**Contexto:** Quando o Log é aberto, o código atual faz `battleBtn.style.display = 'none'` e adiciona `hidden-while-log` na action bar. O log overlay já usa `bottom: calc(safe-area + 64px)`, então fica naturalmente acima da action bar — não há necessidade de ocultar nada.

- [ ] **Step 1: Localizar o bloco a remover**

  Abra `public/js/battle.js` e localize a função `togglePanel` (em torno da linha 3756). O bloco a remover é:

  ```js
  // Ensure the central battle button doesn't visually sit above the
  // overlay by temporarily lowering its z-index while the overlay is open.
  const battleBtn = document.getElementById('mobile-battle-btn');
  if (battleBtn) {
    // opening was computed above
    if (opening) {
      battleBtn.style.zIndex = '49';
      battleBtn.style.display = 'none';
    } else {
      battleBtn.style.zIndex = '51';
      battleBtn.style.display = '';
    }
  }
  // Also hide/move the whole mobile action bar while the overlay is open
  const mab = document.querySelector('.mobile-actions');
  if (mab) {
    if (opening) mab.classList.add('hidden-while-log');
    else mab.classList.remove('hidden-while-log');
  }
  ```

- [ ] **Step 2: Substituir o bloco pelo log btn sync apenas**

  Após `overlay.classList.toggle("open")` e o sync do `logBtn`, a função `togglePanel` deve terminar assim (mantendo apenas o toggle do `ms-active` no logBtn, sem nada sobre battleBtn nem mab):

  ```js
  function togglePanel(type) {
    if (type !== "log") return;
    const overlay = document.getElementById("mobile-log-overlay");
    if (!overlay) return;
    const opening = !overlay.classList.contains("open");
    if (opening) {
      // Fechar outros painéis
      document.getElementById("shopwrap")?.classList.remove("mobile-open");
      document.getElementById("benchwrap")?.classList.remove("mobile-open");
      _mobileStep = null;
      document.querySelectorAll(".mobile-actions button[data-step]")
        .forEach(b => b.classList.remove("ms-active"));
      // Sincronizar histórico completo do log
      const src = document.getElementById("log");
      const dest = document.getElementById("mobile-log-entries");
      if (src && dest) {
        dest.innerHTML = "";
        dest.innerHTML = src.innerHTML;
        requestAnimationFrame(() => { dest.scrollTop = dest.scrollHeight; });
      }
    }
    overlay.classList.toggle("open");
    const logBtn = document.querySelector('.mobile-actions button[data-step="log"]');
    if (logBtn) logBtn.classList.toggle("ms-active", overlay.classList.contains("open"));
  }
  ```

- [ ] **Step 3: Verificar manualmente no browser**

  Abra `http://localhost:3000/battle.html` (ou o servidor local). No mobile ou com DevTools em modo mobile portrait ≤768px:
  - Clique em **Log** na action bar
  - Confirmar: log overlay abre, **botão Battle permanece visível**
  - Confirmar: clicar **Log** novamente fecha o overlay
  - Confirmar: clicar em **Recruit** ou **Barracks** fecha o log e abre o painel correto

- [ ] **Step 4: Commit**

  ```bash
  git add public/js/battle.js
  git commit -m "fix: keep battle button visible when log panel is open"
  ```

---

## Task 2: Reduzir altura do log overlay para 38dvh

**Files:**
- Modify: `public/css/battle.css` (linha ~3960, dentro do media query `@media (max-width: 768px), (pointer: coarse)`)

**Contexto:** O log overlay tem `height: 48%` atualmente, o que faz ele ocupar quase metade da tela e dar impressão de que conteúdo começa no meio. Reduzir para `38dvh` deixa o campo de batalha visível acima enquanto o log é consultado.

- [ ] **Step 1: Localizar e substituir a regra do log overlay**

  No arquivo `public/css/battle.css`, localize o bloco:

  ```css
  /* Log: bottom sheet — z-index abaixo da action bar (50) */
  #mobile-log-overlay {
    display: flex;
    flex-direction: column;
    position: fixed;
    bottom: -100%;
    left: 0;
    width: 100%;
    height: 48%;
    z-index: 19;
    background: linear-gradient(160deg, rgba(4, 2, 18, 0.97), rgba(8, 4, 24, 0.97));
    border-top: 1px solid rgba(180, 130, 255, 0.2);
    border-radius: 16px 16px 0 0;
    box-sizing: border-box;
    overflow: hidden;
    transition: bottom 0.3s ease;
  }
  ```

  Altere **apenas** `height: 48%` para `height: 38dvh`:

  ```css
  /* Log: bottom sheet — z-index abaixo da action bar (50) */
  #mobile-log-overlay {
    display: flex;
    flex-direction: column;
    position: fixed;
    bottom: -100%;
    left: 0;
    width: 100%;
    height: 38dvh;
    z-index: 19;
    background: linear-gradient(160deg, rgba(4, 2, 18, 0.97), rgba(8, 4, 24, 0.97));
    border-top: 1px solid rgba(180, 130, 255, 0.2);
    border-radius: 16px 16px 0 0;
    box-sizing: border-box;
    overflow: hidden;
    transition: bottom 0.3s ease;
  }
  ```

- [ ] **Step 2: Verificar no browser**

  Com DevTools em portrait ≤768px, abrir o Log:
  - Confirmar: log ocupa aproximadamente 38% da tela
  - Confirmar: campo de batalha (unidades, VS) visível acima do log
  - Confirmar: com uma entrada no log, ela aparece no topo do container (não no meio)

- [ ] **Step 3: Commit**

  ```bash
  git add public/css/battle.css
  git commit -m "fix: reduce log overlay height to 38dvh, show battlefield above log"
  ```

---

## Task 3: Pill indicator no item ativo da action bar

**Files:**
- Modify: `public/css/battle.css` (linhas ~4063–4069, dentro do mesmo media query)

**Contexto:** O estado ativo atual usa `color: #ffd700` (dourado) nos botões. O design aprovado usa um pill sutil em roxo + ícone/label mais brilhante, seguindo o padrão Material 3 / Android moderno.

- [ ] **Step 1: Localizar o bloco de estado ativo**

  No `public/css/battle.css`, localize:

  ```css
  /* Estado ativo */
  .mobile-actions > button.ms-active {
    color: #ffd700;
  }
  .mobile-actions > button.ms-active span {
    color: #ffd700;
  }
  ```

- [ ] **Step 2: Substituir pelo pill indicator**

  Substituir o bloco acima por:

  ```css
  /* Estado ativo — pill indicator */
  .mobile-actions > button {
    position: relative;
  }

  .mobile-actions > button.ms-active {
    color: rgba(215, 195, 255, 0.95);
  }

  .mobile-actions > button.ms-active span {
    color: rgba(215, 195, 255, 0.95);
  }

  .mobile-actions > button.ms-active::before {
    content: '';
    position: absolute;
    top: 9px;
    left: 50%;
    transform: translateX(-50%);
    width: 38px;
    height: 28px;
    background: rgba(150, 100, 255, 0.15);
    border-radius: 10px;
    pointer-events: none;
  }
  ```

  **Nota:** O `position: relative` já pode existir implicitamente em alguns contextos. Adicionar explicitamente garante que o `::before` com `position: absolute` fique contido no botão.

- [ ] **Step 3: Verificar no browser**

  Com DevTools em portrait ≤768px, na aba **Recruit** (que abre por padrão):
  - Confirmar: item ativo mostra um pill/bolhão sutil em roxo atrás do ícone
  - Confirmar: ícone e label do item ativo estão em branco suave (não dourado)
  - Confirmar: itens inativos continuam em `rgba(190, 170, 240, 0.35)` (esmaecidos)
  - Confirmar: o battle button central não é afetado (ele está em `.mab-center`, não em `.mobile-actions > button.ms-active`)

- [ ] **Step 4: Commit**

  ```bash
  git add public/css/battle.css
  git commit -m "feat: replace gold active state with pill indicator on action bar"
  ```

---

## Task 4: Remover regra hidden-while-log de mobile.css

**Files:**
- Modify: `public/mobile.css` (linhas ~122–144, bloco do `#mobile-log-btn`)

**Contexto:** O `mobile.css` tem um bug de CSS malformado — a regra `.mobile-actions.hidden-while-log` foi inserida **dentro** do bloco `#mobile-log-btn` (antes da chave de fechamento), tornando o CSS inválido. Além disso, com a Task 1, `hidden-while-log` não é mais adicionada. A regra deve ser removida completamente.

- [ ] **Step 1: Localizar o bloco problemático**

  No arquivo `public/mobile.css`, localize o bloco do `#mobile-log-btn` (em torno da linha 121). Atualmente está assim (CSS malformado — a regra `.mobile-actions` está aninhada dentro do bloco do botão sem fechar a chave anterior):

  ```css
  /* ── Log toggle button (injected into #hdr by mobile.js) ── */
  #mobile-log-btn {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 6px;

  /* When the log overlay is open, move and hide the action bar so it
     doesn't overlap or interfere visually with the overlay. This mirrors
     the behavior used for the barracks/shop bottom sheets. */
  .mobile-actions.hidden-while-log {
    transform: translateY(32px);
    opacity: 0;
    pointer-events: none;
    transition: transform 0.25s ease, opacity 0.2s ease;
  }
    color: rgba(255, 255, 255, 0.55);
    font-size: 11px;
    font-weight: 600;
    padding: 3px 8px;
    cursor: pointer;
    flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    font-family: "Exo 2", system-ui, sans-serif;
  }
  ```

- [ ] **Step 2: Corrigir o bloco — remover a regra hidden-while-log e fechar #mobile-log-btn corretamente**

  Substituir o bloco inteiro por:

  ```css
  /* ── Log toggle button (injected into #hdr by mobile.js) ── */
  #mobile-log-btn {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.55);
    font-size: 11px;
    font-weight: 600;
    padding: 3px 8px;
    cursor: pointer;
    flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    font-family: "Exo 2", system-ui, sans-serif;
  }
  ```

- [ ] **Step 3: Verificar no browser**

  Recarregar a página. Confirmar que nenhuma regressão visual ocorreu na action bar no estado normal.

- [ ] **Step 4: Commit**

  ```bash
  git add public/mobile.css
  git commit -m "fix: remove malformed hidden-while-log rule from mobile.css"
  ```

---

## Task 5: Build de produção e teste final

**Files:**
- Nenhum arquivo modificado — apenas validação

- [ ] **Step 1: Executar o build**

  ```bash
  npm run build
  ```

  Esperado: build completo sem erros. Warnings de CSS podem aparecer, mas não erros.

- [ ] **Step 2: Teste manual completo no browser mobile (ou DevTools portrait ≤768px)**

  Verificar todos os critérios:
  - [ ] Abrir Log → battle button permanece visível na action bar
  - [ ] Abrir Log → campo de batalha visível acima do overlay (~62% da tela)
  - [ ] Abrir Log → entrada mais recente visível no scroll (não no meio vazio)
  - [ ] Fechar Log (tap no handle ou tap em Recruit/Barracks) → overlay fecha
  - [ ] Aba Recruit ativa → pill roxo sutil + ícone/label branco suave
  - [ ] Aba Log ativa → pill roxo sutil + ícone/label branco suave
  - [ ] Battle button mantém visual elevado (translateY, sombra vermelha)
  - [ ] Testar no modo Bot E no modo PvP (paridade)

- [ ] **Step 3: Commit final se necessário**

  Se o build gerou arquivos em `/dist` que não foram commitados:

  ```bash
  git add dist/
  git commit -m "build: production build after mobile action bar redesign"
  ```

---

## Checklist de Cobertura do Spec

- [x] Battle btn nunca some quando log abre → Task 1
- [x] Log começa com entradas no topo, scroll para o mais recente → já existia (`scrollTop = scrollHeight`), mantido na Task 1
- [x] Log compacto 38dvh → Task 2
- [x] Pill indicator no item ativo → Task 3
- [x] Remover hidden-while-log → Tasks 1 e 4
- [x] Paridade Bot/PvP verificada → Task 5 Step 2
- [x] Build passa → Task 5 Step 1

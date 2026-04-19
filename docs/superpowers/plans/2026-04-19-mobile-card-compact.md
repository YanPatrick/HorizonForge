# Mobile Card Compact Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduzir os cards de heróis (shop e bench) no mobile para um formato ultra-compacto (~52px), corrigindo o bug de cascade CSS que impede o `--s` mobile de ser aplicado.

**Architecture:** Duas mudanças independentes de CSS. A primeira corrige a ordem do `<link>` no HTML para que o `mobile.css` vença na cascata. A segunda adiciona overrides de card compacto dentro do `@media` existente do `mobile.css`.

**Tech Stack:** CSS puro, sem JavaScript.

---

## Arquivos Modificados

| Arquivo | Mudança |
|---|---|
| `public/battle.html` | Mover `<link mobile.css>` da linha 7 para após linha 2827 (`</style>`) |
| `public/mobile.css` | Adicionar bloco de card compacto ao `@media (max-width: 480px)` existente |

---

### Task 1: Corrigir bug de cascade CSS

**Files:**
- Modify: `public/battle.html:7` e `public/battle.html:2827`

- [ ] **Step 1: Verificar o bug atual no browser**

  Abrir `battle.html` no DevTools com viewport 390px (iPhone). Em Elements, inspecionar `:root` — confirmar que `--s` está em `1` (não `0.50`). Isso confirma o bug.

- [ ] **Step 2: Remover o `<link>` da posição atual (linha 7)**

  Em `public/battle.html`, remover a linha 7:
  ```html
  <link rel="stylesheet" href="/mobile.css" />
  ```

- [ ] **Step 3: Inserir o `<link>` após o `</style>`**

  Em `public/battle.html`, após a linha 2827 (que contém `</style>`), inserir:
  ```html
    <link rel="stylesheet" href="/mobile.css" />
  ```

  O resultado final da área `</head>` deve ser:
  ```html
      </style>
      <link rel="stylesheet" href="/mobile.css" />
    </head>
  ```

- [ ] **Step 4: Verificar que o cascade foi corrigido**

  Recarregar `battle.html` no DevTools com viewport 390px touch. Em Elements → Computed → `--s`: deve mostrar `0.50`. Os cards vão encolher visivelmente nesse momento — confirma que o fix funciona.

- [ ] **Step 5: Verificar que o desktop não foi afetado**

  Trocar viewport para 1280px (desktop). Cards devem ter aparência idêntica ao estado anterior. `--s` deve ser `1`.

- [ ] **Step 6: Commit**

  ```bash
  git add public/battle.html
  git commit -m "fix(mobile): corrigir cascade CSS — mover link mobile.css para após </style>"
  ```

---

### Task 2: Card ultra-compacto no mobile.css

**Files:**
- Modify: `public/mobile.css` (adicionar ao final do bloco `@media (max-width: 480px) and (pointer: coarse)`, antes do `}` de fechamento na linha 352)

- [ ] **Step 1: Verificar estado atual dos cards no mobile**

  No DevTools com viewport 390px touch, confirmar que após o fix da Task 1 os cards shop têm `--card-w ≈ 53px` mas ainda mostram role, habilidade e botão de compra.

- [ ] **Step 2: Adicionar overrides de card compacto ao mobile.css**

  Em `public/mobile.css`, dentro do bloco `@media (max-width: 480px) and (pointer: coarse)` existente, adicionar antes do `}` de fechamento (linha 352):

  ```css
  /* ── Ultra-compact cards ── */

  /* Ocultar elementos não essenciais */
  .scard .crole,
  .scard .cabi,
  .scard .caction { display: none !important; }

  .bcard .crole,
  .bcard .cabi,
  .bcard .bsell-hint,
  .bcard .bprog { display: none !important; }

  /* Dimensões fixas dos shop cards */
  .scard {
    width: 52px !important;
    min-width: 52px !important;
    max-width: 52px !important;
    padding: 4px 3px 3px !important;
  }

  /* Dimensão dos bench cards */
  .bcard {
    max-width: 50px !important;
    padding: 5px 3px 4px !important;
  }

  /* Ícone menor */
  .cico {
    font-size: 20px !important;
    margin-top: 2px !important;
  }

  /* Nome menor */
  .cnm {
    font-size: 7px !important;
    margin-top: 1px !important;
  }

  /* Stats inline: HP + ATK, ocultar VEL */
  .csts {
    flex-direction: row !important;
    gap: 2px !important;
    padding: 1px 2px !important;
    margin-top: 2px !important;
  }

  .csts .cst:nth-child(3) { display: none !important; }

  .cstv { font-size: 7px !important; }
  .cstl { font-size: 5px !important; }
  ```

- [ ] **Step 3: Verificar shop cards no mobile**

  DevTools 390px touch. Recruitment section:
  - Cards devem ter ~52px de largura
  - Role (Dps/Tank) não visível
  - Habilidade (Precise Shot etc.) não visível
  - HP e ATK visíveis em linha, VEL oculto
  - Preço e ícone visíveis
  - Scroll horizontal funcionando

- [ ] **Step 4: Verificar bench cards no mobile**

  DevTools 390px touch. Barracks section:
  - Cards devem ter ~50px de largura
  - Apenas ícone + nome + estrela de nível visíveis
  - Scroll horizontal funcionando

- [ ] **Step 5: Verificar campo de batalha inalterado**

  As células do campo (`.cell`, unidades com `.uico`, `.uhp`, `.uhf`) não devem ter sofrido nenhuma mudança visual. HP das unidades ainda dinâmico.

- [ ] **Step 6: Verificar desktop inalterado**

  Trocar viewport para 1280px. Cards de shop e bench devem ter aparência idêntica ao estado anterior — role, habilidade, stats completos, tamanhos originais.

- [ ] **Step 7: Verificar phones muito pequenos (≤380px)**

  Trocar viewport para 360px. O bloco `@media (max-width: 380px)` define `--s: 0.44`. Cards já estão com dimensão fixa (`52px`/`50px`), então não devem encolher além disso — confirmar que ficam legíveis.

- [ ] **Step 8: Commit**

  ```bash
  git add public/mobile.css
  git commit -m "feat(mobile): card ultra-compacto — ocultar role/habilidade, fixar 52px, stats inline"
  ```

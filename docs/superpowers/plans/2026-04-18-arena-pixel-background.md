# Arena Pixel Art Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar background pixel art (arena-forest.jpg) na arena de batalha, tornar as células invisíveis em estado normal, mostrar orbe flutuante animado nos slots disponíveis durante posicionamento, e adicionar espaço visual entre as cartas.

**Architecture:** Todas as mudanças são CSS-only em `battle.html`. O sistema de temas usa `data-arena` no `#arena-wrap` para permitir múltiplos backgrounds futuros. O `renderField` já controla classes `.dr` nos slots vazios — aproveitamos o `::after` pseudo-element para o orbe, sem alterar JS.

**Tech Stack:** HTML/CSS em `public/battle.html` — sem dependências externas, sem JS novo.

---

## Mapa de Arquivos

| Arquivo | Tipo | O que muda |
|---|---|---|
| `public/battle.html` | Modify | CSS: body, #arena-wrap, .field/.pf/.ef, .cell, .unit, .cell.dr orbe |
| `public/images/arena-forest.jpg` | Already exists | Usado como background-image |

---

### Task 1: Background da arena (imagem + remover gradientes dos fields)

**Files:**
- Modify: `public/battle.html` (CSS sections: body, #arena-wrap, .pf, .ef)

- [ ] **Step 1: Adicionar background-image ao `#arena-wrap`**

Localizar o bloco CSS (linha ~565):
```css
/* ANTES */
#arena-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: calc(10px * var(--s));
  flex: 1 1 0;
  min-height: 0;
  padding: 0 calc(4px * var(--s));
  overflow: hidden;
  position: relative;
}
```
Substituir por:
```css
#arena-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: calc(10px * var(--s));
  flex: 1 1 0;
  min-height: 0;
  padding: 0 calc(4px * var(--s));
  overflow: hidden;
  position: relative;
  background-image: url('/images/arena-forest.jpg');
  background-size: cover;
  background-position: center;
}
```

- [ ] **Step 2: Tornar os campos `.pf` e `.ef` transparentes**

Localizar (linha ~811):
```css
/* ANTES */
.pf {
  background: linear-gradient(
    160deg,
    rgba(60, 100, 220, 0.07),
    rgba(40, 80, 160, 0.04)
  );
  border: 1px solid rgba(80, 130, 255, 0.25);
  box-shadow:
    0 0 40px rgba(60, 100, 255, 0.06),
    inset 0 0 20px rgba(60, 100, 255, 0.03);
}

.ef {
  background: linear-gradient(
    160deg,
    rgba(180, 40, 40, 0.07),
    rgba(120, 20, 20, 0.04)
  );
  border: 1px solid rgba(220, 80, 80, 0.25);
  box-shadow:
    0 0 40px rgba(200, 60, 60, 0.06),
    inset 0 0 20px rgba(200, 60, 60, 0.03);
}
```
Substituir por:
```css
.pf {
  background: transparent;
  border: none;
  box-shadow: none;
}

.ef {
  background: transparent;
  border: none;
  box-shadow: none;
}
```

- [ ] **Step 3: Verificar visualmente no browser**

Abrir `battle.html` (via servidor ou arquivo direto). A arena deve mostrar a floresta pixel art como fundo. Os dois campos 3×3 devem estar transparentes sobre ela.

- [ ] **Step 4: Commit**

```bash
git add public/battle.html
git commit -m "feat: arena forest pixel art background"
```

---

### Task 2: Tornar células invisíveis em estado normal

**Files:**
- Modify: `public/battle.html` (CSS: .cell, .cell:hover:not(.occ))

- [ ] **Step 1: Remover borda e hover visível da célula em repouso**

Localizar (linha ~874):
```css
/* ANTES */
.cell {
  border-radius: calc(8px * var(--s));
  border: 1px dashed rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.cell:hover:not(.occ) {
  border-color: rgba(136, 204, 255, 0.45);
  background: rgba(136, 204, 255, 0.07);
  box-shadow: inset 0 0 10px rgba(136, 204, 255, 0.05);
}
```
Substituir por:
```css
.cell {
  border-radius: calc(8px * var(--s));
  border: 1px solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.cell:hover:not(.occ) {
  border-color: transparent;
  background: transparent;
  box-shadow: none;
}
```

- [ ] **Step 2: Verificar que cartas ocupadas continuam normais**

Confirmar que `.cell.occ` com `.unit` dentro ainda renderiza corretamente (o `.unit` tem seu próprio background/border).

- [ ] **Step 3: Commit**

```bash
git add public/battle.html
git commit -m "feat: invisible grid cells over pixel art background"
```

---

### Task 3: Orbe flutuante nos slots disponíveis para posicionamento

**Files:**
- Modify: `public/battle.html` (CSS: .cell.dr e animação, substituir o estilo atual)

Contexto: `renderField` (linha ~5706) já adiciona a classe `.dr` nos slots vazios quando `G.bsel !== null || G.fieldSel !== null` durante a fase `"shop"`. Basta trocar o visual do `.cell.dr` de borda+background para um orbe via `::after`.

- [ ] **Step 1: Substituir o CSS do `.cell.dr` pelo orbe animado**

Localizar (linha ~891):
```css
/* ANTES */
.cell.dr {
  border-color: rgba(136, 204, 255, 0.6);
  background: rgba(136, 204, 255, 0.1);
  animation: pc 0.9s infinite;
}

@keyframes pc {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(136, 204, 255, 0.35);
  }

  50% {
    box-shadow: 0 0 0 6px rgba(136, 204, 255, 0.08);
  }
}
```
Substituir por:
```css
.cell.dr {
  border-color: transparent;
  background: transparent;
  animation: none;
}

.cell.dr::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: calc(18px * var(--s));
  height: calc(18px * var(--s));
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(160, 220, 255, 0.95) 0%,
    rgba(80, 160, 255, 0.6) 50%,
    rgba(40, 100, 255, 0.0) 100%
  );
  box-shadow:
    0 0 calc(8px * var(--s)) rgba(120, 200, 255, 0.9),
    0 0 calc(16px * var(--s)) rgba(80, 150, 255, 0.4);
  animation: orbFloat 1.4s ease-in-out infinite;
  pointer-events: none;
}

@keyframes orbFloat {
  0%, 100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.75;
  }
  50% {
    transform: translate(-50%, -58%) scale(1.15);
    opacity: 1;
  }
}
```

- [ ] **Step 2: Atualizar `.cell.dnd-over` para compatibilidade**

Manter o feedback visual ao arrastar sobre a célula (o orbe deve ganhar intensidade):

Localizar (linha ~908):
```css
.cell.dnd-over {
  border-color: rgba(136, 204, 255, 0.85) !important;
  background: rgba(136, 204, 255, 0.14) !important;
  box-shadow: 0 0 0 2px rgba(136, 204, 255, 0.4);
  animation: none;
}
```
Substituir por:
```css
.cell.dnd-over {
  border-color: transparent !important;
  background: rgba(136, 204, 255, 0.08) !important;
  box-shadow: none;
  animation: none;
}

.cell.dnd-over::after {
  opacity: 1 !important;
  transform: translate(-50%, -50%) scale(1.4) !important;
  animation: none !important;
  box-shadow:
    0 0 calc(14px * var(--s)) rgba(120, 200, 255, 1),
    0 0 calc(28px * var(--s)) rgba(80, 150, 255, 0.6) !important;
}
```

- [ ] **Step 3: Atualizar `.cell.field-sel` (slot selecionado para mover)**

Localizar (linha ~1017):
```css
.cell.field-sel {
  border-color: rgba(255, 200, 80, 0.95) !important;
  background: rgba(255, 200, 80, 0.12) !important;
  box-shadow: 0 0 0 3px rgba(255, 200, 80, 0.35);
  animation: fsel 0.7s ease-in-out infinite;
}

@keyframes fsel {
  0%,
  100% {
    box-shadow: 0 0 0 2px rgba(255, 200, 80, 0.4);
  }

  50% {
    box-shadow: 0 0 0 6px rgba(255, 200, 80, 0.12);
  }
}
```
Manter como está — `.field-sel` marca o slot de origem (carta selecionada), não os destinos, então o anel dourado continua fazendo sentido. Apenas remover o `background` para não ter fill:
```css
.cell.field-sel {
  border-color: rgba(255, 200, 80, 0.95) !important;
  background: transparent !important;
  box-shadow: 0 0 0 3px rgba(255, 200, 80, 0.35);
  animation: fsel 0.7s ease-in-out infinite;
}

@keyframes fsel {
  0%,
  100% {
    box-shadow: 0 0 0 2px rgba(255, 200, 80, 0.4);
  }

  50% {
    box-shadow: 0 0 0 6px rgba(255, 200, 80, 0.12);
  }
}
```

- [ ] **Step 4: Testar o fluxo de posicionamento**

1. Selecionar uma carta da Barracks
2. Confirmar que orbes aparecem nos 9 slots da arena do jogador
3. Fazer hover sobre um slot — orbe deve crescer
4. Fazer drag & drop — orbe do slot de destino deve expandir
5. Posicionar a carta — orbe some, carta aparece no slot

- [ ] **Step 5: Commit**

```bash
git add public/battle.html
git commit -m "feat: floating energy orb placement indicator on empty cells"
```

---

### Task 4: Espaço visual entre as cartas (cartas não preenchem 100% do slot)

**Files:**
- Modify: `public/battle.html` (CSS: .unit width/height)

- [ ] **Step 1: Reduzir o tamanho do `.unit` dentro da célula**

Localizar (linha ~1038):
```css
/* ANTES */
.unit {
  width: 100%;
  height: 100%;
  border-radius: calc(7px * var(--s));
  ...
}
```
Alterar apenas `width` e `height`:
```css
.unit {
  width: calc(100% - calc(12px * var(--s)));
  height: calc(100% - calc(12px * var(--s)));
  border-radius: calc(7px * var(--s));
  ...  /* resto permanece igual */
}
```

Isso cria 6px de margem em cada lado (top/bottom/left/right) da carta dentro do slot. Com o `field-gap` de 4px já existente entre células, o espaço total entre duas cartas adjacentes será ~16px — visível mas não excessivo.

- [ ] **Step 2: Verificar que hover `scale(1.08)` não ultrapassa o slot**

O `.unit:hover` usa `transform: scale(1.08)`. Com a carta menor, o scale ainda pode ficar dentro do espaço do slot. Confirmar visualmente que não há clipping estranho. Se necessário, aumentar o z-index no hover:
```css
.unit:hover {
  transform: scale(1.08);
  z-index: 5;  /* já existe, manter */
}
```

- [ ] **Step 3: Verificar cartas do campo inimigo**

O campo inimigo (`efield`) usa o mesmo `.unit` via `renderField`. Confirmar que o espaçamento também ficou bom lá.

- [ ] **Step 4: Commit**

```bash
git add public/battle.html
git commit -m "feat: card breathing room — units no longer fill full cell"
```

---

### Task 5: Ajustes finais de contraste e legibilidade

**Files:**
- Modify: `public/battle.html` (CSS: #vs, .flbl, body overlay opcional)

- [ ] **Step 1: Adicionar text-shadow nos labels da arena para legibilidade sobre o background**

Localizar `.flbl` (linha ~777) e `#vs` (linha ~836):
```css
/* Adicionar text-shadow ao .flbl */
.flbl {
  ...
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.7);
}

/* Adicionar text-shadow ao .vstxt */
.vstxt {
  ...
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
}
```

- [ ] **Step 2: Verificar contraste do turnpanel sobre o background**

O `#turnpanel` tem `background: rgba(255,255,255,0.02)` — pode ficar ilegível sobre a floresta. Ajustar para:
```css
#turnpanel {
  ...
  background: rgba(5, 3, 20, 0.65);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(200, 150, 255, 0.15);
}
```

- [ ] **Step 3: Teste completo de uma batalha**

1. Iniciar batalha vs bot
2. Posicionar heróis (verificar orbes)
3. Pressionar FIGHT
4. Confirmar que as animações de batalha (HP bars, attack arrows, efeitos) ficam legíveis sobre o background
5. Verificar a tela de resultado (drawer) — ela tem fundo próprio, não deve ser afetada

- [ ] **Step 4: Commit final**

```bash
git add public/battle.html
git commit -m "feat: arena contrast polish — labels and turn panel legibility"
```

---

## Rollback

Caso precise voltar ao estado anterior:
```bash
git checkout c0abf31 -- public/battle.html
```
O checkpoint `c0abf31` preserva o estado exato antes dessas mudanças.

---

## Notas para Temas Futuros

Para adicionar novos backgrounds (deserto, masmorra, neve), basta:
1. Colocar a imagem em `public/images/arena-<tema>.jpg`
2. No servidor, incluir `arenaTheme` no evento `match_found`
3. No cliente, `document.getElementById('arena-wrap').dataset.arena = data.arenaTheme`
4. CSS: `#arena-wrap[data-arena="desert"] { background-image: url('/images/arena-desert.jpg'); }`

Sem JS adicional — só CSS e um atributo.

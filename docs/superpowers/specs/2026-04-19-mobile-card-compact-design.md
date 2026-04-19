# Mobile Card Compact — Design Spec

**Data:** 2026-04-19
**Escopo:** Redução do tamanho dos cards de heróis (shop e bench) no layout mobile portrait

---

## Problema

Os cards de heróis no mobile estão no tamanho desktop completo. A causa raiz é um bug de cascade CSS: `mobile.css` é carregado via `<link>` **antes** do bloco `<style>` inline em `battle.html`. Como ambos têm especificidade igual no seletor `:root`, o `<style>` inline (que vem depois) sempre vence — então `--s: 0.50` do `mobile.css` nunca é aplicado. Os cards ficam em `--s: 1` (tamanho desktop) em todos os dispositivos.

---

## Decisões de Design

- **Layout:** vertical compacto com scroll horizontal (mantém a direção atual)
- **Conteúdo do shop card:** preço + ícone + nome + HP + ATK (sem role, sem habilidade, sem VEL, sem botão de compra visível no card)
- **Conteúdo do bench card:** nível de estrela + ícone + nome (sem role, sem habilidade, sem dots de progresso, sem hint de venda)
- **HP no campo de batalha:** não alterado — os elementos `.uhf`/`.uhp` existentes já são dinâmicos
- **Implementação:** 100% CSS — nenhuma mudança no JavaScript

---

## Mudanças

### 1. `battle.html` — Correção do cascade (1 linha)

Mover o `<link rel="stylesheet" href="/mobile.css" />` da linha 7 (antes do `<style>`) para **depois** do tag `</style>` de fechamento.

**Antes:**
```html
<link rel="stylesheet" href="/mobile.css" />
<style>
  :root { --s: 1; ... }
  ...
</style>
```

**Depois:**
```html
<style>
  :root { --s: 1; ... }
  ...
</style>
<link rel="stylesheet" href="/mobile.css" />
```

Isso faz o `@media (max-width: 480px) and (pointer: coarse)` do `mobile.css` vencer corretamente.

### 2. `mobile.css` — Card ultra-compacto

Dentro do bloco `@media (max-width: 480px) and (pointer: coarse)` existente, adicionar:

#### Ocultar elementos desnecessários

```css
/* Shop cards */
.scard .crole,
.scard .cabi,
.scard .caction { display: none !important; }

/* Bench cards */
.bcard .crole,
.bcard .cabi,
.bcard .bsell-hint,
.bcard .bprog { display: none !important; }
```

#### Dimensões fixas dos cards (sobrepõe o calc com --s)

```css
.scard {
  width: 52px !important;
  min-width: 52px !important;
  max-width: 52px !important;
  padding: 4px 3px 3px !important;
}

.bcard {
  max-width: 50px !important;
  padding: 5px 3px 4px !important;
}
```

#### Ícone e nome menores

```css
.cico {
  font-size: 20px !important;
  margin-top: 2px !important;
}

.cnm {
  font-size: 7px !important;
  margin-top: 1px !important;
}
```

#### Stats do shop: HP + ATK inline, ocultar VEL

```css
.csts {
  flex-direction: row !important;
  gap: 2px !important;
  padding: 1px 2px !important;
  margin-top: 2px !important;
}

/* Oculta coluna VEL (3ª) */
.csts .cst:nth-child(3) { display: none !important; }

.cstv { font-size: 7px !important; }
.cstl { font-size: 5px !important; }
```

---

## Escopo Fora do Spec

- Unidades no campo de batalha (`.cell`, `.uico`, `.uhp`): **sem alteração**
- Layout desktop: **sem alteração** — tudo dentro do `@media (pointer: coarse)`
- JavaScript de renderização: **sem alteração**
- Lógica de compra, drag-and-drop, tap-select: **sem alteração**

---

## Critérios de Aceite

- [ ] No desktop, cards têm aparência idêntica ao estado atual
- [ ] No mobile portrait (≤480px, touch), shop cards têm ~52px de largura
- [ ] No mobile portrait, bench cards têm ~50px de largura
- [ ] Role, habilidade e VEL não aparecem nos cards mobile
- [ ] HP e ATK (números) continuam visíveis nos shop cards
- [ ] HP das unidades no campo de batalha continua dinâmico e inalterado
- [ ] Scroll horizontal de bench e shop funciona normalmente

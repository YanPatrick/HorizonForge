# Mobile Action Bar Redesign — Spec

**Data:** 2026-05-03  
**Arquivos afetados:** `public/css/battle.css`, `public/js/battle.js`

---

## Problema

Dois bugs e uma oportunidade de melhoria visual:

1. **Battle button desaparece** quando o painel de Log é aberto — `togglePanel()` chama `battleBtn.style.display = 'none'` e adiciona `hidden-while-log` na action bar.
2. **Log começa no meio da tela** — o único entry fica na base do container porque `scrollTop = scrollHeight` empurra o scroll para baixo em um container vazio, dando aparência de que o conteúdo está no meio.
3. **Action bar sem identidade visual moderna** — estados ativos só mudam cor; sem indicador visual de seleção (pill), sem elevação no battle btn.

---

## Design Aprovado

### Comportamento do Log (Opção C)

- Log overlay com **altura fixa de 38% da viewport** (`height: 38dvh`)
- Posicionado **acima** da action bar: `bottom: 68px` (altura da action bar)
- A action bar **nunca se esconde** quando o log está aberto
- O battle button **nunca recebe** `display: none` — permanece visível e funcional (disabled apenas durante combat, como já é)
- Entradas do log ordenadas do mais antigo (topo) ao mais recente (base), com `scrollTop = scrollHeight` para mostrar o último entry visível ao abrir

### Estilo Visual da Action Bar (Design B — Flat + Pill Indicator)

- Barra flat, `height: 68px`, fundo `rgba(6,3,20,0.99)`
- Separador superior sutil: `border-top: 1px solid rgba(255,255,255,0.06)`
- Item ativo recebe **pill background** pseudo-element (`::before`): `rgba(150,100,255,0.15)`, `border-radius: 10px`, `34×28px`
- Cor do ícone/label ativo: `rgba(215,195,255,0.95)` (branco suave)
- Cor dos inativos: `rgba(190,170,240,0.35)` (dim)
- Battle button central: `54×54px`, `margin-top: -20px` (elevado), sombra vermelha `0 -6px 18px rgba(180,20,20,0.5)`, ring `0 0 0 2px rgba(255,90,60,0.3)`

---

## O que NÃO muda

- Lógica de `setMobileStep()` — controla shopwrap/benchwrap, sem alteração
- Comportamento dos painéis Recruit e Barracks (slide-up, z-index, etc.)
- Lógica de `toggleBattleSpeed()`, `openMobileMenu()`, `openHowTo()`
- Mobile HUD overlay (opp-badge, speed-btn, dots)
- Paridade Bot/PvP — nenhuma mecânica é tocada, apenas CSS e a função `togglePanel()`

---

## Mudanças Necessárias

### `public/js/battle.js` — função `togglePanel()`

Remover:
```js
battleBtn.style.zIndex = '49';
battleBtn.style.display = 'none';
// e o bloco else que restaura
```
```js
if (opening) mab.classList.add('hidden-while-log');
else mab.classList.remove('hidden-while-log');
```

O log overlay já é posicionado com `bottom: 68px`, então fica naturalmente acima da action bar sem precisar ocultar nada.

### `public/css/battle.css` — seção mobile (≤768px / pointer:coarse)

1. **Log overlay:** mudar `height` para `38dvh`, garantir `bottom: 68px` quando aberto
2. **Action bar:** aplicar pill indicator no `.ms-active` via `::before`
3. **Battle button:** ajustar tamanho para `54×54px`, `margin-top: -20px`, nova sombra
4. **Remover** `.mobile-actions.hidden-while-log` (regra em `mobile.css` também)

### `public/mobile.css`

Remover (ou tornar inerte) a regra:
```css
.mobile-actions.hidden-while-log {
  transform: translateY(32px);
  opacity: 0;
  pointer-events: none;
}
```

---

## Critérios de Aceitação

- [ ] Abrir o Log não esconde o battle button nem a action bar
- [ ] Com log aberto, campo de batalha ainda ocupa ~62% da tela acima do log
- [ ] Log entry mais recente fica visível ao abrir (scroll automático)
- [ ] Item ativo na action bar mostra pill sutil + ícone/label mais brilhante
- [ ] Battle button mantém elevação visual (margin-top negativa + sombra)
- [ ] Comportamento idêntico no modo Bot e PvP
- [ ] Build `npm run build` passa sem erros após as alterações

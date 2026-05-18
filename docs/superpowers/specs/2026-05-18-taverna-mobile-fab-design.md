# Taverna Mobile — FAB + Overlay

**Data:** 2026-05-18  
**Escopo:** Apenas versão mobile (não afeta desktop)

---

## Problema

A Taverna (lista de jogadores online + chat global) não é acessível para usuários mobile. O código de renderização (`view === 'tavern'` + `TavernPanel isMobile={true}`) já existe, mas não há ponto de entrada na navegação mobile.

## Solução Aprovada: FAB + Overlay full-screen

### Estado

Um único booleano `tavernOpen` adicionado ao `LobbyPage` via `useState(false)`.

### FAB (Floating Action Button)

- Elemento `<button>` com `position: fixed`
- Posição: canto inferior direito, acima da nav bar
  - `bottom: calc(60px + 16px)` — 60px = altura da `mobile-bottom-tabs`, 16px de margem
  - `right: 16px`
- Ícone: 🍺 (sem label textual para não poluir)
- Badge de notificação: ponto vermelho no canto superior direito do FAB quando `chatUnread === true` e `tavernOpen === false`
- Classe CSS: `tv-fab`
- Só presente no DOM dentro do `LobbyPage` (usuário já autenticado por definição)
- **Visível apenas em mobile** — controlado por CSS media query (`@media (max-width: 768px)`); no desktop o FAB fica `display: none`

### Overlay

- `position: fixed`, `inset: 0`, `z-index: 1100` (acima da `mobile-bottom-tabs` que usa `z-index: 1000`)
- Backdrop: `rgba(0,0,0,0.6)` — clicar no backdrop fecha o painel
- Painel deslizante:
  - Largura: `100vw`, max-width: `420px`
  - Altura: `100%`
  - Posicionado à direita (`right: 0`)
  - Animação: `transform: translateX(100%)` → `translateX(0)`, `transition: 250ms ease`
  - Classe base: `tv-overlay-panel`
- Botão X: canto superior direito do painel, fecha ao clicar
- Conteúdo: `<TavernPanel isMobile={true} .../>` com todas as props existentes passadas

### Integração com handlers de chat

- Ao abrir o overlay com a tab "chat" já ativa no TavernPanel: não há ação necessária, o `onChatOpen` é chamado internamente pelo próprio TavernPanel ao trocar de tab
- Ao fechar o overlay: chamar `handleChatClose()` para marcar o chat como lido/inativo

### Limpeza

- O bloco `{view === 'tavern' && <TavernPanel ... />}` existente no LobbyPage pode ser removido — fica órfão sem nenhum botão de nav apontando para ele

### CSS

Tudo em `public/css/tavern.css` (arquivo já existente, importado via `@styles/tavern.css`). Classes novas:

| Classe | Propósito |
|---|---|
| `.tv-fab` | Botão flutuante fixo |
| `.tv-fab-badge` | Ponto de notificação não lida |
| `.tv-overlay` | Backdrop + wrapper do painel |
| `.tv-overlay-panel` | Painel deslizante |

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `client/src/pages/LobbyPage.jsx` | Adicionar `tavernOpen` state, FAB button, overlay com TavernPanel, remover bloco `view === 'tavern'` órfão |
| `public/css/tavern.css` | Adicionar estilos do FAB e overlay |

### O que NÃO muda

- `TavernPanel.jsx` — nenhuma alteração
- Desktop — FAB e overlay ficam `display: none` via media query
- Nav bar mobile existente — nenhuma alteração

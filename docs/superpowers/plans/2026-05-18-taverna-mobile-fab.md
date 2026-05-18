# Taverna Mobile FAB — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expor a Taverna (jogadores online + chat global) no mobile via um FAB fixo que abre um painel deslizante full-screen.

**Architecture:** Um booleano `tavernOpen` em `LobbyPage` controla visibilidade. O FAB é um `button` com `position: fixed` visível apenas em mobile via media query. O overlay renderiza sempre no DOM (para animação de slide) e usa classes CSS para abrir/fechar. O `TavernPanel` existente com `isMobile={true}` é reutilizado sem modificações.

**Tech Stack:** React (JSX), CSS (sem framework), `public/css/tavern.css` via alias `@styles/tavern.css`

---

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `public/css/tavern.css` | Adicionar estilos FAB, badge, overlay, painel deslizante |
| `client/src/pages/LobbyPage.jsx` | Adicionar state `tavernOpen`, FAB + overlay JSX, remover bloco `view === 'tavern'` órfão |

---

## Task 1: CSS — FAB e Overlay

**Files:**
- Modify: `public/css/tavern.css` (append ao final, linha 342)

- [ ] **Step 1.1 — Adicionar estilos ao final de `public/css/tavern.css`**

Append exatamente este bloco ao final do arquivo (após a linha 342 `.tv-chat-send:hover:not(:disabled)`):

```css

/* ── FAB — taverna mobile (oculto no desktop) ──────────── */
.tv-fab {
  display: none;
  position: fixed;
  bottom: calc(60px + 16px);
  right: 16px;
  z-index: 1050;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(167,139,250,0.18);
  border: 1px solid rgba(167,139,250,0.35);
  color: #fff;
  font-size: 22px;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(0,0,0,0.45);
  padding: 0;
}
.tv-fab-badge {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ef4444;
  border: 2px solid #0c0a1a;
}
@media (max-width: 768px) {
  .tv-fab { display: flex; }
}

/* ── Overlay — painel deslizante mobile ─────────────────── */
.tv-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: transparent;
  pointer-events: none;
  transition: background 200ms ease;
}
.tv-overlay.tv-overlay-open {
  background: rgba(0,0,0,0.6);
  pointer-events: auto;
}
.tv-overlay-panel {
  position: absolute;
  top: 0;
  right: 0;
  width: 100vw;
  max-width: 420px;
  height: 100%;
  background: #0c0a1a;
  border-left: 1px solid rgba(180,130,255,0.14);
  display: flex;
  flex-direction: column;
  transform: translateX(100%);
  transition: transform 250ms ease;
  overflow: hidden;
}
.tv-overlay-panel.open {
  transform: translateX(0);
}
.tv-overlay-close {
  position: absolute;
  top: 12px;
  right: 12px;
  background: transparent;
  border: none;
  color: #888;
  font-size: 20px;
  cursor: pointer;
  z-index: 1;
  line-height: 1;
  padding: 4px;
}
.tv-overlay-close:hover { color: #fff; }
.tv-panel-mobile .tv-list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}
```

- [ ] **Step 1.2 — Commit CSS**

```bash
git add public/css/tavern.css
git commit -m "style: taverna mobile FAB e overlay"
```

---

## Task 2: LobbyPage — estado, FAB, overlay e limpeza

**Files:**
- Modify: `client/src/pages/LobbyPage.jsx`

### Step 2.1 — Adicionar state `tavernOpen`

- [ ] **Localizar** a linha (≈687):
```jsx
  const [chatUnread, setChatUnread] = useState(false)
```
Substituir por:
```jsx
  const [chatUnread, setChatUnread] = useState(false)
  const [tavernOpen, setTavernOpen] = useState(false)
```

### Step 2.2 — Remover bloco `view === 'tavern'` órfão

- [ ] **Localizar** este bloco (≈linhas 1329–1342) e remover completamente:

```jsx
        {view === 'tavern' && (
          <TavernPanel
            users={tavernUsers}
            isMobile={true}
            myUsername={username}
            onSetAvailable={handleSetAvailable}
            onSetAbsent={handleSetAbsent}
            chatMessages={chatMessages}
            chatUnread={chatUnread}
            onSendMessage={handleSendMessage}
            onChatOpen={handleChatOpen}
            onChatClose={handleChatClose}
          />
        )}
```

### Step 2.3 — Adicionar FAB + overlay antes do `</div>` que fecha `lobby-wrap`

- [ ] **Localizar** (≈linha 1360, logo após `</nav>` da mobile-bottom-tabs):
```jsx
        </nav>
      </div>
```
Substituir por:
```jsx
        </nav>

        <button
          type="button"
          className="tv-fab"
          onClick={() => setTavernOpen(true)}
          aria-label="Open Tavern"
        >
          🍺
          {chatUnread && !tavernOpen && <span className="tv-fab-badge" />}
        </button>

        <div
          className={`tv-overlay${tavernOpen ? ' tv-overlay-open' : ''}`}
          onClick={() => { setTavernOpen(false); handleChatClose() }}
        >
          <div
            className={`tv-overlay-panel${tavernOpen ? ' open' : ''}`}
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              className="tv-overlay-close"
              onClick={() => { setTavernOpen(false); handleChatClose() }}
            >✕</button>
            <TavernPanel
              users={tavernUsers}
              isMobile={true}
              myUsername={username}
              onSetAvailable={handleSetAvailable}
              onSetAbsent={handleSetAbsent}
              chatMessages={chatMessages}
              chatUnread={chatUnread}
              onSendMessage={handleSendMessage}
              onChatOpen={handleChatOpen}
              onChatClose={handleChatClose}
            />
          </div>
        </div>
      </div>
```

### Step 2.4 — Verificar no browser (mobile viewport)

- [ ] Iniciar o dev server se não estiver rodando:
```bash
cd client && npm run dev
```
Acessar `http://localhost:5173` com DevTools → modo mobile (largura ≤ 768px).

Verificar:
1. FAB 🍺 aparece no canto inferior direito, acima da nav bar
2. FAB não aparece em desktop (largura > 768px)
3. Clicar no FAB → painel desliza da direita com animação
4. Backdrop semi-transparente cobre o restante da tela
5. Clicar no backdrop → painel fecha com animação reversa
6. Botão ✕ → fecha o painel
7. Aba "Players" mostra lista de jogadores online com scroll
8. Aba "Chat" mostra histórico e input funcional
9. Badge vermelho aparece no FAB quando há mensagens não lidas e o painel está fechado
10. Badge some ao abrir o painel

### Step 2.5 — Build de produção e teste final

- [ ] Executar:
```bash
npm run build
npm start
```
Acessar `http://localhost:3000` em mobile e repetir verificações do Step 2.4.

### Step 2.6 — Commit

- [ ] **Commit:**
```bash
git add client/src/pages/LobbyPage.jsx
git commit -m "feat: taverna mobile via FAB + overlay deslizante"
```

# Status System & AFK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar status `afk` (amarelo) à taverna, detecção de AFK automático após 2 min de inatividade, e mini-menu para o jogador alternar entre Disponível e Ausente clicando no próprio badge.

**Architecture:** Timer AFK 100% client-side em `LobbyPage.jsx` usando `useRef` e `useEffect`. `TavernPanel.jsx` recebe props `myUsername`, `onSetAvailable`, `onSetAbsent` e gerencia o estado do mini-menu internamente. O servidor adiciona apenas um novo handler `set_status` que ignora mudanças enquanto o jogador está em `searching` ou `battle`.

**Tech Stack:** React 18, Socket.IO, CSS puro (sem biblioteca de componentes)

**Spec:** `docs/superpowers/specs/2026-05-15-status-system-afk-design.md`

---

## File Map

| File | Tipo | O que muda |
|------|------|-----------|
| `public/css/tavern.css` | Modify | Cor orange no searching; adicionar classes afk; CSS do mini-menu |
| `client/src/pages/TavernPanel.jsx` | Modify | Import React hooks; suporte ao status afk; props myUsername/onSetAvailable/onSetAbsent; mini-menu |
| `api/server.js` | Modify | Handler `set_status` após o handler `leave_queue` (linha 2132) |
| `client/src/pages/LobbyPage.jsx` | Modify | Refs isManualAfkRef/afkTimerRef; derivar myStatus; useEffect AFK; handlers; passar novas props ao TavernPanel |

---

## Task 1: CSS — Atualizar cores e adicionar estilos AFK + mini-menu

**Files:**
- Modify: `public/css/tavern.css:84-128`

- [ ] **Step 1: Substituir cores amber do searching por laranja e adicionar classes AFK**

Localizar as linhas de avatar e badge do `searching` (linhas 84-86 e 126-128) e substituir pelo bloco abaixo. Adicionar as linhas `afk` logo após cada bloco.

Em `public/css/tavern.css`, substituir:
```css
.tv-avatar-tavern   { background: rgba(40, 200, 120, 0.15); color: #4ade80; }
.tv-avatar-searching { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
.tv-avatar-battle  { background: rgba(239, 68, 68, 0.15);  color: #f87171; }
```
Por:
```css
.tv-avatar-tavern    { background: rgba(40, 200, 120, 0.15);  color: #4ade80; }
.tv-avatar-searching { background: rgba(249, 115, 22, 0.15);  color: #fb923c; }
.tv-avatar-battle    { background: rgba(239, 68, 68, 0.15);   color: #f87171; }
.tv-avatar-afk       { background: rgba(234, 179, 8, 0.15);   color: #facc15; }
```

E substituir:
```css
.tv-badge-tavern   { background: rgba(40, 200, 120, 0.12); color: #4ade80; }
.tv-badge-searching { background: rgba(245, 158, 11, 0.12); color: #fbbf24; }
.tv-badge-battle   { background: rgba(239, 68, 68, 0.12);  color: #f87171; }
```
Por:
```css
.tv-badge-tavern    { background: rgba(40, 200, 120, 0.12);  color: #4ade80; }
.tv-badge-searching { background: rgba(249, 115, 22, 0.12);  color: #fb923c; }
.tv-badge-battle    { background: rgba(239, 68, 68, 0.12);   color: #f87171; }
.tv-badge-afk       { background: rgba(234, 179, 8, 0.12);   color: #facc15; }
```

- [ ] **Step 2: Adicionar CSS do mini-menu**

Adicionar ao final de `public/css/tavern.css`:
```css

/* ── Mini-menu de status (badge clicável do próprio jogador) ─────────────── */
.tv-badge-own {
  cursor: pointer;
  user-select: none;
}
.tv-badge-own:hover {
  opacity: 0.8;
}
.tv-status-menu-wrap {
  position: relative;
  flex-shrink: 0;
}
.tv-status-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  background: #1a1a28;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px;
  padding: 4px;
  z-index: 200;
  min-width: 130px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.5);
}
.tv-status-opt {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: 6px;
  font-size: 12px;
  color: #ddd;
  white-space: nowrap;
  text-align: left;
}
.tv-status-opt:hover {
  background: rgba(255,255,255,0.07);
}
.tv-status-opt-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.tv-status-opt-dot-available { background: #22c55e; }
.tv-status-opt-dot-absent    { background: #eab308; }
```

- [ ] **Step 3: Verificar visualmente no dev server**

Iniciar o servidor se não estiver rodando: `npm run dev` (porta 5173).

Abrir `http://localhost:5173` e entrar no lobby. Confirmar na sidebar da taverna:
- Badge `searching` agora é laranja (antes era âmbar/dourado)
- Os outros badges (tavern verde, battle vermelho) permanecem iguais

- [ ] **Step 4: Commit**

```bash
git add public/css/tavern.css
git commit -m "style: atualiza cor searching para laranja e adiciona estilos status afk"
```

---

## Task 2: TavernPanel — Suporte ao status `afk` e mini-menu

**Files:**
- Modify: `client/src/pages/TavernPanel.jsx`

- [ ] **Step 1: Adicionar import do React**

No topo de `client/src/pages/TavernPanel.jsx`, adicionar antes da linha `export default`:
```jsx
import { useState, useEffect } from 'react'
```

- [ ] **Step 2: Reescrever o componente com suporte a afk e mini-menu**

Substituir o conteúdo completo de `client/src/pages/TavernPanel.jsx` por:
```jsx
import { useState, useEffect } from 'react'

/**
 * TavernPanel — lista de jogadores online em tempo real.
 *
 * Props:
 *   users          — array de { username, status, detail }
 *                    status: 'tavern' | 'searching' | 'battle' | 'afk'
 *   isMobile       — boolean; no mobile renderiza versão compacta sem cabeçalho lateral
 *   myUsername     — username do jogador logado (para renderizar badge clicável)
 *   onSetAvailable — callback: jogador clicou em "Disponível"
 *   onSetAbsent    — callback: jogador clicou em "Ausente"
 */
export default function TavernPanel({
  users = [],
  isMobile = false,
  myUsername,
  onSetAvailable,
  onSetAbsent,
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    function onClickOutside(e) {
      if (!e.target.closest('.tv-status-menu-wrap')) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [menuOpen])

  const ORDER = { battle: 0, searching: 1, tavern: 2, afk: 3 }
  const sorted = [...users].sort((a, b) => (ORDER[a.status] ?? 4) - (ORDER[b.status] ?? 4))

  const groups = {
    battle:    sorted.filter(u => u.status === 'battle'),
    searching: sorted.filter(u => u.status === 'searching'),
    tavern:    sorted.filter(u => u.status === 'tavern'),
    afk:       sorted.filter(u => u.status === 'afk'),
  }

  const BADGE_LABEL = { battle: 'battle', searching: 'searching', tavern: 'tavern', afk: 'ausente' }

  function initials(name) {
    return (name ?? '?').slice(0, 2).toUpperCase()
  }

  function UserRow({ user }) {
    const isOwn = user.username === myUsername
    return (
      <div className="tv-row">
        <div className={`tv-avatar tv-avatar-${user.status}`}>
          {initials(user.username)}
        </div>
        <div className="tv-row-info">
          <span className="tv-name">@{user.username}</span>
          {user.detail && <span className="tv-detail">{user.detail}</span>}
        </div>
        {isOwn ? (
          <div className="tv-status-menu-wrap">
            <span
              className={`tv-badge tv-badge-${user.status} tv-badge-own`}
              onClick={() => setMenuOpen(x => !x)}
            >
              <span className="tv-dot" />
              {BADGE_LABEL[user.status] ?? user.status}
            </span>
            {menuOpen && (
              <div className="tv-status-menu">
                <button
                  className="tv-status-opt"
                  onClick={() => { onSetAvailable?.(); setMenuOpen(false) }}
                >
                  <span className="tv-status-opt-dot tv-status-opt-dot-available" />
                  Disponível
                </button>
                <button
                  className="tv-status-opt"
                  onClick={() => { onSetAbsent?.(); setMenuOpen(false) }}
                >
                  <span className="tv-status-opt-dot tv-status-opt-dot-absent" />
                  Ausente
                </button>
              </div>
            )}
          </div>
        ) : (
          <span className={`tv-badge tv-badge-${user.status}`}>
            <span className="tv-dot" />
            {BADGE_LABEL[user.status] ?? user.status}
          </span>
        )}
      </div>
    )
  }

  function Group({ title, list }) {
    if (!list.length) return null
    return (
      <>
        <div className="tv-group-label">{title}</div>
        {list.map(u => <UserRow key={u.username} user={u} />)}
      </>
    )
  }

  const emptyState = (
    <div className="tv-empty">
      <span className="tv-empty-icon">🍺</span>
      <span>Nobody's in the tavern yet.</span>
    </div>
  )

  if (isMobile) {
    return (
      <div className="tv-panel tv-panel-mobile">
        <div className="tv-mobile-header">
          <span className="tv-title">Tavern</span>
          <span className="tv-count">{users.length} online</span>
        </div>
        <div className="tv-list">
          {users.length === 0 ? emptyState : (
            <>
              <Group title="In Battle"   list={groups.battle} />
              <Group title="Searching"   list={groups.searching} />
              <Group title="In Tavern"   list={groups.tavern} />
              <Group title="Ausente"     list={groups.afk} />
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <aside className="tv-sidebar">
      <div className="tv-panel">
        <div className="tv-header">
          <span className="tv-title">🍺 Tavern 🍺</span>
          <span className="tv-count">{users.length} online</span>
        </div>
        <div className="tv-list">
          {users.length === 0 ? emptyState : (
            <>
              <Group title="In Battle"   list={groups.battle} />
              <Group title="Searching"   list={groups.searching} />
              <Group title="In Tavern"   list={groups.tavern} />
              <Group title="Ausente"     list={groups.afk} />
            </>
          )}
        </div>
      </div>
    </aside>
  )
}
```

- [ ] **Step 3: Verificar no dev server**

Com `npm run dev` rodando, abrir `http://localhost:5173`. Verificar na sidebar:
- Grupos existentes continuam renderizando corretamente
- A lista não quebrou com a refatoração

(O mini-menu e o badge afk só serão testáveis após as Tasks 3 e 4.)

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/TavernPanel.jsx
git commit -m "feat: TavernPanel suporta status afk e mini-menu de controle de status"
```

---

## Task 3: Servidor — Handler `set_status`

**Files:**
- Modify: `api/server.js:2132` (após o handler `leave_queue`)

- [ ] **Step 1: Adicionar o handler `set_status`**

Em `api/server.js`, localizar o final do handler `leave_queue` (linha ~2132):
```js
  // Leave matchmaking queue
  socket.on('leave_queue', () => {
    if (connectedUser) {
      matchQueue.delete(connectedUser);
      console.log(`🚪 ${connectedUser} left queue`);
      setTavernStatus(connectedUser, 'tavern');
      broadcastQueueSize();
    }
  });
```

Adicionar imediatamente após (antes do comentário `// ── Player confirms HIVE wager...`):
```js
  // Manual / AFK status change — ignored during searching or battle
  socket.on('set_status', ({ status }) => {
    if (!connectedUser) return;
    const current = onlineUsers.get(connectedUser)?.status;
    if (current === 'searching' || current === 'battle') return;
    if (status !== 'tavern' && status !== 'afk') return;
    setTavernStatus(connectedUser, status);
  });

```

- [ ] **Step 2: Verificar no terminal do servidor**

Reiniciar o servidor: `npm start` (porta 3000) ou deixar o dev server já rodando.

Abrir o console do navegador em `http://localhost:5173` e executar:
```js
// Simula um emit manual (substitua pelo socket real da app se preferir)
// Este teste confirma que o handler existe — o teste real é na Task 4
```
Conferir no log do servidor que não há erro de sintaxe ao iniciar.

- [ ] **Step 3: Commit**

```bash
git add api/server.js
git commit -m "feat: servidor aceita set_status para alternar afk/tavern"
```

---

## Task 4: LobbyPage — Timer AFK, refs e handlers

**Files:**
- Modify: `client/src/pages/LobbyPage.jsx:687-694` (refs), `:685` (myStatus), `:828` (useEffect), `:1119` e `:1248` (TavernPanel calls)

- [ ] **Step 1: Adicionar refs do AFK após os refs existentes**

Em `client/src/pages/LobbyPage.jsx`, localizar o bloco de refs (linhas 687-694):
```js
  const socketRef = useRef(null)
  const searchTimerRef = useRef(null)
  const phraseTimerRef = useRef(null)
  const matchDataRef = useRef(null)
  const payCountdownRef = useRef(null)
  const preTimerRef = useRef(null)
  const preTimeoutRef = useRef(null)
  const toastTimerRef = useRef(null)
```

Adicionar as duas linhas ao final do bloco:
```js
  const socketRef = useRef(null)
  const searchTimerRef = useRef(null)
  const phraseTimerRef = useRef(null)
  const matchDataRef = useRef(null)
  const payCountdownRef = useRef(null)
  const preTimerRef = useRef(null)
  const preTimeoutRef = useRef(null)
  const toastTimerRef = useRef(null)
  const isManualAfkRef = useRef(false)
  const afkTimerRef = useRef(null)
```

- [ ] **Step 2: Derivar `myStatus` a partir de `tavernUsers`**

Em `LobbyPage.jsx`, localizar a linha da state `tavernUsers` (linha 685):
```js
  const [tavernUsers, setTavernUsers] = useState([])         // + IMP tavern
```

Adicionar a derivação logo abaixo (depois do bloco de states, antes dos refs — em qualquer ponto no corpo do componente antes do return):
```js
  const myStatus = tavernUsers.find(u => u.username === username)?.status ?? 'tavern'
```

Posição sugerida: logo após a linha 685, antes do `const socketRef`.

- [ ] **Step 3: Adicionar `useEffect` do timer AFK**

Em `LobbyPage.jsx`, localizar o `useEffect` de prefetch de recursos de batalha (começa em ~linha 832 com `const heavy = ['/css/battle.css'...`). Adicionar o novo `useEffect` do AFK **antes** dele:

```js
  useEffect(() => {
    if (myStatus !== 'tavern' && myStatus !== 'afk') return
    const AFK_DELAY = 2 * 60 * 1000

    function onActivity() {
      if (myStatus === 'afk') {
        if (!isManualAfkRef.current) {
          socketRef.current?.emit('set_status', { status: 'tavern' })
        }
        return
      }
      clearTimeout(afkTimerRef.current)
      afkTimerRef.current = setTimeout(() => {
        socketRef.current?.emit('set_status', { status: 'afk' })
      }, AFK_DELAY)
    }

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart']
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }))

    if (myStatus === 'tavern') {
      afkTimerRef.current = setTimeout(() => {
        socketRef.current?.emit('set_status', { status: 'afk' })
      }, AFK_DELAY)
    }

    return () => {
      events.forEach(e => window.removeEventListener(e, onActivity))
      clearTimeout(afkTimerRef.current)
    }
  }, [myStatus])
```

- [ ] **Step 4: Adicionar handlers de controle manual de status**

Em `LobbyPage.jsx`, logo após a definição de `myStatus` (ou agrupado com outras funções handler do lobby), adicionar:

```js
  function handleSetAvailable() {
    isManualAfkRef.current = false
    socketRef.current?.emit('set_status', { status: 'tavern' })
  }

  function handleSetAbsent() {
    isManualAfkRef.current = true
    socketRef.current?.emit('set_status', { status: 'afk' })
  }
```

- [ ] **Step 5: Passar novas props ao TavernPanel desktop (linha ~1119)**

Localizar:
```jsx
        <TavernPanel users={tavernUsers} />
```

Substituir por:
```jsx
        <TavernPanel
          users={tavernUsers}
          myUsername={username}
          onSetAvailable={handleSetAvailable}
          onSetAbsent={handleSetAbsent}
        />
```

- [ ] **Step 6: Passar novas props ao TavernPanel mobile (linha ~1248)**

Localizar:
```jsx
          <TavernPanel users={tavernUsers} isMobile={true} />
```

Substituir por:
```jsx
          <TavernPanel
            users={tavernUsers}
            isMobile={true}
            myUsername={username}
            onSetAvailable={handleSetAvailable}
            onSetAbsent={handleSetAbsent}
          />
```

- [ ] **Step 7: Verificar comportamento completo no dev server**

Com `npm run dev` rodando, abrir `http://localhost:5173` e logar.

Checklist de verificação:
1. O próprio badge na sidebar aparece clicável (cursor pointer, hover com opacity)
2. Clicar no próprio badge abre o mini-menu com "Disponível" e "Ausente"
3. Clicar fora do menu fecha sem mudar status
4. Clicar "Ausente" → badge muda para amarelo com texto "ausente"
5. Mexer o mouse/teclado **não** reverte o status manual
6. Clicar no badge de novo e escolher "Disponível" → badge volta para verde "tavern"
7. Aguardar 2 minutos sem mexer o mouse/teclado → badge muda automaticamente para amarelo (reduzir `AFK_DELAY` para `10 * 1000` temporariamente para testar, depois reverter)
8. Após AFK automático, mexer o mouse → badge volta para verde imediatamente
9. Outro jogador conectado em outra aba/browser **não** vê o mini-menu no seu próprio badge (que aqui seria o jogador errado)

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/LobbyPage.jsx
git commit -m "feat: timer AFK 2min e controle manual de status disponivel/ausente"
```

---

## Task 5: Build e verificação em produção

**Files:** nenhum arquivo novo

- [ ] **Step 1: Build**

```bash
npm run build
```

Esperado: sem erros. Warnings de ESLint sobre deps do useEffect são aceitáveis (o `[myStatus]` dep array é intencional).

- [ ] **Step 2: Testar em modo produção**

```bash
npm start
```

Abrir `http://localhost:3000` e repetir o checklist do Step 7 da Task 4.

- [ ] **Step 3: Commit final se necessário**

Se houver algum ajuste de build, commitar. Caso contrário, nenhum commit necessário nesta task.

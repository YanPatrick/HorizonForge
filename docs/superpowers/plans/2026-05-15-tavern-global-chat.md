# Tavern Global Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global ephemeral chat to the tavern sidebar, behind a Players/Chat tab toggle.

**Architecture:** New `chat_message` socket event — client emits text, server validates (tavern/afk only, rate-limited, max 200 chars) and broadcasts `{ username, text, time }` to all. State lives in `LobbyPage.jsx` (`chatMessages` array, max 100; `chatUnread` bool). `TavernPanel.jsx` gains a tab bar and chat view; it is purely display. No server-side persistence — messages clear on page reload.

**Tech Stack:** React 18, Socket.IO, Express — all already in use. No new dependencies.

---

## File Map

| File | Change |
|------|--------|
| `public/css/tavern.css` | Append tab bar + chat CSS classes |
| `api/server.js` | Add `chatRateLimit` map (~line 1376), `chat_message` handler (~line 2143), cleanup in disconnect (~line 2202) |
| `client/src/pages/LobbyPage.jsx` | Add `chatMessages`/`chatUnread` state (~line 685), handlers (~line 707), socket listener (~line 840), new props on both TavernPanel instances (~lines 1167, 1301) |
| `client/src/pages/TavernPanel.jsx` | Full component update — new props, tab bar replacing `.tv-header`, chat view with auto-scroll |

---

## Task 1: CSS — Tab bar and chat classes

**Files:**
- Modify: `public/css/tavern.css` (append to end, currently 311 lines)

- [ ] **Step 1: Append new CSS block at end of file**

Add after line 311 (current last line `.tv-status-opt-dot-absent { background: #eab308; }`):

```css

/* ── Tab bar ─────────────────────────────────────────── */
.tv-tabs          { display: flex; gap: 4px; margin-bottom: 8px; }
.tv-tab           { flex: 1; padding: 5px 8px; border: none; border-radius: 6px;
                    background: transparent; color: #888; font-size: 11px; cursor: pointer;
                    display: flex; align-items: center; justify-content: center; gap: 5px; }
.tv-tab:hover     { background: rgba(255,255,255,0.05); color: #ccc; }
.tv-tab-active    { background: rgba(255,255,255,0.08); color: #fff; }
.tv-tab-dot       { width: 6px; height: 6px; border-radius: 50%; background: #ef4444;
                    flex-shrink: 0; }

/* ── Chat area ───────────────────────────────────────── */
.tv-chat-wrap     { display: flex; flex-direction: column; flex: 1; min-height: 0; gap: 6px; }
.tv-chat-messages { flex: 1; overflow-y: auto; display: flex; flex-direction: column;
                    gap: 3px; min-height: 0; }
.tv-chat-msg      { font-size: 11px; line-height: 1.4; word-break: break-word; }
.tv-chat-msg-time { color: #555; margin-right: 4px; font-size: 10px; }
.tv-chat-msg-text { color: #ccc; }

/* ── Chat input ──────────────────────────────────────── */
.tv-chat-input-wrap { display: flex; gap: 4px; }
.tv-chat-input    { flex: 1; background: #2a2a3a; border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 6px; padding: 5px 8px; color: #ddd; font-size: 11px;
                    outline: none; }
.tv-chat-input:focus { border-color: rgba(167,139,250,0.4); }
.tv-chat-input:disabled { opacity: 0.4; cursor: not-allowed; }
.tv-chat-send     { background: rgba(167,139,250,0.15); border: none; border-radius: 6px;
                    color: #a78bfa; padding: 5px 8px; cursor: pointer; font-size: 13px; }
.tv-chat-send:hover:not(:disabled) { background: rgba(167,139,250,0.25); }
.tv-chat-send:disabled { opacity: 0.3; cursor: not-allowed; }
```

- [ ] **Step 2: Commit**

```bash
git add public/css/tavern.css
git commit -m "feat: add tavern chat CSS classes"
```

---

## Task 2: Server — `chat_message` handler

**Files:**
- Modify: `api/server.js`

Context: `onlineUsers` Map is at line 1376. `set_status` handler ends around line 2143. `disconnect` handler starts at line 2202.

- [ ] **Step 1: Add `chatRateLimit` map at module scope**

After line 1376 (`const onlineUsers = new Map();`), insert:

```js
const chatRateLimit = new Map(); // username -> timestamp of last sent message
```

- [ ] **Step 2: Add `chat_message` socket handler**

After the `set_status` handler (after line 2143, before the `wager_sent` comment block), insert:

```js
  socket.on('chat_message', ({ text }) => {
    if (!connectedUser) return;
    const status = onlineUsers.get(connectedUser)?.status;
    if (status !== 'tavern' && status !== 'afk') return;
    if (!text || typeof text !== 'string') return;
    const trimmed = text.trim().slice(0, 200);
    if (!trimmed) return;
    const now = Date.now();
    if (now - (chatRateLimit.get(connectedUser) ?? 0) < 1000) return;
    chatRateLimit.set(connectedUser, now);
    const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    io.emit('chat_message', { username: connectedUser, text: trimmed, time });
  });
```

- [ ] **Step 3: Add cleanup in `disconnect` handler**

Inside the `disconnect` handler (line 2202), after `matchQueue.delete(connectedUser);`, add:

```js
      chatRateLimit.delete(connectedUser);
```

- [ ] **Step 4: Verify server starts**

```bash
cd c:/Fontes_Javascript/HorizonForge
node api/server.js
```

Expected: server starts without errors (same startup logs as before). Stop with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add api/server.js
git commit -m "feat: add chat_message socket handler with rate limiting"
```

---

## Task 3: LobbyPage — Chat state, listener, handlers, props

**Files:**
- Modify: `client/src/pages/LobbyPage.jsx`

Context: `tavernUsers` state is at line 685. `handleSetAbsent` ends around line 708. `tavern_update` listener is at line 840. Desktop `TavernPanel` is at line 1166. Mobile `TavernPanel` is at line 1301.

- [ ] **Step 1: Add `chatMessages` and `chatUnread` state**

After line 685 (`const [tavernUsers, setTavernUsers] = useState([])`), insert:

```js
  const [chatMessages, setChatMessages] = useState([])
  const [chatUnread, setChatUnread] = useState(false)
```

- [ ] **Step 2: Add `handleSendMessage` and `handleChatOpen` handlers**

After the `handleSetAbsent` function (around line 708), insert:

```js
  function handleSendMessage(text) {
    socketRef.current?.emit('chat_message', { text })
  }

  function handleChatOpen() {
    setChatUnread(false)
  }
```

- [ ] **Step 3: Add `chat_message` socket listener**

After the `tavern_update` listener (line 840):

```js
    // tavern — real-time online players list
    socket.on('tavern_update', list => setTavernUsers(list))

    // global chat — ephemeral, cleared on page reload
    socket.on('chat_message', (msg) => {
      setChatMessages(prev => {
        const next = [...prev, msg]
        return next.length > 100 ? next.slice(-100) : next
      })
      setChatUnread(true)
    })
```

- [ ] **Step 4: Update desktop TavernPanel props**

Find the desktop TavernPanel (~line 1166):

```jsx
        <TavernPanel
          users={tavernUsers}
          myUsername={username}
          onSetAvailable={handleSetAvailable}
          onSetAbsent={handleSetAbsent}
        />
```

Replace with:

```jsx
        <TavernPanel
          users={tavernUsers}
          myUsername={username}
          onSetAvailable={handleSetAvailable}
          onSetAbsent={handleSetAbsent}
          chatMessages={chatMessages}
          chatUnread={chatUnread}
          onSendMessage={handleSendMessage}
          onChatOpen={handleChatOpen}
        />
```

- [ ] **Step 5: Update mobile TavernPanel props**

Find the mobile TavernPanel (~line 1301):

```jsx
          <TavernPanel
            users={tavernUsers}
            isMobile={true}
            myUsername={username}
            onSetAvailable={handleSetAvailable}
            onSetAbsent={handleSetAbsent}
          />
```

Replace with:

```jsx
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
          />
```

- [ ] **Step 6: Verify dev server compiles**

```bash
cd c:/Fontes_Javascript/HorizonForge
npm run dev
```

Expected: Vite compiles with no errors at `http://localhost:5173`.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/LobbyPage.jsx
git commit -m "feat: add chat state and socket listener to LobbyPage"
```

---

## Task 4: TavernPanel — Tab bar and chat view

**Files:**
- Modify: `client/src/pages/TavernPanel.jsx` (155 lines — full rewrite below)

This task replaces the `.tv-header` with a two-tab bar (Players / Chat) and adds the chat view. The Players tab is the existing content unchanged. The Chat tab is new.

- [ ] **Step 1: Replace the entire file**

```jsx
import { useState, useEffect, useRef } from 'react'

/**
 * TavernPanel — real-time online players list with global chat.
 *
 * Props:
 *   users          — array of { username, status, detail }
 *                    status: 'tavern' | 'searching' | 'battle' | 'afk'
 *   isMobile       — boolean; on mobile renders compact version without side header
 *   myUsername     — logged-in player's username (to render clickable badge)
 *   onSetAvailable — callback: player clicked "Available"
 *   onSetAbsent    — callback: player clicked "Absent"
 *   chatMessages   — array of { username, text, time }
 *   chatUnread     — boolean; true when unread messages exist
 *   onSendMessage  — fn(text: string) => void
 *   onChatOpen     — fn() => void — called when Chat tab is opened
 */
export default function TavernPanel({
  users = [],
  isMobile = false,
  myUsername,
  onSetAvailable,
  onSetAbsent,
  chatMessages = [],
  chatUnread = false,
  onSendMessage,
  onChatOpen,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('players')
  const [chatInput, setChatInput] = useState('')
  const chatEndRef = useRef(null)

  const myStatus = users.find(u => u.username === myUsername)?.status ?? 'tavern'

  useEffect(() => {
    if (!menuOpen) return
    function onClickOutside(e) {
      if (!e.target.closest('.tv-status-menu-wrap')) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [menuOpen])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const CHAT_COLORS = ['#a78bfa', '#22c55e', '#f97316', '#38bdf8', '#fb7185', '#fbbf24', '#34d399', '#818cf8']
  function usernameColor(name) {
    let hash = 0
    for (const c of (name ?? '')) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
    return CHAT_COLORS[Math.abs(hash) % CHAT_COLORS.length]
  }

  function sendMessage() {
    if (!chatInput.trim()) return
    onSendMessage?.(chatInput.trim())
    setChatInput('')
  }

  const ORDER = { battle: 0, searching: 1, tavern: 2, afk: 3 }
  const sorted = [...users].sort((a, b) => (ORDER[a.status] ?? 4) - (ORDER[b.status] ?? 4))

  const groups = {
    battle:    sorted.filter(u => u.status === 'battle'),
    searching: sorted.filter(u => u.status === 'searching'),
    tavern:    sorted.filter(u => u.status === 'tavern'),
    afk:       sorted.filter(u => u.status === 'afk'),
  }

  const BADGE_LABEL = { battle: 'battle', searching: 'searching', tavern: 'tavern', afk: 'absent' }

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
                  Available
                </button>
                <button
                  className="tv-status-opt"
                  onClick={() => { onSetAbsent?.(); setMenuOpen(false) }}
                >
                  <span className="tv-status-opt-dot tv-status-opt-dot-absent" />
                  Absent
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

  const tabBar = (
    <div className="tv-tabs">
      <button
        className={`tv-tab${activeTab === 'players' ? ' tv-tab-active' : ''}`}
        onClick={() => setActiveTab('players')}
      >
        👥 Players{users.length > 0 ? ` (${users.length})` : ''}
      </button>
      <button
        className={`tv-tab${activeTab === 'chat' ? ' tv-tab-active' : ''}`}
        onClick={() => { setActiveTab('chat'); onChatOpen?.() }}
      >
        💬 Chat{chatUnread && <span className="tv-tab-dot" />}
      </button>
    </div>
  )

  const chatView = (
    <div className="tv-chat-wrap">
      <div className="tv-chat-messages">
        {chatMessages.map((msg, i) => (
          <div key={i} className="tv-chat-msg">
            <span className="tv-chat-msg-time">{msg.time}</span>
            <span style={{ color: usernameColor(msg.username), fontWeight: 600 }}>
              {msg.username}
            </span>
            <span className="tv-chat-msg-text">: {msg.text}</span>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      <div className="tv-chat-input-wrap">
        <input
          className="tv-chat-input"
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) sendMessage() }}
          placeholder="type a message…"
          maxLength={200}
          disabled={myStatus !== 'tavern' && myStatus !== 'afk'}
        />
        <button
          className="tv-chat-send"
          onClick={sendMessage}
          disabled={!chatInput.trim()}
        >
          ↑
        </button>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <div className="tv-panel tv-panel-mobile">
        <div className="tv-mobile-header">
          <span className="tv-title">Tavern</span>
          <span className="tv-count">{users.length} online</span>
        </div>
        {tabBar}
        {activeTab === 'players' && (
          <div className="tv-list">
            {users.length === 0 ? emptyState : (
              <>
                <Group title="In Battle"   list={groups.battle} />
                <Group title="Searching"   list={groups.searching} />
                <Group title="In Tavern"   list={groups.tavern} />
                <Group title="Absent"      list={groups.afk} />
              </>
            )}
          </div>
        )}
        {activeTab === 'chat' && chatView}
      </div>
    )
  }

  return (
    <aside className="tv-sidebar">
      <div className="tv-panel">
        {tabBar}
        {activeTab === 'players' && (
          <div className="tv-list">
            {users.length === 0 ? emptyState : (
              <>
                <Group title="In Battle"   list={groups.battle} />
                <Group title="Searching"   list={groups.searching} />
                <Group title="In Tavern"   list={groups.tavern} />
                <Group title="Absent"      list={groups.afk} />
              </>
            )}
          </div>
        )}
        {activeTab === 'chat' && chatView}
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Verify dev server compiles**

```bash
cd c:/Fontes_Javascript/HorizonForge
npm run dev
```

Expected: Vite compiles with no errors at `http://localhost:5173`.

- [ ] **Step 3: Manual smoke test**

Open `http://localhost:5173` in two browser windows, log in with two different accounts.

Verify:
1. Tavern sidebar shows "Players" and "Chat" tabs
2. Players tab shows the player list as before
3. Chat tab shows an empty message area and input field
4. Typing in the input and pressing Enter (or clicking ↑) sends a message
5. The message appears in both browser windows with username + timestamp
6. The Players tab on the receiving window shows a red dot when a message arrives
7. Clicking the Chat tab clears the red dot
8. After 2 minutes of inactivity, status changes to "absent" — the chat input becomes disabled
9. Clicking the badge → Available re-enables the input

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/TavernPanel.jsx
git commit -m "feat: add Players/Chat tabs and global chat view to TavernPanel"
```

---

## Task 5: Build and final verification

**Files:** None (build artifact only)

- [ ] **Step 1: Run production build**

```bash
cd c:/Fontes_Javascript/HorizonForge
npm run build
```

Expected: Build completes successfully, output in `public/dist/`. No errors.

- [ ] **Step 2: Start production server and verify**

```bash
npm start
```

Open `http://localhost:3000` (not `localhost:3000/lobby.html`).

Verify the same smoke test from Task 4 Step 3 works in production mode.

- [ ] **Step 3: Commit build if clean**

```bash
git add public/dist
git commit -m "build: tavern global chat"
```

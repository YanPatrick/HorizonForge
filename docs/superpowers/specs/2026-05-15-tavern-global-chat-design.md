# Tavern Global Chat — Design Spec

**Date:** 2026-05-15
**Status:** Approved

## Overview

Add a global chat to the tavern sidebar. The sidebar gains a two-tab interface — **Players** (existing list) and **Chat** (new). Messages are ephemeral: no server-side persistence, cleared on page reload. Only players with status `tavern` or `afk` can send messages.

---

## 1. Layout

The existing tavern sidebar (left side, 220px) gains a tab bar at the top:

```
[ 👥 Players (4) ]  [ 💬 Chat  • ]
```

- The red dot (`•`) on the Chat tab appears when new messages have arrived while the user is on the Players tab. It disappears when the user opens the Chat tab.
- Tab layout stays inside `TavernPanel.jsx` as internal state (`activeTab: 'players' | 'chat'`).
- Desktop and mobile share the same component. Mobile will be addressed separately after the mobile tavern is implemented.

---

## 2. Who Can Chat

Only players with status `tavern` or `afk` can send messages. Players in `searching` or `battle` have a blur overlay and cannot interact with the sidebar. The server enforces this server-side.

---

## 3. Message Format

Style: colored username + timestamp (no avatar).

```
[14:02] YanP: alguém quer jogar agora?
[14:03] DruidK: gg na última partida
```

- **Username color:** derived from the username via hash → index into a palette of 8 colors: `['#a78bfa', '#22c55e', '#f97316', '#38bdf8', '#fb7185', '#fbbf24', '#34d399', '#818cf8']`. Same color for the same username every time.
- **Timestamp:** `HH:MM` format (e.g., `14:02`), generated server-side using `toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })`.
- **Username:** the player's logged-in Hive username — same as displayed in the tavern player list.

---

## 4. Server (`api/server.js`)

### New: `chatRateLimit` map

```js
const chatRateLimit = new Map() // username -> timestamp of last sent message
```

Lives at module scope, outside the connection handler.

### New socket event `chat_message` (incoming)

```js
socket.on('chat_message', ({ text }) => {
  if (!connectedUser) return
  const status = onlineUsers.get(connectedUser)?.status
  if (status !== 'tavern' && status !== 'afk') return
  if (!text || typeof text !== 'string') return
  const trimmed = text.trim().slice(0, 200)
  if (!trimmed) return
  const now = Date.now()
  if (now - (chatRateLimit.get(connectedUser) ?? 0) < 1000) return
  chatRateLimit.set(connectedUser, now)
  const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  io.emit('chat_message', { username: connectedUser, text: trimmed, time })
})
```

### Disconnect cleanup

In the existing `disconnect` handler, add:

```js
chatRateLimit.delete(connectedUser)
```

---

## 5. Client State (`LobbyPage.jsx`)

### New state

```js
const [chatMessages, setChatMessages] = useState([])  // max 100 items
const [chatUnread, setChatUnread] = useState(false)
```

### New handlers

```js
function handleSendMessage(text) {
  socketRef.current?.emit('chat_message', { text })
}

function handleChatOpen() {
  setChatUnread(false)
}
```

### Socket listener (added inside the socket setup `useEffect`)

```js
socket.on('chat_message', (msg) => {
  setChatMessages(prev => {
    const next = [...prev, msg]
    return next.length > 100 ? next.slice(-100) : next
  })
  setChatUnread(true)
})
```

### Updated TavernPanel props

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

Both the desktop and mobile `TavernPanel` instances receive these props.

---

## 6. UI (`TavernPanel.jsx`)

### New props

```js
chatMessages = []   // array of { username, text, time }
chatUnread = false  // whether to show red dot on Chat tab
onSendMessage       // fn(text: string) => void
onChatOpen          // fn() => void — called when Chat tab is opened
```

### New internal state / derived values

```js
const [activeTab, setActiveTab] = useState('players')  // 'players' | 'chat'
const [chatInput, setChatInput] = useState('')
const chatEndRef = useRef(null)

// Derived from existing props — no new prop needed
const myStatus = users.find(u => u.username === myUsername)?.status ?? 'tavern'
```

### Username color

```js
const CHAT_COLORS = ['#a78bfa', '#22c55e', '#f97316', '#38bdf8', '#fb7185', '#fbbf24', '#34d399', '#818cf8']

function usernameColor(name) {
  let hash = 0
  for (const c of (name ?? '')) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
  return CHAT_COLORS[Math.abs(hash) % CHAT_COLORS.length]
}
```

### Auto-scroll

```js
useEffect(() => {
  chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
}, [chatMessages])
```

### Tab bar (replaces existing `.tv-header`)

```jsx
<div className="tv-tabs">
  <button
    className={`tv-tab${activeTab === 'players' ? ' tv-tab-active' : ''}`}
    onClick={() => setActiveTab('players')}
  >
    👥 Players {users.length > 0 && `(${users.length})`}
  </button>
  <button
    className={`tv-tab${activeTab === 'chat' ? ' tv-tab-active' : ''}`}
    onClick={() => { setActiveTab('chat'); onChatOpen?.() }}
  >
    💬 Chat {chatUnread && <span className="tv-tab-dot" />}
  </button>
</div>
```

### Chat view

```jsx
{activeTab === 'chat' && (
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
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey && chatInput.trim()) {
            onSendMessage?.(chatInput.trim())
            setChatInput('')
          }
        }}
        placeholder="type a message…"
        maxLength={200}
        disabled={myStatus !== 'tavern' && myStatus !== 'afk'}
      />
      <button
        className="tv-chat-send"
        onClick={() => {
          if (chatInput.trim()) {
            onSendMessage?.(chatInput.trim())
            setChatInput('')
          }
        }}
        disabled={!chatInput.trim()}
      >
        ↑
      </button>
    </div>
  </div>
)}
```

---

## 7. CSS (`public/css/tavern.css`)

```css
/* Tab bar */
.tv-tabs          { display: flex; gap: 4px; margin-bottom: 8px; }
.tv-tab           { flex: 1; padding: 5px 8px; border: none; border-radius: 6px;
                    background: transparent; color: #888; font-size: 11px; cursor: pointer;
                    display: flex; align-items: center; justify-content: center; gap: 5px; }
.tv-tab:hover     { background: rgba(255,255,255,0.05); color: #ccc; }
.tv-tab-active    { background: rgba(255,255,255,0.08); color: #fff; }
.tv-tab-dot       { width: 6px; height: 6px; border-radius: 50%; background: #ef4444;
                    flex-shrink: 0; }

/* Chat area */
.tv-chat-wrap     { display: flex; flex-direction: column; flex: 1; min-height: 0; gap: 6px; }
.tv-chat-messages { flex: 1; overflow-y: auto; display: flex; flex-direction: column;
                    gap: 3px; min-height: 0; }
.tv-chat-msg      { font-size: 11px; line-height: 1.4; word-break: break-word; }
.tv-chat-msg-time { color: #555; margin-right: 4px; font-size: 10px; }
.tv-chat-msg-text { color: #ccc; }

/* Input */
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

---

## 8. Files to Change

| File | Change |
|------|--------|
| `api/server.js` | Add `chatRateLimit` map, `chat_message` handler, cleanup in disconnect |
| `client/src/pages/LobbyPage.jsx` | Add `chatMessages`/`chatUnread` state, socket listener, `handleSendMessage`/`handleChatOpen`, new props on TavernPanel |
| `client/src/pages/TavernPanel.jsx` | Add new props, `activeTab`/`chatInput`/`chatEndRef`, `usernameColor`, tab bar, chat view |
| `public/css/tavern.css` | Add tab and chat CSS classes |

---

## Out of Scope

- Mobile tavern chat — will be addressed after mobile tavern is implemented
- Message moderation / content filtering
- Server-side message history / persistence
- Sound notifications
- @mentions or user tagging

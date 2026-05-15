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
        💬 Chat{chatUnread && activeTab !== 'chat' && <span className="tv-tab-dot" />}
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

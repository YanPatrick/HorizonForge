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

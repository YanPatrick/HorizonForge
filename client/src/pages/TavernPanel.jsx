/**
 * TavernPanel — lista de jogadores online em tempo real.
 *
 * Props:
 *   users    — array de { username, status, detail }
 *              status: 'taverna' | 'procurando' | 'batalha'
 *   isMobile — boolean; no mobile renderiza versão compacta sem cabeçalho lateral
 */
export default function TavernPanel({ users = [], isMobile = false }) {
  /* Ordena: batalha → procurando → taverna */
  const ORDER = { battle: 0, searching: 1, tavern: 2 }
  const sorted = [...users].sort((a, b) => (ORDER[a.status] ?? 3) - (ORDER[b.status] ?? 3))

  const groups = {
    battle: sorted.filter(u => u.status === 'battle'),
    searching: sorted.filter(u => u.status === 'searching'),
    tavern: sorted.filter(u => u.status === 'tavern'),
  }

  function initials(name) {
    return (name ?? '?').slice(0, 2).toUpperCase()
  }

  function UserRow({ user }) {
    return (
      <div className="tv-row">
        <div className={`tv-avatar tv-avatar-${user.status}`}>
          {initials(user.username)}
        </div>
        <div className="tv-row-info">
          <span className="tv-name">@{user.username}</span>
          {user.detail && <span className="tv-detail">{user.detail}</span>}
        </div>
        <span className={`tv-badge tv-badge-${user.status}`}>
          <span className="tv-dot" />
          {user.status === 'battle' ? 'battle' :
            user.status === 'searching' ? 'searching' : 'tavern'}
        </span>
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
              <Group title="In Battle" list={groups.battle} />
              <Group title="Searching" list={groups.searching} />
              <Group title="In Tavern" list={groups.tavern} />
            </>
          )}
        </div>
      </div>
    )
  }

  /* Desktop — sidebar */
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
              <Group title="In Battle" list={groups.battle} />
              <Group title="Searching" list={groups.searching} />
              <Group title="In Tavern" list={groups.tavern} />
            </>
          )}
        </div>
      </div>
    </aside>
  )
}

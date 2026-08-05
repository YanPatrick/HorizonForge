import { useMemo, useState } from 'react'
import '@styles/market.css'
import { useT } from '../context/LanguageContext'

const SLOT_ICONS = {
  weapon: '⚔️', helm: '⛑️', legs: '🥾', boots: '👢', gloves: '🧤',
  ring1: '💍', ring2: '💍', belt: '🎗️', special: '✨',
}

async function marketFetch(path, session, opts = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (session?.token) headers.Authorization = `Bearer ${session.token}`
  const res = await fetch(path, { ...opts, headers: { ...headers, ...(opts.headers || {}) } })
  return res.json()
}

export default function MarketView({ session, items, onSold, toast }) {
  const { t } = useT()
  const [trayIds, setTrayIds] = useState([])
  const [dragOver, setDragOver] = useState(false)
  const [selling, setSelling] = useState(false)

  // Only idle-crafted, unequipped, priced items are ever sellable here.
  const sellable = useMemo(
    () => (items || []).filter(i => i.source === 'idle_dungeon' && i.sell_price != null && !i.equipped_on),
    [items]
  )
  const byId = useMemo(() => Object.fromEntries(sellable.map(i => [i.id, i])), [sellable])
  const trayEntries = trayIds.filter(id => byId[id])
  const total = trayEntries.reduce((sum, id) => sum + (byId[id]?.sell_price ?? 0), 0)

  function addToTray(id) {
    if (!byId[id] || trayIds.includes(id)) return
    setTrayIds(prev => [...prev, id])
  }

  function removeFromTray(id) {
    setTrayIds(prev => prev.filter(x => x !== id))
  }

  function handleTrayDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const id = Number(e.dataTransfer.getData('text/plain'))
    if (id) addToTray(id)
  }

  function handleInventoryDrop(e) {
    e.preventDefault()
    const raw = e.dataTransfer.getData('text/plain')
    if (raw?.startsWith('tray:')) removeFromTray(Number(raw.slice(5)))
  }

  async function handleSell() {
    if (trayEntries.length === 0 || selling) return
    setSelling(true)
    const data = await marketFetch('/api/market/sell', session, {
      method: 'POST',
      body: JSON.stringify({ player: session.username, item_ids: trayEntries }),
    })
    setSelling(false)
    if (!data.ok) return toast?.(data.error)
    toast?.(t('market.sold', { coins: data.total_coins }))
    onSold?.(trayEntries)
    setTrayIds([])
  }

  return (
    <div id="view-market" className="lv active mkt-layout">
      <div className="mkt-banner">
        <img
          className="mkt-banner-img"
          src="/images/market/merchant-banner.jpg"
          alt=""
          onError={e => { e.currentTarget.style.display = 'none' }}
        />
        <div className="mkt-banner-fallback">🧙</div>
        <div className="mkt-banner-title">{t('market.title')}</div>
      </div>

      <div className="mkt-body">
        <div className="mkt-inventory" onDragOver={e => e.preventDefault()} onDrop={handleInventoryDrop}>
          <div className="mkt-panel-title">{t('market.yourItems')}</div>
          {sellable.length === 0
            ? <div className="mkt-empty">{t('market.noItems')}</div>
            : (
              <div className="mkt-item-grid">
                {sellable.map(item => {
                  const staged = trayIds.includes(item.id)
                  return (
                    <div
                      key={item.id}
                      className={`mkt-item-card${staged ? ' staged' : ''}`}
                      draggable={!staged}
                      onDragStart={e => e.dataTransfer.setData('text/plain', String(item.id))}
                      onClick={() => addToTray(item.id)}
                      title={item.name}
                    >
                      <span className="mkt-item-ico">{SLOT_ICONS[item.slot_type] ?? '📦'}</span>
                      <span className="mkt-item-name">{item.name}</span>
                      <span className="mkt-item-price">🪙 {item.sell_price}</span>
                    </div>
                  )
                })}
              </div>
            )}
        </div>

        <div
          className={`mkt-tray${dragOver ? ' drag-over' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleTrayDrop}
        >
          <div className="mkt-panel-title">{t('market.sellTray')}</div>
          {trayEntries.length === 0
            ? <div className="mkt-tray-empty">{t('market.dragHint')}</div>
            : (
              <div className="mkt-tray-list">
                {trayEntries.map(id => {
                  const item = byId[id]
                  return (
                    <div
                      key={id}
                      className="mkt-tray-row"
                      draggable
                      onDragStart={e => e.dataTransfer.setData('text/plain', `tray:${id}`)}
                    >
                      <span className="mkt-item-ico">{SLOT_ICONS[item.slot_type] ?? '📦'}</span>
                      <span className="mkt-tray-name">{item.name}</span>
                      <span className="mkt-tray-subtotal">🪙 {item.sell_price}</span>
                      <button type="button" className="mkt-tray-remove" onClick={() => removeFromTray(id)}>✕</button>
                    </div>
                  )
                })}
              </div>
            )}
          <div className="mkt-tray-footer">
            <span className="mkt-tray-total">{t('market.total')}: 🪙 {total}</span>
            <button type="button" className="mkt-btn-sell" disabled={trayEntries.length === 0 || selling} onClick={handleSell}>
              {t('market.sell')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

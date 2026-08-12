import { useEffect, useState } from 'react'
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

export default function MarketView({ session, toast }) {
  const { t } = useT()
  const username = session?.username
  const [inventory, setInventory] = useState([])
  const [selling, setSelling] = useState(null)

  const refresh = async () => {
    if (!username) return
    const data = await marketFetch(`/api/idle/items?player=${encodeURIComponent(username)}`, session)
    if (data.ok) setInventory(data.inventory)
  }

  useEffect(() => { refresh() }, [username])

  const handleSell = async (slotType, plusLevel, qty) => {
    const key = `${slotType}:${plusLevel}`
    setSelling(key)
    const data = await marketFetch('/api/market/sell', session, {
      method: 'POST',
      body: JSON.stringify({ player: username, slot_type: slotType, plus_level: plusLevel, qty }),
    })
    setSelling(null)
    if (!data.ok) return toast?.(data.error)
    toast?.(`Sold ${data.sold.qty}x — +${data.total_coins} coins`)
    refresh()
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
        <div className="mkt-inventory">
          <div className="mkt-panel-title">{t('market.yourItems')}</div>
          {inventory.length === 0
            ? <div className="mkt-empty">{t('market.noItems')}</div>
            : (
              <div className="mkt-item-grid">
                {inventory.map(entry => {
                  const key = `${entry.slot_type}:${entry.plus_level}`
                  return (
                    <div key={key} className="mkt-item-card" title={`${entry.slot_type} +${entry.plus_level}`}>
                      <span className="mkt-item-ico">{SLOT_ICONS[entry.slot_type] ?? '📦'}</span>
                      <span className="mkt-item-name">{entry.slot_type} +{entry.plus_level}</span>
                      <span className="mkt-item-price">x{entry.qty}</span>
                      <button
                        type="button"
                        className="mkt-btn-sell"
                        disabled={selling === key}
                        onClick={() => handleSell(entry.slot_type, entry.plus_level, 1)}
                      >
                        {t('market.sell')}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
        </div>
      </div>
    </div>
  )
}

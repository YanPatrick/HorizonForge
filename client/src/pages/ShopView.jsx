import { useState, useEffect, useCallback } from 'react'
import '@styles/shop.css'
import { useT } from '../context/LanguageContext'


function sortItems(items, sortBy, owned) {
  const copy = [...items]
  switch (sortBy) {
    case 'name': return copy.sort((a, b) => a.name.localeCompare(b.name))
    case 'new': return copy.sort((a, b) => ((b.created_ms || 0) - (a.created_ms || 0)) || a.name.localeCompare(b.name))
    case 'old': return copy.sort((a, b) => ((a.created_ms || 0) - (b.created_ms || 0)) || a.name.localeCompare(b.name))
    case 'owned': return copy.sort((a, b) => (owned.has(b.id) ? 1 : 0) - (owned.has(a.id) ? 1 : 0) || a.name.localeCompare(b.name))
    case 'not_owned': return copy.sort((a, b) => (owned.has(a.id) ? 1 : 0) - (owned.has(b.id) ? 1 : 0) || a.name.localeCompare(b.name))
    default: return copy
  }
}

export default function ShopView({ session, toast, heroData }) {
  const { t } = useT()

  const FILTERS = [
    { key: 'background', label: t('shop.filterBg') },
    { key: 'skin',       label: t('shop.filterSkin') },
    { key: 'treasure',   label: t('shop.filterTreasure') },
  ]
  const SEARCH_PLACEHOLDER = {
    background: t('shop.searchBg'),
    skin:       t('shop.searchSkin'),
    treasure:   t('shop.searchTreasure'),
  }
  const SORT_OPTIONS = [
    { value: 'new',       label: t('sort.new') },
    { value: 'old',       label: t('sort.old') },
    { value: 'name',      label: t('sort.name') },
    { value: 'owned',     label: t('sort.owned') },
    { value: 'not_owned', label: t('sort.notOwned') },
  ]

  const [catalog, setCatalog] = useState([])
  const [owned, setOwned] = useState(new Set())
  const [equippedBgs, setEquippedBgs] = useState([])
  const [equippedSkins, setEquippedSkins] = useState({})
  const [gameAccount, setGameAccount] = useState('')
  const [filter, setFilter] = useState('background')
  const [search, setSearch] = useState('')
  const showOwnedKey = session?.username ? `hf_shop_show_owned_${session.username}` : 'hf_shop_show_owned'
  const getShowOwnedPref = () => {
    const v = localStorage.getItem(showOwnedKey)
    return v !== null ? v === 'true' : true
  }
  const [showOwned, setShowOwned] = useState(getShowOwnedPref)
  const [sortBy, setSortBy] = useState('new')
  const [modal, setModal] = useState(null)
  const [claiming, setClaiming] = useState(null)
  const [equipping, setEquipping] = useState(null)
  const [modalError, setModalError] = useState('')
  const [chestResult, setChestResult] = useState(null)

  const isHive = session?.mode === 'hive'
  const token = session?.token
  const username = session?.username

  const equippedBgIds = new Set(equippedBgs.map(b => b.id))

  useEffect(() => {
    fetch('/api/shop')
      .then(r => r.json())
      .then(d => { setCatalog(d.items || []); setGameAccount(d.gameAccount || '') })
      .catch(() => { })

    if (isHive && token) {
      const h = { Authorization: `Bearer ${token}` }
      // /api/shop/owned runs ensureDefaultCosmetics (inserts defaults for new users).
      // Equipped reads must come AFTER it resolves to avoid reading before INSERTs finish.
      fetch('/api/shop/owned', { headers: h })
        .then(r => r.json())
        .then(async d => {
          setOwned(new Set(d.owned || []))
          const [bgs, skins] = await Promise.all([
            fetch('/api/cosmetics/backgrounds/equipped', { headers: h }).then(r => r.json()),
            fetch('/api/cosmetics/skins/equipped', { headers: h }).then(r => r.json()),
          ])
          setEquippedBgs(bgs.equipped || [])
          setEquippedSkins(skins.equipped || {})
        })
        .catch(() => { })
    }
  }, [isHive, token])

  const filtered = catalog.filter(item => {
    if (filter !== 'all' && item.type !== filter) return false
    if (!showOwned && owned.has(item.id)) return false
    if (search) {
      const q = search.toLowerCase()
      if (!item.name.toLowerCase().includes(q) && !(item.hero_cid || '').toLowerCase().includes(q)) return false
    }
    return true
  })

  async function claimFree(item) {
    if (!isHive || !token) return
    setClaiming(item.id)
    try {
      const res = await fetch('/api/shop/verify-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ item_id: item.id }),
      }).then(r => r.json())
      if (res.ok) {
        setOwned(prev => new Set([...prev, item.id]))
        toast?.(`${item.name} acquired!`)
      } else {
        toast?.('Failed to claim item.')
      }
    } catch { toast?.('Network error.') }
    finally { setClaiming(null) }
  }

  async function equipBackground(item_id) {
    if (!isHive || !token) return
    setEquipping(item_id)
    try {
      const res = await fetch('/api/cosmetics/backgrounds/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ item_id }),
      }).then(r => r.json())
      if (res.ok) {
        const item = catalog.find(i => i.id === item_id)
        setEquippedBgs(prev => [...prev, { id: item_id, preview: item?.preview || '' }])
      } else {
        toast?.(res.error || 'Failed to equip.')
      }
    } catch { toast?.('Network error.') }
    finally { setEquipping(null) }
  }

  async function unequipBackground(item_id) {
    if (!isHive || !token) return
    if (equippedBgs.length <= 1) {
      toast?.('At least 1 background must be equipped.')
      return
    }
    setEquipping(item_id)
    try {
      const res = await fetch('/api/cosmetics/backgrounds/unequip', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ item_id }),
      }).then(r => r.json())
      if (res.ok) {
        setEquippedBgs(prev => prev.filter(b => b.id !== item_id))
      } else {
        toast?.(res.error || 'Failed to unequip background.')
      }
    } catch { toast?.('Network error.') }
    finally { setEquipping(null) }
  }

  async function equipSkin(skin_id) {
    if (!isHive || !token) return
    setEquipping(skin_id)
    try {
      const res = await fetch('/api/cosmetics/skins/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ skin_id }),
      }).then(r => r.json())
      if (res.ok) {
        const item = catalog.find(i => i.id === skin_id)
        if (item?.hero_cid) {
          setEquippedSkins(prev => ({ ...prev, [item.hero_cid]: { skin_id, preview: item.preview || '' } }))
        }
      } else {
        toast?.(res.error || 'Failed to equip skin.')
      }
    } catch { toast?.('Network error.') }
    finally { setEquipping(null) }
  }

  async function unequipSkin(skin_id) {
    if (!isHive || !token) return
    const hero_cid = Object.keys(equippedSkins).find(k => equippedSkins[k].skin_id === skin_id)
    if (!hero_cid) return
    const ownedForHero = catalog.filter(i => i.type === 'skin' && i.hero_cid === hero_cid && owned.has(i.id))
    if (ownedForHero.length <= 1) {
      toast?.(`At least 1 skin must remain equipped for ${hero_cid.charAt(0).toUpperCase() + hero_cid.slice(1)}.`)
      return
    }
    setEquipping(skin_id)
    try {
      const res = await fetch('/api/cosmetics/skins/unequip', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ hero_cid }),
      }).then(r => r.json())
      if (res.ok) {
        setEquippedSkins(prev => {
          const next = { ...prev }
          delete next[hero_cid]
          return next
        })
      } else {
        toast?.(res.error || 'Failed to unequip skin.')
      }
    } catch { toast?.('Network error.') }
    finally { setEquipping(null) }
  }

  function openModal(item) { setModal(item); setModalError('') }

  async function confirmBuy() {
    if (!modal || claiming) return
    if (!window.hive_keychain) { setModalError('Hive Keychain not found.'); return }
    setModalError('')
    setClaiming(modal.id)
    window.hive_keychain.requestTransfer(
      username, gameAccount, modal.price_hive.toFixed(3), `shop_${modal.id}`, 'HIVE',
      async (response) => {
        if (!response.success) {
          setClaiming(null)
          setModalError(response.error || 'Transfer cancelled.')
          return
        }
        try {
          const res = await fetch('/api/shop/verify-purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ item_id: modal.id }),
          }).then(r => r.json())
          if (res.ok) {
            if (res.item) {
              // Chest purchase: show rolled item result
              setChestResult({ chestName: modal.name, item: res.item })
            } else {
              setOwned(prev => new Set([...prev, modal.id]))
              toast?.(`${modal.name} acquired!`)
            }
            setModal(null)
          } else {
            setModalError('Payment not confirmed. Please try again.')
          }
        } catch { setModalError('Network error while verifying payment.') }
        finally { setClaiming(null) }
      }
    )
  }

  const sorted = sortItems(filtered, sortBy, owned)
  const sharedCardProps = { isHive, heroData, equippedBgs, equippedBgIds, equippedSkins, equipping }

  return (
    <div id="view-shop" className="lv active">
      <div className="wiki-layout">
        <aside className="wiki-sidebar">
          <div className="wiki-category">{t('shop.category')}</div>
          {FILTERS.map(f => (
            <button key={f.key} className={`wiki-item${filter === f.key ? ' active' : ''}`} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </aside>

        <div className="wiki-content shop-content">
          <div className="shop-mobile-filters">
            {FILTERS.map(f => (
              <button key={f.key} className={`shop-pill${filter === f.key ? ' active' : ''}`} onClick={() => setFilter(f.key)}>
                {f.label}
              </button>
            ))}
          </div>

          <div className="shop-search-wrap">
            <input
              className="shop-search"
              type="text"
              placeholder={SEARCH_PLACEHOLDER[filter] || 'Search...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div className="shop-sort-wrap">
              <span className="shop-sort-label">{t('shop.sortBy')}</span>
              <select className="shop-sort" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {(filter === 'skin' || filter === 'treasure') && (
            <div className="shop-slot-counter-bar">
              <label className="shop-owned-toggle">
                <input type="checkbox" checked={showOwned} onChange={e => setShowOwned(e.target.checked)} />
                {t('shop.showOwned')}
              </label>
            </div>
          )}

          {filter === 'background' && (
            <div className="shop-slot-counter-bar">
              <div className="shop-slot-dots">
                {[0, 1, 2, 3].map(i => (
                  <span key={i} className={`shop-slot-dot${i < equippedBgs.length ? ' filled' : ''}`} />
                ))}
              </div>
              <span className="shop-slot-label">{t('shop.bgsEquipped', { n: equippedBgs.length })}</span>
              <label className="shop-owned-toggle">
                <input type="checkbox" checked={showOwned} onChange={e => setShowOwned(e.target.checked)} />
                {t('shop.showOwned')}
              </label>
            </div>
          )}

          <div className={`shop-grid${filter === 'skin' ? ' shop-grid-skins' : filter === 'treasure' ? ' shop-grid-treasures' : ''}`}>
            {sorted.map(item => (
              <ShopItemCard
                key={item.id}
                item={item}
                isOwned={owned.has(item.id)}
                isClaiming={claiming === item.id}
                onBuy={() => item.price_hive === 0 ? claimFree(item) : openModal(item)}
                onEquip={() => item.type === 'background' ? equipBackground(item.id) : equipSkin(item.id)}
                onUnequip={() => item.type === 'background' ? unequipBackground(item.id) : unequipSkin(item.id)}
                {...sharedCardProps}
              />
            ))}
            {sorted.length === 0 && <div className="shop-empty">{t('shop.noItems')}</div>}
          </div>

          <div className="shop-list">
            {sorted.map(item => (
              <ShopListRow
                key={item.id}
                item={item}
                isOwned={owned.has(item.id)}
                isClaiming={claiming === item.id}
                onBuy={() => item.price_hive === 0 ? claimFree(item) : openModal(item)}
                onEquip={() => item.type === 'background' ? equipBackground(item.id) : equipSkin(item.id)}
                onUnequip={() => item.type === 'background' ? unequipBackground(item.id) : unequipSkin(item.id)}
                {...sharedCardProps}
              />
            ))}
            {sorted.length === 0 && <div className="shop-empty">{t('shop.noItems')}</div>}
          </div>
        </div>
      </div>

      {modal && (
        <div className="shop-modal-overlay" onClick={() => !claiming && setModal(null)}>
          <div className="shop-modal" onClick={e => e.stopPropagation()}>
            <div className="shop-modal-preview" style={{ backgroundImage: `url(${modal.preview})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />
            <div className="shop-modal-body">
              <div className="shop-modal-name">{modal.name}</div>
              <div className="shop-modal-price">{modal.price_hive.toFixed(3)} HIVE</div>
              {modal.type === 'treasure'
                ? <div className="shop-modal-tos">{t('shop.tosTreasure')}</div>
                : <div className="shop-modal-tos">{t('shop.tosCosmetic')}</div>
              }
              {modalError && <div className="shop-modal-error">{modalError}</div>}
              <div className="shop-modal-actions">
                <button className="shop-btn-cancel" onClick={() => setModal(null)} disabled={!!claiming}>{t('shop.cancel')}</button>
                <button className="shop-btn-confirm" onClick={confirmBuy} disabled={!!claiming}>{claiming ? t('shop.verifying') : t('shop.confirm')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {chestResult && (
        <ChestResultModal result={chestResult} onClose={() => setChestResult(null)} />
      )}
    </div>
  )
}

const CHEST_RESULT_RARITY_COLORS = {
  common: '#c0bdb5', uncommon: '#4caf50', rare: '#42a5f5',
  epic: '#ba68c8', legendary: '#ff2d9b',
}

const SLOT_ICONS_CHEST = {
  amulet: '📿', helm: '⛑️', special: '✨', weapon: '⚔️',
  chest: '🛡️', offhand: '📜', belt: '🏷️', legs: '👖',
  gloves: '🧤', ring1: '💍', boots: '🥾', ring2: '💍',
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}

const ATTR_LABELS = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' }

function ChestResultModal({ result, onClose }) {
  const { t } = useT()
  const { chestName, item } = result
  const isCritHit   = item.d20_roll === 20
  const isCritFail  = item.d20_roll === 1
  const hasNegative = item.atk_bonus < 0 || item.hp_bonus < 0 || item.spd_bonus < 0

  const accentColor = isCritHit  ? '#ffd700'
    : isCritFail ? '#ff4444'
    : (CHEST_RESULT_RARITY_COLORS[item.rarity] || '#cccccc')

  const rgb = hexToRgb(accentColor)

  const modalClass = [
    'chest-result-modal',
    isCritHit  ? 'crit-hit'  : '',
    isCritFail ? 'crit-fail' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className="shop-modal-overlay" onClick={onClose}>
      <div
        className={modalClass}
        onClick={e => e.stopPropagation()}
        style={{
          '--accent':    accentColor,
          '--accent-20': `rgba(${rgb},0.2)`,
          '--accent-40': `rgba(${rgb},0.4)`,
          border:     `1px solid rgba(${rgb},0.4)`,
          boxShadow:  `0 0 32px rgba(${rgb},0.2), 0 8px 32px rgba(0,0,0,0.6)`,
        }}
      >
        {isCritHit && <div className="cr-shimmer" />}
        <div className="cr-bar" />
        <div className="cr-inner">
          <div className="cr-badge">✦ {chestName?.toUpperCase?.() || ''}</div>

          {isCritHit  && <div className="cr-crit cr-crit--hit">⚡ CRITICAL HIT · D20 = 20</div>}
          {isCritFail && <div className="cr-crit cr-crit--fail">💀 CRITICAL FAIL · D20 = 1</div>}
          {!isCritHit && !isCritFail && item.d20_roll != null && (
            <div className="cr-d20">🎲 D20 = <strong>{item.d20_roll}</strong></div>
          )}

          <div
            className="cr-ring"
            style={{
              background: `radial-gradient(circle, rgba(${rgb},0.4) 0%, transparent 70%)`,
              border:     `2px solid rgba(${rgb},0.6)`,
              boxShadow:  isCritHit
                ? `0 0 32px rgba(${rgb},0.7)`
                : `0 0 20px rgba(${rgb},0.45)`,
            }}
          >
            <span className="cr-ring-icon">
              {SLOT_ICONS_CHEST[item.slot_type] || '✦'}
            </span>
          </div>

          <div className="cr-name" style={{ color: accentColor }}>{item.name}</div>
          <div className="cr-meta">
            <span className="cr-slot">{item.slot_type}</span>
            <span className="cr-dot">·</span>
            <span className="cr-rarity" style={{ color: accentColor }}>{item.rarity}</span>
          </div>

          <div className="cr-stats">
            {item.atk_bonus !== 0 && (
              <div className={`cr-stat${item.atk_bonus < 0 ? ' cr-stat--neg' : ''}`}>
                {item.atk_bonus > 0 ? '+' : ''}{item.atk_bonus} ATK
              </div>
            )}
            {item.hp_bonus !== 0 && (
              <div className={`cr-stat${item.hp_bonus < 0 ? ' cr-stat--neg' : ''}`}>
                {item.hp_bonus > 0 ? '+' : ''}{item.hp_bonus} HP
              </div>
            )}
            {item.spd_bonus !== 0 && (
              <div className={`cr-stat${item.spd_bonus < 0 ? ' cr-stat--neg' : ''}`}>
                {item.spd_bonus > 0 ? '+' : ''}{Number(item.spd_bonus).toFixed(2)} SPD
              </div>
            )}
          </div>

          {item.req_attr && item.req_value && (
            <div className="cr-req">
              {t('shop.requires', { attr: ATTR_LABELS[item.req_attr] || item.req_attr, value: item.req_value })}
            </div>
          )}

          {item.flavor_text && <div className="cr-flavor">"{item.flavor_text}"</div>}

          {!hasNegative && !item.flavor_text && (
            <div className="cr-acquired">{t('shop.itemAdded')}</div>
          )}
          {hasNegative && !item.flavor_text && (
            <div className="cr-acquired">{t('shop.cursedItemAdded')}</div>
          )}

          <button className="cr-close" onClick={onClose}>{t('shop.close')}</button>
        </div>
      </div>
    </div>
  )
}

const CHEST_DROPS = [
  { key: 'common',    pct: '40%', cls: 'r-comum' },
  { key: 'uncommon',  pct: '30%', cls: 'r-incomum' },
  { key: 'rare',      pct: '20%', cls: 'r-raro' },
  { key: 'epic',      pct: '8%',  cls: 'r-epico' },
  { key: 'legendary', pct: '2%',  cls: 'r-lendario' },
]

const TOOLTIP_W = 170
const TOOLTIP_H = 140
const TOOLTIP_GAP = 14

function ChestTooltip({ x, y }) {
  const { t } = useT()
  const showBelow = y < TOOLTIP_H + TOOLTIP_GAP + 16
  let left = x - TOOLTIP_W / 2
  if (left < 8) left = 8
  if (left + TOOLTIP_W > window.innerWidth - 8) left = window.innerWidth - TOOLTIP_W - 8
  const top = showBelow ? y + TOOLTIP_GAP : y - TOOLTIP_H - TOOLTIP_GAP
  const arrowX = Math.max(12, Math.min(x - left, TOOLTIP_W - 12))

  return (
    <div
      className="chest-tooltip-fixed"
      data-dir={showBelow ? 'below' : 'above'}
      style={{ left, top, '--arrow-x': `${arrowX}px` }}
    >
      <div className="chest-tooltip-title">{t('shop.dropRates')}</div>
      {CHEST_DROPS.map(d => (
        <div key={d.key} className="chest-tooltip-row">
          <span className={d.cls}>{t(`rarity.${d.key}`)}</span>
          <span>{d.pct}</span>
        </div>
      ))}
    </div>
  )
}

function TreasurePreview({ previewStyle, showDropRates = true }) {
  const [cursor, setCursor] = useState(null)
  const handleMove = useCallback(e => setCursor({ x: e.clientX, y: e.clientY }), [])
  const handleLeave = useCallback(() => setCursor(null), [])

  return (
    <>
      <div
        className="shop-card-preview"
        style={previewStyle}
        onMouseMove={showDropRates ? handleMove : undefined}
        onMouseLeave={showDropRates ? handleLeave : undefined}
      />
      {showDropRates && cursor && <ChestTooltip x={cursor.x} y={cursor.y} />}
    </>
  )
}

function getItemEquipState(item, equippedBgIds, equippedSkins) {
  if (item.type === 'background') return equippedBgIds.has(item.id)
  if (item.type === 'skin') return equippedSkins[item.hero_cid]?.skin_id === item.id
  return false
}

function SkinPreview({ item, heroData, className, style }) {
  if (item.preview) {
    return <div className={className} style={{ ...style, backgroundImage: `url(${item.preview})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
  }
  const hero = heroData?.find(h => h.cid === item.hero_cid)
  return (
    <div className={className} style={{ ...style, background: hero?.bg_gradient || '#1a1a2e' }}>
      <span className="shop-preview-ico">{hero?.icon || '✨'}</span>
    </div>
  )
}

function ShopItemCard({ item, isOwned, isHive, isClaiming, onBuy, onEquip, onUnequip, heroData, equippedBgs, equippedBgIds, equippedSkins, equipping }) {
  const { t } = useT()
  const isFree = item.price_hive === 0
  const buyDisabled = isOwned || isClaiming || !isHive
  const isEquipped = getItemEquipState(item, equippedBgIds, equippedSkins)
  const canEquip = item.type !== 'background' || equippedBgs.length < 4
  const isEquipping = equipping === item.id
  const bgSize = item.type === 'treasure' ? 'contain' : 'cover'
  const previewStyle = { backgroundImage: `url(${item.preview})`, backgroundSize: bgSize, backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }

  return (
    <div className={`shop-card${isOwned ? ' shop-card-owned' : ''}${isEquipped ? ' shop-card-equipped' : ''}`}>
      {item.type === 'skin' && !item.preview
        ? <SkinPreview item={item} heroData={heroData} className="shop-card-preview" />
        : item.type === 'treasure'
          ? <TreasurePreview previewStyle={previewStyle} showDropRates={item.id !== 'chaos_chest'} />
          : <div className="shop-card-preview" style={previewStyle} />
      }
      <div className="shop-card-body">
        <div className="shop-card-name">{item.name}</div>
        {item.type === 'skin' && item.hero_cid && (
          <div className="shop-card-hero">{item.hero_cid.charAt(0).toUpperCase() + item.hero_cid.slice(1)}</div>
        )}
        {item.type === 'skin' && item.description && (
          <div className="shop-card-desc">{item.description}</div>
        )}
        <div className="shop-card-actions">
          {item.type === 'treasure'
            ? <button
                className="shop-card-btn buy"
                disabled={isClaiming || !isHive}
                onClick={onBuy}
                title={!isHive ? 'Log in with Hive Keychain to purchase.' : undefined}
              >
                {isClaiming ? '⌛' : `${item.price_hive.toFixed(3)} HIVE`}
              </button>
            : isOwned
              ? <>
                  <div className="shop-card-owned-badge">{t('shop.owned')}</div>
                  <button
                    className={`shop-card-btn ${isEquipped ? 'unequip' : 'equip'}`}
                    disabled={isEquipping || !isHive || (!isEquipped && !canEquip)}
                    onClick={isEquipped ? onUnequip : onEquip}
                    title={!isHive ? 'Login to equip cosmetics.' : (!isEquipped && !canEquip) ? '4/4 background slots used' : undefined}
                  >
                    {isEquipping ? '⌛' : isEquipped ? (item.type === 'background' ? t('shop.remove') : t('shop.unequip')) : t('shop.equip')}
                  </button>
                </>
              : <button
                  className={`shop-card-btn${isFree ? ' free' : ' buy'}`}
                  disabled={isClaiming || !isHive}
                  onClick={onBuy}
                  title={!isHive ? 'Log in with Hive Keychain to purchase.' : undefined}
                >
                  {isClaiming ? '⌛' : isFree ? t('shop.getFree') : `${item.price_hive.toFixed(3)} HIVE`}
                </button>
          }
        </div>
      </div>
    </div>
  )
}

function ShopListRow({ item, isOwned, isHive, isClaiming, onBuy, onEquip, onUnequip, heroData, equippedBgs, equippedBgIds, equippedSkins, equipping }) {
  const { t } = useT()
  const isFree = item.price_hive === 0
  const buyDisabled = isOwned || isClaiming || !isHive
  const isEquipped = getItemEquipState(item, equippedBgIds, equippedSkins)
  const canEquip = item.type !== 'background' || equippedBgs.length < 4
  const isEquipping = equipping === item.id

  return (
    <div className={`shop-row${isOwned ? ' shop-row-owned' : ''}${isEquipped ? ' shop-row-equipped' : ''}`}>
      {item.type === 'skin' && !item.preview
        ? <SkinPreview item={item} heroData={heroData} className="shop-row-preview" />
        : <div className="shop-row-preview" style={{ backgroundImage: `url(${item.preview})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      }
      <div className="shop-row-info">
        <div className="shop-row-name">{item.name}</div>
        <div className="shop-row-type">
          {item.type === 'background' ? t('shop.typeBackground') : item.type === 'treasure' ? t('shop.typeTreasure') : `${t('shop.typeSkin')} · ${item.hero_cid || ''}`}
        </div>
      </div>
      <div className="shop-row-right">
        {isOwned
          ? <div className={`shop-row-state${isEquipped ? ' equipped' : ''}`}>
              {isEquipped ? t('shop.equipped') : t('shop.owned')}
            </div>
          : item.type !== 'treasure' && <div className="shop-row-price">{isFree ? t('shop.free') : `${item.price_hive.toFixed(3)} HIVE`}</div>
        }
        {item.type === 'treasure'
          ? <button
              className="shop-row-btn buy"
              disabled={isClaiming || !isHive}
              onClick={onBuy}
              title={!isHive ? 'Log in with Hive Keychain to purchase.' : undefined}
            >
              {isClaiming ? '⌛' : `${item.price_hive.toFixed(3)} HIVE`}
            </button>
          : isOwned && item.type !== 'treasure'
            ? isEquipped
              ? <button
                  className="shop-row-btn unequip"
                  disabled={isEquipping || !isHive}
                  onClick={onUnequip}
                  title={!isHive ? 'Login to equip cosmetics.' : undefined}
                >
                  {isEquipping ? '⌛' : t('shop.remove')}
                </button>
              : <button
                  className="shop-row-btn equip"
                  disabled={isEquipping || !canEquip || !isHive}
                  onClick={onEquip}
                  title={!isHive ? 'Login to equip cosmetics.' : !canEquip ? '4/4 slots used' : undefined}
                >
                  {isEquipping ? '⌛' : t('shop.equip')}
                </button>
            : !isOwned && <button
                className={`shop-row-btn${isFree ? ' free' : ' buy'}`}
                disabled={buyDisabled}
                onClick={onBuy}
                title={!isHive ? 'Log in with Hive Keychain to obtain cosmetics.' : undefined}
              >
                {isClaiming ? '⌛' : isFree ? t('shop.getFree') : t('shop.buy')}
              </button>
        }
      </div>
    </div>
  )
}

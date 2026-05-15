import { useState, useEffect } from 'react'
import '@styles/shop.css'

const FILTERS = [
  { key: 'background', label: '🌄 Backgrounds' },
  { key: 'skin', label: '✨ Skins' },
]

const SEARCH_PLACEHOLDER = {
  background: 'Search backgrounds...',
  skin: 'Search skins...',
}

const SORT_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'old', label: 'Old' },
  { value: 'name', label: 'Name' },
  { value: 'owned', label: 'Owned' },
  { value: 'not_owned', label: 'Not Owned' },
]

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

  useEffect(() => { setShowOwned(getShowOwnedPref()) }, [filter])

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
            setOwned(prev => new Set([...prev, modal.id]))
            toast?.(`${modal.name} acquired!`)
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
          <div className="wiki-category">Category</div>
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
              <span className="shop-sort-label">Sort by</span>
              <select className="shop-sort" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {filter === 'skin' && (
            <div className="shop-slot-counter-bar">
              <label className="shop-owned-toggle">
                <input type="checkbox" checked={showOwned} onChange={e => setShowOwned(e.target.checked)} />
                Show owned
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
              <span className="shop-slot-label">{equippedBgs.length}/4 backgrounds equipped</span>
              <label className="shop-owned-toggle">
                <input type="checkbox" checked={showOwned} onChange={e => setShowOwned(e.target.checked)} />
                Show owned
              </label>
            </div>
          )}

          <div className={`shop-grid${filter === 'skin' ? ' shop-grid-skins' : ''}`}>
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
            {sorted.length === 0 && <div className="shop-empty">No items found.</div>}
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
            {sorted.length === 0 && <div className="shop-empty">No items found.</div>}
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
              <div className="shop-modal-tos">This is a non-transferable digital cosmetic with no resale value. Purchases are final.</div>
              {modalError && <div className="shop-modal-error">{modalError}</div>}
              <div className="shop-modal-actions">
                <button className="shop-btn-cancel" onClick={() => setModal(null)} disabled={!!claiming}>Cancel</button>
                <button className="shop-btn-confirm" onClick={confirmBuy} disabled={!!claiming}>{claiming ? '⌛ Verifying...' : 'Confirm'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
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
  const isFree = item.price_hive === 0
  const buyDisabled = isOwned || isClaiming || !isHive
  const isEquipped = getItemEquipState(item, equippedBgIds, equippedSkins)
  const canEquip = item.type !== 'background' || equippedBgs.length < 4
  const isEquipping = equipping === item.id
  const previewStyle = { backgroundImage: `url(${item.preview})`, backgroundSize: 'cover', backgroundPosition: 'center' }

  return (
    <div className={`shop-card${isOwned ? ' shop-card-owned' : ''}${isEquipped ? ' shop-card-equipped' : ''}`}>
      {item.type === 'skin' && !item.preview
        ? <SkinPreview item={item} heroData={heroData} className="shop-card-preview" />
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
          <button
            className={`shop-card-btn${isOwned ? ' owned' : isFree ? ' free' : ' buy'}`}
            disabled={buyDisabled}
            onClick={onBuy}
            title={!isHive ? 'Log in with Hive Keychain to obtain cosmetics.' : undefined}
          >
            {isClaiming ? '⌛' : isOwned ? '✓ Owned' : isFree ? 'Get Free' : `${item.price_hive.toFixed(3)} HIVE`}
          </button>
          {isOwned && (
            <button
              className={`shop-card-btn ${isEquipped ? 'unequip' : 'equip'}`}
              disabled={isEquipping || !isHive || (!isEquipped && !canEquip)}
              onClick={isEquipped ? onUnequip : onEquip}
              title={!isHive ? 'Login to equip cosmetics.' : (!isEquipped && !canEquip) ? '4/4 background slots used' : undefined}
            >
              {isEquipping ? '⌛' : isEquipped ? (item.type === 'background' ? 'Remove' : 'Unequip') : 'Equip'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ShopListRow({ item, isOwned, isHive, isClaiming, onBuy, onEquip, onUnequip, heroData, equippedBgs, equippedBgIds, equippedSkins, equipping }) {
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
        <div className="shop-row-type">{item.type === 'background' ? 'Background' : `Skin · ${item.hero_cid || ''}`}</div>
      </div>
      <div className="shop-row-right">
        {isOwned
          ? <div className={`shop-row-state${isEquipped ? ' equipped' : ''}`}>
              {isEquipped ? '✦ Equipped' : '✓ Owned'}
            </div>
          : <div className="shop-row-price">{isFree ? 'Free' : `${item.price_hive.toFixed(3)} HIVE`}</div>
        }
        {isOwned
          ? isEquipped
            ? <button
                className="shop-row-btn unequip"
                disabled={isEquipping || !isHive}
                onClick={onUnequip}
                title={!isHive ? 'Login to equip cosmetics.' : undefined}
              >
                {isEquipping ? '⌛' : 'Remove'}
              </button>
            : <button
                className="shop-row-btn equip"
                disabled={isEquipping || !canEquip || !isHive}
                onClick={onEquip}
                title={!isHive ? 'Login to equip cosmetics.' : !canEquip ? '4/4 slots used' : undefined}
              >
                {isEquipping ? '⌛' : 'Equip'}
              </button>
          : <button
              className={`shop-row-btn${isFree ? ' free' : ' buy'}`}
              disabled={buyDisabled}
              onClick={onBuy}
              title={!isHive ? 'Log in with Hive Keychain to obtain cosmetics.' : undefined}
            >
              {isClaiming ? '⌛' : isFree ? 'Get Free' : 'Buy'}
            </button>
        }
      </div>
    </div>
  )
}

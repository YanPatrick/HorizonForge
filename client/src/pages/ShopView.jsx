import { useState, useEffect } from 'react'
import '@styles/shop.css'

const FILTERS = [
  { key: 'all',        label: 'All' },
  { key: 'background', label: '🌄 Backgrounds' },
  { key: 'skin',       label: '✨ Skins' },
  { key: 'owned',      label: '✓ Owned' },
]

export default function ShopView({ session, toast, heroData }) {
  const [catalog, setCatalog]           = useState([])
  const [owned, setOwned]               = useState(new Set())
  const [equippedBgs, setEquippedBgs]   = useState([])
  const [equippedSkins, setEquippedSkins] = useState({})
  const [gameAccount, setGameAccount]   = useState('')
  const [filter, setFilter]             = useState('all')
  const [heroFilter, setHeroFilter]     = useState('all')
  const [search, setSearch]             = useState('')
  const [modal, setModal]               = useState(null)
  const [claiming, setClaiming]         = useState(null)
  const [equipping, setEquipping]       = useState(null)
  const [modalError, setModalError]     = useState('')

  const isHive   = session?.mode === 'hive'
  const token    = session?.token
  const username = session?.username

  const equippedBgIds   = new Set(equippedBgs.map(b => b.id))
  const equippedSkinMap = equippedSkins

  useEffect(() => {
    fetch('/api/shop')
      .then(r => r.json())
      .then(d => { setCatalog(d.items || []); setGameAccount(d.gameAccount || '') })
      .catch(() => {})

    if (isHive && token) {
      const h = { Authorization: `Bearer ${token}` }
      fetch('/api/shop/owned', { headers: h })
        .then(r => r.json()).then(d => setOwned(new Set(d.owned || []))).catch(() => {})
      fetch('/api/cosmetics/backgrounds/equipped', { headers: h })
        .then(r => r.json()).then(d => setEquippedBgs(d.equipped || [])).catch(() => {})
      fetch('/api/cosmetics/skins/equipped', { headers: h })
        .then(r => r.json()).then(d => setEquippedSkins(d.equipped || {})).catch(() => {})
    }
  }, [isHive, token])

  const skinHeroes = [...new Set(catalog.filter(i => i.type === 'skin' && i.hero_cid).map(i => i.hero_cid))]

  const filtered = catalog.filter(item => {
    if (filter === 'owned' && !owned.has(item.id)) return false
    if (filter !== 'all' && filter !== 'owned' && item.type !== filter) return false
    if (filter === 'skin' && heroFilter !== 'all' && item.hero_cid !== heroFilter) return false
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
    setEquipping(item_id)
    try {
      await fetch('/api/cosmetics/backgrounds/unequip', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ item_id }),
      })
      setEquippedBgs(prev => prev.filter(b => b.id !== item_id))
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
        setEquippedSkins(prev => ({ ...prev, [item.hero_cid]: { skin_id, preview: item?.preview || '' } }))
      } else {
        toast?.(res.error || 'Failed to equip skin.')
      }
    } catch { toast?.('Network error.') }
    finally { setEquipping(null) }
  }

  async function unequipSkin(skin_id) {
    if (!isHive || !token) return
    setEquipping(skin_id)
    try {
      const item = catalog.find(i => i.id === skin_id)
      await fetch('/api/cosmetics/skins/unequip', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ hero_cid: item?.hero_cid }),
      })
      setEquippedSkins(prev => {
        const next = { ...prev }
        if (item?.hero_cid) delete next[item.hero_cid]
        return next
      })
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

  const sharedCardProps = { isHive, heroData, equippedBgs, equippedBgIds, equippedSkinMap, equipping }

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
          {filter === 'background' && (
            <div className="shop-slot-counter">{equippedBgs.length}/4 slots</div>
          )}
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
              placeholder="Search by name or hero..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {filter === 'skin' && skinHeroes.length > 0 && (
            <div className="shop-hero-pills">
              <button className={`shop-hero-pill${heroFilter === 'all' ? ' active' : ''}`} onClick={() => setHeroFilter('all')}>All</button>
              {skinHeroes.map(cid => (
                <button key={cid} className={`shop-hero-pill${heroFilter === cid ? ' active' : ''}`} onClick={() => setHeroFilter(cid)}>
                  {cid.charAt(0).toUpperCase() + cid.slice(1)}
                </button>
              ))}
            </div>
          )}

          {filter === 'background' && (
            <div className="shop-slot-counter-mobile">{equippedBgs.length}/4 slots equipped</div>
          )}

          <div className="shop-grid">
            {filtered.map(item => (
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
            {filtered.length === 0 && <div className="shop-empty">No items found.</div>}
          </div>

          <div className="shop-list">
            {filtered.map(item => (
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
            {filtered.length === 0 && <div className="shop-empty">No items found.</div>}
          </div>
        </div>
      </div>

      {modal && (
        <div className="shop-modal-overlay" onClick={() => !claiming && setModal(null)}>
          <div className="shop-modal" onClick={e => e.stopPropagation()}>
            <div className="shop-modal-preview" style={{ backgroundImage: `url(${modal.preview})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
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

function getItemEquipState(item, equippedBgIds, equippedSkinMap) {
  if (item.type === 'background') return equippedBgIds.has(item.id)
  if (item.type === 'skin') return equippedSkinMap[item.hero_cid]?.skin_id === item.id
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

function ShopItemCard({ item, isOwned, isHive, isClaiming, onBuy, onEquip, onUnequip, heroData, equippedBgs, equippedBgIds, equippedSkinMap, equipping }) {
  const isFree      = item.price_hive === 0
  const buyDisabled = isOwned || isClaiming || !isHive
  const isEquipped  = getItemEquipState(item, equippedBgIds, equippedSkinMap)
  const canEquip    = item.type !== 'background' || equippedBgs.length < 4
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
        <button
          className={`shop-card-btn${isOwned ? ' owned' : isFree ? ' free' : ' buy'}`}
          disabled={buyDisabled}
          onClick={onBuy}
          title={!isHive ? 'Log in with Hive Keychain to obtain cosmetics.' : undefined}
        >
          {isClaiming ? '⌛' : isOwned ? '✓ Owned' : isFree ? 'Get Free' : `${item.price_hive.toFixed(3)} HIVE`}
        </button>
        {isOwned && (
          isEquipped
            ? <>
                <span className="shop-card-equipped-badge">✓ Equipped</span>
                <button
                  className="shop-card-btn unequip"
                  disabled={isEquipping || !isHive}
                  onClick={onUnequip}
                  title={!isHive ? 'Login to equip cosmetics.' : undefined}
                >
                  {isEquipping ? '⌛' : item.type === 'background' ? 'Remove' : 'Unequip'}
                </button>
              </>
            : <button
                className="shop-card-btn equip"
                disabled={isEquipping || !canEquip || !isHive}
                onClick={onEquip}
                title={!isHive ? 'Login to equip cosmetics.' : !canEquip ? '4/4 background slots used' : undefined}
              >
                {isEquipping ? '⌛' : 'Equip'}
              </button>
        )}
      </div>
    </div>
  )
}

function ShopListRow({ item, isOwned, isHive, isClaiming, onBuy, onEquip, onUnequip, heroData, equippedBgs, equippedBgIds, equippedSkinMap, equipping }) {
  const isFree      = item.price_hive === 0
  const buyDisabled = isOwned || isClaiming || !isHive
  const isEquipped  = getItemEquipState(item, equippedBgIds, equippedSkinMap)
  const canEquip    = item.type !== 'background' || equippedBgs.length < 4
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
          ? <div className="shop-owned-text">✓ Owned</div>
          : <div className="shop-row-price">{isFree ? 'Free' : `${item.price_hive} HIVE`}</div>
        }
        <button
          className={`shop-row-btn${isOwned ? ' owned' : isFree ? ' free' : ' buy'}`}
          disabled={buyDisabled}
          onClick={onBuy}
          title={!isHive ? 'Log in with Hive Keychain to obtain cosmetics.' : undefined}
        >
          {isClaiming ? '⌛' : isOwned ? '✓' : isFree ? 'Get Free' : 'Buy'}
        </button>
        {isOwned && (
          isEquipped
            ? <>
                <span className="shop-row-equipped-badge">✓</span>
                <button
                  className="shop-row-btn unequip"
                  disabled={isEquipping || !isHive}
                  onClick={onUnequip}
                  title={!isHive ? 'Login to equip cosmetics.' : undefined}
                >
                  {isEquipping ? '⌛' : 'Remove'}
                </button>
              </>
            : <button
                className="shop-row-btn equip"
                disabled={isEquipping || !canEquip || !isHive}
                onClick={onEquip}
                title={!isHive ? 'Login to equip cosmetics.' : !canEquip ? '4/4 slots used' : undefined}
              >
                {isEquipping ? '⌛' : 'Equip'}
              </button>
        )}
      </div>
    </div>
  )
}

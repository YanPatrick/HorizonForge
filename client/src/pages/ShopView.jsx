import { useState, useEffect, useCallback } from 'react'
import '@styles/shop.css'
import { useT } from '../context/LanguageContext'
import ChestResultModal from '../components/ChestResultModal'


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
  const [modalError, setModalError] = useState('')
  const [chestResult, setChestResult] = useState(null)

  const isHive = session?.mode === 'hive'
  const token = session?.token
  const username = session?.username

  useEffect(() => {
    fetch('/api/shop')
      .then(r => r.json())
      .then(d => { setCatalog(d.items || []); setGameAccount(d.gameAccount || '') })
      .catch(() => { })

    if (isHive && token) {
      fetch('/api/shop/owned', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => { setOwned(new Set(d.owned || [])) })
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
  const sharedCardProps = { isHive, heroData }

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

function ShopItemCard({ item, isOwned, isHive, isClaiming, onBuy, heroData }) {
  const { t } = useT()
  const isFree = item.price_hive === 0
  const bgSize = item.type === 'treasure' ? 'contain' : 'cover'
  const previewStyle = { backgroundImage: `url(${item.preview})`, backgroundSize: bgSize, backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }

  return (
    <div className={`shop-card${isOwned ? ' shop-card-owned' : ''}`}>
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
              ? <div className="shop-card-owned-badge">{t('shop.owned')}</div>
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

function ShopListRow({ item, isOwned, isHive, isClaiming, onBuy, heroData }) {
  const { t } = useT()
  const isFree = item.price_hive === 0

  return (
    <div className={`shop-row${isOwned ? ' shop-row-owned' : ''}`}>
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
          ? <div className="shop-row-state">{t('shop.owned')}</div>
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
          : !isOwned
            ? <button
                className={`shop-row-btn${isFree ? ' free' : ' buy'}`}
                disabled={isClaiming || !isHive}
                onClick={onBuy}
                title={!isHive ? 'Log in with Hive Keychain to obtain cosmetics.' : undefined}
              >
                {isClaiming ? '⌛' : isFree ? t('shop.getFree') : t('shop.buy')}
              </button>
            : null
        }
      </div>
    </div>
  )
}

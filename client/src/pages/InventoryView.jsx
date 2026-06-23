import { useState, useEffect } from 'react'
import '@styles/inventory.css'
import { useT } from '../context/LanguageContext'

const RARITY_COLORS = {
  common: '#c0bdb5', uncommon: '#4caf50', rare: '#42a5f5',
  epic: '#ba68c8', legendary: '#ff2d9b', starter: '#6a6080',
}

const RARITY_ORDER = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4, starter: 5 }

const SLOT_ORDER = ['amulet','helm','special','weapon','chest','offhand','belt','legs','gloves','ring1','boots','ring2']

const SLOT_LABELS = {
  amulet: 'AMULET', helm: 'HELMET', special: 'SPECIAL', weapon: 'WEAPON',
  chest: 'CHEST', offhand: 'OFF-HAND', belt: 'BELT', legs: 'LEGS',
  gloves: 'GLOVES', ring1: 'RING 1', boots: 'BOOTS', ring2: 'RING 2',
}

const SLOT_ICONS = {
  amulet: '📿', helm: '⛑️', special: '✨', weapon: '⚔️',
  chest: '🛡️', offhand: '📜', belt: '🏷️', legs: '👖',
  gloves: '🧤', ring1: '💍', boots: '🥾', ring2: '💍',
}

// Slot placeholder images — shown when slot is empty or has a starter item.
const SLOT_IMAGES = {
  amulet:  '/images/slots/amulet-slot.png',
  helm:    '/images/slots/helm-slot.png',
  chest:   '/images/slots/chest-armor-slot.png',
  special: '/images/slots/special-slot.png',
  belt:    '/images/slots/belt-slot.png',
  legs:    '/images/slots/legs-slot.png',
  gloves:  '/images/slots/gloves-slot.png',
  ring1:   '/images/slots/ring-slot.png',
  ring2:   '/images/slots/ring-slot.png',
  boots:   '/images/slots/boots-slot.png',
}

// Images shown when a non-weapon slot has an item equipped.
const EQUIPPED_IMAGES = {
  special: '/images/slots/special-1.png',
  // helm:    '/images/slots/helm-1.png',
  // chest:   '/images/slots/chest-1.png',
}

// Equipped weapon images — key matches lowercase word in item name
const WEAPON_IMAGES = {
  blade:      '/images/slots/weapon-blade.png',
  axe:        '/images/slots/weapon-axe.png',
  shortsword: '/images/slots/weapon-shortsword.png',
  // sword:   '/images/slots/weapon-sword.png',
  // dagger:  '/images/slots/weapon-dagger.png',
  // bow:     '/images/slots/weapon-bow.png',
  // staff:   '/images/slots/weapon-staff.png',
  // mace:    '/images/slots/weapon-mace.png',
  // spear:   '/images/slots/weapon-spear.png',
}

// Empty / starter slot placeholder per slot type — can vary by hero style
const SLOT_PLACEHOLDERS = {
  weapon: {
    melee:  '/images/slots/weapon-sword-slot.png',
    ranged: '/images/slots/weapon-bow-slot.png',
    magic:  '/images/slots/weapon-staff-slot.png',
  },
  offhand: {
    melee:  '/images/slots/offhand-shield-slot.png',
    ranged: '/images/slots/offhand-quiver-slot.png',
    magic:  '/images/slots/offhand-grimoire-slot.png',
  },
}

// Maps hero CID to weapon style for placeholder selection
const HERO_WEAPON_STYLE = {
  knight:    'melee',
  paladin:   'melee',
  barbarian: 'melee',
  assassin:  'melee',
  archer:    'ranged',
  mage:      'magic',
  archmage:  'magic',
  healer:    'magic',
}

function getSlotIcon(slotKey, itemName, heroCid) {
  const hasItem = !!itemName

  if (slotKey === 'weapon') {
    if (hasItem) {
      const nameLC = itemName.toLowerCase()
      const match  = Object.keys(WEAPON_IMAGES).find(k => nameLC.includes(k))
      if (match) return { type: 'img', src: WEAPON_IMAGES[match] }
    } else {
      const style = HERO_WEAPON_STYLE[heroCid]
      const src   = style && SLOT_PLACEHOLDERS.weapon[style]
      if (src) return { type: 'img', src }
    }
    return { type: 'emoji', value: SLOT_ICONS.weapon }
  }

  if (hasItem) {
    const src = EQUIPPED_IMAGES[slotKey]
    if (src) return { type: 'img', src }
    return { type: 'emoji', value: SLOT_ICONS[slotKey] || '?' }
  }

  if (SLOT_PLACEHOLDERS[slotKey]) {
    const style = HERO_WEAPON_STYLE[heroCid]
    const src   = style && SLOT_PLACEHOLDERS[slotKey][style]
    if (src) return { type: 'img', src }
  }

  const src = SLOT_IMAGES[slotKey]
  if (src) return { type: 'img', src }
  return { type: 'emoji', value: SLOT_ICONS[slotKey] || '?' }
}

function SlotIcon({ slotKey, itemName, heroCid, style }) {
  const icon = getSlotIcon(slotKey, itemName, heroCid)
  if (icon.type === 'img')
    return <img src={icon.src} alt={slotKey} style={{ width: '1.3em', height: '1.3em', objectFit: 'contain', ...style }} />
  return <span style={{ fontSize: '1.3em', ...style }}>{icon.value}</span>
}

function roleCategory(role) {
  if (!role) return 'dps'
  const r = role.toLowerCase()
  if (r === 'tank' || r === 'paladin') return 'tank'
  if (r === 'support') return 'support'
  return 'dps'
}

function GearSlotsPanel({ hero, playerGear, onUnequipItem, unequipPending, setUnequipPending, t }) {
  if (!hero) return null
  const heroGear = playerGear?.[hero.cid] ?? { slots: {}, totals: { atk_bonus: 0, hp_bonus: 0, spd_bonus: 0 } }
  const { atk_bonus, hp_bonus, spd_bonus } = heroGear.totals

  return (
    <div className="inv-slots-panel">
      <div className="inv-panel-title">
        {hero.icon} {hero.name}
      </div>

      {/* 12-slot grid */}
      <div className="inv-slots-grid">
        {SLOT_ORDER.map(slotKey => {
          const item = heroGear.slots[slotKey]
          const isStarter = item?.rarity === 'starter'
          const canUnequip = item && !isStarter && onUnequipItem
          const isPending = unequipPending?.slotKey === slotKey
          const rarityColor = item ? (RARITY_COLORS[item.rarity] || '#888') : null

          return (
            <div
              key={slotKey}
              className={[
                'inv-slot',
                slotKey,
                item ? (isStarter ? 'equipped starter-equipped' : 'equipped') : '',
                isPending ? 'unequip-pending' : '',
              ].filter(Boolean).join(' ')}
              data-label={SLOT_LABELS[slotKey]}
              onClick={canUnequip ? () => setUnequipPending(isPending ? null : { slotKey, item }) : undefined}
            >
              <SlotIcon slotKey={slotKey} itemName={item?.name} heroCid={hero.cid} style={{ opacity: item ? 1 : 0.3 }} />
              {item && (
                <div className="inv-slot-tip">
                  <div className="inv-slot-tip-name">{item.name}</div>
                  {item.atk_bonus !== 0 && <div className={item.atk_bonus > 0 ? 'inv-slot-tip-stat' : 'inv-slot-tip-neg'}>{item.atk_bonus > 0 ? '+' : ''}{item.atk_bonus} ATK</div>}
                  {item.hp_bonus  !== 0 && <div className={item.hp_bonus  > 0 ? 'inv-slot-tip-stat' : 'inv-slot-tip-neg'}>{item.hp_bonus  > 0 ? '+' : ''}{item.hp_bonus} HP</div>}
                  {Number(item.spd_bonus) !== 0 && <div className={Number(item.spd_bonus) > 0 ? 'inv-slot-tip-stat' : 'inv-slot-tip-neg'}>{Number(item.spd_bonus) > 0 ? '+' : ''}{Number(item.spd_bonus).toFixed(2)} SPD</div>}
                  {canUnequip && <div className="inv-slot-tip-hint">Click to remove</div>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Unequip confirm card */}
      {unequipPending && (
        <div className="inv-unequip-confirm">
          <div className="inv-confirm-name" style={{ color: RARITY_COLORS[unequipPending.item.rarity] || '#ccc' }}>
            {unequipPending.item.name}
          </div>
          <div className="inv-confirm-stats">
            {unequipPending.item.atk_bonus !== 0 && <span>{unequipPending.item.atk_bonus > 0 ? '+' : ''}{unequipPending.item.atk_bonus} ATK</span>}
            {unequipPending.item.hp_bonus  !== 0 && <span>{unequipPending.item.hp_bonus  > 0 ? '+' : ''}{unequipPending.item.hp_bonus} HP</span>}
            {Number(unequipPending.item.spd_bonus) !== 0 && <span>{Number(unequipPending.item.spd_bonus) > 0 ? '+' : ''}{Number(unequipPending.item.spd_bonus).toFixed(2)} SPD</span>}
          </div>
          <div className="inv-confirm-actions">
            <button
              type="button"
              className="inv-btn-remove"
              onClick={() => { onUnequipItem(hero.cid, unequipPending.slotKey); setUnequipPending(null) }}
            >
              {t('inv.removeFrom', { name: hero.name })}
            </button>
            <button type="button" className="inv-btn-cancel" onClick={() => setUnequipPending(null)}>✕</button>
          </div>
        </div>
      )}

      {/* Mini-stats */}
      <div className="inv-mini-stats">
        <div className="inv-mini-stat-row">
          <span>❤️ HP</span>
          <span className={`inv-mini-stat-val ${hp_bonus > 0 ? 'pos' : hp_bonus < 0 ? 'neg' : 'zero'}`}>{hp_bonus > 0 ? '+' : ''}{hp_bonus}</span>
        </div>
        <div className="inv-mini-stat-row">
          <span>⚔️ ATK</span>
          <span className={`inv-mini-stat-val ${atk_bonus > 0 ? 'pos' : atk_bonus < 0 ? 'neg' : 'zero'}`}>{atk_bonus > 0 ? '+' : ''}{atk_bonus}</span>
        </div>
        <div className="inv-mini-stat-row">
          <span>⚡ SPD</span>
          <span className={`inv-mini-stat-val ${Number(spd_bonus) > 0 ? 'pos' : Number(spd_bonus) < 0 ? 'neg' : 'zero'}`}>{Number(spd_bonus) > 0 ? '+' : ''}{Number(spd_bonus).toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}

function InventoryItemsPanel({ hero, items, sortBy, setSortBy, equipPending, setEquipPending, onEquipItem, t, onRefresh, refreshing }) {
  const SORT_OPTS = [
    { value: 'rarity',      label: t('inv.sortRarity') },
    { value: 'name',        label: t('inv.sortName') },
    { value: 'total_stats', label: t('inv.sortStats') },
  ]

  return (
    <div className="inv-items-panel">
      <div className="inv-panel-header">
        <div className="inv-panel-title">
          {t('hero.inventory')} ({items.length})
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {onRefresh && (
            <button
              type="button"
              className="inv-sort-select"
              style={{ cursor: 'pointer', padding: '2px 8px', fontSize: '0.8em' }}
              onClick={onRefresh}
              disabled={refreshing}
              title={t('inv.refresh') || 'Refresh inventory'}
            >
              {refreshing ? '⌛' : '↺'}
            </button>
          )}
          <select
            className="inv-sort-select"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
          >
            {SORT_OPTS.map(o => <option key={o.value} value={o.value}>↕ {o.label}</option>)}
          </select>
        </div>
      </div>

      {items.length === 0
        ? <div className="inv-empty">{t('inv.noItems')}</div>
        : (
          <div className="inv-items-grid">
            {items.map(item => {
              const isPending = equipPending?.id === item.id
              const color = RARITY_COLORS[item.rarity] || '#888'
              return (
                <div
                  key={item.id}
                  className={`inv-item-slot${isPending ? ' selected' : ''}`}
                  style={{ border: `1px solid ${color}55` }}
                  title={`${item.name} (${item.slot_type})`}
                  onClick={() => setEquipPending(isPending ? null : item)}
                >
                  <SlotIcon slotKey={item.slot_type} itemName={item.name} />
                  <span className="inv-item-rarity-bar" style={{ background: color }} />
                </div>
              )
            })}
          </div>
        )
      }

      {equipPending && hero && onEquipItem && (
        <div className="inv-equip-bar">
          <div className="inv-equip-bar-info">
            <span className="inv-equip-bar-name" style={{ color: RARITY_COLORS[equipPending.rarity] || '#ccc' }}>
              {equipPending.name}
            </span>
            <span className="inv-equip-bar-stats">
              {equipPending.atk_bonus !== 0 && <span className={equipPending.atk_bonus > 0 ? 'inv-slot-tip-stat' : 'inv-slot-tip-neg'}>{equipPending.atk_bonus > 0 ? '+' : ''}{equipPending.atk_bonus} ATK</span>}
              {equipPending.hp_bonus  !== 0 && <span className={equipPending.hp_bonus  > 0 ? 'inv-slot-tip-stat' : 'inv-slot-tip-neg'}>{equipPending.hp_bonus  > 0 ? '+' : ''}{equipPending.hp_bonus} HP</span>}
              {Number(equipPending.spd_bonus) !== 0 && <span className={Number(equipPending.spd_bonus) > 0 ? 'inv-slot-tip-stat' : 'inv-slot-tip-neg'}>{Number(equipPending.spd_bonus) > 0 ? '+' : ''}{Number(equipPending.spd_bonus).toFixed(2)} SPD</span>}
            </span>
          </div>
          <div className="inv-equip-bar-actions">
            <button
              type="button"
              className="inv-btn-equip"
              onClick={() => { onEquipItem(equipPending.id, hero.cid, equipPending.slot_type); setEquipPending(null) }}
            >
              {t('inv.equipOn', { name: hero.name })}
            </button>
            <button type="button" className="inv-btn-cancel" onClick={() => setEquipPending(null)}>✕</button>
          </div>
        </div>
      )}
    </div>
  )
}

function SkinsTab({ catalog, ownedIds, equippedSkins, heroData, onEquipSkin, onUnequipSkin, t, toast }) {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

  const ownedSkins = catalog.filter(i => i.type === 'skin' && ownedIds.has(i.id))

  const filtered = ownedSkins.filter(item => {
    const hero = heroData?.find(h => h.cid === item.hero_cid)
    const matchSearch = !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.hero_cid || '').toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'all' || roleCategory(hero?.role) === roleFilter
    return matchSearch && matchRole
  })

  if (ownedSkins.length === 0) {
    return <div className="inv-empty" style={{ marginTop: 40 }}>{t('inv.noItems')}</div>
  }

  return (
    <div className="inv-skins-wrap">
      <div className="inv-skin-filter-bar">
        <input
          className="inv-skin-search"
          type="text"
          placeholder={t('inv.searchHero')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {[['all', t('formation.filterAll')], ['tank', '🛡️'], ['dps', '⚔️'], ['support', '💚']].map(([r, label]) => (
          <button
            key={r}
            type="button"
            className={`inv-skin-filter-btn${roleFilter === r ? ' active' : ''}`}
            onClick={() => setRoleFilter(r)}
          >{label}</button>
        ))}
      </div>
      {filtered.length === 0
        ? <div className="inv-empty" style={{ marginTop: 40 }}>{t('inv.noItems')}</div>
        : <div className="inv-skins-grid">
            {filtered.map(item => {
              const isEquipped = equippedSkins?.[item.hero_cid]?.skin_id === item.id
              const hero = heroData?.find(h => h.cid === item.hero_cid)
              const previewStyle = item.preview
                ? { backgroundImage: `url(${item.preview})` }
                : { background: hero?.bg_gradient || '#1a1a2e' }

              return (
                <div key={item.id} className={`inv-skin-card${isEquipped ? ' equipped-card' : ''}`}>
                  <div className="inv-skin-preview" style={previewStyle}>
                    {!item.preview && <span>{hero?.icon || '✨'}</span>}
                  </div>
                  <div className="inv-skin-footer">
                    <div className="inv-skin-name">{item.name}</div>
                    {item.hero_cid && (
                      <div className="inv-skin-hero">
                        {item.hero_cid.charAt(0).toUpperCase() + item.hero_cid.slice(1)}
                      </div>
                    )}
                    <button
                      type="button"
                      className={`inv-skin-btn ${isEquipped ? 'unequip' : 'equip'}`}
                      onClick={() => {
                        if (isEquipped) {
                          toast?.(t('inv.minOneSkin'))
                          return
                        }
                        onEquipSkin?.(item.id)
                      }}
                    >
                      {isEquipped ? t('shop.unequip') : t('shop.equip')}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
      }
    </div>
  )
}

function BackgroundsTab({ catalog, ownedIds, equippedBgs, onEquipBg, onUnequipBg, t, toast }) {
  const [search, setSearch] = useState('')
  const ownedBgs = catalog.filter(i => i.type === 'background' && ownedIds.has(i.id))
  const equippedBgIds = new Set((equippedBgs || []).map(b => b.id))

  const filtered = search
    ? ownedBgs.filter(item => item.name.toLowerCase().includes(search.toLowerCase()))
    : ownedBgs

  if (ownedBgs.length === 0) {
    return <div className="inv-empty" style={{ marginTop: 40 }}>{t('inv.noItems')}</div>
  }

  return (
    <>
      {/* Slot dots */}
      <div className="inv-bg-dots-bar">
        {[0, 1, 2, 3].map(i => (
          <span key={i} className={`inv-bg-dot${i < (equippedBgs?.length ?? 0) ? ' filled' : ''}`} />
        ))}
        <span className="inv-bg-dots-label">
          {t('inv.bgsEquipped', { n: equippedBgs?.length ?? 0 })}
        </span>
      </div>

      {/* Search bar */}
      <div className="inv-bg-search-wrap">
        <input
          className="inv-bg-search"
          type="text"
          placeholder={t('shop.searchBg')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="inv-cosmetics-grid">
        {filtered.map(item => {
          const isEquipped = equippedBgIds.has(item.id)
          const previewStyle = item.preview
            ? { backgroundImage: `url(${item.preview})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { background: '#1a1a2e' }

          return (
            <div key={item.id} className={`inv-cosm-card${isEquipped ? ' equipped-card' : ''}`}>
              <div className="inv-cosm-preview" style={previewStyle} />
              <div className="inv-cosm-body">
                <div className="inv-cosm-name">{item.name}</div>
                <div className="inv-cosm-actions">
                  {isEquipped
                    ? <button
                        type="button"
                        className="inv-cosm-btn unequip"
                        onClick={() => {
                          if ((equippedBgs?.length ?? 0) <= 1) {
                            toast?.(t('inv.minOneBg'))
                            return
                          }
                          onUnequipBg?.(item.id)
                        }}
                      >
                        {t('shop.remove')}
                      </button>
                    : <button
                        type="button"
                        className="inv-cosm-btn equip"
                        onClick={() => {
                          if ((equippedBgs?.length ?? 0) >= 4) {
                            toast?.(t('inv.bgsLimitReached'))
                            return
                          }
                          onEquipBg?.(item.id)
                        }}
                      >
                        {t('shop.equip')}
                      </button>
                  }
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

export default function InventoryView({
  session, heroData, playerGear, playerItems,
  equippedSkins, equippedBgs,
  onEquipItem, onUnequipItem,
  onEquipSkin, onUnequipSkin,
  onEquipBg, onUnequipBg,
  onRefreshItems,
  toast,
}) {
  const { t } = useT()
  const [activeTab, setActiveTab] = useState('backgrounds')
  const [selectedHero, setSelectedHero] = useState(null)
  const [heroSearch, setHeroSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [carouselOffset, setCarouselOffset] = useState(0)
  const [unequipPending, setUnequipPending] = useState(null)
  const [sortBy, setSortBy] = useState('rarity')
  const [equipPending, setEquipPending] = useState(null)

  const [catalog, setCatalog] = useState([])
  const [ownedIds, setOwnedIds] = useState(new Set())
  const [cosmeticsLoading, setCosmeticsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!session?.token) { setCosmeticsLoading(false); return }
    Promise.all([
      fetch('/api/shop').then(r => r.json()),
      fetch('/api/shop/owned', { headers: { Authorization: `Bearer ${session.token}` } }).then(r => r.json()),
    ]).then(([cat, owned]) => {
      setCatalog(cat.items || [])
      setOwnedIds(new Set(owned.owned || []))
    }).catch(() => {}).finally(() => setCosmeticsLoading(false))
  }, [session?.token]) // eslint-disable-line

  const filteredHeroes = (heroData || []).filter(h => {
    const matchRole = roleFilter === 'all' || roleCategory(h.role) === roleFilter
    const matchSearch = !heroSearch || h.name.toLowerCase().includes(heroSearch.toLowerCase())
    return matchRole && matchSearch
  })

  const VISIBLE = 4
  const total = filteredHeroes.length
  const visibleHeroes = total === 0
    ? []
    : Array.from({ length: Math.min(VISIBLE, total) }, (_, i) => filteredHeroes[(carouselOffset + i) % total])

  function moveCarousel(dir) {
    if (total === 0) return
    setCarouselOffset(prev => (prev + dir + total) % total)
  }

  const currentHero = selectedHero ?? filteredHeroes[0] ?? null

  function sortItems(items, by) {
    const copy = [...items]
    if (by === 'rarity') return copy.sort((a, b) => (RARITY_ORDER[a.rarity] ?? 6) - (RARITY_ORDER[b.rarity] ?? 6))
    if (by === 'name')   return copy.sort((a, b) => a.name.localeCompare(b.name))
    if (by === 'total_stats') return copy.sort((a, b) => {
      const score = i => Math.abs(i.atk_bonus || 0) + Math.abs(i.hp_bonus || 0) + Math.abs(Number(i.spd_bonus) || 0) * 10
      return score(b) - score(a)
    })
    return copy
  }

  const unequippedItems = sortItems(
    (playerItems || []).filter(i => !i.equipped_on),
    sortBy,
  )

  const TABS = [
    { key: 'backgrounds', icon: '🌄', label: t('inv.tabBgs') },
    { key: 'skins',       icon: '✨', label: t('inv.tabSkins') },
    { key: 'gear',        icon: '⚔️', label: t('inv.tabGear') },
  ]

  return (
    <div id="view-inventory" className="lv active">
      <div className="inv-layout">
        {/* Sidebar */}
        <aside className="inv-sidebar">
          <div className="inv-sidebar-label">Category</div>
          {TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              className={`inv-tab-btn${activeTab === tab.key ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span className="inv-tab-ico">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </aside>

        {/* Main content */}
        <div className="inv-main">
          {activeTab === 'gear' && (
            <>
              {/* Filter bar */}
              <div className="inv-filter-bar">
                <input
                  className="inv-search"
                  type="text"
                  placeholder={t('inv.searchHero')}
                  value={heroSearch}
                  onChange={e => { setHeroSearch(e.target.value); setCarouselOffset(0) }}
                />
                {[
                  ['all', t('formation.filterAll')],
                  ['tank',    '🛡️'],
                  ['dps',     '⚔️'],
                  ['support', '💚'],
                ].map(([role, label]) => (
                  <button
                    key={role}
                    type="button"
                    className={`inv-role-btn${roleFilter === role ? ' active' : ''}`}
                    onClick={() => { setRoleFilter(role); setCarouselOffset(0) }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Hero carousel */}
              <div className="inv-carousel-wrap">
                <div className="inv-carousel-label">
                  {t('formation.collection')} ({total})
                </div>
                <div className="inv-carousel-row">
                  <button
                    type="button"
                    className="inv-carousel-arrow"
                    disabled={total <= VISIBLE}
                    onClick={() => moveCarousel(-1)}
                  >‹</button>

                  <div className="inv-hero-list">
                    {!heroData && <div className="inv-empty">{t('formation.loading')}</div>}
                    {heroData && total === 0 && <div className="inv-empty">{t('formation.noHeroesFound')}</div>}
                    {visibleHeroes.map(h => {
                      const skinUrl = equippedSkins?.[h.cid]?.preview || h.url_portrait || null
                      const isSelected = currentHero?.cid === h.cid
                      const cat = roleCategory(h.role)
                      return (
                        <div
                          key={h.cid}
                          className={`inv-hero-card${isSelected ? ' selected' : ''}`}
                          onClick={() => setSelectedHero(h)}
                        >
                          <div
                            className="inv-hero-portrait"
                            style={skinUrl ? { backgroundImage: `url('${skinUrl}')` } : undefined}
                          >
                            {!skinUrl && <span className="inv-hero-icon">{h.icon}</span>}
                          </div>
                          <div className="inv-hero-footer">
                            <div className="inv-hero-name">
                              {h.name}{' — '}{cat === 'tank' ? t('role.tank') : cat === 'support' ? t('role.support') : t('role.dps')}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <button
                    type="button"
                    className="inv-carousel-arrow"
                    disabled={total <= VISIBLE}
                    onClick={() => moveCarousel(1)}
                  >›</button>
                </div>
              </div>

              <div className="inv-panels-row">
                <GearSlotsPanel
                  hero={currentHero}
                  playerGear={playerGear}
                  onUnequipItem={onUnequipItem}
                  unequipPending={unequipPending}
                  setUnequipPending={setUnequipPending}
                  t={t}
                />
                <InventoryItemsPanel
                  hero={currentHero}
                  items={unequippedItems}
                  sortBy={sortBy}
                  setSortBy={setSortBy}
                  equipPending={equipPending}
                  setEquipPending={setEquipPending}
                  onEquipItem={onEquipItem}
                  t={t}
                  onRefresh={onRefreshItems ? async () => { setRefreshing(true); await onRefreshItems(); setRefreshing(false) } : undefined}
                  refreshing={refreshing}
                />
              </div>
            </>
          )}
          {activeTab === 'skins' && (
            cosmeticsLoading
              ? <div className="inv-empty">{t('campaign.loading')}</div>
              : <SkinsTab
                  catalog={catalog}
                  ownedIds={ownedIds}
                  equippedSkins={equippedSkins}
                  heroData={heroData}
                  onEquipSkin={onEquipSkin}
                  onUnequipSkin={onUnequipSkin}
                  t={t}
                  toast={toast}
                />
          )}
          {activeTab === 'backgrounds' && (
            cosmeticsLoading
              ? <div className="inv-empty">{t('campaign.loading')}</div>
              : <BackgroundsTab
                  catalog={catalog}
                  ownedIds={ownedIds}
                  equippedBgs={equippedBgs}
                  onEquipBg={onEquipBg}
                  onUnequipBg={onUnequipBg}
                  t={t}
                  toast={toast}
                />
          )}
        </div>
      </div>
    </div>
  )
}

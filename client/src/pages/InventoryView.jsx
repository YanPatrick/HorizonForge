import { useState } from 'react'
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

function roleCategory(role) {
  if (!role) return 'dps'
  const r = role.toLowerCase()
  if (r === 'tank' || r === 'paladin') return 'tank'
  if (r === 'support') return 'support'
  return 'dps'
}

export default function InventoryView({
  session, heroData, playerGear, playerItems,
  equippedSkins, equippedBgs,
  onEquipItem, onUnequipItem,
  onEquipSkin, onUnequipSkin,
  onEquipBg, onUnequipBg,
  toast,
}) {
  const { t } = useT()
  const [activeTab, setActiveTab] = useState('gear')
  const [selectedHero, setSelectedHero] = useState(null)
  const [heroSearch, setHeroSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [carouselOffset, setCarouselOffset] = useState(0)

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

  const TABS = [
    { key: 'gear',        icon: '⚔️', label: t('inv.tabGear') },
    { key: 'skins',       icon: '🎨', label: t('inv.tabSkins') },
    { key: 'backgrounds', icon: '🖼️', label: t('inv.tabBgs') },
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
                          {skinUrl
                            ? <div className="inv-hero-icon" style={{ width: 40, height: 40, borderRadius: 6, backgroundImage: `url('${skinUrl}')`, backgroundSize: 'cover', backgroundPosition: 'center', margin: '0 auto 4px' }} />
                            : <div className="inv-hero-icon">{h.icon}</div>
                          }
                          <div className="inv-hero-name">{h.name}</div>
                          <div className={`inv-hero-role role-${cat}`}>
                            {cat === 'tank' ? t('role.tank') : cat === 'support' ? t('role.support') : t('role.dps')}
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
                {total > VISIBLE && (
                  <div className="inv-carousel-hint">
                    {carouselOffset + 1}–{Math.min(carouselOffset + VISIBLE, total)} / {total}
                  </div>
                )}
              </div>

              {/* Gear panels placeholder — next task */}
              <div className="inv-panels-row">
                <p style={{ color: '#5a5080', fontSize: 11 }}>Slots + inventory panels — next task</p>
              </div>
            </>
          )}
          {activeTab === 'skins' && <p style={{ color: '#5a5080' }}>Skins tab — coming in next task</p>}
          {activeTab === 'backgrounds' && <p style={{ color: '#5a5080' }}>Backgrounds tab — coming in next task</p>}
        </div>
      </div>
    </div>
  )
}

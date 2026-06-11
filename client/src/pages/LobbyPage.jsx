import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import { io } from 'socket.io-client'
import '@styles/lobby.css'
import '@styles/components.css'
import GrimoireView from './GrimoireView'
import ShopView from './ShopView'
import { getSession } from '../lib/session'
import TavernPanel from './TavernPanel'          // IMP tavern
import '@styles/tavern.css'                       // Imp tavern
import GuestConversionModal from '../components/GuestConversionModal'
import TutorialOverlay from '../components/TutorialOverlay'
import CampaignView from './CampaignView'

/* ── helpers ────────────────────────────────────────────── */
function prefKey(name, username) {
  return username ? `hf_${name}_${username}` : `hf_${name}`
}
function loadPref(name, username, fallback) {
  const v = localStorage.getItem(prefKey(name, username))
  return v !== null ? v : String(fallback)
}
function savePref(name, username, val) {
  localStorage.setItem(prefKey(name, username), String(val))
}
function roleCategory(role) {
  if (!role) return 'dps'
  const r = role.toLowerCase()
  if (r === 'tank' || r === 'paladin') return 'tank'
  if (r === 'support') return 'support'
  return 'dps'
}

/* 
   =============================================================================
   INSTRUÇÕES PARA O BACKEND (CLAUDE / LLMS):
   
   1. REGRA DE OURO: Soma de atributos = 72. Máximo = 20 no Lv 1. Piso DEX = 10.
   2. SISTEMA DE ACERTO: d20 + Modificador de DEX.
   3. REGRA DE CONCENTRAÇÃO: Erros consecutivos somam +2 no próximo teste de acerto.
   4. DANO DE RASPÃO (GLANCING BLOW): Erros causam 25% do dano base.
   5. EVASÃO FÍSICA: Baseada em DEX. 
   6. ABSORÇÃO MÁGICA: Baseada em WIS. Magia não erra, mas o dano é mitigado.
   =============================================================================
*/



function fmtSP(v) {
  return v < 1 ? `${Math.floor(v * 100)}%` : `×${(Math.floor(v * 100) / 100).toFixed(2)}`
}

const FMT_OPTS = [{ val: 3, label: 'BO3' }, { val: 5, label: 'BO5' }, { val: 7, label: 'BO7' }]
const BET_OPTS = [{ val: 0, label: 'Free' }, { val: 1, label: '1 HIVE' }, { val: 5, label: '5 HIVE' }, { val: 10, label: '10 HIVE' }]
const MODE_TIPS = {
  ai: {
    title: 'Solo Battle',
    body: 'Fight against an AI opponent. Choose the duel format, build your army through recruitment, and win the required number of battles.',
    theme: 'ai',
    sections: [
      { label: 'Format', rows: [['BO3', 'First to 2 wins'], ['BO5', 'First to 3 wins'], ['BO7', 'First to 4 wins']] },
    ],
  },
  pvp: {
    title: 'PvP Match',
    body: 'Find another player with the same wager and duel format. Paid matches use Hive Keychain to confirm the wager before the match starts.',
    theme: 'pvp',
    sections: [
      { label: 'Format', rows: [['BO3', 'First to 2 wins'], ['BO5', 'First to 3 wins'], ['BO7', 'First to 4 wins']] },
      { label: 'Wager', rows: [['Free', 'No HIVE transfer'], ['Paid', 'Both players send the selected amount']] },
    ],
  },
}

const EMPTY_FORMATIONS = [
  { slot: 1, name: '', hero_ids: [] },
  { slot: 2, name: '', hero_ids: [] },
  { slot: 3, name: '', hero_ids: [] },
]

/* ── HeroDetail modal ───────────────────────────────────── */
function BonusChip({ value }) {
  if (!value) return null
  const positive = value > 0
  return (
    <span style={{
      color: positive ? '#4cff91' : '#ff5c5c',
      fontSize: '0.85em',
      marginLeft: '5px',
      fontWeight: 600,
    }}>
      ({positive ? '+' : ''}{value})
    </span>
  )
}

function StatsPanel({ hero, lv1, playerGear }) {
  const totals  = playerGear?.[hero.cid]?.totals ?? { atk_bonus: 0, hp_bonus: 0, spd_bonus: 0 }
  const baseAtk = lv1?.atk ?? 0
  const baseHp  = lv1?.max_hp ?? 0
  const baseSpd = lv1?.initiative ?? 0
  const spd     = baseSpd + totals.spd_bonus
  const attrs   = hero.attrs || {}
  const evasion = Math.max(0, Math.floor(((attrs.dex ?? 10) - 10) / 2))

  return (
    <div className="stats-panel">
      <div className="stat-row">
        <span>Attack:</span>
        <span className="stat-val">{baseAtk}<BonusChip value={totals.atk_bonus} /></span>
      </div>
      <div className="stat-row">
        <span>HP:</span>
        <span className="stat-val">{baseHp}<BonusChip value={totals.hp_bonus} /></span>
      </div>
      <div className="stat-row">
        <span>Speed:</span>
        <span className="stat-val">
          {baseSpd % 1 === 0 ? baseSpd : baseSpd.toFixed(2)}
          {totals.spd_bonus !== 0 && <BonusChip value={totals.spd_bonus} />}
        </span>
      </div>
      <div className="stat-row"><span>Armor:</span>  <span className="stat-val">0</span></div>
      <div className="stat-row"><span>Evasion:</span><span className="stat-val">{evasion}%</span></div>
    </div>
  )
}

const SLOT_LABELS = {
  amulet: 'AMULET', helm: 'HELM', special: 'SPECIAL', weapon: 'WEAPON',
  chest: 'CHEST', offhand: 'OFF-HAND', belt: 'BELT', legs: 'LEGS',
  gloves: 'GLOVES', ring1: 'RING 1', boots: 'BOOTS', ring2: 'RING 2',
}
const SLOT_ICONS = {
  amulet: '📿', helm: '🪖', special: '✨', weapon: '⚔️',
  chest: '🛡️', offhand: '📜', belt: '🏷️', legs: '👖',
  gloves: '🧤', ring1: '💍', boots: '🥾', ring2: '💍',
}
const RARITY_COLORS = {
  common: '#c0bdb5', uncommon: '#4caf50', rare: '#42a5f5',
  epic: '#ba68c8', legendary: '#ff2d9b', starter: '#6a6080',
}
const SLOT_ORDER = ['amulet','helm','special','weapon','chest','offhand','belt','legs','gloves','ring1','boots','ring2']

function HeroDetail({ hero, onClose, playerGear = null, playerItems = [], onEquipItem = null, onUnequipItem = null }) {
  const [expanded, setExpanded] = useState(false)
  const [rpgExpanded, setRpgExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState('stats')
  const [equipPending, setEquipPending] = useState(null)
  const [slotUnequipPending, setSlotUnequipPending] = useState(null)
  if (!hero) return null

  const cat = roleCategory(hero.role)
  const label = cat === 'tank' ? 'Tank' : cat === 'support' ? 'Support' : 'DPS'
  const lv1 = hero.levels?.[1] || {}
  const levelKeys = Object.keys(hero.levels || {}).map(Number).sort((a, b) => a - b)
  const attrs = hero.attrs || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
  const heroGear = playerGear?.[hero.cid] ?? { slots: {}, totals: { atk_bonus: 0, hp_bonus: 0, spd_bonus: 0 } }

  return (
    <>
      <div className="hf-detail-backdrop hf-open" onClick={onClose} />
      <div className="hf-hero-drawer hf-open" role="dialog" aria-modal="true">

        <div className="hf-detail-close-row">
          <div className="hf-detail-hero-header">
            <span className="hf-detail-ico">{hero.icon}</span>
            <span className="hf-detail-hero-name">{hero.name}</span>
          </div>
          <button type="button" className="hf-detail-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="hf-detail-tabs">
          <button className={`hf-tab-item ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>INFO</button>
          <button className={`hf-tab-item ${activeTab === 'gear'  ? 'active' : ''}`} onClick={() => setActiveTab('gear')}>GEAR</button>
        </div>

        <div className="detail-slider-viewport">
          <div className={`detail-slider-track view-${activeTab}`}>

            {/* ── INFO PANEL ── */}
            <div className="detail-slide stats-pane hf-detail-scroll">
              <div className="hf-detail-role-wrap">
                <span className={`gr-hero-role role-${cat}`}>{label}</span>
              </div>
              <div className="hf-detail-section-label">Skill</div>
              <div className="hf-detail-skill-name">✦ {hero.skill?.name ?? '—'}</div>
              <div className="hf-detail-skill-desc">{hero.skill?.description ?? ''}</div>
              {hero.skill?.lore && (
                <div className="hf-detail-skill-lore" style={{
                  fontStyle: 'italic', opacity: 0.55, fontSize: '0.88em',
                  marginTop: '15px', marginBottom: '20px', color: '#fff',
                  lineHeight: '1.6', paddingTop: '12px',
                  borderTop: '1px solid rgba(255,255,255,0.12)',
                  textAlign: 'center', width: '100%', display: 'block'
                }}>
                  "{hero.skill.lore}"
                </div>
              )}

              <div className="hf-detail-section-label">Base Stats (Lv 1)</div>
              <div className="hf-detail-stats">
                <div className="hf-detail-stat"><span className="hf-stat-label">❤️ HP</span><span className="hf-stat-value">{lv1.max_hp ?? '—'}{heroGear.totals.hp_bonus  !== 0 && <BonusChip value={heroGear.totals.hp_bonus} />}</span></div>
                <div className="hf-detail-stat"><span className="hf-stat-label">⚔️ ATK</span><span className="hf-stat-value">{lv1.atk ?? '—'}{heroGear.totals.atk_bonus !== 0 && <BonusChip value={heroGear.totals.atk_bonus} />}</span></div>
                <div className="hf-detail-stat"><span className="hf-stat-label">⚡ SPD</span><span className="hf-stat-value">{lv1.initiative != null ? (lv1.initiative % 1 === 0 ? lv1.initiative : lv1.initiative.toFixed(2)) : '—'}{heroGear.totals.spd_bonus !== 0 && <BonusChip value={heroGear.totals.spd_bonus} />}</span></div>
                <div className="hf-detail-stat"><span className="hf-stat-label">✨ SP</span><span className="hf-stat-value">{lv1.skill_power != null ? fmtSP(lv1.skill_power) : '—'}</span></div>
              </div>

              <button type="button" className="hf-detail-l2-btn" style={{ marginTop: '15px' }} onClick={() => setExpanded(!expanded)}>
                <span className="hf-l2-label">{expanded ? 'Collapse' : 'View full stats'}</span>
                <span className={`hf-l2-chevron${expanded ? ' expanded' : ''}`}>▾</span>
              </button>
              {expanded && (
                <div className="hf-detail-l2 expanded">
                  <table className="hf-detail-l2-table">
                    <thead><tr><th>Level</th><th>HP</th><th>ATK</th><th>SP</th></tr></thead>
                    <tbody>
                      {levelKeys.map(lv => {
                        const s = hero.levels[lv] || {}
                        return <tr key={lv}><td>{lv}</td><td>{s.max_hp}</td><td>{s.atk}</td><td>{s.skill_power != null ? fmtSP(s.skill_power) : '—'}</td></tr>
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <button type="button" className="hf-detail-l2-btn rpg-btn-style" onClick={() => setRpgExpanded(!rpgExpanded)}>
                <span className="hf-l2-label">{rpgExpanded ? 'Hide RPG Sheet' : 'View RPG Sheet'}</span>
                <span className={`hf-l2-chevron${rpgExpanded ? ' expanded' : ''}`}>▾</span>
              </button>
              {rpgExpanded && (
                <div className="rpg-sheet-container animate-fade-in">
                  <div className="rpg-grid">
                    {['str','dex','con','int','wis','cha'].map(key => (
                      <div key={key} className="rpg-stat-box">
                        <span className="rpg-stat-name">{key.toUpperCase()}</span>
                        <span className="rpg-stat-value">{Math.round(attrs[key] ?? 0)}</span>
                      </div>
                    ))}
                  </div>
                  <p className="rpg-note">Attributes used for item requirements and penalties.</p>
                </div>
              )}
            </div>

            {/* ── GEAR PANEL ── */}
            <div className="detail-slide gear-pane hf-detail-scroll">
              <div className="gear-container">
                {SLOT_ORDER.map((slotKey) => {
                  const item = heroGear.slots[slotKey]
                  const isStarter = item?.rarity === 'starter'
                  const isUnequipPending = slotUnequipPending?.slotKey === slotKey
                  const canUnequip = item && !isStarter && onUnequipItem
                  const rarityClass = item
                    ? (isStarter ? 'gear-slot--starter' : 'gear-slot--equipped')
                    : ''
                  return (
                    <div
                      key={slotKey}
                      className={`gear-slot ${slotKey} ${rarityClass}${isUnequipPending ? ' gear-slot--unequip-pending' : ''}`}
                      data-label={SLOT_LABELS[slotKey]}
                      style={canUnequip ? { cursor: 'pointer' } : undefined}
                      onClick={canUnequip ? () => setSlotUnequipPending(isUnequipPending ? null : { slotKey, item }) : undefined}
                    >
                      <span style={{ fontSize: '1.4em', opacity: item ? 1 : 0.3 }}>
                        {SLOT_ICONS[slotKey]}
                      </span>
                      {item && (
                        <div className="gear-slot-tip">
                          <div className="gst-name">{item.name}</div>
                          {item.atk_bonus !== 0 && (
                            <div className={`gst-stat ${item.atk_bonus > 0 ? 'gst-pos' : 'gst-neg'}`}>
                              {item.atk_bonus > 0 ? '+' : ''}{item.atk_bonus} ATK
                            </div>
                          )}
                          {item.hp_bonus !== 0 && (
                            <div className={`gst-stat ${item.hp_bonus > 0 ? 'gst-pos' : 'gst-neg'}`}>
                              {item.hp_bonus > 0 ? '+' : ''}{item.hp_bonus} HP
                            </div>
                          )}
                          {Number(item.spd_bonus) !== 0 && (
                            <div className={`gst-stat ${Number(item.spd_bonus) > 0 ? 'gst-pos' : 'gst-neg'}`}>
                              {Number(item.spd_bonus) > 0 ? '+' : ''}{Number(item.spd_bonus).toFixed(2)} SPD
                            </div>
                          )}
                          {canUnequip && <div className="gst-hint">Clique para remover</div>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {slotUnequipPending && (
                <div className="inv-equip-confirm" style={{ marginBottom: '10px' }}>
                  <div className="inv-equip-confirm-name"
                    style={{ color: RARITY_COLORS[slotUnequipPending.item.rarity] || '#ccc' }}
                  >{slotUnequipPending.item.name}</div>
                  <div className="inv-equip-confirm-stats">
                    {slotUnequipPending.item.atk_bonus !== 0 && <span>{slotUnequipPending.item.atk_bonus > 0 ? '+' : ''}{slotUnequipPending.item.atk_bonus} ATK</span>}
                    {slotUnequipPending.item.hp_bonus  !== 0 && <span>{slotUnequipPending.item.hp_bonus  > 0 ? '+' : ''}{slotUnequipPending.item.hp_bonus} HP</span>}
                    {slotUnequipPending.item.spd_bonus !== 0 && <span>{slotUnequipPending.item.spd_bonus > 0 ? '+' : ''}{Number(slotUnequipPending.item.spd_bonus).toFixed(2)} SPD</span>}
                  </div>
                  <div className="inv-equip-confirm-actions">
                    <button
                      type="button"
                      className="inv-equip-btn-remove"
                      onClick={() => { onUnequipItem(hero.cid, slotUnequipPending.slotKey); setSlotUnequipPending(null) }}
                    >↩ Remover de {hero.name}</button>
                    <button type="button" className="inv-equip-btn-cancel" onClick={() => setSlotUnequipPending(null)}>✕</button>
                  </div>
                </div>
              )}

              {/* Stats with equipment */}
              <StatsPanel hero={hero} lv1={lv1} playerGear={playerGear} />

              <div className="inventory-preview">
                <p style={{ fontSize: '10px', opacity: 0.5, marginBottom: '10px' }}>INVENTORY</p>
                {(() => {
                  const unequipped = playerItems.filter(item => !item.equipped_on)
                  if (unequipped.length === 0) return (
                    <p style={{ fontSize: '11px', opacity: 0.35, fontStyle: 'italic', textAlign: 'center', margin: '4px 0 8px' }}>
                      {playerItems.length === 0 ? 'Sem itens ainda' : 'Todos os itens estão equipados'}
                    </p>
                  )
                  return (
                    <div className="inv-grid">
                      {unequipped.map(item => {
                        const isPending = equipPending?.id === item.id
                        return (
                          <div
                            key={item.id}
                            className={['inv-slot inv-slot--item', isPending ? 'inv-slot--pending' : ''].filter(Boolean).join(' ')}
                            title={`${item.name} (${item.slot_type})`}
                            onClick={() => onEquipItem && setEquipPending(isPending ? null : item)}
                          >
                            <span className="inv-item-slot-ico">{SLOT_ICONS[item.slot_type] || '📦'}</span>
                            <span className="inv-item-rarity-bar" style={{ background: RARITY_COLORS[item.rarity] || '#888' }} />
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
                {equipPending && onEquipItem && (
                  <div className="inv-equip-confirm">
                    <div className="inv-equip-confirm-name"
                      style={{ color: RARITY_COLORS[equipPending.rarity] || '#ccc' }}
                    >{equipPending.name}</div>
                    <div className="inv-equip-confirm-stats">
                      {equipPending.atk_bonus !== 0 && <span>{equipPending.atk_bonus > 0 ? '+' : ''}{equipPending.atk_bonus} ATK</span>}
                      {equipPending.hp_bonus  !== 0 && <span>{equipPending.hp_bonus  > 0 ? '+' : ''}{equipPending.hp_bonus} HP</span>}
                      {equipPending.spd_bonus !== 0 && <span>{equipPending.spd_bonus > 0 ? '+' : ''}{Number(equipPending.spd_bonus).toFixed(2)} SPD</span>}
                    </div>
                    <div className="inv-equip-confirm-actions">
                      <button
                        type="button"
                        className="inv-equip-btn-confirm"
                        onClick={() => { onEquipItem(equipPending.id, hero.cid, equipPending.slot_type); setEquipPending(null) }}
                      >✓ Equipar em {hero.name}</button>
                      <button type="button" className="inv-equip-btn-cancel" onClick={() => setEquipPending(null)}>✕</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}

/* ── MobileHeroPage — slide-in detail for mobile ───────── */
function MobileHeroPage({ hero, onClose, equippedSkins = {} }) {
  const [expanded, setExpanded] = useState(false)
  useEffect(() => { setExpanded(false) }, [hero])

  const cat = hero ? roleCategory(hero.role) : ''
  const label = cat === 'tank' ? 'Tank' : cat === 'support' ? 'Support' : 'DPS'
  const lv1 = hero?.levels?.[1] || {}
  const levelKeys = Object.keys(hero?.levels || {}).map(Number).sort((a, b) => a - b)

  return createPortal(
    <div className={`hf-mobile-hero-page${hero ? ' active' : ''}`}>
      <div className="hf-mhp-header">
        <button type="button" className="hf-mhp-back-btn" onClick={onClose}>← Back</button>
        <span className="hf-mhp-title">{hero?.name ?? ''}</span>
      </div>
      {hero && (
        <div className="hf-mhp-body">
          <div
            className="hf-mhp-portrait"
            style={(equippedSkins[hero.cid]?.preview || hero.url_portrait) ? { '--portrait-url': `url('${equippedSkins[hero.cid]?.preview || hero.url_portrait}')` } : {}}
          >
            {!(equippedSkins[hero.cid]?.preview || hero.url_portrait) && <div className="hf-mhp-ico">{hero.icon}</div>}
          </div>
          <div className="hf-mhp-content">
            <div className="hf-detail-role-wrap">
              <span className={`gr-hero-role role-${cat}`}>{label}</span>
            </div>
            <div className="hf-detail-section-label">Skill</div>
            <div className="hf-detail-skill-name">✦ {hero.skill?.name ?? '—'}</div>
            <div className="hf-detail-skill-desc">{hero.skill?.description ?? ''}</div>
            <div className="hf-detail-section-label">Base Stats (Lv 1)</div>
            <div className="hf-detail-stats">
              <div className="hf-detail-stat"><span className="hf-stat-label">❤️ HP</span><span className="hf-stat-value">{lv1.max_hp ?? '—'}</span></div>
              <div className="hf-detail-stat"><span className="hf-stat-label">⚔️ ATK</span><span className="hf-stat-value">{lv1.atk ?? '—'}</span></div>
              <div className="hf-detail-stat"><span className="hf-stat-label">⚡ SPD</span><span className="hf-stat-value">{lv1.atk_speed != null ? lv1.atk_speed.toFixed(1) : '—'}</span></div>
              <div className="hf-detail-stat"><span className="hf-stat-label">✨ SP</span><span className="hf-stat-value">{lv1.skill_power != null ? fmtSP(lv1.skill_power) : '—'}</span></div>
            </div>
            <button type="button" className="hf-detail-l2-btn" onClick={() => setExpanded(x => !x)}>
              <span className="hf-l2-label">{expanded ? 'Collapse' : 'View full stats'}</span>
              <span className={`hf-l2-chevron${expanded ? ' expanded' : ''}`}>▾</span>
            </button>
            {expanded && (
              <div className="hf-detail-l2 expanded">
                <table className="hf-detail-l2-table">
                  <thead><tr><th>Level</th><th>HP</th><th>ATK</th><th>Skill Power</th></tr></thead>
                  <tbody>
                    {levelKeys.map(lv => {
                      const s = hero.levels[lv] || {}
                      return <tr key={lv}><td>{lv}</td><td>{s.max_hp}</td><td>{s.atk}</td><td>{s.skill_power != null ? fmtSP(s.skill_power) : '—'}</td></tr>
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}

/* ── FormationView ──────────────────────────────────────── */
function FormationView({ session, formations, setFormations, defaultSlot, setDefaultSlot, heroData, toast, equippedSkins = {}, playerGear = null, playerItems = [], onEquipItem = null, onUnequipItem = null }) {
  const [editingSlot, setEditingSlot] = useState(null)
  const [roleFilter, setRoleFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [slideNameVal, setSlideNameVal] = useState('')
  const [detailHero, setDetailHero] = useState(null)

  const isGuest = session?.mode === 'guest'
  const activeForm = editingSlot !== null ? formations[editingSlot] : null
  const skinUrl = (h) => (h && equippedSkins[h.cid]?.preview) || h?.url_portrait || null
  const isFull = activeForm?.hero_ids.length >= 8

  function openSlot(idx) {
    setEditingSlot(idx)
    setSlideNameVal(formations[idx].name || `format${idx + 1}`)
    setDetailHero(null)
  }
  function closeSlot() { setEditingSlot(null) }

  function toggleHero(cid) {
    if (editingSlot === null) return
    setFormations(prev => {
      const next = prev.map((f, i) => {
        if (i !== editingSlot) return f
        const ids = f.hero_ids.includes(cid)
          ? f.hero_ids.filter(x => x !== cid)
          : f.hero_ids.length < 8 ? [...f.hero_ids, cid] : f.hero_ids
        return { ...f, hero_ids: ids }
      })
      return next
    })
  }

  function removeFromSlot(cid) {
    setFormations(prev => prev.map((f, i) => i === editingSlot ? { ...f, hero_ids: f.hero_ids.filter(x => x !== cid) } : f))
  }

  function setDefaultAndToast(idx) {
    setDefaultSlot(idx)
    savePref('default_form_slot', session?.username, idx)
    const name = formations[idx].name || `format${idx + 1}`
    toast(`✅ "${name}" is now your active deck!`)
  }

  async function saveDeck() {
    if (editingSlot === null) return
    const f = formations[editingSlot]
    if (f.hero_ids.length < 8) { toast('⚠️ Select 8 heroes to save the deck.'); return }
    if (isGuest) {
      localStorage.setItem('hf_guest_formation', JSON.stringify({ slot: 1, hero_ids: f.hero_ids, name: f.name }))
      toast('✅ Formation saved!')
      closeSlot()
      return
    }
    try {
      const res = await fetch('/api/formations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.token}` },
        body: JSON.stringify({ player: session.username, slot: editingSlot + 1, name: f.name || `format${editingSlot + 1}`, hero_ids: f.hero_ids }),
      })
      const d = await res.json()
      if (d.ok) { toast('✅ Formation saved!'); closeSlot() }
      else toast('❌ Error saving formation.')
    } catch { toast('❌ Network error.') }
  }

  const filtered = (heroData || []).filter(h => {
    const matchRole = roleFilter === 'all' || roleCategory(h.role) === roleFilter
    const matchSearch = !search || h.name.toLowerCase().includes(search.toLowerCase())
    return matchRole && matchSearch
  })

  return (
    <div id="view-formation" className="lv active">
      {detailHero && <HeroDetail hero={detailHero} onClose={() => setDetailHero(null)} playerGear={playerGear} playerItems={playerItems} onEquipItem={onEquipItem} onUnequipItem={onUnequipItem} />}
      <MobileHeroPage hero={detailHero} onClose={() => setDetailHero(null)} equippedSkins={equippedSkins} />
      <div className="fv-wrap">
        <div className="fv-hero-frame">
          <div className="fv-filter-bar">
            <input className="fv-search" type="text" placeholder="🔍 Search hero…" value={search} onChange={e => setSearch(e.target.value)} />
            {[['all', 'All'], ['tank', '🛡️'], ['dps', '⚔️'], ['support', '💚']].map(([r, label]) => (
              <button key={r} className={`fv-role-btn${roleFilter === r ? ' active' : ''}`} onClick={() => setRoleFilter(r)}>{label}</button>
            ))}
          </div>
          <div className="fv-hero-scroll">
            <div id="form-hero-grid" className={editingSlot !== null ? 'fhc-editing-mode' : ''}>
              {!heroData && <div id="form-heroes-loading">⏳ Loading heroes…</div>}
              {filtered.map(h => {
                const isSelected = activeForm?.hero_ids.includes(h.cid)
                const isAddable = editingSlot !== null && !isSelected && !isFull
                const isDisabled = editingSlot !== null && !isSelected && isFull
                return (
                  <div key={h.cid}
                    className={`form-hero-card${isSelected ? ' fhc-selected' : ''}${isAddable ? ' fhc-addable' : ''}${isDisabled ? ' fhc-disabled' : ''}`}
                    onClick={() => { if (editingSlot !== null && !isDisabled) toggleHero(h.cid); else if (editingSlot === null) setDetailHero(h) }}
                  >
                    <button className="fhc-info-btn" aria-label="Hero info" onClick={e => { e.stopPropagation(); setDetailHero(h) }}>i</button>
                    <div className={`form-hc-portrait${skinUrl(h) ? ' has-portrait' : ''}`} style={skinUrl(h) ? { '--portrait-url': `url('${skinUrl(h)}')` } : {}}>
                      {!skinUrl(h) && <div className="form-hc-ico">{h.icon}</div>}
                    </div>
                    <div className="form-hc-name">{h.name}</div>
                  </div>
                )
              })}
              {heroData && filtered.length === 0 && <div className="hh-empty">No heroes found</div>}
            </div>
          </div>
        </div>

        <div className="fv-decks-area">
          <div className="fv-decks-frame">
            {formations.map((f, i) => {
              if (isGuest && i !== 0) return (
                <div key={i} className="fv-deck-card fdc-locked" onClick={() => setConvCtx('formation')}>
                  <span className="fdc-locked-icon">🔒</span>
                  <div className="fv-tab-name" style={{ opacity: 0.5 }}>Formation {i + 1}</div>
                </div>
              )
              const isDefault = i === defaultSlot
              return (
                <div key={i} className={`fv-deck-card${editingSlot === i ? ' fdc-active' : ''}`} onClick={() => openSlot(i)}>
                  <span className={`fv-tab-star${isDefault ? ' starred' : ''}`} onClick={e => { e.stopPropagation(); setDefaultAndToast(i) }}>{isDefault ? '★' : '☆'}</span>
                  <div className="fv-tab-icons">
                    <div className={`fv-deck-stack${f.hero_ids.length === 8 ? ' full' : ''}`}>
                      <div className="fds-card c3"></div><div className="fds-card c2"></div><div className="fds-card c1"></div>
                    </div>
                  </div>
                  <div className="fv-tab-name">{f.name || `format${i + 1}`}</div>
                  <div className="fv-tab-count">{f.hero_ids.length}/8</div>
                </div>
              )
            })}
          </div>

          {editingSlot !== null && (
            <div className="fv-slide-panel open">
              <div className="fv-slide-header">
                <input className="fv-slide-name" type="text" maxLength={10} value={slideNameVal}
                  onChange={e => {
                    setSlideNameVal(e.target.value)
                    setFormations(prev => prev.map((f, i) => i === editingSlot ? { ...f, name: e.target.value } : f))
                  }}
                />
                <button className="fv-done-btn" onClick={saveDeck}>DONE</button>
              </div>
              <div className="fv-slide-label">Heroes selected: <span>{formations[editingSlot].hero_ids.length}</span>/8</div>
              <div className="fv-slide-slots">
                {Array.from({ length: 8 }, (_, i) => {
                  const cid = formations[editingSlot].hero_ids[i]
                  const hero = heroData?.find(h => h.cid === cid)
                  return (
                    <div key={i} className={`fv-slot-cell${cid ? ' filled' : ''}${skinUrl(hero) ? ' has-portrait' : ''}`}
                      style={skinUrl(hero) ? { '--portrait-url': `url('${skinUrl(hero)}')` } : {}}
                      title={cid ? `${hero?.name || cid} — click to remove` : ''}
                      onClick={() => cid && removeFromSlot(cid)}
                    >
                      {cid && !skinUrl(hero) && (hero?.icon || '?')}
                      {!cid && <span className="fv-slot-empty-hint">+</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── SettingsView ───────────────────────────────────────── */
function SettingsView({ session, payoutPct }) {
  const username = session?.username
  const payoutKey = username ? `hf_payout_${username}` : 'hf_payout'
  const showOwnedKey = username ? `hf_shop_show_owned_${username}` : 'hf_shop_show_owned'

  const [stakeMode, setStakeMode] = useState(() => (localStorage.getItem(payoutKey) || 'liquid') === 'stake')
  const [showOwnedDefault, setShowOwnedDefault] = useState(() => {
    const v = localStorage.getItem(showOwnedKey)
    return v !== null ? v === 'true' : true
  })
  const [saved, setSaved] = useState(false)

  function flash() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function togglePayout(e) {
    localStorage.setItem(payoutKey, e.target.checked ? 'stake' : 'liquid')
    setStakeMode(e.target.checked)
    flash()
  }

  function toggleShowOwned(e) {
    localStorage.setItem(showOwnedKey, String(e.target.checked))
    setShowOwnedDefault(e.target.checked)
    flash()
  }

  const liquidPct = payoutPct.liquid != null ? `${payoutPct.liquid}%` : '...'
  const stakePct = payoutPct.stake != null ? `${payoutPct.stake}%` : '...'

  return (
    <div id="view-settings" className="lv active">
      <div className="sv-wrap">
        <div className="sv-page-title">Settings</div>
        <div className="stg-content" style={{ padding: 0, overflow: 'visible' }}>
          <div className="stg-section">
            <div className="stg-section-title">Payout Preference</div>
            <div className="stg-toggle-row">
              <div className="stg-toggle-info">
                <span className="stg-toggle-title">Receive payouts in Hive Power (stake)</span>
                <span className="stg-toggle-sub">Liquid: {liquidPct} · Stake: {stakePct} payout</span>
              </div>
              <label className="stg-toggle-switch">
                <input type="checkbox" checked={stakeMode} onChange={togglePayout} />
                <span className="stg-toggle-slider" />
              </label>
            </div>
            <div className="stg-note">The remaining % goes to the game treasury.</div>
          </div>
          <div className="stg-section">
            <div className="stg-section-title">Shop</div>
            <div className="stg-toggle-row">
              <div className="stg-toggle-info">
                <span className="stg-toggle-title">Show owned items by default</span>
                <span className="stg-toggle-sub">Owned items are visible when you open the shop</span>
              </div>
              <label className="stg-toggle-switch">
                <input type="checkbox" checked={showOwnedDefault} onChange={toggleShowOwned} />
                <span className="stg-toggle-slider" />
              </label>
            </div>
          </div>
          <div className="stg-section">
            <div className="stg-section-title">About</div>
            <div className="stg-about">
              <div className="stg-about-row"><span>Horizon Forge</span><span className="stg-version">v{__APP_VERSION__}</span></div>
              <div className="stg-about-row"><span>Developer</span><a href="https://peakd.com/@shiftrox/posts" target="_blank" rel="noreferrer">@shiftrox</a></div>
              <div className="stg-about-row"><span>Discord</span><a href="https://discord.gg/w6QFKapJ3Q" target="_blank" rel="noreferrer">Join Server</a></div>
            </div>
          </div>
          <div className="stg-save-row">
            <span className={`stg-saved-badge${saved ? ' show' : ''}`}>✓ Saved</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── SearchOverlay ──────────────────────────────────────── */
function SearchOverlay({ search, onCancel, onSendWager, onRetry }) {
  const { open, found, paying, title, timer, sub, configTag, queueText,
    payStatus, payError, showRetry, showSendWager, payCountdown, paySteps } = search

  if (!open) return null
  return (
    <div className={`search-overlay open${found ? ' found' : ''}${paying ? ' paying' : ''}`}>
      <div className="search-panel">
        <div className="search-col-visual">
          <div className="arcane-rings">
            <div className="arc-ring a1"></div><div className="arc-ring a2"></div><div className="arc-ring a3"></div>
            <div className="arc-center">⚔️</div>
          </div>
          <div className="search-timer">{timer}</div>
        </div>
        <div className="search-col-info">
          <h2 className="search-title" dangerouslySetInnerHTML={{ __html: title }} />
          <p className="search-sub">{sub}</p>
          <span className="search-config-tag">{configTag}</span>
          <div className="search-queue">{queueText}</div>
          <div className="search-dots"><span /><span /><span /></div>
          {payCountdown && <div id="pay-countdown" style={{ display: 'block' }} className={payCountdown.urgent ? 'urgent' : ''}>{payCountdown.text}</div>}
          {showSendWager && <button id="btn-send-wager" onClick={onSendWager}>💸 Send Wager via Keychain</button>}
          {paying && (
            <div id="pay-steps" style={{ display: 'flex' }}>
              {[['pay-step-send', '💸', 'Wager'], ['pay-step-verify', '🔍', 'Verifying'], ['pay-step-opponent', '⏳', 'Opponent']].map(([id, ico, label]) => (
                <div key={id} className={`pay-step${paySteps?.[id] ? ' ' + paySteps[id] : ''}`}>
                  <span className="pay-step-icon">{paySteps?.[id] === 'done' ? '✅' : paySteps?.[id] === 'error' ? '❌' : ico}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          )}
          {payError && <div id="pay-error" style={{ display: 'block' }}>{payError}</div>}
          {showRetry && <button id="btn-retry-pay" onClick={onRetry}>↩ Retry Keychain</button>}
          <button className="btn-cancel" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

/* ── Main LobbyPage ─────────────────────────────────────── */
const SEARCH_PHRASES = ['FINDING OPPONENT', 'SCANNING ARENA', 'SEEKING CHALLENGER', 'ENTERING QUEUE', 'AWAITING DUEL']

export default function LobbyPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const session = getSession()
  const username = session?.username
  const isGuest = session?.mode === 'guest'

  const [view, setView] = useState(() => {
    const params = new URLSearchParams(location.search)
    const tab = params.get('tab')
    const allowed = ['home', 'campaign', 'shop', 'formation', 'grimoire', 'settings']
    return allowed.includes(tab) ? tab : 'home'
  })
  const [balance, setBalance] = useState(null)
  const [avatarError, setAvatarError] = useState(false)
  const [aiFormat, setAiFormat] = useState(() => Number(loadPref('ai_fmt', username, 5)))
  const [pvpBet, setPvpBet] = useState(() => Number(loadPref('pvp_bet', username, 0)))
  const [pvpFmt, setPvpFmt] = useState(() => Number(loadPref('pvp_fmt', username, 5)))
  const [heroData, setHeroData] = useState(null)
  const [equippedSkins, setEquippedSkins] = useState({})
  const [playerGear, setPlayerGear] = useState(null)
  const [playerItems, setPlayerItems] = useState([])
  const [formations, setFormations] = useState(EMPTY_FORMATIONS)
  const [formationsLoaded, setFormationsLoaded] = useState(false)
  const [defaultSlot, setDefaultSlot] = useState(() => Number(loadPref('default_form_slot', username, 0)))
  const [payoutPct, setPayoutPct] = useState({})
  const [toast, setToastMsg] = useState('')
  const [search, setSearch] = useState({ open: false })
  const [aiFmtOpen, setAiFmtOpen] = useState(false)
  const [pvpBetOpen, setPvpBetOpen] = useState(false)
  const [pvpFmtOpen, setPvpFmtOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeInfoTip, setActiveInfoTip] = useState(null)
  const [tavernUsers, setTavernUsers] = useState([])         // + IMP tavern
  const [chatMessages, setChatMessages] = useState([])
  const [chatUnread, setChatUnread] = useState(false)
  const [tavernOpen, setTavernOpen] = useState(false)
  const [convCtx, setConvCtx] = useState(null)
  const [showTutorial, setShowTutorial] = useState(false)
  const [freeRoom, setFreeRoom] = useState(null)
  const [joinCode, setJoinCode] = useState('')
  const [freeMatchErr, setFreeMatchErr] = useState('')

  const socketRef = useRef(null)
  const searchTimerRef = useRef(null)
  const phraseTimerRef = useRef(null)
  const matchDataRef = useRef(null)
  const payCountdownRef = useRef(null)
  const preTimerRef = useRef(null)
  const preTimeoutRef = useRef(null)
  const toastTimerRef = useRef(null)
  const userMenuRef = useRef(null)
  const isManualAfkRef = useRef(false)
  const afkTimerRef = useRef(null)
  const isChatTabOpenRef = useRef(false)

  const myStatus = tavernUsers.find(u => u.username === username)?.status ?? 'tavern'

  function handleSetAvailable() {
    isManualAfkRef.current = false
    socketRef.current?.emit('set_status', { status: 'tavern' })
  }

  function handleSetAbsent() {
    isManualAfkRef.current = true
    socketRef.current?.emit('set_status', { status: 'afk' })
  }

  function handleSendMessage(text) {
    socketRef.current?.emit('chat_message', { text })
  }

  function handleChatOpen() {
    isChatTabOpenRef.current = true
    setChatUnread(false)
  }

  function handleChatClose() {
    isChatTabOpenRef.current = false
  }

  /* ── user menu close-on-outside-click ───────────────────────── */
  useEffect(() => {
    if (!menuOpen) return
    function handleOutside(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [menuOpen])

  /* ── toast ───────────────────────────────────────────── */
  const showToast = useCallback((msg) => {
    setToastMsg(msg)
    clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToastMsg(''), 2800)
  }, [])

  function getInfoTipPosition(anchor) {
    const rect = anchor.getBoundingClientRect()
    const width = Math.min(260, window.innerWidth - 32)
    const left = Math.max(16, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 16))
    const below = rect.bottom + 10
    const top = below + 230 > window.innerHeight ? Math.max(12, rect.top - 230) : below
    return { left, top, width }
  }

  function showInfoTip(id, anchor) {
    const tip = MODE_TIPS[id]
    if (!tip || !anchor) return
    setActiveInfoTip({ id, ...getInfoTipPosition(anchor) })
  }

  function hideInfoTip() {
    setActiveInfoTip(null)
  }

  useEffect(() => {
    if (!activeInfoTip) return undefined
    function closeFromOutside(e) {
      if (!e.target.closest?.('.info-trigger')) hideInfoTip()
    }
    function closeOnViewportChange() {
      hideInfoTip()
    }
    document.addEventListener('pointerdown', closeFromOutside)
    window.addEventListener('resize', closeOnViewportChange)
    window.addEventListener('scroll', closeOnViewportChange, true)
    return () => {
      document.removeEventListener('pointerdown', closeFromOutside)
      window.removeEventListener('resize', closeOnViewportChange)
      window.removeEventListener('scroll', closeOnViewportChange, true)
    }
  }, [activeInfoTip])

  useEffect(() => { hideInfoTip() }, [view])

  /* ── fetch balance ───────────────────────────────────── */
  async function fetchBalance(user) {
    try {
      const r = await fetch('https://api.hive.blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'condenser_api.get_accounts', params: [[user]], id: 1 }),
      })
      const d = await r.json()
      if (d.result?.[0]) {
        setBalance(d.result[0].balance)
        return parseFloat(d.result[0].balance)
      }
    } catch { /* silent */ }
    return null
  }

  /* ── tutorial on first guest visit ──────────────────── */
  useEffect(() => {
    if (!isGuest) return
    if (localStorage.getItem('hf_tutorial_done')) return
    const t = setTimeout(() => setShowTutorial(true), 500)
    return () => clearTimeout(t)
  }, [isGuest])

  /* ── initial effects ─────────────────────────────────── */
  useEffect(() => {
    if (session?.mode === 'hive') fetchBalance(username)

    fetch('/api/config').then(r => r.json()).then(({ config }) => {
      setPayoutPct({ liquid: config?.percent_payout_liquid, stake: config?.percent_payout_stake })
    }).catch(() => { })

    // socket.io
    const auth = isGuest ? { guestName: username } : { token: session?.token }
    const socket = io({ transports: ['websocket', 'polling'], auth })
    socketRef.current = socket

    socket.on('queue_update', d => setSearch(s => ({ ...s, queueText: `Players in queue: ${d.queueSize ?? d.count ?? '—'}` })))
    socket.on('queued', d => setSearch(s => ({ ...s, queueText: `Players in queue: ${d.queueSize ?? '—'}` })))
    socket.on('match_found', handleMatchFound)
    socket.on('free_match_created', ({ code }) => { setFreeRoom({ code }); setFreeMatchErr('') })
    socket.on('free_match_error', ({ message }) => { setFreeMatchErr(message); setFreeRoom(null) })
    socket.on('payment_verifying', () => setSearch(s => ({ ...s, payStatus: 'Checking blockchain...', paySteps: { ...s.paySteps, 'pay-step-verify': 'active' } })))
    socket.on('payment_accepted', () => setSearch(s => ({ ...s, payStatus: 'Wager confirmed! Waiting for opponent...', paySteps: { ...s.paySteps, 'pay-step-verify': 'done', 'pay-step-opponent': 'active' } })))
    socket.on('opponent_paid', () => setSearch(s => ({ ...s, payStatus: 'Opponent paid! Starting match...' })))
    socket.on('payments_confirmed', () => {
      clearInterval(payCountdownRef.current)
      setSearch(s => ({ ...s, payStatus: 'Both payments confirmed!', paySteps: { ...s.paySteps, 'pay-step-opponent': 'done' } }))
      saveAndRedirect()
    })
    socket.on('wager_failed', d => {
      const reason = d?.message || d?.reason || 'Payment verification failed.'
      setSearch(s => ({ ...s, paySteps: { ...s.paySteps, 'pay-step-verify': 'error' }, payError: reason, showRetry: true }))
    })
    socket.on('wager_refunded', d => {
      clearInterval(payCountdownRef.current)
      cancelSearch()
      showToast(`↩️ ${d.amount} HIVE refunded. ${d.reason || ''}`)
    })
    socket.on('match_cancelled', () => {
      clearInterval(payCountdownRef.current)
      clearInterval(preTimerRef.current)
      clearTimeout(preTimeoutRef.current)
      setSearch(s => {
        if (!s.paying) return s
        return { open: false }
      })
      matchDataRef.current = null
    })
    socket.on('requeued', d => {
      stopSearchUI()
      showToast('⚠️ Opponent did not confirm payment. Searching for a new opponent...')
      startSearchUI()
      if (d.queueSize != null) setSearch(s => ({ ...s, queueText: `Players in queue: ${d.queueSize}` }))
    })
    socket.on('error', d => {
      stopSearchUI()
      setSearch({ open: false })
      socket.emit('leave_queue')
      showToast(d.message || 'Matchmaking error. Please try again.')
    })
    socket.on('connect', () => {
      setSearch(s => {
        if (s.open && !s.found && !s.paying && username) {
          socket.emit('join_queue', { username, wager: pvpBet, format: pvpFmt })
        }
        return s
      })
    })
    socket.on('disconnect', () => {
      setSearch(s => s.open && !s.found ? { ...s, queueText: 'Connection lost — reconnecting...' } : s)
    })

    // tavern — real-time online players list
    socket.on('tavern_update', list => setTavernUsers(list))

    // global chat — ephemeral, cleared on page reload
    socket.on('chat_message', (msg) => {
      setChatMessages(prev => {
        const next = [...prev, { ...msg, _id: (prev[prev.length - 1]?._id ?? -1) + 1 }]
        return next.length > 100 ? next.slice(-100) : next
      })
      if (!isChatTabOpenRef.current) setChatUnread(true)
    })

    return () => { socket.disconnect(); clearInterval(searchTimerRef.current); clearInterval(phraseTimerRef.current); clearInterval(payCountdownRef.current); clearInterval(preTimerRef.current); clearTimeout(preTimeoutRef.current) }
  }, []) // eslint-disable-line

  /* ── AFK timer ───────────────────────────────────────── */
  useEffect(() => {
    if (myStatus !== 'tavern' && myStatus !== 'afk') return
    const AFK_DELAY = 2 * 60 * 1000

    function onActivity() {
      if (myStatus === 'afk') {
        if (!isManualAfkRef.current) {
          if (socketRef.current?.connected) socketRef.current.emit('set_status', { status: 'tavern' })
        }
        return
      }
      clearTimeout(afkTimerRef.current)
      afkTimerRef.current = setTimeout(() => {
        if (socketRef.current?.connected) socketRef.current.emit('set_status', { status: 'afk' })
      }, AFK_DELAY)
    }

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart']
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }))

    if (myStatus === 'tavern') {
      afkTimerRef.current = setTimeout(() => {
        if (socketRef.current?.connected) socketRef.current.emit('set_status', { status: 'afk' })
      }, AFK_DELAY)
    }

    return () => {
      events.forEach(e => window.removeEventListener(e, onActivity))
      clearTimeout(afkTimerRef.current)
    }
  }, [myStatus])

  /* ── prefetch battle resources while user is in lobby ── */
  useEffect(() => {
    const heavy = ['/css/battle.css', '/js/battle.js', '/socket.io/socket.io.js']
    const hints = heavy.map(href => {
      const el = document.createElement('link')
      el.rel = 'prefetch'
      el.href = href
      document.head.appendChild(el)
      return el
    })
    return () => hints.forEach(el => el.remove())
  }, [])

  /* ── load heroes ─────────────────────────────────────── */
  useEffect(() => {
    const order = { tank: 0, dps: 1, support: 2 }
    fetch('/api/characters').then(r => r.json()).then(d => {
      if (d.ok) setHeroData(d.characters.sort((a, b) => (order[roleCategory(a.role)] ?? 3) - (order[roleCategory(b.role)] ?? 3)))
    }).catch(() => { })
  }, [])

  /* ── load equipped skins ─────────────────────────────── */
  useEffect(() => {
    if (!session?.token) return
    fetch('/api/cosmetics/skins/equipped', { headers: { Authorization: `Bearer ${session.token}` } })
      .then(r => r.json())
      .then(d => { if (d.ok) setEquippedSkins(d.equipped || {}) })
      .catch(() => {})
  }, []) // eslint-disable-line

  /* ── load player gear ────────────────────────────────── */
  useEffect(() => {
    if (!session?.token || !session?.username) return
    fetch(`/api/gear?player=${encodeURIComponent(session.username)}`, {
      headers: { Authorization: `Bearer ${session.token}` },
    })
      .then(r => r.json())
      .then(d => { if (d.ok) setPlayerGear(d.gear) })
      .catch(() => {})
  }, []) // eslint-disable-line

  /* ── load communal inventory ─────────────────────────── */
  useEffect(() => {
    if (!session?.token || !session?.username) return
    fetch(`/api/player-items?player=${encodeURIComponent(session.username)}`, {
      headers: { Authorization: `Bearer ${session.token}` },
    })
      .then(r => r.json())
      .then(d => { if (d.ok) setPlayerItems(d.items) })
      .catch(() => {})
  }, []) // eslint-disable-line

  /* ── unequip inventory item (revert hero to starter) ─── */
  async function handleUnequipItem(characterCid, slotType) {
    try {
      const res = await fetch('/api/gear/unequip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ player: username, character_cid: characterCid, slot_type: slotType }),
      })
      const d = await res.json()
      if (d.ok) {
        const [gr, ir] = await Promise.all([
          fetch(`/api/gear?player=${encodeURIComponent(username)}`, { headers: { Authorization: `Bearer ${session.token}` } }).then(r => r.json()),
          fetch(`/api/player-items?player=${encodeURIComponent(username)}`, { headers: { Authorization: `Bearer ${session.token}` } }).then(r => r.json()),
        ])
        if (gr.ok) setPlayerGear(gr.gear)
        if (ir.ok) setPlayerItems(ir.items)
        showToast('↩️ Item removido — herói voltou ao equipamento inicial')
      } else {
        showToast('⚠️ ' + (d.error || 'Não foi possível remover'))
      }
    } catch {
      showToast('⚠️ Erro ao remover item')
    }
  }

  /* ── equip item from inventory ───────────────────────── */
  async function handleEquipItem(itemId, characterCid, slotType) {
    try {
      const res = await fetch('/api/gear/equip', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ player: username, character_cid: characterCid, slot_type: slotType, item_id: itemId }),
      })
      const d = await res.json()
      if (d.ok) {
        const [gr, ir] = await Promise.all([
          fetch(`/api/gear?player=${encodeURIComponent(username)}`, { headers: { Authorization: `Bearer ${session.token}` } }).then(r => r.json()),
          fetch(`/api/player-items?player=${encodeURIComponent(username)}`, { headers: { Authorization: `Bearer ${session.token}` } }).then(r => r.json()),
        ])
        if (gr.ok) setPlayerGear(gr.gear)
        if (ir.ok) setPlayerItems(ir.items)
        showToast('✅ Item equipado!')
      } else {
        showToast('⚠️ ' + (d.error || 'Não foi possível equipar'))
      }
    } catch {
      showToast('⚠️ Erro ao equipar item')
    }
  }

  /* ── load formations ─────────────────────────────────── */
  useEffect(() => {
    if (formationsLoaded) return
    if (session?.mode === 'guest') {
      const raw = localStorage.getItem('hf_guest_formation')
      if (raw) {
        try { const s = JSON.parse(raw); setFormations(prev => prev.map((f, i) => i === 0 ? { ...f, hero_ids: s.hero_ids || [] } : f)) } catch { /* ok */ }
      }
      setFormationsLoaded(true)
      return
    }
    fetch(`/api/formations?player=${encodeURIComponent(username)}`, {
      headers: { 'Authorization': `Bearer ${session?.token}` },
    }).then(r => r.json()).then(d => {
      if (d.ok && Array.isArray(d.formations)) {
        setFormations([1, 2, 3].map(slot => {
          const found = d.formations.find(f => f.slot === slot)
          return found ? { slot, name: found.name || '', hero_ids: found.hero_ids || [] } : { slot, name: '', hero_ids: [] }
        }))
        setFormationsLoaded(true)
      }
    }).catch(() => { })
  }, []) // eslint-disable-line

  /* ── search helpers ──────────────────────────────────── */
  function startSearchUI() {
    let sec = 0
    let phraseIdx = 0
    const betLabel = pvpBet === 0 ? 'Free' : `${pvpBet} HIVE`

    setSearch({
      open: true, found: false, paying: false,
      title: SEARCH_PHRASES[0], timer: '0:00',
      sub: 'Scanning the arena for challengers...',
      configTag: `${betLabel} · BO${pvpFmt}`,
      queueText: 'Players in queue: —',
      payStatus: null, payError: null, showRetry: false, showSendWager: false,
      payCountdown: null, paySteps: {},
    })

    clearInterval(searchTimerRef.current)
    searchTimerRef.current = setInterval(() => {
      sec++
      const m = Math.floor(sec / 60)
      const s = String(sec % 60).padStart(2, '0')
      setSearch(prev => ({ ...prev, timer: `${m}:${s}` }))
    }, 1000)

    clearInterval(phraseTimerRef.current)
    phraseTimerRef.current = setInterval(() => {
      phraseIdx = (phraseIdx + 1) % SEARCH_PHRASES.length
      setSearch(prev => ({ ...prev, title: SEARCH_PHRASES[phraseIdx] }))
    }, 2800)
  }

  function stopSearchUI() {
    clearInterval(searchTimerRef.current)
    clearInterval(phraseTimerRef.current)
  }

  function cancelSearch() {
    stopSearchUI()
    clearInterval(payCountdownRef.current)
    clearInterval(preTimerRef.current)
    clearTimeout(preTimeoutRef.current)
    setSearch({ open: false })
    matchDataRef.current = null
    socketRef.current?.emit('leave_queue')
  }

  function handleMatchFound(data) {
    stopSearchUI()
    const opponent = data.opponents ? (data.opponents[username] || Object.values(data.opponents)[0]) : (data.opponent || '???')
    matchDataRef.current = {
      matchId: data.matchId, opponent,
      isP1: data.p1 === username,
      format: data.format || pvpFmt,
      wager: data.wager ?? pvpBet,
      gameAccount: data.gameAccount || 'horizonforge',
    }

    if (data.needsPayment) {
      let remaining = Math.round((data.timeLimitMs ?? 60_000) / 1000)

      // Pre-popup countdown: warn user for 2.5s before Keychain opens automatically.
      // Without this warning, the 600ms auto-trigger fired while users were mid-click
      // (e.g. switching tabs), accidentally dismissing the popup.
      let prePopup = 3
      setSearch(s => ({
        ...s, found: false, paying: true,
        title: '<span class="search-found-title">OPPONENT FOUND!</span>',
        sub: `vs. ${opponent} — sending wager automatically`,
        payStatus: `Wager: ${matchDataRef.current.wager} HIVE — stay on this tab!`,
        payCountdown: { text: `⚡ Keychain opening in ${prePopup}s — don't click away!`, urgent: false },
        showSendWager: false,
        paySteps: {},
      }))

      // Count down 3→2→1 before the popup fires, then switch to the payment window countdown.
      preTimerRef.current = setInterval(() => {
        prePopup--
        if (prePopup > 0) {
          setSearch(s => ({ ...s, payCountdown: { text: `⚡ Keychain opening in ${prePopup}s — don't click away!`, urgent: false } }))
        } else {
          clearInterval(preTimerRef.current)
        }
      }, 800)

      clearInterval(payCountdownRef.current)
      preTimeoutRef.current = setTimeout(() => {
        sendKeychainTransfer()
        remaining -= Math.round(2500 / 1000)  // subtract the 2.5s pre-delay already elapsed
        // After popup fires, switch to payment-window countdown.
        payCountdownRef.current = setInterval(() => {
          remaining--
          setSearch(s => ({ ...s, payCountdown: { text: `⏳ Confirm in Keychain — ${remaining}s remaining`, urgent: remaining <= 10 } }))
          if (remaining <= 0) clearInterval(payCountdownRef.current)
        }, 1000)
      }, 2500)
    } else {
      setSearch(s => ({
        ...s, found: true, paying: false,
        title: '<span class="search-found-title">OPPONENT FOUND!</span>',
        sub: `vs. ${opponent} — entering arena...`,
      }))
      saveAndRedirect()
    }
  }

  function saveAndRedirect() {
    const f = formations[defaultSlot]
    const formationHeroIds = f?.hero_ids?.length ? f.hero_ids : null
    const md = matchDataRef.current
    if (!md) return
    sessionStorage.setItem('hf_battle_cfg', JSON.stringify({
      mode: 'pvp', matchId: md.matchId, opponent: md.opponent,
      isP1: md.isP1, format: md.format, wager: md.wager,
      payoutPref: localStorage.getItem(session?.username ? `hf_payout_${username}` : 'hf_payout') || 'liquid',
      formationHeroIds,
    }))
    setTimeout(() => { navigate('/battle') }, 800)
  }

  function sendKeychainTransfer() {
    const md = matchDataRef.current
    if (!md) return
    const payoutPref = localStorage.getItem(session?.username ? `hf_payout_${username}` : 'hf_payout') || 'liquid'
    const memo = `battle_${md.matchId}_${payoutPref}`

    if (!window.hive_keychain) {
      setSearch(s => ({ ...s, payError: 'Hive Keychain not found. Please install it and retry.', showRetry: true, paySteps: { ...s.paySteps, 'pay-step-send': 'error' } }))
      return
    }
    window.focus()
    setSearch(s => ({ ...s, payStatus: 'Keychain open — confirm the transfer!', showSendWager: false, paySteps: { ...s.paySteps, 'pay-step-send': 'active' } }))
    window.hive_keychain.requestTransfer(username, md.gameAccount, md.wager.toFixed(3), memo, 'HIVE', (response) => {
      if (response.success) {
        setSearch(s => ({ ...s, payStatus: 'Verifying on blockchain...', paySteps: { ...s.paySteps, 'pay-step-send': 'done', 'pay-step-verify': 'active' } }))
        const txId = response.result?.id || response.result?.trx_id || ''
        socketRef.current?.emit('wager_sent', { matchId: md.matchId, txId })
      } else {
        const reason = response.message || response.error || 'Keychain request cancelled'
        setSearch(s => ({ ...s, paySteps: { ...s.paySteps, 'pay-step-send': 'error' }, payError: reason, showRetry: true }))
      }
    })
  }

  function handleRetryWager() {
    setSearch(s => ({ ...s, paySteps: {}, payError: null, showRetry: false, payStatus: `Wager: ${matchDataRef.current?.wager} HIVE`, showSendWager: true }))
  }

  /* ── ensure active deck ──────────────────────────────── */
  async function ensureActiveDeck() {
    if (session?.mode !== 'guest' && !formationsLoaded) {
      const res = await fetch(`/api/formations?player=${encodeURIComponent(username)}`, {
        headers: { 'Authorization': `Bearer ${session?.token}` },
      })
      const d = await res.json()
      if (d.ok && Array.isArray(d.formations)) {
        const loaded = [1, 2, 3].map(slot => {
          const found = d.formations.find(f => f.slot === slot)
          return found ? { slot, name: found.name || '', hero_ids: found.hero_ids || [] } : { slot, name: '', hero_ids: [] }
        })
        setFormations(loaded)
        setFormationsLoaded(true)
        const slot = Number(loadPref('default_form_slot', username, 0))
        const f = loaded[slot]
        return f?.hero_ids?.length ? f.hero_ids : null
      }
      return null
    }
    const savedSlot = Number(loadPref('default_form_slot', username, 0))
    const f = formations[savedSlot]
    return f?.hero_ids?.length ? f.hero_ids : null
  }

  /* ── AI battle start ─────────────────────────────────── */
  async function startAiBattle() {
    const formationHeroIds = await ensureActiveDeck()
    if (!formationHeroIds) { showToast('⚠️ No deck selected. Build a formation first!'); return }
    sessionStorage.setItem('hf_battle_cfg', JSON.stringify({ mode: 'ai', format: aiFormat, formationHeroIds }))
    navigate('/battle')
  }

  /* ── PvP start ───────────────────────────────────────── */
  async function startPvp() {
    if (isGuest) { setConvCtx('pvp'); return }
    if (session?.mode !== 'hive') { showToast('PvP requires a Hive account. Log in with Hive to play! 🏆'); return }
    const heroIds = await ensureActiveDeck()
    if (!heroIds) { showToast('⚠️ No deck selected. Build a formation first!'); return }
    if (pvpBet > 0) {
      const bal = await fetchBalance(username)
      if (bal === null) { showToast('⚠️ Could not verify your balance. Please try again.'); return }
      if (bal < pvpBet) { showToast(`⚠️ Insufficient balance! You have ${bal.toFixed(3)} HIVE but the wager is ${pvpBet} HIVE.`); return }
    }
    if (window.hive_keychain && pvpBet > 0) window.hive_keychain.requestHandshake(() => { })
    startSearchUI()
    socketRef.current?.emit('join_queue', { username, wager: pvpBet, format: pvpFmt })
  }

  /* ── review blockchain purchases ────────────────────────── */
  async function handleReviewPurchases() {
    setMenuOpen(false)
    clearTimeout(toastTimerRef.current)
    setToastMsg('⏳ Reviewing full purchase history... may take a few seconds.')
    try {
      const res = await fetch('/api/shop/review-purchases', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
      })
      const data = await res.json()
      if (data.ok && data.restored > 0) {
        showToast(`✅ ${data.restored} Item(s) restored!`)
      } else if (data.ok && data.debug?.notInCatalog?.length > 0) {
        showToast(`⚠️ Purchase found (${data.debug.notInCatalog.join(', ')}) but item is not in the catalog. Contact support.`)
      } else if (data.ok) {
        showToast('ℹ️ Everything was already synchronized!')
      } else {
        showToast('❌ Error when reviewing purchases.')
      }
    } catch {
      showToast('❌ Error when reviewing purchases.')
    }
  }

  /* ── logout ──────────────────────────────────────────── */
  function doLogout() {
    sessionStorage.removeItem('hf_session')
    sessionStorage.removeItem('hf_battle_cfg')
    localStorage.removeItem('hf_session')
    localStorage.removeItem('hf_guest_formation')
    navigate('/', { replace: true })
  }

  /* ── nav helpers ─────────────────────────────────────── */
  function navTabClass(tab) { return `mbt-tab${view === tab ? ' active' : ''}` }

  /* ── render ──────────────────────────────────────────── */
  return (
    <>
      <nav className="topnav">
        <div className="nav-right">
          {/* TEASER DO BAÚ — NOVA IMPLEMENTAÇÃO */}
          <div className="nav-chest-pill" title="Fight for a chance to open a new chest!">
            <span className="nav-chest-ico">🎁</span>
            <span className="nav-chest-status">0 %</span>
            <div className="nav-chest-glow"></div>
          </div>

          {session?.mode === 'hive' && balance != null && (
            <div className="hive-bal">
              <img src="/images/hive-logo.png" width="14" height="12" style={{ display: 'inline-block', verticalAlign: 'middle', imageRendering: 'crisp-edges' }} alt="HIVE" />
              <span>{balance}</span>
            </div>
          )}

          <div className="nav-user-badge" ref={userMenuRef} onClick={() => setMenuOpen(o => !o)}>
            {session?.mode === 'hive' && !avatarError && (
              <img className="nav-avatar" src={`https://images.hive.blog/u/${username}/avatar`} alt="avatar" onError={() => setAvatarError(true)} />
            )}
            <span>@{username}</span>
            <span className="nav-user-chevron">▼</span>
            {menuOpen && (
              <div className="user-dropdown" onClick={e => e.stopPropagation()}>
                {session?.mode === 'hive' && (
                  <button className="user-dropdown-item" onClick={handleReviewPurchases}>
                    🔍 Review Purchases
                  </button>
                )}
                <button className="user-dropdown-item danger" onClick={doLogout}>
                  🚪 Exit
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="lobby-wrap lobby-with-tavern">
        <TavernPanel
          users={tavernUsers}
          myUsername={username}
          onSetAvailable={handleSetAvailable}
          onSetAbsent={handleSetAbsent}
          chatMessages={chatMessages}
          chatUnread={chatUnread}
          onSendMessage={handleSendMessage}
          onChatOpen={handleChatOpen}
          onChatClose={handleChatClose}
        />
        {view === 'home' && (
          <div id="view-home" className="lv active">
            <div className="view-scroll">
              <div className="view-col">
                <p className="duel-title">Battle Mode</p>

                <div className="banners-grid">
                {/* AI Card */}
                <section className="banner banner-ai">
                  <div className="banner-img">
                    <img src="/images/image_bot.jpeg" alt="Solo Battle" />
                  </div>
                  <div className="banner-body">
                  <div className="banner-preview">
                    <div className="banner-title-row">
                      <span className="banner-type-badge">Solo</span>
                      <div className="hf-select" style={{ position: 'relative' }}>
                        <button className="hf-sel-trigger" type="button" onClick={() => setAiFmtOpen(x => !x)}>
                          <span className="hf-sel-value">{FMT_OPTS.find(o => o.val === aiFormat)?.label}</span>
                          <span className="hf-sel-chevron">▾</span>
                        </button>
                        {aiFmtOpen && (
                          <div className="hf-float-dd dd-open" style={{ position: 'absolute', bottom: '100%', top: 'auto', left: 0, zIndex: 9999 }}>
                            {FMT_OPTS.map(o => (
                              <button key={o.val} className={`hf-sel-opt${o.val === aiFormat ? ' active' : ''}`} onClick={() => { setAiFormat(o.val); savePref('ai_fmt', username, o.val); setAiFmtOpen(false) }}>{o.label}</button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        className={`info-trigger${activeInfoTip?.id === 'ai' ? ' tip-active' : ''}`}
                        id="info-ai"
                        data-tip-id="ai"
                        aria-label="More info"
                        type="button"
                        onMouseEnter={e => showInfoTip('ai', e.currentTarget)}
                        onMouseLeave={hideInfoTip}
                        onFocus={e => showInfoTip('ai', e.currentTarget)}
                        onBlur={hideInfoTip}
                        onClick={e => {
                          e.stopPropagation()
                          showInfoTip('ai', e.currentTarget)
                        }}
                      >i</button>
                    </div>
                  </div>
                  <div className="banner-expand">
                    <div className="cfg-divider" />
                    <button className="btn-action btn-start" onClick={startAiBattle}>▶ START BATTLE</button>
                  </div>
                  </div>
                </section>

                {/* PvP Card */}
                <section className="banner banner-pvp">
                  <div className="banner-img">
                    <img src="/images/image_pvp.jpeg" alt="PvP Match" />
                  </div>
                  <div className="banner-body">
                  <div className="banner-preview">
                    <div className="banner-title-row">
                      <span className="banner-type-badge">PVP</span>
                      <div className="hf-select" style={{ position: 'relative' }}>
                        <button className="hf-sel-trigger" type="button" onClick={() => setPvpFmtOpen(x => !x)}>
                          <span className="hf-sel-value">{FMT_OPTS.find(o => o.val === pvpFmt)?.label}</span>
                          <span className="hf-sel-chevron">▾</span>
                        </button>
                        {pvpFmtOpen && (
                          <div className="hf-float-dd dd-open" style={{ position: 'absolute', bottom: '100%', top: 'auto', left: 0, zIndex: 9999 }}>
                            {FMT_OPTS.map(o => (
                              <button key={o.val} className={`hf-sel-opt${o.val === pvpFmt ? ' active' : ''}`} onClick={() => { setPvpFmt(o.val); savePref('pvp_fmt', username, o.val); setPvpFmtOpen(false) }}>{o.label}</button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="hf-select" style={{ position: 'relative' }}>
                        <button className="hf-sel-trigger" type="button" onClick={() => setPvpBetOpen(x => !x)}>
                          <span className="hf-sel-value">{BET_OPTS.find(o => o.val === pvpBet)?.label}</span>
                          <span className="hf-sel-chevron">▾</span>
                        </button>
                        {pvpBetOpen && (
                          <div className="hf-float-dd dd-open" style={{ position: 'absolute', bottom: '100%', top: 'auto', left: 0, zIndex: 9999 }}>
                            {BET_OPTS.map(o => (
                              <button key={o.val} className={`hf-sel-opt${o.val === pvpBet ? ' active' : ''}`} onClick={() => { setPvpBet(o.val); savePref('pvp_bet', username, o.val); setPvpBetOpen(false) }}>{o.label}</button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        className={`info-trigger${activeInfoTip?.id === 'pvp' ? ' tip-active' : ''}`}
                        id="info-pvp"
                        data-tip-id="pvp"
                        aria-label="More info"
                        type="button"
                        onMouseEnter={e => showInfoTip('pvp', e.currentTarget)}
                        onMouseLeave={hideInfoTip}
                        onFocus={e => showInfoTip('pvp', e.currentTarget)}
                        onBlur={hideInfoTip}
                        onClick={e => {
                          e.stopPropagation()
                          showInfoTip('pvp', e.currentTarget)
                        }}
                      >i</button>
                    </div>
                  </div>
                  <div className="banner-expand">
                    <div className="cfg-divider" />
                    <button className="btn-action btn-find" onClick={startPvp}>🔍 FIND MATCH</button>
                  </div>
                  </div>
                </section>

                {/* Campaign Card */}
                <section className="banner banner-campaign">
                  <div className="banner-img">
                    <img src="/images/campaign/chapter1-bg.jpg" alt="Campaign" />
                  </div>
                  <div className="banner-body">
                    <div className="banner-preview">
                      <div className="banner-title-row">
                        <span className="banner-type-badge" style={{ background: 'linear-gradient(135deg,#6b3fa0,#4a2080)', borderColor: 'rgba(160,100,255,0.5)' }}>CAMPAIGN</span>
                      </div>
                    </div>
                    <div className="banner-expand">
                      <div className="cfg-divider" />
                      <button className="btn-action btn-start" onClick={() => setView('campaign')}>📜 PLAY CAMPAIGN</button>
                    </div>
                  </div>
                </section>

                {isGuest && (
                  <div className="free-pvp-card">
                    <div className="free-pvp-title">🎮 Free PvP · Guest Match</div>
                    {!freeRoom ? (
                      <>
                        <button
                          className="btn-action btn-start"
                          style={{ width: '100%', marginBottom: 10 }}
                          onClick={() => socketRef.current?.emit('create_free_match', { format: 5 })}
                        >
                          CREATE ROOM
                        </button>
                        <div className="free-pvp-row">
                          <input
                            className="free-pvp-input"
                            type="text"
                            placeholder="Room code"
                            value={joinCode}
                            maxLength={6}
                            onChange={e => setJoinCode(e.target.value.toUpperCase())}
                          />
                          <button
                            className="btn-free-pvp"
                            onClick={() => {
                              if (!joinCode.trim()) return
                              socketRef.current?.emit('join_free_match', { code: joinCode.trim() })
                            }}
                          >
                            JOIN
                          </button>
                        </div>
                        {freeMatchErr && <div className="free-pvp-err">{freeMatchErr}</div>}
                      </>
                    ) : (
                      <>
                        <div className="free-pvp-code">{freeRoom.code}</div>
                        <div className="free-pvp-status">Waiting for opponent…</div>
                        <button
                          className="btn-free-pvp"
                          style={{ width: '100%' }}
                          onClick={() => setFreeRoom(null)}
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                )}

                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'grimoire' && <GrimoireView />}

        {view === 'campaign' && (
          <CampaignView
            session={session} formations={formations} defaultSlot={defaultSlot} toast={showToast}
          />
        )}

        {view === 'shop' && <ShopView session={session} toast={showToast} heroData={heroData} />}

        {view === 'formation' && (
          <FormationView
            session={session} formations={formations} setFormations={setFormations}
            defaultSlot={defaultSlot} setDefaultSlot={setDefaultSlot}
            heroData={heroData} toast={showToast} equippedSkins={equippedSkins}
            playerGear={playerGear} playerItems={playerItems} onEquipItem={handleEquipItem} onUnequipItem={handleUnequipItem}
          />
        )}

        {view === 'settings' && <SettingsView session={session} payoutPct={payoutPct} />}

        <nav className="mobile-bottom-tabs">
          <button type="button" className={navTabClass('grimoire')} onClick={() => setView('grimoire')}>
            <span className="mbt-ico">📖</span><span className="mbt-lbl">Grimoire</span>
          </button>
          <button type="button" className={navTabClass('formation')} onClick={() => setView('formation')}>
            <span className="mbt-ico">🏰</span><span className="mbt-lbl">Formation</span>
          </button>
          <button type="button" className={navTabClass('home')} onClick={() => setView('home')}>
            <span className="mbt-ico">⚔️</span><span className="mbt-lbl">Duel</span>
          </button>
          <button type="button" className={navTabClass('campaign')} onClick={() => setView('campaign')}>
            <span className="mbt-ico">📜</span><span className="mbt-lbl">Campaign</span>
          </button>
          <button type="button" className={navTabClass('shop')} onClick={() => setView('shop')}>
            <span className="mbt-ico">🛒</span><span className="mbt-lbl">Shop</span>
          </button>
          <button type="button" className={navTabClass('settings')} onClick={() => setView('settings')}>
            <span className="mbt-ico">⚙️</span><span className="mbt-lbl">Config</span>
          </button>
        </nav>
      </div>

      <button
        type="button"
        className="tv-fab"
        onClick={() => setTavernOpen(true)}
        aria-label="Open Tavern"
      >
        🍺
        {chatUnread && !tavernOpen && <span className="tv-fab-badge" />}
      </button>

      <div
        className={`tv-overlay${tavernOpen ? ' tv-overlay-open' : ''}`}
        onClick={() => { setTavernOpen(false); handleChatClose() }}
      >
        <div
          className={`tv-overlay-panel${tavernOpen ? ' open' : ''}`}
          onClick={e => e.stopPropagation()}
        >
          <button
            type="button"
            className="tv-overlay-close"
            onClick={() => { setTavernOpen(false); handleChatClose() }}
          >✕</button>
          <TavernPanel
            users={tavernUsers}
            isMobile={true}
            myUsername={username}
            onSetAvailable={handleSetAvailable}
            onSetAbsent={handleSetAbsent}
            chatMessages={chatMessages}
            chatUnread={chatUnread}
            onSendMessage={handleSendMessage}
            onChatOpen={handleChatOpen}
            onChatClose={handleChatClose}
          />
        </div>
      </div>

      <SearchOverlay
        search={search}
        onCancel={cancelSearch} onSendWager={sendKeychainTransfer} onRetry={handleRetryWager}
      />

      {toast && <div className="toast show">{toast}</div>}
      <TutorialOverlay
        open={showTutorial}
        onComplete={() => { localStorage.setItem('hf_tutorial_done', '1'); setShowTutorial(false) }}
      />
      <GuestConversionModal open={!!convCtx} context={convCtx} onClose={() => setConvCtx(null)} />
      <div
        id="desc-tooltip"
        className={activeInfoTip ? 'visible' : ''}
        data-theme={activeInfoTip ? MODE_TIPS[activeInfoTip.id]?.theme : undefined}
        style={activeInfoTip ? {
          left: `${activeInfoTip.left}px`,
          top: `${activeInfoTip.top}px`,
          width: `${activeInfoTip.width}px`,
        } : undefined}
      >
        {activeInfoTip && (() => {
          const tip = MODE_TIPS[activeInfoTip.id]
          return (
            <>
              <div className="tip-title">{tip.title}</div>
              <div className="tip-body">{tip.body}</div>
              {tip.sections.map(section => (
                <div key={section.label} style={{ marginTop: 9 }}>
                  <div
                    style={{
                      borderTop: `1px solid ${tip.theme === 'pvp' ? 'rgba(220, 150, 30, 0.14)' : 'rgba(160, 120, 255, 0.14)'}`,
                      marginBottom: 7,
                    }}
                  />
                  <div className="tip-section" style={{ borderBottom: 'none', paddingBottom: 0 }}>{section.label}</div>
                  <div className="tip-rows">
                    {section.rows.map(([key, value]) => (
                      <div className="tip-row" key={`${section.label}-${key}`}>
                        <span className="tip-key">{key}</span>
                        <span>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )
        })()}
      </div>
    </>
  )
}

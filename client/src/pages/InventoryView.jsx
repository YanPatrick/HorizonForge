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
          {activeTab === 'gear' && <p style={{ color: '#5a5080' }}>Gear tab — coming in next task</p>}
          {activeTab === 'skins' && <p style={{ color: '#5a5080' }}>Skins tab — coming in next task</p>}
          {activeTab === 'backgrounds' && <p style={{ color: '#5a5080' }}>Backgrounds tab — coming in next task</p>}
        </div>
      </div>
    </div>
  )
}

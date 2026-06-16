import { useT } from '../context/LanguageContext'

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

export default function ChestResultModal({ result, onClose }) {
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

          {isCritHit  && <div className="cr-crit cr-crit--hit">⚡ THE FORGE GODS BLESS YOU! PERFECT ROLL!</div>}
          {isCritFail && <div className="cr-crit cr-crit--fail">💀 THE CHAOS CORRUPTS IT... A CURSED ARTIFACT.</div>}

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
          {item.req_attr2 && item.req_value2 && (
            <div className="cr-req">
              {t('shop.requires', { attr: ATTR_LABELS[item.req_attr2] || item.req_attr2, value: item.req_value2 })}
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

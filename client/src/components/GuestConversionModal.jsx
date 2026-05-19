import '@styles/components.css'

const CONFIGS = {
  pvp: {
    icon: '⚔️',
    title: 'Unlock Real PvP',
    body: 'Play against real players, climb the leaderboard, and earn actual HIVE tokens.',
  },
  victory: {
    icon: '🏆',
    title: 'Congrats on the Win!',
    body: 'Create a Hive account to save your progress, climb the leaderboard, and earn real HIVE.',
  },
  formation: {
    icon: '📋',
    title: 'Save More Formations',
    body: 'Create a Hive account to save up to 3 different team formations.',
  },
}

export default function GuestConversionModal({ open, context, onClose }) {
  if (!open) return null
  const cfg = CONFIGS[context] || CONFIGS.pvp
  return (
    <div className="gcm-backdrop" onClick={onClose}>
      <div className="gcm-card" onClick={e => e.stopPropagation()}>
        <button className="gcm-close" type="button" onClick={onClose}>✕</button>
        <span className="gcm-icon">{cfg.icon}</span>
        <h3 className="gcm-title">{cfg.title}</h3>
        <p className="gcm-body">{cfg.body}</p>
        <a
          className="gcm-cta"
          href="https://peakd.com/register?ref=shiftrox"
          target="_blank"
          rel="noreferrer"
          onClick={onClose}
        >
          Create free Hive account →
        </a>
        <button className="gcm-dismiss" type="button" onClick={onClose}>Continue as guest</button>
      </div>
    </div>
  )
}

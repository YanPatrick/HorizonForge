import '@styles/components.css'
import { useT } from '../context/LanguageContext'

export default function GuestConversionModal({ open, context, onClose }) {
  const { t } = useT()
  if (!open) return null

  const CONFIGS = {
    pvp:       { icon: '⚔️',  title: t('gcm.pvp.title'),       body: t('gcm.pvp.body') },
    victory:   { icon: '🏆',  title: t('gcm.victory.title'),    body: t('gcm.victory.body') },
    formation: { icon: '📋',  title: t('gcm.formation.title'),  body: t('gcm.formation.body') },
  }
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
          {t('gcm.cta')}
        </a>
        <button className="gcm-dismiss" type="button" onClick={onClose}>{t('gcm.dismiss')}</button>
      </div>
    </div>
  )
}

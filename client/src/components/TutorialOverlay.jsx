import { useState } from 'react'
import '@styles/components.css'
import { useT } from '../context/LanguageContext'

export default function TutorialOverlay({ open, onComplete }) {
  const { t } = useT()
  const [step, setStep] = useState(0)
  if (!open) return null

  const STEPS = [
    { icon: '🃏', title: t('tut.step1.title'), desc: t('tut.step1.desc') },
    { icon: '⚔️', title: t('tut.step2.title'), desc: t('tut.step2.desc') },
    { icon: '▶',  title: t('tut.step3.title'), desc: t('tut.step3.desc') },
  ]

  const s = STEPS[step]
  const isLast = step === STEPS.length - 1
  return (
    <div className="tut-backdrop">
      <div className="tut-card">
        <span className="tut-icon">{s.icon}</span>
        <div className="tut-step-label">{t('tut.stepLabel', { n: step + 1, total: STEPS.length })}</div>
        <h3 className="tut-title">{s.title}</h3>
        <p className="tut-desc">{s.desc}</p>
        <div className="tut-dots">
          {STEPS.map((_, i) => <span key={i} className={`tut-dot${i === step ? ' active' : ''}`} />)}
        </div>
        <div className="tut-actions">
          {!isLast && (
            <button className="tut-skip" type="button" onClick={onComplete}>{t('tut.skip')}</button>
          )}
          <button
            className="tut-next"
            type="button"
            onClick={isLast ? onComplete : () => setStep(p => p + 1)}
          >
            {isLast ? t('tut.play') : t('tut.next')}
          </button>
        </div>
      </div>
    </div>
  )
}

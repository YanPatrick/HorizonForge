import { useState } from 'react'
import '@styles/components.css'

const STEPS = [
  {
    icon: '🃏',
    title: 'Recruit your heroes',
    desc: 'Click characters in the roster on the right to add them to your bench.',
  },
  {
    icon: '⚔️',
    title: 'Build your formation',
    desc: 'Drag heroes from the bench to the field positions to set up your team.',
  },
  {
    icon: '▶',
    title: "You're ready to fight!",
    desc: 'Click START BATTLE to launch your first match against the Bot.',
  },
]

export default function TutorialOverlay({ open, onComplete }) {
  const [step, setStep] = useState(0)
  if (!open) return null
  const s = STEPS[step]
  const isLast = step === STEPS.length - 1
  return (
    <div className="tut-backdrop">
      <div className="tut-card">
        <span className="tut-icon">{s.icon}</span>
        <div className="tut-step-label">Step {step + 1} of {STEPS.length}</div>
        <h3 className="tut-title">{s.title}</h3>
        <p className="tut-desc">{s.desc}</p>
        <div className="tut-dots">
          {STEPS.map((_, i) => <span key={i} className={`tut-dot${i === step ? ' active' : ''}`} />)}
        </div>
        <div className="tut-actions">
          {!isLast && (
            <button className="tut-skip" type="button" onClick={onComplete}>Skip</button>
          )}
          <button
            className="tut-next"
            type="button"
            onClick={isLast ? onComplete : () => setStep(p => p + 1)}
          >
            {isLast ? 'Play now!' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  )
}

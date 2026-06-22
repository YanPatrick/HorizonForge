import { useState, useEffect, useCallback } from 'react'

/**
 * Normaliza lore_post em array de linhas.
 * Campos por linha: scene?, speaker?, speaker_en?, speaker_side?, portrait?, text, text_en?
 */
function parseLines(lore_post, lore_post_en, lang) {
  if (!lore_post) return []

  if (Array.isArray(lore_post)) {
    return lore_post.map(line => ({
      scene:    line.scene ?? null,
      speaker:  lang === 'pt-BR' ? (line.speaker ?? null) : (line.speaker_en ?? line.speaker ?? null),
      portrait: line.portrait ?? null,
      text:     lang === 'pt-BR' ? (line.text ?? '') : (line.text_en ?? line.text ?? ''),
    }))
  }

  const text = lang === 'pt-BR' ? lore_post : (lore_post_en ?? lore_post)
  return [{ scene: null, speaker: null, portrait: null, text }]
}

export default function DialogScene({ lore_post, lore_post_en, lang, onComplete }) {
  const lines = parseLines(lore_post, lore_post_en, lang)
  const [idx, setIdx] = useState(0)
  const [overlayVisible, setOverlayVisible] = useState(false)
  const [boxVisible, setBoxVisible] = useState(false)

  useEffect(() => {
    if (lines.length === 0) { onComplete(); return }
    const t1 = setTimeout(() => setOverlayVisible(true), 30)
    const t2 = setTimeout(() => setBoxVisible(true), 120)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setBoxVisible(false)
    const t = setTimeout(() => setBoxVisible(true), 80)
    return () => clearTimeout(t)
  }, [idx])

  const advance = useCallback(() => {
    if (idx < lines.length - 1) {
      setIdx(i => i + 1)
    } else {
      setOverlayVisible(false)
      setTimeout(onComplete, 380)
    }
  }, [idx, lines.length, onComplete])

  useEffect(() => {
    const handler = (e) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault()
        advance()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [advance])

  if (lines.length === 0) return null

  const line = lines[idx]
  const isNarration = !line.speaker
  const isLast = idx === lines.length - 1
  const hint = isLast ? 'Continuar ›' : 'Clique para avançar ›'

  return (
    <div
      onClick={advance}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-end',
        padding: '0 40px 60px',
        background: 'rgba(4,2,12,0.82)',
        opacity: overlayVisible ? 1 : 0,
        transition: 'opacity 0.38s ease',
        cursor: 'pointer',
        userSelect: 'none', WebkitUserSelect: 'none',
      }}
    >
      {/* Imagem de fundo da cena */}
      {line.scene && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: `url(${line.scene})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
        }} />
      )}

      {/* Vinheta */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: line.scene
          ? 'linear-gradient(to bottom, rgba(4,2,12,0.35) 0%, rgba(4,2,12,0.1) 35%, rgba(4,2,12,0.75) 70%, rgba(4,2,12,0.96) 100%)'
          : 'linear-gradient(to bottom, rgba(4,2,12,0.5) 0%, transparent 40%, rgba(4,2,12,0.8) 100%)',
      }} />

      {/* Container principal */}
      <div style={{
        position: 'relative',
        width: '100%', maxWidth: 900,
        opacity: boxVisible ? 1 : 0,
        transform: boxVisible ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 0.18s ease, transform 0.18s ease',
      }}>

        {/* Retrato — flutua no canto superior esquerdo da caixa */}
        {line.portrait && (
          <div style={{
            paddingLeft: 16,
            display: 'flex',
            justifyContent: 'flex-start',
            marginBottom: -16,
            position: 'relative', zIndex: 1,
          }}>
            <div style={{
              width: 90, height: 90,
              borderRadius: '50%',
              overflow: 'hidden',
              border: '2px solid rgba(255,196,90,0.45)',
              background: 'rgba(0,0,0,0.7)',
              boxShadow: '0 0 28px rgba(255,180,50,0.3)',
            }}>
              <img
                src={line.portrait}
                alt={line.speaker || ''}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          </div>
        )}

        {/* Caixa de texto */}
        <div style={{
          background: 'rgba(8,5,22,0.96)',
          border: '1px solid rgba(255,196,90,0.18)',
          borderRadius: 12,
          padding: '24px 32px 22px',
          boxShadow: '0 8px 60px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.03)',
        }}>
          {line.speaker && (
            <div style={{
              fontSize: 13, fontWeight: 700, color: '#ffc85a',
              letterSpacing: '0.12em', textTransform: 'uppercase',
              marginBottom: 12, opacity: 0.9,
              paddingTop: line.portrait ? 12 : 0,
            }}>
              {line.speaker}
            </div>
          )}
          <div style={{
            fontSize: 18, lineHeight: 1.75,
            color: isNarration ? 'rgba(195,185,215,0.88)' : 'rgba(238,232,255,0.95)',
            fontStyle: isNarration ? 'italic' : 'normal',
          }}>
            {line.text}
          </div>
        </div>

        {/* Barra de progresso + hint */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 4px 0',
        }}>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            {lines.length > 1 && lines.map((_, i) => (
              <div key={i} style={{
                height: 4, borderRadius: 2,
                width: i === idx ? 18 : 6,
                background: i < idx ? 'rgba(255,200,80,0.45)' : i === idx ? '#ffc85a' : 'rgba(255,255,255,0.15)',
                transition: 'width 0.25s ease, background 0.25s ease',
              }} />
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.04em' }}>
            <span className="hf-dialog-pulse">{hint}</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes hfDialogPulse {
          0%, 100% { opacity: 0.28; }
          50%       { opacity: 0.55; }
        }
        .hf-dialog-pulse { animation: hfDialogPulse 1.4s ease-in-out infinite; display: inline-block; }
      `}</style>
    </div>
  )
}

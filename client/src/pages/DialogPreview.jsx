import { useState, useEffect } from 'react'
import { useT } from '../context/LanguageContext'
import DialogScene from '../components/DialogScene'

const CHAPTERS = [1, 2]

export default function DialogPreview() {
  const { lang } = useT()
  const [chapter, setChapter] = useState(1)
  const [stages, setStages] = useState([])
  const [playing, setPlaying] = useState(null) // { lore_post, lore_post_en }
  const [done, setDone] = useState(false)

  useEffect(() => {
    fetch(`/api/campaign?chapter=${chapter}`)
      .then(r => r.json())
      .then(d => { if (d.ok) setStages(d.stages) })
      .catch(() => {})
  }, [chapter])

  const scenes = stages.flatMap(s => [
    s.lore_pre && { stage: s.stage, name: s.name, name_en: s.name_en, phase: 'pre', lore_post: s.lore_pre, lore_post_en: s.lore_pre_en },
    s.lore_post && { stage: s.stage, name: s.name, name_en: s.name_en, phase: 'post', lore_post: s.lore_post, lore_post_en: s.lore_post_en },
  ].filter(Boolean))

  function play(scene) {
    setDone(false)
    setPlaying({ lore_post: scene.lore_post, lore_post_en: scene.lore_post_en, label: scene.name })
  }

  function handleComplete() {
    setPlaying(null)
    setDone(true)
  }

  return (
    <>
      {playing && (
        <DialogScene
          lore_post={playing.lore_post}
          lore_post_en={playing.lore_post_en}
          lang={lang}
          onComplete={handleComplete}
        />
      )}

      <div style={{
        minHeight: '100vh',
        background: '#07040f',
        color: '#e8e0f0',
        fontFamily: 'system-ui, sans-serif',
        padding: '40px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        <div style={{ width: '100%', maxWidth: 560 }}>

          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.12em', color: '#ffc85a', textTransform: 'uppercase', marginBottom: 6 }}>
              Dialog Preview
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#f0eaff' }}>
              Visualizador de Cenas
            </div>
            <div style={{ fontSize: 13, color: 'rgba(200,185,230,0.5)', marginTop: 4 }}>
              Pré-visualize as cenas de diálogo sem precisar jogar uma batalha.
            </div>
          </div>

          {/* Chapter selector */}
          <div style={{ marginBottom: 20, display: 'flex', gap: 8 }}>
            {CHAPTERS.map(ch => (
              <button
                key={ch}
                type="button"
                onClick={() => { setChapter(ch); setDone(false) }}
                style={{
                  padding: '6px 16px',
                  borderRadius: 6,
                  border: '1px solid',
                  borderColor: chapter === ch ? '#ffc85a' : 'rgba(255,255,255,0.15)',
                  background: chapter === ch ? 'rgba(255,200,90,0.12)' : 'rgba(255,255,255,0.04)',
                  color: chapter === ch ? '#ffc85a' : 'rgba(200,185,230,0.6)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: chapter === ch ? 600 : 400,
                }}
              >
                Capítulo {ch}
              </button>
            ))}
          </div>

          {/* Scene list */}
          {scenes.length === 0 ? (
            <div style={{ fontSize: 13, color: 'rgba(200,185,230,0.35)', padding: '20px 0' }}>
              Nenhuma cena configurada neste capítulo.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {scenes.map(s => {
                const hasArray = Array.isArray(s.lore_post)
                const lines = hasArray ? s.lore_post.length : 1
                const hasSpeaker = hasArray && s.lore_post.some(l => l.speaker)
                const hasPortrait = hasArray && s.lore_post.some(l => l.portrait)
                const hasScene = hasArray && s.lore_post.some(l => l.scene)

                return (
                  <div
                    key={`${s.stage}-${s.phase}`}
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.09)',
                      borderRadius: 10,
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                    }}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'rgba(255,200,90,0.12)',
                      border: '1px solid rgba(255,200,90,0.25)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700, color: '#ffc85a', flexShrink: 0,
                    }}>
                      {s.stage}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#f0eaff', marginBottom: 4 }}>
                        {lang === 'pt-BR' ? s.name : (s.name_en || s.name)}
                        <span style={{ color: 'rgba(255,200,90,0.6)', fontWeight: 400, marginLeft: 6, fontSize: 12 }}>
                          {s.phase === 'pre' ? '(antes)' : '(depois)'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <Tag>{lines} {lines === 1 ? 'linha' : 'linhas'}</Tag>
                        {hasSpeaker && <Tag accent>speakers</Tag>}
                        {hasPortrait && <Tag accent>retratos</Tag>}
                        {hasScene && <Tag accent>cena de fundo</Tag>}
                        {!hasArray && <Tag dim>texto simples</Tag>}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => play(s)}
                      style={{
                        padding: '7px 14px',
                        borderRadius: 7,
                        border: '1px solid rgba(255,200,90,0.35)',
                        background: 'rgba(255,200,90,0.1)',
                        color: '#ffc85a',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      ▶ Ver cena
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {done && (
            <div style={{
              marginTop: 24,
              padding: '12px 16px',
              background: 'rgba(80,220,120,0.08)',
              border: '1px solid rgba(80,220,120,0.2)',
              borderRadius: 8,
              fontSize: 13,
              color: 'rgba(100,220,140,0.8)',
            }}>
              ✓ Cena concluída. Escolha outro estágio para continuar.
            </div>
          )}

          {/* Lang indicator */}
          <div style={{ marginTop: 32, fontSize: 11, color: 'rgba(200,185,230,0.3)' }}>
            Idioma atual: <b style={{ color: 'rgba(200,185,230,0.5)' }}>{lang}</b>
            {' · '}
            <span style={{ color: 'rgba(200,185,230,0.3)' }}>
              Para trocar o idioma, use o seletor no lobby.
            </span>
          </div>
        </div>
      </div>
    </>
  )
}

function Tag({ children, accent, dim }) {
  return (
    <span style={{
      fontSize: 10,
      padding: '2px 7px',
      borderRadius: 4,
      background: accent
        ? 'rgba(255,200,90,0.1)'
        : dim
          ? 'rgba(255,255,255,0.04)'
          : 'rgba(255,255,255,0.06)',
      border: '1px solid',
      borderColor: accent
        ? 'rgba(255,200,90,0.2)'
        : 'rgba(255,255,255,0.09)',
      color: accent ? 'rgba(255,200,90,0.7)' : 'rgba(200,185,230,0.4)',
      letterSpacing: '0.04em',
    }}>
      {children}
    </span>
  )
}

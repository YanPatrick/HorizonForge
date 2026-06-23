import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import '@styles/campaign.css'
import { useT } from '../context/LanguageContext'

const HERO_ICONS = {
  knight: '⚔️', paladin: '🛡️', barbarian: '🪓', mage: '🔮',
  archer: '🏹', assassin: '🗡️', archmage: '✨', healer: '💚',
}

const RANK_MEDAL = ['🥇', '🥈', '🥉']
const TOTAL_CHAPTERS = 2
const CHAPTER_BG = { 1: '/images/campaign/chapter1-bg.jpg', 2: '/images/campaign/chapter2-bg.jpg' }

// lore_pre/lore_post can be a plain string (legacy) or an array of dialogue
// lines (scene/speaker/text per line) — this flattens either shape into a
// single preview string for the campaign detail panel.
function loreToPreview(lore, loreEn, lang) {
  if (Array.isArray(lore)) {
    return lore.map(l => (lang === 'pt-BR' ? l.text : (l.text_en || l.text))).join(' ')
  }
  return lang === 'pt-BR' ? lore : (loreEn || lore)
}

export default function CampaignView({ session, formations, defaultSlot, toast }) {
  const { t, lang } = useT()
  const navigate = useNavigate()
  const [stages, setStages] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [leaderboard, setLeaderboard] = useState([])
  const [chapter, setChapter] = useState(1)
  const [enemyDefs, setEnemyDefs] = useState({})
  const [chapterPlayable, setChapterPlayable] = useState(true)
  const [cutscenesOn, setCutscenesOn] = useState(() => {
    try { return localStorage.getItem('hf_cutscenes_enabled') !== '0' } catch { return true }
  })

  const username = session?.username
  const isGuest = session?.mode === 'guest'

  function toggleCutscenes() {
    const next = !cutscenesOn
    setCutscenesOn(next)
    try { localStorage.setItem('hf_cutscenes_enabled', next ? '1' : '0') } catch {}
  }

  useEffect(() => {
    fetchCampaign(1)
    fetch('/api/campaign/leaderboard')
      .then(r => r.json())
      .then(d => { if (d.ok) setLeaderboard(d.leaderboard) })
      .catch(() => {})
  }, [])

  function changeChapter(n) {
    setChapter(n)
    setSelected(null)
    fetchCampaign(n)
  }

  async function fetchCampaign(ch = chapter) {
    setLoading(true)
    try {
      const base = `/api/campaign?chapter=${ch}`
      const url = username ? `${base}&player=${encodeURIComponent(username)}` : base
      const res = await fetch(url)
      const d = await res.json()
      if (d.ok) {
        setStages(d.stages)
        setChapterPlayable(d.playable !== false)
        if (d.enemyDefs) setEnemyDefs(prev => ({ ...prev, ...d.enemyDefs }))
        setLoading(false)
        return d.stages
      }
    } catch {
      toast?.('⚠️ Could not load campaign data')
    }
    setLoading(false)
    return []
  }

  async function startStage(stageDef) {
    const f = formations?.[defaultSlot]
    const formationHeroIds = f?.hero_ids?.length ? f.hero_ids : null
    if (!formationHeroIds) {
      toast?.('⚠️ No deck selected. Build a formation first!')
      return
    }
    sessionStorage.setItem('hf_battle_cfg', JSON.stringify({
      mode: 'campaign',
      stage: stageDef.stage,
      chapter,
      format: stageDef.format,
      formationHeroIds,
      campaignEnemies: stageDef.enemies,
      enemyDefs,
      lore_pre: stageDef.lore_pre ?? null,
      lore_pre_en: stageDef.lore_pre_en ?? null,
      lore_post: stageDef.lore_post ?? null,
      lore_post_en: stageDef.lore_post_en ?? null,
      wasCompleted: stageDef.completed ?? false,
    }))
    navigate('/battle')
  }

  const selectedStage = stages.find(s => s.stage === selected)

  return (
    <div className="campaign-wrap">
      <div
        className="campaign-bg"
        style={{ backgroundImage: CHAPTER_BG[chapter] ? `url(${CHAPTER_BG[chapter]})` : 'none' }}
      />

      <div className="campaign-layout">
        <div className="campaign-stage-list">

          {/* Chapter navigator */}
          <div className="campaign-chapter-nav">
            <button
              type="button"
              className="campaign-chapter-arrow"
              disabled={chapter <= 1}
              onClick={() => changeChapter(chapter - 1)}
            >‹</button>
            <span className="campaign-chapter-title" style={{ cursor: 'default', margin: '0 4px' }}>
              {lang === 'pt-BR' ? `Capítulo ${chapter}` : `Chapter ${chapter}`}
            </span>
            <button
              type="button"
              className="campaign-chapter-arrow"
              disabled={chapter >= TOTAL_CHAPTERS}
              onClick={() => changeChapter(chapter + 1)}
            >›</button>
          </div>

          {/* Cutscenes on/off */}
          <button
            type="button"
            className="campaign-cutscenes-toggle"
            onClick={toggleCutscenes}
            title={lang === 'pt-BR'
              ? 'Liga/desliga as cenas de diálogo antes e depois das batalhas'
              : 'Toggles dialogue scenes before and after battles'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', margin: '6px 0 10px', padding: '6px 10px',
              borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)',
              background: cutscenesOn ? 'rgba(255,200,90,0.1)' : 'rgba(255,255,255,0.04)',
              color: cutscenesOn ? '#ffc85a' : 'rgba(200,185,230,0.55)',
              cursor: 'pointer', fontSize: 12, fontWeight: 600,
            }}
          >
            <span>🎬 {lang === 'pt-BR' ? 'Cenas' : 'Cutscenes'}</span>
            <span>{cutscenesOn ? (lang === 'pt-BR' ? 'Ativadas' : 'ON') : (lang === 'pt-BR' ? 'Desativadas' : 'OFF')}</span>
          </button>

          {/* Chapter 1 — real content */}
          {loading ? (
            <div className="campaign-loading">{t('campaign.loading')}</div>
          ) : stages.length > 0 ? (
            stages.map(s => (
              <button
                key={s.stage}
                className={[
                  'campaign-stage-item',
                  s.completed ? 'completed' : '',
                  !s.unlocked ? 'locked' : '',
                  selected === s.stage ? 'active' : '',
                ].filter(Boolean).join(' ')}
                disabled={!s.unlocked}
                onClick={() => setSelected(s.stage)}
                type="button"
              >
                <span className="campaign-stage-num">{s.stage}</span>
                <span className="campaign-stage-name">{lang === 'pt-BR' ? s.name : (s.name_en || s.name)}</span>
                <span className="campaign-stage-status">
                  {s.completed ? '✅' : s.unlocked ? '▶' : '🔒'}
                </span>
              </button>
            ))
          ) : (
            <div className="campaign-coming-soon">
              <span className="campaign-cs-lock">🔒</span>
              <span className="campaign-cs-label">
                {lang === 'pt-BR' ? 'Em breve' : 'Coming Soon'}
              </span>
              <span className="campaign-cs-sub">
                {lang === 'pt-BR'
                  ? 'Este capítulo ainda não foi revelado.'
                  : 'This chapter has not been revealed yet.'}
              </span>
            </div>
          )}

          {/* Leaderboard */}
          {leaderboard.length > 0 && (
            <div className="campaign-leaderboard">
              <div className="campaign-lb-title">RANKING</div>
              {leaderboard.map(row => (
                <div
                  key={row.player}
                  className={`campaign-lb-row${row.player === username ? ' campaign-lb-row--me' : ''}`}
                >
                  <span className="campaign-lb-rank">{RANK_MEDAL[row.rank - 1] ?? row.rank}</span>
                  <span className="campaign-lb-name">{row.player}</span>
                  <span className="campaign-lb-pos">{row.chapter}-{row.stage}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedStage && (
          <div className="campaign-detail">
            <div className="campaign-detail-title">{lang === 'pt-BR' ? selectedStage.name : (selectedStage.name_en || selectedStage.name)}</div>
            <div className="campaign-detail-format">
              {selectedStage.format === 3 ? 'BO3' : selectedStage.format === 5 ? 'BO5' : 'BO7'}
            </div>
            <p className="campaign-detail-lore">{loreToPreview(selectedStage.lore_pre, selectedStage.lore_pre_en, lang)}</p>

            <div className="campaign-detail-enemies-label">{t('campaign.enemies')}</div>
            <div className="campaign-detail-enemies">
              {selectedStage.enemies.map((e, i) => (
                <div key={i} className="campaign-enemy-chip">
                  <span className="campaign-enemy-ico">{HERO_ICONS[e.cid] || '⚔️'}</span>
                  <span className="campaign-enemy-name">{enemyDefs[e.cid]?.name || (e.cid.charAt(0).toUpperCase() + e.cid.slice(1))}</span>
                  <span className="campaign-enemy-lv">{e.level ? '★'.repeat(e.level) : ''}</span>
                </div>
              ))}
            </div>

            {!chapterPlayable ? (
              <div className="campaign-detail-done" style={{ opacity: 0.7 }}>
                🔒 {lang === 'pt-BR' ? 'Em breve — este capítulo ainda não está disponível para batalha.' : 'Coming soon — this chapter is not available for battle yet.'}
              </div>
            ) : !selectedStage.unlocked ? (
              <div className="campaign-detail-done" style={{ opacity: 0.7 }}>
                ⚔️ {lang === 'pt-BR' ? 'Vença o desafio anterior para enfrentar esse novo oponente.' : 'Defeat the previous challenge to face this new opponent.'}
              </div>
            ) : selectedStage.completed ? (
              <>
                <div className="campaign-detail-done">{t('campaign.stageCompleted')}</div>
                <button
                  className="campaign-battle-btn"
                  type="button"
                  style={{ opacity: 0.65, marginTop: 8 }}
                  onClick={() => startStage(selectedStage)}
                >
                  {lang === 'pt-BR' ? '⟳ Jogar Novamente' : '⟳ Play Again'}
                </button>
              </>
            ) : (
              <button className="campaign-battle-btn" type="button" onClick={() => startStage(selectedStage)}>
                {t('campaign.battleBtn')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

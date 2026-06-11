import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import '@styles/campaign.css'

const HERO_ICONS = {
  knight: '⚔️', paladin: '🛡️', barbarian: '🪓', mage: '🔮',
  archer: '🏹', assassin: '🗡️', archmage: '✨', healer: '💚',
}

export default function CampaignView({ session, formations, defaultSlot, toast }) {
  const navigate = useNavigate()
  const [stages, setStages] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)

  const username = session?.username
  const isGuest = session?.mode === 'guest'

  useEffect(() => {
    fetchCampaign()
  }, [])

  async function fetchCampaign() {
    setLoading(true)
    try {
      const url = username ? `/api/campaign?player=${encodeURIComponent(username)}` : '/api/campaign'
      const res = await fetch(url)
      const d = await res.json()
      if (d.ok) {
        setStages(d.stages)
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
      format: stageDef.format,
      formationHeroIds,
      campaignEnemies: stageDef.enemies,
    }))
    navigate('/battle')
  }

  const selectedStage = stages.find(s => s.stage === selected)

  return (
    <div className="campaign-wrap">
      <div
        className="campaign-bg"
        style={{ backgroundImage: 'url(/images/campaign/chapter1-bg.jpg)' }}
      />

      <div className="campaign-layout">
        <div className="campaign-stage-list">
          <div className="campaign-chapter-title">Capítulo 1</div>
          {loading ? (
            <div className="campaign-loading">Carregando...</div>
          ) : (
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
                <span className="campaign-stage-name">{s.name}</span>
                <span className="campaign-stage-status">
                  {s.completed ? '✅' : s.unlocked ? '▶' : '🔒'}
                </span>
              </button>
            ))
          )}
        </div>

        {selectedStage && (
          <div className="campaign-detail">
            <div className="campaign-detail-title">{selectedStage.name}</div>
            <div className="campaign-detail-format">
              {selectedStage.format === 3 ? 'BO3' : selectedStage.format === 5 ? 'BO5' : 'BO7'}
            </div>
            <p className="campaign-detail-lore">{selectedStage.lore_pre}</p>

            <div className="campaign-detail-enemies-label">Inimigos</div>
            <div className="campaign-detail-enemies">
              {selectedStage.enemies.map((e, i) => (
                <div key={i} className="campaign-enemy-chip">
                  <span className="campaign-enemy-ico">{HERO_ICONS[e.cid] || '⚔️'}</span>
                  <span className="campaign-enemy-name">
                    {e.cid.charAt(0).toUpperCase() + e.cid.slice(1)}
                  </span>
                  <span className="campaign-enemy-lv">{'★'.repeat(e.level)}</span>
                </div>
              ))}
            </div>

            {selectedStage.completed ? (
              <div className="campaign-detail-done">✅ Estágio concluído</div>
            ) : (
              <button
                className="campaign-battle-btn"
                type="button"
                onClick={() => startStage(selectedStage)}
              >
                ⚔️ Batalhar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

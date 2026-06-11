import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/index.css'
import { getSession } from '../lib/session'
import { useT } from '../context/LanguageContext'

const GUEST_PREFIXES = ['Iron', 'Shadow', 'Storm', 'Void', 'Flame', 'Frost', 'Dark', 'Swift', 'Brave', 'Wild']
const GUEST_CLASSES  = ['Knight', 'Mage', 'Archer', 'Paladin', 'Hunter', 'Rogue', 'Sage', 'Blade']
function randomGuestName() {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
  return `${pick(GUEST_PREFIXES)}_${pick(GUEST_CLASSES)}_${Math.floor(Math.random() * 900) + 100}`
}

export default function LoginPage() {
  const { t } = useT()
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [username, setUsername] = useState('')
  const [err, setErr] = useState('')
  const [showKcWarn, setShowKcWarn] = useState(false)

  useEffect(() => {
    if (getSession()) navigate('/lobby', { replace: true })
  }, [navigate])

  async function doLogin() {
    setErr('')
    const raw = username.trim()
    if (!raw) { setErr(t('login.errEnterUser')); return }
    const user = raw.toLowerCase()

    if (typeof window.hive_keychain === 'undefined') {
      setShowKcWarn(true)
      setErr(t('login.errKcNotFound'))
      return
    }
    setShowKcWarn(false)

    let nonce
    try {
      const cr = await fetch('/api/auth/challenge')
      if (!cr.ok) { setErr(t('login.errCouldNotStart')); return }
      ;({ nonce } = await cr.json())
    } catch {
      setErr(t('login.errNetwork'))
      return
    }

    const memo = `horizon-forge-login-${nonce}`
    window.hive_keychain.requestSignBuffer(user, memo, 'Posting', async (resp) => {
      if (!resp.success) { setErr(resp.message || t('login.errCancelled')); return }
      try {
        const body = JSON.stringify({ username: user, memo, signature: resp.result })
        const fetchOpts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
        let r
        try {
          r = await fetch('/api/auth/verify', fetchOpts)
        } catch {
          await new Promise(res => setTimeout(res, 1500))
          r = await fetch('/api/auth/verify', fetchOpts)
        }
        const data = await r.json()
        if (!r.ok || !data.token) { setErr(data.error || t('login.errServer')); return }
        sessionStorage.setItem('hf_session', JSON.stringify({ username: user, mode: 'hive', ts: Date.now(), token: data.token }))
        navigate('/lobby')
      } catch {
        setErr(t('login.errNetwork'))
      }
    })
  }

  function doGuest() {
    localStorage.setItem('hf_session', JSON.stringify({ username: randomGuestName(), mode: 'guest', ts: Date.now() }))
    navigate('/lobby')
  }

  return (
    <div className="page">
      <div className="card">
        <div className="logo">
          <span className="logo-ico">⚔️</span>
          <h1 className="logo-name">HORIZON FORGE</h1>
          <p className="logo-tag">{t('login.tagline')}</p>
        </div>

        <button className="btn-guest" onClick={doGuest}>{t('login.playGuest')}</button>
        <p className="guest-hint">{t('login.noAccount')}</p>

        <div className="or-div"><span>{t('login.or')}</span></div>

        <label className="field-lbl" htmlFor="hive-user">{t('login.hiveUsername')}</label>
        <div className="input-row">
          <span className="input-at">@</span>
          <input
            ref={inputRef}
            id="hive-user"
            type="text"
            placeholder="your-username"
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="none"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doLogin()}
          />
        </div>
        <span className="err-msg">{err}</span>

        <button className="btn-kc" onClick={doLogin}>
          {t('login.enterKeychain')}
        </button>

        {showKcWarn && (
          <div className="kc-warn show">
            {t('login.kcNotDetected')}<br />
            <a href="https://hive-keychain.com" target="_blank" rel="noreferrer">
              {t('login.installExt')}
            </a>
          </div>
        )}

        <div className="card-foot">
          <a href="https://hive-keychain.com" target="_blank" rel="noreferrer">
            {t('login.noKeychain')}
          </a>
          <a href="https://peakd.com/register?ref=shiftrox" target="_blank" rel="noreferrer">
            {t('login.newToHive')}
          </a>
        </div>
      </div>
    </div>
  )
}

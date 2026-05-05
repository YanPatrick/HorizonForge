import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/index.css'
import { getSession } from '../lib/session'

export default function LoginPage() {
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
    if (!raw) { setErr('Please enter your Hive username.'); return }
    const user = raw.toLowerCase()

    if (typeof window.hive_keychain === 'undefined') {
      setShowKcWarn(true)
      setErr('Hive Keychain extension not found.')
      return
    }
    setShowKcWarn(false)

    // Fetch a one-shot server nonce before asking Keychain to sign.
    // This prevents replay attacks: the nonce is deleted on first use server-side.
    let nonce
    try {
      const cr = await fetch('/api/auth/challenge')
      if (!cr.ok) { setErr('Could not start login. Please try again.'); return }
      ;({ nonce } = await cr.json())
    } catch {
      setErr('Network error. Please try again.')
      return
    }

    const memo = `horizon-forge-login-${nonce}`
    window.hive_keychain.requestSignBuffer(user, memo, 'Posting', async (resp) => {
      if (!resp.success) { setErr(resp.message || 'Login cancelled or failed.'); return }
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
        if (!r.ok || !data.token) { setErr(data.error || 'Server verification failed.'); return }
        sessionStorage.setItem('hf_session', JSON.stringify({ username: user, mode: 'hive', ts: Date.now(), token: data.token }))
        navigate('/lobby')
      } catch {
        setErr('Network error. Please try again.')
      }
    })
  }

  function doGuest() {
    sessionStorage.setItem('hf_session', JSON.stringify({ username: 'guest', mode: 'guest', ts: Date.now() }))
    navigate('/lobby')
  }

  return (
    <div className="page">
      <div className="card">
        <div className="logo">
          <span className="logo-ico">⚔️</span>
          <h1 className="logo-name">HORIZON FORGE</h1>
          <p className="logo-tag">A Fantasy Auto-Battler on the Hive Blockchain</p>
        </div>

        <label className="field-lbl" htmlFor="hive-user">Hive Username</label>
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
          Enter with Hive Keychain
        </button>

        {showKcWarn && (
          <div className="kc-warn show">
            Hive Keychain not detected.<br />
            <a href="https://hive-keychain.com" target="_blank" rel="noreferrer">
              Install the browser extension →
            </a>
          </div>
        )}

        <div className="or-div"><span>or</span></div>

        <button className="btn-guest" onClick={doGuest}>Play as Guest</button>

        <div className="card-foot">
          <a href="https://hive-keychain.com" target="_blank" rel="noreferrer">
            Don't have Hive Keychain? Install it
          </a>
          <a href="https://peakd.com/register?ref=shiftrox" target="_blank" rel="noreferrer">
            New to Hive? Create a free account
          </a>
        </div>
      </div>
    </div>
  )
}

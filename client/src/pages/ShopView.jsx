import { useState, useEffect } from 'react'
import '@styles/shop.css'

const FILTERS = [
  { key: 'all',        label: 'Todos' },
  { key: 'background', label: '🌄 Backgrounds' },
  { key: 'skin',       label: '✨ Skins' },
  { key: 'owned',      label: '✓ Possuídos' },
]

export default function ShopView({ session, toast }) {
  const [catalog, setCatalog]         = useState([])
  const [owned, setOwned]             = useState(new Set())
  const [gameAccount, setGameAccount] = useState('')
  const [filter, setFilter]           = useState('all')
  const [modal, setModal]             = useState(null)
  const [claiming, setClaiming]       = useState(null)
  const [modalError, setModalError]   = useState('')

  const isHive   = session?.mode === 'hive'
  const token    = session?.token
  const username = session?.username

  useEffect(() => {
    fetch('/api/shop')
      .then(r => r.json())
      .then(d => { setCatalog(d.items || []); setGameAccount(d.gameAccount || '') })
      .catch(() => {})

    if (isHive && token) {
      fetch('/api/shop/owned', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => setOwned(new Set(d.owned || [])))
        .catch(() => {})
    }
  }, [isHive, token])

  const filtered = catalog.filter(item => {
    if (filter === 'owned')      return owned.has(item.id)
    if (filter === 'all')        return true
    return item.type === filter
  })

  async function claimFree(item) {
    setClaiming(item.id)
    try {
      const res = await fetch('/api/shop/verify-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ item_id: item.id }),
      }).then(r => r.json())
      if (res.ok) {
        setOwned(prev => new Set([...prev, item.id]))
        toast?.(`${item.name} adquirido!`)
      } else {
        toast?.('Erro ao obter item.')
      }
    } catch {
      toast?.('Erro de rede.')
    } finally {
      setClaiming(null)
    }
  }

  function openModal(item) {
    setModal(item)
    setModalError('')
  }

  async function confirmBuy() {
    if (!modal) return
    if (!window.hive_keychain) {
      setModalError('Hive Keychain não encontrado.')
      return
    }
    setModalError('')
    window.hive_keychain.requestTransfer(
      username,
      gameAccount,
      modal.price_hive.toFixed(3),
      `shop_${modal.id}`,
      'HIVE',
      async (response) => {
        if (!response.success) {
          setModalError(response.error || 'Transferência cancelada.')
          return
        }
        setClaiming(modal.id)
        try {
          const res = await fetch('/api/shop/verify-purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ item_id: modal.id }),
          }).then(r => r.json())
          if (res.ok) {
            setOwned(prev => new Set([...prev, modal.id]))
            toast?.(`${modal.name} adquirido!`)
            setModal(null)
          } else {
            setModalError('Pagamento não confirmado. Tente novamente.')
          }
        } catch {
          setModalError('Erro de rede ao verificar pagamento.')
        } finally {
          setClaiming(null)
        }
      }
    )
  }

  return (
    <div id="view-shop" className="lv active">
      <div className="wiki-layout">
        {/* PC sidebar */}
        <aside className="wiki-sidebar">
          <div className="wiki-category">Categoria</div>
          {FILTERS.map(f => (
            <button
              key={f.key}
              className={`wiki-item${filter === f.key ? ' active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </aside>

        <div className="wiki-content shop-content">
          {/* Mobile pills (visíveis apenas em mobile via CSS) */}
          <div className="shop-mobile-filters">
            {FILTERS.map(f => (
              <button
                key={f.key}
                className={`shop-pill${filter === f.key ? ' active' : ''}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* PC: grid de cards */}
          <div className="shop-grid">
            {filtered.map(item => (
              <ShopItemCard
                key={item.id}
                item={item}
                isOwned={owned.has(item.id)}
                isHive={isHive}
                isClaiming={claiming === item.id}
                onBuy={() => item.price_hive === 0 ? claimFree(item) : openModal(item)}
              />
            ))}
            {filtered.length === 0 && <div className="shop-empty">Nenhum item encontrado.</div>}
          </div>

          {/* Mobile: lista vertical */}
          <div className="shop-list">
            {filtered.map(item => (
              <ShopListRow
                key={item.id}
                item={item}
                isOwned={owned.has(item.id)}
                isHive={isHive}
                isClaiming={claiming === item.id}
                onBuy={() => item.price_hive === 0 ? claimFree(item) : openModal(item)}
              />
            ))}
            {filtered.length === 0 && <div className="shop-empty">Nenhum item encontrado.</div>}
          </div>
        </div>
      </div>

      {/* Modal de compra paga */}
      {modal && (
        <div className="shop-modal-overlay" onClick={() => !claiming && setModal(null)}>
          <div className="shop-modal" onClick={e => e.stopPropagation()}>
            <div
              className="shop-modal-preview"
              style={{ backgroundImage: `url(${modal.preview})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            />
            <div className="shop-modal-body">
              <div className="shop-modal-name">{modal.name}</div>
              <div className="shop-modal-price">{modal.price_hive.toFixed(3)} HIVE</div>
              <div className="shop-modal-tos">
                Este é um cosmético digital não transferível e sem valor de revenda. Compras são definitivas.
              </div>
              {modalError && <div className="shop-modal-error">{modalError}</div>}
              <div className="shop-modal-actions">
                <button
                  className="shop-btn-cancel"
                  onClick={() => setModal(null)}
                  disabled={!!claiming}
                >
                  Cancelar
                </button>
                <button
                  className="shop-btn-confirm"
                  onClick={confirmBuy}
                  disabled={!!claiming}
                >
                  {claiming ? '⌛ Verificando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ShopItemCard({ item, isOwned, isHive, isClaiming, onBuy }) {
  const isFree   = item.price_hive === 0
  const disabled = isOwned || isClaiming || !isHive
  return (
    <div className={`shop-card${isOwned ? ' shop-card-owned' : ''}`}>
      <div
        className="shop-card-preview"
        style={{ backgroundImage: `url(${item.preview})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      />
      <div className="shop-card-body">
        <div className="shop-card-name">{item.name}</div>
        {isOwned
          ? <div className="shop-card-owned-badge">✓ Possuído</div>
          : <div className="shop-card-price">{isFree ? 'Grátis' : `${item.price_hive} HIVE`}</div>
        }
        <button
          className={`shop-card-btn${isOwned ? ' owned' : isFree ? ' free' : ' buy'}`}
          disabled={disabled}
          onClick={onBuy}
          title={!isHive ? 'Faça login com Hive Keychain para obter cosméticos.' : undefined}
        >
          {isClaiming ? '⌛' : isOwned ? 'Possuído' : isFree ? 'Obter Grátis' : 'Comprar'}
        </button>
      </div>
    </div>
  )
}

function ShopListRow({ item, isOwned, isHive, isClaiming, onBuy }) {
  const isFree   = item.price_hive === 0
  const disabled = isOwned || isClaiming || !isHive
  return (
    <div className={`shop-row${isOwned ? ' shop-row-owned' : ''}`}>
      <div
        className="shop-row-preview"
        style={{ backgroundImage: `url(${item.preview})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      />
      <div className="shop-row-info">
        <div className="shop-row-name">{item.name}</div>
        <div className="shop-row-type">{item.type === 'background' ? 'Background' : 'Skin'}</div>
      </div>
      <div className="shop-row-right">
        {isOwned
          ? <div className="shop-owned-text">✓ Possuído</div>
          : <div className="shop-row-price">{isFree ? 'Grátis' : `${item.price_hive} HIVE`}</div>
        }
        <button
          className={`shop-row-btn${isOwned ? ' owned' : isFree ? ' free' : ' buy'}`}
          disabled={disabled}
          onClick={onBuy}
          title={!isHive ? 'Faça login com Hive Keychain para obter cosméticos.' : undefined}
        >
          {isClaiming ? '⌛' : isOwned ? '✓' : isFree ? 'Obter' : 'Comprar'}
        </button>
      </div>
    </div>
  )
}

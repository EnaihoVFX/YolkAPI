import { useEffect, useState } from 'react'

const KEY = 'realpay_settings_v1'
type Settings = { payoutAddress?: string; businessName?: string; apiKey?: string; wallet?: string }

export function Settings() {
  const [s, setS] = useState<Settings>(() => {
    try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : {} } catch { return {} }
  })
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(s)) }, [s])

  return (
    <section>
      <h1>Settings / ID Management</h1>
      <div className="card">
        <div className="form" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <label>
            Business name
            <input value={s.businessName || ''} onChange={(e) => setS({ ...s, businessName: e.target.value })} placeholder="Acme Inc." />
          </label>
          <label>
            Payout address
            <input value={s.payoutAddress || ''} onChange={(e) => setS({ ...s, payoutAddress: e.target.value })} placeholder="ccd1..." />
          </label>
          <label>
            Linked wallet
            <input value={s.wallet || ''} onChange={(e) => setS({ ...s, wallet: e.target.value })} placeholder="Wallet name or address" />
          </label>
          <label>
            API key
            <input value={s.apiKey || ''} onChange={(e) => setS({ ...s, apiKey: e.target.value })} placeholder="sk_live_..." />
          </label>
        </div>
      </div>
    </section>
  )
}





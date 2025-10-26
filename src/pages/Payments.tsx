import { useMemo, useState } from 'react'
import QRCode from 'react-qr-code'
import { Badge, Table } from '../components/UI'
import { KEYS, PayTag, Payment, loadArray, saveArray } from '../lib/storage'

export function Payments() {
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [itemId, setItemId] = useState('')

  const payTags = loadArray<PayTag>(KEYS.payTags)
  const payments = loadArray<Payment>(KEYS.payments)

  const payload = useMemo(() => JSON.stringify({ amount, description, itemId, type: 'PayTag' }), [amount, description, itemId])

  function createPayTag() {
    const tag: PayTag = {
      id: crypto.randomUUID(),
      amount: Number(amount || 0),
      description: description || undefined,
      itemId: itemId || undefined,
      createdAtIso: new Date().toISOString(),
      status: 'active',
      jwsPayload: payload, // Placeholder for JWS-signed payload
    }
    const next = [tag, ...payTags]
    saveArray(KEYS.payTags, next)
  }

  return (
    <section>
      <h1>Payments & QR Codes</h1>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <div className="card">
          <div className="label">Create PayTag</div>
          <div className="form" style={{ gridTemplateColumns: '1fr' }}>
            <label>
              Amount (PLT)
              <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </label>
            <label>
              Description
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Payment for order #..." />
            </label>
            <label>
              Item/Order ID (optional)
              <input type="text" value={itemId} onChange={(e) => setItemId(e.target.value)} placeholder="SKU-123" />
            </label>
            <div>
              <button onClick={createPayTag}>Generate</button>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="label">QR Preview</div>
          <div className="qr-wrap" style={{ alignSelf: 'start' }}>
            <QRCode value={payload} size={192} />
            <div className="qr-caption">Signed JWS payload</div>
          </div>
        </div>
        <div className="card">
          <div className="label" style={{ marginBottom: 8 }}>Active PayTags</div>
          <div className="list">
            {payTags.slice(0,5).map((t) => (
              <div key={t.id} className="item">
                <div className="row">
                  <div>#{t.id.slice(0,6)} · {t.description || '—'}</div>
                  <Badge color={t.status === 'paid' ? 'green' : t.status === 'expired' ? 'yellow' : 'blue'}>{t.status}</Badge>
                </div>
                <div className="row">
                  <div className="amount">{t.amount.toFixed(2)} PLT</div>
                  <div className="date">{new Date(t.createdAtIso).toLocaleString()}</div>
                </div>
              </div>
            ))}
            {payTags.length === 0 && <div className="empty">No PayTags yet.</div>}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div className="row" style={{ alignItems: 'center' }}>
          <h1 style={{ margin: 0 }}>Transaction History</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <Badge>All</Badge>
            <Badge color="green">Confirmed</Badge>
            <Badge color="yellow">Pending</Badge>
            <Badge color="red">Failed</Badge>
          </div>
        </div>
        <Table
          headers={["Payer Hash", "Amount (PLT)", "Status", "Time", "Explorer", "Receipt"]}
          rows={payments.map((p) => [
            p.payerHash,
            p.amount.toFixed(2),
            <Badge color={p.status === 'confirmed' ? 'green' : p.status === 'pending' ? 'yellow' : 'red'}>{p.status}</Badge>,
            new Date(p.createdAtIso).toLocaleString(),
            p.txUrl ? <a className="link" href={p.txUrl} target="_blank" rel="noreferrer">View</a> : '-',
            p.receiptId || '-'
          ])}
        />
      </div>
    </section>
  )
}





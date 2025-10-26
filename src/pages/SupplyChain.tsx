import { useState } from 'react'
import { Badge } from '../components/UI'
import { KEYS, SupplyBatch, loadArray, saveArray } from '../lib/storage'

export function SupplyChain() {
  const [batchId, setBatchId] = useState('')
  const [sku, setSku] = useState('')
  const [quantity, setQuantity] = useState('')
  const [metadataName, setMetadataName] = useState('')

  const batches = loadArray<SupplyBatch>(KEYS.batches)

  function addBatch() {
    const b: SupplyBatch = {
      id: crypto.randomUUID(),
      batchId,
      sku,
      quantity: Number(quantity || 0),
      metadataName: metadataName || undefined,
      timeline: [
        { id: crypto.randomUUID(), label: 'Registered', timeIso: new Date().toISOString(), txUrl: 'https://ccdscan.io/' },
      ],
      createdAtIso: new Date().toISOString(),
    }
    saveArray(KEYS.batches, [b, ...batches])
  }

  return (
    <section>
      <h1>Supply Chain Tracker</h1>
      <div className="card">
        <div className="label">Register new product batch</div>
        <div className="form" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          <label>
            Batch ID
            <input value={batchId} onChange={(e) => setBatchId(e.target.value)} placeholder="BATCH-001" />
          </label>
          <label>
            SKU
            <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="SKU-123" />
          </label>
          <label>
            Quantity
            <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="100" />
          </label>
          <label>
            Metadata filename
            <input value={metadataName} onChange={(e) => setMetadataName(e.target.value)} placeholder="meta.json" />
          </label>
        </div>
        <div style={{ marginTop: 8 }}>
          <button onClick={addBatch}>Create</button>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div className="label" style={{ marginBottom: 8 }}>Batches</div>
        <div className="list">
          {batches.map((b) => (
            <div key={b.id} className="item">
              <div className="row">
                <div>{b.batchId} · {b.sku} · {b.quantity} units</div>
                <Badge color="blue">{b.timeline[b.timeline.length - 1]?.label}</Badge>
              </div>
              <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                {b.timeline.map((t) => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div className="date">{new Date(t.timeIso).toLocaleString()}</div>
                    <a className="link" href={t.txUrl} target="_blank" rel="noreferrer">{t.label}</a>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {batches.length === 0 && <div className="empty">No batches yet.</div>}
        </div>
      </div>
    </section>
  )
}



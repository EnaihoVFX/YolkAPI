import { useState } from 'react'
import QRCode from 'react-qr-code'
import { Badge } from '../components/UI'
import { KEYS, ProofTag, loadArray, saveArray } from '../lib/storage'

export function ProofTags() {
  const [jobName, setJobName] = useState('')
  const [workerId, setWorkerId] = useState('')
  const [location, setLocation] = useState('')
  const [payout, setPayout] = useState('')

  const tags = loadArray<ProofTag>(KEYS.proofTags)

  const payload = JSON.stringify({ jobName, workerId, location, payout, type: 'ProofTag' })

  function createTag() {
    const tag: ProofTag = {
      id: crypto.randomUUID(),
      jobName,
      workerId,
      location: location || undefined,
      payout: Number(payout || 0),
      status: 'unscanned',
      createdAtIso: new Date().toISOString(),
    }
    saveArray(KEYS.proofTags, [tag, ...tags])
  }

  return (
    <section>
      <h1>ProofTags</h1>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card">
          <div className="label">Create ProofTag</div>
          <div className="form" style={{ gridTemplateColumns: '1fr' }}>
            <label>
              Job name
              <input value={jobName} onChange={(e) => setJobName(e.target.value)} placeholder="Inspection A" />
            </label>
            <label>
              Worker ID
              <input value={workerId} onChange={(e) => setWorkerId(e.target.value)} placeholder="WRK-001" />
            </label>
            <label>
              Location (optional)
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="GPS/Address" />
            </label>
            <label>
              Payout (PLT)
              <input type="number" step="0.01" value={payout} onChange={(e) => setPayout(e.target.value)} placeholder="0.00" />
            </label>
            <div><button onClick={createTag}>Generate</button></div>
          </div>
        </div>
        <div className="card">
          <div className="label">QR Preview</div>
          <div className="qr-wrap" style={{ alignSelf: 'start' }}>
            <QRCode value={payload} size={192} />
            <div className="qr-caption">Signed payload</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div className="label" style={{ marginBottom: 8 }}>Recent ProofTags</div>
        <div className="list">
          {tags.map((t) => (
            <div key={t.id} className="item">
              <div className="row">
                <div>{t.jobName} · {t.workerId}</div>
                <Badge color={t.status === 'paid' ? 'green' : t.status === 'verified' ? 'blue' : 'yellow'}>{t.status}</Badge>
              </div>
              <div className="row">
                <div className="amount">{t.payout.toFixed(2)} PLT</div>
                <div className="date">{new Date(t.createdAtIso).toLocaleString()}</div>
              </div>
            </div>
          ))}
          {tags.length === 0 && <div className="empty">No tags yet.</div>}
        </div>
      </div>
    </section>
  )
}





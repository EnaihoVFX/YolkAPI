import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { registerBatch } from '../lib/api'

export function RegisterBatch() {
  const navigate = useNavigate()
  const [newBatches, setNewBatches] = useState<Array<{ id: string; batchId: string; sku: string; quantity: number; weight: number; value: number }>>([])
  const [currentBatch, setCurrentBatch] = useState({ batchId: '', sku: '', quantity: 0, weight: 0, value: 0 })
  const [loading, setLoading] = useState(false)

  const handleAddBatch = () => {
    if (!currentBatch.sku.trim()) return
    
    const batch = {
      id: crypto.randomUUID(),
      batchId: currentBatch.batchId.trim() || `BATCH-${String(Date.now()).slice(-6)}`,
      sku: currentBatch.sku.trim(),
      quantity: currentBatch.quantity || 1,
      weight: currentBatch.weight || 1,
      value: currentBatch.value || 100
    }
    setNewBatches([...newBatches, batch])
    setCurrentBatch({ batchId: '', sku: '', quantity: 0, weight: 0, value: 0 })
  }

  const handleRemoveBatch = (id: string) => {
    setNewBatches(newBatches.filter(b => b.id !== id))
  }

  const handleRegisterBatches = async () => {
    if (newBatches.length === 0) return
    
    setLoading(true)
    try {
      // Register each batch on-chain
      for (const batch of newBatches) {
        const result = await registerBatch(batch.batchId, batch.sku, batch.quantity, batch.weight, batch.value)
        console.log(`Batch ${batch.batchId} registered:`, result)
        console.log(`✅ Batch ${batch.batchId} registered on Concordium blockchain`)
      }
      
      // Reset form
      setNewBatches([])
      setCurrentBatch({ batchId: '', sku: '', quantity: 0, weight: 0, value: 0 })
      
      // Navigate back to overview
      navigate('/overview')
    } catch (error) {
      console.error('Failed to register batches:', error)
      alert('Failed to register batches. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section aria-label="Register Batches">
      <div className="topbar-gap" />

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
          <button 
            onClick={() => navigate('/overview')}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8, 
              padding: '8px 12px', 
              background: '#f3f4f6', 
              border: '1px solid var(--border)', 
              borderRadius: 8, 
              cursor: 'pointer',
              fontSize: 14
            }}
          >
            <ArrowLeft size={16} />
            Back to Overview
          </button>
        </div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, color: '#111827' }}>Register Batches On-Chain</h1>
        <p style={{ margin: '8px 0 0', color: '#6b7280', fontSize: 16 }}>Create and register new batches on the Concordium blockchain</p>
      </div>

      <div className="card" style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Quick Add Presets */}
        <div style={{ marginBottom: 24, padding: 16, background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0369a1', marginBottom: 12 }}>Quick Add Common Batches:</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { name: 'Electronics', sku: 'ELEC', weight: 15, value: 2500 },
              { name: 'Medical', sku: 'MED', weight: 8, value: 1800 },
              { name: 'Textiles', sku: 'TEXT', weight: 12, value: 1200 },
              { name: 'Food', sku: 'FOOD', weight: 5, value: 800 },
              { name: 'Auto Parts', sku: 'AUTO', weight: 25, value: 3500 }
            ].map((preset, index) => (
              <button
                key={index}
                onClick={() => {
                  const batchId = `${preset.sku}-${String(Date.now()).slice(-6)}`
                  setCurrentBatch({
                    batchId,
                    sku: preset.sku,
                    quantity: 10 + Math.floor(Math.random() * 40),
                    weight: preset.weight,
                    value: preset.value
                  })
                }}
                style={{ 
                  padding: '8px 16px', 
                  background: '#e0f2fe', 
                  color: '#0369a1', 
                  border: '1px solid #bae6fd', 
                  borderRadius: 6, 
                  cursor: 'pointer', 
                  fontSize: 12,
                  fontWeight: 500
                }}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        {/* Batch Input Form */}
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, marginBottom: 12, color: '#374151' }}>Add New Batch</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 12 }}>
            <div>
              <input
                type="text"
                placeholder="Batch ID (auto-generated)"
                value={currentBatch.batchId}
                onChange={(e) => setCurrentBatch({ ...currentBatch, batchId: e.target.value })}
                style={{ padding: 8, border: '1px solid var(--border)', borderRadius: 4, fontSize: 12, width: '100%' }}
              />
              <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>Leave empty for auto-generation</div>
            </div>
            <div>
              <input
                type="text"
                placeholder="SKU"
                value={currentBatch.sku}
                onChange={(e) => setCurrentBatch({ ...currentBatch, sku: e.target.value })}
                style={{ padding: 8, border: '1px solid var(--border)', borderRadius: 4, fontSize: 12, width: '100%' }}
              />
              <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>Product code</div>
            </div>
            <div>
              <input
                type="number"
                placeholder="Quantity"
                value={currentBatch.quantity || ''}
                onChange={(e) => setCurrentBatch({ ...currentBatch, quantity: Number(e.target.value) || 0 })}
                style={{ padding: 8, border: '1px solid var(--border)', borderRadius: 4, fontSize: 12, width: '100%' }}
              />
              <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>Items in batch</div>
            </div>
            <div>
              <input
                type="number"
                placeholder="Weight (kg)"
                value={currentBatch.weight || ''}
                onChange={(e) => setCurrentBatch({ ...currentBatch, weight: Number(e.target.value) || 0 })}
                style={{ padding: 8, border: '1px solid var(--border)', borderRadius: 4, fontSize: 12, width: '100%' }}
              />
              <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>Total weight</div>
            </div>
            <div>
              <input
                type="number"
                placeholder="Value (£)"
                value={currentBatch.value || ''}
                onChange={(e) => setCurrentBatch({ ...currentBatch, value: Number(e.target.value) || 0 })}
                style={{ padding: 8, border: '1px solid var(--border)', borderRadius: 4, fontSize: 12, width: '100%' }}
              />
              <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>Total value</div>
            </div>
            <button
              onClick={handleAddBatch}
              disabled={!currentBatch.sku.trim()}
              style={{ 
                padding: 8, 
                background: currentBatch.sku.trim() ? '#3b82f6' : '#d1d5db', 
                color: 'white', 
                border: 'none', 
                borderRadius: 4, 
                cursor: currentBatch.sku.trim() ? 'pointer' : 'not-allowed', 
                fontSize: 12,
                height: 'fit-content'
              }}
            >
              Add
            </button>
          </div>
        </div>

        {/* Batches List */}
        {newBatches.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, marginBottom: 12, color: '#374151' }}>Batches to Register ({newBatches.length})</h3>
            <div style={{ maxHeight: 300, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
              {newBatches.map((batch) => (
                <div key={batch.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                    <span className="mono">{batch.batchId}</span>
                    <span>{batch.sku}</span>
                    <span>Qty: {batch.quantity}</span>
                    <span>Weight: {batch.weight}kg</span>
                    <span>Value: £{batch.value}</span>
                  </div>
                  <button
                    onClick={() => handleRemoveBatch(batch.id)}
                    style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontSize: 10 }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Blockchain Status */}
        <div style={{ 
          background: '#dbeafe', 
          border: '1px solid #3b82f6', 
          borderRadius: 8, 
          padding: 12, 
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <div style={{ fontSize: 14, color: '#1e40af' }}>
            <strong>🔗 Blockchain Status:</strong> Connected to <strong>CONCORDIUM</strong> blockchain. 
            <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.8 }}>
              All operations are processed on the Concordium blockchain network.
            </span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={() => navigate('/overview')}
            style={{ padding: '12px 24px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleRegisterBatches}
            disabled={newBatches.length === 0 || loading}
            style={{ 
              padding: '12px 24px', 
              background: (newBatches.length === 0 || loading) ? '#d1d5db' : '#3b82f6', 
              color: 'white', 
              border: 'none', 
              borderRadius: 8, 
              cursor: (newBatches.length === 0 || loading) ? 'not-allowed' : 'pointer' 
            }}
          >
            {loading ? 'Registering...' : `Register ${newBatches.length} Batches On-Chain`}
          </button>
        </div>
      </div>
    </section>
  )
}

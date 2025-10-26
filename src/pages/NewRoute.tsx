import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, X, Plus, Trash2 } from 'lucide-react'
import { createRoute, fetchShipments } from '../lib/api'

export function NewRoute() {
  const navigate = useNavigate()
  const [newRouteName, setNewRouteName] = useState('')
  const [selectedBatches, setSelectedBatches] = useState<Array<{ id: string; batchId: string; sku: string; quantity: number; weight: number; value: number }>>([])
  const [availableBatches, setAvailableBatches] = useState<Array<{ id: string; batchId: string; sku: string; quantity: number; weight: number; value: number }>>([])
  const [loading, setLoading] = useState(false)

  // Load available batches from shipments
  useEffect(() => {
    const collectAvailableBatches = async () => {
      try {
        const shipments = await fetchShipments()
        const allBatches: Array<{ id: string; batchId: string; sku: string; quantity: number; weight: number; value: number }> = []
        shipments.forEach(shipment => {
          if (shipment.batches) {
            shipment.batches.forEach(batch => {
              allBatches.push(batch)
            })
          }
        })
        setAvailableBatches(allBatches)
      } catch (error) {
        console.error('Failed to load batches:', error)
      }
    }
    collectAvailableBatches()
  }, [])

  const handleSelectBatch = (batch: { id: string; batchId: string; sku: string; quantity: number; weight: number; value: number }) => {
    if (!selectedBatches.find(b => b.id === batch.id)) {
      setSelectedBatches([...selectedBatches, batch])
    }
  }

  const handleRemoveSelectedBatch = (id: string) => {
    setSelectedBatches(selectedBatches.filter(b => b.id !== id))
  }

  const handleCreateRoute = async () => {
    if (!newRouteName.trim() || selectedBatches.length === 0) return
    
    setLoading(true)
    try {
      await createRoute(newRouteName, selectedBatches)
      navigate('/overview')
    } catch (error) {
      console.error('Failed to create route:', error)
      alert('Failed to create route. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section aria-label="Create New Route">
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
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, color: '#111827' }}>Create New Route</h1>
        <p style={{ margin: '8px 0 0', color: '#6b7280', fontSize: 16 }}>Select existing batches to create a new delivery route</p>
      </div>

      <div className="card" style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Route Name */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#374151' }}>
            Route Name
          </label>
          <input
            type="text"
            value={newRouteName}
            onChange={(e) => setNewRouteName(e.target.value)}
            placeholder="Enter route name"
            style={{ width: '100%', padding: 12, border: '1px solid var(--border)', borderRadius: 8, fontSize: 14 }}
          />
        </div>

        {/* Available Batches */}
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, marginBottom: 12, color: '#374151' }}>Select Existing Batches</h3>
          
          {availableBatches.length > 0 ? (
            <div style={{ maxHeight: 400, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
              {availableBatches.map((batch) => (
                <div key={batch.id} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  padding: 12, 
                  borderBottom: '1px solid #f3f4f6',
                  background: selectedBatches.find(b => b.id === batch.id) ? '#f0f9ff' : 'transparent'
                }}>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, flex: 1 }}>
                    <span className="mono" style={{ fontWeight: 600 }}>{batch.batchId}</span>
                    <span>{batch.sku}</span>
                    <span>Qty: {batch.quantity}</span>
                    <span>Weight: {batch.weight}kg</span>
                    <span>Value: £{batch.value}</span>
                  </div>
                  <button
                    onClick={() => selectedBatches.find(b => b.id === batch.id) ? handleRemoveSelectedBatch(batch.id) : handleSelectBatch(batch)}
                    style={{ 
                      padding: '6px 12px', 
                      background: selectedBatches.find(b => b.id === batch.id) ? '#ef4444' : '#3b82f6', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: 4, 
                      cursor: 'pointer', 
                      fontSize: 11 
                    }}
                  >
                    {selectedBatches.find(b => b.id === batch.id) ? 'Remove' : 'Add'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: 20, textAlign: 'center', color: '#6b7280', background: '#f9fafb', borderRadius: 8, border: '1px solid var(--border)' }}>
              No existing batches found. Create some batches first using "Register Batch".
            </div>
          )}

          {selectedBatches.length > 0 && (
            <div style={{ marginTop: 16, padding: 12, background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#0369a1', marginBottom: 8 }}>Selected Batches ({selectedBatches.length}):</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {selectedBatches.map((batch) => (
                  <span key={batch.id} style={{ 
                    padding: '4px 8px', 
                    background: '#e0f2fe', 
                    color: '#0369a1', 
                    borderRadius: 4, 
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    {batch.batchId}
                    <button
                      onClick={() => handleRemoveSelectedBatch(batch.id)}
                      style={{ background: 'none', border: 'none', color: '#0369a1', cursor: 'pointer', fontSize: 12 }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
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
            onClick={handleCreateRoute}
            disabled={!newRouteName.trim() || selectedBatches.length === 0 || loading}
            style={{ 
              padding: '12px 24px', 
              background: (!newRouteName.trim() || selectedBatches.length === 0 || loading) ? '#d1d5db' : '#3b82f6', 
              color: 'white', 
              border: 'none', 
              borderRadius: 8, 
              cursor: (!newRouteName.trim() || selectedBatches.length === 0 || loading) ? 'not-allowed' : 'pointer' 
            }}
          >
            {loading ? 'Creating...' : 'Create Route'}
          </button>
        </div>
      </div>
    </section>
  )
}

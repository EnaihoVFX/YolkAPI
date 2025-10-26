import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Copy, X } from 'lucide-react'
import { fetchShipments } from '../lib/api'
import QRCode from 'qrcode'

export function GenerateProofTag() {
  const navigate = useNavigate()
  const [shipments, setShipments] = useState<Array<{ id: string; name: string; status: string; path: Array<{ lat: number; lng: number }>; stops?: Array<{ lat: number; lng: number; label: string; type: 'hub' | 'proof' }> }>>([])
  const [selectedRouteForProof, setSelectedRouteForProof] = useState<string>('')
  const [selectedSegmentForProof, setSelectedSegmentForProof] = useState<number>(0)
  const [proofTagData, setProofTagData] = useState<any>(null)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('')
  const [loading, setLoading] = useState(false)

  // Load shipments
  useEffect(() => {
    const loadShipments = async () => {
      try {
        const s = await fetchShipments()
        setShipments(s)
      } catch (error) {
        console.error('Failed to load shipments:', error)
      }
    }
    loadShipments()
  }, [])

  const handleGenerateProofTag = async () => {
    if (!selectedRouteForProof) return
    
    setLoading(true)
    try {
      const shipment = shipments.find(s => s.id === selectedRouteForProof)
      if (!shipment) return
      
      const stop = shipment.stops?.[selectedSegmentForProof]
      if (!stop) return
      
      const proofData = {
        routeId: selectedRouteForProof,
        routeName: shipment.name,
        segmentIndex: selectedSegmentForProof,
        stopName: stop.label,
        stopType: stop.type,
        coordinates: { lat: stop.lat, lng: stop.lng },
        timestamp: new Date().toISOString(),
        type: 'checkpoint_proof'
      }
      
      // Generate QR code
      const qrData = JSON.stringify(proofData)
      const qrCodeUrl = await QRCode.toDataURL(qrData, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
      
      setProofTagData(proofData)
      setQrCodeDataUrl(qrCodeUrl)
    } catch (error) {
      console.error('Failed to generate proof tag:', error)
      alert('Failed to generate proof tag. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadQR = () => {
    if (!qrCodeDataUrl) return
    
    const link = document.createElement('a')
    link.download = `proof-tag-${proofTagData.routeId}-${proofTagData.segmentIndex}.png`
    link.href = qrCodeDataUrl
    link.click()
  }

  const handleCopyData = () => {
    if (!proofTagData) return
    
    navigator.clipboard.writeText(JSON.stringify(proofTagData, null, 2))
    alert('Proof tag data copied to clipboard!')
  }

  const handleReset = () => {
    setProofTagData(null)
    setQrCodeDataUrl('')
    setSelectedRouteForProof('')
    setSelectedSegmentForProof(0)
  }

  return (
    <section aria-label="Generate Proof Tag">
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
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, color: '#111827' }}>Generate Proof Tag</h1>
        <p style={{ margin: '8px 0 0', color: '#6b7280', fontSize: 16 }}>Create QR codes for checkpoint verification and proof of delivery</p>
      </div>

      <div className="card" style={{ maxWidth: 800, margin: '0 auto' }}>
        {!proofTagData ? (
          <div>
            {/* Route Selection */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#374151' }}>
                Select Route
              </label>
              <select
                value={selectedRouteForProof}
                onChange={(e) => {
                  setSelectedRouteForProof(e.target.value)
                  setSelectedSegmentForProof(0)
                }}
                style={{ width: '100%', padding: 12, border: '1px solid var(--border)', borderRadius: 8, fontSize: 14 }}
              >
                <option value="">Choose a route...</option>
                {shipments.map((shipment) => (
                  <option key={shipment.id} value={shipment.id}>
                    {shipment.name} ({shipment.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Checkpoint Selection */}
            {selectedRouteForProof && (
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#374151' }}>
                  Select Checkpoint/Hub
                </label>
                <select
                  value={selectedSegmentForProof}
                  onChange={(e) => setSelectedSegmentForProof(Number(e.target.value))}
                  style={{ width: '100%', padding: 12, border: '1px solid var(--border)', borderRadius: 8, fontSize: 14 }}
                >
                  {shipments.find(s => s.id === selectedRouteForProof)?.stops?.map((stop, index) => (
                    <option key={index} value={index}>
                      {stop.label} ({stop.type}) - {stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Checkpoint Details */}
            {selectedRouteForProof && (
              <div style={{ marginBottom: 24, padding: 16, background: '#f9fafb', borderRadius: 8, border: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: 14, marginBottom: 8, color: '#374151' }}>Checkpoint Details</h3>
                {(() => {
                  const shipment = shipments.find(s => s.id === selectedRouteForProof)
                  const stop = shipment?.stops?.[selectedSegmentForProof]
                  if (!stop) return null
                  
                  return (
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      <div><strong>Route:</strong> {shipment?.name}</div>
                      <div><strong>Stop:</strong> {stop.label}</div>
                      <div><strong>Type:</strong> {stop.type}</div>
                      <div><strong>Coordinates:</strong> {stop.lat.toFixed(6)}, {stop.lng.toFixed(6)}</div>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => navigate('/overview')}
                style={{ padding: '12px 24px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateProofTag}
                disabled={!selectedRouteForProof || loading}
                style={{ 
                  padding: '12px 24px', 
                  background: (!selectedRouteForProof || loading) ? '#d1d5db' : '#3b82f6', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: 8, 
                  cursor: (!selectedRouteForProof || loading) ? 'not-allowed' : 'pointer' 
                }}
              >
                {loading ? 'Generating...' : 'Generate QR Code'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Generated Proof Tag */}
            <div style={{ marginBottom: 24, textAlign: 'center' }}>
              <h3 style={{ fontSize: 18, marginBottom: 12, color: '#374151' }}>Proof Tag Generated</h3>
              
              {/* Proof Data */}
              <div style={{ padding: 16, background: '#f9fafb', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 16, textAlign: 'left' }}>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  <div><strong>Route:</strong> {proofTagData.routeName}</div>
                  <div><strong>Checkpoint:</strong> {proofTagData.stopName} ({proofTagData.stopType})</div>
                  <div><strong>Coordinates:</strong> {proofTagData.coordinates.lat.toFixed(6)}, {proofTagData.coordinates.lng.toFixed(6)}</div>
                  <div><strong>Generated:</strong> {new Date(proofTagData.timestamp).toLocaleString()}</div>
                </div>
              </div>
              
              {/* QR Code */}
              {qrCodeDataUrl ? (
                <img 
                  src={qrCodeDataUrl} 
                  alt="Proof Tag QR Code"
                  style={{ 
                    width: 200, 
                    height: 200, 
                    margin: '0 auto 16px',
                    borderRadius: 8,
                    border: '2px solid #e5e7eb'
                  }}
                />
              ) : (
                <div style={{ 
                  width: 200, 
                  height: 200, 
                  margin: '0 auto 16px', 
                  background: '#f3f4f6', 
                  border: '2px dashed #d1d5db', 
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#6b7280',
                  fontSize: 12
                }}>
                  Loading QR Code...
                </div>
              )}
              
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 24 }}>
                Scan this QR code at the checkpoint to verify proof of delivery
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={handleDownloadQR}
                style={{ 
                  padding: '12px 24px', 
                  background: '#10b981', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: 8, 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <Download size={16} />
                Download QR
              </button>
              <button
                onClick={handleCopyData}
                style={{ 
                  padding: '12px 24px', 
                  background: '#f59e0b', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: 8, 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <Copy size={16} />
                Copy Data
              </button>
              <button
                onClick={handleReset}
                style={{ 
                  padding: '12px 24px', 
                  background: '#3b82f6', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: 8, 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <X size={16} />
                Generate New
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

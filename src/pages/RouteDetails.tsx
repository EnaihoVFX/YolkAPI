import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Pause, Play, Trash2, Eye, MapPin as MapPinIcon, Package, Clock, AlertCircle, CheckCircle, Weight, DollarSign } from 'lucide-react'
import { fetchShipmentDetails, fetchShipments } from '../lib/api'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Vite will handle importing image assets from public root path via URL
const truckPng = '/truck.png'

export function RouteDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [shipmentDetails, setShipmentDetails] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mapRef = useRef<HTMLDivElement | null>(null)
  const leafletRef = useRef<L.Map | null>(null)

  // Load shipment details
  useEffect(() => {
    const loadShipmentDetails = async () => {
      if (!id) return
      
      setLoading(true)
      setError(null)
      try {
        const details = await fetchShipmentDetails(id)
        setShipmentDetails(details)
      } catch (error) {
        console.error('Failed to fetch shipment details:', error)
        setError('Failed to load shipment details')
      } finally {
        setLoading(false)
      }
    }
    loadShipmentDetails()
  }, [id])

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || leafletRef.current || !shipmentDetails) return
    
    const map = L.map(mapRef.current as HTMLDivElement, {
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
    })
    leafletRef.current = map

    // Minimalist light tiles
    const tiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 20,
    })
    tiles.addTo(map)

    // Set view to shipment path
    if (shipmentDetails.path && shipmentDetails.path.length >= 2) {
      const bounds = L.latLngBounds(shipmentDetails.path.map((p: any) => [p.lat, p.lng]))
      map.fitBounds(bounds, { padding: [20, 20] })
    } else {
      map.setView([54.7024, -3.2766], 6)
    }

    // Draw shipment path
    if (shipmentDetails.path && shipmentDetails.path.length >= 2) {
      let routeColor = '#d1d5db' // Default gray
      if (shipmentDetails.status === 'delivered') {
        routeColor = '#22c55e' // Green for completed
      } else if (shipmentDetails.status === 'cancelled') {
        routeColor = '#ef4444' // Red for cancelled
      } else if (shipmentDetails.status === 'paused') {
        routeColor = '#f59e0b' // Orange for paused
      } else if (shipmentDetails.status === 'in_transit') {
        // Calculate progress-based color for in-transit shipments
        const progress = shipmentDetails.progress?.percentage || 0
        if (progress < 25) {
          routeColor = '#8b5cf6' // Purple for early stage
        } else if (progress < 50) {
          routeColor = '#f59e0b' // Orange for quarter way
        } else if (progress < 75) {
          routeColor = '#3b82f6' // Blue for halfway
        } else {
          routeColor = '#10b981' // Green for near completion
        }
      }
      
      L.polyline(shipmentDetails.path.map((p: any) => [p.lat, p.lng]), { 
        color: routeColor, 
        weight: 4,
        opacity: 0.8
      }).addTo(map)
    }

    // Add stops
    if (shipmentDetails.stops) {
      shipmentDetails.stops.forEach((stop: any, index: number) => {
        const color = stop.type === 'hub' ? '#60a5fa' : '#22c55e'
        const marker = L.circleMarker([stop.lat, stop.lng], { 
          radius: 6, 
          color, 
          weight: 2, 
          fillColor: '#fff', 
          fillOpacity: 1 
        }).addTo(map)
        
        // Create rich tooltip with metadata
        const tooltipContent = `
          <div style="font-family: system-ui, -apple-system, sans-serif; font-size: 12px; line-height: 1.4;">
            <div style="font-weight: 600; color: #111827; margin-bottom: 4px;">${stop.label}</div>
            <div style="color: #6b7280; margin-bottom: 2px;"><strong>Type:</strong> ${stop.type}</div>
            <div style="color: #6b7280; margin-bottom: 2px;"><strong>Route:</strong> ${shipmentDetails.name}</div>
            <div style="color: #6b7280; margin-bottom: 2px;"><strong>Stop #:</strong> ${index + 1} of ${shipmentDetails.stops.length}</div>
            <div style="color: #6b7280; margin-bottom: 2px;"><strong>Coordinates:</strong> ${stop.lat.toFixed(6)}, ${stop.lng.toFixed(6)}</div>
            <div style="color: #6b7280; margin-bottom: 2px;"><strong>Status:</strong> ${shipmentDetails.status.replace('_', ' ')}</div>
            ${shipmentDetails.custodian ? `<div style="color: #6b7280; margin-bottom: 2px;"><strong>Custodian:</strong> ${shipmentDetails.custodian}</div>` : ''}
            ${shipmentDetails.eta ? `<div style="color: #6b7280; margin-bottom: 2px;"><strong>ETA:</strong> ${shipmentDetails.eta}</div>` : ''}
            ${shipmentDetails.sla ? `<div style="color: #6b7280;"><strong>SLA:</strong> ${shipmentDetails.sla}</div>` : ''}
          </div>
        `
        
        marker.bindTooltip(tooltipContent, { 
          permanent: false,
          direction: 'top',
          offset: [0, -10],
          className: 'custom-tooltip'
        })
      })
    }

    return () => {
      if (leafletRef.current) {
        leafletRef.current.remove()
        leafletRef.current = null
      }
    }
  }, [shipmentDetails])

  const handlePauseShipment = async () => {
    if (!shipmentDetails) return
    try {
      // Update shipment status to paused
      setShipmentDetails(prev => ({ ...prev, status: 'paused', lastUpdate: Date.now() }))
      console.log(`Shipment ${shipmentDetails.id} paused`)
    } catch (error) {
      console.error('Failed to pause shipment:', error)
    }
  }

  const handleResumeShipment = async () => {
    if (!shipmentDetails) return
    try {
      // Update shipment status to in_transit
      setShipmentDetails(prev => ({ ...prev, status: 'in_transit', lastUpdate: Date.now() }))
      console.log(`Shipment ${shipmentDetails.id} resumed`)
    } catch (error) {
      console.error('Failed to resume shipment:', error)
    }
  }

  const handleCancelShipment = async () => {
    if (!shipmentDetails) return
    if (!confirm('Are you sure you want to cancel this shipment? This action cannot be undone.')) {
      return
    }
    
    try {
      // Update shipment status to cancelled
      setShipmentDetails(prev => ({ ...prev, status: 'cancelled', lastUpdate: Date.now() }))
      console.log(`Shipment ${shipmentDetails.id} cancelled`)
    } catch (error) {
      console.error('Failed to cancel shipment:', error)
    }
  }

  const handleUpdateShipmentStatus = async (newStatus: string) => {
    if (!shipmentDetails) return
    try {
      setShipmentDetails(prev => ({ ...prev, status: newStatus, lastUpdate: Date.now() }))
      console.log(`Shipment ${shipmentDetails.id} status updated to ${newStatus}`)
    } catch (error) {
      console.error('Failed to update shipment status:', error)
    }
  }

  if (loading) {
    return (
      <section aria-label="Route Details">
        <div className="topbar-gap" />
        <div className="card" style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="skeleton tall" style={{ height: 400 }} />
        </div>
      </section>
    )
  }

  if (error || !shipmentDetails) {
    return (
      <section aria-label="Route Details">
        <div className="topbar-gap" />
        <div className="card" style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ color: '#ef4444', marginBottom: 16 }}>Error Loading Route</h2>
          <p style={{ color: '#6b7280', marginBottom: 24 }}>{error || 'Route not found'}</p>
          <button 
            onClick={() => navigate('/overview')}
            style={{ 
              padding: '12px 24px', 
              background: '#3b82f6', 
              color: 'white', 
              border: 'none', 
              borderRadius: 8, 
              cursor: 'pointer' 
            }}
          >
            Back to Overview
          </button>
        </div>
      </section>
    )
  }

  return (
    <section aria-label="Route Details">
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, color: '#111827' }}>{shipmentDetails.name}</h1>
            <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }} className="mono">{shipmentDetails.id}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {shipmentDetails.status === 'in_transit' && (
              <>
                <button
                  onClick={handlePauseShipment}
                  style={{ 
                    padding: '8px 12px', 
                    background: '#f59e0b', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: 6, 
                    cursor: 'pointer', 
                    fontSize: 12, 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 4 
                  }}
                >
                  <Pause size={14} />
                  Pause
                </button>
                <button
                  onClick={handleCancelShipment}
                  style={{ 
                    padding: '8px 12px', 
                    background: '#ef4444', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: 6, 
                    cursor: 'pointer', 
                    fontSize: 12, 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 4 
                  }}
                >
                  <Trash2 size={14} />
                  Cancel
                </button>
              </>
            )}
            {shipmentDetails.status === 'paused' && (
              <button
                onClick={handleResumeShipment}
                style={{ 
                  padding: '8px 12px', 
                  background: '#10b981', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: 6, 
                  cursor: 'pointer', 
                  fontSize: 12, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 4 
                }}
              >
                <Play size={14} />
                Resume
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 24, maxWidth: 1200, margin: '0 auto' }}>
        {/* Main Content */}
        <div>
          {/* Map */}
          <div className="card" style={{ marginBottom: 24, padding: 0, overflow: 'hidden' }}>
            <div ref={mapRef} style={{ height: 400, width: '100%' }} />
          </div>

          {/* Basic Information */}
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, marginBottom: 12, color: '#374151' }}>Basic Information</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="muted">Status:</span>
                  <span style={{ 
                    padding: '2px 8px', 
                    borderRadius: 12, 
                    fontSize: 12, 
                    fontWeight: 600,
                    background: shipmentDetails.status === 'in_transit' ? '#dbeafe' : 
                               shipmentDetails.status === 'delivered' ? '#dcfce7' : 
                               shipmentDetails.status === 'cancelled' ? '#fecaca' : 
                               shipmentDetails.status === 'paused' ? '#fef3c7' : '#f9fafb', 
                    color: shipmentDetails.status === 'in_transit' ? '#1e40af' : 
                           shipmentDetails.status === 'delivered' ? '#166534' : 
                           shipmentDetails.status === 'cancelled' ? '#dc2626' : 
                           shipmentDetails.status === 'paused' ? '#92400e' : '#374151'
                  }}>
                    {shipmentDetails.status.replace('_', ' ')}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="muted">Custodian:</span>
                  <span className="mono">{shipmentDetails.custodian || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="muted">Leg:</span>
                  <span>{shipmentDetails.leg || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="muted">ETA:</span>
                  <span>{shipmentDetails.eta || '—'}</span>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="muted">SLA:</span>
                  <span style={{ 
                    padding: '2px 8px', 
                    borderRadius: 12, 
                    fontSize: 12, 
                    fontWeight: 600,
                    background: shipmentDetails.sla === 'MET' ? '#dcfce7' : 
                               shipmentDetails.sla === 'RISK' ? '#fef3c7' : '#fecaca',
                    color: shipmentDetails.sla === 'MET' ? '#166534' : 
                           shipmentDetails.sla === 'RISK' ? '#92400e' : '#dc2626'
                  }}>
                    {shipmentDetails.sla || '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="muted">Speed Category:</span>
                  <span style={{ 
                    padding: '2px 8px', 
                    borderRadius: 12, 
                    fontSize: 12, 
                    fontWeight: 600,
                    background: '#e0e7ff',
                    color: '#3730a3'
                  }}>
                    {shipmentDetails.speedCategory || 'standard'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="muted">Last Update:</span>
                  <span>{shipmentDetails.lastUpdate ? new Date(shipmentDetails.lastUpdate).toLocaleString() : 'Never'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="muted">Update Status:</span>
                  <select
                    value={shipmentDetails.status}
                    onChange={(e) => handleUpdateShipmentStatus(e.target.value)}
                    style={{ 
                      padding: '4px 8px', 
                      border: '1px solid var(--border)', 
                      borderRadius: 4, 
                      fontSize: 12,
                      background: 'white'
                    }}
                  >
                    <option value="in_transit">In Transit</option>
                    <option value="paused">Paused</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Information */}
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, marginBottom: 12, color: '#374151' }}>Progress</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="muted">Progress:</span>
                  <span>{shipmentDetails.progress?.percentage?.toFixed(1) || 0}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="muted">Distance:</span>
                  <span>{(shipmentDetails.progress?.completedDistance || 0).toFixed(0)}m / {(shipmentDetails.progress?.totalDistance || 0).toFixed(0)}m</span>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="muted">Current Position:</span>
                  <span className="mono">
                    {shipmentDetails.currentPosition ? 
                      `${shipmentDetails.currentPosition.lat.toFixed(4)}, ${shipmentDetails.currentPosition.lng.toFixed(4)}` : 
                      'Unknown'
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Items */}
          {shipmentDetails.items && shipmentDetails.items.length > 0 && (
            <div className="card" style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 16, marginBottom: 12, color: '#374151' }}>Items on Route</h3>
              <div className="table" style={{ margin: 0 }}>
                <div className="thead">
                  <div className="th">Item</div>
                  <div className="th">Quantity</div>
                  <div className="th">Weight (kg)</div>
                  <div className="th">Value (£)</div>
                </div>
                <div className="tbody">
                  {shipmentDetails.items.map((item: any) => (
                    <div key={item.id} className="tr">
                      <div className="td">{item.name}</div>
                      <div className="td">{item.quantity}</div>
                      <div className="td">{item.weight}</div>
                      <div className="td">{item.value.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Batches */}
          {shipmentDetails.batches && shipmentDetails.batches.length > 0 && (
            <div className="card" style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 16, marginBottom: 12, color: '#374151' }}>Batches on Route</h3>
              <div className="table" style={{ margin: 0 }}>
                <div className="thead">
                  <div className="th">Batch ID</div>
                  <div className="th">SKU</div>
                  <div className="th">Quantity</div>
                  <div className="th">Weight (kg)</div>
                  <div className="th">Value (£)</div>
                </div>
                <div className="tbody">
                  {shipmentDetails.batches.map((batch: any) => (
                    <div key={batch.id} className="tr">
                      <div className="td mono">{batch.batchId}</div>
                      <div className="td">{batch.sku}</div>
                      <div className="td">{batch.quantity}</div>
                      <div className="td">{batch.weight}</div>
                      <div className="td">{batch.value.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div>
          {/* Route Stops */}
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, marginBottom: 12, color: '#374151' }}>Route Stops</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {shipmentDetails.stops?.map((stop: any, index: number) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: '#f9fafb', borderRadius: 8 }}>
                  <div style={{ 
                    width: 8, 
                    height: 8, 
                    borderRadius: '50%', 
                    background: stop.type === 'hub' ? '#3b82f6' : '#10b981' 
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: '#111827' }}>{stop.label}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}
                    </div>
                  </div>
                  <span style={{ 
                    padding: '2px 8px', 
                    borderRadius: 12, 
                    fontSize: 11, 
                    fontWeight: 600,
                    background: stop.type === 'hub' ? '#dbeafe' : '#dcfce7',
                    color: stop.type === 'hub' ? '#1e40af' : '#166534'
                  }}>
                    {stop.type}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card">
            <h3 style={{ fontSize: 16, marginBottom: 12, color: '#374151' }}>Quick Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={() => navigate('/generate-proof-tag')}
                style={{ 
                  padding: '12px 16px', 
                  background: '#3b82f6', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: 6, 
                  cursor: 'pointer',
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <MapPinIcon size={16} />
                Generate Proof Tag
              </button>
              <button
                onClick={() => navigate('/overview')}
                style={{ 
                  padding: '12px 16px', 
                  background: '#f3f4f6', 
                  color: '#374151', 
                  border: '1px solid var(--border)', 
                  borderRadius: 6, 
                  cursor: 'pointer',
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <Eye size={16} />
                View All Routes
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

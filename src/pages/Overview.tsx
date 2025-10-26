import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOverview, useReceipts, useSupplyActive, useStream, createTag, getTransactionDetails, useGpsStream, geocodeAddress, useDeliveries, seedShipments, fetchShipments, fetchShipmentDetails, createRoute, registerBatch, seedSecretRoute } from '../lib/api'
import { Package, MapPin as MapPinIcon, Plus, TrendingUp, Truck as TruckIcon, X, Clock, AlertCircle, CheckCircle, Weight, DollarSign, Hash, Pause, Play, Eye, Trash2, Settings, Activity, Zap, Shield, Map } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import QRCode from 'qrcode'
// Vite will handle importing image assets from public root path via URL
const truckPng = '/truck.png'

// Custom hook for scroll animations
function useScrollAnimation() {
  const [animatedElements, setAnimatedElements] = useState<Set<string>>(new Set())

  const observeElement = useCallback((element: HTMLElement, id: string) => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setAnimatedElements(prev => new Set([...prev, id]))
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return { animatedElements, observeElement }
}

export function Overview() {
  const navigate = useNavigate()
  const { data: overview, loading: loadingOverview } = useOverview()
  const { data: receipts, loading: loadingReceipts } = useReceipts(50)
  const { events } = useStream()
  const { data: deliveries } = useDeliveries()
  const { positions } = useGpsStream([])
  const [shipments, setShipments] = useState<Array<{ id: string; name: string; status: string; path: Array<{ lat: number; lng: number }>; stops?: Array<{ lat: number; lng: number; label: string; type: 'hub' | 'proof' }>; items?: Array<{ id: string; name: string; quantity: number; weight: number; value: number }>; batches?: Array<{ id: string; batchId: string; sku: string; quantity: number; weight: number; value: number }>; custodian?: string; eta?: string; sla?: string; leg?: string; speedCategory?: string; createdAt?: number; lastUpdate?: number }>>([])
  const [selectedShipment, setSelectedShipment] = useState<string | null>(null)
  const [shipmentDetails, setShipmentDetails] = useState<any>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const { animatedElements, observeElement } = useScrollAnimation()

  const handleShipmentClick = (shipmentId: string) => {
    navigate(`/route/${shipmentId}`)
  }

  const handleCancelShipment = async (shipmentId: string) => {
    if (!confirm('Are you sure you want to cancel this shipment? This action cannot be undone.')) {
      return
    }
    
    try {
      // Update shipment status to cancelled
      setShipments(prev => prev.map(s => 
        s.id === shipmentId 
          ? { ...s, status: 'cancelled', lastUpdate: Date.now() }
          : s
      ))
      
      // Close details modal if it's open for this shipment
      if (selectedShipment === shipmentId) {
        setShowDetailsModal(false)
        setSelectedShipment(null)
        setShipmentDetails(null)
      }
      
      console.log(`Shipment ${shipmentId} cancelled`)
    } catch (error) {
      console.error('Failed to cancel shipment:', error)
    }
  }

  const handlePauseShipment = async (shipmentId: string) => {
    try {
      setShipments(prev => prev.map(s => 
        s.id === shipmentId 
          ? { ...s, status: 'paused', lastUpdate: Date.now() }
          : s
      ))
      console.log(`Shipment ${shipmentId} paused`)
    } catch (error) {
      console.error('Failed to pause shipment:', error)
    }
  }

  const handleResumeShipment = async (shipmentId: string) => {
    try {
      setShipments(prev => prev.map(s => 
        s.id === shipmentId 
          ? { ...s, status: 'in_transit', lastUpdate: Date.now() }
          : s
      ))
      console.log(`Shipment ${shipmentId} resumed`)
    } catch (error) {
      console.error('Failed to resume shipment:', error)
    }
  }

  const handleUpdateShipmentStatus = async (shipmentId: string, newStatus: string) => {
    try {
      setShipments(prev => prev.map(s => 
        s.id === shipmentId 
          ? { ...s, status: newStatus, lastUpdate: Date.now() }
          : s
      ))
      console.log(`Shipment ${shipmentId} status updated to ${newStatus}`)
    } catch (error) {
      console.error('Failed to update shipment status:', error)
    }
  }


  const nf = useMemo(() => new Intl.NumberFormat(undefined, { minimumFractionDigits: 0 }), [])
  const money = useMemo(() => new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), [])
  const dtFmt = useMemo(() => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }), [])

  const [drawer, setDrawer] = useState<{ open: boolean; txHash?: string; receiptId?: string; loading?: boolean }>({ open: false })
  const [routeDrawer, setRouteDrawer] = useState<{ open: boolean; routeId?: string }>(() => ({ open: false }))
  const [checkpointDrawer, setCheckpointDrawer] = useState<{ open: boolean; routeId?: string; hopIndex?: number }>(() => ({ open: false }))
  const [details, setDetails] = useState<any>(null)
  const [payAmount, setPayAmount] = useState('25.00')
  const [paySvgUrl, setPaySvgUrl] = useState<string | null>(null)
  const [proofSvgUrl, setProofSvgUrl] = useState<string | null>(null)

  // UI state for supplies tracking
  const [supplies, setSupplies] = useState<Array<{ id: number; name: string; status: 'In Transit' | 'Delivered' | 'Processing'; route: string }>>([
    { id: 1, name: 'Electronics Shipment', status: 'In Transit', route: 'Shanghai → Los Angeles' },
    { id: 2, name: 'Medical Supplies', status: 'Delivered', route: 'Berlin → New York' },
    { id: 3, name: 'Automotive Parts', status: 'Processing', route: 'Tokyo → Detroit' },
  ])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newSupply, setNewSupply] = useState<{ name: string; origin: string; destination: string }>({ name: '', origin: '', destination: '' })
  function handleCreateSupply() {
    if (!newSupply.name || !newSupply.origin || !newSupply.destination) return
    const supply = {
      id: supplies.length + 1,
      name: newSupply.name,
      status: 'Processing' as const,
      route: `${newSupply.origin} → ${newSupply.destination}`,
    }
    setSupplies([...supplies, supply])
    setNewSupply({ name: '', origin: '', destination: '' })
    setShowCreateForm(false)
  }
  function statusStyle(status: 'In Transit' | 'Delivered' | 'Processing') {
    if (status === 'In Transit') return { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }
    if (status === 'Delivered') return { background: '#ecfdf5', color: '#166534', border: '1px solid #bbf7d0' }
    return { background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' }
  }

  // Load shipments periodically and after seeding
  useEffect(() => {
    let alive = true
    async function load() {
      try { const s = await fetchShipments(); if (alive) setShipments(s) } catch {}
    }
    void load()
    const t = window.setInterval(load, 5000)
    return () => { alive = false; window.clearInterval(t) }
  }, [])

  useEffect(() => {
    let alive = true
    if (drawer.open && (drawer.txHash || drawer.receiptId)) {
      setDrawer((d) => ({ ...d, loading: true }))
      getTransactionDetails(drawer.txHash, drawer.receiptId).then((res) => {
        if (!alive) return
        setDetails(res)
        setDrawer((d) => ({ ...d, loading: false }))
      })
    } else {
      setDetails(null)
    }
    return () => { alive = false }
  }, [drawer.open, drawer.txHash, drawer.receiptId])

  function openTx(txHash?: string, receiptId?: string) {
    if (!txHash && !receiptId) return
    setDrawer({ open: true, txHash, receiptId, loading: true })
  }
  function openRoute(routeId: string) { setRouteDrawer({ open: true, routeId }) }
  function openCheckpoint(routeId: string, hopIndex: number) { setCheckpointDrawer({ open: true, routeId, hopIndex }) }

  async function generatePayTag() {
    try {
      setPaySvgUrl(null)
      const amt = Number(payAmount || '0')
      const res = await createTag('pay', { amountPLT: amt })
      setPaySvgUrl(res.svgUrl)
      setProofSvgUrl(null)
    } catch {}
  }

  async function generateProofTag() {
    try {
      setProofSvgUrl(null)
      const res = await createTag('proof', { memo: 'Boiler Check @ Soho' })
      setProofSvgUrl(res.svgUrl)
      setPaySvgUrl(null)
    } catch {}
  }

  const last24hCutoff = Date.now() - 24 * 60 * 60 * 1000
  const receipts24h = (receipts ?? []).filter(r => new Date(r.timeIso).getTime() >= last24hCutoff)
  const pltIn24h = receipts24h.reduce((s, r) => s + (r.amount || 0), 0)
  const custodyCount24h = 0

  // Build a route from deliveries to animate a truck
  const routePoints: [number, number][] = useMemo<[number, number][]>(() => {
    const first = (deliveries || [])[0]
    const pts = first?.steps?.map(s => [s.lat, s.lng] as [number, number])
    return (pts && pts.length >= 2) ? pts : ([
      [37.776, -122.42],
      [37.768, -122.41],
      [37.759, -122.40],
    ] as [number, number][])
  }, [deliveries])

  return (
    <section aria-label="Overview" className="fade-in">
      <div className="topbar-gap" />

      {/* Hero Map with concurrent shipments */}
      <div style={{ marginBottom: 8 }}>
        <HeroMapMulti routePoints={routePoints} livePositions={positions} shipments={shipments} />
        
        {/* Route Color Legend */}
        <div style={{ 
          marginTop: 8, 
          padding: 12, 
          background: '#f9fafb', 
          borderRadius: 8, 
          border: '1px solid var(--border)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          alignItems: 'center'
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginRight: 8 }}>Route Status:</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 16, height: 3, background: '#8b5cf6', borderRadius: 2 }}></div>
            <span style={{ fontSize: 11, color: '#6b7280' }}>Early (0-25%)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 16, height: 3, background: '#f59e0b', borderRadius: 2 }}></div>
            <span style={{ fontSize: 11, color: '#6b7280' }}>Quarter (25-50%)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 16, height: 3, background: '#3b82f6', borderRadius: 2 }}></div>
            <span style={{ fontSize: 11, color: '#6b7280' }}>Halfway (50-75%)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 16, height: 3, background: '#10b981', borderRadius: 2 }}></div>
            <span style={{ fontSize: 11, color: '#6b7280' }}>Near Complete (75%+)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 16, height: 3, background: '#22c55e', borderRadius: 2 }}></div>
            <span style={{ fontSize: 11, color: '#6b7280' }}>Delivered</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 16, height: 3, background: '#f59e0b', borderRadius: 2 }}></div>
            <span style={{ fontSize: 11, color: '#6b7280' }}>Paused</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 16, height: 3, background: '#ef4444', borderRadius: 2 }}></div>
            <span style={{ fontSize: 11, color: '#6b7280' }}>Cancelled</span>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="scroll-animate" ref={(el) => el && observeElement(el, 'header')} style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div>
              <h1 style={{ margin: 0, background: 'linear-gradient(135deg, var(--primary), var(--primary-light))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Supply Chain
              </h1>
              <p style={{ margin: 8, fontSize: 'var(--text-lg)', color: 'var(--muted)', fontWeight: 'var(--font-normal)' }}>
                Manage and track your supply operations
              </p>
          </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div className="pill" style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)' }}>
              PLT Balance: {money.format(overview?.pltBalance ?? 0)} PLT
            </div>
            <a className="icon-btn tooltip" href="/settings" aria-label="Settings" style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--text)', textDecoration: 'none', transition: 'all 0.2s ease' }}>
              <Settings size={20} />
              <span className="tooltip-text">Settings</span>
            </a>
          </div>
        </div>
        <div className="divider-thick"></div>
      </div>

      {/* Key Metrics */}
      <div className={`grid ${animatedElements.has('metrics') ? 'animate' : 'scroll-animate'}`} ref={(el) => el && observeElement(el, 'metrics')} style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 24, marginBottom: 24 }}>
        <div className="stats-card">
          <div className="stats-card-content">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h5 style={{ margin: 0 }}>Active Shipments</h5>
              <Package size={24} color="var(--primary)" style={{ opacity: 0.8 }} />
          </div>
            <div className="stats-number">{shipments.filter(s => s.status === 'in_transit').length}</div>
            <div className="stats-description">Currently in transit</div>
        </div>
          </div>
        <div className="stats-card">
          <div className="stats-card-content">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h5 style={{ margin: 0 }}>Total Routes</h5>
              <MapPinIcon size={24} color="var(--success)" style={{ opacity: 0.8 }} />
        </div>
            <div className="stats-number">{shipments.length}</div>
            <div className="stats-description">All time routes</div>
          </div>
        </div>
        <div className="stats-card">
          <div className="stats-card-content">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h5 style={{ margin: 0 }}>Completed</h5>
              <TrendingUp size={24} color="var(--warning)" style={{ opacity: 0.8 }} />
      </div>
            <div className="stats-number">{shipments.filter(s => s.status === 'delivered').length}</div>
            <div className="stats-description">Successfully delivered</div>
          </div>
        </div>
      </div>


      {/* Actions */}
      <div className={`${animatedElements.has('actions') ? 'animate' : 'scroll-animate'}`} ref={(el) => el && observeElement(el, 'actions')} style={{ marginBottom: 40 }}>
        <h3 style={{ margin: '0 0 20px', fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--text)' }}>Quick Actions</h3>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
          <button className="primary" onClick={() => setShowCreateForm(!showCreateForm)} style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: '14px 24px', fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)' }}>
            <Plus size={20} /> Create Supply
        </button>
          <button style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: '14px 24px', fontSize: 'var(--text-base)', fontWeight: 'var(--font-medium)' }} onClick={async () => { try { await seedShipments(4); const s = await fetchShipments(); setShipments(s) } catch {} }}>
            <MapPinIcon size={20} /> Seed Routes
        </button>
          <button style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: '14px 24px', fontSize: 'var(--text-base)', fontWeight: 'var(--font-medium)' }} onClick={async () => { try { await seedSecretRoute(); const s = await fetchShipments(); setShipments(s) } catch {} }}>
            <Hash size={20} /> Seed Secret Route
        </button>
        </div>
        
        {/* System Status */}
        <div className="feature-card" style={{ background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.08), rgba(5, 150, 105, 0.12))', border: '1px solid rgba(5, 150, 105, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className="status-indicator active" style={{ background: 'rgba(5, 150, 105, 0.1)', color: 'var(--success)', border: '1px solid rgba(5, 150, 105, 0.2)' }}>
              <div className="status-indicator-dot"></div>
              System Online
            </div>
            <div style={{ flex: 1 }}>
              <h5 style={{ margin: '0 0 4px', color: 'var(--text)', fontSize: 'var(--text-sm)' }}>System Status</h5>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>All systems operational • Last updated: {new Date().toLocaleTimeString()}</p>
            </div>
            <div className="progress-bar" style={{ width: 120, height: 6 }}>
              <div className="progress-fill" style={{ width: '100%' }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="feature-card slide-in-up" style={{ marginBottom: 40, background: 'linear-gradient(135deg, var(--border-light), rgba(255, 255, 255, 0.8))', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: 120, height: 120, background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.1), transparent)', borderRadius: '0 12px 0 120px' }} />
          <h3 style={{ margin: '0 0 24px', position: 'relative', zIndex: 1 }}>New Supply Shipment</h3>
          <div className="form" style={{ position: 'relative', zIndex: 1 }}>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--text)', marginBottom: 8 }}>Shipment Name
              <input value={newSupply.name} onChange={(e) => setNewSupply({ ...newSupply, name: e.target.value })} placeholder="e.g., Electronics Shipment" style={{ marginTop: 8, fontSize: 'var(--text-base)' }} />
            </label>
            <span />
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--text)', marginBottom: 8 }}>Origin
              <input value={newSupply.origin} onChange={(e) => setNewSupply({ ...newSupply, origin: e.target.value })} placeholder="e.g., Shanghai" style={{ marginTop: 8, fontSize: 'var(--text-base)' }} />
            </label>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--text)', marginBottom: 8 }}>Destination
              <input value={newSupply.destination} onChange={(e) => setNewSupply({ ...newSupply, destination: e.target.value })} placeholder="e.g., Los Angeles" style={{ marginTop: 8, fontSize: 'var(--text-base)' }} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 28, position: 'relative', zIndex: 1 }}>
            <button className="primary" onClick={handleCreateSupply} style={{ padding: '14px 28px', fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)' }}>Create Shipment</button>
            <button onClick={() => setShowCreateForm(false)} style={{ padding: '14px 28px', fontSize: 'var(--text-base)', fontWeight: 'var(--font-medium)' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Supply List (from backend shipments) */}
      <div className={`card ${animatedElements.has('supply-list') ? 'animate' : 'scroll-animate'}`} ref={(el) => el && observeElement(el, 'supply-list')} style={{ padding: 0, overflow: 'hidden', marginBottom: 40 }}>
        <div style={{ background: 'linear-gradient(135deg, var(--border-light), rgba(255, 255, 255, 0.8))', padding: '24px 28px', borderBottom: '1px solid var(--border)', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: 100, height: 100, background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.1), transparent)', borderRadius: '0 12px 0 100px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
            <h2 style={{ margin: 0 }}>Supply Shipments</h2>
            <div className="status-indicator active" style={{ background: 'rgba(5, 150, 105, 0.1)', color: 'var(--success)', border: '1px solid rgba(5, 150, 105, 0.2)' }}>
              <div className="status-indicator-dot"></div>
              {shipments.length} Active
            </div>
          </div>
        </div>
        <div>
          {shipments.map((s) => (
            <div key={s.id} style={{ padding: 24, borderBottom: '1px solid var(--border)', transition: 'all 0.2s ease' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--border-light)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => handleShipmentClick(s.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <h4 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', color: 'var(--text)' }}>{s.name}</h4>
                    <span className="mono" style={{ color: 'var(--muted)', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-normal)', background: 'var(--border-light)', padding: '2px 8px', borderRadius: '4px' }}>{s.id}</span>
                  </div>
                  <div className="muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)', fontWeight: 'var(--font-normal)' }}>
                    <MapPinIcon size={16} /> {(() => {
                      const a = s.path?.[0]; const b = s.path?.[s.path.length - 1];
                      return a && b ? `${a.lat.toFixed(3)}, ${a.lng.toFixed(3)} → ${b.lat.toFixed(3)}, ${b.lng.toFixed(3)}` : '—'
                    })()}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`badge ${
                    s.status === 'in_transit' ? 'badge-info' : 
                    s.status === 'delivered' ? 'badge-success' : 
                    s.status === 'cancelled' ? 'badge-danger' : 
                    s.status === 'paused' ? 'badge-warning' : 
                    'badge-neutral'
                  }`} style={{ fontSize: 11, padding: '6px 12px' }}>
                    {s.status.replace('_',' ')}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {s.status === 'in_transit' && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); handlePauseShipment(s.id); }}
                          style={{ padding: '8px 12px', background: 'var(--warning)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'var(--font-semibold)' }}
                          title="Pause shipment"
                        >
                          <Pause size={14} />
                          Pause
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCancelShipment(s.id); }}
                          style={{ padding: '8px 12px', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'var(--font-semibold)' }}
                          title="Cancel shipment"
                        >
                          <Trash2 size={14} />
                          Cancel
                        </button>
                      </>
                    )}
                    {s.status === 'paused' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleResumeShipment(s.id); }}
                        style={{ padding: '8px 12px', background: 'var(--success)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'var(--font-semibold)' }}
                        title="Resume shipment"
                      >
                        <Play size={14} />
                        Resume
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleShipmentClick(s.id); }}
                      style={{ padding: '8px 12px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'var(--font-semibold)' }}
                      title="View details"
                    >
                      <Eye size={14} />
                      View
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {shipments.length === 0 && <div className="empty">No active shipments</div>}
        </div>
      </div>

      {/* KPI strip removed per request */}

      {/* Removed Show Pay QR card per request */}

      <div className="two-col">
        <div className="card receipts" style={{ gridColumn: '1 / -1' }}>
          <div className="section-title">Recent Receipts</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {(receipts24h.slice(0, 2)).map((r) => (
              <button key={r.id} className="receipt-card" onClick={() => openTx(undefined, r.id)}>
                <div className="rcpt-top">
                  <div className="rcpt-amount">{money.format(r.amount)} PLT</div>
                  <div className="rcpt-time">{dtFmt.format(new Date(r.timeIso))}</div>
                </div>
                <div className="rcpt-meta">
                  <div className="rcpt-line"><span className="muted">Buyer</span> <span className="mono">{(r.buyerHash ?? '').slice(0, 6)}…</span></div>
                  <div className="rcpt-line"><span className="muted">Receipt</span> <span className="mono">{r.id}</span></div>
                </div>
                <div className="rcpt-actions">
                  <a className="link-min" href={`https://ccdscan.io/?q=${encodeURIComponent(r.id)}`} target="_blank" rel="noreferrer">View on Explorer</a>
                </div>
              </button>
            ))}
            {receipts24h.length === 0 && <div className="empty">No receipts in the last 24h</div>}
           </div>
         </div>
      </div>

      {/* Removed Network Map section (replaced by Transit Map under header) */}

      <div className="card table-wrap">
        <div className="section-title">Active Shipments</div>
        <div role="table" aria-label="Active shipments table">
          <div className="table">
            <div className="thead">
              {['Route ID','Unit/Batch','Custodian','Leg','ETA','SLA','Speed','Status','Actions'].map((h) => (
                <div key={h} className="th">{h}</div>
              ))}
            </div>
            <div className="tbody">
              {shipments.map((s) => (
                <div key={s.id} className="tr" style={{ cursor: 'pointer' }} onClick={() => handleShipmentClick(s.id)}>
                  <div className="td mono" title={s.id}>{s.id}</div>
                  <div className="td" title={s.name}>{s.name}</div>
                  <div className="td" title={s.custodian || '—'}>{s.custodian || '—'}</div>
                  <div className="td" title={s.leg || '—'}>{s.leg || '—'}</div>
                  <div className="td" title={s.eta || '—'}>{s.eta || '—'}</div>
                  <div className="td">
                    <span className={`badge ${
                      s.sla === 'MET' ? 'badge-success' : 
                      s.sla === 'RISK' ? 'badge-warning' : 
                      'badge-danger'
                    }`} style={{ fontSize: 'var(--text-xs)', padding: '4px 8px' }}>
                      {s.sla || '—'}
                    </span>
                  </div>
                  <div className="td">
                    <span className="badge badge-info" style={{ fontSize: 'var(--text-xs)', padding: '4px 8px' }}>
                      {s.speedCategory || 'standard'}
                    </span>
                  </div>
                  <div className="td">
                    <span className={`badge ${
                      s.status === 'in_transit' ? 'badge-info' : 
                      s.status === 'delivered' ? 'badge-success' : 
                      s.status === 'cancelled' ? 'badge-danger' : 
                      s.status === 'paused' ? 'badge-warning' : 
                      'badge-neutral'
                    }`} style={{ fontSize: 'var(--text-xs)', padding: '4px 8px' }}>
                      {s.status.replace('_',' ')}
                    </span>
                  </div>
                  <div className="td">
                    <div className="action-buttons">
                      {s.status === 'in_transit' && (
                        <>
                          <button
                            className="action-btn warning"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handlePauseShipment(s.id); }}
                            title="Pause shipment"
                          >
                            <Pause size={12} />
                            Pause
                          </button>
                          <button
                            className="action-btn danger"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCancelShipment(s.id); }}
                            title="Cancel shipment"
                          >
                            <Trash2 size={12} />
                            Cancel
                          </button>
                        </>
                      )}
                      {s.status === 'paused' && (
                        <button
                          className="action-btn success"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleResumeShipment(s.id); }}
                          title="Resume shipment"
                        >
                          <Play size={12} />
                          Resume
                        </button>
                      )}
                      <button
                        className="action-btn primary"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleShipmentClick(s.id); }}
                        title="View details"
                      >
                        <Eye size={12} />
                        View
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {shipments.length === 0 && (
                <div className="tr">
                  <div className="td" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                      <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)' }}>No Active Shipments</div>
                      <div style={{ fontSize: 'var(--text-sm)' }}>Create a new shipment to get started</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <div className="section-title">Exceptions & Alerts</div>
          <ul className="receipt-list">
            <li className="receipt-item"><div>Late hop</div><div className="muted">x0</div></li>
            <li className="receipt-item"><div>Geo-mismatch</div><div className="muted">x0</div></li>
            <li className="receipt-item"><div>Duplicate scan</div><div className="muted">x0</div></li>
          </ul>
        </div>
        <div className="card feed" aria-live="polite">
          <div className="section-title">Scan / Activity Feed</div>
          <div className="feed-list">
            {(events.slice(0, 8)).map((e) => (
              <button key={e.id} className="feed-item" onClick={() => openTx(e.txHash)} aria-label={`Open details for ${e.text}`}>
                <span className="feed-icon" aria-hidden>{e.icon === 'pay' ? '✓' : e.icon === 'receipt' ? '🧾' : '🔁'}</span>
                <span className="feed-text">{e.text}</span>
                <span className="feed-time">{dtFmt.format(new Date(e.timeIso))}</span>
              </button>
            ))}
            {events.length === 0 && <div className="empty">No activity yet</div>}
          </div>
        </div>
      </div>

      <div className="fab-wrap">
        <button className="fab" onClick={() => navigate('/new-route')} aria-label="New Route">+ New Route</button>
        <button className="fab" onClick={() => navigate('/register-batch')} aria-label="Register Batch">+ Register Batch</button>
        <button className="fab" onClick={() => navigate('/generate-proof-tag')} aria-label="Generate ProofTag">+ Generate ProofTag</button>
      </div>

      {drawer.open && (
        <>
          <button className="backdrop" aria-label="Close details" onClick={() => setDrawer({ open: false })} />
          <aside className="drawer" role="dialog" aria-label="Transaction details" aria-modal="true">
            <div className="drawer-header">
              <div className="title">
                <span className="type">{details?.type ?? '—'}</span>
                <span className="sep">•</span>
                <span>{details ? dtFmt.format(new Date(details.timestampIso)) : 'Loading…'}</span>
              </div>
              <div className="hash-row">
                <span className="mono">{drawer.txHash || drawer.receiptId}</span>
                <div className="actions">
                  {drawer.txHash && <a className="link-min" href={`https://ccdscan.io/?q=${drawer.txHash}`} target="_blank" rel="noreferrer">View on Explorer</a>}
                </div>
              </div>
            </div>
            <div className="drawer-body">
              {!details && <div className="skeleton tall" />}
              {details && (
                <div className="detail-grid">
                  <section>
                    <h3>Participants</h3>
                    <ul className="kv">
                      {details.participants.map((p: any) => (
                        <li key={p.role}>
                          <span className="key">{p.role}</span>
                          <span className="value mono">{p.hash}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                  {details.payment && (
                    <section>
                      <h3>Payment</h3>
                      <ul className="kv">
                        {details.payment.amount != null && <li><span className="key">amount</span><span className="value">{money.format(details.payment.amount)} PLT</span></li>}
                        {details.payment.receiptId && <li><span className="key">receipt</span><span className="value mono">{details.payment.receiptId}</span></li>}
                      </ul>
                    </section>
                  )}
                </div>
              )}
            </div>
          </aside>
        </>
      )}

      {routeDrawer.open && (
        <>
          <button className="backdrop" aria-label="Close route" onClick={() => setRouteDrawer({ open: false })} />
          <aside className="drawer" role="dialog" aria-label="Route details" aria-modal="true">
            <div className="drawer-header">
              <div className="title">
                <span className="type">Route</span>
                <span className="sep">•</span>
                <span className="mono">{routeDrawer.routeId}</span>
              </div>
            </div>
            <div className="drawer-body">
              <div className="detail-grid">
                <section>
                  <h3>Parties</h3>
                  <ul className="kv">
                    <li><span className="key">manufacturer</span><span className="value mono">0xmanu…</span></li>
                    <li><span className="key">carrier</span><span className="value mono">0xcar…</span></li>
                    <li><span className="key">distributor</span><span className="value mono">0xdist…</span></li>
                    <li><span className="key">retailer</span><span className="value mono">0xret…</span></li>
                  </ul>
                </section>
                <section>
                  <h3>Integrity</h3>
                  <ul className="kv">
                    <li><span className="key">manifest</span><span className="value mono">hash_…</span></li>
                    <li><span className="key">last event</span><span className="value">on-chain</span></li>
                    <li><span className="key">checks</span><span className="value">✓ ✓ ⚠ ✓</span></li>
                  </ul>
                </section>
              </div>
            </div>
          </aside>
        </>
      )}

      {checkpointDrawer.open && (
        <>
          <button className="backdrop" aria-label="Close checkpoint" onClick={() => setCheckpointDrawer({ open: false })} />
          <aside className="drawer" role="dialog" aria-label="Checkpoint details" aria-modal="true">
            <div className="drawer-header">
              <div className="title">
                <span className="type">Checkpoint</span>
                <span className="sep">•</span>
                <span className="mono">{checkpointDrawer.routeId} • hop {checkpointDrawer.hopIndex}</span>
              </div>
            </div>
            <div className="drawer-body">
              <div className="detail-grid">
                <section>
                  <h3>Txn</h3>
                  <ul className="kv">
                    <li><span className="key">txHash</span><span className="value mono">—</span></li>
                    <li><span className="key">receipt</span><span className="value mono">—</span></li>
                  </ul>
                </section>
                <section>
                  <h3>Participants</h3>
                  <ul className="kv">
                    <li><span className="key">from</span><span className="value mono">—</span></li>
                    <li><span className="key">to</span><span className="value mono">—</span></li>
                  </ul>
                </section>
                <section>
                  <h3>Geo</h3>
                  <ul className="kv">
                    <li><span className="key">geohash</span><span className="value mono">—</span></li>
                    <li><span className="key">accuracy</span><span className="value">—</span></li>
                  </ul>
                </section>
                <section>
                  <h3>SLA</h3>
                  <ul className="kv">
                    <li><span className="key">planned</span><span className="value">—</span></li>
                    <li><span className="key">actual</span><span className="value">—</span></li>
                    <li><span className="key">delta</span><span className="value">—</span></li>
                  </ul>
                </section>
                <section>
                  <h3>Security</h3>
                  <ul className="kv">
                    <li><span className="key">signature</span><span className="value">✓</span></li>
                    <li><span className="key">nonce</span><span className="value">✓</span></li>
                    <li><span className="key">ordering</span><span className="value">✓</span></li>
                    <li><span className="key">meta root</span><span className="value">✓</span></li>
                  </ul>
                </section>
              </div>
          </div>
          </aside>
        </>
      )}



    </section>
  )
}

function HeroMapMulti({ routePoints, livePositions, shipments }: { routePoints: Array<[number, number]>; livePositions: Record<string, { lat: number; lng: number; ts: number }>; shipments: Array<{ id: string; name: string; status: string; path: Array<{ lat: number; lng: number }>; stops?: Array<{ lat: number; lng: number; label: string; type: 'hub' | 'proof' }>; progress?: { percentage: number }; custodian?: string; eta?: string; sla?: string }> }) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const leafletRef = useRef<L.Map | null>(null)
  const truckMarkersRef = useRef<Record<string, L.Marker>>({})
  const routeRef = useRef<L.Polyline | null>(null)
  const pathLayersRef = useRef<Record<string, L.Polyline>>({})
  const stopLayersRef = useRef<Record<string, L.Marker[]>>({})
  const [mapLoading, setMapLoading] = useState(true)
  const [mapView, setMapView] = useState<'satellite' | 'street' | 'terrain'>('street')
  const [showLegend, setShowLegend] = useState(true)

  const switchMapView = (view: 'satellite' | 'street' | 'terrain') => {
    const map = leafletRef.current
    if (!map || !(map as any).tileLayers) return

    // Remove current layer
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer)
      }
    })

    // Add new layer
    ;(map as any).tileLayers[view].addTo(map)
    setMapView(view)
  }

  const resetMapView = () => {
    const map = leafletRef.current
    if (!map) return
    
    if (shipments && shipments.length > 0) {
      const allPoints: [number, number][] = []
      shipments.forEach(shipment => {
        if (shipment.path && shipment.path.length > 0) {
          shipment.path.forEach(point => {
            allPoints.push([point.lat, point.lng])
          })
        }
      })
      
      if (allPoints.length > 0) {
        const bounds = L.latLngBounds(allPoints)
        map.fitBounds(bounds, { padding: [40, 40] })
      }
    } else {
      map.setView([54.7024, -3.2766], 6)
    }
  }

  useEffect(() => {
    if (!mapRef.current || leafletRef.current) return
    
    const map = L.map(mapRef.current as HTMLDivElement, {
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
      zoomSnap: 0.5,
      zoomDelta: 0.5,
      worldCopyJump: false,
      maxBounds: undefined,
    })
    leafletRef.current = map

    // Modern tile layers
    const tileLayers = {
      street: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 20,
        attribution: '© OpenStreetMap contributors'
      }),
      satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 20,
        attribution: '© Esri'
      }),
      terrain: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        attribution: '© OpenTopoMap'
      })
    }

    // Add initial tile layer
    tileLayers[mapView].addTo(map)

    // Set initial view to UK
    map.setView([54.7024, -3.2766], 6)

    // Map ready handler
    map.whenReady(() => {
      setMapLoading(false)
      try {
        ;(mapRef.current as HTMLDivElement).style.borderRadius = '20px'
        // Force map to resize and fill container
        setTimeout(() => {
          map.invalidateSize()
        }, 100)
      } catch {}
    })

    // Store tile layers for switching
    ;(map as any).tileLayers = tileLayers
  }, [mapView])

  // Handle window resize to ensure map fills container
  useEffect(() => {
    const handleResize = () => {
      const map = leafletRef.current
      if (map) {
        setTimeout(() => {
          map.invalidateSize()
        }, 100)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const map = leafletRef.current
    if (!map) return

    // Only fit bounds if we have actual shipments, not sample route points
    if (shipments && shipments.length > 0) {
      const allPoints: [number, number][] = []
      shipments.forEach(shipment => {
        if (shipment.path && shipment.path.length > 0) {
          shipment.path.forEach(point => {
            allPoints.push([point.lat, point.lng])
          })
        }
      })
      
      if (allPoints.length > 0) {
        const bounds = L.latLngBounds(allPoints)
        map.fitBounds(bounds, { padding: [20, 20] })
      }
    } else if (routePoints && routePoints.length >= 2) {
      // Draw sample route but don't fit bounds to keep UK view
      if (routeRef.current) routeRef.current.remove()
      const route = L.polyline(routePoints, { color: '#3b82f6', weight: 4, opacity: 0.9 }).addTo(map)
      routeRef.current = route
    }
    return () => {}
  }, [routePoints, shipments])

  // Update/create truck markers and draw shipment polylines
  useEffect(() => {
    const map = leafletRef.current
    if (!map) return
    
    const existing = truckMarkersRef.current
    for (const routeId of Object.keys(livePositions || {})) {
      const p = livePositions[routeId]
      const latlng = L.latLng(p.lat, p.lng)
      
      // Calculate bearing from previous position
      const prev = existing[routeId]?.getLatLng()
      let bearing = 0
      if (prev) {
        const dy = latlng.lat - prev.lat
        const dx = latlng.lng - prev.lng
        bearing = (Math.atan2(dx, dy) * 180) / Math.PI
      }
      
      // Create enhanced truck icon with status indicator
      const shipment = shipments.find(s => s.id === routeId)
      const statusColor = shipment?.status === 'in_transit' ? '#3b82f6' : 
                         shipment?.status === 'delivered' ? '#10b981' : 
                         shipment?.status === 'cancelled' ? '#ef4444' : 
                         shipment?.status === 'paused' ? '#f59e0b' : '#6b7280'
      
      const icon = L.divIcon({
        html: `
          <div style="position: relative; transform: rotate(${bearing}deg); transform-origin: center;">
            <div style="
              width: 40px; 
              height: 40px; 
              background: ${statusColor};
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
              border: 3px solid white;
            ">
              <div style="
                width: 24px; 
                height: 24px; 
                background-image: url('${truckPng}'); 
                background-size: contain; 
                background-repeat: no-repeat; 
                background-position: center;
                filter: brightness(0) invert(1);
              "></div>
            </div>
            <div style="
              position: absolute;
              top: -8px;
              right: -8px;
              width: 16px;
              height: 16px;
              background: ${statusColor};
              border-radius: 50%;
              border: 2px solid white;
              animation: pulse 2s infinite;
            "></div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        className: 'truck-marker'
      })
      
      if (!existing[routeId]) {
        const marker = L.marker([p.lat, p.lng], { icon }).addTo(map)
        
        // Add enhanced tooltip
        if (shipment) {
          const tooltipContent = `
            <div style="padding: 8px; min-width: 200px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <div style="width: 8px; height: 8px; background: ${statusColor}; border-radius: 50%;"></div>
                <strong style="color: var(--text); font-size: 14px;">${shipment.name}</strong>
              </div>
              <div style="font-size: 12px; color: var(--muted); margin-bottom: 4px;">
                Status: <span style="color: ${statusColor}; font-weight: 600;">${shipment.status.replace('_', ' ')}</span>
              </div>
              <div style="font-size: 12px; color: var(--muted); margin-bottom: 4px;">
                ID: <span style="font-family: monospace;">${shipment.id}</span>
              </div>
              ${shipment.progress ? `
                <div style="font-size: 12px; color: var(--muted); margin-bottom: 4px;">
                  Progress: <span style="color: var(--text); font-weight: 600;">${shipment.progress.percentage}%</span>
                </div>
              ` : ''}
              ${shipment.eta ? `
                <div style="font-size: 12px; color: var(--muted);">
                  ETA: <span style="color: var(--text); font-weight: 600;">${shipment.eta}</span>
                </div>
              ` : ''}
            </div>
          `
          
          marker.bindTooltip(tooltipContent, {
            permanent: false,
            direction: 'top',
            offset: [0, -10],
            className: 'custom-tooltip'
          })
        }
        
        existing[routeId] = marker
      } else {
        existing[routeId].setLatLng(latlng)
        existing[routeId].setIcon(icon)
      }
    }
    // Paths & stops
    const paths = pathLayersRef.current
    const stopsMap = stopLayersRef.current
    for (const s of shipments || []) {
      if (!paths[s.id] && s.path && s.path.length >= 2) {
        // Determine route color based on status and progress
        let routeColor = '#d1d5db' // Default gray
        if (s.status === 'delivered') {
          routeColor = '#22c55e' // Green for completed
        } else if (s.status === 'cancelled') {
          routeColor = '#ef4444' // Red for cancelled
        } else if (s.status === 'paused') {
          routeColor = '#f59e0b' // Orange for paused
        } else if (s.status === 'in_transit') {
          // Calculate progress-based color for in-transit shipments
          const progress = s.progress?.percentage || 0
          if (progress < 25) {
            routeColor = '#8b5cf6' // Purple for early stage (changed from red to avoid conflict with cancelled)
          } else if (progress < 50) {
            routeColor = '#f59e0b' // Orange for quarter way
          } else if (progress < 75) {
            routeColor = '#3b82f6' // Blue for halfway
          } else {
            routeColor = '#10b981' // Green for near completion
          }
        }
        
        const isActive = s.status === 'in_transit'
        paths[s.id] = L.polyline(s.path.map(pt => [pt.lat, pt.lng]), { 
          color: routeColor, 
          weight: isActive ? 5 : 3,
          opacity: isActive ? 0.9 : 0.6,
          dashArray: s.status === 'paused' ? '10, 10' : undefined,
          className: `route-path route-${s.status}`
        }).addTo(map)
        
        // Add path animation for active routes
        if (isActive) {
          const pathElement = paths[s.id].getElement() as HTMLElement
          if (pathElement) {
            pathElement.style.strokeDasharray = '20, 20'
            pathElement.style.animation = 'dash 2s linear infinite'
          }
        }
      }
      if (s.stops && !stopsMap[s.id]) {
        stopsMap[s.id] = s.stops.map((st, index) => {
          const color = st.type === 'hub' ? '#3b82f6' : '#10b981'
          const icon = L.divIcon({
            html: `
              <div style="
                width: 24px; 
                height: 24px; 
                background: ${color};
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                border: 3px solid white;
                position: relative;
              ">
                <div style="
                  width: 8px; 
                  height: 8px; 
                  background: white; 
                  border-radius: 50%;
                "></div>
                <div style="
                  position: absolute;
                  top: -4px;
                  right: -4px;
                  width: 12px;
                  height: 12px;
                  background: ${color};
                  border-radius: 50%;
                  border: 2px solid white;
                  font-size: 8px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: white;
                  font-weight: bold;
                ">${index + 1}</div>
              </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
            className: 'stop-marker'
          })
          
          const marker = L.marker([st.lat, st.lng], { icon }).addTo(map)
          
          // Create rich tooltip with metadata
          const tooltipContent = `
            <div style="font-family: system-ui, -apple-system, sans-serif; font-size: 12px; line-height: 1.4;">
              <div style="font-weight: 600; color: #111827; margin-bottom: 4px;">${st.label}</div>
              <div style="color: #6b7280; margin-bottom: 2px;"><strong>Type:</strong> ${st.type}</div>
              <div style="color: #6b7280; margin-bottom: 2px;"><strong>Route:</strong> ${s.name}</div>
              <div style="color: #6b7280; margin-bottom: 2px;"><strong>Stop #:</strong> ${index + 1} of ${s.stops?.length || 0}</div>
              <div style="color: #6b7280; margin-bottom: 2px;"><strong>Coordinates:</strong> ${st.lat.toFixed(6)}, ${st.lng.toFixed(6)}</div>
              <div style="color: #6b7280; margin-bottom: 2px;"><strong>Status:</strong> ${s.status.replace('_', ' ')}</div>
              ${s.custodian ? `<div style="color: #6b7280; margin-bottom: 2px;"><strong>Custodian:</strong> ${s.custodian}</div>` : ''}
              ${s.eta ? `<div style="color: #6b7280; margin-bottom: 2px;"><strong>ETA:</strong> ${s.eta}</div>` : ''}
              ${s.sla ? `<div style="color: #6b7280;"><strong>SLA:</strong> ${s.sla}</div>` : ''}
            </div>
          `
          
          marker.bindTooltip(tooltipContent, { 
            permanent: false,
            direction: 'top',
            offset: [0, -10],
            className: 'custom-tooltip'
          })
          return marker
        })
      }
    }
  }, [livePositions, shipments])

  return (
    <div className="mini-map-board" style={{ height: 420, position: 'relative' }}>
      <div className="map-container" ref={mapRef} style={{ position: 'absolute', inset: 0, height: '100%', width: '100%' }} />
      
      {/* Map Loading State */}
      {mapLoading && (
        <div className="map-loading">
          <div className="map-loading-spinner"></div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)' }}>Loading map...</div>
        </div>
      )}
      
      {/* Map Status Indicator */}
      <div className="map-status">
        <div className="map-status-dot"></div>
        Live Tracking
      </div>
      
      {/* Map Controls */}
      <div className="map-controls">
        <button 
          className={`map-control-btn ${mapView === 'street' ? 'active' : ''}`}
          onClick={() => switchMapView('street')}
          title="Street View"
        >
          <Map size={18} />
        </button>
        <button 
          className={`map-control-btn ${mapView === 'satellite' ? 'active' : ''}`}
          onClick={() => switchMapView('satellite')}
          title="Satellite View"
        >
          <Activity size={18} />
        </button>
        <button 
          className={`map-control-btn ${mapView === 'terrain' ? 'active' : ''}`}
          onClick={() => switchMapView('terrain')}
          title="Terrain View"
        >
          <Zap size={18} />
        </button>
        <button 
          className="map-control-btn"
          onClick={resetMapView}
          title="Reset View"
        >
          <MapPinIcon size={18} />
        </button>
        <button 
          className={`map-control-btn ${showLegend ? 'active' : ''}`}
          onClick={() => setShowLegend(!showLegend)}
          title="Toggle Legend"
        >
          <Shield size={18} />
        </button>
      </div>
      
      {/* Map Legend */}
      {showLegend && (
        <div className="map-legend">
          <h4>Legend</h4>
          <div className="legend-item">
            <div className="legend-color" style={{ background: '#3b82f6' }}></div>
            <span>In Transit</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: '#10b981' }}></div>
            <span>Delivered</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: '#f59e0b' }}></div>
            <span>Paused</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: '#ef4444' }}></div>
            <span>Cancelled</span>
          </div>
          <div className="legend-item">
            <div className="legend-line" style={{ background: 'linear-gradient(90deg, #3b82f6, #10b981)' }}></div>
            <span>Active Route</span>
          </div>
          <div className="legend-item">
            <div className="legend-line" style={{ background: '#6b7280' }}></div>
            <span>Inactive Route</span>
          </div>
        </div>
      )}
      
      {/* Map Info Panel */}
      <div className="map-info-panel">
        <div className="icon"><TruckIcon size={20} /></div>
        <div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>Active Shipments</div>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)' }}>
            {Object.keys(livePositions || {}).length} of {shipments.length}
          </div>
        </div>
      </div>
    </div>
  )
}

function KpiStat({ icon, value, label }: { icon: string; value: string | number; label: string }) {
  return (
    <div className="card kpi">
      <div className="kpi-top">
        <div className="kpi-icon" aria-hidden>{icon}</div>
        <div className="kpi-value">{value}</div>
      </div>
      <div className="label">{label}</div>
    </div>
  )
}

type RoutePoint = { lat: number; lng: number; status?: 'met' | 'late' | 'missed' | 'pending' }
type MiniRoute = { id: string; points: RoutePoint[]; milestones?: number[] }

function MiniMap({ pins, loading, height, routes, livePositions }: { pins: Array<{ id: string; lat: number; lng: number; status: string; name?: string; address?: string }>; loading?: boolean; height?: number; routes?: MiniRoute[]; livePositions?: Record<string, { lat: number; lng: number; ts: number }> }) {
  if (loading) {
    return <div className="skeleton tall" />
  }

  if (pins.length === 0) {
    return (
      <div className="mini-map-board">
        <div className="empty-map">No supply chain locations</div>
      </div>
    )
  }

  // Calculate bounds for the map
  const lats = pins.map(p => p.lat)
  const lngs = pins.map(p => p.lng)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  
  // Add padding to bounds
  const latPadding = (maxLat - minLat) * 0.1 || 0.01
  const lngPadding = (maxLng - minLng) * 0.1 || 0.01
  
  const bounds = `${minLng - lngPadding},${minLat - latPadding},${maxLng + lngPadding},${maxLat + latPadding}`
  
  // Create markers string for all pins
  const markers = pins.map(p => `${p.lat},${p.lng}`).join('&marker=')

  return (
    <div className="mini-map-board neu-map" aria-busy={loading ? true : undefined} style={{ position: 'relative', height: height ?? 200 }}>
      <iframe
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${bounds}&layer=mapnik&marker=${markers}`}
        width="100%"
        height="100%"
        style={{ border: 'none', borderRadius: '16px', filter: 'grayscale(1) contrast(0.9) brightness(1.05)' }}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        title="Supply Chain Map"
      />
      <svg className="route-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
        {(routes ?? []).map((r) => {
          if (!r.points || r.points.length < 2) return null
          const pts = r.points.map(p => {
            const x = ((p.lng - (minLng - lngPadding)) / ((maxLng + lngPadding) - (minLng - lngPadding))) * 100
            const y = ((maxLat + latPadding - p.lat) / ((maxLat + latPadding) - (minLat - latPadding))) * 100
            return { x, y, status: p.status }
          })
          // Base polyline (light gray)
          const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
          return (
            <g key={r.id}>
              <path d={d} fill="none" stroke="#d1d5db" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
              {pts.slice(0, -1).map((p, i) => {
                const n = pts[i + 1]
                const seg = `M ${p.x} ${p.y} L ${n.x} ${n.y}`
                const st = n.status || 'pending'
                const color = st === 'met' ? '#22c55e' : st === 'late' ? '#f59e0b' : st === 'missed' ? '#ef4444' : '#9ca3af'
                return <path key={`${r.id}-seg-${i}`} d={seg} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
              })}
              {(r.milestones ?? [0, pts.length - 1]).map((mi, idx) => {
                const p = pts[Math.max(0, Math.min(pts.length - 1, mi))]
                return (
                  <g key={`${r.id}-ms-${idx}`}>
                    <circle cx={p.x} cy={p.y} r={2.2} fill="#fff" />
                    <circle cx={p.x} cy={p.y} r={1.2} fill="#bfc7d2" />
                  </g>
                )
              })}
              {livePositions && livePositions[r.id] && (() => {
                const lp = livePositions[r.id]
                const x = ((lp.lng - (minLng - lngPadding)) / ((maxLng + lngPadding) - (minLng - lngPadding))) * 100
                const y = ((maxLat + latPadding - lp.lat) / ((maxLat + latPadding) - (minLat - latPadding))) * 100
                return <circle cx={x} cy={y} r={2.4} fill="#3b82f6" stroke="#fff" strokeWidth={0.6} />
              })()}
            </g>
          )
        })}
      </svg>
      <div className="map-overlay" style={{ position: 'absolute', inset: 0 }}>
        <div className="supply-pins">
          {pins.map((p) => {
            // Calculate position on the map based on bounds
            const x = ((p.lng - (minLng - lngPadding)) / ((maxLng + lngPadding) - (minLng - lngPadding))) * 100
            const y = ((maxLat + latPadding - p.lat) / ((maxLat + latPadding) - (minLat - latPadding))) * 100
            
            return (
              <div 
                key={p.id} 
                className={`supply-pin ${p.status}`}
                style={{ 
                  left: `${x}%`, 
                  top: `${y}%`,
                  transform: 'translate(-50%, -50%)'
                }}
                title={`${p.name || p.id}\n${p.address || `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`}\nStatus: ${p.status}`}
                aria-label={`${p.name || p.id} - ${p.status}`}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

function PayTagForm({ onSubmit, result }: { onSubmit: (payload: any) => void; result: { svg?: string; json?: Record<string, unknown> } }) {
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  return (
    <div className="modal-body">
      <h3>Generate PayTag</h3>
      <div className="form">
        <label>
          Amount (PLT)
          <input inputMode="decimal" placeholder="25.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label>
          Memo
          <input placeholder="Order #123" value={memo} onChange={(e) => setMemo(e.target.value)} />
        </label>
      </div>
      <div className="modal-actions">
        <button onClick={() => onSubmit({ amount: Number(amount || '0'), memo })}>Create</button>
      </div>
      {result.svg && (
        <div className="qr-wrap">
          <img src={result.svg} alt="PayTag QR" />
          <div className="qr-caption">Signed QR • JSON below</div>
          <pre className="json small">{JSON.stringify(result.json, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}

function ProofTagForm({ onSubmit, result }: { onSubmit: (payload: any) => void; result: { svg?: string; json?: Record<string, unknown> } }) {
  const [jobTitle, setJobTitle] = useState('')
  const [worker, setWorker] = useState('')
  const [address, setAddress] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [radius, setRadius] = useState('50')
  const [payout, setPayout] = useState('')
  const [geocoding, setGeocoding] = useState(false)
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null)

  const handleGeocode = async () => {
    if (!address.trim()) return
    setGeocoding(true)
    try {
      const result = await geocodeAddress(address)
      if (result) {
        setLat(result.lat.toString())
        setLng(result.lng.toString())
        setCoordinates({ lat: result.lat, lng: result.lng })
      }
    } catch (error) {
      console.error('Geocoding failed:', error)
    } finally {
      setGeocoding(false)
    }
  }

  return (
    <div className="modal-body">
      <h3>Create ProofTag</h3>
      <div className="form">
        <label>Job title<input placeholder="Harvester" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} /></label>
        <label>Worker hash<input className="mono" placeholder="0xworker" value={worker} onChange={(e) => setWorker(e.target.value)} /></label>
        <label>
          Location Address
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              placeholder="123 Mission St, San Francisco, CA" 
              value={address} 
              onChange={(e) => setAddress(e.target.value)}
              style={{ flex: 1 }}
            />
            <button 
              type="button" 
              onClick={handleGeocode} 
              disabled={geocoding || !address.trim()}
              style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}
            >
              {geocoding ? '...' : '📍'}
            </button>
          </div>
        </label>
        <label>Latitude<input inputMode="decimal" placeholder="37.77" value={lat} onChange={(e) => setLat(e.target.value)} /></label>
        <label>Longitude<input inputMode="decimal" placeholder="-122.42" value={lng} onChange={(e) => setLng(e.target.value)} /></label>
        <label>Radius (m)<input inputMode="numeric" placeholder="50" value={radius} onChange={(e) => setRadius(e.target.value)} /></label>
        <label>Payout (PLT)<input inputMode="decimal" placeholder="40.00" value={payout} onChange={(e) => setPayout(e.target.value)} /></label>
        {coordinates && (
          <div style={{ padding: '8px', background: 'rgba(79,140,255,0.1)', borderRadius: '8px', fontSize: '12px', color: 'var(--muted)' }}>
            📍 {coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}
          </div>
        )}
      </div>
      <div className="modal-actions">
        <button onClick={() => onSubmit({ jobTitle, worker, lat: Number(lat || '0'), lng: Number(lng || '0'), radius: Number(radius || '0'), payout: Number(payout || '0'), address })}>Create</button>
      </div>
      {result.svg && (
        <div className="qr-wrap">
          <img src={result.svg} alt="ProofTag QR" />
          <div className="qr-caption">Signed QR • JSON below</div>
          <pre className="json small">{JSON.stringify(result.json, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}

function UnitTagForm({ onSubmit, result }: { onSubmit: (payload: any) => void; result: { svg?: string; json?: Record<string, unknown> } }) {
  const [sku, setSku] = useState('')
  const [batch, setBatch] = useState('')
  const [qty, setQty] = useState('')
  const [meta, setMeta] = useState('')
  return (
    <div className="modal-body">
      <h3>Register Batch</h3>
      <div className="form">
        <label>SKU<input placeholder="SKU-123" value={sku} onChange={(e) => setSku(e.target.value)} /></label>
        <label>Batch id<input className="mono" placeholder="batch_7x91" value={batch} onChange={(e) => setBatch(e.target.value)} /></label>
        <label>Quantity<input inputMode="numeric" placeholder="100" value={qty} onChange={(e) => setQty(e.target.value)} /></label>
        <label>Metadata URL/IPFS<input placeholder="ipfs://… or https://…" value={meta} onChange={(e) => setMeta(e.target.value)} /></label>
      </div>
      <div className="modal-actions">
        <button onClick={() => onSubmit({ sku, batch, quantity: Number(qty || '0'), metadata: meta })}>Create</button>
      </div>
      {result.svg && (
        <div className="qr-wrap">
          <img src={result.svg} alt="UnitTag QR" />
          <div className="qr-caption">Signed QR • JSON below</div>
          <pre className="json small">{JSON.stringify(result.json, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}



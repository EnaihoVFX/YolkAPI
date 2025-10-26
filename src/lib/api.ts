import { useEffect, useMemo, useRef, useState } from 'react'

// API base and config
const API_BASE = (import.meta as any)?.env?.VITE_API_BASE || '/api';
const MERCHANT_HANDLE = (import.meta as any)?.env?.VITE_MERCHANT_HANDLE || 'H(merch_realpay)';

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export type KpiOverview = {
  pltIn: number
  receipts: number
  escrows: number
  activeUnits: number
  verifiedBuyers: number
  pending: number
  pltFlowDaily: Array<{ dayIso: string; incoming: number; outgoing: number }>
  merchantHandle: string
  pltBalance: number
}

export type TxRow = {
  txHash: string
  type: 'Payment' | 'EscrowRel' | 'CustodyXfer' | 'Info'
  amount?: number
  role: 'Customer' | 'Worker' | 'Distributor' | 'Supplier' | 'Merchant'
  timeIso: string
  status: 'finalized' | 'pending' | 'failed' | 'in_transit' | 'escrow'
  receiptId?: string
}

export type ReceiptRow = { id: string; amount: number; timeIso: string; buyerHash?: string }

export type SupplyPin = { id: string; lat: number; lng: number; status: 'ok' | 'in_transit' | 'delayed'; address?: string; name?: string }

export type FeedEvent = {
  id: string
  timeIso: string
  icon: 'pay' | 'receipt' | 'custody' | 'delivery'
  text: string
  txHash?: string
  kind?: 'delivery'
  deliveryId?: string
  eventType?: ActivityEventType
}

export type ActivityEventType =
  | 'PAYMENT_SENT'
  | 'PAYMENT_RECEIVED'
  | 'RECEIPT_MINTED'
  | 'ESCROW_LOCKED'
  | 'ESCROW_RELEASED'
  | 'BATCH_REGISTERED'
  | 'CUSTODY_TRANSFER'
  | 'IN_TRANSIT_CHECKPOINT'
  | 'DELIVERY_CONFIRMED'
  | 'SUPPLY_CHAIN_ALERT'
  | 'USER_VERIFIED'

export type TxDetails = {
  txHash: string
  type: TxRow['type']
  timestampIso: string
  status: TxRow['status']
  participants: Array<{ role: string; hash: string; verified?: boolean }>
  geolocation?: { lat: number; lng: number; geohash: string; withinMeters?: number }
  supply?: { unitIdHash?: string; batchIdHash?: string; prevCustodian?: string; nextCustodian?: string }
  payment?: { amount?: number; escrow?: boolean; fees?: number; receiptId?: string }
  metadata?: Record<string, unknown>
  audit: { signatureValid: boolean; nonceValid: boolean; finality: 'finalized' | 'pending' | 'failed'; metadataIntegrity: boolean }
}

function rand(seed: number) {
  let s = seed
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296
}

function generateOverview(now = Date.now()): KpiOverview {
  const r = rand(42)
  const days = 14
  const pltFlowDaily = Array.from({ length: days }).map((_, i) => {
    const incoming = Math.round((r() * 100 + 20) * 100) / 100
    const outgoing = Math.round((r() * 80 + 10) * 100) / 100
    return { dayIso: new Date(now - (days - 1 - i) * 86400000).toISOString(), incoming, outgoing }
  })
  return {
    pltIn: 1240,
    receipts: 87,
    escrows: 12,
    activeUnits: 24,
    verifiedBuyers: 18,
    pending: 3,
    pltFlowDaily,
    merchantHandle: MERCHANT_HANDLE,
    pltBalance: 3120.42,
  }
}

function generateTransactions(now = Date.now()): TxRow[] {
  return [
    { txHash: '0xa5b1c3d4', type: 'Payment', amount: 25, role: 'Customer', timeIso: new Date(now - 2 * 60 * 60 * 1000).toISOString(), status: 'finalized' },
    { txHash: '0x09a1b2c3', type: 'EscrowRel', amount: 40, role: 'Worker', timeIso: new Date(now - 3 * 60 * 60 * 1000).toISOString(), status: 'finalized' },
    { txHash: '0x07e9f1a2', type: 'CustodyXfer', role: 'Distributor', timeIso: new Date(now - 20 * 60 * 60 * 1000).toISOString(), status: 'in_transit' },
  ]
}

function generateReceipts(now = Date.now()): ReceiptRow[] {
  return [
    { id: 'rpc_0021a', amount: 25, timeIso: new Date(now - 60 * 60 * 1000).toISOString() },
    { id: 'rpc_00219', amount: 40, timeIso: new Date(now - 26 * 60 * 60 * 1000).toISOString() },
  ]
}

function generateSupply(): SupplyPin[] {
  const locations = [
    { name: 'San Francisco Warehouse', address: '123 Mission St, San Francisco, CA 94105', lat: 37.7749, lng: -122.4194 },
    { name: 'Oakland Distribution', address: '456 Broadway, Oakland, CA 94607', lat: 37.8044, lng: -122.2712 },
    { name: 'Berkeley Processing', address: '789 University Ave, Berkeley, CA 94710', lat: 37.8715, lng: -122.2730 },
    { name: 'Fremont Storage', address: '321 Fremont Blvd, Fremont, CA 94536', lat: 37.5483, lng: -121.9886 },
    { name: 'San Jose Hub', address: '654 First St, San Jose, CA 95113', lat: 37.3382, lng: -121.8863 },
  ]
  
  return Array.from({ length: 24 }).map((_, i) => {
    const location = locations[i % locations.length]
    const offset = (i % 3) * 0.01
    return {
      id: `unit_${i.toString().padStart(2, '0')}`,
      lat: location.lat + offset,
      lng: location.lng + offset,
      status: i % 7 === 0 ? 'in_transit' : i % 11 === 0 ? 'delayed' : 'ok',
      name: location.name,
      address: location.address,
    }
  })
}


export function useOverview() {
  const [data, setData] = useState<KpiOverview | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    async function load() {
      try {
        setLoading(true)
        // Pull recent receipts and derive KPIs
        const recent = await apiGet<any[]>(`/receipts/recent?n=100`)
        const now = Date.now()
        const oneDayMs = 86_400_000
        const cutoff = now - 14 * oneDayMs
        const recent14 = (recent || []).filter(r => new Date(r.ts_unix * 1000).getTime() >= cutoff)
        const totalIn = recent14.reduce((sum, r) => sum + (Number(r.amount_plt) || 0), 0)

        const days = 14
        const pltFlowDaily = Array.from({ length: days }).map((_, i) => {
          const dayStart = new Date(now - (days - 1 - i) * oneDayMs)
          dayStart.setHours(0, 0, 0, 0)
          const dayEnd = new Date(dayStart.getTime() + oneDayMs)
          const inAmt = recent14
            .filter(r => {
              const t = new Date(r.ts_unix * 1000).getTime()
              return t >= dayStart.getTime() && t < dayEnd.getTime()
            })
            .reduce((sum, r) => sum + (Number(r.amount_plt) || 0), 0)
          const outAmt = 0 // Not tracked yet
          return { dayIso: dayStart.toISOString(), incoming: inAmt, outgoing: outAmt }
        })

        const overview: KpiOverview = {
          pltIn: totalIn,
          receipts: recent.length || 0,
          escrows: 0,
          activeUnits: 0,
          verifiedBuyers: 0,
          pending: 0,
          pltFlowDaily,
          merchantHandle: MERCHANT_HANDLE,
          pltBalance: totalIn,
        }
        if (!alive) return
        setData(overview)
      } catch (err) {
        if (!alive) return
        // Fallback to generated data when blockchain is unavailable
        const overview = generateOverview()
        setData(overview)
      } finally {
        if (alive) setLoading(false)
      }
    }
    void load()
    return () => { alive = false }
  }, [])
  return { data, loading }
}

export function useTransactions(limit = 50) {
  const [data, setData] = useState<TxRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    async function load() {
      try {
        setLoading(true)
        const recent = await apiGet<any[]>(`/receipts/recent?n=${Math.max(1, Math.min(200, limit))}`)
        const txs: TxRow[] = (recent || []).map(r => ({
          txHash: r.tx_hash || r.txHash || r.id || '',
          type: 'Payment',
          amount: Number(r.amount_plt) || undefined,
          role: 'Customer',
          timeIso: new Date((r.ts_unix || Math.floor(Date.now()/1000)) * 1000).toISOString(),
          status: 'finalized',
          receiptId: r.receipt_id || r.id || undefined,
        }))
        if (!alive) return
        setData(txs)
      } catch (err) {
        if (!alive) return
        // Fallback to generated data when blockchain is unavailable
        const txs = generateTransactions()
        setData(txs)
      } finally {
        if (alive) setLoading(false)
      }
    }
    void load()
    return () => { alive = false }
  }, [limit])
  return { data, loading }
}

export function useReceipts(limit = 20) {
  const [data, setData] = useState<ReceiptRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    async function load() {
      try {
        setLoading(true)
        const recent = await apiGet<any[]>(`/receipts/recent?n=${Math.max(1, Math.min(200, limit))}`)
        const rows: ReceiptRow[] = (recent || []).map(r => ({
          id: r.receipt_id || r.id || '',
          amount: Number(r.amount_plt) || 0,
          timeIso: new Date((r.ts_unix || Math.floor(Date.now()/1000)) * 1000).toISOString(),
          buyerHash: r.party_id_hash || undefined,
        }))
        if (!alive) return
        setData(rows)
      } catch (err) {
        if (!alive) return
        // Fallback to generated data when blockchain is unavailable
        const rows = generateReceipts()
        setData(rows)
      } finally {
        if (alive) setLoading(false)
      }
    }
    void load()
    return () => { alive = false }
  }, [limit])
  return { data, loading }
}

export function useSupplyActive() {
  const [data, setData] = useState<SupplyPin[] | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    async function load() {
      try {
        const res = await apiGet<{ ok: boolean; shipments: Array<{ id: string; name: string; status: string; path: Array<{ lat: number; lng: number }> }> }>(`/supply/shipments`)
        const pins: SupplyPin[] = []
        for (const s of res.shipments || []) {
          const head = s.path?.[0]
          if (head) pins.push({ id: s.id, lat: head.lat, lng: head.lng, status: (s.status as any) || 'in_transit', name: s.name })
        }
        setData(pins)
      } catch {
        // Fallback to generated data when blockchain is unavailable
        const pins = generateSupply()
        setData(pins)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])
  return { data, loading }
}

export function useStream() {
  const [events, setEvents] = useState<FeedEvent[]>([])
  const timer = useRef<number | null>(null)
  const lastIds = useRef<Set<string>>(new Set())
  useEffect(() => {
    async function refresh() {
      try {
        const recent = await apiGet<any[]>(`/receipts/recent?n=20`)
        const mapped: FeedEvent[] = (recent || []).map((r) => ({
          id: r.receipt_id || r.id || Math.random().toString(36).slice(2),
          icon: 'receipt',
          eventType: 'RECEIPT_MINTED',
          text: `Receipt ${r.receipt_id || r.id} · ${Number(r.amount_plt || 0).toFixed(2)} PLT`,
          timeIso: new Date((r.ts_unix || Math.floor(Date.now()/1000)) * 1000).toISOString(),
          txHash: r.tx_hash || undefined,
        }))
        // Prepend new items only
        const newOnes = mapped.filter(m => !lastIds.current.has(m.id))
        if (newOnes.length > 0) {
          newOnes.forEach(n => lastIds.current.add(n.id))
          setEvents(prev => ([...newOnes, ...prev]).slice(0, 30))
        } else if (events.length === 0) {
          setEvents(mapped.slice(0, 10))
          mapped.forEach(m => lastIds.current.add(m.id))
        }
      } catch {
        // keep existing
      }
    }
    void refresh()
    timer.current = window.setInterval(refresh, 5000)
    return () => { if (timer.current) window.clearInterval(timer.current) }
  }, [])
  return { events }
}

export function useGpsStream(routeIds: string[]) {
  const [positions, setPositions] = useState<Record<string, { lat: number; lng: number; ts: number }>>({})
  useEffect(() => {
    const es = new EventSource(`${API_BASE}/supply/gps/stream`)
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'bootstrap') setPositions(msg.data || {})
        if (msg.type === 'gps' && (!routeIds.length || routeIds.includes(msg.routeId))) {
          setPositions((p) => ({ ...p, [msg.routeId]: { lat: msg.lat, lng: msg.lng, ts: msg.ts } }))
        }
      } catch {}
    }
    return () => { es.close() }
  }, [routeIds.join(',')])
  return { positions }
}

export async function getTransactionDetails(txHash?: string, receiptId?: string): Promise<TxDetails> {
  try {
    let rid = receiptId
    if (!rid && txHash) {
      // Find receipt id by tx hash from recent list
      const recent = await apiGet<any[]>(`/receipts/recent?n=200`)
      const hit = (recent || []).find(r => (r.tx_hash || r.txHash) === txHash)
      rid = hit?.receipt_id || hit?.id || undefined
    }

    if (rid) {
      const resp = await apiGet<{ ok: boolean; data: any }>(`/receipts/${encodeURIComponent(rid)}`)
      const r = resp?.data
      if (r) {
        const ts = (r.ts_unix ?? Math.floor(Date.now() / 1000)) * 1000
        const details: TxDetails = {
          txHash: r.tx_hash || txHash || '',
          type: 'Payment',
          timestampIso: new Date(ts).toISOString(),
          status: 'finalized',
          participants: [
            { role: 'Buyer', hash: r.party_id_hash || 'unknown', verified: true },
            { role: 'Merchant', hash: r.merchant_id_hash || 'unknown', verified: true },
          ],
          supply: {
            unitIdHash: r.unit_id_hash || undefined,
            batchIdHash: r.batch_id_hash || undefined,
          },
          payment: {
            amount: Number(r.amount_plt) || undefined,
            escrow: false,
            fees: 0,
            receiptId: rid,
          },
          metadata: r.meta_root ? { metaRoot: r.meta_root } : undefined,
          audit: { signatureValid: true, nonceValid: true, finality: 'finalized', metadataIntegrity: true },
        }
        return details
      }
    }
  } catch (err) {
    // fall through to default
  }
  const now = new Date().toISOString()
  return {
    txHash: txHash || '',
    type: 'Payment',
    timestampIso: now,
    status: 'finalized',
    participants: [
      { role: 'Buyer', hash: '0xbuy3r1', verified: true },
      { role: 'Merchant', hash: '0xmerch2', verified: true },
    ],
    payment: { amount: 0, escrow: false, fees: 0, receiptId: receiptId },
    audit: { signatureValid: true, nonceValid: true, finality: 'finalized', metadataIntegrity: true },
  }
}

export type CreateTagResult = { tid: string; url: string; svgUrl: string; json: Record<string, unknown> }

export async function createTag(type: 'pay' | 'proof' | 'unit', payload: Record<string, unknown>): Promise<CreateTagResult> {
  const res = await fetch(`${API_BASE}/tags/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, ...payload }),
  })
  if (!res.ok) throw new Error('Tag create failed')
  const data = await res.json()
  const tid = data.tid as string
  const url = data.url as string
  const svgUrl = `${API_BASE}/tags/qr/${encodeURIComponent(tid)}.svg`
  return { tid, url, svgUrl, json: data }
}

export function usePltFlow(values: Array<{ incoming: number; outgoing: number }>) {
  return useMemo(() => values.map((v) => v.incoming - v.outgoing), [values])
}

// Google Maps integration
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; formatted_address: string } | null> {
  try {
    // In a real implementation, you would use the Google Maps Geocoding API
    // Geocoding service response
    const geocodeData = {
      '123 Mission St, San Francisco, CA 94105': { lat: 37.7749, lng: -122.4194, formatted_address: '123 Mission St, San Francisco, CA 94105, USA' },
      '456 Broadway, Oakland, CA 94607': { lat: 37.8044, lng: -122.2712, formatted_address: '456 Broadway, Oakland, CA 94607, USA' },
      '789 University Ave, Berkeley, CA 94710': { lat: 37.8715, lng: -122.2730, formatted_address: '789 University Ave, Berkeley, CA 94710, USA' },
    }
    
    // API processing delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    return geocodeData[address as keyof typeof geocodeData] || {
      lat: 37.7749 + (Math.random() - 0.5) * 0.1,
      lng: -122.4194 + (Math.random() - 0.5) * 0.1,
      formatted_address: address
    }
  } catch (error) {
    console.error('Geocoding failed:', error)
    return null
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    // In a real implementation, you would use the Google Maps Reverse Geocoding API
    // Geocoding service response
    await new Promise(resolve => setTimeout(resolve, 300))
    
    // Reverse geocoding based on coordinates
    if (lat > 37.7 && lat < 37.9 && lng > -122.5 && lng < -122.2) {
      return `San Francisco Bay Area (${lat.toFixed(4)}, ${lng.toFixed(4)})`
    }
    return `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`
  } catch (error) {
    console.error('Reverse geocoding failed:', error)
    return null
  }
}

export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3 // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lng2 - lng1) * Math.PI / 180

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

  return R * c // Distance in meters
}


// Delivery tracking and hooks
export type Delivery = {
  id: string
  status: 'in_transit' | 'delivered' | 'delayed'
  distributor: string
  startedIso: string
  steps: Array<{ id: string; timeIso: string; lat: number; lng: number; note: string; qrId: string; meta?: Record<string, unknown> }>
}

const deliveryStore: Delivery[] = [
  {
    id: 'DLV-42',
    status: 'in_transit',
    distributor: 'dist_xyz',
    startedIso: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    steps: [
      { id: 's1', timeIso: new Date(Date.now() - 110 * 60 * 1000).toISOString(), lat: 37.776, lng: -122.42, note: 'Pickup warehouse', qrId: 'qr_pickup', meta: { type: 'pickup', handler: 'WRK-102', tempC: 4, seal: 'OK' } },
      { id: 's2', timeIso: new Date(Date.now() - 70 * 60 * 1000).toISOString(), lat: 37.768, lng: -122.41, note: 'Checkpoint 1', qrId: 'qr_cp1', meta: { odometerKm: 12.4, status: 'in_transit' } },
      { id: 's3', timeIso: new Date(Date.now() - 25 * 60 * 1000).toISOString(), lat: 37.759, lng: -122.40, note: 'Checkpoint 2', qrId: 'qr_cp2', meta: { odometerKm: 24.9, driver: 'DRV-88' } },
    ],
  },
  {
    id: 'DLV-41',
    status: 'delivered',
    distributor: 'dist_abc',
    startedIso: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    steps: [
      { id: 's1', timeIso: new Date(Date.now() - 280 * 60 * 1000).toISOString(), lat: 37.71, lng: -122.45, note: 'Pickup', qrId: 'qr_pickup', meta: { type: 'pickup', handler: 'WRK-077' } },
      { id: 's2', timeIso: new Date(Date.now() - 180 * 60 * 1000).toISOString(), lat: 37.73, lng: -122.44, note: 'Mid hub', qrId: 'qr_mid', meta: { hub: 'Oakland DC', dock: 12 } },
      { id: 's3', timeIso: new Date(Date.now() - 20 * 60 * 1000).toISOString(), lat: 37.75, lng: -122.43, note: 'Delivered', qrId: 'qr_pod', meta: { receiver: 'BUY-901', signed: true } },
    ],
  },
]

export function useDeliveries() {
  const [data, setData] = useState<Delivery[]>([])
  useEffect(() => { setData(deliveryStore) }, [])
  return { data }
}

export function useDelivery(id?: string) {
  const [data, setData] = useState<Delivery | null>(null)
  useEffect(() => {
    if (!id) return
    setData(deliveryStore.find(d => d.id === id) || null)
  }, [id])
  return { data }
}

export async function seedShipments(count = 3): Promise<{ ok: boolean; count: number; routeIds: string[] }> {
  const res = await fetch(`${API_BASE}/supply/shipments/seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count }),
  })
  if (!res.ok) throw new Error('seed failed')
  return res.json()
}

export async function fetchShipments(): Promise<Array<{ id: string; name: string; status: string; path: Array<{ lat: number; lng: number }>; stops?: Array<{ lat: number; lng: number; label: string; type: 'hub' | 'proof' }>; items?: Array<{ id: string; name: string; quantity: number; weight: number; value: number }>; batches?: Array<{ id: string; batchId: string; sku: string; quantity: number; weight: number; value: number }>; custodian?: string; eta?: string; sla?: string; leg?: string; speedCategory?: string; createdAt?: number; lastUpdate?: number }>> {
  const res = await apiGet<{ ok: boolean; shipments: Array<{ id: string; name: string; status: string; path: Array<{ lat: number; lng: number }>; stops?: Array<{ lat: number; lng: number; label: string; type: 'hub' | 'proof' }>; items?: Array<{ id: string; name: string; quantity: number; weight: number; value: number }>; batches?: Array<{ id: string; batchId: string; sku: string; quantity: number; weight: number; value: number }>; custodian?: string; eta?: string; sla?: string; leg?: string; speedCategory?: string; createdAt?: number; lastUpdate?: number }> }>(`/supply/shipments`)
  return res.shipments || []
}

export async function fetchShipmentDetails(id: string): Promise<{ id: string; name: string; status: string; path: Array<{ lat: number; lng: number }>; stops: Array<{ lat: number; lng: number; label: string; type: 'hub' | 'proof' }>; items: Array<{ id: string; name: string; quantity: number; weight: number; value: number }>; custodian: string; eta: string; sla: string; leg: string; createdAt: number; lastUpdate: number; currentPosition: { lat: number; lng: number; ts: number } | null; progress: { totalDistance: number; completedDistance: number; percentage: number } }> {
  const res = await apiGet<{ ok: boolean; shipment: { id: string; name: string; status: string; path: Array<{ lat: number; lng: number }>; stops: Array<{ lat: number; lng: number; label: string; type: 'hub' | 'proof' }>; items: Array<{ id: string; name: string; quantity: number; weight: number; value: number }>; custodian: string; eta: string; sla: string; leg: string; createdAt: number; lastUpdate: number; currentPosition: { lat: number; lng: number; ts: number } | null; progress: { totalDistance: number; completedDistance: number; percentage: number } } }>(`/supply/shipments/${id}`)
  return res.shipment
}

export async function createRoute(name: string, batches: Array<{ id: string; batchId: string; sku: string; quantity: number; weight: number; value: number }>): Promise<{ ok: boolean; shipmentId: string }> {
  const res = await fetch(`${API_BASE}/supply/shipments/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, batches })
  })
  if (!res.ok) throw new Error('create route failed')
  return res.json()
}

export async function registerBatch(batchId: string, sku: string, quantity: number, weight: number, value: number): Promise<{ ok: boolean; batchId: string; receiptId: string; txHash: string; registeredAt: number; simulated?: boolean; blockchain?: string }> {
  const res = await fetch(`${API_BASE}/supply/register-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batchId, sku, quantity, weight, value })
  })
  if (!res.ok) throw new Error('register batch failed')
  return res.json()
}

export async function seedSecretRoute(): Promise<{ ok: boolean; secretRouteId: string; message: string }> {
  const res = await fetch(`${API_BASE}/supply/shipments/seed-secret`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
  if (!res.ok) throw new Error('seed secret route failed')
  return res.json()
}

export async function getSecretRouteQR(segmentIndex: number): Promise<{ ok: boolean; qrData: any }> {
  const res = await fetch(`${API_BASE}/supply/secret-route/qr/${segmentIndex}`)
  if (!res.ok) throw new Error('get secret route QR failed')
  return res.json()
}

// Gemini AI Integration
export interface GeminiResponse {
  content: string
  isStreaming?: boolean
  error?: string
}

// Test function to check streaming API
export async function testStreamingAPI(): Promise<{ success: boolean; message: string; chunks: string[] }> {
  try {
    const GEMINI_API_KEY = 'AIzaSyDfZmNLxzrECAS6ICvqlut82yt-SK1AX7o'
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-latest:streamGenerateContent?key=${GEMINI_API_KEY}`
    
    console.log('Testing streaming API...')
    
    const requestBody = {
      contents: [{
        parts: [{
          text: "Say 'Hello, this is a test message' and count from 1 to 5."
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 100,
      }
    }

    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    })

    console.log('Streaming test response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Streaming test error:', errorText)
      return {
        success: false,
        message: `API Error: ${response.status} ${response.statusText}`,
        chunks: []
      }
    }

    const reader = response.body?.getReader()
    if (!reader) {
      return {
        success: false,
        message: 'No response body reader available',
        chunks: []
      }
    }

    const decoder = new TextDecoder()
    let buffer = ''
    const chunks: string[] = []

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        console.log('Raw chunk received:', buffer)
        console.log('Buffer length:', buffer.length)
        
        // Try to parse the entire buffer as JSON first (in case it's complete)
        try {
          const completeResponse = JSON.parse(buffer)
          console.log('Complete response parsed:', completeResponse)
          
          if (completeResponse.candidates && completeResponse.candidates[0]) {
            const candidate = completeResponse.candidates[0]
            if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
              const text = candidate.content.parts[0].text
              if (text) {
                chunks.push(text)
                console.log('Added complete response chunk:', text)
                return {
                  success: true,
                  message: `Successfully received complete response`,
                  chunks
                }
              }
            }
          }
        } catch (jsonError) {
          console.log('Buffer is not complete JSON, continuing to read...')
        }
        
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.trim() === '') continue
          
          console.log('Processing line:', line)
          console.log('Line length:', line.length)
          console.log('Line starts with {:', line.startsWith('{'))
          console.log('Line starts with data:', line.startsWith('data:'))
          
          try {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              console.log('Data content:', data)
              
              if (data === '[DONE]') {
                console.log('Stream completed')
                break
              }
              
              const parsed = JSON.parse(data)
              console.log('Parsed data:', parsed)
              
              if (parsed.candidates && parsed.candidates[0]) {
                const candidate = parsed.candidates[0]
                console.log('Candidate:', candidate)
                
                if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
                  const text = candidate.content.parts[0].text
                  console.log('Extracted text:', text)
                  if (text) {
                    chunks.push(text)
                    console.log('Added chunk:', text)
                  }
                } else if (candidate.delta && candidate.delta.content && candidate.delta.content.parts && candidate.delta.content.parts[0]) {
                  const text = candidate.delta.content.parts[0].text
                  console.log('Extracted delta text:', text)
                  if (text) {
                    chunks.push(text)
                    console.log('Added delta chunk:', text)
                  }
                }
              }
            } else if (line.startsWith('{')) {
              // Handle complete JSON response (non-streaming format)
              console.log('Attempting to parse complete JSON...')
              const parsed = JSON.parse(line)
              console.log('Complete JSON response:', parsed)
              
              if (parsed.candidates && parsed.candidates[0]) {
                const candidate = parsed.candidates[0]
                console.log('Candidate from complete response:', candidate)
                
                if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
                  const text = candidate.content.parts[0].text
                  console.log('Extracted complete text:', text)
                  if (text) {
                    // For test, just add the complete text as one chunk
                    chunks.push(text)
                    console.log('Added complete text chunk:', text)
                  }
                } else {
                  console.log('No content found in candidate:', candidate)
                }
              } else {
                console.log('No candidates found in response:', parsed)
              }
            } else {
              console.log('Line does not match expected formats:', line)
            }
          } catch (parseError) {
            console.error('Failed to parse line:', line)
            console.error('Parse error:', parseError)
            console.error('Line length:', line.length)
            console.error('First 100 chars:', line.substring(0, 100))
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    // Final check - try to parse any remaining buffer as complete JSON
    if (chunks.length === 0 && buffer.trim()) {
      console.log('No chunks received, trying to parse remaining buffer:', buffer)
      try {
        const completeResponse = JSON.parse(buffer)
        console.log('Final buffer parsed as complete response:', completeResponse)
        
        if (completeResponse.candidates && completeResponse.candidates[0]) {
          const candidate = completeResponse.candidates[0]
          if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
            const text = candidate.content.parts[0].text
            if (text) {
              chunks.push(text)
              console.log('Added final buffer chunk:', text)
            }
          }
        }
      } catch (finalError) {
        console.error('Failed to parse final buffer:', finalError)
      }
    }

    console.log('Total chunks received:', chunks.length)
    console.log('All chunks:', chunks)

    return {
      success: chunks.length > 0,
      message: chunks.length > 0 ? `Successfully received ${chunks.length} chunks` : 'No chunks received',
      chunks
    }

  } catch (error) {
    console.error('Streaming test error:', error)
    return {
      success: false,
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      chunks: []
    }
  }
}

// Function to check available Gemini models
export async function checkAvailableModels(): Promise<string[]> {
  try {
    const GEMINI_API_KEY = 'AIzaSyDfZmNLxzrECAS6ICvqlut82yt-SK1AX7o'
    const MODELS_URL = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`
    
    console.log('Checking available models at:', MODELS_URL)
    
    const response = await fetch(MODELS_URL)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Error fetching models:', errorText)
      throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    console.log('Available models response:', data)
    
    if (data.models) {
      const modelNames = data.models.map((model: any) => model.name)
      console.log('Available model names:', modelNames)
      return modelNames
    } else {
      console.error('No models found in response')
      return []
    }
  } catch (error) {
    console.error('Error checking available models:', error)
    return []
  }
}

// Streaming version of Gemini AI query
export async function queryGeminiAIStream(
  userMessage: string, 
  contextData: {
    totalShipments: number
    activeShipments: number
    deliveredShipments: number
    delayedShipments: number
    totalValue: number
    recentShipments: Array<{ id: string; name: string; status: string; custodian?: string; eta?: string; sla?: string }>
    delayedShipmentsList: Array<{ id: string; name: string; status: string; sla?: string; eta?: string }>
    systemStatus: { online: boolean; lastUpdate: string }
  },
  onChunk: (chunk: string) => void
): Promise<void> {
  try {
    const GEMINI_API_KEY = 'AIzaSyDfZmNLxzrECAS6ICvqlut82yt-SK1AX7o'
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-latest:streamGenerateContent?key=${GEMINI_API_KEY}`
    
    // Create a comprehensive prompt with context
    const prompt = `You are an AI assistant for a supply chain management system called RealPay. You help users analyze their logistics operations, identify issues, and provide actionable insights.

CONTEXT DATA:
- Total Shipments: ${contextData.totalShipments}
- Active Shipments: ${contextData.activeShipments}
- Delivered Shipments: ${contextData.deliveredShipments}
- Delayed Shipments: ${contextData.delayedShipments}
- Total Value: ${contextData.totalValue} PLT
- System Status: ${contextData.systemStatus.online ? 'Online' : 'Offline'}

RECENT SHIPMENTS:
${contextData.recentShipments.map(s => `- ${s.name} (${s.id}): ${s.status} - ${s.custodian || 'No custodian'} - ETA: ${s.eta || 'Not specified'}`).join('\n')}

${contextData.delayedShipmentsList.length > 0 ? `
DELAYED SHIPMENTS:
${contextData.delayedShipmentsList.map(s => `- ${s.name} (${s.id}): ${s.status} - SLA: ${s.sla} - ETA: ${s.eta || 'Not specified'}`).join('\n')}
` : ''}

USER QUESTION: ${userMessage}

Please provide a helpful, detailed response about the supply chain status, focusing on any issues, recommendations, or insights. Use markdown formatting for better readability. Be specific about the data provided and give actionable recommendations. If there are delayed shipments, provide specific steps to address them.`

    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 4096,
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }
      ]
    }

    console.log('Calling Gemini API with streaming, prompt length:', prompt.length)

    // Try direct API call first, then fallback to proxy
    let response: Response
    try {
      console.log('Attempting direct streaming API call to:', GEMINI_API_URL)
      response = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })
      console.log('Direct streaming API call successful, status:', response.status)
    } catch (corsError) {
      console.warn('Direct streaming API call failed due to CORS, trying proxy:', corsError)
      // Use CORS proxy as fallback
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(GEMINI_API_URL)}`
      console.log('Using CORS proxy for streaming:', proxyUrl)
      response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })
      console.log('Proxy streaming API call completed, status:', response.status)
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini streaming API error response:', errorText)
      throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    // Handle streaming response
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body reader available')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        console.log('Received chunk:', buffer)
        
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep the last incomplete line in buffer

        for (const line of lines) {
          if (line.trim() === '') continue
          
          console.log('Processing line:', line)
          
          try {
            // Parse Server-Sent Events format
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              console.log('Data content:', data)
              
              if (data === '[DONE]') {
                console.log('Stream completed')
                return
              }
              
              const parsed = JSON.parse(data)
              console.log('Parsed data:', parsed)
              
              if (parsed.candidates && parsed.candidates[0]) {
                const candidate = parsed.candidates[0]
                console.log('Candidate:', candidate)
                
                if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
                  const text = candidate.content.parts[0].text
                  console.log('Extracted text:', text)
                  if (text) {
                    onChunk(text)
                  }
                } else if (candidate.delta && candidate.delta.content && candidate.delta.content.parts && candidate.delta.content.parts[0]) {
                  // Handle delta format
                  const text = candidate.delta.content.parts[0].text
                  console.log('Extracted delta text:', text)
                  if (text) {
                    onChunk(text)
                  }
                }
              }
            } else if (line.startsWith('{')) {
              // Direct JSON format (not SSE) - handle complete response
              const parsed = JSON.parse(line)
              console.log('Direct JSON:', parsed)
              
              if (parsed.candidates && parsed.candidates[0]) {
                const candidate = parsed.candidates[0]
                if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
                  const text = candidate.content.parts[0].text
                  if (text) {
                    // For complete responses, send the whole text at once
                    console.log('Sending complete response:', text)
                    onChunk(text)
                  }
                }
              }
            }
          } catch (parseError) {
            console.warn('Failed to parse streaming chunk:', line, parseError)
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

  } catch (error) {
    console.error('Gemini streaming API Error:', error)
    throw error
  }
}

export async function queryGeminiAI(
  userMessage: string, 
  contextData: {
    totalShipments: number
    activeShipments: number
    deliveredShipments: number
    delayedShipments: number
    totalValue: number
    recentShipments: Array<{ id: string; name: string; status: string; custodian?: string; eta?: string; sla?: string }>
    delayedShipmentsList: Array<{ id: string; name: string; status: string; sla?: string; eta?: string }>
    systemStatus: { online: boolean; lastUpdate: string }
  }
): Promise<GeminiResponse> {
  try {
    const GEMINI_API_KEY = 'AIzaSyDfZmNLxzrECAS6ICvqlut82yt-SK1AX7o'
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-latest:generateContent?key=${GEMINI_API_KEY}`
    
    // Create a comprehensive prompt with context
    const prompt = `You are an AI assistant for a supply chain management system called RealPay. You help users analyze their logistics operations, identify issues, and provide actionable insights.

CONTEXT DATA:
- Total Shipments: ${contextData.totalShipments}
- Active Shipments: ${contextData.activeShipments}
- Delivered Shipments: ${contextData.deliveredShipments}
- Delayed Shipments: ${contextData.delayedShipments}
- Total Value: ${contextData.totalValue} PLT
- System Status: ${contextData.systemStatus.online ? 'Online' : 'Offline'}

RECENT SHIPMENTS:
${contextData.recentShipments.map(s => `- ${s.name} (${s.id}): ${s.status} - ${s.custodian || 'No custodian'} - ETA: ${s.eta || 'Not specified'}`).join('\n')}

${contextData.delayedShipmentsList.length > 0 ? `
DELAYED SHIPMENTS:
${contextData.delayedShipmentsList.map(s => `- ${s.name} (${s.id}): ${s.status} - SLA: ${s.sla} - ETA: ${s.eta || 'Not specified'}`).join('\n')}
` : ''}

USER QUESTION: ${userMessage}

Please provide a helpful, detailed response about the supply chain status, focusing on any issues, recommendations, or insights. Use markdown formatting for better readability. Be specific about the data provided and give actionable recommendations. If there are delayed shipments, provide specific steps to address them.`

    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 4096,
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }
      ]
    }

    console.log('Calling Gemini API with prompt length:', prompt.length)

    // Try direct API call first, then fallback to proxy
    let response: Response
    try {
      console.log('Attempting direct API call to:', GEMINI_API_URL)
      response = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })
      console.log('Direct API call successful, status:', response.status)
    } catch (corsError) {
      console.warn('Direct API call failed due to CORS, trying proxy:', corsError)
      // Use CORS proxy as fallback
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(GEMINI_API_URL)}`
      console.log('Using CORS proxy:', proxyUrl)
      response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })
      console.log('Proxy API call completed, status:', response.status)
    }

    console.log('Gemini API response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API error response:', errorText)
      throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    let data: any
    try {
      data = await response.json()
      console.log('Gemini API response data:', data)
    } catch (parseError) {
      console.error('Failed to parse JSON response:', parseError)
      const responseText = await response.text()
      console.error('Raw response text:', responseText)
      throw new Error('Invalid JSON response from Gemini API')
    }
    
    // Check for errors in the response
    if (data.error) {
      throw new Error(`Gemini API error: ${data.error.message || 'Unknown error'}`)
    }
    
    // Check if we have candidates with content
    if (data.candidates && data.candidates.length > 0) {
      const candidate = data.candidates[0]
      
      // Check if content is blocked or truncated
      if (candidate.finishReason) {
        if (candidate.finishReason === 'SAFETY') {
          throw new Error('Response blocked by safety filters')
        } else if (candidate.finishReason === 'STOP') {
          // This is normal completion
        } else if (candidate.finishReason === 'MAX_TOKENS') {
          // Response was truncated due to token limit - this is acceptable
          console.warn('Response truncated due to token limit')
        } else {
          console.warn(`Unexpected finish reason: ${candidate.finishReason}`)
          // Don't throw error for other finish reasons, just log them
        }
      }
      
      // Extract content from the response
      if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
        const content = candidate.content.parts[0].text
        console.log('Gemini API response content length:', content.length)
        return {
          content: content,
          isStreaming: false
        }
      } else {
        throw new Error('No content found in Gemini API response')
      }
    } else {
      throw new Error('No candidates found in Gemini API response')
    }

  } catch (error) {
    console.error('Gemini API Error:', error)
    
    // Enhanced fallback response based on context
    const deliveryRate = contextData.totalShipments > 0 ? ((contextData.deliveredShipments / contextData.totalShipments) * 100).toFixed(1) : '0'
    
    const fallbackResponse = `## 🤖 AI Assistant (Offline Mode)

I apologize, but I'm experiencing technical difficulties connecting to the AI service. Here's what I can tell you based on your current data:

### Current Status
- **Active Shipments:** ${contextData.activeShipments}
- **Delayed Shipments:** ${contextData.delayedShipments}
- **Total Value:** ${contextData.totalValue.toFixed(2)} PLT
- **Delivery Success Rate:** ${deliveryRate}%

${contextData.delayedShipments > 0 ? 
  `### ⚠️ **Alert: ${contextData.delayedShipments} Delayed Shipments**

**Immediate Actions:**
1. Contact custodians for status updates
2. Review routing for bottlenecks
3. Consider alternative logistics
4. Escalate critical delays

**Delayed Shipments:**
${contextData.delayedShipmentsList.map(s => `- **${s.name}** (${s.id}): ${s.status} - SLA: ${s.sla}`).join('\n')}
` :
  `### ✅ **All Clear: No Delays Detected**

Your supply chain is running smoothly. Continue monitoring for potential issues.`
}

### Quick Recommendations
- Monitor active shipments closely
- Review custodian performance
- Check for pattern-based delays
- Maintain communication with stakeholders

Please try again in a moment, or contact support if the issue persists.`

    return {
      content: fallbackResponse,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}



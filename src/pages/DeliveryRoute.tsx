import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useDelivery, Delivery, calculateDistance } from '../lib/api'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export function DeliveryRoute() {
  const { id } = useParams()
  const { data } = useDelivery(id)
  const mapRef = useRef<HTMLDivElement | null>(null)
  const [map, setMap] = useState<L.Map | null>(null)
  const [polyline, setPolyline] = useState<L.Polyline | null>(null)
  const [routePoints, setRoutePoints] = useState<L.LatLng[]>([])
  const [movingIdx, setMovingIdx] = useState(0)
  const moverRef = useRef<L.Marker | null>(null)
  const intervalRef = useRef<number | null>(null)
  const [etaSec, setEtaSec] = useState<number>(0)
  const [remainingM, setRemainingM] = useState<number>(0)
  const [completedLine, setCompletedLine] = useState<L.Polyline | null>(null)
  const [remainingLine, setRemainingLine] = useState<L.Polyline | null>(null)
  const bbox = useMemo(() => {
    const lats = data?.steps.map((s: Delivery['steps'][number]) => s.lat) || [37.7, 37.8]
    const lngs = data?.steps.map((s: Delivery['steps'][number]) => s.lng) || [-122.5, -122.4]
    return { minLat: Math.min(...lats), maxLat: Math.max(...lats), minLng: Math.min(...lngs), maxLng: Math.max(...lngs) }
  }, [data])

  // Simple map frame (placeholder). Pins overlayed via CSS absolute positions
  function project(lat: number, lng: number) {
    const { minLat, maxLat, minLng, maxLng } = bbox
    const x = ((lng - minLng) / (maxLng - minLng || 1)) * 100
    const y = ((maxLat - lat) / (maxLat - minLat || 1)) * 100
    return { left: `${x}%`, top: `${y}%` }
  }

  // Initialize Leaflet map and draw route
  useEffect(() => {
    if (!mapRef.current || !data) return
    if (!map) {
      const center = [data.steps[0]?.lat || 37.7749, data.steps[0]?.lng || -122.4194] as [number, number]
      const m = L.map(mapRef.current, { zoomControl: true, attributionControl: false }).setView(center, 12)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
        attribution: '© OpenStreetMap contributors • © CARTO'
      }).addTo(m)
      setMap(m)
    }
  }, [mapRef, map, data])

  useEffect(() => {
    if (!map || !data) return
    const m = map as L.Map
    // Clear old markers/polyline
    if (polyline) {
      m.removeLayer(polyline)
      setPolyline(null)
    }
    m.eachLayer((layer) => {
      if ((layer as any)._isMarker) m.removeLayer(layer)
    })

    const latlngs = data.steps.map((s) => L.latLng(s.lat, s.lng))

    // Fit bounds
    if (latlngs.length > 1) {
      const bounds = L.latLngBounds(latlngs)
      m.fitBounds(bounds.pad(0.2))
    } else if (latlngs.length === 1) {
      m.setView(latlngs[0], 14)
    }

    // Badge markers for pickup/checkpoint/delivered
    function badgeIcon(kind: 'pickup' | 'checkpoint' | 'delivered') {
      const label = kind === 'pickup' ? 'Pickup' : kind === 'checkpoint' ? 'Checkpoint' : 'Delivered'
      return L.divIcon({
        className: `pin-badge ${kind}`,
        html: `<span>${label}</span>`,
        iconSize: [1, 1],
        iconAnchor: [12, 30],
        popupAnchor: [0, -24],
      })
    }
    latlngs.forEach((pt, i) => {
      const kind = i === 0 ? 'pickup' : i === latlngs.length - 1 ? 'delivered' : 'checkpoint'
      const marker = L.marker(pt, { icon: badgeIcon(kind as any) }) as any
      marker._isMarker = true
      const ts = new Date(data.steps[i].timeIso).toLocaleString()
      const html = `<div class="tip-inner"><div class="tip-time">${ts}</div><div class="tip-note">${data.steps[i].note}</div><div class="tip-qr">QR: ${data.steps[i].qrId}</div></div>`
      marker.addTo(m)
        .bindPopup(`${ts}<br/>${data.steps[i].note}<br/>QR: ${data.steps[i].qrId}`)
        .bindTooltip(html, { direction: 'top', opacity: 0.95, sticky: true, className: 'checkpoint-tip', offset: [0, -16] })
    })

    // Try OSRM route snap; fallback to straight lines if fetch blocked
    async function drawRoute() {
      try {
        const coords = latlngs.map((p) => `${p.lng},${p.lat}`).join(';')
        const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`
        const res = await fetch(url)
        if (!res.ok) throw new Error('routing failed')
        const json = await res.json()
        const routeCoords = json.routes?.[0]?.geometry?.coordinates as [number, number][] | undefined
        if (routeCoords && routeCoords.length) {
          const routeLatLngs = routeCoords.map((c) => L.latLng(c[1], c[0]))
          // base polyline for bounds (kept for reference)
          const pl = L.polyline(routeLatLngs, { color: '#005c2a', weight: 2, opacity: 0.6 })
          pl.addTo(m)
          setPolyline(pl)
          // layered polylines: completed (green) + remaining (blue)
          const comp = L.polyline([routeLatLngs[0]], { color: '#00ff66', weight: 5, opacity: 1 })
          const rem = L.polyline(routeLatLngs, { color: '#00e676', weight: 5, opacity: 0.95 })
          comp.addTo(m)
          rem.addTo(m)
          setCompletedLine(comp)
          setRemainingLine(rem)
          setRoutePoints(routeLatLngs)
          return
        }
        throw new Error('no geometry')
      } catch {
        const pl = L.polyline(latlngs, { color: '#005c2a', weight: 2, opacity: 0.6 })
        pl.addTo(m)
        setPolyline(pl)
        const comp = L.polyline([latlngs[0]], { color: '#00ff66', weight: 5, opacity: 1 })
        const rem = L.polyline(latlngs, { color: '#00e676', weight: 5, opacity: 0.95, dashArray: '10 8' })
        comp.addTo(m)
        rem.addTo(m)
        setCompletedLine(comp)
        setRemainingLine(rem)
        setRoutePoints(latlngs)
      }
    }
    drawRoute()
  }, [map, data])

  // Animate along routePoints and compute ETA/remaining distance
  useEffect(() => {
    if (!map || routePoints.length === 0) return
    const m = map as L.Map
    const speedMps = 10 // ~36 km/h

    function toRad(d: number) { return (d * Math.PI) / 180 }
    function toDeg(r: number) { return (r * 180) / Math.PI }
    function bearing(a: L.LatLng, b: L.LatLng) {
      const φ1 = toRad(a.lat)
      const φ2 = toRad(b.lat)
      const λ1 = toRad(a.lng)
      const λ2 = toRad(b.lng)
      const y = Math.sin(λ2 - λ1) * Math.cos(φ2)
      const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1)
      const θ = Math.atan2(y, x)
      return (toDeg(θ) + 360) % 360 // degrees from north
    }
    function setTruckRotation(idx: number) {
      const el = moverRef.current?.getElement() as HTMLElement | null
      const img = el?.querySelector('img') as HTMLImageElement | null
      if (!img) return
      const next = Math.min(idx + 1, routePoints.length - 1)
      const angle = routePoints[next] ? bearing(routePoints[idx], routePoints[next]) : 0
      const adjusted = angle - 90 // image points right; adjust to north-up baseline
      img.style.transform = `rotate(${adjusted}deg)`
    }

    function distanceRemaining(fromIdx: number) {
      let rem = 0
      for (let i = fromIdx; i < routePoints.length - 1; i++) {
        rem += calculateDistance(routePoints[i].lat, routePoints[i].lng, routePoints[i + 1].lat, routePoints[i + 1].lng)
      }
      return rem
    }

    // Create mover marker if needed
    if (!moverRef.current) {
      const icon = L.divIcon({ className: 'truck-icon', html: '<img src="/truck.png" alt="truck" />', iconSize: [36, 36], iconAnchor: [18, 18] })
      moverRef.current = L.marker(routePoints[0], { icon }) as any
      ;(moverRef.current as any)._isMarker = true
      moverRef.current!.addTo(m)
      setMovingIdx(0)
      // initial orientation
      setTimeout(() => setTruckRotation(0))
    }

    setRemainingM(distanceRemaining(0))
    setEtaSec(Math.round(distanceRemaining(0) / speedMps))

    if (intervalRef.current) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    intervalRef.current = window.setInterval(() => {
      setMovingIdx((idx) => {
        const next = Math.min(idx + 1, routePoints.length - 1)
        if (moverRef.current) {
          moverRef.current.setLatLng(routePoints[next])
        }
        setTruckRotation(next)
        // update polylines: completed [0..next], remaining [next..end]
        if (completedLine) completedLine.setLatLngs(routePoints.slice(0, Math.max(1, next + 1)))
        if (remainingLine) remainingLine.setLatLngs(routePoints.slice(next))
        const rem = distanceRemaining(next)
        setRemainingM(rem)
        setEtaSec(Math.round(rem / speedMps))
        if (next === routePoints.length - 1) {
          if (intervalRef.current) {
            window.clearInterval(intervalRef.current)
            intervalRef.current = null
          }
        }
        return next
      })
    }, 1000)

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      if (moverRef.current) {
        m.removeLayer(moverRef.current)
        moverRef.current = null
      }
      if (completedLine) m.removeLayer(completedLine)
      if (remainingLine) m.removeLayer(remainingLine)
    }
  }, [map, routePoints])

  return (
    <section>
      <h1>Route: {id}</h1>
      <div className="route-stats">
        <div>Remaining: {(remainingM / 1000).toFixed(1)} km</div>
        <div>ETA: {Math.max(0, Math.floor(etaSec / 60))}m {etaSec % 60}s</div>
        <div className="route-progress"><span style={{ width: routePoints.length ? `${(movingIdx / Math.max(1, routePoints.length - 1)) * 100}%` : '0%' }} /></div>
      </div>
      <div className="mini-map-board" ref={mapRef} id="leaflet-map" style={{ height: 360 }} />
      <div style={{ marginTop: 12 }}>
        <ol className="receipt-list">
          {data?.steps.map((s: Delivery['steps'][number]) => (
            <li key={s.id} className="receipt-item">
              <div className="mono">{new Date(s.timeIso).toLocaleString()}</div>
              <div>{s.note}</div>
              <div className="muted">QR: {s.qrId}</div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}



import { useEffect, useRef, useState } from 'react'
import { MapPin, CheckCircle, X, AlertCircle, Camera, Navigation } from 'lucide-react'
import { fetchShipmentDetails, seedSecretRoute, getSecretRouteQR } from '../lib/api'

interface QRScanResult {
  routeId: string
  segmentIndex: number
  checkpoint: {
    lat: number
    lng: number
    label: string
    type: 'hub' | 'proof'
  }
  requiredLocation: {
    lat: number
    lng: number
    radius: number // in meters
  }
}

interface LocationState {
  lat: number | null
  lng: number | null
  accuracy: number | null
  error: string | null
  permission: 'granted' | 'denied' | 'prompt' | 'unknown'
}

export function QRScanner() {
  const [scanResult, setScanResult] = useState<QRScanResult | null>(null)
  const [location, setLocation] = useState<LocationState>({
    lat: null,
    lng: null,
    accuracy: null,
    error: null,
    permission: 'unknown'
  })
  const [isScanning, setIsScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [proofStatus, setProofStatus] = useState<'idle' | 'validating' | 'success' | 'failed'>('idle')
  const [distance, setDistance] = useState<number | null>(null)
  const [secretRouteSeeded, setSecretRouteSeeded] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Request location permission and start tracking
  const requestLocationPermission = async () => {
    if (!navigator.geolocation) {
      setLocation(prev => ({ ...prev, error: 'Geolocation is not supported by this browser' }))
      return
    }

    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
      setLocation(prev => ({ ...prev, permission: permission.state as any }))

      if (permission.state === 'denied') {
        setLocation(prev => ({ ...prev, error: 'Location permission denied. Please enable location access.' }))
        return
      }

      // Start watching position
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            error: null,
            permission: 'granted'
          })
        },
        (error) => {
          setLocation(prev => ({
            ...prev,
            error: error.message,
            permission: 'denied'
          }))
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000
        }
      )

      return () => navigator.geolocation.clearWatch(watchId)
    } catch (error) {
      setLocation(prev => ({ ...prev, error: 'Failed to request location permission' }))
    }
  }

  // Calculate distance between two coordinates
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
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

  // Validate if user is within required location radius
  const validateLocation = (requiredLocation: { lat: number; lng: number; radius: number }): boolean => {
    if (!location.lat || !location.lng) return false
    
    const distance = calculateDistance(
      location.lat, 
      location.lng, 
      requiredLocation.lat, 
      requiredLocation.lng
    )
    
    setDistance(distance)
    return distance <= requiredLocation.radius
  }

  // Seed secret route on component mount
  useEffect(() => {
    const initializeSecretRoute = async () => {
      try {
        await seedSecretRoute()
        setSecretRouteSeeded(true)
      } catch (error) {
        console.error('Failed to seed secret route:', error)
      }
    }
    initializeSecretRoute()
  }, [])

  // QR code scanning functionality
  const scanQRCode = async () => {
    if (!secretRouteSeeded) {
      setScanError('Secret route not ready. Please wait...')
      return
    }

    setIsScanning(true)
    setScanError(null)
    
    try {
      // Get real QR data from secret route (segment 0 - London checkpoint)
      const response = await getSecretRouteQR(0)
      if (response.ok) {
        setScanResult(response.qrData)
      } else {
        setScanError('Failed to get QR data from secret route')
      }
    } catch (error) {
      setScanError('Failed to scan QR code')
      console.error('QR scan error:', error)
    } finally {
      setIsScanning(false)
    }
  }

  // Complete proof validation
  const completeProof = async () => {
    if (!scanResult) return
    
    setProofStatus('validating')
    
    // Validate location
    const isLocationValid = validateLocation(scanResult.requiredLocation)
    
    if (!isLocationValid) {
      setProofStatus('failed')
      setTimeout(() => setProofStatus('idle'), 3000)
      return
    }
    
    // Complete proof validation
    setTimeout(() => {
      setProofStatus('success')
      
      // In real app, this would send proof to blockchain
      console.log('Proof completed:', {
        routeId: scanResult.routeId,
        segmentIndex: scanResult.segmentIndex,
        location: { lat: location.lat, lng: location.lng },
        timestamp: Date.now()
      })
    }, 1500)
  }

  // Start location tracking on mount
  useEffect(() => {
    requestLocationPermission()
  }, [])

  // Update distance when location or scan result changes
  useEffect(() => {
    if (scanResult && location.lat && location.lng) {
      const dist = calculateDistance(
        location.lat,
        location.lng,
        scanResult.requiredLocation.lat,
        scanResult.requiredLocation.lng
      )
      setDistance(dist)
    }
  }, [location, scanResult])

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
      padding: 20,
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ 
          background: 'white', 
          borderRadius: 16, 
          padding: 24, 
          marginBottom: 20,
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
        }}>
          <h1 style={{ 
            fontSize: 24, 
            fontWeight: 700, 
            color: '#1e293b', 
            margin: '0 0 8px 0',
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}>
            <Camera size={28} color="#3b82f6" />
            QR Proof Scanner
          </h1>
          <p style={{ color: '#64748b', margin: 0, fontSize: 16 }}>
            Scan QR codes to complete supply chain proof checkpoints
          </p>
        </div>

        {/* Location Status */}
        <div style={{ 
          background: 'white', 
          borderRadius: 16, 
          padding: 20, 
          marginBottom: 20,
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ 
            fontSize: 18, 
            fontWeight: 600, 
            color: '#1e293b', 
            margin: '0 0 16px 0',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <Navigation size={20} color="#3b82f6" />
            Location Status
          </h3>
          
          {location.error ? (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8, 
              color: '#ef4444',
              background: '#fef2f2',
              padding: 12,
              borderRadius: 8,
              border: '1px solid #fecaca'
            }}>
              <AlertCircle size={16} />
              <span>{location.error}</span>
            </div>
          ) : location.lat && location.lng ? (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8, 
              color: '#059669',
              background: '#f0fdf4',
              padding: 12,
              borderRadius: 8,
              border: '1px solid #bbf7d0'
            }}>
              <CheckCircle size={16} />
              <span>
                Location: {location.lat.toFixed(6)}, {location.lng.toFixed(6)} 
                {location.accuracy && ` (±${Math.round(location.accuracy)}m)`}
              </span>
            </div>
          ) : (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8, 
              color: '#f59e0b',
              background: '#fffbeb',
              padding: 12,
              borderRadius: 8,
              border: '1px solid #fed7aa'
            }}>
              <AlertCircle size={16} />
              <span>Getting location...</span>
            </div>
          )}
        </div>

        {/* QR Scanner */}
        <div style={{ 
          background: 'white', 
          borderRadius: 16, 
          padding: 20, 
          marginBottom: 20,
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ 
            fontSize: 18, 
            fontWeight: 600, 
            color: '#1e293b', 
            margin: '0 0 16px 0'
          }}>
            QR Code Scanner
          </h3>
          
          <div style={{ 
            background: '#f8fafc', 
            border: '2px dashed #cbd5e1', 
            borderRadius: 12, 
            padding: 40, 
            textAlign: 'center',
            marginBottom: 16
          }}>
            <Camera size={48} color="#94a3b8" style={{ marginBottom: 16 }} />
            <p style={{ color: '#64748b', margin: '0 0 16px 0' }}>
              {isScanning ? 'Scanning QR code...' : 'Point camera at QR code'}
            </p>
            <button
              onClick={scanQRCode}
              disabled={isScanning || !location.lat || !secretRouteSeeded}
              style={{
                background: isScanning || !location.lat || !secretRouteSeeded ? '#e2e8f0' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '12px 24px',
                fontSize: 16,
                fontWeight: 600,
                cursor: isScanning || !location.lat || !secretRouteSeeded ? 'not-allowed' : 'pointer',
                opacity: isScanning || !location.lat || !secretRouteSeeded ? 0.6 : 1
              }}
            >
              {isScanning ? 'Scanning...' : 
               !secretRouteSeeded ? 'Loading Secret Route...' :
               'Scan QR Code'}
            </button>
          </div>

          {scanError && (
            <div style={{ 
              color: '#ef4444', 
              background: '#fef2f2', 
              padding: 12, 
              borderRadius: 8,
              border: '1px solid #fecaca',
              marginBottom: 16
            }}>
              {scanError}
            </div>
          )}
        </div>

        {/* Scan Result */}
        {scanResult && (
          <div style={{ 
            background: 'white', 
            borderRadius: 16, 
            padding: 20, 
            marginBottom: 20,
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ 
              fontSize: 18, 
              fontWeight: 600, 
              color: '#1e293b', 
              margin: '0 0 16px 0',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <MapPin size={20} color="#3b82f6" />
              Checkpoint Details
            </h3>
            
            <div style={{ 
              background: '#f8fafc', 
              padding: 16, 
              borderRadius: 8, 
              marginBottom: 16 
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 14 }}>
                <div>
                  <strong>Route ID:</strong><br />
                  <code style={{ color: '#3b82f6' }}>{scanResult.routeId}</code>
                </div>
                <div>
                  <strong>Checkpoint:</strong><br />
                  {scanResult.checkpoint.label}
                </div>
                <div>
                  <strong>Type:</strong><br />
                  <span style={{ 
                    textTransform: 'capitalize',
                    color: scanResult.checkpoint.type === 'hub' ? '#059669' : '#3b82f6'
                  }}>
                    {scanResult.checkpoint.type}
                  </span>
                </div>
                <div>
                  <strong>Required Location:</strong><br />
                  {scanResult.requiredLocation.lat.toFixed(6)}, {scanResult.requiredLocation.lng.toFixed(6)}
                </div>
              </div>
            </div>

            {/* Location Validation */}
            {distance !== null && (
              <div style={{ 
                background: distance <= scanResult.requiredLocation.radius ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${distance <= scanResult.requiredLocation.radius ? '#bbf7d0' : '#fecaca'}`,
                padding: 16, 
                borderRadius: 8, 
                marginBottom: 16 
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 8, 
                  marginBottom: 8,
                  color: distance <= scanResult.requiredLocation.radius ? '#059669' : '#ef4444'
                }}>
                  {distance <= scanResult.requiredLocation.radius ? (
                    <CheckCircle size={20} />
                  ) : (
                    <X size={20} />
                  )}
                  <strong>
                    {distance <= scanResult.requiredLocation.radius ? 'Location Valid' : 'Location Invalid'}
                  </strong>
                </div>
                <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>
                  Distance: {Math.round(distance)}m (Required: ≤{scanResult.requiredLocation.radius}m)
                </p>
              </div>
            )}

            {/* Proof Completion */}
            <button
              onClick={completeProof}
              disabled={proofStatus === 'validating' || distance === null || distance > scanResult.requiredLocation.radius}
              style={{
                background: proofStatus === 'success' ? '#059669' : 
                          proofStatus === 'failed' ? '#ef4444' :
                          proofStatus === 'validating' ? '#f59e0b' :
                          distance === null || distance > scanResult.requiredLocation.radius ? '#e2e8f0' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '12px 24px',
                fontSize: 16,
                fontWeight: 600,
                cursor: proofStatus === 'validating' || distance === null || distance > scanResult.requiredLocation.radius ? 'not-allowed' : 'pointer',
                width: '100%',
                opacity: proofStatus === 'validating' || distance === null || distance > scanResult.requiredLocation.radius ? 0.6 : 1
              }}
            >
              {proofStatus === 'validating' ? 'Validating Proof...' :
               proofStatus === 'success' ? 'Proof Completed ✓' :
               proofStatus === 'failed' ? 'Proof Failed ✗' :
               'Complete Proof'}
            </button>
          </div>
        )}

        {/* Instructions */}
        <div style={{ 
          background: 'white', 
          borderRadius: 16, 
          padding: 20,
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ 
            fontSize: 18, 
            fontWeight: 600, 
            color: '#1e293b', 
            margin: '0 0 16px 0'
          }}>
            How to Use
          </h3>
          <ol style={{ color: '#64748b', lineHeight: 1.6, paddingLeft: 20 }}>
            <li>Allow location access when prompted</li>
            <li>Navigate to the checkpoint location</li>
            <li>Scan the QR code at the checkpoint</li>
            <li>Verify you're within the required radius</li>
            <li>Complete the proof validation</li>
          </ol>
        </div>
      </div>
    </div>
  )
}

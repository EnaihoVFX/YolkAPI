import type { FastifyInstance } from 'fastify';
import { ulid } from 'ulidx';
import { sign, publicKeyBase58 } from '../crypto/sign';
import { mintReceipt } from '../concordium/contracts';
import { _pushRecent } from './receipts';

type RegisterUnitBody = {
  sku: string;
  batchId: string;
  units: Array<{ unitId: string }>;
  meta?: unknown;
};

type CheckpointBody = {
  routeId: string;
  hopIndex: number;
  unitIdHash: string;
  lat: number;
  lng: number;
  tagPayload: any;
  signature: string;
  partyProof: any;
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const out: Record<string, unknown> = {};
    for (const [k, v] of entries) out[k] = canonicalize(v);
    return out;
  }
  return value;
}

function buildTagUrl(tid: string): string {
  const base = process.env.TAG_BASE_URL || 'https://example.com/t/';
  return base.endsWith('/') ? base + tid : base + '/' + tid;
}

export default async function supply(app: FastifyInstance) {
  // Define custodians array at the very beginning
  const custodians = ['H(dist_7ac2)', 'H(hub_a)', 'H(orig_9b1x)', 'H(warehouse_3k)', 'H(logistics_5m)'];
  
  app.get('/ping', async () => ({ ok: true, service: 'supply', ts: Date.now() }));
  app.post('/register-unit', async (req, reply) => {
    const body = req.body as RegisterUnitBody;
    if (!body || typeof body.sku !== 'string' || typeof body.batchId !== 'string' || !Array.isArray(body.units)) {
      return reply.code(400).send({ ok: false, error: 'Invalid body' });
    }

    const now = Math.floor(Date.now() / 1000);
    const exp = now + 3600; // 1h default

    const results = body.units.map((u) => {
      const tid = ulid();
      const payload: any = {
        tid,
        typ: 'unit',
        sku: body.sku,
        bid: body.batchId,
        uid: u.unitId,
        exp,
        url: buildTagUrl(tid),
      };
      const message = JSON.stringify(canonicalize(payload));
      const sig = sign(message);
      return { ...payload, sig, pk: publicKeyBase58 };
    });

    return { ok: true, tags: results };
  });

  app.post('/checkpoint', async (req, reply) => {
    const body = req.body as CheckpointBody;
    if (
      !body ||
      typeof body.routeId !== 'string' ||
      typeof body.hopIndex !== 'number' ||
      typeof body.unitIdHash !== 'string'
    ) {
      return reply.code(400).send({ ok: false, error: 'Invalid body' });
    }

    // TODO: verify signature over tagPayload; verify partyProof; record custody.
    // TODO: mint custody receipt on-chain.

    const receiptId = ulid();
    const txHash = 'sim:' + ulid();
    return { ok: true, receiptId, txHash };
  });

  // Simple in-memory GPS stream store
  const gpsSubscribers = new Set<any>();
  let lastGps: Record<string, { lat: number; lng: number; ts: number }> = {};

  // In-memory shipments store + simulation
  type Shipment = {
    id: string;
    name: string;
    status: 'in_transit' | 'delivered' | 'delayed';
    path: Array<{ lat: number; lng: number }>;
    segIndex: number; // current segment
    segProgressM: number; // meters progressed within current segment
    segDistanceM: number; // meters length of current segment
    speedMs: number; // meters per second
    speedCategory: string; // speed category name
    totalProgressM: number; // meters progressed across route
    nextCheckpointAtM: number; // emit checkpoint when totalProgressM >= this value
    stops: Array<{ lat: number; lng: number; label: string; type: 'hub' | 'proof' }>; // hubs / proof stages
    items: Array<{ id: string; name: string; quantity: number; weight: number; value: number }>; // items on route
    batches: Array<{ id: string; batchId: string; sku: string; quantity: number; weight: number; value: number }>; // batches on route
    custodian: string; // current custodian
    eta: string; // estimated arrival time
    sla: 'MET' | 'RISK' | 'BREACH'; // SLA status
    leg: string; // current leg (e.g., "2/4")
    createdAt: number; // timestamp
    lastUpdate: number; // last GPS update timestamp
  };
  const shipments = new Map<string, Shipment>();
  let simTimer: NodeJS.Timer | null = null;

  function broadcastGps(routeId: string) {
    const payload = `data: ${JSON.stringify({ type: 'gps', routeId, ...lastGps[routeId] })}\n\n`;
    for (const c of gpsSubscribers) { try { c.write(payload); } catch {} }
  }

  function toRad(d: number) { return d * Math.PI / 180 }
  function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
    const R = 6371e3
    const dLat = toRad(b.lat - a.lat)
    const dLng = toRad(b.lng - a.lng)
    const la1 = toRad(a.lat)
    const la2 = toRad(b.lat)
    const s = Math.sin(dLat/2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng/2) ** 2
    const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
    return R * c
  }

  async function maybeCheckpoint(s: Shipment, pt: { lat: number; lng: number }) {
    if (s.totalProgressM >= s.nextCheckpointAtM) {
      s.nextCheckpointAtM += 1000 // every 1km
      try {
        const ts_unix = Math.floor(Date.now() / 1000)
        const res = await mintReceipt('route_sim', { routeId: s.id, lat: pt.lat, lng: pt.lng, ts_unix })
        const receipt_id = ulid()
        const tx_hash = (res && (res.txHash || res.transactionHash)) || ('sim:' + ulid())
        _pushRecent({ id: receipt_id, receipt_id, amount_plt: 0, ts_unix, tx_hash })
      } catch {}
    }
  }

  function tickSimulation() {
    if (shipments.size === 0) return;
    const now = Date.now()
    for (const s of shipments.values()) {
      const a = s.path[s.segIndex]
      const b = s.path[s.segIndex + 1]
      if (!a || !b) { s.status = 'delivered'; continue }
      if (s.segDistanceM <= 0) s.segDistanceM = Math.max(1, haversineM(a, b))

      s.segProgressM += s.speedMs // 1s tick
      s.totalProgressM += s.speedMs

      let p = s.segProgressM / s.segDistanceM
      while (p >= 1 && s.segIndex < s.path.length - 2) {
        // advance to next segment
        s.segIndex++
        s.segProgressM -= s.segDistanceM
        const na = s.path[s.segIndex]
        const nb = s.path[s.segIndex + 1]
        s.segDistanceM = Math.max(1, haversineM(na, nb))
        p = s.segProgressM / s.segDistanceM
      }
      if (p >= 1 && s.segIndex >= s.path.length - 2) {
        // finished
        s.status = 'delivered'
        const last = s.path[s.path.length - 1]
        lastGps[s.id] = { lat: last.lat, lng: last.lng, ts: now }
        broadcastGps(s.id)
        continue
      }
      const curA = s.path[s.segIndex]
      const curB = s.path[s.segIndex + 1]
      const lat = curA.lat + (curB.lat - curA.lat) * p
      const lng = curA.lng + (curB.lng - curA.lng) * p
      lastGps[s.id] = { lat, lng, ts: now }
      broadcastGps(s.id)
      console.log(`Truck ${s.id} moved to: ${lat.toFixed(6)}, ${lng.toFixed(6)}`)
      void maybeCheckpoint(s, { lat, lng })
    }
  }

  function ensureSim() {
    if (simTimer) return;
    simTimer = setInterval(tickSimulation, 500); // Run every 500ms for smoother movement
  }

  app.get('/gps/stream', async (req, reply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.flushHeaders();
    const client = reply.raw;
    gpsSubscribers.add(client);
    // Push bootstrap
    client.write(`data: ${JSON.stringify({ type: 'bootstrap', data: lastGps })}\n\n`);
    req.raw.on('close', () => { gpsSubscribers.delete(client); });
    return reply;
  });

  app.post('/gps/update', async (req, reply) => {
    const body = req.body as { routeId: string; lat: number; lng: number };
    if (!body || typeof body.routeId !== 'string' || typeof body.lat !== 'number' || typeof body.lng !== 'number') {
      return reply.code(400).send({ ok: false, error: 'Invalid body' });
    }
    lastGps[body.routeId] = { lat: body.lat, lng: body.lng, ts: Date.now() };
    const payload = `data: ${JSON.stringify({ type: 'gps', routeId: body.routeId, ...lastGps[body.routeId] })}\n\n`;
    for (const c of gpsSubscribers) { try { c.write(payload); } catch {} }
    return { ok: true };
  });

  app.get('/shipments', async () => {
    return {
      ok: true,
      shipments: Array.from(shipments.values()).map(s => ({ 
        id: s.id, 
        name: s.name, 
        status: s.status, 
        path: s.path, 
        stops: s.stops,
        items: s.items,
        batches: s.batches,
        custodian: s.custodian,
        eta: s.eta,
        sla: s.sla,
        leg: s.leg,
        speedCategory: s.speedCategory,
        createdAt: s.createdAt,
        lastUpdate: s.lastUpdate
      })),
    };
  });

  app.get('/shipments/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const shipment = shipments.get(id);
    if (!shipment) {
      reply.code(404).send({ ok: false, error: 'Shipment not found' });
      return;
    }
    return {
      ok: true,
      shipment: {
        id: shipment.id,
        name: shipment.name,
        status: shipment.status,
        path: shipment.path,
        stops: shipment.stops,
        items: shipment.items,
        batches: shipment.batches,
        custodian: shipment.custodian,
        eta: shipment.eta,
        sla: shipment.sla,
        leg: shipment.leg,
        speedCategory: shipment.speedCategory,
        createdAt: shipment.createdAt,
        lastUpdate: shipment.lastUpdate,
        currentPosition: lastGps[id] || null,
        progress: {
          totalDistance: shipment.path.length >= 2 ? haversineM(shipment.path[0], shipment.path[shipment.path.length - 1]) : 0,
          completedDistance: shipment.totalProgressM,
          percentage: shipment.path.length >= 2 ? Math.min(100, (shipment.totalProgressM / haversineM(shipment.path[0], shipment.path[shipment.path.length - 1])) * 100) : 0
        }
      }
    };
  });

  // Create a new route with custom batches
  app.post('/shipments/create', async (req, reply) => {
    const body = req.body as any;
    if (!body || !body.name || !body.batches || !Array.isArray(body.batches)) {
      return reply.code(400).send({ ok: false, error: 'Invalid body. Need name and batches array.' });
    }

    // Define custodians locally for this endpoint
    const custodians = ['H(dist_7ac2)', 'H(hub_a)', 'H(orig_9b1x)', 'H(warehouse_3k)', 'H(logistics_5m)'];

    const id = 'route_' + ulid().toLowerCase();
    const now = Date.now();
    
    // Use a random UK route
    const cityChains = [
      [
        { name: 'London', lat: 51.5074, lng: -0.1278 },
        { name: 'Birmingham', lat: 52.4862, lng: -1.8904 },
        { name: 'Manchester', lat: 53.4808, lng: -2.2426 },
      ],
      [
        { name: 'Edinburgh', lat: 55.9533, lng: -3.1883 },
        { name: 'Glasgow', lat: 55.8642, lng: -4.2518 },
        { name: 'Newcastle', lat: 54.9783, lng: -1.6178 },
      ],
      [
        { name: 'Liverpool', lat: 53.4084, lng: -2.9916 },
        { name: 'Leeds', lat: 53.8008, lng: -1.5491 },
        { name: 'Sheffield', lat: 53.3811, lng: -1.4701 },
      ],
    ];
    
    const chain = cityChains[Math.floor(Math.random() * cityChains.length)];
    const { path, stops } = await buildRouteForCities(chain);
    
    // Random speed category
    const speedCategories = [
      { min: 30, max: 50, name: 'urban' },
      { min: 60, max: 80, name: 'highway' },
      { min: 90, max: 110, name: 'express' },
      { min: 20, max: 40, name: 'heavy' },
      { min: 70, max: 90, name: 'standard' }
    ];
    const category = speedCategories[Math.floor(Math.random() * speedCategories.length)];
    const baseKmh = category.min + Math.random() * (category.max - category.min);
    const speedMs = (baseKmh * 1000) / 3600;
    const firstSegM = path.length >= 2 ? Math.max(1, haversineM(path[0], path[1])) : 1;
    const eta = new Date(now + (path.length >= 2 ? haversineM(path[0], path[path.length - 1]) / speedMs * 1000 : 3600000));
    
    const shipment: Shipment = {
      id,
      name: body.name,
      status: 'in_transit',
      path,
      segIndex: 0,
      segProgressM: 0,
      segDistanceM: firstSegM,
      speedMs,
      speedCategory: category.name,
      totalProgressM: 0,
      nextCheckpointAtM: 1000,
      stops,
      items: [], // Will be populated from batches
      batches: body.batches,
      custodian: custodians[Math.floor(Math.random() * custodians.length)],
      eta: eta.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      sla: 'MET',
      leg: `1/${stops.length}`,
      createdAt: now,
      lastUpdate: now,
    };
    
    shipments.set(id, shipment);
    lastGps[id] = { lat: path[0].lat, lng: path[0].lng, ts: now };
    ensureSim();
    
    return { ok: true, shipmentId: id };
  });

  // Fetch OSRM route between two points; fallback to straight line if OSRM not available
  async function routeBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): Promise<Array<{ lat: number; lng: number }>> {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url, { method: 'GET' } as any);
      if (res.ok) {
        const data = await res.json();
        const coords: Array<[number, number]> = data?.routes?.[0]?.geometry?.coordinates || [];
        if (coords.length > 0) {
          return coords.map(([lng, lat]) => ({ lat, lng }));
        }
      }
    } catch {}
    // fallback: straight line with interpolation (100 steps)
    const steps = 100;
    const out: Array<{ lat: number; lng: number }> = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      out.push({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t });
    }
    return out;
  }

  async function buildRouteForCities(cities: Array<{ name: string; lat: number; lng: number }>) {
    let fullPath: Array<{ lat: number; lng: number }> = [];
    const stops: Array<{ lat: number; lng: number; label: string; type: 'hub' | 'proof' }> = [];
    for (let i = 0; i < cities.length - 1; i++) {
      const a = cities[i];
      const b = cities[i + 1];
      const seg = await routeBetween(a, b);
      if (fullPath.length > 0 && seg.length > 0) seg.shift(); // avoid duplicate point
      fullPath = fullPath.concat(seg);
      stops.push({ lat: b.lat, lng: b.lng, label: b.name, type: 'hub' });
    }
    // Add initial stop
    if (cities.length > 0) stops.unshift({ lat: cities[0].lat, lng: cities[0].lng, label: cities[0].name, type: 'hub' });
    return { path: fullPath, stops };
  }

  app.post('/shipments/seed', async (req, reply) => {
    const body = (req.body as any) || {};
    const count = Math.max(1, Math.min(10, Number(body.count ?? 3)));

    // Define custodians locally for this endpoint
    const custodians = ['H(dist_7ac2)', 'H(hub_a)', 'H(orig_9b1x)', 'H(warehouse_3k)', 'H(logistics_5m)'];

    // UK-based demo routes
    const cityChains: Array<Array<{ name: string; lat: number; lng: number }>> = [
      [
        { name: 'London', lat: 51.5074, lng: -0.1278 },
        { name: 'Birmingham', lat: 52.4862, lng: -1.8904 },
        { name: 'Manchester', lat: 53.4808, lng: -2.2426 },
      ],
      [
        { name: 'Edinburgh', lat: 55.9533, lng: -3.1883 },
        { name: 'Glasgow', lat: 55.8642, lng: -4.2518 },
        { name: 'Newcastle', lat: 54.9783, lng: -1.6178 },
      ],
      [
        { name: 'Liverpool', lat: 53.4084, lng: -2.9916 },
        { name: 'Leeds', lat: 53.8008, lng: -1.5491 },
        { name: 'Sheffield', lat: 53.3811, lng: -1.4701 },
      ],
      [
        { name: 'Bristol', lat: 51.4545, lng: -2.5879 },
        { name: 'Cardiff', lat: 51.4816, lng: -3.1791 },
        { name: 'Swansea', lat: 51.6214, lng: -3.9436 },
      ],
      [
        { name: 'Norwich', lat: 52.6309, lng: 1.2974 },
        { name: 'Cambridge', lat: 52.2053, lng: 0.1218 },
        { name: 'Oxford', lat: 51.7520, lng: -1.2577 },
      ],
    ];

    // Sample items for different shipment types
    const itemTypes = [
      [
        { id: 'item_1', name: 'Electronics Components', quantity: 50, weight: 25.5, value: 12500 },
        { id: 'item_2', name: 'Circuit Boards', quantity: 100, weight: 12.3, value: 8500 },
      ],
      [
        { id: 'item_3', name: 'Medical Supplies', quantity: 200, weight: 45.2, value: 18500 },
        { id: 'item_4', name: 'Pharmaceuticals', quantity: 75, weight: 8.7, value: 22000 },
      ],
      [
        { id: 'item_5', name: 'Auto Parts', quantity: 30, weight: 120.8, value: 15600 },
        { id: 'item_6', name: 'Engine Components', quantity: 15, weight: 85.3, value: 32000 },
      ],
      [
        { id: 'item_7', name: 'Textiles', quantity: 500, weight: 75.2, value: 9800 },
        { id: 'item_8', name: 'Fabric Rolls', quantity: 80, weight: 45.6, value: 12000 },
      ],
      [
        { id: 'item_9', name: 'Food Products', quantity: 300, weight: 95.4, value: 6800 },
        { id: 'item_10', name: 'Beverages', quantity: 150, weight: 60.1, value: 4500 },
      ],
    ];

    const statuses: Array<'in_transit' | 'delivered' | 'delayed'> = ['in_transit', 'in_transit', 'in_transit', 'delayed', 'delivered'];
    const slaStatuses: Array<'MET' | 'RISK' | 'BREACH'> = ['MET', 'MET', 'RISK', 'BREACH', 'MET'];

    for (let i = 0; i < count; i++) {
      const id = 'route_' + ulid().toLowerCase();
      const chain = cityChains[i % cityChains.length];
      const { path, stops } = await buildRouteForCities(chain);
      // Different speed categories for realism
      const speedCategories = [
        { min: 30, max: 50, name: 'urban' },      // City delivery trucks
        { min: 60, max: 80, name: 'highway' },    // Highway trucks
        { min: 90, max: 110, name: 'express' },   // Express delivery
        { min: 20, max: 40, name: 'heavy' },      // Heavy cargo trucks
        { min: 70, max: 90, name: 'standard' }    // Standard freight
      ]
      const category = speedCategories[i % speedCategories.length]
      const baseKmh = category.min + Math.random() * (category.max - category.min)
      const speedMs = (baseKmh * 1000) / 3600
      const firstSegM = path.length >= 2 ? Math.max(1, haversineM(path[0], path[1])) : 1
      
      const now = Date.now();
      const eta = new Date(now + (path.length >= 2 ? haversineM(path[0], path[path.length - 1]) / speedMs * 1000 : 3600000));
      
      // Generate sample batches for this shipment
      const batchCount = 1 + Math.floor(Math.random() * 3) // 1-3 batches per shipment
      const batches = Array.from({ length: batchCount }, (_, j) => ({
        id: `batch_${ulid().toLowerCase()}`,
        batchId: `BATCH-${String(i + 1).padStart(3, '0')}-${String(j + 1).padStart(2, '0')}`,
        sku: `SKU-${String.fromCharCode(65 + j)}${String(i + 1).padStart(3, '0')}`,
        quantity: 10 + Math.floor(Math.random() * 50),
        weight: 5 + Math.random() * 20,
        value: 1000 + Math.random() * 5000
      }))
      
      const s: Shipment = {
        id,
        name: `${category.name.charAt(0).toUpperCase() + category.name.slice(1)} Shipment ${i + 1}`,
        status: statuses[i % statuses.length],
        path,
        segIndex: 0,
        segProgressM: 0,
        segDistanceM: firstSegM,
        speedMs,
        speedCategory: category.name,
        totalProgressM: 0,
        nextCheckpointAtM: 1000,
        stops,
        items: itemTypes[i % itemTypes.length],
        batches,
        custodian: custodians[i % custodians.length],
        eta: eta.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        sla: slaStatuses[i % slaStatuses.length],
        leg: `${Math.floor(Math.random() * 3) + 1}/${stops.length}`,
        createdAt: now,
        lastUpdate: now,
      };
      shipments.set(id, s);
      lastGps[id] = { lat: path[0].lat, lng: path[0].lng, ts: now };
      // Simulate on-chain receipt minting for initial checkpoint
      try {
        const ts_unix = Math.floor(Date.now() / 1000)
        const res = await mintReceipt('api_seeder', { routeId: id, hop: 0, lat: path[0].lat, lng: path[0].lng, ts_unix })
        const receipt_id = ulid()
        const tx_hash = (res && (res.txHash || res.transactionHash)) || ('sim:' + ulid())
        _pushRecent({ id: receipt_id, receipt_id, amount_plt: 0, ts_unix, tx_hash })
      } catch {}
    }

    ensureSim();
    return { ok: true, count, routeIds: Array.from(shipments.keys()) };
  });

  // Seed a secret route for QR scanning simulation
  app.post('/shipments/seed-secret', async () => {
    const now = Math.floor(Date.now() / 1000);
    const id = 'secret_route_001';
    
    // Secret route: London to Manchester with specific checkpoints
    const secretPath = [
      { lat: 51.5074, lng: -0.1278 }, // London (start)
      { lat: 51.5074, lng: -0.1278 }, // London checkpoint (QR scan location)
      { lat: 52.4862, lng: -1.8904 }, // Birmingham
      { lat: 53.4808, lng: -2.2426 }, // Manchester (end)
    ];
    
    const secretStops = [
      { lat: 51.5074, lng: -0.1278, label: 'Secret Hub Alpha', type: 'hub' as const },
      { lat: 52.4862, lng: -1.8904, label: 'Birmingham Checkpoint', type: 'proof' as const },
      { lat: 53.4808, lng: -2.2426, label: 'Manchester Terminal', type: 'hub' as const },
    ];
    
    const secretBatches = [
      { id: 'secret_batch_001', batchId: 'SECRET-001', sku: 'CLASSIFIED', quantity: 1, weight: 0.1, value: 999999 },
      { id: 'secret_batch_002', batchId: 'SECRET-002', sku: 'RESTRICTED', quantity: 1, weight: 0.1, value: 999999 },
    ];
    
    const s: Shipment = {
      id,
      name: 'Secret Supply Route',
      status: 'In Transit',
      path: secretPath,
      stops: secretStops,
      items: secretBatches.map(b => ({ id: b.id, name: b.sku, quantity: b.quantity, weight: b.weight, value: b.value })),
      batches: secretBatches,
      custodian: 'H(secret_agent)',
      eta: '23:59',
      sla: 'CLASSIFIED',
      leg: '1/3',
      speedCategory: 'classified',
      createdAt: now,
      lastUpdate: now,
    };
    
    shipments.set(id, s);
    lastGps[id] = { lat: secretPath[0].lat, lng: secretPath[0].lng, ts: now };
    
    // Start simulation for secret route
    const tickSimulation = () => {
      const s = shipments.get(id);
      if (!s) return;
      
      const currentPos = lastGps[id];
      if (!currentPos) return;
      
      // Move slowly along the secret route
      const currentIndex = secretPath.findIndex(p => 
        Math.abs(p.lat - currentPos.lat) < 0.001 && Math.abs(p.lng - currentPos.lng) < 0.001
      );
      
      if (currentIndex < secretPath.length - 1) {
        const nextPoint = secretPath[currentIndex + 1];
        const latDiff = nextPoint.lat - currentPos.lat;
        const lngDiff = nextPoint.lng - currentPos.lng;
        
        // Move 1% towards next point each tick
        const newLat = currentPos.lat + latDiff * 0.01;
        const newLng = currentPos.lng + lngDiff * 0.01;
        
        lastGps[id] = { lat: newLat, lng: newLng, ts: Date.now() };
        
        // Broadcast position update
        const event = `data: ${JSON.stringify({ id, position: lastGps[id] })}\n\n`;
        // In real implementation, this would broadcast to SSE clients
        console.log(`Secret route ${id} moved to:`, lastGps[id]);
      }
    };
    
    // Start slow simulation (every 10 seconds)
    const timer = setInterval(tickSimulation, 10000);
    shipmentTimers.set(id, timer);
    
    return { ok: true, secretRouteId: id, message: 'Secret route created for QR scanning simulation' };
  });

  // Generate QR code data for secret route checkpoints
  app.get('/secret-route/qr/:segmentIndex', async (req, reply) => {
    const segmentIndex = parseInt(req.params.segmentIndex);
    const secretRoute = shipments.get('secret_route_001');
    
    if (!secretRoute || !secretRoute.stops || segmentIndex >= secretRoute.stops.length) {
      return reply.code(404).send({ ok: false, error: 'Secret route or segment not found' });
    }
    
    const checkpoint = secretRoute.stops[segmentIndex];
    const qrData = {
      routeId: 'secret_route_001',
      segmentIndex,
      checkpoint: {
        lat: checkpoint.lat,
        lng: checkpoint.lng,
        label: checkpoint.label,
        type: checkpoint.type
      },
      requiredLocation: {
        lat: checkpoint.lat,
        lng: checkpoint.lng,
        radius: 50 // 50 meter radius
      },
      timestamp: Date.now()
    };
    
    return { ok: true, qrData };
  });

  // Register a new batch on-chain
  app.post('/register-batch', async (req, reply) => {
    const body = req.body as {
      batchId: string;
      sku: string;
      quantity: number;
      weight: number;
      value: number;
    };

    if (!body || !body.batchId || !body.sku || typeof body.quantity !== 'number' || typeof body.weight !== 'number' || typeof body.value !== 'number') {
      return reply.code(400).send({ ok: false, error: 'Invalid batch data' });
    }

    try {
      const now = Math.floor(Date.now() / 1000);
      
      // Create batch data for on-chain registration
      const batchData = {
        batchId: body.batchId,
        sku: body.sku,
        quantity: body.quantity,
        weight: body.weight,
        value: body.value,
        registeredAt: now,
        status: 'registered'
      };

      // Mint a receipt for batch registration on Concordium
      const receipt = await mintReceipt('batch_registration', {
        receipt_id: ulid(),
        batch_id_hash: body.batchId,
        ts_unix: now,
        amount_plt: 0,
        merchant_id_hash: '0x' + '0'.repeat(64),
        party_id_hash: '0x' + '0'.repeat(64),
        unit_id_hash: null,
        geo_hash: null,
        meta_root: null
      });

      const receipt_id = receipt.receipt_id || ulid();
      const tx_hash = receipt.txHash || receipt.transactionHash || ('sim:' + ulid());
      const isSimulated = receipt.simulated || false;
      
      // Push to recent receipts
      _pushRecent({
        id: receipt_id,
        receipt_id,
        amount_plt: 0,
        ts_unix: now,
        tx_hash,
        batchId: body.batchId,
        sku: body.sku
      });

      return {
        ok: true,
        batchId: body.batchId,
        receiptId: receipt_id,
        txHash: tx_hash,
        registeredAt: now,
        simulated: isSimulated,
        blockchain: isSimulated ? 'simulated' : 'concordium'
      };
    } catch (error) {
      console.error('Failed to register batch:', error);
      return reply.code(500).send({ ok: false, error: 'Failed to register batch on-chain' });
    }
  });
}



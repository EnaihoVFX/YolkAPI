export type PayTag = {
  id: string
  amount: number
  description?: string
  itemId?: string
  createdAtIso: string
  status: 'active' | 'expired' | 'paid'
  jwsPayload: string
}

export type Payment = {
  id: string
  payerHash: string
  amount: number
  region?: string
  status: 'pending' | 'confirmed' | 'failed'
  txUrl?: string
  receiptId?: string
  createdAtIso: string
}

export type ProofTag = {
  id: string
  jobName: string
  workerId: string
  location?: string
  payout: number
  status: 'unscanned' | 'verified' | 'paid'
  createdAtIso: string
}

export type SupplyBatch = {
  id: string
  batchId: string
  sku: string
  quantity: number
  metadataName?: string
  timeline: Array<{ id: string; label: string; txUrl?: string; timeIso: string }>
  createdAtIso: string
}

export type Receipt = {
  id: string
  buyerHash: string
  amount: number
  timeIso: string
  txUrl?: string
  orderMetadataIpfs?: string
  linkedSupplyUnitId?: string
}

export const KEYS = {
  payTags: 'realpay_paytags_v1',
  payments: 'realpay_payments_v1',
  proofTags: 'realpay_prooftags_v1',
  batches: 'realpay_batches_v1',
  receipts: 'realpay_receipts_v1',
} as const

export function loadArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed as T[] : []
  } catch {
    return []
  }
}

export function saveArray<T>(key: string, value: T[]) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function ensureSeed() {
  // Seed initial data for blockchain integration
  const receipts = loadArray<Receipt>(KEYS.receipts)
  if (receipts.length === 0) {
    const now = Date.now()
    const seeded: Receipt[] = Array.from({ length: 5 }).map((_, i) => ({
      id: `rcpt_${i + 1}`,
      buyerHash: `buyer_${Math.random().toString(36).slice(2, 8)}`,
      amount: Number((Math.random() * 50 + 5).toFixed(2)),
      timeIso: new Date(now - i * 86_400_000).toISOString(),
      txUrl: 'https://ccdscan.io/',
    }))
    saveArray(KEYS.receipts, seeded)
    console.log('Blockchain data seeded successfully')
  }
}



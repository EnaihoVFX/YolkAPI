import { Table } from '../components/UI'
import { ensureSeed, KEYS, Receipt, loadArray } from '../lib/storage'

export function Receipts() {
  ensureSeed()
  const receipts = loadArray<Receipt>(KEYS.receipts)
  return (
    <section>
      <h1>Receipts</h1>
      <Table
        headers={["Receipt ID", "Buyer Hash", "Amount (PLT)", "Time", "Explorer"]}
        rows={receipts.map((r) => [
          r.id,
          r.buyerHash,
          r.amount.toFixed(2),
          new Date(r.timeIso).toLocaleString(),
          r.txUrl ? <a className="link" href={r.txUrl} target="_blank" rel="noreferrer">View</a> : '-'
        ])}
      />
    </section>
  )
}





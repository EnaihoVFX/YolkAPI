import { useEffect, useMemo, useState } from 'react'

type Payment = {
  id: string
  amount: number
  note?: string
  dateIso: string
}

const STORAGE_KEY = 'realpay_history_v1'

function loadHistory(): Payment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

function saveHistory(history: Payment[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
}

export function History() {
  const [history, setHistory] = useState<Payment[]>(() => loadHistory())

  useEffect(() => {
    saveHistory(history)
  }, [history])

  const total = useMemo(
    () => history.reduce((sum, p) => sum + p.amount, 0),
    [history],
  )

  function addSample() {
    const payment: Payment = {
      id: crypto.randomUUID(),
      amount: Number((Math.random() * 100).toFixed(2)),
      note: 'Sample payment',
      dateIso: new Date().toISOString(),
    }
    setHistory((h) => [payment, ...h])
  }

  function clearAll() {
    setHistory([])
  }

  return (
    <section>
      <h1>History</h1>
      <div className="history-actions">
        <button onClick={addSample}>Add sample</button>
        <button onClick={clearAll} className="danger">Clear</button>
      </div>
      <div className="summary">Total: ${total.toFixed(2)} · {history.length} payments</div>
      <ul className="list">
        {history.map((p) => (
          <li key={p.id} className="item">
            <div className="row">
              <div className="amount">${p.amount.toFixed(2)}</div>
              <div className="date">{new Date(p.dateIso).toLocaleString()}</div>
            </div>
            {p.note && <div className="note">{p.note}</div>}
          </li>
        ))}
        {history.length === 0 && <li className="empty">No history yet.</li>}
      </ul>
    </section>
  )
}





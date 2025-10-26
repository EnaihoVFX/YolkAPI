import { useMemo, useState } from 'react'
import QRCode from 'react-qr-code'

export function QRCodes() {
  const [amount, setAmount] = useState<string>('')
  const [note, setNote] = useState<string>('')

  const value = useMemo(() => {
    const payload = { amount: amount || undefined, note: note || undefined }
    return JSON.stringify(payload)
  }, [amount, note])

  return (
    <section>
      <h1>QR Codes</h1>
      <form className="form" onSubmit={(e) => e.preventDefault()}>
        <label>
          Amount
          <input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label>
          Note
          <input
            type="text"
            placeholder="Payment note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      </form>
      <div className="qr-wrap">
        <QRCode value={value} size={192} />
        <div className="qr-caption">Scan to pay</div>
      </div>
    </section>
  )
}





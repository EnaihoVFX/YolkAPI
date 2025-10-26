import { ReactNode } from 'react'

export function Badge({ children, color = 'default' }: { children: ReactNode; color?: 'default' | 'green' | 'red' | 'yellow' | 'blue' | 'purple' }) {
  const cls = {
    default: 'border-color: rgba(255,255,255,0.12); background: rgba(255,255,255,0.06); color: #cfe0ff;',
    green: 'border-color: rgba(56, 189, 98, 0.4); background: rgba(56,189,98,0.12); color: #b7f0c7;',
    red: 'border-color: rgba(248, 113, 113, 0.4); background: rgba(248,113,113,0.12); color: #ffd1d1;',
    yellow: 'border-color: rgba(250, 204, 21, 0.4); background: rgba(250,204,21,0.12); color: #ffe9a6;',
    blue: 'border-color: rgba(79,140,255,0.4); background: rgba(79,140,255,0.12); color: #cfe0ff;',
    purple: 'border-color: rgba(168,85,247,0.4); background: rgba(168,85,247,0.14); color: #e6d5ff;',
  }[color]
  return <span style={{ padding: '4px 8px', borderRadius: 999, border: '1px solid', fontSize: 12, whiteSpace: 'nowrap', ...(styleFromString(cls)) }}>{children}</span>
}

export function Table({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="table">
      <div className="thead">
        {headers.map((h) => (
          <div key={h} className="th">{h}</div>
        ))}
      </div>
      <div className="tbody">
        {rows.map((r, i) => (
          <div key={i} className="tr">
            {r.map((c, j) => (
              <div key={j} className="td">{c}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function styleFromString(s: string): Record<string, string> {
  const out: Record<string, string> = {}
  s.split(';').map((kv) => kv.trim()).filter(Boolean).forEach((kv) => {
    const [k, v] = kv.split(':').map((x) => x.trim())
    const camel = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    out[camel] = v
  })
  return out
}



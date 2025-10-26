import { useMemo, useState } from 'react'

type Point = { in: number; out: number; t?: string }
export function FlowChart({ points, width = 420, height = 140 }: { points: Point[]; width?: number; height?: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const padding = { top: 12, right: 12, bottom: 18, left: 28 }
  const w = width - padding.left - padding.right
  const h = height - padding.top - padding.bottom
  const xs = useMemo(() => points.map((_, i) => (points.length <= 1 ? 0 : (i / (points.length - 1)) * w)), [points, w])
  const all = useMemo(() => points.flatMap(p => [p.in, p.out]), [points])
  const min = Math.min(...all, 0)
  const max = Math.max(...all, 1)
  const scaleY = (v: number) => h - ((v - min) / (max - min || 1)) * h

  const path = (key: 'in' | 'out') => points.map((p, i) => `${i ? 'L' : 'M'} ${xs[i]},${scaleY(p[key])}`).join(' ')
  const area = (key: 'in' | 'out') => `${path(key)} L ${w},${h} L 0,${h} Z`

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id="gradIn" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#19b27b" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#19b27b" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="gradOut" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#ff7373" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ff7373" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g transform={`translate(${padding.left},${padding.top})`}>
        <rect x={-padding.left} y={-padding.top} width={width} height={height} fill="transparent"/>
        <path d={area('in')} fill="url(#gradIn)" />
        <path d={area('out')} fill="url(#gradOut)" />
        <path d={path('in')} fill="none" stroke="#19b27b" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <path d={path('out')} fill="none" stroke="#ff7373" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {xs.map((x, i) => (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <circle cx={x} cy={scaleY(points[i].in)} r={hover === i ? 3 : 2} fill="#19b27b" />
            <circle cx={x} cy={scaleY(points[i].out)} r={hover === i ? 3 : 2} fill="#ff7373" />
            {hover === i && (
              <g transform={`translate(${Math.min(Math.max(0, x - 60), w - 120)},${scaleY(Math.max(points[i].in, points[i].out)) - 36})`}>
                <rect width="120" height="32" rx="8" ry="8" fill="rgba(20,28,44,0.95)" stroke="rgba(255,255,255,0.1)" />
                <text x="8" y="14" fontSize="11" fill="#9aa7b2">In: {points[i].in.toFixed(2)} PLT</text>
                <text x="8" y="26" fontSize="11" fill="#9aa7b2">Out: {points[i].out.toFixed(2)} PLT</text>
              </g>
            )}
          </g>
        ))}
        {/* y-axis min/max labels */}
        <text x={-16} y={h} fontSize="10" fill="#9aa7b2" textAnchor="end">{min.toFixed(0)}</text>
        <text x={-16} y={10} fontSize="10" fill="#9aa7b2" textAnchor="end">{max.toFixed(0)}</text>
      </g>
    </svg>
  )
}





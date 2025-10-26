type Props = { values: number[]; width?: number; height?: number; stroke?: string }

export function Sparkline({ values, width = 160, height = 48, stroke = '#4f8cff' }: Props) {
  if (values.length === 0) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const norm = (v: number) => (max === min ? 0.5 : (v - min) / (max - min))
  const step = width / (values.length - 1)
  const d = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${height - norm(v) * height}`)
    .join(' ')
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={d} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}





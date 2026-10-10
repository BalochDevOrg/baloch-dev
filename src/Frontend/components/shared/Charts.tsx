import { useMemo } from 'react'
import { cn } from '@/lib/util'

/** Smooth SVG area chart with gradient fill and optional Y-axis — matching Image 4 */
export function AreaChart({
  data, labels, height = 200, className, prefix = '', format, showYAxis = true,
}: {
  data: number[]; labels?: string[]; height?: number; className?: string; prefix?: string
  format?: (n: number) => string; showYAxis?: boolean
}) {
  const W = 640
  const H = height
  const pad = { t: 16, r: 16, b: 28, l: showYAxis ? 76 : 16 }
  const rawMax = Math.max(...data, 1000)
  // Round max up to neat bracket (e.g. 10000)
  const max = Math.ceil(rawMax / 2500) * 2500 || 10000
  const stepX = (W - pad.l - pad.r) / Math.max(data.length - 1, 1)
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b)

  const { line, area } = useMemo(() => {
    const pts = data.map((v, i) => [pad.l + i * stepX, y(v)] as const)
    if (pts.length === 0) return { line: '', area: '' }
    let d = `M ${pts[0][0]} ${pts[0][1]}`
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1]
      const [x1, y1] = pts[i]
      const mx = (x0 + x1) / 2
      d += ` C ${mx} ${y0}, ${mx} ${y1}, ${x1} ${y1}`
    }
    const a = `${d} L ${pts[pts.length - 1][0]} ${H - pad.b} L ${pts[0][0]} ${H - pad.b} Z`
    return { line: d, area: a }
  }, [data.join(','), pad.l, stepX, H, pad.b])

  const fmt = format ?? ((n: number) => `${prefix}${n.toLocaleString()}`)
  const yTicks = [max, max * 0.75, max * 0.5, max * 0.25, 0]

  return (
    <figure className={cn('w-full', className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Trend chart">
        <defs>
          <linearGradient id="areaFillEmerald" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.32" />
            <stop offset="50%" stopColor="var(--brand)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Y Axis gridlines and values */}
        {yTicks.map((val) => {
          const yPos = y(val)
          return (
            <g key={val}>
              <line
                x1={pad.l}
                x2={W - pad.r}
                y1={yPos}
                y2={yPos}
                stroke="var(--line)"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              {showYAxis && (
                <text
                  x={pad.l - 8}
                  y={yPos + 3.5}
                  textAnchor="end"
                  fill="var(--muted)"
                  fontSize="9.5"
                  fontWeight="600"
                  fontFamily="system-ui, sans-serif"
                >
                  {val === 0 ? 'PKR 0' : `PKR ${val.toLocaleString()}`}
                </text>
              )}
            </g>
          )
        })}

        {/* Area fill */}
        <path d={area} fill="url(#areaFillEmerald)" />

        {/* Line stroke */}
        <path
          d={line}
          fill="none"
          stroke="var(--brand)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Data points */}
        {data.map((v, i) => (
          <g key={i}>
            <circle
              cx={pad.l + i * stepX}
              cy={y(v)}
              r="4.5"
              fill="var(--brand)"
              stroke="var(--surface)"
              strokeWidth="2"
            />
            <title>{`${labels?.[i] ?? i}: ${fmt(v)}`}</title>
          </g>
        ))}

        {/* X Axis bottom labels */}
        {labels && labels.map((l, i) => (
          <text
            key={i}
            x={pad.l + i * stepX}
            y={H - 8}
            textAnchor="middle"
            fill="var(--muted)"
            fontSize="10"
            fontWeight="500"
            fontFamily="system-ui, sans-serif"
          >
            {l}
          </text>
        ))}
      </svg>
    </figure>
  )
}

/** Horizontal stat bars. */
export function BarList({ items }: { items: Array<{ label: string; value: number; hint?: string }> }) {
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <ul className="space-y-3.5">
      {items.map((i) => (
        <li key={i.label}>
          <div className="mb-1.5 flex items-baseline justify-between text-[0.8rem]">
            <span className="font-medium">{i.label}</span>
            <span className="text-muted tnum">{i.hint ?? i.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold to-brand transition-all duration-700"
              style={{ width: `${Math.max(4, (i.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

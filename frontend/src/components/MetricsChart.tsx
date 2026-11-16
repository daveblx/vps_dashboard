import { useMemo } from 'react'
import type { MetricsSnapshot, MetricsTimeRange } from '../types'

interface ChartProps {
  data: number[]
  color: string
  height: number
  compact?: boolean
  label?: string
}

const MAX_POINTS = 200

/**
 * The chart viewBox is 200 units wide, so anything beyond that is invisible
 * detail. Bucketing by peak keeps spikes while cutting the path string (and the
 * per-frame work) by an order of magnitude on 12h/24h ranges.
 */
function downsample(points: number[], max: number): number[] {
  if (points.length <= max) return points
  const bucket = points.length / max
  const out: number[] = []
  for (let i = 0; i < max; i++) {
    const start = Math.floor(i * bucket)
    const end = Math.min(points.length, Math.floor((i + 1) * bucket))
    let peak = points[start]
    for (let j = start + 1; j < end; j++) {
      if (points[j] > peak) peak = points[j]
    }
    out.push(peak)
  }
  return out
}

function svgPath(
  points: number[],
  w: number,
  h: number,
  padBottom: number,
): { d: string; flat: boolean } {
  if (points.length < 2) return { d: '', flat: false }
  const plotH = h - padBottom
  let max = 0
  let min = Infinity
  for (let i = 0; i < points.length; i++) {
    if (points[i] > max) max = points[i]
    if (points[i] < min) min = points[i]
  }
  // A constant series (disk usage, idle network) would otherwise collapse onto
  // the top edge and read as an empty chart.
  const flat = max - min < 0.5
  const scale = flat ? 0 : plotH / (max * 1.05)
  const yFor = (value: number) => (flat ? plotH * 0.5 : plotH - value * scale)
  const step = w / (points.length - 1)
  let d = `M 0,${yFor(points[0])}`
  for (let i = 1; i < points.length; i++) {
    d += ` L ${i * step},${yFor(points[i])}`
  }
  return { d, flat }
}

function shimmerPath(w: number, h: number): string {
  const padBottom = 4
  const plotH = h - padBottom
  let d = `M 0,${plotH * 0.5}`
  for (let i = 1; i <= 8; i++) {
    const x = (i / 8) * w
    const y = plotH * (0.35 + 0.3 * Math.sin(i * 2.5))
    d += ` L ${x},${y}`
  }
  return d
}

export function MetricsChart({ data, color, height, compact, label }: ChartProps) {
  const { d: path, flat } = useMemo(
    () => svgPath(downsample(data, MAX_POINTS), 200, height, compact ? 2 : 6),
    [data, height, compact],
  )

  if (data.length === 0) {
    return (
      <svg width="100%" height={height} className="chart-svg">
        <path d={shimmerPath(200, height)} fill="none" stroke="var(--color-border)" strokeWidth="1" opacity={0.5} />
      </svg>
    )
  }

  const current = data[data.length - 1]

  return (
    <svg width="100%" height={height} className="chart-svg" preserveAspectRatio="none" viewBox={`0 0 200 ${height}`}>
      {!compact && (
        <defs>
          <linearGradient id={`grad-${label ?? 'chart'}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.15} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
      )}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={compact ? 1 : 1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {!compact && !flat && (
        <path
          d={`${path} L 200,${height - 2} L 0,${height - 2} Z`}
          fill={`url(#grad-${label ?? 'chart'})`}
        />
      )}
      {!compact && data.length > 2 && (
        <text x="200" y="8" textAnchor="end" fill="var(--color-text-dim)" fontSize="9" fontFamily="var(--font-mono)">
          {current.toFixed(0)}%
        </text>
      )}
    </svg>
  )
}

export function RangeSelector({
  range,
  onChange,
}: {
  range: MetricsTimeRange
  onChange: (r: MetricsTimeRange) => void
}) {
  const ranges: MetricsTimeRange[] = ['1m', '1h', '12h', '24h']
  return (
    <div className="range-selector">
      {ranges.map((r) => (
        <button
          key={r}
          className={`range-selector__btn${range === r ? ' range-selector__btn--active' : ''}`}
          onClick={() => onChange(r)}
          type="button"
        >
          {r}
        </button>
      ))}
    </div>
  )
}

export function chartCpu(data: MetricsSnapshot[]): number[] {
  return data.map((p) => p.cpu)
}

export function chartMemory(data: MetricsSnapshot[]): number[] {
  return data.map((p) => p.memory)
}

export function chartDisk(data: MetricsSnapshot[]): number[] {
  return data.map((p) => p.disk)
}

export function chartNetUp(data: MetricsSnapshot[]): number[] {
  return data.map((p) => p.netUp)
}

export function chartNetDown(data: MetricsSnapshot[]): number[] {
  return data.map((p) => p.netDown)
}
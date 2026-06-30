import { useEffect, useRef, useState } from 'react'
import type { MetricsSnapshot, MetricsTimeRange } from '../types'

const RANGE_MS: Record<MetricsTimeRange, number> = {
  '1m': 60_000,
  '1h': 3_600_000,
  '12h': 43_200_000,
  '24h': 86_400_000,
}

const MAX_POINTS = 600

export function useMetricsHistory(
  cpu: number,
  memory: number,
  disk: number,
  netUp: number,
  netDown: number,
  connected: boolean,
) {
  const [history, setHistory] = useState<MetricsSnapshot[]>([])
  const [range, setRange] = useState<MetricsTimeRange>('1h')
  const lastTimestamp = useRef(0)

  useEffect(() => {
    if (!connected) return

    const ts = Date.now()
    if (ts - lastTimestamp.current < 1900) return
    lastTimestamp.current = ts

    setHistory((prev) => {
      const point: MetricsSnapshot = { timestamp: ts, cpu, memory, disk, netUp, netDown }
      const next = [...prev, point]
      if (next.length > MAX_POINTS) return next.slice(-MAX_POINTS)
      return next
    })
  }, [cpu, memory, disk, netUp, netDown, connected])

  const rangeMs = RANGE_MS[range]
  const cutoff = Date.now() - rangeMs
  const visible = history.filter((p) => p.timestamp >= cutoff)

  return { visible, range, setRange, historyLength: history.length }
}

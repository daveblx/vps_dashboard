import { useEffect, useState } from 'react'
import type { MetricsSnapshot, MetricsTimeRange } from '../types'

const RANGE_MS: Record<MetricsTimeRange, number> = {
  '1m': 60_000,
  '1h': 3_600_000,
  '12h': 43_200_000,
  '24h': 86_400_000,
}

interface BackendPoint {
  t: number
  cpu: number
  mem: number
  disk: number
  netUp: number
  netDown: number
}

/**
 * Loads host-metrics history from the backend for the selected time range and
 * keeps it fresh by polling. Live values from the websocket are appended
 * between polls so the chart updates smoothly in real time.
 *
 * Network values (netUp/netDown) are in bytes/sec to match the backend.
 */
export function useMetricsHistory(
  cpu: number,
  memory: number,
  disk: number,
  netUp: number,
  netDown: number,
  connected: boolean,
) {
  const [points, setPoints] = useState<MetricsSnapshot[]>([])
  const [range, setRange] = useState<MetricsTimeRange>('1h')

  // Fetch from backend on range change and poll for updates.
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const res = await fetch(`/api/metrics/history?range=${range}`)
        if (!res.ok) return
        const data = (await res.json()) as { points?: BackendPoint[] }
        if (cancelled) return
        const mapped: MetricsSnapshot[] = (data.points ?? []).map((p) => ({
          timestamp: p.t,
          cpu: p.cpu,
          memory: p.mem,
          disk: p.disk,
          netUp: p.netUp,
          netDown: p.netDown,
        }))
        setPoints(mapped)
      } catch {
        /* keep last good data */
      }
    }

    load()
    const everyMs = range === '1m' ? 2000 : 5000
    const id = setInterval(load, everyMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [range])

  // Append the latest live reading between polls for real-time feedback.
  useEffect(() => {
    if (!connected) return
    const ts = Date.now()
    setPoints((prev) => {
      if (prev.length > 0 && ts - prev[prev.length - 1].timestamp < 1500) return prev
      return [...prev, { timestamp: ts, cpu, memory, disk, netUp, netDown }]
    })
  }, [cpu, memory, disk, netUp, netDown, connected])

  const cutoff = Date.now() - RANGE_MS[range]
  const visible = points.filter((p) => p.timestamp >= cutoff)

  return { visible, range, setRange, historyLength: points.length }
}

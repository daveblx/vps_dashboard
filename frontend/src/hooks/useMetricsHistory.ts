import { useEffect, useMemo, useState } from 'react'
import type { MetricsSnapshot, MetricsTimeRange } from '../types'
import { usePageVisible } from './usePageVisible'

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
  const pageVisible = usePageVisible()

  // Fetch from backend on range change and poll for updates.
  useEffect(() => {
    if (!pageVisible) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let controller: AbortController | null = null
    const everyMs = range === '1m' ? 2000 : 5000

    const load = async () => {
      controller?.abort()
      controller = new AbortController()

      try {
        const res = await fetch(`/api/metrics/history?range=${range}`, {
          signal: controller.signal,
        })
        if (res.ok) {
          const data = (await res.json()) as { points?: BackendPoint[] }
          if (!cancelled) {
            setPoints(
              (data.points ?? []).map((p) => ({
                timestamp: p.t,
                cpu: p.cpu,
                memory: p.mem,
                disk: p.disk,
                netUp: p.netUp,
                netDown: p.netDown,
              })),
            )
          }
        }
      } catch {
        /* keep last good data */
      } finally {
        if (!cancelled) timer = setTimeout(load, everyMs)
      }
    }

    load()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      controller?.abort()
    }
  }, [range, pageVisible])

  // Append the latest live reading between polls for real-time feedback.
  useEffect(() => {
    if (!connected || !pageVisible) return
    const ts = Date.now()
    setPoints((prev) => {
      if (prev.length > 0 && ts - prev[prev.length - 1].timestamp < 1500) return prev
      return [...prev, { timestamp: ts, cpu, memory, disk, netUp, netDown }]
    })
  }, [cpu, memory, disk, netUp, netDown, connected, pageVisible])

  const visible = useMemo(() => {
    const cutoff = Date.now() - RANGE_MS[range]
    return points.filter((p) => p.timestamp >= cutoff)
  }, [points, range])

  return { visible, range, setRange, historyLength: points.length }
}

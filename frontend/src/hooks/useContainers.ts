import { useCallback, useEffect, useRef, useState } from 'react'
import type { ContainerInfo } from '../types'
import { usePageVisible } from './usePageVisible'

function sameContainers(a: ContainerInfo[], b: ContainerInfo[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    const y = b[i]
    if (
      x.id !== y.id ||
      x.name !== y.name ||
      x.state !== y.state ||
      x.status !== y.status ||
      x.uptime !== y.uptime ||
      x.publicUrl !== y.publicUrl
    ) {
      return false
    }
  }
  return true
}

export function useContainers(pollMs = 10000) {
  const [containers, setContainers] = useState<ContainerInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pageVisible = usePageVisible()
  const abortRef = useRef<AbortController | null>(null)

  const fetchContainers = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/containers', { signal: controller.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as ContainerInfo[]
      // Keep the previous array when nothing changed so consumers skip re-rendering.
      setContainers((prev) => (sameContainers(prev, data) ? prev : data))
      setError(null)
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!pageVisible) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    // Chained timeouts instead of setInterval: a slow response can never stack
    // up overlapping requests.
    const tick = async () => {
      await fetchContainers()
      if (cancelled) return
      timer = setTimeout(tick, pollMs)
    }

    tick()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      abortRef.current?.abort()
      abortRef.current = null
    }
  }, [fetchContainers, pollMs, pageVisible])

  return { containers, loading, error, refresh: fetchContainers }
}

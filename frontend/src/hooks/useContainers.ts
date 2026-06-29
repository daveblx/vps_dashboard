import { useCallback, useEffect, useState } from 'react'
import type { ContainerInfo } from '../types'

export function useContainers(pollMs = 10000) {
  const [containers, setContainers] = useState<ContainerInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchContainers = useCallback(async () => {
    try {
      const res = await fetch('/api/containers')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as ContainerInfo[]
      setContainers(data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchContainers()
    const id = setInterval(fetchContainers, pollMs)
    return () => clearInterval(id)
  }, [fetchContainers, pollMs])

  return { containers, loading, error, refresh: fetchContainers }
}

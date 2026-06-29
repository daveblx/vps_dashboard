import { useCallback, useEffect, useRef, useState } from 'react'

export function useLogStream(containerId: string | null) {
  const [lines, setLines] = useState<string[]>([])
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setStreaming(false)
  }, [])

  const start = useCallback(async (id: string) => {
    stop()
    setLines([])
    setError(null)
    setStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch(`/api/containers/${id}/logs?stream=true&tail=200`, {
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          for (const line of part.split('\n')) {
            if (line.startsWith('data: ')) {
              const raw = line.slice(6)
              try {
                setLines((prev) => {
                  const next = [...prev, JSON.parse(raw) as string]
                  return next.length > 500 ? next.slice(-500) : next
                })
              } catch {
                setLines((prev) => {
                  const next = [...prev, raw]
                  return next.length > 500 ? next.slice(-500) : next
                })
              }
            }
          }
        }
      }
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') {
        setError(e.message)
      }
    } finally {
      setStreaming(false)
    }
  }, [stop])

  useEffect(() => {
    if (containerId) start(containerId)
    return stop
  }, [containerId, start, stop])

  return { lines, streaming, error, stop }
}

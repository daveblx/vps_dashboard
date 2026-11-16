import { useCallback, useEffect, useRef, useState } from 'react'

const MAX_LINES = 500
const FLUSH_MS = 100

export function useLogStream(containerId: string | null) {
  const [lines, setLines] = useState<string[]>([])
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const pendingRef = useRef<string[]>([])
  const flushRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback(() => {
    flushRef.current = null
    const batch = pendingRef.current
    if (batch.length === 0) return
    pendingRef.current = []
    setLines((prev) => {
      const next = prev.concat(batch)
      return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next
    })
  }, [])

  // Buffer incoming lines and flush on a timer: a chatty container can emit
  // dozens of lines per second and each one used to trigger its own render.
  const push = useCallback(
    (line: string) => {
      pendingRef.current.push(line)
      if (flushRef.current === null) flushRef.current = setTimeout(flush, FLUSH_MS)
    },
    [flush],
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    if (flushRef.current) clearTimeout(flushRef.current)
    flushRef.current = null
    pendingRef.current = []
    setStreaming(false)
  }, [])

  const start = useCallback(
    async (id: string) => {
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
              if (!line.startsWith('data: ')) continue
              const raw = line.slice(6)
              try {
                push(JSON.parse(raw) as string)
              } catch {
                push(raw)
              }
            }
          }
        }
      } catch (e) {
        if (e instanceof Error && e.name !== 'AbortError') {
          setError(e.message)
        }
      } finally {
        flush()
        setStreaming(false)
      }
    },
    [flush, push, stop],
  )

  useEffect(() => {
    if (containerId) start(containerId)
    return stop
  }, [containerId, start, stop])

  return { lines, streaming, error, stop }
}

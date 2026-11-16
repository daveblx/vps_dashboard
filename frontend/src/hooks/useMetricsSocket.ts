import { useCallback, useEffect, useRef, useState } from 'react'
import type { ConnectionState, MetricsFrame } from '../types'

const WS_URL =
  `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`

const BASE_RECONNECT_MS = 1000
const MAX_RECONNECT_MS = 10000

export function useMetricsSocket() {
  const [frame, setFrame] = useState<MetricsFrame | null>(null)
  const [connection, setConnection] = useState<ConnectionState>('connecting')
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attemptRef = useRef(0)
  const closedRef = useRef(false)

  const connect = useCallback(() => {
    if (closedRef.current) return
    // CONNECTING (0) or OPEN (1): a socket is already in flight.
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) return

    setConnection('connecting')
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      if (wsRef.current !== ws) return
      attemptRef.current = 0
      setConnection('connected')
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as MetricsFrame
        if (data.type === 'metrics') setFrame(data)
      } catch {
        /* ignore malformed frames */
      }
    }

    ws.onclose = () => {
      // A socket replaced by a newer one must not report the connection down.
      if (wsRef.current !== ws) return
      wsRef.current = null
      setConnection('disconnected')
      if (closedRef.current) return

      // Exponential backoff with jitter so a restarting backend does not get
      // hammered by every open dashboard at the same instant.
      const delay = Math.min(BASE_RECONNECT_MS * 2 ** attemptRef.current, MAX_RECONNECT_MS)
      attemptRef.current += 1
      reconnectRef.current = setTimeout(connect, delay * (0.75 + Math.random() * 0.5))
    }

    ws.onerror = () => ws.close()
  }, [])

  useEffect(() => {
    closedRef.current = false
    connect()

    // Skip the remaining backoff when the tab is refocused or the network
    // comes back: the user is looking at the screen and expects live data.
    const retryNow = () => {
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current)
        reconnectRef.current = null
      }
      attemptRef.current = 0
      connect()
    }

    const onVisibility = () => {
      if (!document.hidden) retryNow()
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('online', retryNow)

    return () => {
      closedRef.current = true
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', retryNow)
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      reconnectRef.current = null
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [connect])

  return { frame, connection }
}

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ConnectionState, MetricsFrame } from '../types'

const WS_URL =
  `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`

const RECONNECT_MS = 2000

export function useMetricsSocket() {
  const [frame, setFrame] = useState<MetricsFrame | null>(null)
  const [connection, setConnection] = useState<ConnectionState>('connecting')
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setConnection('connecting')
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => setConnection('connected')

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as MetricsFrame
        if (data.type === 'metrics') setFrame(data)
      } catch {
        /* ignore malformed frames */
      }
    }

    ws.onclose = () => {
      setConnection('disconnected')
      wsRef.current = null
      reconnectRef.current = setTimeout(connect, RECONNECT_MS)
    }

    ws.onerror = () => ws.close()
  }, [])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { frame, connection }
}

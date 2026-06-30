import { useCallback, useEffect, useState } from 'react'

export interface TraktConfig {
  clientId: string
  hasSecret: boolean
  redirectUri: string
  configured: boolean
}

export function useTraktConfig() {
  const [config, setConfig] = useState<TraktConfig | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/trakt/config')
      if (res.ok) setConfig((await res.json()) as TraktConfig)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const save = useCallback(
    async (clientId: string, clientSecret: string, redirectUri: string) => {
      const res = await fetch('/api/trakt/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, clientSecret, redirectUri }),
      })
      if (res.ok) {
        setConfig((await res.json()) as TraktConfig)
        return true
      }
      return false
    },
    [],
  )

  return { config, loading, save, refresh }
}

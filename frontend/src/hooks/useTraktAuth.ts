import { useCallback, useEffect, useState } from 'react'
import type { TraktAuthState } from '../types'

export function useTraktAuth() {
  const [auth, setAuth] = useState<TraktAuthState>({ connected: false, username: '' })
  const [loading, setLoading] = useState(true)

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/trakt/me')
      if (res.ok) {
        const data = await res.json()
        setAuth({ connected: data.connected, username: data.username || '' })
      }
    } catch {
      setAuth({ connected: false, username: '' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const login = useCallback(() => {
    window.location.href = '/api/auth/trakt/login'
  }, [])

  const logout = useCallback(async () => {
    await fetch('/api/auth/trakt/logout', { method: 'POST' })
    setAuth({ connected: false, username: '' })
  }, [])

  return { auth, loading, login, logout, refresh: checkAuth }
}
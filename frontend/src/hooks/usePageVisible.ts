import { useEffect, useState } from 'react'

/**
 * Tracks whether the tab is currently visible. Polling hooks use this to stop
 * hitting the backend while the dashboard sits in a background tab.
 */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(
    () => typeof document === 'undefined' || !document.hidden,
  )

  useEffect(() => {
    const onChange = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])

  return visible
}

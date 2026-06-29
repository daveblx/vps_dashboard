import type { ConnectionState } from '../types'

interface StatusBarProps {
  connection: ConnectionState
}

export function StatusBar({ connection }: StatusBarProps) {
  const labels: Record<ConnectionState, string> = {
    connected: 'LIVE',
    connecting: 'SYNC',
    disconnected: 'OFFLINE',
  }

  return (
    <header className="header">
      <span className="header__title">VPS Dashboard</span>
      <div className="header__status">
        <span className={`status-dot status-dot--${connection}`} />
        <span>{labels[connection]}</span>
      </div>
    </header>
  )
}

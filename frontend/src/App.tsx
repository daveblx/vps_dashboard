import { useCallback, useMemo, useState } from 'react'
import { ContainerList } from './components/ContainerList'
import { HomePage } from './components/HomePage'
import { HostMetricsView } from './components/HostMetrics'
import { LogViewer } from './components/LogViewer'
import { NavTabs } from './components/NavTabs'
import { SettingsPage } from './components/SettingsPage'
import { StatusBar } from './components/StatusBar'
import { useSettings } from './context/SettingsContext'
import { useContainers } from './hooks/useContainers'
import { useLogStream } from './hooks/useLogStream'
import { useMetricsSocket } from './hooks/useMetricsSocket'
import type { ConnectionState, TabId } from './types'

export default function App() {
  const { settings } = useSettings()
  const [tab, setTab] = useState<TabId>('home')
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null)

  const { frame, connection } = useMetricsSocket()
  const { containers, loading, error } = useContainers(settings.pollIntervalMs)
  const { lines, streaming, error: logError } = useLogStream(
    tab === 'logs' ? selectedContainerId : null,
  )

  const selectedName = useMemo(
    () => containers.find((c) => c.id === selectedContainerId)?.name ?? null,
    [containers, selectedContainerId],
  )

  const handleSelectContainer = useCallback((id: string) => {
    setSelectedContainerId(id)
    setTab('logs')
  }, [])

  const connectionLabels: Record<ConnectionState, string> = {
    connected: 'LIVE',
    connecting: 'SYNC',
    disconnected: 'OFFLINE',
  }

  const isWide = typeof window !== 'undefined' && window.innerWidth >= 768

  return (
    <div className={`app${isWide ? ' app--wide' : ''}`}>
      <StatusBar connection={connection} />

      <main className="main">
        {tab === 'home' && (
          <HomePage
            host={frame?.host ?? null}
            containers={containers}
            stats={frame?.containers ?? []}
            containersLoading={loading}
            containersError={error}
            connectionLabel={connectionLabels[connection]}
            connected={connection === 'connected'}
          />
        )}

        {tab === 'metrics' && (
          <HostMetricsView
            host={frame?.host ?? null}
            connected={connection === 'connected'}
          />
        )}

        {tab === 'containers' && (
          <ContainerList
            containers={containers}
            stats={frame?.containers ?? []}
            loading={loading}
            error={error}
            selectedId={selectedContainerId}
            onSelect={handleSelectContainer}
            showPin
          />
        )}

        {tab === 'logs' && (
          <LogViewer
            containerName={selectedName}
            lines={lines}
            streaming={streaming}
            error={logError}
          />
        )}

        {tab === 'settings' && <SettingsPage />}
      </main>

      <NavTabs active={tab} onChange={setTab} />
    </div>
  )
}

import { useCallback, useMemo, useState } from 'react'
import { ContainerList } from './components/ContainerList'
import { HostMetricsView } from './components/HostMetrics'
import { LogViewer } from './components/LogViewer'
import { NavTabs } from './components/NavTabs'
import { StatusBar } from './components/StatusBar'
import { useContainers } from './hooks/useContainers'
import { useLogStream } from './hooks/useLogStream'
import { useMetricsSocket } from './hooks/useMetricsSocket'
import type { TabId } from './types'

export default function App() {
  const [tab, setTab] = useState<TabId>('metrics')
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null)

  const { frame, connection } = useMetricsSocket()
  const { containers, loading, error } = useContainers()
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

  const isWide = typeof window !== 'undefined' && window.innerWidth >= 768

  return (
    <div className={`app${isWide ? ' app--wide' : ''}`}>
      <StatusBar connection={connection} />

      <main className="main">
        {tab === 'metrics' && <HostMetricsView host={frame?.host ?? null} />}

        {tab === 'containers' && (
          <ContainerList
            containers={containers}
            stats={frame?.containers ?? []}
            loading={loading}
            error={error}
            selectedId={selectedContainerId}
            onSelect={handleSelectContainer}
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
      </main>

      <NavTabs active={tab} onChange={setTab} />
    </div>
  )
}

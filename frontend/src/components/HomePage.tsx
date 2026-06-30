import { ContainerList } from './ContainerList'
import { CrosswatchWidget } from './CrosswatchWidget'
import { HostMetricsView } from './HostMetrics'
import { useSettings } from '../context/SettingsContext'
import type { ContainerInfo, ContainerStats, HostMetrics } from '../types'

interface HomePageProps {
  host: HostMetrics | null
  containers: ContainerInfo[]
  stats: ContainerStats[]
  containersLoading: boolean
  containersError: string | null
  connectionLabel: string
}

function MetricsSummaryWidget({ host }: { host: HostMetrics | null }) {
  return (
    <div className="widget widget--metrics">
      <div className="widget__header">
        <span className="widget__title">System Overview</span>
      </div>
      <HostMetricsView host={host} />
    </div>
  )
}

function ContainersSummaryWidget({
  containers,
  stats,
  loading,
  error,
}: {
  containers: ContainerInfo[]
  stats: ContainerStats[]
  loading: boolean
  error: string | null
}) {
  return (
    <div className="widget widget--containers">
      <div className="widget__header">
        <span className="widget__title">Containers</span>
        <span className="widget__badge">{containers.length} running</span>
      </div>
      <ContainerList
        containers={containers}
        stats={stats}
        loading={loading}
        error={error}
        selectedId={null}
        onSelect={() => {}}
      />
    </div>
  )
}

export function HomePage({
  host,
  containers,
  stats,
  containersLoading,
  containersError,
  connectionLabel,
}: HomePageProps) {
  const { settings } = useSettings()
  const widgets = settings.homeWidgets

  if (widgets.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-state__icon">⌂</span>
        <span>
          No widgets enabled.<br />
          Go to <strong>Settings</strong> to customize your dashboard.
        </span>
      </div>
    )
  }

  return (
    <div className="home-page">
      <div className="home-header">
        <span className="home-header__greeting">
          {getGreeting()}
        </span>
        <span className="home-header__status">{connectionLabel}</span>
      </div>

      <div className="home-widgets">
        {widgets.includes('metrics-summary') && (
          <MetricsSummaryWidget host={host} />
        )}

        {widgets.includes('containers-summary') && (
          <ContainersSummaryWidget
            containers={containers}
            stats={stats}
            loading={containersLoading}
            error={containersError}
          />
        )}

        {widgets.includes('crosswatch') && <CrosswatchWidget />}
      </div>
    </div>
  )
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
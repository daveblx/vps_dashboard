import { useState } from 'react'
import { ContainerList } from './ContainerList'
import { CrosswatchWidget } from './CrosswatchWidget'
import { HostMetricsView } from './HostMetrics'
import { useSettings } from '../context/SettingsContext'
import type {
  ContainerInfo,
  ContainerStats,
  HomeWidgetLayout,
  HostMetrics,
} from '../types'
import { WIDGET_DEFS, widgetLabel } from '../widgets'

interface HomePageProps {
  host: HostMetrics | null
  containers: ContainerInfo[]
  stats: ContainerStats[]
  containersLoading: boolean
  containersError: string | null
  connectionLabel: string
  connected: boolean
}

function MetricsSummaryWidget({
  host,
  connected,
}: {
  host: HostMetrics | null
  connected: boolean
}) {
  return (
    <div className="widget widget--metrics">
      <div className="widget__header">
        <span className="widget__title">System Overview</span>
      </div>
      <HostMetricsView host={host} connected={connected} compact />
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
  const { settings } = useSettings()
  const pinned = settings.pinnedContainers

  const visible = pinned.length > 0
    ? containers.filter((c) => pinned.includes(c.id))
    : containers.slice(0, 4)

  return (
    <div className="widget widget--containers">
      <div className="widget__header">
        <span className="widget__title">Containers</span>
        <span className="widget__badge">
          {pinned.length > 0 ? `${visible.length} pinned` : `${containers.length} running`}
        </span>
      </div>
      <ContainerList
        containers={visible}
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
  connected,
}: HomePageProps) {
  const { settings, updateSettings } = useSettings()
  const layout = settings.homeLayout
  const [editing, setEditing] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const setLayout = (next: HomeWidgetLayout[]) => updateSettings({ homeLayout: next })

  const move = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= layout.length || to >= layout.length) return
    const next = [...layout]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    setLayout(next)
  }

  const setSpan = (id: string, span: 1 | 2) =>
    setLayout(layout.map((w) => (w.id === id ? { ...w, span } : w)))

  const remove = (id: string) => setLayout(layout.filter((w) => w.id !== id))

  const add = (id: string) => {
    const def = WIDGET_DEFS.find((w) => w.id === id)
    setLayout([...layout, { id, span: def?.defaultSpan ?? 1 }])
  }

  const renderWidget = (id: string) => {
    switch (id) {
      case 'metrics-summary':
        return <MetricsSummaryWidget host={host} connected={connected} />
      case 'containers-summary':
        return (
          <ContainersSummaryWidget
            containers={containers}
            stats={stats}
            loading={containersLoading}
            error={containersError}
          />
        )
      case 'crosswatch':
        return <CrosswatchWidget />
      default:
        return null
    }
  }

  const available = WIDGET_DEFS.filter((w) => !layout.some((l) => l.id === w.id))

  return (
    <div className="home-page">
      <div className="home-header">
        <span className="home-header__greeting">{getGreeting()}</span>
        <div className="home-header__actions">
          <span className="home-header__status">{connectionLabel}</span>
          <button
            className={`home-edit-btn${editing ? ' home-edit-btn--active' : ''}`}
            onClick={() => setEditing((e) => !e)}
            type="button"
          >
            {editing ? 'Done' : 'Edit'}
          </button>
        </div>
      </div>

      {layout.length === 0 && !editing && (
        <div className="empty-state">
          <span className="empty-state__icon">⌂</span>
          <span>
            No widgets on your dashboard.<br />
            Tap <strong>Edit</strong> to add some.
          </span>
        </div>
      )}

      <div className={`home-widgets${editing ? ' home-widgets--editing' : ''}`}>
        {layout.map((w, i) => (
          <div
            key={w.id}
            className={`home-widget home-widget--span${w.span}${
              dragIndex === i ? ' home-widget--dragging' : ''
            }`}
            draggable={editing}
            onDragStart={() => setDragIndex(i)}
            onDragEnd={() => setDragIndex(null)}
            onDragOver={(e) => {
              if (!editing || dragIndex === null) return
              e.preventDefault()
              if (dragIndex !== i) {
                move(dragIndex, i)
                setDragIndex(i)
              }
            }}
          >
            {editing && (
              <div className="home-widget__toolbar">
                <span className="home-widget__handle" title="Drag to reorder">
                  ⠿ {widgetLabel(w.id)}
                </span>
                <div className="home-widget__controls">
                  <button
                    className="home-widget__btn"
                    onClick={() => move(i, i - 1)}
                    disabled={i === 0}
                    type="button"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    className="home-widget__btn"
                    onClick={() => move(i, i + 1)}
                    disabled={i === layout.length - 1}
                    type="button"
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    className="home-widget__btn"
                    onClick={() => setSpan(w.id, w.span === 2 ? 1 : 2)}
                    type="button"
                    title={w.span === 2 ? 'Make narrow' : 'Make wide'}
                  >
                    {w.span === 2 ? '◧' : '▭'}
                  </button>
                  <button
                    className="home-widget__btn home-widget__btn--danger"
                    onClick={() => remove(w.id)}
                    type="button"
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
            <div className="home-widget__body">{renderWidget(w.id)}</div>
          </div>
        ))}
      </div>

      {editing && available.length > 0 && (
        <div className="home-palette">
          <span className="home-palette__title">Add widget</span>
          <div className="home-palette__items">
            {available.map((w) => (
              <button
                key={w.id}
                className="home-palette__item"
                onClick={() => add(w.id)}
                type="button"
              >
                + {w.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

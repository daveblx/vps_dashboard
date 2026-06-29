import type { ContainerInfo, ContainerStats } from '../types'
import { formatPercent, shortName, statusColor } from '../utils/format'

interface ContainerListProps {
  containers: ContainerInfo[]
  stats: ContainerStats[]
  loading: boolean
  error: string | null
  selectedId: string | null
  onSelect: (id: string) => void
}

function findStats(stats: ContainerStats[], id: string): ContainerStats | undefined {
  return stats.find((s) => s.id === id || id.startsWith(s.id) || s.id.startsWith(id))
}

export function ContainerList({
  containers,
  stats,
  loading,
  error,
  selectedId,
  onSelect,
}: ContainerListProps) {
  if (error) {
    return <div className="error-banner">{error}</div>
  }

  if (loading && containers.length === 0) {
    return (
      <div className="container-list">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton" />
        ))}
      </div>
    )
  }

  if (containers.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-state__icon">⬡</span>
        <span>No running containers</span>
      </div>
    )
  }

  return (
    <div className="container-list">
      {containers.map((c) => {
        const s = findStats(stats, c.id)
        const isSelected = selectedId === c.id

        return (
          <div
            key={c.id}
            className={`container-row${isSelected ? ' container-row--selected' : ''}`}
            onClick={() => onSelect(c.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onSelect(c.id)}
          >
            <span
              className="container-row__dot"
              style={{ background: statusColor(c.state) }}
            />
            <div className="container-row__info">
              <div className="container-row__name">{shortName(c.name, 22)}</div>
              <div className="container-row__meta">
                {c.uptime || c.status}
              </div>
            </div>
            {s && (
              <div className="container-row__stats">
                <div className="container-row__cpu">{formatPercent(s.cpuPercent, 1)}</div>
                <div className="container-row__mem">{formatPercent(s.memoryPercent, 0)} mem</div>
              </div>
            )}
            {c.publicUrl && (
              <a
                className="container-row__link"
                href={c.publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                aria-label={`Open ${c.name}`}
              >
                ↗
              </a>
            )}
          </div>
        )
      })}
    </div>
  )
}

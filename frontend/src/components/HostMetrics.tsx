import type { HostMetrics } from '../types'
import { clamp, formatBytes, formatBytesPerSec, formatPercent } from '../utils/format'

interface HostMetricsViewProps {
  host: HostMetrics | null
}

function barClass(percent: number): string {
  if (percent >= 90) return 'bar__fill--danger'
  if (percent >= 70) return 'bar__fill--warn'
  return 'bar__fill--ok'
}

export function HostMetricsView({ host }: HostMetricsViewProps) {
  if (!host) {
    return (
      <div className="metrics-grid">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton" />
        ))}
      </div>
    )
  }

  const cpu = clamp(host.cpuPercent, 0, 100)
  const mem = clamp(host.memoryPercent, 0, 100)
  const disk = clamp(host.disk.usedPercent, 0, 100)

  return (
    <div className="metrics-grid">
      <div className="metric-card">
        <div className="metric-card__label">CPU</div>
        <div className="metric-card__value">{formatPercent(cpu, 0)}</div>
        <div className="bar">
          <div className={`bar__fill ${barClass(cpu)}`} style={{ width: `${cpu}%` }} />
        </div>
      </div>

      <div className="metric-card">
        <div className="metric-card__label">Memory</div>
        <div className="metric-card__value">{formatPercent(mem, 0)}</div>
        <div className="metric-card__sub">
          {formatBytes(host.memoryUsed)} / {formatBytes(host.memoryTotal)}
        </div>
        <div className="bar">
          <div className={`bar__fill ${barClass(mem)}`} style={{ width: `${mem}%` }} />
        </div>
      </div>

      <div className="metric-card">
        <div className="metric-card__label">Disk</div>
        <div className="metric-card__value">{formatPercent(disk, 0)}</div>
        <div className="metric-card__sub">
          {formatBytes(host.disk.used)} / {formatBytes(host.disk.total)}
        </div>
        <div className="bar">
          <div className={`bar__fill ${barClass(disk)}`} style={{ width: `${disk}%` }} />
        </div>
      </div>

      <div className="metric-card">
        <div className="metric-card__label">Network</div>
        <div className="network-row">
          <span className="up">↑ {formatBytesPerSec(host.network.bytesSentPerSec)}</span>
          <span className="down">↓ {formatBytesPerSec(host.network.bytesRecvPerSec)}</span>
        </div>
        <div className="metric-card__sub" style={{ marginTop: 6 }}>
          Σ ↑{formatBytes(host.network.totalBytesSent)} ↓{formatBytes(host.network.totalBytesRecv)}
        </div>
      </div>
    </div>
  )
}

import { useMemo } from 'react'
import type { HostMetrics } from '../types'
import {
  chartCpu,
  chartDisk,
  chartMemory,
  chartNetDown,
  chartNetUp,
  MetricsChart,
  RangeSelector,
} from './MetricsChart'
import { useMetricsHistory } from '../hooks/useMetricsHistory'
import { clamp, formatBytes, formatBytesPerSec, formatPercent } from '../utils/format'

interface HostMetricsViewProps {
  host: HostMetrics | null
  connected: boolean
  compact?: boolean
}

function barClass(percent: number): string {
  if (percent >= 90) return 'bar__fill--danger'
  if (percent >= 70) return 'bar__fill--warn'
  return 'bar__fill--ok'
}

export function HostMetricsView({ host, connected, compact }: HostMetricsViewProps) {
  const cpuRaw = host ? clamp(host.cpuPercent, 0, 100) : 0
  const memRaw = host ? clamp(host.memoryPercent, 0, 100) : 0
  const diskRaw = host ? clamp(host.disk.usedPercent, 0, 100) : 0
  const netUp = host ? host.network.bytesSentPerSec : 0
  const netDown = host ? host.network.bytesRecvPerSec : 0

  const { visible, range, setRange } = useMetricsHistory(
    cpuRaw,
    memRaw,
    diskRaw,
    netUp,
    netDown,
    connected,
  )

  // Derive the series once per data change instead of on every render, so the
  // chart's own memo actually hits.
  const cpuSeries = useMemo(() => chartCpu(visible), [visible])
  const memSeries = useMemo(() => chartMemory(visible), [visible])
  const diskSeries = useMemo(() => chartDisk(visible), [visible])
  const netUpSeries = useMemo(() => chartNetUp(visible), [visible])
  const netDownSeries = useMemo(() => chartNetDown(visible), [visible])

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

  const chartH = compact ? 28 : 40

  return (
    <div className="metrics-section">
      {!compact && <RangeSelector range={range} onChange={setRange} />}

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-card__label">CPU</div>
          <div className="metric-card__value">{formatPercent(cpu, 0)}</div>
          <div className="bar">
            <div className={`bar__fill ${barClass(cpu)}`} style={{ width: `${cpu}%` }} />
          </div>
          <div className="metric-card__chart">
            <MetricsChart data={cpuSeries} color="var(--color-accent)" height={chartH} compact={compact} label="cpu" />
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
          <div className="metric-card__chart">
            <MetricsChart data={memSeries} color="var(--color-warn)" height={chartH} compact={compact} label="mem" />
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
          <div className="metric-card__chart">
            <MetricsChart data={diskSeries} color="var(--color-ok)" height={chartH} compact={compact} label="disk" />
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-card__label">Network</div>
          <div className="network-row">
            <span className="up">↑ {formatBytesPerSec(host.network.bytesSentPerSec)}</span>
            <span className="down">↓ {formatBytesPerSec(host.network.bytesRecvPerSec)}</span>
          </div>
          <div className="metric-card__sub metric-card__sub--spaced">
            Σ ↑{formatBytes(host.network.totalBytesSent)} ↓{formatBytes(host.network.totalBytesRecv)}
          </div>
          {visible.length > 1 && (
            <div className="metric-card__chart metric-card__chart--pair">
              <div className="metric-card__chart-half">
                <MetricsChart data={netDownSeries} color="var(--color-text-dim)" height={chartH} compact label="netDown" />
              </div>
              <div className="metric-card__chart-half">
                <MetricsChart data={netUpSeries} color="var(--color-accent)" height={chartH} compact label="netUp" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export interface NetworkStats {
  bytesSentPerSec: number
  bytesRecvPerSec: number
  totalBytesSent: number
  totalBytesRecv: number
}

export interface DiskStats {
  total: number
  used: number
  free: number
  usedPercent: number
}

export interface HostMetrics {
  timestamp: number
  cpuPercent: number
  memoryUsed: number
  memoryTotal: number
  memoryPercent: number
  disk: DiskStats
  network: NetworkStats
}

export interface ContainerStats {
  id: string
  name: string
  cpuPercent: number
  memoryUsage: number
  memoryLimit: number
  memoryPercent: number
}

export interface ContainerInfo {
  id: string
  name: string
  status: string
  state: string
  uptime: string
  startedAt: string
  publicUrl: string
}

export interface MetricsFrame {
  type: string
  timestamp: number
  host: HostMetrics
  containers: ContainerStats[]
}

export type TabId = 'metrics' | 'containers' | 'logs'

export type ConnectionState = 'connecting' | 'connected' | 'disconnected'

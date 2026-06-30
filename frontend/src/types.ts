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

export type TabId = 'home' | 'metrics' | 'containers' | 'logs' | 'settings'

export type ConnectionState = 'connecting' | 'connected' | 'disconnected'

export interface ThemeColors {
  bg: string
  surface: string
  border: string
  text: string
  textDim: string
  accent: string
  ok: string
  warn: string
  danger: string
  muted: string
}

export interface ThemePreset {
  id: string
  name: string
  colors: ThemeColors
}

export interface AppSettings {
  theme: string
  customColors: ThemeColors | null
  pollIntervalMs: number
  homeWidgets: string[]
  pinnedContainers: string[]
  tmdbApiKey: string
}

export interface TraktMovie {
  title: string
  year: number
  ids: {
    trakt: number
    slug: string
    tmdb: number
    imdb: string
  }
}

export interface TraktWatchedMovie {
  plays: number
  last_watched_at: string
  movie: TraktMovie
}

export interface TMDBMovieDetail {
  tmdbId: number
  title: string
  posterPath: string | null
  backdropPath: string | null
  releaseDate: string
  voteAverage: number
  overview: string
  runtime: number
  genres: string[]
  tagline: string
}

export interface CrosswatchMovie {
  tmdbId: number
  title: string
  year: number
  posterPath: string | null
  voteAverage: number
  runtime: number
  genres: string[]
  watched: boolean
  watchedAt: string | null
  plays: number
}

export type MetricsTimeRange = '1m' | '1h' | '12h' | '24h'

export interface MetricsSnapshot {
  timestamp: number
  cpu: number
  memory: number
  disk: number
  netUp: number
  netDown: number
}

export interface TraktAuthState {
  connected: boolean
  username: string
}

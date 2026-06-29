const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), UNITS.length - 1)
  const value = bytes / Math.pow(k, i)
  return `${value.toFixed(i === 0 ? 0 : decimals)} ${UNITS[i]}`
}

export function formatBytesPerSec(bytes: number): string {
  return `${formatBytes(bytes)}/s`
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function statusColor(state: string): string {
  const s = state.toLowerCase()
  if (s === 'running') return 'var(--color-ok)'
  if (s === 'paused' || s === 'restarting') return 'var(--color-warn)'
  return 'var(--color-muted)'
}

export function shortName(name: string, max = 18): string {
  if (name.length <= max) return name
  return name.slice(0, max - 1) + '…'
}

export function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

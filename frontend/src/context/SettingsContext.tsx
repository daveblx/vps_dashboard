import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { AppSettings, ThemeColors, ThemePreset } from '../types'

const PRESETS: ThemePreset[] = [
  {
    id: 'oled',
    name: 'OLED Green',
    colors: {
      bg: '#000000',
      surface: '#0a0a0a',
      border: '#1a1a1a',
      text: '#c8ffc8',
      textDim: '#5a8a5a',
      accent: '#00ff66',
      ok: '#00ff66',
      warn: '#ffb020',
      danger: '#ff4444',
      muted: '#444444',
    },
  },
  {
    id: 'dark-blue',
    name: 'Dark Blue',
    colors: {
      bg: '#0a0e1a',
      surface: '#111827',
      border: '#1e293b',
      text: '#cbd5e1',
      textDim: '#64748b',
      accent: '#38bdf8',
      ok: '#34d399',
      warn: '#fbbf24',
      danger: '#f87171',
      muted: '#475569',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight Purple',
    colors: {
      bg: '#0c0a14',
      surface: '#151125',
      border: '#252040',
      text: '#d4c5f0',
      textDim: '#7c6fa0',
      accent: '#a78bfa',
      ok: '#6ee7b7',
      warn: '#fcd34d',
      danger: '#fca5a5',
      muted: '#4a4060',
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    colors: {
      bg: '#0a140e',
      surface: '#0f1f14',
      border: '#1a3320',
      text: '#b8d4be',
      textDim: '#5a7a62',
      accent: '#4ade80',
      ok: '#22c55e',
      warn: '#eab308',
      danger: '#ef4444',
      muted: '#3a5a42',
    },
  },
  {
    id: 'amber',
    name: 'Amber Terminal',
    colors: {
      bg: '#0d0b07',
      surface: '#16120c',
      border: '#2a2216',
      text: '#f0d9a0',
      textDim: '#8a7a50',
      accent: '#f59e0b',
      ok: '#f59e0b',
      warn: '#fbbf24',
      danger: '#dc2626',
      muted: '#5a4a30',
    },
  },
  {
    id: 'light',
    name: 'Light',
    colors: {
      bg: '#f8f9fa',
      surface: '#ffffff',
      border: '#dee2e6',
      text: '#212529',
      textDim: '#6c757d',
      accent: '#0d6efd',
      ok: '#198754',
      warn: '#ffc107',
      danger: '#dc3545',
      muted: '#adb5bd',
    },
  },
]

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'oled',
  customColors: null,
  pollIntervalMs: 10000,
  homeWidgets: ['metrics-summary', 'containers-summary', 'crosswatch'],
  tmdbApiKey: '',
  traktClientId: '',
  traktUsername: '',
}

const STORAGE_KEY = 'vps-dashboard-settings'

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS
}

function saveSettings(settings: AppSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch { /* ignore */ }
}

function applyColors(colors: ThemeColors) {
  const root = document.documentElement
  root.style.setProperty('--color-bg', colors.bg)
  root.style.setProperty('--color-surface', colors.surface)
  root.style.setProperty('--color-border', colors.border)
  root.style.setProperty('--color-text', colors.text)
  root.style.setProperty('--color-text-dim', colors.textDim)
  root.style.setProperty('--color-accent', colors.accent)
  root.style.setProperty('--color-ok', colors.ok)
  root.style.setProperty('--color-warn', colors.warn)
  root.style.setProperty('--color-danger', colors.danger)
  root.style.setProperty('--color-muted', colors.muted)
}

function resolveColors(settings: AppSettings): ThemeColors {
  if (settings.customColors) return settings.customColors
  const preset = PRESETS.find((p) => p.id === settings.theme) ?? PRESETS[0]
  return preset.colors
}

interface SettingsContextValue {
  settings: AppSettings
  activeColors: ThemeColors
  presets: ThemePreset[]
  updateSettings: (patch: Partial<AppSettings>) => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings)

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      saveSettings(next)
      return next
    })
  }, [])

  const activeColors = useMemo(() => resolveColors(settings), [settings.theme, settings.customColors])

  useEffect(() => {
    applyColors(activeColors)
  }, [activeColors])

  const value = useMemo(
    () => ({ settings, activeColors, presets: PRESETS, updateSettings }),
    [settings, activeColors, updateSettings],
  )

  return <SettingsContext value={value}>{children}</SettingsContext>
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}

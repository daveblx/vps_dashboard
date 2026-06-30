import type { HomeWidgetLayout } from './types'

export interface WidgetDef {
  id: string
  label: string
  defaultSpan: 1 | 2
}

// Registry of all widgets that can appear on the home dashboard.
export const WIDGET_DEFS: WidgetDef[] = [
  { id: 'metrics-summary', label: 'System Overview', defaultSpan: 2 },
  { id: 'containers-summary', label: 'Containers', defaultSpan: 1 },
  { id: 'crosswatch', label: 'Crosswatch', defaultSpan: 2 },
]

export function widgetLabel(id: string): string {
  return WIDGET_DEFS.find((w) => w.id === id)?.label ?? id
}

export const DEFAULT_HOME_LAYOUT: HomeWidgetLayout[] = WIDGET_DEFS.map((w) => ({
  id: w.id,
  span: w.defaultSpan,
}))

// Builds a layout from a legacy list of enabled widget ids, preserving the
// canonical widget order and default spans.
export function layoutFromWidgetIds(ids: string[]): HomeWidgetLayout[] {
  return WIDGET_DEFS.filter((w) => ids.includes(w.id)).map((w) => ({
    id: w.id,
    span: w.defaultSpan,
  }))
}

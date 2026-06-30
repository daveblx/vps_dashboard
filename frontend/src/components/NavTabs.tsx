import type { TabId } from '../types'

interface NavTabsProps {
  active: TabId
  onChange: (tab: TabId) => void
}

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: '⌂' },
  { id: 'metrics', label: 'Metrics', icon: '◫' },
  { id: 'containers', label: 'Containers', icon: '⬡' },
  { id: 'logs', label: 'Logs', icon: '›_' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
]

export function NavTabs({ active, onChange }: NavTabsProps) {
  return (
    <nav className="nav">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={`nav__tab${active === tab.id ? ' nav__tab--active' : ''}`}
          onClick={() => onChange(tab.id)}
          type="button"
        >
          <span className="nav__icon">{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}

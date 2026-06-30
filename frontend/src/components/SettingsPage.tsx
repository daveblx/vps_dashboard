import { useSettings } from '../context/SettingsContext'

export function SettingsPage() {
  const { settings, presets, updateSettings } = useSettings()

  return (
    <div className="settings-page">
      <section className="settings-section">
        <h2 className="settings-section__title">Theme</h2>
        <div className="theme-grid">
          {presets.map((preset) => (
            <button
              key={preset.id}
              className={`theme-card${settings.theme === preset.id && !settings.customColors ? ' theme-card--active' : ''}`}
              onClick={() => updateSettings({ theme: preset.id, customColors: null })}
              type="button"
            >
              <div className="theme-card__swatches">
                <span className="theme-swatch" style={{ background: preset.colors.bg }} />
                <span className="theme-swatch" style={{ background: preset.colors.accent }} />
                <span className="theme-swatch" style={{ background: preset.colors.text }} />
                <span className="theme-swatch" style={{ background: preset.colors.surface }} />
              </div>
              <span className="theme-card__name">{preset.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">Custom Colors</h2>
        <p className="settings-section__hint">
          Override any color. Clear all fields to revert to preset.
        </p>
        <div className="color-fields">
          {([
            ['bg', 'Background'],
            ['surface', 'Surface'],
            ['border', 'Border'],
            ['text', 'Text'],
            ['textDim', 'Dim Text'],
            ['accent', 'Accent'],
            ['ok', 'OK / Green'],
            ['warn', 'Warning'],
            ['danger', 'Danger'],
            ['muted', 'Muted'],
          ] as const).map(([key, label]) => {
            const currentColors = settings.customColors ?? presets.find((p) => p.id === settings.theme)?.colors ?? presets[0].colors
            return (
              <label key={key} className="color-field">
                <span className="color-field__label">{label}</span>
                <div className="color-field__inputs">
                  <input
                    type="color"
                    className="color-field__picker"
                    value={currentColors[key]}
                    onChange={(e) => {
                      const next = { ...(settings.customColors ?? currentColors), [key]: e.target.value }
                      updateSettings({ customColors: next })
                    }}
                  />
                  <input
                    type="text"
                    className="color-field__hex"
                    value={currentColors[key]}
                    onChange={(e) => {
                      const val = e.target.value
                      if (/^#[0-9a-fA-F]{0,6}$/.test(val)) {
                        const next = { ...(settings.customColors ?? currentColors), [key]: val.length === 7 ? val : currentColors[key] }
                        updateSettings({ customColors: next })
                      }
                    }}
                    maxLength={7}
                  />
                </div>
              </label>
            )
          })}
        </div>
        {settings.customColors && (
          <button
            className="settings-btn settings-btn--danger"
            onClick={() => updateSettings({ customColors: null })}
            type="button"
          >
            Reset Custom Colors
          </button>
        )}
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">Polling</h2>
        <label className="settings-row">
          <span className="settings-row__label">Container refresh interval</span>
          <select
            className="settings-select"
            value={settings.pollIntervalMs}
            onChange={(e) => updateSettings({ pollIntervalMs: Number(e.target.value) })}
          >
            <option value={5000}>5 seconds</option>
            <option value={10000}>10 seconds</option>
            <option value={30000}>30 seconds</option>
            <option value={60000}>60 seconds</option>
          </select>
        </label>
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">Home Widgets</h2>
        <p className="settings-section__hint">Toggle widgets shown on the Home tab.</p>
        <div className="widget-toggles">
          {([
            ['metrics-summary', 'Metrics Summary'],
            ['containers-summary', 'Containers Summary'],
            ['crosswatch', 'Crosswatch Films'],
          ] as const).map(([id, label]) => (
            <label key={id} className="widget-toggle">
              <input
                type="checkbox"
                checked={settings.homeWidgets.includes(id)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...settings.homeWidgets, id]
                    : settings.homeWidgets.filter((w) => w !== id)
                  updateSettings({ homeWidgets: next })
                }}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">Crosswatch APIs</h2>
        <p className="settings-section__hint">
          <strong>Trakt</strong> provides your watchlist & watched history.{' '}
          <strong>TMDB</strong> provides movie metadata & posters.
        </p>

        <label className="settings-row" style={{ marginBottom: 6 }}>
          <span className="settings-row__label">Trakt Client ID</span>
        </label>
        <input
          type="password"
          className="settings-input"
          placeholder="Trakt API Client ID"
          value={settings.traktClientId}
          onChange={(e) => updateSettings({ traktClientId: e.target.value })}
        />

        <label className="settings-row" style={{ marginTop: 6, marginBottom: 6 }}>
          <span className="settings-row__label">Trakt Username</span>
        </label>
        <input
          type="text"
          className="settings-input"
          placeholder="Your Trakt username"
          value={settings.traktUsername}
          onChange={(e) => updateSettings({ traktUsername: e.target.value })}
        />

        <label className="settings-row" style={{ marginTop: 6, marginBottom: 6 }}>
          <span className="settings-row__label">TMDB API Key</span>
        </label>
        <input
          type="password"
          className="settings-input"
          placeholder="TMDB API key (for posters & metadata)"
          value={settings.tmdbApiKey}
          onChange={(e) => updateSettings({ tmdbApiKey: e.target.value })}
        />
        <p className="settings-section__hint">
          <a href="https://trakt.tv/oauth/applications" target="_blank" rel="noopener noreferrer" className="link">Get Trakt Client ID</a>
          {' · '}
          <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer" className="link">Get TMDB API key</a>
        </p>
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">Data</h2>
        <button
          className="settings-btn settings-btn--danger"
          onClick={() => {
            localStorage.removeItem('vps-dashboard-settings')
            window.location.reload()
          }}
          type="button"
        >
          Reset All Settings
        </button>
      </section>
    </div>
  )
}

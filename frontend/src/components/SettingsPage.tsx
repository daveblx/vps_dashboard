import { useState } from 'react'
import { useSettings } from '../context/SettingsContext'
import { useTraktAuth } from '../hooks/useTraktAuth'
import { useTraktConfig } from '../hooks/useTraktConfig'
import { WIDGET_DEFS } from '../widgets'

export function SettingsPage() {
  const { settings, presets, updateSettings } = useSettings()
  const { auth, login, logout } = useTraktAuth()
  const { config: traktConfig, save: saveTraktConfig } = useTraktConfig()

  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [savingTrakt, setSavingTrakt] = useState(false)
  const [traktSaved, setTraktSaved] = useState(false)

  // Sync the editable client id from backend config once loaded.
  const effectiveClientId = clientId || traktConfig?.clientId || ''

  const handleSaveTrakt = async () => {
    setSavingTrakt(true)
    setTraktSaved(false)
    const ok = await saveTraktConfig(
      effectiveClientId,
      clientSecret,
      traktConfig?.redirectUri ?? '',
    )
    setSavingTrakt(false)
    if (ok) {
      setTraktSaved(true)
      setClientSecret('')
      setTimeout(() => setTraktSaved(false), 2500)
    }
  }

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
        <p className="settings-section__hint">
          Toggle widgets here, or tap <strong>Edit</strong> on the Home tab to
          drag, reorder and resize them.
        </p>
        <div className="widget-toggles">
          {WIDGET_DEFS.map((def) => {
            const enabled = settings.homeLayout.some((w) => w.id === def.id)
            return (
              <label key={def.id} className="widget-toggle">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...settings.homeLayout, { id: def.id, span: def.defaultSpan }]
                      : settings.homeLayout.filter((w) => w.id !== def.id)
                    updateSettings({ homeLayout: next })
                  }}
                />
                <span>{def.label}</span>
              </label>
            )
          })}
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">Trakt Connection</h2>

        {!auth.connected && (
          <div className="trakt-config">
            <p className="settings-section__hint">
              Create a Trakt API app, then paste its Client ID and Secret here.{' '}
              <a
                href="https://trakt.tv/oauth/applications/new"
                target="_blank"
                rel="noopener noreferrer"
                className="link"
              >
                Create Trakt app
              </a>
            </p>

            {traktConfig?.redirectUri && (
              <label className="settings-row settings-row--stacked">
                <span className="settings-row__label">
                  Redirect URI (add this to your Trakt app)
                </span>
                <input
                  type="text"
                  className="settings-input"
                  value={traktConfig.redirectUri}
                  readOnly
                  onFocus={(e) => e.currentTarget.select()}
                />
              </label>
            )}

            <label className="settings-row settings-row--stacked">
              <span className="settings-row__label">Client ID</span>
              <input
                type="text"
                className="settings-input"
                placeholder="Trakt Client ID"
                value={effectiveClientId}
                onChange={(e) => setClientId(e.target.value)}
              />
            </label>

            <label className="settings-row settings-row--stacked">
              <span className="settings-row__label">
                Client Secret{traktConfig?.hasSecret ? ' (saved — leave blank to keep)' : ''}
              </span>
              <input
                type="password"
                className="settings-input"
                placeholder={traktConfig?.hasSecret ? '••••••••' : 'Trakt Client Secret'}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
              />
            </label>

            <div className="trakt-config__actions">
              <button
                className="settings-btn"
                onClick={handleSaveTrakt}
                disabled={savingTrakt || !effectiveClientId}
                type="button"
              >
                {savingTrakt ? 'Saving…' : traktSaved ? 'Saved ✓' : 'Save Trakt App'}
              </button>
              <button
                className="trakt-connect-btn"
                onClick={login}
                disabled={!traktConfig?.configured}
                type="button"
                title={traktConfig?.configured ? '' : 'Save your Client ID & Secret first'}
              >
                Connect Trakt
              </button>
            </div>
          </div>
        )}

        {auth.connected && (
          <div className="trakt-settings-connected">
            <span className="trakt-settings-status">
              Connected as <strong>{auth.username}</strong>
            </span>
            <button
              className="settings-btn settings-btn--danger"
              onClick={logout}
              type="button"
            >
              Disconnect Trakt
            </button>
          </div>
        )}
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">TMDB API Key</h2>
        <p className="settings-section__hint">
          Used for movie posters & metadata in the Crosswatch widget.{' '}
          <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer" className="link">
            Get TMDB API key
          </a>
        </p>
        <input
          type="password"
          className="settings-input"
          placeholder="TMDB API key (for posters & metadata)"
          value={settings.tmdbApiKey}
          onChange={(e) => updateSettings({ tmdbApiKey: e.target.value })}
        />
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

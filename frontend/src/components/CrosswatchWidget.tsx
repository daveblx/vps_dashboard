import { useSettings } from '../context/SettingsContext'
import { useCrosswatch } from '../hooks/useCrosswatch'

function runtimeStr(min: number): string {
  if (min <= 0) return ''
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function CrosswatchWidget() {
  const { settings } = useSettings()
  const {
    movies,
    loading,
    traktError,
    tmdbError,
    hasTrakt,
    hasTmdb,
    view,
    setView,
    watchlistCount,
    watchedCount,
    posterUrl,
  } = useCrosswatch(
    settings.traktClientId,
    settings.traktUsername,
    settings.tmdbApiKey,
  )

  return (
    <div className="widget widget--crosswatch">
      <div className="widget__header">
        <span className="widget__title">Crosswatch</span>
        {hasTrakt && !loading && (
          <div className="crosswatch-tabs">
            <button
              className={`crosswatch-tab${view === 'watchlist' ? ' crosswatch-tab--active' : ''}`}
              onClick={() => setView('watchlist')}
              type="button"
            >
              Watchlist{watchlistCount > 0 ? ` (${watchlistCount})` : ''}
            </button>
            <button
              className={`crosswatch-tab${view === 'watched' ? ' crosswatch-tab--active' : ''}`}
              onClick={() => setView('watched')}
              type="button"
            >
              Watched{watchedCount > 0 ? ` (${watchedCount})` : ''}
            </button>
          </div>
        )}
      </div>

      {!hasTrakt && (
        <div className="widget__empty">
          <span className="widget__empty-icon">🎬</span>
          <span>
            Configure <strong>Trakt</strong> (Client ID + Username) in Settings
            to sync your watchlist & watched history.{' '}
            {!hasTmdb && (
              <>
                Add a <strong>TMDB</strong> API key for posters & metadata.
              </>
            )}
          </span>
        </div>
      )}

      {(traktError || tmdbError) && (
        <div className="error-banner">{traktError ?? tmdbError}</div>
      )}

      {hasTrakt && loading && (
        <div className="crosswatch-skeleton">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 80 }} />
          ))}
        </div>
      )}

      {hasTrakt && !loading && movies.length === 0 && !traktError && (
        <div className="widget__empty">
          <span>{view === 'watchlist' ? 'No movies on watchlist' : 'No watched movies yet'}</span>
        </div>
      )}

      {hasTrakt && !loading && movies.length > 0 && (
        <div className="crosswatch-list">
          {movies.map((movie) => (
            <div
              key={movie.tmdbId || movie.title}
              className={`crosswatch-item${movie.watched ? ' crosswatch-item--watched' : ''}`}
            >
              <div className="crosswatch-item__poster">
                {movie.posterPath ? (
                  <img
                    src={posterUrl(movie.posterPath)!}
                    alt={movie.title}
                    loading="lazy"
                  />
                ) : (
                  <span className="crosswatch-item__no-poster">?</span>
                )}
              </div>
              <div className="crosswatch-item__info">
                <span className="crosswatch-item__title">{movie.title}</span>
                <span className="crosswatch-item__meta">
                  {movie.year > 0 ? movie.year : ''}
                  {movie.voteAverage > 0 && ` · ★ ${movie.voteAverage.toFixed(1)}`}
                  {movie.genres.length > 0 && ` · ${movie.genres.slice(0, 2).join(', ')}`}
                  {movie.runtime > 0 && ` · ${runtimeStr(movie.runtime)}`}
                </span>
                {movie.watched && movie.watchedAt && (
                  <span className="crosswatch-item__watched">
                    Watched {formatDate(movie.watchedAt)}
                    {movie.plays > 1 && ` · ${movie.plays}x`}
                  </span>
                )}
              </div>
              {movie.watched && (
                <span className="crosswatch-item__check">✓</span>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && (
        <div className="crosswatch-apis-used">
          {hasTrakt && <span>Trakt</span>}
          {hasTrakt && hasTmdb && <span>+</span>}
          {hasTmdb && <span>TMDB</span>}
        </div>
      )}
    </div>
  )
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 30) return `${diffDays}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

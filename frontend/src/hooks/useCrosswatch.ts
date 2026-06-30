import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CrosswatchMovie, TMDBMovieDetail } from '../types'
import { useTraktAuth } from './useTraktAuth'

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w185'

async function fetchTMDBDetail(
  tmdbId: number,
  apiKey: string,
): Promise<TMDBMovieDetail> {
  const res = await fetch(
    `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${apiKey}`,
  )
  if (!res.ok) throw new Error(`TMDB: HTTP ${res.status}`)
  const data = await res.json()
  return {
    tmdbId: data.id as number,
    title: data.title as string,
    posterPath: data.poster_path as string | null,
    backdropPath: data.backdrop_path as string | null,
    releaseDate: (data.release_date as string) ?? '',
    voteAverage: (data.vote_average as number) ?? 0,
    overview: (data.overview as string) ?? '',
    runtime: (data.runtime as number) ?? 0,
    genres: ((data.genres as Array<{ name: string }>) ?? []).map((g) => g.name),
    tagline: (data.tagline as string) ?? '',
  }
}

interface BackendTraktMovie {
  movie: {
    title: string
    year: number
    ids: {
      trakt: number
      slug: string
      tmdb: number
      imdb: string
    }
  }
}

interface BackendTraktWatchedMovie {
  plays: number
  last_watched_at: string
  movie: BackendTraktMovie['movie']
}

export function useCrosswatch(tmdbApiKey: string) {
  const { auth } = useTraktAuth()
  const [watchlistMovies, setWatchlistMovies] = useState<BackendTraktMovie[]>([])
  const [watchedMovies, setWatchedMovies] = useState<BackendTraktWatchedMovie[]>([])
  const [tmdbCache, setTmdbCache] = useState<Record<number, TMDBMovieDetail>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'watchlist' | 'watched'>('watchlist')
  const tmdbEnriching = useRef(false)

  const hasTrakt = auth.connected
  const hasTmdb = Boolean(tmdbApiKey)

  const fetchTraktData = useCallback(async () => {
    if (!hasTrakt) return
    setLoading(true)
    setError(null)
    try {
      const [wlRes, watchedRes] = await Promise.all([
        fetch('/api/trakt/watchlist'),
        fetch('/api/trakt/watched'),
      ])
      if (!wlRes.ok || !watchedRes.ok) {
        if (wlRes.status === 401 || watchedRes.status === 401) {
          setError('Trakt session expired. Reconnect in Settings.')
          return
        }
        throw new Error('Failed to fetch Trakt data')
      }
      const wl = await wlRes.json()
      const watched = await watchedRes.json()
      setWatchlistMovies(wl)
      setWatchedMovies(watched)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Trakt fetch failed')
    } finally {
      setLoading(false)
    }
  }, [hasTrakt])

  useEffect(() => {
    fetchTraktData()
  }, [fetchTraktData])

  const allTraktMovies = useMemo(() => {
    const all = [
      ...watchlistMovies.map((e) => e.movie),
      ...watchedMovies.map((e) => e.movie),
    ]
    const seen = new Set<number>()
    return all.filter((m) => {
      const id = m.ids.tmdb
      if (!id || seen.has(id)) return false
      seen.add(id)
      return true
    })
  }, [watchlistMovies, watchedMovies])

  useEffect(() => {
    if (!hasTmdb || loading || tmdbEnriching.current || allTraktMovies.length === 0) return

    tmdbEnriching.current = true

    const uncached = allTraktMovies.filter((m) => m.ids.tmdb && !tmdbCache[m.ids.tmdb])
    if (uncached.length === 0) {
      tmdbEnriching.current = false
      return
    }

    let cancelled = false
    const enrich = async () => {
      const batch = uncached.slice(0, 10)
      const results: Record<number, TMDBMovieDetail> = {}
      for (const m of batch) {
        if (cancelled) break
        try {
          results[m.ids.tmdb] = await fetchTMDBDetail(m.ids.tmdb, tmdbApiKey)
        } catch {
          /* skip individual failures */
        }
      }
      if (!cancelled) {
        setTmdbCache((prev) => ({ ...prev, ...results }))
      }
      tmdbEnriching.current = false
    }
    enrich()

    return () => {
      cancelled = true
    }
  }, [hasTmdb, loading, allTraktMovies, tmdbApiKey, tmdbCache])

  const watchedTmbdIds = useMemo(
    () => new Set(watchedMovies.map((w) => w.movie.ids.tmdb).filter(Boolean)),
    [watchedMovies],
  )

  const watchedAtMap = useMemo(() => {
    const map: Record<number, { at: string; plays: number }> = {}
    for (const w of watchedMovies) {
      if (w.movie.ids.tmdb) {
        map[w.movie.ids.tmdb] = {
          at: w.last_watched_at,
          plays: w.plays,
        }
      }
    }
    return map
  }, [watchedMovies])

  const movies: CrosswatchMovie[] = useMemo(() => {
    const movieList =
      view === 'watchlist'
        ? watchlistMovies.map((e) => e.movie)
        : watchedMovies.map((e) => e.movie)
    const unique = new Map<number, BackendTraktMovie['movie']>()
    for (const m of movieList) {
      if (m.ids.tmdb && !unique.has(m.ids.tmdb)) {
        unique.set(m.ids.tmdb, m)
      }
    }

    return Array.from(unique.values()).map((traktMovie) => {
      const tmdbId = traktMovie.ids.tmdb
      const detail = tmdbId ? tmdbCache[tmdbId] : undefined
      const watchedInfo = tmdbId ? watchedAtMap[tmdbId] : undefined

      return {
        tmdbId: tmdbId ?? 0,
        title: detail?.title ?? traktMovie.title,
        year: detail?.releaseDate ? Number(detail.releaseDate.slice(0, 4)) : traktMovie.year,
        posterPath: detail?.posterPath ?? null,
        voteAverage: detail?.voteAverage ?? 0,
        runtime: detail?.runtime ?? 0,
        genres: detail?.genres ?? [],
        watched: tmdbId ? watchedTmbdIds.has(tmdbId) : false,
        watchedAt: watchedInfo?.at ?? null,
        plays: watchedInfo?.plays ?? 0,
      }
    })
  }, [view, watchlistMovies, watchedMovies, tmdbCache, watchedTmbdIds, watchedAtMap])

  return {
    movies,
    loading,
    error,
    hasTrakt,
    hasTmdb,
    view,
    setView,
    watchlistCount: watchlistMovies.length,
    watchedCount: watchedMovies.length,
    posterUrl: (path: string | null) =>
      path ? `${TMDB_IMAGE_BASE}${path}` : null,
  }
}

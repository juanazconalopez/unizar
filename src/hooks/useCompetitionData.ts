import type { SessionQueryCache } from '../services/sessionQueryCache'
import { navigationResourceKeys } from '../services/navigationResources'
import { useCallback, useEffect, useRef, useState } from 'react'
import { errorText } from '../lib/errors'
import { fetchCompetitionSeasonData, fetchCompetitionSeasons, syncCompetition } from '../services/competitionService'
import type { CompetitionFixture, CompetitionPlayerStat, CompetitionSeason, CompetitionStanding } from '../types'

const AUTO_SYNC_AGE_MS = 12 * 60 * 60 * 1000

export function useCompetitionData(enabled: boolean, isOwner: boolean, resources?: SessionQueryCache) {
  const [seasons, setSeasons] = useState<CompetitionSeason[]>([])
  const [fixtures, setFixtures] = useState<CompetitionFixture[]>([])
  const [standings, setStandings] = useState<CompetitionStanding[]>([])
  const [playerStats, setPlayerStats] = useState<CompetitionPlayerStat[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const loadedSeasons = useRef(new Set<string>())
  const autoSyncAttempted = useRef(false)
  const lastLoaded = useRef(0)
  const seasonsRef = useRef<CompetitionSeason[]>([])
  const pendingReload = useRef<Promise<CompetitionSeason[]> | null>(null)

  const loadSeason = useCallback(async (seasonId: string, force = false) => {
    if (!seasonId || (!force && loadedSeasons.current.has(seasonId))) return
    setLoading(true)
    setErrorMessage('')
    try {
      const data = await (resources ? resources.load(navigationResourceKeys.competitionSeason(seasonId), () => fetchCompetitionSeasonData(seasonId), { force }) : fetchCompetitionSeasonData(seasonId))
      setFixtures((current) => replaceSeason(current, data.fixtures, seasonId))
      setStandings((current) => replaceSeason(current, data.standings, seasonId))
      setPlayerStats((current) => replaceSeason(current, data.playerStats, seasonId))
      loadedSeasons.current.add(seasonId)
    } catch (error) {
      setErrorMessage(errorText(error))
      throw error
    } finally {
      setLoading(false)
    }
  }, [resources])

  const reload = useCallback((force = false): Promise<CompetitionSeason[]> => {
    if (!enabled) return Promise.resolve([])
    if (pendingReload.current) return pendingReload.current
    if (!force && lastLoaded.current && Date.now() - lastLoaded.current < 60_000) return Promise.resolve(seasonsRef.current)
    const request = (async () => {
      setLoading(true)
      setErrorMessage('')
      try {
        const nextSeasons = await (resources ? resources.load(navigationResourceKeys.competitionSeasons, fetchCompetitionSeasons, { force }) : fetchCompetitionSeasons())
        setSeasons(nextSeasons)
        seasonsRef.current = nextSeasons
        if (nextSeasons[0]) await loadSeason(nextSeasons[0].id, force)
        lastLoaded.current = Date.now()
        return nextSeasons
      } catch (error) {
        setErrorMessage(errorText(error))
        return [] as CompetitionSeason[]
      } finally {
        setLoading(false)
      }
    })()
    pendingReload.current = request
    void request.finally(() => { if (pendingReload.current === request) pendingReload.current = null })
    return request
  }, [enabled, loadSeason, resources])

  const synchronize = useCallback(async () => {
    if (!isOwner) return
    setSyncing(true)
    setErrorMessage('')
    try {
      await syncCompetition()
      await pendingReload.current
      loadedSeasons.current.clear()
      await reload(true)
    } catch (error) {
      setErrorMessage(errorText(error))
      throw error
    } finally {
      setSyncing(false)
    }
  }, [isOwner, reload])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void reload().then((nextSeasons) => {
        if (cancelled || !isOwner || autoSyncAttempted.current) return
        autoSyncAttempted.current = true
        const lastUpdate = nextSeasons[0]?.updatedAt ? Date.parse(nextSeasons[0].updatedAt) : 0
        if (!lastUpdate || Date.now() - lastUpdate >= AUTO_SYNC_AGE_MS) {
          void synchronize().catch(() => undefined)
        }
      })
    }, 0)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [enabled, isOwner, reload, synchronize])

  return { seasons, fixtures, standings, playerStats, loading, syncing, errorMessage, loadSeason, synchronize }
}

function replaceSeason<T extends { competitionSeasonId: string }>(current: T[], incoming: T[], seasonId: string) {
  return [...current.filter((item) => item.competitionSeasonId !== seasonId), ...incoming]
}

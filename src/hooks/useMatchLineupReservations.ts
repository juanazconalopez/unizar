import { useEffect, useMemo, useState } from 'react'
import { errorText } from '../lib/errors'
import type { MatchLineupReservation } from '../lib/matchParticipation'
import { fetchMatchLineupReservations } from '../services/derbyReservationsService'

/** Sin dorsales ni borradores completos de otros equipos. */
export function useMatchLineupReservations(matchId: string, enabled: boolean) {
  const request = useMemo(() => ({ matchId, enabled }), [matchId, enabled])
  const [loaded, setLoaded] = useState<{ request: typeof request; reservations?: MatchLineupReservation[]; error?: string } | null>(null)
  useEffect(() => {
    if (!enabled) return
    let active = true
    void fetchMatchLineupReservations(matchId).then((reservations) => {
      if (active) setLoaded({ request, reservations })
    }).catch((error) => {
      if (active) setLoaded({ request, error: errorText(error) })
    })
    return () => { active = false }
  }, [enabled, matchId, request])
  if (!enabled) return { reservations: [], loading: false, error: undefined }
  const result = loaded?.request === request ? loaded : null
  return { reservations: result?.reservations ?? [], loading: !result, error: result?.error }
}

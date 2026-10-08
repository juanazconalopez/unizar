import { useEffect, useState } from 'react'
import { errorText } from '../lib/errors'
import { fetchDerbyReservedPlayers } from '../services/derbyReservationsService'

/** Consulta únicamente reservas: un entrenador no puede leer el borrador del otro equipo. */
export function useDerbyReservedPlayers(matchId: string, enabled: boolean) {
  const [loaded, setLoaded] = useState<{ matchId: string; playerIds?: string[]; error?: string } | null>(null)
  useEffect(() => {
    if (!enabled) return
    let active = true
    void fetchDerbyReservedPlayers(matchId).then((playerIds) => {
      if (active) setLoaded({ matchId, playerIds })
    }).catch((error) => {
      if (active) setLoaded({ matchId, error: errorText(error) })
    })
    return () => { active = false }
  }, [enabled, matchId])
  if (!enabled) return { playerIds: [], loading: false, error: undefined }
  const result = loaded?.matchId === matchId ? loaded : null
  return { playerIds: result?.playerIds ?? [], loading: !result, error: result?.error }
}

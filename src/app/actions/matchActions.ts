import { createMatch, deleteMatch, saveMatchAvailability, saveMatchLineup, setPlayerMatchAvailability, unlockMatchLineup, updateMatch } from '../../services/matchesService'
import type { AvailabilityStatus, Match, MatchLineup, MatchValues } from '../../types'
import type { ActionContext } from './actionContext'

export function createMatchActions(context: ActionContext) {
  return {
    save: async (match: Match | undefined, values: MatchValues) => {
      context.requireConnection()
      if (!context.userId) return
      if (match) await updateMatch(match.id, values)
      else await createMatch(values, context.userId)
      context.notify(match ? 'Partido actualizado.' : 'Partido creado.')
      await context.reloadData()
    },
    delete: async (match: Match) => {
      context.requireConnection()
      await deleteMatch(match.id)
      context.notify('Partido eliminado.')
      await context.reloadData()
    },
    saveAvailability: async (match: Match, status: AvailabilityStatus, comment: string) => {
      context.requireConnection()
      if (!context.userId) return
      await saveMatchAvailability(match.id, context.userId, status, comment)
      context.notify('Disponibilidad guardada.')
      await context.reloadData()
    },
    savePlayerAvailability: async (match: Match, playerId: string, status: AvailabilityStatus, comment: string) => {
      context.requireConnection()
      await setPlayerMatchAvailability(match.id, playerId, status, comment)
      context.notify('Disponibilidad de la jugadora actualizada.')
      await context.reloadData()
    },
    saveLineup: async (match: Match, entries: Omit<MatchLineup, 'match_id' | 'updated_at'>[], published: boolean) => {
      context.requireConnection()
      await saveMatchLineup(match, entries, published)
      context.notify(published ? 'Convocatoria publicada.' : 'Convocatoria guardada.')
      await context.reloadData()
    },
    unlockLineup: async (match: Match) => {
      context.requireConnection()
      await unlockMatchLineup(match.id)
      context.notify('Convocatoria desbloqueada. Recuerda volver a publicarla cuando termines.')
      await context.reloadData()
    },
  }
}

export type MatchActions = ReturnType<typeof createMatchActions>

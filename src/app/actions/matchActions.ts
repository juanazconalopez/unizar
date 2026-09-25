import { saveMatchReport, type SavedReportEvent } from '../../services/matchReportService'
import { createMatch, deleteInternalMatch, deleteMatch, finalizeInternalMatch, saveMatchAvailability, saveMatchLineup, setPlayerMatchAvailability, unlockMatchLineup, updateInternalMatch, updateMatch } from '../../services/matchesService'
import type { AvailabilityStatus, Match, MatchLineup, MatchValues } from '../../types'
import type { ActionContext } from './actionContext'

export function createMatchActions(context: ActionContext) {
  return {
    save: async (match: Match | undefined, values: MatchValues) => {
      context.requireConnection()
      if (!context.userId) return
      if (match?.internal_fixture_id) await updateInternalMatch(match.id, values)
      else if (match) await updateMatch(match.id, values)
      else await createMatch(values, context.userId)
      context.invalidateMatchMonths(match?.match_date ?? values.matchDate, values.matchDate)
      context.notify(match ? 'Partido actualizado.' : 'Partido creado.')
      await context.reloadData()
    },
    delete: async (match: Match) => {
      context.requireConnection()
      if (match.internal_fixture_id) await deleteInternalMatch(match.id)
      else await deleteMatch(match.id)
      context.invalidateMatchMonths(match.match_date)
      context.notify('Partido eliminado.')
      await context.reloadData()
    },
    saveAvailability: async (match: Match, status: AvailabilityStatus, comment: string) => {
      context.requireConnection()
      if (!context.userId) return
      await saveMatchAvailability(match.id, context.userId, status, comment)
      context.invalidateMatchMonths(match.match_date)
      context.notify('Disponibilidad guardada.')
      await context.reloadData()
    },
    savePlayerAvailability: async (match: Match, playerId: string, status: AvailabilityStatus, comment: string) => {
      context.requireConnection()
      await setPlayerMatchAvailability(match.id, playerId, status, comment)
      context.invalidateMatchMonths(match.match_date)
      context.notify('Disponibilidad de la jugadora actualizada.')
      await context.reloadData()
    },
    saveLineup: async (match: Match, entries: Omit<MatchLineup, 'match_id' | 'updated_at'>[], published: boolean) => {
      context.requireConnection()
      await saveMatchLineup(match, entries, published)
      context.invalidateMatchMonths(match.match_date)
      context.notify(published ? 'Convocatoria publicada.' : 'Convocatoria guardada.')
      await context.reloadData()
    },
    saveReport: async (match: Match, file: File, scores: { team: number; opponent: number }, duration: number, events: SavedReportEvent[], reviewed: boolean) => {
      context.requireConnection()
      await saveMatchReport(match, file, scores, duration, events, reviewed)
      context.invalidateMatchMonths(match.match_date)
      context.notify('Acta guardada.')
      await context.reloadData()
    },
    finalizeInternal: async (match: Match) => {
      context.requireConnection()
      await finalizeInternalMatch(match.id)
      context.invalidateMatchMonths(match.match_date)
      context.notify('Las dos convocatorias están publicadas.')
      await context.reloadData()
    },
    unlockLineup: async (match: Match) => {
      context.requireConnection()
      await unlockMatchLineup(match.id)
      context.invalidateMatchMonths(match.match_date)
      context.notify('Convocatoria desbloqueada. Recuerda volver a publicarla cuando termines.')
      await context.reloadData()
    },
  }
}

export type MatchActions = ReturnType<typeof createMatchActions>

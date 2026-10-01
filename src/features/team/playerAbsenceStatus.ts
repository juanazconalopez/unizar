import type { PlayerAbsence } from '../../types'

export function getCurrentPlayerAbsence(absences: PlayerAbsence[], playerId: string, date: string): PlayerAbsence | undefined {
  return absences.find((absence) => absence.player_id === playerId
    && absence.starts_on <= date
    && (absence.ends_on === null || absence.ends_on >= date)
    && (absence.discharged_on === null || absence.discharged_on > date))
}

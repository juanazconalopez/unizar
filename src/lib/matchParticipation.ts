import { addDays } from './dates'

/** Viernes–domingo comparten una oportunidad; entre semana se conserva cada día. */
export function matchParticipationWindow(date: string): string {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay() || 7
  return weekday >= 5 ? addDays(date, 5 - weekday) : date
}

export type MatchLineupReservation = {
  player_id: string
  match_id: string
  team_name: string
  match_date: string
  is_derby: boolean
}

import type { Match, MatchLineup, PlayerLicenseType, Profile, SeasonPlayer } from '../types'
import { membershipCoversDate } from './selectors'

export const PLAYER_LICENSES: Array<{ value: PlayerLicenseType; label: string }> = [
  { value: 'none', label: 'Sin ficha' }, { value: 'training', label: 'Solo entrenamientos' },
  { value: 'regional', label: 'Regional' }, { value: 'national', label: 'Nacional' },
]
export function licenseLabel(type: PlayerLicenseType) {
  return PLAYER_LICENSES.find((item) => item.value === type)?.label ?? 'Sin ficha'
}
export function licenseAllowsTeam(type: PlayerLicenseType) { return type === 'regional' || type === 'national' }

// Los fixtures anteriores a la migración representan la plantilla regional existente.
// La RPC siempre devuelve un tipo explícito en producción, incluso «none».
export function membershipLicense(membership: SeasonPlayer): PlayerLicenseType { return membership.license_type ?? 'regional' }

export function matchLicenseRestriction(match: Match, memberships: SeasonPlayer[], playerId: string): string | null {
  const membership = memberships.find((item) => item.player_id === playerId && item.season_id === match.season_id && membershipCoversDate(item, match.match_date))
  if (!membership) return 'No está vinculada a la temporada en la fecha del partido.'
  // La ficha vigente no impide corregir una convocatoria de un partido finalizado.
  if (match.match_kind === 'friendly' || match.status === 'completed') return null
  const type = membershipLicense(membership)
  if (!licenseAllowsTeam(type)) return 'La ficha solo permite participar en amistosos.'
  const level = match.season_competitions?.competition_level ?? 'regional'
  if (level === 'national' && type !== 'national') return 'Este partido requiere ficha Nacional.'
  if (level === 'regional' && (membership.national_starts ?? 0) >= 6) return 'No puede jugar regional: acumula seis titularidades en liga nacional esta temporada.'
  return null
}

export function lineupLicenseWarnings(match: Match, lineup: MatchLineup[], memberships: SeasonPlayer[], profiles: Profile[]): string[] {
  if (match.status === 'completed' || match.status === 'cancelled') return []
  return lineup.filter((entry) => entry.match_id === match.id).flatMap((entry) => {
    const reason = matchLicenseRestriction(match, memberships, entry.player_id)
    return reason ? [`${profiles.find((person) => person.id === entry.player_id)?.display_name ?? 'Jugadora'}: ${reason}`] : []
  })
}

export function countNationalLeagueStarts(matches: Match[], lineups: MatchLineup[], seasonId: string, playerId: string): number {
  return matches.filter((match) => match.season_id === seasonId && match.match_kind === 'official'
    && match.status === 'completed' && match.report_events_reviewed
    && match.season_competitions?.competition_level === 'national' && match.season_competitions.is_league === true
    && lineups.some((entry) => entry.match_id === match.id && entry.player_id === playerId && entry.role === 'starter')).length
}

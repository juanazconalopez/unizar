import { addDays } from '../../lib/dates'
import { membershipLicense } from '../../lib/playerLicenses'
import { playerPlayingGroup } from '../../lib/playerPositions'
import { isActivePlayer, membershipCoversDate } from '../../lib/selectors'
import type { Profile, Season, SeasonPlayer, SeasonTeam } from '../../types'
import type { TrainingGroupAssignment, TrainingGroupBlock, TrainingGroupPlayer } from './types'

export function eligibleTrainingGroupPlayers(profiles: Profile[], memberships: SeasonPlayer[], teams: SeasonTeam[], season: Season, date: string): TrainingGroupPlayer[] {
  if (date < season.start_date || date > season.end_date) return []
  return profiles.filter(isActivePlayer).flatMap((profile) => {
    const membership = memberships.filter((item) => item.season_id === season.id && item.player_id === profile.id && membershipCoversDate(item, date))
      .sort((a, b) => b.active_from.localeCompare(a.active_from) || b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))[0]
    if (!membership) return []
    const license = membershipLicense(membership)
    if (license === 'none' || (license !== 'training' && !membership.season_team_id)) return []
    const team = license === 'training' ? undefined : teams.find((item) => item.id === membership.season_team_id && item.season_id === season.id)
    if (license !== 'training' && !team) return []
    return [{ player_id: profile.id, display_name: profile.display_name, team_id: team?.id ?? null, team_name: team?.name ?? 'Solo entrenamientos', position_group: playerPlayingGroup(profile) }]
  }).sort((a, b) => a.display_name.localeCompare(b.display_name, 'es'))
}

export const groupColorLabel = (color: TrainingGroupAssignment['color']) => color === 'red' ? 'ROJO' : 'BLANCO'
export const groupShirtLabel = (color: TrainingGroupAssignment['color']) => color === 'red' ? 'roja' : 'blanca'
export const trainingGroupBucket = (player: TrainingGroupPlayer) => JSON.stringify([player.team_id, player.position_group])

export function currentTrainingGroupBlock(blocks: TrainingGroupBlock[], today: string) {
  return blocks.filter((block) => block.status === 'published' && block.starts_on <= today)
    .sort((a, b) => b.starts_on.localeCompare(a.starts_on))[0]
}

export function trainingGroupBalance(players: TrainingGroupPlayer[], assignments: TrainingGroupAssignment[]) {
  const rows = new Map<string, { key: string; label: string; red: number; white: number }>()
  const colors = new Map(assignments.map((entry) => [entry.player_id, entry.color]))
  for (const player of players) {
    const key = trainingGroupBucket(player)
    const row = rows.get(key) ?? { key, label: `${player.team_name} · ${player.position_group === 'forwards' ? 'Delanteras' : player.position_group === 'backs' ? 'Línea' : 'Sin posición'}`, red: 0, white: 0 }
    const color = colors.get(player.player_id)
    if (color) row[color] += 1
    rows.set(key, row)
  }
  const values = [...rows.values()]
  const red = values.reduce((total, row) => total + row.red, 0)
  const white = values.reduce((total, row) => total + row.white, 0)
  return { rows: values, red, white, balanced: Math.abs(red - white) <= 1 && values.every((row) => Math.abs(row.red - row.white) <= 1) }
}

export function trainingGroupRenewal(block: TrainingGroupBlock, today: string) {
  const renewOn = addDays(block.starts_on, 21)
  const days = Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${block.starts_on}T12:00:00Z`)) / 86400000)
  return { renewOn, weeks: Math.max(0, Math.floor(days / 7)), overdue: today >= renewOn, soon: today >= addDays(renewOn, -7) }
}

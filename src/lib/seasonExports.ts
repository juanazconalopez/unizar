import { escapeXml } from './fileExport'
import { ageOnDate } from './dates'
import { isActivePlayer, membershipCoversDate } from './selectors'
import type { Profile, ProfilePrivateDetails, Season, SeasonCallupReport, SeasonPlayer } from '../types'

export function currentSeasonPlayers(
  profiles: Profile[],
  memberships: SeasonPlayer[],
  season: Season,
  date: string,
) {
  const memberIds = new Set(memberships
    .filter((membership) => membership.season_id === season.id && membershipCoversDate(membership, date))
    .map((membership) => membership.player_id))

  return profiles
    .filter((profile) => isActivePlayer(profile) && memberIds.has(profile.id))
    .sort((first, second) => first.display_name.localeCompare(second.display_name, 'es'))
}

export function activePlayersXml(season: Season, players: Profile[], generatedOn: string, privateDetails: ProfilePrivateDetails[] = []) {
  const detailsByPlayer = new Map(privateDetails.map((details) => [details.profile_id, details]))
  return `<?xml version="1.0" encoding="UTF-8"?>
<jugadoras-activas temporada="${escapeXml(season.name)}" fecha="${escapeXml(generatedOn)}" total="${players.length}">
${players.map((player) => {
    const details = detailsByPlayer.get(player.id)
    const age = ageOnDate(details?.birth_date, generatedOn)
    return `  <jugadora id="${escapeXml(player.id)}" nombre="${escapeXml(player.display_name)}" email="${escapeXml(details?.email)}" telefono="${escapeXml(details?.phone)}" edad="${escapeXml(age)}" fecha-nacimiento="${escapeXml(details?.birth_date)}" />`
  }).join('\n')}
</jugadoras-activas>`
}

export function attendanceReportXml(report: SeasonCallupReport, playerIds?: Set<string>) {
  const players = playerIds
    ? report.players.filter((player) => playerIds.has(player.playerId))
    : report.players

  return `<?xml version="1.0" encoding="UTF-8"?>
<asistencia-acumulada temporada="${escapeXml(report.seasonName)}" fecha="${escapeXml(report.generatedOn)}" entrenamientos="${report.totals.trainingSessions}" jugadoras="${players.length}">
${players.map((player) => `  <jugadora id="${escapeXml(player.playerId)}" nombre="${escapeXml(player.name)}" asistencias="${player.attendedSessions}" entrenamientos-computables="${player.eligibleSessions}" porcentaje="${player.attendancePercentage ?? ''}" />`).join('\n')}
</asistencia-acumulada>`
}

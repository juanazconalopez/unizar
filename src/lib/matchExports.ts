import { formatDate } from './dates'
import { escapeXml } from './fileExport'
import type { Match, MatchLineup, Profile, SeasonCallupReport } from '../types'

export function lineupXml(match: Match, entries: MatchLineup[], profiles: Profile[]) {
  const ordered = orderedLineup(entries)
  const playersById = new Map(profiles.map((profile) => [profile.id, profile.display_name]))
  return `<?xml version="1.0" encoding="UTF-8"?>
<convocatoria temporada="${escapeXml(match.seasons?.name)}" fecha="${escapeXml(match.match_date)}">
  <partido rival="${escapeXml(match.opponent)}" condicion="${match.is_home ? 'local' : 'visitante'}" tipo="${match.match_kind === 'official' ? 'oficial' : 'amistoso'}" formato="${match.rugby_format === 'sevens' ? 'seven' : 'xv'}" hora="${escapeXml(match.kickoff_time?.slice(0, 5))}" campo="${escapeXml(match.venue)}" />
  <jugadoras>
${ordered.map((entry) => `    <jugadora dorsal="${entry.slot_number}" nombre="${escapeXml(playersById.get(entry.player_id) ?? 'Jugadora')}" rol="${entry.role === 'starter' ? 'titular' : 'suplente'}" />`).join('\n')}
  </jugadoras>
</convocatoria>`
}

export function lineupPlainText(match: Match, entries: MatchLineup[], profiles: Profile[]) {
  const playersById = new Map(profiles.map((profile) => [profile.id, profile.display_name]))
  const type = match.match_kind === 'official' ? 'Oficial' : 'Amistoso'
  const format = match.rugby_format === 'sevens' ? 'Rugby Seven' : 'Rugby XV'
  const details = [formatDate(match.match_date), match.kickoff_time?.slice(0, 5), match.venue].filter(Boolean).join(' · ')
  const players = orderedLineup(entries).map((entry) => `${entry.slot_number}. ${playersById.get(entry.player_id) ?? 'Jugadora'}`)
  return [`CONVOCATORIA · ${type} · ${format}`, `Partido contra ${match.opponent}`, details, '', ...players].join('\n')
}

export function callupReportXml(report: SeasonCallupReport) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<resumen-convocatorias temporada="${escapeXml(report.seasonName)}" fecha="${escapeXml(report.generatedOn)}">
  <totales oficiales="${report.totals.officialMatches}" amistosos="${report.totals.friendlyMatches}" entrenamientos="${report.totals.trainingSessions}" />
  <jugadoras>
${report.players.map((player) => `    <jugadora nombre="${escapeXml(player.name)}" oficiales="${player.officialCallups}" amistosos="${player.friendlyCallups}" titular="${player.starterCallups}" suplente="${player.substituteCallups}" disponibilidades-respondidas="${player.availabilityResponded}" partidos-elegibles="${player.eligibleMatches}" porcentaje-disponibilidad="${player.availabilityPercentage ?? ''}" asistencias="${player.attendedSessions}" entrenamientos-computables="${player.eligibleSessions}" porcentaje-asistencia="${player.attendancePercentage ?? ''}" />`).join('\n')}
  </jugadoras>
</resumen-convocatorias>`
}

export function callupReportTsv(report: SeasonCallupReport) {
  const header = `Nombre\tOficiales (${report.totals.officialMatches})\tAmistosos (${report.totals.friendlyMatches})\tTitular\tSuplente\tDisponibilidad\tAsistencia (${report.totals.trainingSessions})`
  return [header, ...report.players.map((player) => [
    player.name,
    player.officialCallups,
    player.friendlyCallups,
    player.starterCallups,
    player.substituteCallups,
    `${player.availabilityResponded}/${player.eligibleMatches} (${player.availabilityPercentage === null ? '—' : `${player.availabilityPercentage}%`})`,
    `${player.attendedSessions} (${player.attendancePercentage === null ? '—' : `${player.attendancePercentage}%`})`,
  ].join('\t'))].join('\n')
}

function orderedLineup(entries: MatchLineup[]) {
  return [...entries].sort((first, second) => first.slot_number - second.slot_number)
}

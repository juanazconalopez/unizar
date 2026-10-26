import { addDays, mondayFor, todayIso } from '../src/lib/dates'
import type {
  AttendanceRecord,
  CompetitionFixture,
  CompetitionPlayerStat,
  CompetitionSeason,
  CompetitionStanding,
  Match,
  MatchAvailability,
  MatchLineup,
  Profile,
  ProfilePrivateDetails,
  PlayerAbsence,
  PlayerAbsencePrivateNote,
  ProvisionalAttendanceRecord,
  ProvisionalPlayer,
  Season,
  SeasonCompetition,
  SeasonPlayer,
  SeasonTeam,
  SeasonTeamCoach,
  TaskResult,
  TeamAnnouncement,
  TrainingSession,
  TrainingTask,
} from '../src/types'

export const competitionSeasons: CompetitionSeason[] = [
  { id: 'competition-2025-26', name: '2025–26', startsOn: '2025-09-01', sourceLabel: 'MatchReady · Federación Aragonesa de Rugby', updatedAt: '2026-04-11T18:00:00Z' },
]

export const competitionFixtures: CompetitionFixture[] = [
  competitionMatch('c1', 1, 'Jornada 1', '2025-10-18', '17:00', 'Unizar Femenino', 'Ingenieros de Soria', 46, 7),
  competitionMatch('c2', 1, 'Jornada 1', '2025-10-25', '13:30', 'Ibero C.R.', 'Fénix C.R.', 12, 41),
  competitionMatch('c3', 2, 'Jornada 2', '2025-12-20', '12:00', 'Ibero C.R.', 'Unizar Femenino', 5, 40),
  competitionMatch('c4', 2, 'Jornada 2', '2025-12-20', '14:30', 'Ingenieros de Soria', 'Fénix C.R.', 14, 83),
  competitionMatch('c5', 3, 'Jornada 3', '2025-11-22', '12:00', 'Fénix C.R.', 'Unizar Femenino', 10, 10),
  competitionMatch('c6', 3, 'Jornada 3', '2025-11-29', '17:30', 'Ibero C.R.', 'Ingenieros de Soria', 39, 0),
  competitionMatch('c7', 4, 'Jornada 4', '2026-01-10', '11:30', 'Ingenieros de Soria', 'Unizar Femenino', 0, 75),
  competitionMatch('c8', 4, 'Jornada 4', '2026-01-17', '18:30', 'Fénix C.R.', 'Ibero C.R.', 27, 5),
  competitionMatch('c9', 5, 'Jornada 5', '2026-01-31', '14:00', 'Fénix C.R.', 'Ingenieros de Soria', 73, 0),
  competitionMatch('c10', 5, 'Jornada 5', '2026-03-28', '12:00', 'Unizar Femenino', 'Ibero C.R.', 43, 0),
  competitionMatch('c11', 6, 'Jornada 6', '2026-02-21', '12:00', 'Ingenieros de Soria', 'Ibero C.R.', null, null, 'postponed'),
  competitionMatch('c12', 6, 'Jornada 6', '2026-02-21', '14:00', 'Unizar Femenino', 'Fénix C.R.', 34, 3),
  competitionMatch('c13', 7, 'Final', '2026-04-11', '14:00', 'Unizar Femenino', 'Fénix C.R.', 51, 0),
]

export const competitionStandings: CompetitionStanding[] = [
  standing(1, 'Unizar Femenino', 7, 6, 1, 0, 299, 25, 6, 0, 32),
  standing(2, 'Fénix C.R.', 7, 4, 1, 2, 237, 126, 4, 0, 22),
  standing(3, 'Ibero C.R.', 5, 1, 0, 4, 61, 151, 1, 0, 5),
  standing(4, 'Ingenieros de Soria', 5, 0, 0, 5, 21, 316, 0, 0, 0),
]

export const competitionPlayerStats: CompetitionPlayerStat[] = [
  playerStat('Ariadna Acirón Matute', 'Fénix C.R.', 51, 4, 14, 1, 0, 0, 0),
  playerStat('Marta Pamplona de Uña', 'Unizar Femenino', 47, 3, 13, 2, 0, 0, 0),
  playerStat('Irati Tejero', 'Unizar Femenino', 40, 8, 0, 0, 0, 0, 0),
  playerStat('Sofía Serrano Pascual', 'Unizar Femenino', 22, 4, 1, 0, 0, 0, 0),
  playerStat('Inés Jarauta Sanz', 'Unizar Femenino', 20, 4, 0, 0, 0, 0, 0),
  playerStat('Nuria Cabello López', 'Unizar Femenino', 20, 4, 0, 0, 0, 0, 0),
  playerStat('Carmen Pamplona de Uña', 'Unizar Femenino', 0, 0, 0, 0, 0, 1, 0),
  playerStat('Marta Pérez Corral', 'Ingenieros de Soria', 0, 0, 0, 0, 0, 1, 0),
  playerStat('Patricia Ferrando Lázaro', 'Ibero C.R.', 0, 0, 0, 0, 0, 1, 0),
  playerStat('Carmen García Zapico', 'Fénix C.R.', 0, 0, 0, 0, 0, 1, 0),
]

export const DEMO_USERS = {
  owner: 'demo-owner',
  coach: 'demo-coach',
  viewer: 'demo-viewer',
  player: 'demo-player',
} as const

const today = todayIso()
const currentWeek = mondayFor(today)
const now = new Date().toISOString()
const year = Number(today.slice(0, 4))

function competitionMatch(id: string, roundOrder: number, round: string, matchDate: string, kickoffTime: string, homeTeam: string, awayTeam: string, homeScore: number | null, awayScore: number | null, status: CompetitionFixture['status'] = 'final'): CompetitionFixture {
  return { id, competitionSeasonId: 'competition-2025-26', round, roundOrder, matchDate, kickoffTime, homeTeam, awayTeam, homeScore, awayScore, status }
}

function standing(position: number, team: string, played: number, won: number, drawn: number, lost: number, pointsFor: number, pointsAgainst: number, offensiveBonus: number, defensiveBonus: number, points: number): CompetitionStanding {
  return { competitionSeasonId: 'competition-2025-26', position, team, played, won, drawn, lost, pointsFor, pointsAgainst, difference: pointsFor - pointsAgainst, offensiveBonus, defensiveBonus, points }
}

function playerStat(player: string, team: string, points: number, tries: number, conversions: number, penalties: number, drops: number, yellowCards: number, redCards: number): CompetitionPlayerStat {
  return { competitionSeasonId: 'competition-2025-26', player, team, points, tries, conversions, penalties, drops, yellowCards, redCards }
}

export const initialProfiles: Profile[] = [
  profile(DEMO_USERS.owner, 'Lucía Martín', { is_owner: true, is_player: false }),
  profile(DEMO_USERS.coach, 'Andrea López', { is_coach: true, is_player: false }),
  profile(DEMO_USERS.viewer, 'Carlos Dirección', { is_viewer: true, is_player: false }),
  profile(DEMO_USERS.player, 'Marta Sánchez', { playing_positions: ['centre', 'wing'], primary_position: 'centre' }),
  profile('demo-player-2', 'Claudia Pérez', { avatar_path: 'demo-player-2/demo-avatar.jpg', playing_positions: ['prop', 'second_row'], primary_position: 'prop' }),
  profile('demo-player-3', 'Sara Jiménez', { playing_positions: ['hooker', 'back_row'], primary_position: 'hooker' }),
  profile('demo-player-complete', 'Laura Semana Completa'),
  profile('demo-inactive', 'Elena García', { is_active: false }),
  profile('demo-pending', 'Nerea Ruiz', { is_approved: false, is_active: false }),
  profile('demo-possible-duplicate', 'Marta Sánches', { is_approved: false, is_active: false }),
  profile('demo-archived', 'Paula Romero', { is_approved: false, is_active: false, is_archived: true }),
]

export const initialPlayerAbsences: PlayerAbsence[] = [{
  id: 'demo-absence-sara', player_id: 'demo-player-3', starts_on: addDays(today, -5), ends_on: addDays(today, 5), discharged_on: null,
  created_by: DEMO_USERS.owner, created_at: now, updated_at: now,
}]
export const initialPlayerAbsenceNotes: PlayerAbsencePrivateNote[] = [{
  absence_id: 'demo-absence-sara', note: 'Recuperación de rodilla.', updated_at: now, updated_by: DEMO_USERS.owner,
}]

export const initialProfilePrivateDetails: ProfilePrivateDetails[] = [
  privateDetails(DEMO_USERS.owner, 'owner@demo.local', '+34 600 100 100', '1988-02-14'),
  privateDetails(DEMO_USERS.coach, 'coach@demo.local', '+34 600 100 101', '1991-06-22'),
  privateDetails(DEMO_USERS.viewer, 'viewer@demo.local', '+34 600 100 102', '1985-11-08'),
  privateDetails(DEMO_USERS.player, 'player@demo.local', '+34 600 100 103', '1999-04-15'),
  privateDetails('demo-player-2', 'claudia@demo.local', '+34 600 100 104', `2000-${addDays(today, 1).slice(5)}`),
  privateDetails('demo-player-3', 'sara@demo.local', '', ''),
  privateDetails('demo-player-complete', 'laura@demo.local', '+34 600 100 106', '1998-12-19'),
  privateDetails('demo-inactive', 'elena@demo.local', '+34 600 100 107', '1997-07-10'),
  privateDetails('demo-pending', 'nerea@demo.local', '', ''),
  privateDetails('demo-possible-duplicate', 'marta.duplicada@demo.local', '', ''),
  privateDetails('demo-archived', 'paula@demo.local', '+34 600 100 110', '1996-03-27'),
]

export const initialSeasons: Season[] = [
  season('season-current', `Temporada ${year}/${year + 1}`, `${year}-01-01`, `${year}-12-31`),
  season('season-past', `Temporada ${year - 1}/${year}`, `${year - 1}-01-01`, `${year - 1}-12-31`),
  season('season-next', `Pretemporada ${year + 1}`, `${year + 1}-01-15`, `${year + 1}-03-31`),
]

export const initialSeasonTeams: SeasonTeam[] = [
  { id: 'demo-team-default', season_id: 'season-current', name: 'Unizar Femenino', color: 'purple', is_mixed: false, is_default: true, is_active: true, created_by: DEMO_USERS.owner, created_at: now, updated_at: now },
  { id: 'demo-team-development', season_id: 'season-current', name: 'Equipo de desarrollo', color: 'green', is_mixed: false, is_default: false, is_active: true, created_by: DEMO_USERS.owner, created_at: now, updated_at: now },
  { id: 'demo-team-past', season_id: 'season-past', name: 'Unizar Femenino', color: 'purple', is_mixed: false, is_default: true, is_active: true, created_by: DEMO_USERS.owner, created_at: now, updated_at: now },
  { id: 'demo-team-next', season_id: 'season-next', name: 'Unizar Femenino', color: 'purple', is_mixed: false, is_default: true, is_active: true, created_by: DEMO_USERS.owner, created_at: now, updated_at: now },
]

export const initialSeasonTeamCoaches: SeasonTeamCoach[] = initialSeasonTeams.map((team) => ({
  season_team_id: team.id, coach_id: DEMO_USERS.coach, role: 'head_coach', created_at: now,
}))

export const initialSeasonCompetitions: SeasonCompetition[] = [
  { id: 'season-competition-league', season_id: 'season-current', name: 'Liga Aragonesa', color: 'purple', is_default: true, match_count: 1, created_by: DEMO_USERS.owner, created_at: now, updated_at: now },
  { id: 'season-competition-cup', season_id: 'season-current', name: 'Copa Aragón', color: 'orange', is_default: false, match_count: 1, created_by: DEMO_USERS.owner, created_at: now, updated_at: now },
  { id: 'season-competition-past', season_id: 'season-past', name: 'Liga Aragonesa', color: 'purple', is_default: true, match_count: 0, created_by: DEMO_USERS.owner, created_at: now, updated_at: now },
]

const activeIds = initialProfiles
  .filter((item) => item.is_approved && item.is_active && !item.is_archived && item.is_player)
  .map((item) => item.id)

export const initialMemberships: SeasonPlayer[] = [
  ...activeIds.map((playerId) => ({
    id: `membership-current-${playerId}`,
    season_id: 'season-current',
    season_team_id: 'demo-team-default',
    player_id: playerId,
    created_at: now,
    active_from: `${year}-01-01`,
    active_until: null,
  })),
  ...activeIds.slice(0, 4).map((playerId) => ({
    id: `membership-past-${playerId}`,
    season_id: 'season-past',
    season_team_id: 'demo-team-past',
    player_id: playerId,
    created_at: now,
    active_from: `${year - 1}-01-01`,
    active_until: `${year - 1}-12-31`,
  })),
]

export const initialTasks: TrainingTask[] = [
  task('task-future-strength', 'Prevención de hombro y estabilidad', 'Gimnasio', addDays(currentWeek, 14), 'draft'),
  task('task-future-gameplan', 'Preparación en vídeo del próximo rival', 'Vídeo', addDays(currentWeek, 7), 'published'),
  task('task-future-speed', 'Aceleración y velocidad máxima', 'Físico', addDays(currentWeek, 7), 'draft'),
  task('task-speed', 'Velocidad y cambios de dirección', 'Físico', currentWeek, 'published'),
  task('task-strength', 'Fuerza de tren inferior', 'Gimnasio', currentWeek, 'published'),
  task('task-video', 'Ver partido · Nueva Zelanda contra Australia', 'Vídeo', currentWeek, 'published'),
  task('task-draft', 'Movilidad y recuperación', 'Recuperación', currentWeek, 'draft'),
  task('task-cancelled', 'Técnica de placaje', 'Técnico', addDays(currentWeek, -7), 'cancelled'),
  task('task-previous', 'Resistencia aeróbica', 'Físico', addDays(currentWeek, -7), 'published'),
]

export const initialAnnouncements: TeamAnnouncement[] = [
  { id: 'announcement-today', season_id: 'season-current', announcement_date: today, title: 'Cambio de acceso al campo', description: 'Hoy entraremos por la puerta lateral junto al vestuario visitante. Llegad con diez minutos de margen.', status: 'published', created_by: DEMO_USERS.coach, created_at: now, updated_at: now, seasons: { name: initialSeasons[0].name } },
  { id: 'announcement-future', season_id: 'season-current', announcement_date: addDays(today, 9), title: 'Foto oficial del equipo', description: 'Traed la equipación oficial completa. La foto se hará antes de comenzar el entrenamiento.', status: 'published', created_by: DEMO_USERS.owner, created_at: now, updated_at: now, seasons: { name: initialSeasons[0].name } },
  { id: 'announcement-draft', season_id: 'season-current', announcement_date: addDays(today, 16), title: 'Reunión de inicio de bloque', description: 'Borrador pendiente de confirmar la sala y la hora.', status: 'draft', created_by: DEMO_USERS.coach, created_at: now, updated_at: now, seasons: { name: initialSeasons[0].name } },
]

export const initialMatches: Match[] = [
  { id: 'match-report-demo', season_id: 'season-current', competition_id: 'season-competition-league', opponent: 'Ingenieros de Soria', match_date: addDays(today, -40), kickoff_time: '12:00:00', venue: 'CDM David Cañada', callup_time: null, callup_venue: null, is_home: true, notes: 'Partido de muestra para registrar resultado y minutos o importar un acta en el navegador.', status: 'published', match_kind: 'official', rugby_format: 'xv', lineup_published: true, created_by: DEMO_USERS.owner, created_at: now, updated_at: now, seasons: { name: initialSeasons[0].name }, season_competitions: { id: 'season-competition-league', name: 'Liga Aragonesa', color: 'purple', is_default: true } },
  { id: 'match-next', season_id: 'season-current', team_id: 'demo-team-default', competition_id: 'season-competition-league', opponent: 'Ingenieros Industriales', match_date: addDays(today, 7), kickoff_time: '12:00:00', venue: 'CDM David Cañada', callup_time: '10:45:00', callup_venue: 'Acceso principal del CDM', is_home: true, notes: 'Llegada 75 minutos antes del inicio.', status: 'published', match_kind: 'official', rugby_format: 'xv', lineup_published: true, created_by: DEMO_USERS.owner, created_at: now, updated_at: now, seasons: { name: initialSeasons[0].name }, season_competitions: { id: 'season-competition-league', name: 'Liga Aragonesa', color: 'purple', is_default: true } },
  { id: 'match-doubt', season_id: 'season-current', competition_id: null, opponent: 'Quebrantahuesos Rugby', match_date: addDays(today, 14), kickoff_time: '11:30:00', venue: 'Campo de Rugby del Actur', callup_time: '10:15:00', callup_venue: 'Aparcamiento del campus', is_home: true, notes: 'Partido amistoso de preparación.', status: 'published', match_kind: 'friendly', rugby_format: 'xv', lineup_published: false, created_by: DEMO_USERS.owner, created_at: now, updated_at: now, seasons: { name: initialSeasons[0].name }, season_competitions: null },
  { id: 'match-future', season_id: 'season-current', competition_id: null, opponent: 'Universitario Bilbao', match_date: addDays(today, 21), kickoff_time: '16:30:00', venue: 'Bilbao', callup_time: '12:00:00', callup_venue: 'Aparcamiento del campus', is_home: false, notes: null, status: 'draft', match_kind: 'friendly', rugby_format: 'sevens', lineup_published: false, created_by: DEMO_USERS.owner, created_at: now, updated_at: now, seasons: { name: initialSeasons[0].name }, season_competitions: null },
  { id: 'match-unavailable', season_id: 'season-current', competition_id: 'season-competition-cup', opponent: 'Ejea Rugby Club', match_date: addDays(today, 28), kickoff_time: '17:00:00', venue: 'Ejea de los Caballeros', callup_time: '14:15:00', callup_venue: 'Aparcamiento del campus', is_home: false, notes: 'Primera jornada de competición.', status: 'published', match_kind: 'official', rugby_format: 'xv', lineup_published: false, created_by: DEMO_USERS.owner, created_at: now, updated_at: now, seasons: { name: initialSeasons[0].name }, season_competitions: { id: 'season-competition-cup', name: 'Copa Aragón', color: 'orange', is_default: false } },
]

export const initialMatchAvailability: MatchAvailability[] = [
  { match_id: 'match-next', player_id: 'demo-player-2', status: 'doubt', comment: 'Molestias en el tobillo', updated_at: now },
  { match_id: 'match-next', player_id: 'demo-player-3', status: 'unavailable', comment: 'Viaje', updated_at: now },
  { match_id: 'match-doubt', player_id: DEMO_USERS.player, status: 'doubt', comment: 'Pendiente de confirmar el turno de trabajo', updated_at: now },
  { match_id: 'match-unavailable', player_id: DEMO_USERS.player, status: 'unavailable', comment: 'No estaré disponible ese fin de semana', updated_at: now },
]

export const initialMatchLineups: MatchLineup[] = [
  { match_id: 'match-report-demo', player_id: DEMO_USERS.player, role: 'starter', position: null, slot_number: 1, sort_order: 1, updated_at: now },
  { match_id: 'match-report-demo', player_id: 'demo-player-3', role: 'substitute', position: null, slot_number: 16, sort_order: 16, updated_at: now },
  { match_id: 'match-next', player_id: DEMO_USERS.player, role: 'starter', position: null, slot_number: 10, sort_order: 10, updated_at: now },
  { match_id: 'match-next', player_id: 'demo-player-2', role: 'starter', position: null, slot_number: 12, sort_order: 12, updated_at: now },
  { match_id: 'match-next', player_id: 'demo-player-3', role: 'substitute', position: null, slot_number: 16, sort_order: 16, updated_at: now },
]

export const initialResults: TaskResult[] = [
  result('task-speed', 'demo-player-complete', 2, currentWeek, 'Primera tarea semanal completada.'),
  result('task-strength', 'demo-player-complete', 3, currentWeek, 'Trabajo de fuerza completado.'),
  result('task-video', 'demo-player-complete', 1, currentWeek, 'Análisis de vídeo completado.'),
  result('task-speed', DEMO_USERS.player, 2, today, 'Ritmo alto y sin molestias.'),
  result('task-video', DEMO_USERS.player, 2, addDays(today, -1), 'Partido visto. Buen uso del ancho en las transiciones.'),
  result('task-speed', 'demo-player-2', 4, today, 'Última serie exigente.'),
  result('task-strength', 'demo-player-2', 5, addDays(today, -1), 'Sesión completada.'),
  result('task-video', 'demo-player-3', 1, today, 'Conceptos defensivos claros.'),
  result('task-previous', DEMO_USERS.player, 4, addDays(currentWeek, -3), 'Trabajo completado con fatiga media.'),
]

const sessionDates = [today, addDays(today, -2), addDays(today, -5), addDays(today, -9)]

export const initialSessions: TrainingSession[] = sessionDates.map((sessionDate, index) => ({
  id: `session-${index}`,
  session_date: sessionDate,
  season_id: 'season-current',
  updated_at: now,
  created_by: DEMO_USERS.owner,
  created_at: now,
}))

export const initialAttendance: AttendanceRecord[] = initialSessions.flatMap((session, sessionIndex) =>
  activeIds.map((playerId, playerIndex) => ({
    session_id: session.id,
    player_id: playerId,
    attended: (sessionIndex + playerIndex) % 5 !== 0,
    marked_by: DEMO_USERS.owner,
    updated_at: now,
    training_sessions: { session_date: session.session_date },
  })),
)

export const initialProvisionalPlayers: ProvisionalPlayer[] = [
  'Nerea Ruis',
  'Lucía Campos',
  'Marina Torres',
  'Julia Navarro',
  'Irene Gil',
].map((displayName, index) => ({
  id: `demo-guest-${index + 1}`,
  display_name: displayName,
  linked_profile_id: null,
  linked_by: null,
  linked_at: null,
  created_by: DEMO_USERS.owner,
  created_at: now,
  updated_at: now,
}))

export const initialProvisionalAttendance: ProvisionalAttendanceRecord[] = initialProvisionalPlayers.map((guest) => ({
  session_id: initialSessions[0].id,
  provisional_player_id: guest.id,
  marked_by: DEMO_USERS.owner,
  updated_at: now,
  training_sessions: { session_date: today },
}))

function profile(id: string, displayName: string, overrides: Partial<Profile> = {}): Profile {
  return {
    avatar_path: null,
    playing_positions: [],
    primary_position: null,
    id,
    display_name: displayName,
    is_approved: true,
    is_active: true,
    is_player: true,
    is_coach: false,
    is_owner: false,
    is_viewer: false,
    is_archived: false,
    created_at: `${year}-02-10T10:00:00.000Z`,
    ...overrides,
  }
}

function privateDetails(profileId: string, email: string, phone: string, birthDate: string): ProfilePrivateDetails {
  return { profile_id: profileId, email, phone: phone || null, birth_date: birthDate || null }
}

function season(id: string, name: string, startDate: string, endDate: string): Season {
  return { id, name, start_date: startDate, end_date: endDate, created_by: DEMO_USERS.owner, created_at: now, updated_at: now }
}

function task(
  id: string,
  title: string,
  trainingType: string,
  weekStart: string,
  status: TrainingTask['status'],
): TrainingTask {
  return {
    id,
    season_id: 'season-current',
    sort_order: 0,
    week_start: weekStart,
    title,
    description: taskDescription(title, trainingType),
    training_type: trainingType,
    status,
    created_by: DEMO_USERS.coach,
    created_at: now,
    seasons: { name: initialSeasons[0].name },
  }
}

function taskDescription(title: string, trainingType: string) {
  const specificInstructions: Record<string, string> = {
    Físico: 'Realiza 6 series de 30 segundos a intensidad alta, con 45 segundos de recuperación activa. Mantén el tronco estable en cada cambio de dirección y reduce la intensidad si aparece alguna molestia.',
    Gimnasio: 'Completa 4 bloques de sentadilla, peso muerto rumano y zancada trasera. Trabaja con una carga que permita terminar todas las repeticiones con buena técnica y deja 90 segundos de descanso entre bloques.',
    Vídeo: 'Mira el partido completo en https://www.youtube.com/watch?v=PW46tR7Ka9Y y anota dos decisiones acertadas y una situación que mejorarías. Presta especial atención a la comunicación, la subida defensiva y el uso del espacio.',
    Táctico: 'Revisa las secuencias defensivas indicadas y anota dos decisiones acertadas y una situación que mejorarías. Presta especial atención a la comunicación, la subida de línea y el reparto del espacio.',
    Recuperación: 'Dedica 8 minutos a movilidad de cadera y tobillo, 6 minutos a liberación suave y termina con respiración controlada. El trabajo no debe generar dolor ni aumentar la fatiga acumulada.',
    Técnico: 'Completa tres bloques de técnica individual aumentando progresivamente la velocidad. Prioriza una posición corporal segura y detén la repetición cuando no puedas mantener el gesto correctamente.',
  }

  return [
    `Objetivo de la sesión: ${title.toLowerCase()}. El propósito es completar el trabajo con calidad y registrar al terminar las sensaciones y cualquier adaptación realizada.`,
    specificInstructions[trainingType] ?? 'Sigue las indicaciones del cuerpo técnico y adapta el volumen a tus sensaciones manteniendo siempre una ejecución controlada.',
    'Antes de empezar, prepara el material necesario y realiza un calentamiento breve. Al finalizar, registra la fecha, el resultado conseguido y el nivel de fatiga percibido del 1 al 5.',
  ].join('\n\n')
}

function result(taskId: string, playerId: string, fatigue: number, date: string, text: string): TaskResult {
  return {
    task_id: taskId,
    player_id: playerId,
    result_text: text,
    fatigue_level: fatigue,
    performed_on: date,
    completed_at: now,
    updated_at: now,
  }
}

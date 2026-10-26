import { finalizeDemoSelfManagedAttendance } from '../src/features/trainingPlans/demoSelfManagedAttendance'
import { demoPlanFromValues, demoTrainingPlans } from '../src/features/trainingPlans/trainingPlanMappers'
import { trainingGenerationPreview, trainingResponseClosed } from '../src/lib/trainingSchedule'
import type { TrainingPlan, TrainingAttendanceBasis, SaveTrainingResponse } from '../src/types'
import { DemoTrainingExceptionScenario } from './DemoTrainingExceptionScenario'
import { GroupsHub } from '../src/features/workGroups/GroupsHub'
import { DemoWorkGroupsView } from './DemoWorkGroupsView'
import { createDemoWorkGroupStore } from '../src/features/workGroups/demoWorkGroups'
import { TrainingGroupsView } from '../src/features/trainingGroups/TrainingGroupsView'
import { createDemoTrainingGroupsApi, createDemoTrainingGroupStore, demoExtraGroupPlayers } from '../src/features/trainingGroups/demoTrainingGroups'
import { eligibleTrainingGroupPlayers } from '../src/features/trainingGroups/trainingGroupSelectors'
import { buildNotifications } from '../src/features/notifications/notifications'
import { canManageTrainingGroups, canManageTrainingExceptions, hasPermission } from '../src/lib/permissions'
import { DemoCrossTeamCallupScenario } from './DemoCrossTeamCallupScenario'
import { crossTeamCallupReference, crossTeamCallupRestriction } from '../src/lib/crossTeamCallups'
import { fixtureAvailability } from '../src/features/matches/internalFixtures'
import { reservedLineupPlayerIds } from '../src/features/matches/internalFixtures'
import { seasonAvailabilityReport } from '../src/features/matches/seasonAvailabilityReport'
import { validPlayerPositions } from '../src/lib/playerPositions'
import type { PlayerPositionValues } from '../src/lib/playerPositions'
import { isActivePlayer } from '../src/lib/selectors'
import { licenseLabel, membershipLicense } from '../src/lib/playerLicenses'
import { countNationalLeagueStarts, trainingExceptionCandidates, licenseAllowsTeam, matchAvailabilityRestriction, matchLicenseRestriction } from '../src/lib/playerLicenses'
import type { PlayerLicenseType, SeasonPlayer } from '../src/types'
import type { MatchReportValues, SavedReportEvent } from '../src/lib/matchMinutes'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { AppLayout } from '../src/components/layout/AppLayout'
import { AttendanceView } from '../src/features/attendance/AttendanceView'
import { Dashboard } from '../src/features/dashboard/Dashboard'
import { SettingsView } from '../src/features/settings/SettingsView'
import { StatisticsView } from '../src/features/statistics/StatisticsView'
import { TasksView } from '../src/features/tasks/TasksView'
import { MatchesView } from '../src/features/matches/MatchesView'
import { DemoInternalMatchScenario } from './DemoInternalMatchScenario'
import { CompetitionView } from '../src/features/competition/CompetitionView'
import { CalendarView } from '../src/features/calendar/CalendarView'
import { PlayerCalendarView } from '../src/features/calendar/PlayerCalendarView'
import type { CalendarSurvey } from '../src/features/tasks/calendarSurveys'
import { LibraryView } from '../src/features/library/LibraryView'
import { SurveysView } from '../src/features/surveys/SurveysView'
import { SurveyCalendarResultsDialog } from '../src/features/surveys/SurveyCalendarResultsDialog'
import { SurveyResponseDialog } from '../src/features/surveys/SurveyResponseDialog'
import type { SurveyAnswerValues } from '../src/features/surveys/SurveyResponseForm'
import { addDays, mondayFor, todayIso } from '../src/lib/dates'
import { membershipCoversDate, seasonForDate } from '../src/lib/selectors'
import { canAccessTasks, canBeSeasonTeamCoach, canManageSport, canViewTeamData, DEFAULT_ROLE_PERMISSIONS, isPlayer, PERMISSIONS } from '../src/lib/permissions'
import type { ConfigurableRole, PermissionDefinition, PermissionKey, RolePermission } from '../src/lib/permissions'
import type {
  Profile,
  ManagedProfileValues,
  ProfileDetailsValues,
  ProfilePhotoChange,
  PlayerAbsence,
  ProvisionalAttendanceEntry,
  ProvisionalPlayer,
  AvailabilityStatus,
  CalendarBirthday,
  Match,
  MatchLineup,
  PlayerSeasonSummary,
  SeasonCallupReport,
  MatchValues,
  ResultValues,
  Season,
  SeasonCompetition,
  SeasonTeam,
  SeasonBirthday,
  SeasonValues,
  LibraryItem,
  LibrarySettings,
  AnnouncementValues,
  TaskStatus,
  TaskValues,
  TrainingTask,
  TeamAnnouncement,
  TrainingPlanCalendarItem,
  ViewName,
} from '../src/types'
import type { PlayerAbsenceValues } from '../src/services/playerAbsencesService'
import type { SeasonCompetitionValues } from '../src/services/seasonCompetitionsService'
import type { SeasonTeamValues } from '../src/services/seasonTeamsService'
import type { SeasonTeamCoachChange } from '../src/services/seasonTeamsService'
import type { MySurveyResponse, SurveyForResponse, SurveyVisibility } from '../src/services/surveysService'
import type { NavigationTarget } from '../src/lib/navigation'
import {
  DEMO_USERS,
  initialAttendance,
  initialMemberships,
  initialProfiles,
  initialProfilePrivateDetails,
  initialPlayerAbsences,
  initialPlayerAbsenceNotes,
  initialProvisionalAttendance,
  initialProvisionalPlayers,
  initialResults,
  initialSeasons,
  initialSeasonCompetitions,
  initialSeasonTeams,
  initialSeasonTeamCoaches,
  initialSessions,
  initialTasks,
  initialMatches,
  initialMatchAvailability,
  initialMatchLineups,
  competitionSeasons,
  competitionFixtures,
  competitionStandings,
  competitionPlayerStats,
  initialAnnouncements,
} from './mockData'

type DemoRole = keyof typeof DEMO_USERS

const TrainingPlansView = lazy(() => import('../src/features/trainingPlans/TrainingPlansView').then((module) => ({ default: module.TrainingPlansView })))

const DEMO_PROFILE_PHOTO = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22320%22 height=%22320%22%3E%3Crect width=%22320%22 height=%22320%22 fill=%22%231e6f5c%22/%3E%3Ccircle cx=%22160%22 cy=%22120%22 r=%2260%22 fill=%22%23d8ece3%22/%3E%3Cpath d=%22M55 300c12-82 60-115 105-115s93 33 105 115%22 fill=%22%23d8ece3%22/%3E%3C/svg%3E'
const INITIAL_DEMO_SURVEY_CLOSURES: CalendarSurvey[] = [
  { id: 'schedule', title: 'Disponibilidad para concentración', result_date: '2026-09-08' },
  { id: 'wellbeing', title: 'Valoración del inicio de temporada', result_date: '2026-09-15' },
  { id: 'team-availability', title: 'Disponibilidad para el próximo viaje', result_date: '2026-09-26', state: 'active', responded: false, visibility: 'team', startsOn: '2026-09-12', endsOn: '2026-09-25' },
  { id: 'demo-player-survey', title: 'Disponibilidad para dos convocatorias', result_date: '2026-10-11', state: 'active', responded: true, respondedOn: '2026-09-15', visibility: 'private', startsOn: '2026-09-14', endsOn: '2026-10-10' },
  { id: 'management-travel', title: 'Organización del desplazamiento', result_date: '2026-09-29', state: 'active', responded: false, visibility: 'management', startsOn: '2026-09-16', endsOn: '2026-09-28' },
]
const demoCalendarSurveys = (surveys: CalendarSurvey[], from: string, until: string) => surveys.filter((survey) =>
  survey.state === 'active' && survey.startsOn && survey.endsOn
    ? (survey.startsOn <= until && survey.endsOn >= from) || (!!survey.result_date && survey.result_date >= from && survey.result_date <= until)
    : !!survey.result_date && survey.result_date >= from && survey.result_date <= until,
)
const DEMO_SURVEY_VISIBILITY: Record<string, SurveyVisibility> = {
  schedule: 'management',
  wellbeing: 'team',
  'team-availability': 'team',
  'demo-player-survey': 'private',
  'management-travel': 'management',
}
const DEMO_SURVEY_RESPONSES: Record<string, SurveyForResponse> = {
  'team-availability': {
    id: 'team-availability', title: 'Disponibilidad para el próximo viaje', description: 'Necesitamos confirmar con antelación las plazas de transporte y alojamiento.', endsOn: '2026-09-25', responded: false,
    questions: [
      { id: 'team-travel-weekend', prompt: '¿Puedes viajar el fin de semana del 26–27 de septiembre?', type: 'single', required: true, options: [{ id: 'team-travel-yes', label: 'Sí, cuento con ello' }, { id: 'team-travel-maybe', label: 'No, duda o depende' }] },
      { id: 'team-travel-needs', prompt: '¿Qué necesitarías para el viaje?', type: 'multiple', required: false, options: [{ id: 'team-transport', label: 'Transporte con el equipo' }, { id: 'team-accommodation', label: 'Alojamiento' }, { id: 'team-schedule', label: 'Confirmar horario de salida' }] },
    ],
  },
  'demo-player-survey': {
  id: 'demo-player-survey',
  title: 'Disponibilidad para dos convocatorias',
  description: 'Queremos planificar con tiempo las convocatorias. Marca tu disponibilidad real para cada fin de semana y añade una nota si lo necesitas.',
  endsOn: '2026-10-10',
  responded: true,
  answers: [
    { questionId: 'demo-availability-october', optionIds: ['october-yes'] },
    { questionId: 'demo-availability-february', optionIds: ['february-maybe'] },
    { questionId: 'demo-travel-needs', optionIds: ['travel-transport'] },
  ],
  questions: [
    { id: 'demo-availability-october', prompt: '17–18 de octubre de 2026', type: 'single', required: true, options: [{ id: 'october-yes', label: 'Disponible seguro' }, { id: 'october-maybe', label: 'No, duda o depende' }] },
    { id: 'demo-availability-february', prompt: '20–21 de febrero de 2027', type: 'single', required: true, options: [{ id: 'february-yes', label: 'Disponible seguro' }, { id: 'february-maybe', label: 'No, duda o depende' }] },
    { id: 'demo-travel-needs', prompt: 'Si hay viaje, ¿qué podrías necesitar?', type: 'multiple', required: false, options: [{ id: 'travel-transport', label: 'Transporte con el equipo' }, { id: 'travel-accommodation', label: 'Alojamiento' }, { id: 'travel-schedule', label: 'Confirmar horario de salida' }] },
    { id: 'demo-note', prompt: '¿Hay algo que debamos tener en cuenta?', type: 'long', required: false, options: [] },
  ],
  },
  'management-travel': {
    id: 'management-travel', title: 'Organización del desplazamiento', description: 'Dirección necesita esta información para dimensionar el transporte del equipo.', endsOn: '2026-09-28', responded: false,
    questions: [{ id: 'management-seat', prompt: '¿Necesitas plaza en el autobús?', type: 'single', required: true, options: [{ id: 'management-seat-yes', label: 'Sí, necesito plaza' }, { id: 'management-seat-no', label: 'No la necesito' }] }],
  },
  schedule: {
    id: 'schedule', title: 'Disponibilidad para concentración', description: 'Consulta cerrada para organizar la concentración del equipo.', endsOn: '2026-09-07', responded: true,
    answers: [{ questionId: 'schedule-attendance', optionIds: ['schedule-attendance-yes'] }],
    questions: [{ id: 'schedule-attendance', prompt: '¿Podrás acudir a la concentración?', type: 'single', required: true, options: [{ id: 'schedule-attendance-yes', label: 'Sí, estaré disponible' }, { id: 'schedule-attendance-no', label: 'No podré asistir' }] }],
  },
}

function buildDemoOwnSurveyResponses(surveys: Record<string, SurveyForResponse>): Record<string, MySurveyResponse> {
  return Object.fromEntries(Object.values(surveys).map((survey) => [survey.id, {
    survey: { id: survey.id, title: survey.title, description: survey.description, visibility: DEMO_SURVEY_VISIBILITY[survey.id] ?? 'private', endsOn: survey.endsOn },
    submittedAt: survey.responded ? '2026-09-15T10:30:00.000Z' : null,
    questions: survey.questions.map((question) => {
      const answer = survey.answers?.find((item) => item.questionId === question.id)
      return { ...question, selectedAnswer: answer ? { text: answer.text ?? null, optionIds: answer.optionIds ?? [] } : null }
    }),
  }]))
}
const DEMO_SEASON_HOLIDAYS = ['2026-09-08', '2026-09-15', '2026-09-24']
const DEMO_CALENDAR_TRAINING_PLANS: TrainingPlanCalendarItem[] = [
  { id: 'training-plan-calendar-1', session_date: '2026-10-27', title: 'Técnica de placaje y continuidad', status: 'published' },
  { id: 'training-plan-calendar-draft', session_date: '2026-10-29', title: 'Repaso de lanzamiento', status: 'draft' },
]
const DEMO_PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  { key: PERMISSIONS.trainingGroups.view, section_key: 'training_groups', section_label: 'Grupos de entrenamiento', label: 'Consultar grupos publicados', description: '', action: 'view', parent_key: null, sort_order: 680, configurable: true, owner_only: false },
  { key: PERMISSIONS.trainingGroups.manage, section_key: 'training_groups', section_label: 'Grupos de entrenamiento', label: 'Preparar grupos', description: '', action: 'edit', parent_key: PERMISSIONS.trainingGroups.view, sort_order: 681, configurable: true, owner_only: false },
  { key: PERMISSIONS.trainingGroups.publish, section_key: 'training_groups', section_label: 'Grupos de entrenamiento', label: 'Publicar grupos', description: '', action: 'publish', parent_key: PERMISSIONS.trainingGroups.manage, sort_order: 682, configurable: true, owner_only: false },
  { key: PERMISSIONS.team.positions, section_key: 'team', section_label: 'Equipo', label: 'Modificar posiciones de jugadoras', description: '', action: 'edit', parent_key: null, sort_order: 855, configurable: true, owner_only: false },
  { key: PERMISSIONS.tasks.team, section_key: 'tasks', section_label: 'Tareas', label: 'Ver tareas del equipo', description: 'Acceso a la planificación de tareas.', action: 'view', parent_key: null, sort_order: 1, configurable: true, owner_only: false },
  { key: PERMISSIONS.tasks.edit, section_key: 'tasks', section_label: 'Tareas', label: 'Editar tareas', description: '', action: 'edit', parent_key: PERMISSIONS.tasks.team, sort_order: 2, configurable: true, owner_only: false },
  { key: PERMISSIONS.tasks.publish, section_key: 'tasks', section_label: 'Tareas', label: 'Publicar tareas', description: '', action: 'publish', parent_key: PERMISSIONS.tasks.edit, sort_order: 3, configurable: true, owner_only: false },
  { key: PERMISSIONS.surveys.manage, section_key: 'surveys', section_label: 'Encuestas', label: 'Ver gestión de encuestas', description: '', action: 'view', parent_key: null, sort_order: 4, configurable: true, owner_only: false },
  { key: PERMISSIONS.surveys.create, section_key: 'surveys', section_label: 'Encuestas', label: 'Crear encuestas', description: '', action: 'create', parent_key: PERMISSIONS.surveys.manage, sort_order: 5, configurable: true, owner_only: false },
  { key: PERMISSIONS.surveys.publish, section_key: 'surveys', section_label: 'Encuestas', label: 'Publicar encuestas', description: '', action: 'publish', parent_key: PERMISSIONS.surveys.create, sort_order: 6, configurable: true, owner_only: false },
]
const DEMO_ROLE_PERMISSIONS: RolePermission[] = (Object.keys(DEFAULT_ROLE_PERMISSIONS) as ConfigurableRole[]).flatMap((role) =>
  DEMO_PERMISSION_DEFINITIONS.filter((definition) => DEFAULT_ROLE_PERMISSIONS[role].has(definition.key)).map((definition) => ({ role, permission_key: definition.key })),
)

export function DemoApp() {
  const [role, setRole] = useState<DemoRole>('owner')
  const [view, setView] = useState<ViewName>('home')
  const [settingsSection, setSettingsSection] = useState<'team' | 'seasons' | 'library' | 'permissions'>()
  const [focusedDate, setFocusedDate] = useState<string>()
  const [focusedAnnouncementId, setFocusedAnnouncementId] = useState<string>()
  const [surveyResultId, setSurveyResultId] = useState<string>()
  const [surveyPreviewOpen, setSurveyPreviewOpen] = useState(false)
  const [demoSurveyClosures, setDemoSurveyClosures] = useState(INITIAL_DEMO_SURVEY_CLOSURES)
  const [demoSurveyResponses, setDemoSurveyResponses] = useState(DEMO_SURVEY_RESPONSES)
  const [seasonHolidays, setSeasonHolidays] = useState(DEMO_SEASON_HOLIDAYS)
  const [message, setMessage] = useState('')
  const [profiles, setProfiles] = useState(initialProfiles)
  const [demoPhotos, setDemoPhotos] = useState<Record<string, string>>({})
  const [profilePrivateDetails, setProfilePrivateDetails] = useState(initialProfilePrivateDetails)
  const [playerAbsences, setPlayerAbsences] = useState(initialPlayerAbsences)
  const [playerAbsenceNotes, setPlayerAbsenceNotes] = useState(initialPlayerAbsenceNotes)
  const [seasons, setSeasons] = useState(initialSeasons)
  const [trainingPlans, setTrainingPlans] = useState<TrainingPlan[]>(() => [
    ...demoTrainingPlans(initialSeasons),
    ...DEMO_CALENDAR_TRAINING_PLANS.map((item) => ({ ...demoPlanFromValues({ seasonId: initialSeasons[0].id, sessionDate: item.session_date, title: item.title, objectives: '', material: '', status: item.status, exercises: [] }, initialSeasons), id: item.id })),
  ])
  const [trainingResponses, setTrainingResponses] = useState<Record<string, { attending: boolean; comment: string; version: number }>>(() => ({
    // Respuestas de ejemplo para que el owner y el entrenador puedan revisar
    // la lista de asistentes desde el calendario sin conectar con Supabase.
    'training-plan-calendar-draft:demo-player': { attending: true, comment: '', version: 1 },
    'training-plan-calendar-draft:demo-player-2': { attending: true, comment: '', version: 1 },
  }))
  const [seasonCompetitions, setSeasonCompetitions] = useState(initialSeasonCompetitions)
  const [seasonTeams, setSeasonTeams] = useState(initialSeasonTeams)
  const [seasonTeamCoaches, setSeasonTeamCoaches] = useState(initialSeasonTeamCoaches)
  const [rawMemberships, setMemberships] = useState<SeasonPlayer[]>(initialMemberships.map((item) => ({ ...item, license_type: 'regional' })))
  const [tasks, setTasks] = useState(initialTasks)
  const [announcements, setAnnouncements] = useState(initialAnnouncements)
  const [results, setResults] = useState(initialResults)
  const [sessions, setSessions] = useState(initialSessions)
  const [attendance, setAttendance] = useState(initialAttendance)
  const [provisionalPlayers, setProvisionalPlayers] = useState(initialProvisionalPlayers)
  const [provisionalAttendance, setProvisionalAttendance] = useState(initialProvisionalAttendance)
  const [rawMatches, setMatches] = useState(initialMatches)
  const [rawMatchAvailability, setMatchAvailability] = useState(initialMatchAvailability)
  const [matchLineups, setMatchLineups] = useState(initialMatchLineups)
  const [matchReportEvents, setMatchReportEvents] = useState<Record<string, SavedReportEvent[]>>({})
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([])
  const [librarySettings, setLibrarySettings] = useState<LibrarySettings | null>(null)
  const [rolePermissions, setRolePermissions] = useState(DEMO_ROLE_PERMISSIONS)
  const matches = rawMatches.map((match) => {
    const team = seasonTeams.find((item) => item.id === match.team_id)
    const competition = seasonCompetitions.find((item) => item.id === match.competition_id)
    return { ...match, season_competitions: competition ? { id: competition.id, name: competition.name, color: competition.color, is_default: competition.is_default, competition_level: competition.competition_level, is_league: competition.is_league, restrict_cross_team_callups: competition.restrict_cross_team_callups } : null, season_teams: team ? { id: team.id, name: team.name, color: team.color, is_mixed: team.is_mixed, is_default: team.is_default } : null }
  })
  const memberships = rawMemberships.map((item) => ({ ...item, national_starts: countNationalLeagueStarts(matches, matchLineups, item.season_id, item.player_id) }))
  useEffect(() => {
    function finalize() {
      const next = finalizeDemoSelfManagedAttendance(trainingPlans, profiles, rawMemberships, trainingResponses, sessions, attendance, seasonHolidays)
      if (next.sessions !== sessions) { setSessions(next.sessions); setAttendance(next.attendance) }
    }
    const initial = window.setTimeout(finalize, 0)
    const timer = window.setInterval(finalize, 1000)
    return () => { window.clearTimeout(initial); window.clearInterval(timer) }
  }, [trainingPlans, profiles, rawMemberships, trainingResponses, sessions, attendance, seasonHolidays])
  const seasonCompetitionsWithCounts = seasonCompetitions.map((competition) => ({ ...competition, match_count: matches.filter((match) => match.competition_id === competition.id).length }))
  const matchAvailability = matches.flatMap((match) => fixtureAvailability(match, matches, rawMatchAvailability))
  const userId = DEMO_USERS[role]
  const profile = profiles.find((item) => item.id === userId) ?? profiles[0]
  const personalResults = results.filter((item) => item.player_id === userId)
  const canEditPositions = profile.is_owner || profile.is_coach && rolePermissions.some((permission) => permission.permission_key === PERMISSIONS.team.positions && ((permission.role === 'coach' && profile.is_coach) || (permission.role === 'viewer' && profile.is_viewer) || (permission.role === 'player' && profile.is_player)))
  const groupPermissionKeys = [...[...DEFAULT_ROLE_PERMISSIONS[role === 'owner' ? 'coach' : role]].filter((key) => !key.startsWith('training_groups.')), ...rolePermissions.filter((grant) => (grant.role === 'coach' && profile.is_coach) || (grant.role === 'viewer' && profile.is_viewer) || (grant.role === 'player' && profile.is_player)).map((grant) => grant.permission_key)]
  const canManageGroups = canManageTrainingGroups(profile, groupPermissionKeys)
  const canPublishGroups = canManageGroups && hasPermission(profile, PERMISSIONS.trainingGroups.publish, groupPermissionKeys)
  const canViewTrainingGroups = hasPermission(profile, PERMISSIONS.trainingGroups.view, groupPermissionKeys)
  const canViewWorkGroups = hasPermission(profile, PERMISSIONS.workGroups.view, groupPermissionKeys)
  const canViewVideoAnalysis = hasPermission(profile, PERMISSIONS.videoAnalysis.view, groupPermissionKeys)
  const activeGroupSeason = seasons.find((season) => season.start_date <= todayIso() && season.end_date >= todayIso())
  const [workStores] = useState(() => new Map([[initialSeasons[0].id, createDemoWorkGroupStore()]]))
  const [groupStore] = useState(() => {
    const season = initialSeasons[0]
    const players = eligibleTrainingGroupPlayers(initialProfiles, initialMemberships, initialSeasonTeams, season, todayIso())
    return createDemoTrainingGroupStore(season.id, season.start_date, [...players, ...demoExtraGroupPlayers()])
  })
  const [, refreshGroupNotifications] = useState(0)
  const [readGroupNotificationIds, setReadGroupNotificationIds] = useState<Set<string>>(new Set())

  const currentGroupBlock = groupStore.blocks.filter((block) => block.status === 'published' && block.season_id === activeGroupSeason?.id && block.starts_on <= todayIso()).sort((a,b) => b.starts_on.localeCompare(a.starts_on))[0]
  const nextGroupBlock = groupStore.blocks.filter((block) => block.status === 'published' && block.season_id === activeGroupSeason?.id && block.starts_on > todayIso()).sort((a,b) => a.starts_on.localeCompare(b.starts_on))[0]
  const groupNotifications = buildNotifications({ tasks: [], results: [], memberships: [], matches: [], availability: [], lineups: [], trainingGroups: [currentGroupBlock, nextGroupBlock].flatMap((block) => {
    if (!block || !activeGroupSeason || !eligibleTrainingGroupPlayers(profiles, rawMemberships, seasonTeams, activeGroupSeason, block.starts_on > todayIso() ? block.starts_on : todayIso()).some((player) => player.player_id === userId)) return []
    const entry = groupStore.members[block.id]?.find((member) => member.player_id === userId)
    return entry ? [{ block_id: block.id, starts_on: block.starts_on, color: entry.color, notified_at: entry.notified_at }] : []
  }) }, { ...profile }, todayIso(), undefined, groupPermissionKeys).filter((notification) => !readGroupNotificationIds.has(notification.id))
  const canManage = canManageSport(profile)
  const canViewTeam = canViewTeamData(profile)
  const calendarBirthdays = buildDemoCalendarBirthdays(profiles, profilePrivateDetails, memberships, seasons)
  const ownerBirthdays = buildDemoOwnerBirthdays(calendarBirthdays, profilePrivateDetails)
  const demoOwnSurveyResponses = useMemo(() => buildDemoOwnSurveyResponses(demoSurveyResponses), [demoSurveyResponses])
  const groupApi = useMemo(() => {
    const groupProfile = profiles.find((item) => item.id === userId) ?? profiles[0]
    const keys = rolePermissions.filter((grant) => (grant.role === 'coach' && groupProfile.is_coach) || (grant.role === 'viewer' && groupProfile.is_viewer) || (grant.role === 'player' && groupProfile.is_player)).map((grant) => grant.permission_key)
    const manages = canManageTrainingGroups(groupProfile, keys)
    return createDemoTrainingGroupsApi({ store: groupStore, userId, canManage: manages, canPublish: manages && hasPermission(groupProfile, PERMISSIONS.trainingGroups.publish, keys),
    seasonEnd: (id) => seasons.find((season) => season.id === id)?.end_date ?? '',
    playersOn: (id, date) => {
      const season = seasons.find((item) => item.id === id)
      if (!season || date < season.start_date || date > season.end_date) return []
      return [...eligibleTrainingGroupPlayers(profiles, rawMemberships, seasonTeams, season, date), ...(id === initialSeasons[0].id ? demoExtraGroupPlayers() : [])]
    },
  })
  }, [groupStore, userId, rolePermissions, seasons, profiles, rawMemberships, seasonTeams])

  function notify(text: string) {
    setMessage(text)
    window.setTimeout(() => setMessage(''), 2500)
  }

  async function submitDemoSurveyResponse(surveyId: string, answers: SurveyAnswerValues[]) {
    setDemoSurveyResponses((current) => ({ ...current, [surveyId]: { ...current[surveyId], responded: true, answers } }))
    setDemoSurveyClosures((current) => current.map((survey) => survey.id === surveyId ? { ...survey, responded: true, respondedOn: todayIso() } : survey))
    notify('Respuesta de ejemplo guardada. Puedes modificarla mientras siga abierta.')
  }

  async function loadDemoSurveyResults(surveyId: string) {
    const survey = demoSurveyClosures.find((item) => item.id === surveyId)
    const currentResponses = demoSurveyClosures.find((item) => item.id === surveyId)?.responded ? 15 : surveyId === 'schedule' ? 17 : 14
    return {
      title: survey?.title ?? 'Encuesta',
      description: demoSurveyResponses[surveyId]?.description ?? 'Resultados de ejemplo visibles según la configuración de la encuesta.',
      responses: currentResponses,
      recipients: 18,
      questions: [
        { prompt: '¿Cómo valoras la propuesta?', options: [{ label: 'Muy positiva', count: 9 }, { label: 'Positiva', count: 4 }, { label: 'Mejorable', count: 1 }], longAnswers: [] },
        { prompt: '¿Qué necesitarías?', options: [{ label: 'Transporte', count: 8 }, { label: 'Alojamiento', count: 5 }], longAnswers: [{ text: 'Necesitaría confirmar el horario de salida.' }] },
      ],
    }
  }

  async function saveRolePermissions(configurableRole: ConfigurableRole, permissions: PermissionKey[]) {
    setRolePermissions((current) => [
      ...current.filter((grant) => grant.role !== configurableRole),
      ...permissions.map((permission_key) => ({ role: configurableRole, permission_key })),
    ])
    notify('Permisos guardados en la demo.')
  }

  async function resetRolePermissions(configurableRole: ConfigurableRole) {
    const defaults = DEMO_ROLE_PERMISSIONS.filter((grant) => grant.role === configurableRole)
    setRolePermissions((current) => [...current.filter((grant) => grant.role !== configurableRole), ...defaults])
    notify('Permisos restaurados en la demo.')
  }

  function changeRole(nextRole: DemoRole) {
    setRole(nextRole)
    setView('home')
    setSettingsSection(undefined)
    notify(`Vista cambiada a ${roleLabel(nextRole)}.`)
  }

  function navigate(nextTarget: ViewName | NavigationTarget) {
    setFocusedDate(undefined)
    setFocusedAnnouncementId(undefined)
    if (typeof nextTarget === 'string') {
      setView(nextTarget)
      setSettingsSection(undefined)
      return
    }
    setView(nextTarget.view)
    setSettingsSection(nextTarget.view === 'settings' ? nextTarget.settingsSection : undefined)
  }

  async function saveResult(task: TrainingTask, values: ResultValues) {
    const next = {
      task_id: task.id,
      player_id: userId,
      result_text: values.resultText,
      fatigue_level: values.fatigueLevel,
      performed_on: values.performedOn,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    setResults((current) => [
      ...current.filter((item) => !(item.task_id === task.id && item.player_id === userId)),
      next,
    ])
    notify('Resultado guardado en la memoria de la demo.')
  }

  async function createTask(values: TaskValues) {
    const season = seasons.find((item) => item.id === values.seasonId)
    setTasks((current) => [{
      id: `demo-task-${Date.now()}`,
      season_id: values.seasonId,
      sort_order: current.length,
      week_start: mondayFor(values.date),
      title: values.title.trim(),
      description: values.description.trim() || null,
      training_type: values.trainingType,
      status: values.status,
      created_by: userId,
      created_at: new Date().toISOString(),
      seasons: season ? { name: season.name } : null,
    }, ...current])
    notify('Tarea mock creada.')
  }

  async function updateStatus(taskId: string, status: TaskStatus) {
    setTasks((current) => current.map((task) => task.id === taskId ? { ...task, status } : task))
    notify('Estado actualizado en la demo.')
  }

  async function updateTask(taskToUpdate: TrainingTask, values: TaskValues) {
    const season = seasons.find((item) => item.id === values.seasonId)
    setTasks((current) => current.map((task) => task.id === taskToUpdate.id ? {
      ...task,
      season_id: values.seasonId,
      title: values.title.trim(),
      description: values.description.trim() || null,
      training_type: values.trainingType,
      status: values.status,
      seasons: season ? { name: season.name } : null,
    } : task))
    notify('Tarea mock actualizada.')
  }

  async function deleteTask(taskToDelete: TrainingTask) {
    setTasks((current) => current.filter((task) => task.id !== taskToDelete.id))
    setResults((current) => current.filter((result) => result.task_id !== taskToDelete.id))
    notify('Tarea mock y sus respuestas eliminadas.')
  }

  async function reorderTasks(taskIds: string[]) {
    const order = new Map(taskIds.map((id, index) => [id, index + 1]))
    setTasks((current) => current.map((task) => order.has(task.id) ? { ...task, sort_order: order.get(task.id)! } : task))
    notify('Orden actualizado en la demo.')
  }

  async function saveAnnouncement(announcement: TeamAnnouncement | undefined, values: AnnouncementValues) {
    const season = seasons.find((item) => item.id === values.seasonId)
    const payload = { season_id: values.seasonId, announcement_date: values.date, title: values.title.trim(), description: values.description.trim() || null, status: values.status, updated_at: new Date().toISOString(), seasons: season ? { name: season.name } : null }
    setAnnouncements((current) => announcement
      ? current.map((item) => item.id === announcement.id ? { ...item, ...payload } : item)
      : [...current, { id: `demo-announcement-${Date.now()}`, ...payload, created_by: userId, created_at: new Date().toISOString() }])
    notify(announcement ? 'Aviso mock actualizado.' : 'Aviso mock creado.')
  }

  async function deleteAnnouncement(announcement: TeamAnnouncement) {
    setAnnouncements((current) => current.filter((item) => item.id !== announcement.id))
    notify('Aviso mock eliminado.')
  }

  async function updateAnnouncementStatus(id: string, status: TaskStatus) {
    setAnnouncements((current) => current.map((item) => item.id === id ? { ...item, status } : item))
    notify('Estado del aviso actualizado en la demo.')
  }

  async function createSeason(values: SeasonValues) {
    const seasonId = `demo-season-${crypto.randomUUID()}`
    const teamId = `demo-team-${crypto.randomUUID()}`
    const now = new Date().toISOString()
    setSeasons((current) => [{
      id: seasonId,
      ...values,
      name: values.name.trim(),
      created_by: userId,
      created_at: now,
      updated_at: now,
    }, ...current])
    setSeasonTeams((current) => [...current, { id: teamId, season_id: seasonId, name: 'Unizar Femenino', color: 'purple', is_mixed: false, is_default: true, is_active: true, created_by: userId, created_at: now, updated_at: now }])
    setMemberships((current) => [...current, ...profiles.filter(isActivePlayer).map((item) => ({
      id: `demo-membership-${crypto.randomUUID()}`, season_id: seasonId, season_team_id: teamId, license_type: 'regional' as const,
      player_id: item.id, active_from: values.start_date, active_until: null, created_at: now,
    }))])
    notify('Temporada mock creada.')
  }

  async function updateSeason(season: Season, values: SeasonValues) {
    setSeasons((current) => current.map((item) => item.id === season.id ? { ...item, ...values, name: values.name.trim() } : item))
    notify('Temporada mock actualizada.')
  }

  async function deleteSeason(season: Season) {
    const deletedMatchIds = new Set(matches.filter((match) => match.season_id === season.id).map((match) => match.id))
    setSeasons((current) => current.filter((item) => item.id !== season.id))
    setSeasonCompetitions((current) => current.filter((item) => item.season_id !== season.id))
    const removedTeamIds = new Set(seasonTeams.filter((team) => team.season_id === season.id).map((team) => team.id))
    setSeasonTeams((current) => current.filter((team) => team.season_id !== season.id))
    setSeasonTeamCoaches((current) => current.filter((assignment) => !removedTeamIds.has(assignment.season_team_id)))
    setMemberships((current) => current.filter((item) => item.season_id !== season.id))
    setMatches((current) => current.filter((item) => item.season_id !== season.id))
    setMatchAvailability((current) => current.filter((item) => !deletedMatchIds.has(item.match_id)))
    setMatchLineups((current) => current.filter((item) => !deletedMatchIds.has(item.match_id)))
    notify('Temporada mock eliminada.')
  }

  async function createDemoSeasonTeam(season: Season, values: Pick<SeasonTeamValues, 'name' | 'isMixed' | 'color'>) {
    const name = values.name.trim()
    if (!name || name.length > 80) throw new Error('Escribe un nombre para el equipo (máximo 80 caracteres).')
    if (seasonTeams.some((team) => team.season_id === season.id && team.name.trim().toLocaleLowerCase('es') === name.toLocaleLowerCase('es'))) throw new Error('Ya existe un equipo con ese nombre en la temporada.')
    if (values.isMixed && seasonTeams.some((team) => team.season_id === season.id && team.is_mixed)) throw new Error('Solo puede existir un grupo mixto por temporada.')
    const now = new Date().toISOString()
    const team: SeasonTeam = { id: `demo-team-${crypto.randomUUID()}`, season_id: season.id, name, color: values.color ?? 'purple', is_mixed: values.isMixed, is_default: false, is_active: true, created_by: userId, created_at: now, updated_at: now }
    setSeasonTeams((current) => [...current, team])
    notify('Equipo creado en la demo.')
  }

  async function updateDemoSeasonTeam(team: SeasonTeam, values: SeasonTeamValues) {
    const name = values.name.trim()
    if (!name || name.length > 80) throw new Error('Escribe un nombre para el equipo (máximo 80 caracteres).')
    if (seasonTeams.some((item) => item.id !== team.id && item.season_id === team.season_id && item.name.trim().toLocaleLowerCase('es') === name.toLocaleLowerCase('es'))) throw new Error('Ya existe un equipo con ese nombre en la temporada.')
    if (values.isMixed && seasonTeams.some((item) => item.id !== team.id && item.season_id === team.season_id && item.is_mixed)) throw new Error('Solo puede existir un grupo mixto por temporada.')
    if (!values.isActive && memberships.some((item) => item.season_team_id === team.id && !item.active_until)) throw new Error('Reasigna primero a las jugadoras activas de este equipo.')
    setSeasonTeams((current) => current.map((item) => item.id === team.id ? { ...item, name, color: values.color ?? item.color ?? 'purple', is_mixed: values.isMixed, is_active: values.isActive, updated_at: new Date().toISOString() } : item))
    notify('Equipo actualizado en la demo.')
  }

  async function deleteDemoSeasonTeam(team: SeasonTeam) {
    if (team.is_default) throw new Error('El equipo inicial no se puede borrar.')
    if (memberships.some((item) => item.season_team_id === team.id)) throw new Error('Reasigna primero a todas las jugadoras de este equipo.')
    if (matches.some((match) => match.team_id === team.id)) throw new Error('No se puede borrar un equipo que tiene partidos asociados.')
    setSeasonTeams((current) => current.filter((item) => item.id !== team.id))
    setSeasonTeamCoaches((current) => current.filter((assignment) => assignment.season_team_id !== team.id))
    notify('Equipo eliminado en la demo.')
  }

  async function assignDemoSeasonTeamCoaches(team: SeasonTeam, changes: SeasonTeamCoachChange[]) {
    for (const change of changes.filter((item) => item.assigned)) {
      const coach = profiles.find((profile) => profile.id === change.coachId)
      if (!coach || !canBeSeasonTeamCoach(coach)) throw new Error('La persona seleccionada no es un entrenador u owner activo.')
    }
    const changedIds = new Set(changes.map((change) => change.coachId))
    const current = seasonTeamCoaches.filter((item) => item.season_team_id === team.id && !changedIds.has(item.coach_id))
    const updated = changes.filter((change) => change.assigned).map((change) => ({ season_team_id: team.id, coach_id: change.coachId, role: change.role, created_at: new Date().toISOString() }))
    if (current.filter((item) => item.role === 'head_coach').length + updated.filter((item) => item.role === 'head_coach').length > 1) throw new Error('El equipo solo puede tener un head coach.')
    const teamAssignments = [...current, ...updated]
    setSeasonTeamCoaches((existing) => [...existing.filter((item) => item.season_team_id !== team.id), ...teamAssignments])
    notify('Entrenadores del equipo actualizados en la demo.')
  }

  async function createSeasonCompetition(season: Season, values: SeasonCompetitionValues) {
    const first = !seasonCompetitions.some((competition) => competition.season_id === season.id)
    setSeasonCompetitions((current) => [...current, {
      id: `demo-season-competition-${Date.now()}`, season_id: season.id, name: values.name.trim(), color: values.color, competition_level: values.competitionLevel ?? 'regional', is_league: values.isLeague ?? false, restrict_cross_team_callups: values.restrictCrossTeamCallups ?? false,
      is_default: first, match_count: 0, created_by: userId, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }])
    notify('Competición creada en la demo.')
  }

  async function updateSeasonCompetition(competition: SeasonCompetition, values: SeasonCompetitionValues) {
    setSeasonCompetitions((current) => current.map((item) => item.id === competition.id ? { ...item, name: values.name.trim(), color: values.color, competition_level: values.competitionLevel ?? 'regional', is_league: values.isLeague ?? false, restrict_cross_team_callups: values.restrictCrossTeamCallups ?? false, updated_at: new Date().toISOString() } : item))
    setMatches((current) => current.map((match) => match.competition_id === competition.id ? { ...match, season_competitions: { id: competition.id, name: values.name.trim(), color: values.color, competition_level: values.competitionLevel ?? 'regional', is_league: values.isLeague ?? false, restrict_cross_team_callups: values.restrictCrossTeamCallups ?? false, is_default: competition.is_default } } : match))
    notify('Competición actualizada en la demo.')
  }

  async function setDefaultSeasonCompetition(competition: SeasonCompetition) {
    setSeasonCompetitions((current) => current.map((item) => item.season_id === competition.season_id ? { ...item, is_default: item.id === competition.id } : item))
    setMatches((current) => current.map((match) => match.season_id === competition.season_id && match.season_competitions ? { ...match, season_competitions: { ...match.season_competitions, is_default: match.competition_id === competition.id } } : match))
    notify('Competición predeterminada actualizada en la demo.')
  }

  async function deleteSeasonCompetition(competition: SeasonCompetition) {
    const deletedMatchIds = new Set(matches.filter((match) => match.competition_id === competition.id).map((match) => match.id))
    const remaining = seasonCompetitions.filter((item) => item.season_id === competition.season_id && item.id !== competition.id)
    const promotedId = competition.is_default ? remaining[0]?.id : undefined
    setSeasonCompetitions((current) => current.filter((item) => item.id !== competition.id).map((item) => item.id === promotedId ? { ...item, is_default: true } : item))
    setMatches((current) => current.filter((match) => !deletedMatchIds.has(match.id)).map((match) => promotedId && match.competition_id === promotedId && match.season_competitions ? { ...match, season_competitions: { ...match.season_competitions, is_default: true } } : match))
    setMatchAvailability((current) => current.filter((item) => !deletedMatchIds.has(item.match_id)))
    setMatchLineups((current) => current.filter((item) => !deletedMatchIds.has(item.match_id)))
    notify('Competición y partidos asociados eliminados en la demo.')
  }

  async function saveMatch(match: Match | undefined, values: MatchValues) {
    const season = seasons.find((item) => item.id === values.seasonId)
    const competition = values.matchKind === 'official' ? seasonCompetitions.find((item) => item.id === values.competitionId) : undefined
    const payload = { season_id: values.seasonId, team_id: values.teamId || null, competition_id: competition?.id ?? null, opponent: values.opponent, match_date: values.matchDate, kickoff_time: values.kickoffTime || null, venue: values.venue || null, callup_time: values.callupTime || null, callup_venue: values.callupVenue || null, is_home: values.isHome, notes: values.notes || null, status: values.status, match_kind: values.matchKind, rugby_format: values.rugbyFormat, seasons: season ? { name: season.name } : null, season_competitions: competition ? { id: competition.id, name: competition.name, color: competition.color, is_default: competition.is_default } : null, updated_at: new Date().toISOString() }
    if (!match && values.opponentTeamId) {
      const home = seasonTeams.find((team) => team.id === values.teamId)
      const away = seasonTeams.find((team) => team.id === values.opponentTeamId)
      if (!home || !away || home.id === away.id) throw new Error('Selecciona dos equipos distintos para el derbi.')
      const fixtureId = `demo-fixture-${Date.now()}`
      const shared = { ...payload, internal_fixture_id: fixtureId, lineup_published: false, created_by: userId, created_at: new Date().toISOString() }
      setMatches((current) => [...current,
        { ...shared, id: `${fixtureId}-home`, team_id: home.id, opponent: away.name, is_home: true },
        { ...shared, id: `${fixtureId}-away`, team_id: away.id, opponent: home.name, is_home: false },
      ])
    } else {
      setMatches((current) => match ? current.map((item) => match.internal_fixture_id && item.internal_fixture_id === match.internal_fixture_id
        ? { ...item, ...payload, team_id: item.team_id, opponent: item.opponent, is_home: item.is_home }
        : item.id === match.id ? { ...item, ...payload } : item)
        : [...current, { id: `demo-match-${Date.now()}`, ...payload, lineup_published: false, created_by: userId, created_at: new Date().toISOString() }])
    }
    notify(match ? 'Partido mock actualizado.' : 'Partido mock creado.')
  }

  async function removeMatch(match: Match) {
    const deletedIds = new Set(matches.filter((item) => item.id === match.id || Boolean(match.internal_fixture_id && item.internal_fixture_id === match.internal_fixture_id)).map((item) => item.id))
    setMatches((current) => current.filter((item) => !deletedIds.has(item.id)))
    setMatchAvailability((current) => current.filter((item) => !deletedIds.has(item.match_id)))
    setMatchLineups((current) => current.filter((item) => !deletedIds.has(item.match_id)))
    setMatchReportEvents((current) => Object.fromEntries(Object.entries(current).filter(([matchId]) => !deletedIds.has(matchId))))
    notify('Partido mock eliminado.')
  }
  async function saveAvailability(match: Match, status: AvailabilityStatus, comment: string) { if (matchAvailabilityRestriction(match, memberships, userId)) throw new Error(matchAvailabilityRestriction(match, memberships, userId)!); if (match.lineup_published) throw new Error('La convocatoria ya está publicada.'); setMatchAvailability((current) => [...current.filter((item) => !(item.player_id === userId && matches.some((related) => related.id === item.match_id && (related.id === match.id || Boolean(match.internal_fixture_id && related.internal_fixture_id === match.internal_fixture_id))))), { match_id: match.id, player_id: userId, status, comment: comment || null, updated_at: new Date().toISOString() }]); if (status !== 'available') setMatchLineups((current) => current.filter((item) => !(item.player_id === userId && matches.some((related) => related.id === item.match_id && (related.id === match.id || Boolean(match.internal_fixture_id && related.internal_fixture_id === match.internal_fixture_id)))))); notify('Disponibilidad mock guardada.') }
  async function savePlayerAvailability(match: Match, playerId: string, status: AvailabilityStatus, comment: string) { const reason = matchAvailabilityRestriction(match, memberships, playerId); if (reason) throw new Error(reason); setMatchAvailability((current) => [...current.filter((item) => !(item.player_id === playerId && matches.some((related) => related.id === item.match_id && (related.id === match.id || Boolean(match.internal_fixture_id && related.internal_fixture_id === match.internal_fixture_id))))), { match_id: match.id, player_id: playerId, status, comment: comment || null, updated_at: new Date().toISOString() }]); if (status !== 'available') setMatchLineups((current) => current.filter((item) => !(item.player_id === playerId && matches.some((related) => related.id === item.match_id && (related.id === match.id || Boolean(match.internal_fixture_id && related.internal_fixture_id === match.internal_fixture_id)))))); notify('Disponibilidad de la jugadora actualizada en la demo.') }
  async function addTrainingPlayer(match: Match, playerId: string, reason: string, slotNumber?: number) {
    if (!canManageTrainingExceptions(profile) || !trainingExceptionCandidates(match, memberships, profiles).some((player) => player.id === playerId)) throw new Error('No puedes autorizar esta participación.')
    if (reservedLineupPlayerIds(match, matches, matchLineups).includes(playerId)) throw new Error('La jugadora ya está convocada en otro partido.')
    if (slotNumber && matchLineups.some((entry) => entry.match_id === match.id && (entry.slot_number === slotNumber || entry.player_id === playerId))) throw new Error('El dorsal está ocupado o la jugadora ya está convocada.')
    setMatches((current) => current.map((item) => item.id === match.id ? { ...item, training_exceptions: [...(item.training_exceptions ?? []).filter((entry) => entry.player_id !== playerId), { player_id: playerId }], report_events_reviewed: slotNumber ? false : item.report_events_reviewed } : item))
    setMatchAvailability((current) => [...current.filter((item) => item.match_id !== match.id || item.player_id !== playerId), { match_id: match.id, player_id: playerId, status: 'available', comment: reason || null, updated_at: new Date().toISOString() }])
    if (slotNumber) setMatchLineups((current) => [...current, { match_id: match.id, player_id: playerId, slot_number: slotNumber, sort_order: slotNumber, role: slotNumber <= (match.rugby_format === 'sevens' ? 7 : 15) ? 'starter' : 'substitute', position: null, updated_at: new Date().toISOString() }])
    notify('Jugadora de solo entrenamientos autorizada para este partido en la demo.')
  }
  async function saveLineup(match: Match, entries: Omit<MatchLineup, 'match_id' | 'updated_at'>[], published: boolean) { const reserved = new Set(reservedLineupPlayerIds(match, matches, matchLineups)); if (entries.some((entry) => reserved.has(entry.player_id))) throw new Error('Una jugadora ya está convocada en otro partido del mismo fin de semana o día.'); if (published) { const restriction = crossTeamCallupRestriction(crossTeamCallupReference(match, matches, matchLineups, match.season_competitions?.restrict_cross_team_callups === true), entries.map((entry) => entry.player_id)); if (restriction) throw new Error(restriction) } const blocked = entries.find((entry) => matchLicenseRestriction(match, memberships, entry.player_id)); if (blocked) throw new Error(matchLicenseRestriction(match, memberships, blocked.player_id)!); setMatchLineups((current) => [...current.filter((item) => item.match_id !== match.id), ...entries.map((entry) => ({ ...entry, match_id: match.id, updated_at: new Date().toISOString() }))]); setMatches((current) => current.map((item) => item.id === match.id ? { ...item, lineup_published: published, report_events_reviewed: false } : item)); notify('Convocatoria mock guardada.') }
  async function saveReport(match: Match, values: MatchReportValues) {
    setMatchReportEvents((current) => ({ ...current, [match.id]: structuredClone(values.events) }))
    setMatches((current) => current.map((item) => item.id === match.id ? { ...item, team_score: values.scores.team, opponent_score: values.scores.opponent, duration_minutes: values.duration, report_events_reviewed: item.match_kind === 'official', status: 'completed' as const } : item))
    notify('Resultado y minutos guardados en la demo.')
  }
  async function loadReportEvents(matchId: string) { return structuredClone(matchReportEvents[matchId] ?? []).sort((a, b) => a.event_minute - b.event_minute) }
  async function unlockLineup(match: Match) { setMatches((current) => current.map((item) => item.id === match.id ? { ...item, lineup_published: false } : item)); notify('Convocatoria desbloqueada en la demo.') }
  async function loadTaskRange() { /* All demo tasks already live in memory. */ }
  async function loadMatchMonth() { /* All demo matches already live in memory. */ }

  async function loadCallupReport(seasonId: string): Promise<SeasonCallupReport> {
    const season = seasons.find((item) => item.id === seasonId)!
    const countedMatches = matches.filter((item) => item.season_id === seasonId && item.lineup_published && item.status !== 'cancelled')
    const seasonSessions = sessions.filter((item) => item.season_id === seasonId && item.session_date <= todayIso())
    const participantIds = [...new Set(memberships.filter((item) => item.season_id === seasonId).map((item) => item.player_id))]
    const players = participantIds.map((playerId) => {
      const profile = profiles.find((item) => item.id === playerId)!
      const eligibleSessions = seasonSessions.filter((session) => memberships.some((membership) => membership.season_id === seasonId && membership.player_id === playerId && membershipCoversDate(membership, session.session_date)))
      const attendedSessions = eligibleSessions.filter((session) => attendance.some((record) => record.session_id === session.id && record.player_id === playerId && record.attended)).length
      const eligibleMatches = matches.filter((match) => match.season_id === seasonId && (match.status === 'published' || match.status === 'completed')
        && !matchAvailabilityRestriction(match, match.match_date < todayIso() ? initialMemberships : memberships, playerId)
        && memberships.some((membership) => membership.season_id === seasonId && membership.player_id === playerId && membershipCoversDate(membership, match.match_date)))
      const availabilityReport = seasonAvailabilityReport(eligibleMatches, matchAvailability, playerId, memberships, seasonTeams, matchLineups)
      const playerMatchIds = new Set(matchLineups.filter((entry) => entry.player_id === playerId).map((entry) => entry.match_id))
      return {
        playerId, name: profile.display_name,
        officialCallups: countedMatches.filter((item) => item.match_kind === 'official' && playerMatchIds.has(item.id)).length,
        friendlyCallups: countedMatches.filter((item) => item.match_kind === 'friendly' && playerMatchIds.has(item.id)).length,
        starterCallups: matchLineups.filter((entry) => entry.player_id === playerId && entry.role === 'starter' && countedMatches.some((item) => item.id === entry.match_id)).length,
        substituteCallups: matchLineups.filter((entry) => entry.player_id === playerId && entry.role === 'substitute' && countedMatches.some((item) => item.id === entry.match_id)).length,
        eligibleMatches: availabilityReport.totals.eligibleMatches,
        availabilityResponded: availabilityReport.totals.responded,
        availabilityPercentage: availabilityReport.totals.percentage,
        attendedSessions, eligibleSessions: eligibleSessions.length,
        attendancePercentage: eligibleSessions.length ? Math.round(attendedSessions * 100 / eligibleSessions.length) : null,
      }
    }).sort((first, second) => second.officialCallups - first.officialCallups || second.friendlyCallups - first.friendlyCallups || (second.attendancePercentage ?? -1) - (first.attendancePercentage ?? -1) || first.name.localeCompare(second.name, 'es'))
    return {
      seasonId, seasonName: season.name, generatedOn: todayIso(),
      totals: {
        officialMatches: countedMatches.filter((item) => item.match_kind === 'official').length,
        friendlyMatches: countedMatches.filter((item) => item.match_kind === 'friendly').length,
        trainingSessions: seasonSessions.length,
      },
      players,
    }
  }

  async function loadPlayerSeasonSummary(seasonId: string, playerId: string): Promise<PlayerSeasonSummary> {
    const season = seasons.find((item) => item.id === seasonId)!
    const eligibleMatches = matches.filter((match) => match.season_id === seasonId && match.status !== 'draft' && match.status !== 'cancelled' && !matchAvailabilityRestriction(match, match.match_date < todayIso() ? initialMemberships : memberships, playerId) && memberships.some((membership) => membership.season_id === seasonId && membership.player_id === playerId && membershipCoversDate(membership, match.match_date)))
    const playerLineups = matchLineups.filter((item) => item.player_id === playerId && eligibleMatches.some((match) => match.id === item.match_id && match.lineup_published))
    const availabilityReport = seasonAvailabilityReport(eligibleMatches, matchAvailability, playerId, memberships, seasonTeams, matchLineups)
    const seasonSessions = sessions.filter((session) => session.season_id === seasonId && session.session_date <= todayIso() && memberships.some((membership) => membership.season_id === seasonId && membership.player_id === playerId && membershipCoversDate(membership, session.session_date)))
    const attended = seasonSessions.filter((session) => attendance.some((record) => record.session_id === session.id && record.player_id === playerId && record.attended)).length
    const profile = profiles.find((item) => item.id === playerId)!
    return {
      seasonId, seasonName: season.name, playerId, playerName: profile.display_name, generatedOn: todayIso(),
      callups: {
        official: eligibleMatches.filter((match) => match.match_kind === 'official' && playerLineups.some((entry) => entry.match_id === match.id)).length,
        friendly: eligibleMatches.filter((match) => match.match_kind === 'friendly' && playerLineups.some((entry) => entry.match_id === match.id)).length,
        starter: playerLineups.filter((entry) => entry.role === 'starter').length,
        substitute: playerLineups.filter((entry) => entry.role === 'substitute').length,
      },
      availability: availabilityReport.totals,
      attendance: { attended, eligibleSessions: seasonSessions.length, percentage: seasonSessions.length ? Math.round(attended * 100 / seasonSessions.length) : null },
      matches: availabilityReport.matches.map((match) => {
        const availability = availabilityReport.responses.find((item) => item.match_id === match.id)
        const lineup = playerLineups.find((item) => item.match_id === match.id)
        return { matchId: match.id, date: match.match_date, opponent: match.opponent, kind: match.match_kind, format: match.rugby_format, isHome: match.is_home, availabilityStatus: availability?.status ?? null, calledUp: Boolean(lineup), lineupRole: lineup?.role ?? null, slotNumber: lineup?.slot_number ?? null }
      }).sort((first, second) => second.date.localeCompare(first.date)),
    }
  }

  async function saveDemoPlayerPositions(player: Profile, values: PlayerPositionValues) {
    if (!canEditPositions) throw new Error('No tienes permiso para modificar posiciones.')
    if (!validPlayerPositions(values)) throw new Error('Selecciona posiciones válidas y una principal entre ellas.')
    setProfiles((current) => current.map((person) => person.id === player.id ? { ...person, playing_positions: values.positions, primary_position: values.primaryPosition } : person))
    notify('Posiciones actualizadas en la demo.')
  }

  async function updateProfile(nextProfile: Profile) {
    setProfiles((current) => current.map((item) => item.id === nextProfile.id ? nextProfile : item))
    const activeSeason = seasons.find((season) => season.start_date <= todayIso() && season.end_date >= todayIso())
    const defaultTeam = seasonTeams.find((team) => team.season_id === activeSeason?.id && team.is_default)
    if (isPlayer(nextProfile) && activeSeason && defaultTeam) {
      setMemberships((current) => current.some((item) => item.season_id === activeSeason.id && item.player_id === nextProfile.id && !item.active_until)
        ? current
        : [...current, { id: `demo-membership-${crypto.randomUUID()}`, season_id: activeSeason.id, season_team_id: null, license_type: 'none' as const, player_id: nextProfile.id, active_from: todayIso(), active_until: null, created_at: new Date().toISOString() }])
    }
    if (!isPlayer(nextProfile)) setMemberships((current) => current.filter((item) => item.player_id !== nextProfile.id))
    notify(`Perfil de ${nextProfile.display_name} actualizado.`)
  }

  async function updateProfileDetails(targetProfile: Profile, values: ManagedProfileValues, photoChange?: ProfilePhotoChange) {
    setProfiles((current) => current.map((item) => item.id === targetProfile.id ? {
      ...item,
      display_name: values.displayName,
      is_active: values.isActive,
      is_player: values.isPlayer,
      is_coach: values.isCoach,
      is_viewer: values.isViewer,
      is_owner: values.isOwner,
      avatar_path: photoChange instanceof File ? `${targetProfile.id}/demo-avatar.jpg` : photoChange === null ? null : item.avatar_path,
    } : item))
    setProfilePrivateDetails((current) => {
      const existing = current.find((item) => item.profile_id === targetProfile.id)
      const next = {
        profile_id: targetProfile.id,
        email: existing?.email ?? `${targetProfile.id}@demo.local`,
        phone: values.phone || null,
        birth_date: values.birthDate || null,
      }
      return existing
        ? current.map((item) => item.profile_id === targetProfile.id ? next : item)
        : [...current, next]
    })
    notify(`Datos de ${values.displayName} actualizados en la demo.`)
  }

  async function updateProfilePhoto(targetProfile: Profile, change: File | null) {
    const path = change ? `${targetProfile.id}/demo-avatar-${Date.now()}.jpg` : null
    if (change && path) {
      const imageUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('No se ha podido leer la fotografía.'))
        reader.onerror = () => reject(new Error('No se ha podido leer la fotografía.'))
        reader.readAsDataURL(change)
      })
      setDemoPhotos((current) => ({ ...current, [path]: imageUrl }))
    }
    setProfiles((current) => current.map((item) => item.id === targetProfile.id
      ? { ...item, avatar_path: path }
      : item))
    notify(`Foto de ${targetProfile.display_name} actualizada en la demo.`)
  }

  async function updateOwnProfileDetails(values: ProfileDetailsValues) {
    setProfiles((current) => current.map((item) => item.id === userId ? {
      ...item,
      display_name: values.displayName,
    } : item))
    setProfilePrivateDetails((current) => current.map((item) => item.profile_id === userId ? {
      ...item,
      phone: values.phone || null,
      birth_date: values.birthDate || null,
    } : item))
    notify('Tus datos de perfil se han actualizado en la demo.')
  }

  async function saveDemoPlayerAbsence(player: Profile, values: PlayerAbsenceValues, absenceId?: string) {
    const candidateUntil = values.endsOn ? addDays(values.endsOn, 1) : '9999-12-31'
    if (playerAbsences.some((absence) => absence.player_id === player.id && absence.id !== absenceId
      && absence.starts_on < candidateUntil
      && values.startsOn < (absence.discharged_on ?? (absence.ends_on ? addDays(absence.ends_on, 1) : '9999-12-31')))) {
      throw new Error('La baja se solapa con otra baja ya registrada para esta jugadora.')
    }
    const now = new Date().toISOString()
    const previous = playerAbsences.find((absence) => absence.id === absenceId)
    const absence: PlayerAbsence = {
      id: previous?.id ?? `demo-absence-${Date.now()}`, player_id: player.id, starts_on: values.startsOn, ends_on: values.endsOn || null,
      discharged_on: previous?.discharged_on ?? null, created_by: previous?.created_by ?? userId,
      created_at: previous?.created_at ?? now, updated_at: now,
    }
    setPlayerAbsences((current) => [absence, ...current.filter((item) => item.id !== absence.id)])
    setPlayerAbsenceNotes((current) => {
      const remaining = current.filter((item) => item.absence_id !== absence.id)
      return values.privateNote.trim() ? [...remaining, { absence_id: absence.id, note: values.privateNote.trim(), updated_at: now, updated_by: userId }] : remaining
    })
    notify(previous ? 'Baja actualizada en la demo.' : 'Baja guardada en la demo.')
  }

  async function dischargeDemoPlayerAbsence(absenceId: string) {
    const today = todayIso()
    const absence = playerAbsences.find((item) => item.id === absenceId)
    if (!absence || absence.starts_on > today || (absence.ends_on && absence.ends_on < today)
      || (absence.discharged_on && absence.discharged_on <= today)) {
      throw new Error('La baja no está vigente o ya tiene el alta registrada.')
    }
    setPlayerAbsences((current) => current.map((item) => item.id === absenceId ? { ...item, discharged_on: today, updated_at: new Date().toISOString() } : item))
    notify('Alta deportiva registrada desde hoy en la demo.')
  }

  async function deleteDemoPlayerAbsence(absenceId: string) {
    setPlayerAbsences((current) => current.filter((absence) => absence.id !== absenceId))
    setPlayerAbsenceNotes((current) => current.filter((item) => item.absence_id !== absenceId))
    notify('Baja eliminada en la demo.')
  }

  async function archiveProfile(targetProfile: Profile) {
    await updateProfile({ ...targetProfile, is_approved: false, is_active: false, is_archived: true })
  }

  async function loadCalendarTrainings(from: string, until: string): Promise<TrainingPlanCalendarItem[]> {
    return trainingPlans.filter((plan) => plan.session_date >= from && plan.session_date <= until
      && (canManage || memberships.some((membership) => membership.player_id === userId && membership.season_id === plan.season_id && membershipCoversDate(membership, plan.session_date))))
      .map((plan) => {
        const response = trainingResponses[`${plan.id}:${userId}`]
        const current = response?.version === (plan.schedule_version ?? 1)
        return { id: plan.id, session_date: plan.session_date, title: plan.title, status: plan.status,
          start_time: plan.start_time, end_time: plan.end_time, schedule_version: plan.schedule_version, self_managed: plan.self_managed,
          own_attending: current ? response.attending : null, own_comment: current ? response.comment : null,
          attending_count: plan.status === 'cancelled' || seasonHolidays.includes(plan.session_date) ? 0 : Object.entries(trainingResponses).filter(([key, entry]) => {
            if (!key.startsWith(`${plan.id}:`) || !entry.attending || entry.version !== (plan.schedule_version ?? 1)) return false
            const playerId = key.slice(plan.id.length + 1)
            return profiles.some((player) => player.id === playerId && isActivePlayer(player))
              && memberships.some((membership) => membership.player_id === playerId && membership.season_id === plan.season_id && membershipCoversDate(membership, plan.session_date))
          }).length,
          response_stale: Boolean(response && !current),
          attendance_recorded: sessions.some((session) => session.session_date === plan.session_date),
          responses_closed: trainingResponseClosed(plan) || seasonHolidays.includes(plan.session_date) || sessions.some((session) => session.session_date === plan.session_date) }
      })
  }
  async function loadTrainingAttendees(trainingPlanId: string): Promise<string[]> {
    const plan = trainingPlans.find((item) => item.id === trainingPlanId)
    if (!plan || plan.status === 'cancelled' || seasonHolidays.includes(plan.session_date)) return []
    return Object.entries(trainingResponses).flatMap(([key, response]) => {
      if (!key.startsWith(`${plan.id}:`) || !response.attending || response.version !== (plan.schedule_version ?? 1)) return []
      const playerId = key.slice(plan.id.length + 1)
      const player = profiles.find((item) => item.id === playerId && isActivePlayer(item))
      const belongsToSeason = memberships.some((membership) => membership.player_id === playerId
        && membership.season_id === plan.season_id && membershipCoversDate(membership, plan.session_date))
      return player && belongsToSeason ? [player.display_name] : []
    }).sort((a, b) => a.localeCompare(b, 'es'))
  }
  const respondTraining: SaveTrainingResponse = async (plan, attending, comment) => {
    const current = (await loadCalendarTrainings(plan.session_date, plan.session_date)).find((item) => item.id === plan.id)
    if (!current || trainingResponseClosed(current) || current.schedule_version !== plan.schedule_version) throw new Error('La respuesta a este entrenamiento ya está cerrada o ha cambiado de fecha.')
    setTrainingResponses((responses) => ({ ...responses, [`${plan.id}:${userId}`]: { attending, comment, version: plan.schedule_version ?? 1 } }))
  }
  async function generateTrainings(apply: boolean) {
    const season = seasonForDate(seasons, todayIso())
    if (!season) throw new Error('No hay temporada activa para generar entrenamientos.')
    const days = trainingGenerationPreview(season, trainingPlans, seasonHolidays).map((day) => sessions.some((session) => session.session_date === day.session_date) && day.result === 'new' ? { ...day, result: 'recorded' } : day)
    if (!apply) return days
    const created = days.filter((day) => day.result === 'new').map((day) => demoPlanFromValues({ seasonId: season.id, sessionDate: day.session_date, title: day.title, objectives: '', material: '', status: 'draft', exercises: [] }, seasons))
    setTrainingPlans((plans) => [...plans, ...created])
    return days.map((day) => day.result === 'new' ? { ...day, result: 'created' } : day)
  }
  async function loadTrainingBasis(date: string): Promise<TrainingAttendanceBasis> {
    const plan = trainingPlans.find((item) => item.session_date === date && item.status !== 'cancelled')
    return { self_managed: Boolean(trainingPlans.some((item) => item.session_date === date && item.self_managed) || sessions.some((session) => session.session_date === date && session.self_managed)), recorded: sessions.some((session) => session.session_date === date), attended_player_ids: attendance.filter((record) => record.training_sessions?.session_date === date && record.attended).map((record) => record.player_id),
      responses: !plan || seasonHolidays.includes(date) ? [] : Object.entries(trainingResponses).flatMap(([key, response]) => key.startsWith(`${plan.id}:`) && response.version === (plan.schedule_version ?? 1) ? [{ player_id: key.slice(plan.id.length + 1), attending: response.attending, comment: response.comment }] : []) }
  }

  async function saveAttendance(date: string, playerIds: string[], attendedPlayerIds: string[], guests: ProvisionalAttendanceEntry[]) {
    const existing = sessions.find((item) => item.session_date === date)
    if (!existing && trainingPlans.some((plan) => plan.session_date === date && plan.self_managed)) throw new Error('Espera al registro automático del viernes antes de corregir la asistencia.')
    const sessionId = existing?.id ?? `demo-session-${Date.now()}`
    if (!existing) {
      setSessions((current) => [{ id: sessionId, session_date: date, season_id: seasonForDate(seasons, date)?.id ?? null, updated_at: new Date().toISOString(), created_by: userId, created_at: new Date().toISOString() }, ...current])
    }
    const nextRecords = playerIds.map((playerId) => ({
      session_id: sessionId,
      player_id: playerId,
      attended: attendedPlayerIds.includes(playerId),
      marked_by: userId,
      updated_at: new Date().toISOString(),
      training_sessions: { session_date: date },
    }))
    setAttendance((current) => [
      ...current.filter((record) => record.training_sessions?.session_date !== date),
      ...nextRecords,
    ])
    const resolvedGuests: ProvisionalPlayer[] = guests.map((guest, index) => {
      const existingGuest = guest.id ? provisionalPlayers.find((item) => item.id === guest.id) : undefined
      return existingGuest ?? {
        id: `demo-guest-${Date.now()}-${index}`,
        display_name: guest.displayName,
        linked_profile_id: null,
        linked_by: null,
        linked_at: null,
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    })
    setProvisionalPlayers((current) => [...current, ...resolvedGuests.filter((guest) => !current.some((item) => item.id === guest.id))])
    setProvisionalAttendance((current) => [
      ...current.filter((record) => record.training_sessions?.session_date !== date),
      ...resolvedGuests.map((guest) => ({
        session_id: sessionId,
        provisional_player_id: guest.id,
        marked_by: userId,
        updated_at: new Date().toISOString(),
        training_sessions: { session_date: date },
      })),
    ])
    notify('Asistencia mock guardada.')
  }

  async function linkDemoProvisionalPlayers(guests: ProvisionalPlayer[], targetProfile: Profile) {
    const guestIds = new Set(guests.map((guest) => guest.id))
    const guestRecords = provisionalAttendance.filter((record) => guestIds.has(record.provisional_player_id))
    setAttendance((current) => {
      const migrated = guestRecords.map((record) => ({
        session_id: record.session_id,
        player_id: targetProfile.id,
        attended: true,
        marked_by: userId,
        updated_at: new Date().toISOString(),
        training_sessions: record.training_sessions,
      }))
      const keys = new Set(migrated.map((record) => `${record.session_id}:${record.player_id}`))
      return [...current.filter((record) => !keys.has(`${record.session_id}:${record.player_id}`)), ...migrated]
    })
    const dates = guestRecords.flatMap((record) => record.training_sessions?.session_date ? [record.training_sessions.session_date] : []).sort()
    if (dates.length) {
      setMemberships((current) => {
        const open = current.find((item) => item.player_id === targetProfile.id && item.season_id === 'season-current' && !item.active_until)
        return open
          ? current.map((item) => item === open ? { ...item, active_from: item.active_from < dates[0] ? item.active_from : dates[0] } : item)
          : [...current, { id: `demo-membership-${Date.now()}`, season_id: 'season-current', season_team_id: null, license_type: 'none' as const, player_id: targetProfile.id, active_from: dates[0], active_until: null, created_at: new Date().toISOString() }]
      })
    }
    setProvisionalAttendance((current) => current.filter((record) => !guestIds.has(record.provisional_player_id)))
    setProvisionalPlayers((current) => current.filter((item) => !guestIds.has(item.id)))
    notify(`${guests.length === 1 ? 'La invitada seleccionada se ha vinculado' : `${guests.length} invitadas se han vinculado`} con ${targetProfile.display_name}.`)
  }

  async function saveDemoPlayerLicense(season: Season, player: Profile, license: PlayerLicenseType) {
    if (!profile.is_owner) throw new Error('Solo el owner puede gestionar fichas.')
    setMemberships((current) => current.map((item) => item.season_id === season.id && item.player_id === player.id
      ? { ...item, license_type: license, season_team_id: !item.active_until && !licenseAllowsTeam(license) ? null : item.season_team_id } : item))
    notify('Ficha actualizada. Revisa las convocatorias oficiales futuras de la jugadora.')
  }

  async function assignDemoSeasonPlayerTeam(season: Season, player: Profile, teamId: string) {
    const team = seasonTeams.find((item) => item.id === teamId && item.season_id === season.id && item.is_active)
    if (!team) throw new Error('El equipo seleccionado no está disponible.')
    const membership = memberships.find((item) => item.season_id === season.id && item.player_id === player.id && !item.active_until)
    if (membership && !licenseAllowsTeam(membershipLicense(membership))) throw new Error('Asigna primero una ficha Regional o Nacional desde Datos de perfil.')
    const hasMembership = memberships.some((item) => item.season_id === season.id && item.player_id === player.id && !item.active_until)
    const awaitingApproval = !player.is_approved && season.start_date <= todayIso() && season.end_date >= todayIso()
    if (!hasMembership && !awaitingApproval) throw new Error('La jugadora no pertenece actualmente a esta temporada.')
    setMemberships((current) => current.map((item) => item.season_id === season.id && item.player_id === player.id && !item.active_until ? { ...item, season_team_id: teamId } : item))
    notify(`${player.display_name} asignada a ${team.name} en la demo.`)
  }

  async function toggleMembership(season: Season, player: Profile, active: boolean) {
    setMemberships((current) => {
      const existing = current.find((item) => item.season_id === season.id && item.player_id === player.id && !item.active_until)
      if (!active) return current.map((item) => item === existing ? { ...item, active_until: todayIso() } : item)
      return existing ? current : [...current, { id: `demo-membership-${Date.now()}`, season_id: season.id, season_team_id: null, license_type: 'none' as const, player_id: player.id, active_from: todayIso(), active_until: null, created_at: new Date().toISOString() }]
    })
    notify('Participación actualizada en la demo.')
  }

  async function saveLibraryFolder(folderUrl: string) {
    const match = folderUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/)
    const rootFolderId = match?.[1] ?? folderUrl.trim()
    setLibrarySettings({
      id: true, root_folder_id: rootFolderId, root_folder_url: folderUrl.trim(), root_resource_key: null,
      sync_status: 'idle', sync_error: null, item_count: 0, last_synced_at: null,
      updated_at: new Date().toISOString(), updated_by: userId,
    })
    setLibraryItems([])
    notify('Carpeta de librería guardada en la demo.')
  }

  async function syncLibraryDemo() {
    if (!librarySettings?.root_folder_id) throw new Error('Configura primero una carpeta de Drive.')
    const syncedAt = new Date().toISOString()
    setLibraryItems([
      { drive_file_id: 'demo-library-folder', parent_drive_id: librarySettings.root_folder_id, name: 'Documentos del equipo', mime_type: 'application/vnd.google-apps.folder', size_bytes: null, modified_at: syncedAt, web_view_link: librarySettings.root_folder_url, web_content_link: null, resource_key: null, is_folder: true, synced_at: syncedAt },
      { drive_file_id: 'demo-library-file', parent_drive_id: 'demo-library-folder', name: 'Guía del equipo.pdf', mime_type: 'application/pdf', size_bytes: 24576, modified_at: syncedAt, web_view_link: librarySettings.root_folder_url, web_content_link: librarySettings.root_folder_url, resource_key: null, is_folder: false, synced_at: syncedAt },
    ])
    setLibrarySettings((current) => current ? { ...current, sync_status: 'succeeded', sync_error: null, item_count: 2, last_synced_at: syncedAt, updated_at: syncedAt } : current)
    notify('Librería sincronizada en la demo.')
  }

  return (
    <AppLayout
    licenseSummary={profile.is_player ? memberships.filter((item) => item.player_id === profile.id && !item.active_until && seasons.some((season) => season.id === item.season_id && season.start_date <= todayIso() && season.end_date >= todayIso())).map((item) => licenseLabel(membershipLicense(item))).join(', ') || undefined : undefined}
      email={`${role}@demo.local`}
      errorMessage=""
      permissionKeys={groupPermissionKeys}
      notifications={groupNotifications}
      notificationReadIds={readGroupNotificationIds}
      notificationUnreadCount={groupNotifications.length}
      onNotificationOpen={(notification) => navigate(notification.view)}
      onNotificationRead={(notification) => setReadGroupNotificationIds((current) => new Set(current).add(notification.id))}
      onNotificationsReadAll={() => setReadGroupNotificationIds((current) => new Set([...current, ...groupNotifications.map((item) => item.id)]))}
      message={message}
      profile={profile}
      profileDetails={profilePrivateDetails.find((item) => item.profile_id === userId)}
      view={view}
      settingsSection={settingsSection}
      onLoadProfilePhoto={async (path) => demoPhotos[path] ?? DEMO_PROFILE_PHOTO}
      onNavigate={navigate}
      onSignOut={() => notify('La demo no tiene una sesión real que cerrar.')}
      onUpdateProfileDetails={updateOwnProfileDetails}
    >
      <div className="demo-toolbar">
        <div><strong>DEMO LOCAL</strong><span>Los cambios solo viven en memoria y se reinician al recargar.</span></div>
        <div className="demo-toolbar-actions"><button className="secondary-button compact" onClick={() => setSurveyPreviewOpen(true)} type="button">Vista encuesta</button><label>
          Ver como
          <select value={role} onChange={(event) => changeRole(event.target.value as DemoRole)}>
            <option value="owner">Owner</option>
            <option value="coach">Entrenador</option>
            <option value="viewer">Dirección</option>
            <option value="player">Jugadora</option>
          </select>
        </label></div>
      </div>
      {view === 'groups' && <GroupsHub onNavigate={navigate} training={canViewTrainingGroups} work={canViewWorkGroups} video={canViewVideoAnalysis} />}
      {(view === 'work-groups' || view === 'video-analysis') && <DemoWorkGroupsView stores={workStores} profiles={profiles} memberships={rawMemberships} seasons={seasons} userId={userId} canManage={profile.is_owner} mode={view === 'video-analysis' ? 'video' : 'work'} onBack={profile.is_owner ? () => navigate('groups') : undefined} />}
      {view === 'training-groups' && <><p className="training-group-message">Demo: plantilla ampliada de A, B, mixto y Solo entrenamientos para probar el reparto. Los cambios se conservan al cambiar de rol y se reinician al recargar.</p><TrainingGroupsView api={groupApi} seasons={seasons} userId={userId} canManage={canManageGroups} canPublish={canPublishGroups} onChanged={() => refreshGroupNotifications((value) => value + 1)} /></>}
      {view === 'home' && (
        <Dashboard profile={profile} profiles={profiles} memberships={memberships} tasks={tasks} announcements={announcements} matches={matches} results={canViewTeam ? results : personalResults} attendance={attendance} trainingSessions={sessions} season={seasons.find((season) => season.start_date <= todayIso() && season.end_date >= todayIso())} userId={userId} onGoToTasks={canAccessTasks(profile) ? () => navigate('calendar') : undefined} onOpenMatch={(match) => { setFocusedDate(match.match_date); setView(isPlayer(profile) || canManage ? 'calendar' : 'matches') }} onOpenAnnouncement={(announcement) => { setFocusedDate(announcement.announcement_date); setFocusedAnnouncementId(announcement.id); setView(isPlayer(profile) || canManage ? 'calendar' : 'home') }} onLoadSeasonSummary={isPlayer(profile) ? loadPlayerSeasonSummary : undefined} onSaveResult={saveResult} />
      )}
      {view === 'statistics' && canViewTeam && (
        <StatisticsView profiles={profiles} provisionalAttendance={provisionalAttendance} provisionalPlayers={provisionalPlayers} seasons={seasons} sessions={sessions} attendance={attendance} memberships={memberships} tasks={tasks} results={results} holidays={seasonHolidays} />
      )}
      {view === 'attendance' && canManage && (
        <AttendanceView profiles={profiles} provisionalAttendance={provisionalAttendance} provisionalPlayers={provisionalPlayers} seasons={seasons} sessions={sessions} attendance={attendance} memberships={memberships} onLoadBasis={loadTrainingBasis} onSave={saveAttendance} />
      )}
      {view === 'calendar' && canManage && (
        <CalendarView
          onSavePlayerPositions={canEditPositions ? saveDemoPlayerPositions : undefined}
          demo
          demoCoaches={seasonTeamCoaches}
          isOwner={profile.is_owner}
          onLoadGraphicPhoto={async () => DEMO_PROFILE_PHOTO}
          announcements={announcements}
          availability={matchAvailability}
          birthdays={ownerBirthdays}
          holidays={seasonHolidays}
          focusedAnnouncementId={focusedAnnouncementId}
          focusedDate={focusedDate}
          lineups={matchLineups}
          matches={matches}
          memberships={memberships}
          profiles={profiles}
          results={results}
          seasons={seasons}
          seasonCompetitions={seasonCompetitions}
          seasonTeams={seasonTeams}
          tasks={tasks}
          onAnnouncementStatusChange={updateAnnouncementStatus}
          onCreateTask={createTask}
          onDeleteAnnouncement={deleteAnnouncement}
          onDeleteMatch={removeMatch}
          onDeleteTask={deleteTask}
          onLoadCallupReport={loadCallupReport}
          onLoadMatchMonth={loadMatchMonth}
          onLoadPlayerSeasonSummary={loadPlayerSeasonSummary}
          onLoadTrainingPlans={loadCalendarTrainings}
          onLoadTrainingAttendees={hasPermission(profile, PERMISSIONS.training.view, groupPermissionKeys) ? loadTrainingAttendees : undefined}
          onLoadSurveyClosures={async (from, until) => demoCalendarSurveys(demoSurveyClosures, from, until)}
          onOpenSurveyResults={setSurveyResultId}
          onLoadTaskRange={loadTaskRange}
          onOpenTrainingPlan={() => navigate('training')}
          onEditTrainingPlan={() => navigate('training')}
          onReorderTasks={reorderTasks}
          onSaveAnnouncement={saveAnnouncement}
          onSaveLineup={saveLineup}
          onSaveReport={saveReport} onLoadReportEvents={loadReportEvents}
          onSaveMatch={saveMatch}
          onAddTrainingPlayer={canManageTrainingExceptions(profile) ? addTrainingPlayer : undefined} onSavePlayerAvailability={savePlayerAvailability}
          onTaskStatusChange={updateStatus}
          onUnlockLineup={unlockLineup}
          onUpdateTask={updateTask}
        />
      )}
      {view === 'calendar' && !canManage && isPlayer(profile) && (
        <PlayerCalendarView
          demo
          demoCoaches={seasonTeamCoaches}
          announcements={announcements}
          availability={matchAvailability}
          birthdays={calendarBirthdays}
          holidays={seasonHolidays}
          focusedAnnouncementId={focusedAnnouncementId}
          focusedDate={focusedDate}
          lineups={matchLineups}
          matches={matches}
          memberships={memberships}
          profiles={profiles}
          results={personalResults}
          tasks={tasks}
          userId={userId}
          onLoadTrainingPlans={loadCalendarTrainings}
          onRespondTraining={respondTraining}
          onLoadMatchMonth={loadMatchMonth}
          onLoadTaskRange={loadTaskRange}
          onLoadSurveyClosures={async (from, until) => demoCalendarSurveys(demoSurveyClosures, from, until)}
          onOpenSurveyResults={setSurveyResultId}
          initialSurveys={demoSurveyResponses}
          initialOwnSurveyResponses={demoOwnSurveyResponses}
          onSubmitSurveyResponse={submitDemoSurveyResponse}
          onSaveAvailability={saveAvailability}
          onSaveResult={saveResult}
        />
      )}
      {view === 'training' && canManage && (
        <Suspense fallback={<div className="page"><p>Cargando entrenamientos…</p></div>}>
          <TrainingPlansView demo demoPlans={trainingPlans} onDemoPlansChange={setTrainingPlans} onGenerateTrainings={generateTrainings} seasons={seasons} userId={userId} onNotify={notify} />
        </Suspense>
      )}
      {view === 'tasks' && canAccessTasks(profile) && (
        <TasksView canManage={canManage} seasons={seasons} memberships={memberships} profiles={profiles} tasks={tasks} announcements={announcements} results={personalResults} teamResults={canManage ? results : undefined} userId={userId} focusedDate={focusedDate} focusedAnnouncementId={focusedAnnouncementId} holidays={seasonHolidays} onCreate={createTask} onDelete={deleteTask} onUpdate={updateTask} onSaveResult={saveResult} onStatusChange={updateStatus} onSaveAnnouncement={saveAnnouncement} onDeleteAnnouncement={deleteAnnouncement} onAnnouncementStatusChange={updateAnnouncementStatus} />
      )}
      {view === 'matches' && <><MatchesView onSavePlayerPositions={canEditPositions ? saveDemoPlayerPositions : undefined} demo demoCoaches={seasonTeamCoaches} isOwner={profile.is_owner} onLoadGraphicPhoto={async () => DEMO_PROFILE_PHOTO} availability={matchAvailability} canManage={canManage} canEditPlayerAvailability={canManage} canViewAvailability={canViewTeam} canViewReport={canViewTeam} focusedDate={focusedDate} isPlayer={isPlayer(profile)} lineups={matchLineups} matches={matches} memberships={memberships} profiles={profiles} seasons={seasons} seasonTeams={seasonTeams} seasonCompetitions={seasonCompetitions} userId={userId} holidays={seasonHolidays} onDelete={removeMatch} onLoadCallupReport={loadCallupReport} onLoadPlayerSeasonSummary={loadPlayerSeasonSummary} onSaveAvailability={saveAvailability} onAddTrainingPlayer={canManageTrainingExceptions(profile) ? addTrainingPlayer : undefined} onSavePlayerAvailability={savePlayerAvailability} onSaveLineup={saveLineup} onSaveReport={saveReport} onLoadReportEvents={loadReportEvents} onSaveMatch={saveMatch} />{canManage && <><DemoInternalMatchScenario isOwner={profile.is_owner} /><DemoTrainingExceptionScenario isOwner={profile.is_owner} /><DemoCrossTeamCallupScenario /></>}</>}
      {view === 'competition' && <CompetitionView fixtures={competitionFixtures} isOwner={profile.is_owner} playerStats={competitionPlayerStats} seasons={competitionSeasons} standings={competitionStandings} />}
      {view === 'library' && <LibraryView items={libraryItems} />}
      {view === 'surveys' && (profile.is_owner || profile.is_coach || profile.is_viewer) && <SurveysView demo initialSurveyId={surveyResultId} isOwner={profile.is_owner} key={surveyResultId ?? 'surveys'} seasons={seasons} />}
      {surveyResultId && <SurveyCalendarResultsDialog onClose={() => setSurveyResultId(undefined)} onLoad={loadDemoSurveyResults} surveyId={surveyResultId} title={demoSurveyClosures.find((survey) => survey.id === surveyResultId)?.title} />}
      {surveyPreviewOpen && <SurveyResponseDialog initialSurvey={demoSurveyResponses['team-availability']} onClose={() => setSurveyPreviewOpen(false)} onDone={async () => { setSurveyPreviewOpen(false) }} onSubmitResponse={submitDemoSurveyResponse} surveyId="team-availability" />}
      {view === 'settings' && profile.is_owner && <SettingsView onSavePlayerPositions={saveDemoPlayerPositions} key={settingsSection ?? 'team'} currentUserId={userId} holidays={seasonHolidays.map((holiday_date) => ({ season_id: seasons[0]?.id ?? '', holiday_date }))} librarySettings={librarySettings} memberships={memberships} permissionDefinitions={DEMO_PERMISSION_DEFINITIONS} profiles={profiles} profilePrivateDetails={profilePrivateDetails} playerAbsences={playerAbsences} playerAbsencePrivateNotes={playerAbsenceNotes} provisionalAttendance={provisionalAttendance} provisionalPlayers={provisionalPlayers} rolePermissions={rolePermissions} seasons={seasons} seasonCompetitions={seasonCompetitionsWithCounts} seasonTeams={seasonTeams} seasonTeamCoaches={seasonTeamCoaches} section={settingsSection} onArchiveProfile={archiveProfile} onSavePlayerLicense={saveDemoPlayerLicense} onAssignSeasonPlayerTeam={assignDemoSeasonPlayerTeam} onAssignSeasonTeamCoach={assignDemoSeasonTeamCoaches} onCreateSeasonTeam={createDemoSeasonTeam} onUpdateSeasonTeam={updateDemoSeasonTeam} onDeleteSeasonTeam={deleteDemoSeasonTeam} onCreateSeason={createSeason} onCreateSeasonCompetition={createSeasonCompetition} onDeletePlayerAbsence={deleteDemoPlayerAbsence} onDischargePlayerAbsence={dischargeDemoPlayerAbsence} onDeleteSeason={deleteSeason} onDeleteSeasonCompetition={deleteSeasonCompetition} onLinkProvisionalPlayers={linkDemoProvisionalPlayers} onLoadProfilePhoto={async (path) => demoPhotos[path] ?? DEMO_PROFILE_PHOTO} onResetRolePermissions={resetRolePermissions} onSavePlayerAbsence={saveDemoPlayerAbsence} onSaveHolidays={async (_seasonId, dates) => { setSeasonHolidays(dates); notify('Festivos guardados en la demo.') }} onSaveLibraryFolder={saveLibraryFolder} onSaveRolePermissions={saveRolePermissions} onSetDefaultSeasonCompetition={setDefaultSeasonCompetition} onSyncLibrary={syncLibraryDemo} onToggleMembership={toggleMembership} onUpdateProfile={updateProfile} onUpdateProfileDetails={updateProfileDetails} onUpdateProfilePhoto={updateProfilePhoto} onUpdateSeason={updateSeason} onUpdateSeasonCompetition={updateSeasonCompetition} />}
    </AppLayout>
  )
}

function roleLabel(role: DemoRole) {
  if (role === 'owner') return 'owner'
  if (role === 'coach') return 'entrenador'
  if (role === 'viewer') return 'dirección'
  return 'jugadora'
}

function buildDemoCalendarBirthdays(
  profiles: Profile[],
  details: Array<{ profile_id: string; birth_date: string | null }>,
  memberships: Array<{ season_id: string; player_id: string; active_from: string; active_until: string | null }>,
  seasons: Season[],
): CalendarBirthday[] {
  const today = todayIso()
  const season = seasons.find((item) => item.start_date <= today && item.end_date >= today)
  if (!season) return []
  const year = today.slice(0, 4)
  return profiles.flatMap((profile) => {
    const birthDate = details.find((item) => item.profile_id === profile.id)?.birth_date
    const membership = memberships.find((item) => item.season_id === season.id && item.player_id === profile.id)
    if (!birthDate || !membership || !profile.is_player || !profile.is_approved || !profile.is_active || profile.is_archived) return []
    const birthdayOn = `${year}-${birthDate.slice(5)}`
    if (birthdayOn < season.start_date || birthdayOn > season.end_date || birthdayOn < membership.active_from || (membership.active_until && birthdayOn > membership.active_until)) return []
    return [{ season_id: season.id, player_id: profile.id, display_name: profile.display_name, birthday_on: birthdayOn }]
  })
}

function buildDemoOwnerBirthdays(
  birthdays: CalendarBirthday[],
  details: Array<{ profile_id: string; birth_date: string | null }>,
): SeasonBirthday[] {
  return birthdays.flatMap((birthday) => {
    const birthDate = details.find((item) => item.profile_id === birthday.player_id)?.birth_date
    if (!birthDate) return []
    return [{ ...birthday, age_turning: Number(birthday.birthday_on.slice(0, 4)) - Number(birthDate.slice(0, 4)) }]
  })
}

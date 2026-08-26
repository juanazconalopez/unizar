import { lazy, Suspense, useEffect, useState } from 'react'
import { AppLayout } from './components/layout/AppLayout'
import { Icon } from './components/Icon'
import { SectionError, SectionLoading, ViewErrorBoundary } from './components/AsyncViewState'
import { DataLoadErrorScreen, DisabledScreen, LoadingScreen, LoginScreen, PendingScreen } from './features/auth/AuthScreens'
import { Dashboard } from './features/dashboard/Dashboard'
import { useAuth } from './hooks/useAuth'
import { useCompetitionData } from './hooks/useCompetitionData'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { useNotifications } from './hooks/useNotifications'
import { useTrainingData } from './hooks/useTrainingData'
import { errorText } from './lib/errors'
import { todayIso } from './lib/dates'
import { activeMembershipFor, membershipCoversDate } from './lib/selectors'
import { navigationFromLocation, urlForNavigation } from './lib/navigation'
import { canAccessTasks, canManageSport, canViewTeamData, isPlayer } from './lib/permissions'
import type { NavigationTarget } from './lib/navigation'
import {
  createSeason,
  deleteSeason,
  saveTrainingAttendance,
  setSeasonMembership,
  updateSeason,
  updateProfilePermissions,
  updateOwnDisplayName,
} from './services/trainingService'
import { createTrainingTask, deleteTrainingTask, reorderTrainingTasks, saveTaskResult, updateTrainingTask, updateTaskStatus } from './services/tasksService'
import { createMatch, deleteMatch, fetchPlayerSeasonSummary, fetchSeasonCallupReport, saveMatchAvailability, saveMatchLineup, setPlayerMatchAvailability, unlockMatchLineup, updateMatch } from './services/matchesService'
import { createTeamAnnouncement, deleteTeamAnnouncement, updateTeamAnnouncement, updateTeamAnnouncementStatus } from './services/announcementsService'
import type {
  AnnouncementValues,
  Profile,
  AvailabilityStatus,
  Match,
  MatchLineup,
  MatchValues,
  ResultValues,
  Season,
  SeasonPlayer,
  SeasonValues,
  TaskStatus,
  TaskValues,
  TeamAnnouncement,
  TrainingTask,
  ViewName,
} from './types'
import './App.css'

const loadAttendanceView = () => import('./features/attendance/AttendanceView')
const loadSettingsView = () => import('./features/settings/SettingsView')
const loadStatisticsView = () => import('./features/statistics/StatisticsView')
const loadTasksView = () => import('./features/tasks/TasksView')
const loadMatchesView = () => import('./features/matches/MatchesView')
const loadCompetitionView = () => import('./features/competition/CompetitionView')

const AttendanceView = lazy(() => loadAttendanceView().then((module) => ({ default: module.AttendanceView })))
const SettingsView = lazy(() => loadSettingsView().then((module) => ({ default: module.SettingsView })))
const StatisticsView = lazy(() => loadStatisticsView().then((module) => ({ default: module.StatisticsView })))
const TasksView = lazy(() => loadTasksView().then((module) => ({ default: module.TasksView })))
const MatchesView = lazy(() => loadMatchesView().then((module) => ({ default: module.MatchesView })))
const CompetitionView = lazy(() => loadCompetitionView().then((module) => ({ default: module.CompetitionView })))

function preloadView(view: ViewName) {
  if (view === 'tasks') void loadTasksView()
  if (view === 'matches') void loadMatchesView()
  if (view === 'competition') void loadCompetitionView()
  if (view === 'statistics') void loadStatisticsView()
  if (view === 'attendance') void loadAttendanceView()
  if (view === 'settings') void loadSettingsView()
}

function App() {
  const [navigation, setNavigation] = useState<NavigationTarget>(() => navigationFromLocation())
  const view = navigation.view
  const [message, setMessage] = useState('')
  const [operationError, setOperationError] = useState('')
  const auth = useAuth()
  const online = useOnlineStatus()
  const data = useTrainingData(auth.session, view)
  const notifications = useNotifications(data.profile, auth.session?.user.id)
  const competition = useCompetitionData(view === 'competition' && Boolean(auth.session), Boolean(data.profile?.is_owner))

  async function reloadData() {
    await Promise.all([data.reload(), notifications.reload()])
  }

  function requireConnection() {
    if (navigator.onLine) return
    const error = new Error('Sin conexión. Recupera Internet antes de guardar cambios.')
    setOperationError(error.message)
    throw error
  }

  function navigate(next: ViewName | NavigationTarget, replace = false) {
    const target = typeof next === 'string' ? { view: next } : next
    preloadView(target.view)
    setOperationError('')
    window.history[replace ? 'replaceState' : 'pushState'](target, '', urlForNavigation(target))
    setNavigation(target)
  }

  useEffect(() => {
    function restoreNavigation() {
      const target = navigationFromLocation()
      preloadView(target.view)
      setNavigation(target)
    }
    window.addEventListener('popstate', restoreNavigation)
    return () => window.removeEventListener('popstate', restoreNavigation)
  }, [])

  useEffect(() => {
    if (!data.profile || canAccessView(data.profile, view)) return
    const timer = window.setTimeout(() => {
      const target: NavigationTarget = { view: 'home' }
      window.history.replaceState(target, '', urlForNavigation(target))
      setNavigation(target)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [data.profile, view])

  function notify(text: string) {
    setMessage(text)
    setOperationError('')
    window.setTimeout(() => setMessage(''), 3500)
  }

  async function handleSaveResult(task: TrainingTask, values: ResultValues) {
    requireConnection()
    if (!auth.session?.user) return
    const exists = data.results.some(
      (result) => result.task_id === task.id && result.player_id === auth.session?.user.id,
    )
    await saveTaskResult(task, values, auth.session.user.id, exists)
    notify(exists ? 'Resultado actualizado.' : 'Entrenamiento completado. ¡Buen trabajo!')
    await reloadData()
  }

  async function handleCreateTask(values: TaskValues) {
    requireConnection()
    if (!auth.session?.user) return
    await createTrainingTask(values, auth.session.user.id)
    notify(values.status === 'published' ? 'Tarea creada y publicada.' : 'Borrador guardado.')
    await reloadData()
  }

  async function handleTaskStatus(taskId: string, status: TaskStatus) {
    try {
      requireConnection()
      await updateTaskStatus(taskId, status)
      notify(status === 'published' ? 'Tarea publicada.' : 'Estado de la tarea actualizado.')
      await reloadData()
    } catch (error) {
      setOperationError(errorText(error))
    }
  }

  async function handleReorderTasks(taskIds: string[]) {
    try {
      requireConnection()
      await reorderTrainingTasks(taskIds)
      notify('Orden de las tareas actualizado.')
      await reloadData()
    } catch (error) {
      setOperationError(errorText(error))
    }
  }

  async function handleUpdateTask(task: TrainingTask, values: TaskValues) {
    try {
      requireConnection()
      await updateTrainingTask(task.id, values)
      notify('Tarea actualizada.')
      await reloadData()
    } catch (error) {
      setOperationError(errorText(error))
      throw error
    }
  }

  async function handleDeleteTask(task: TrainingTask) {
    try {
      requireConnection()
      await deleteTrainingTask(task.id)
      notify('Tarea y respuestas eliminadas.')
      await reloadData()
    } catch (error) {
      setOperationError(errorText(error))
      throw error
    }
  }

  async function handleSaveAnnouncement(announcement: TeamAnnouncement | undefined, values: AnnouncementValues) {
    requireConnection()
    if (!auth.session?.user) return
    if (announcement) await updateTeamAnnouncement(announcement.id, values)
    else await createTeamAnnouncement(values, auth.session.user.id)
    notify(announcement ? 'Aviso actualizado.' : 'Aviso creado.')
    await reloadData()
  }

  async function handleDeleteAnnouncement(announcement: TeamAnnouncement) {
    requireConnection()
    await deleteTeamAnnouncement(announcement.id)
    notify('Aviso eliminado.')
    await reloadData()
  }

  async function handleAnnouncementStatus(id: string, status: TaskStatus) {
    requireConnection()
    await updateTeamAnnouncementStatus(id, status)
    notify('Estado del aviso actualizado.')
    await reloadData()
  }

  async function handleSaveMatch(match: Match | undefined, values: MatchValues) {
    requireConnection()
    if (!auth.session?.user) return
    if (match) await updateMatch(match.id, values)
    else await createMatch(values, auth.session.user.id)
    notify(match ? 'Partido actualizado.' : 'Partido creado.')
    await reloadData()
  }

  async function handleDeleteMatch(match: Match) {
    requireConnection()
    await deleteMatch(match.id); notify('Partido eliminado.'); await reloadData()
  }

  async function handleMatchAvailability(match: Match, status: AvailabilityStatus, comment: string) {
    requireConnection()
    await saveMatchAvailability(match.id, userId, status, comment); notify('Disponibilidad guardada.'); await reloadData()
  }

  async function handlePlayerMatchAvailability(match: Match, playerId: string, status: AvailabilityStatus, comment: string) {
    requireConnection()
    await setPlayerMatchAvailability(match.id, playerId, status, comment)
    notify('Disponibilidad de la jugadora actualizada.')
    await reloadData()
  }

  async function handleMatchLineup(match: Match, entries: Omit<MatchLineup, 'match_id' | 'updated_at'>[], published: boolean) {
    requireConnection()
    await saveMatchLineup(match, entries, published); notify(published ? 'Convocatoria publicada.' : 'Convocatoria guardada.'); await reloadData()
  }

  async function handleUnlockMatchLineup(match: Match) {
    requireConnection()
    await unlockMatchLineup(match.id)
    notify('Convocatoria desbloqueada. Recuerda volver a publicarla cuando termines.')
    await reloadData()
  }

  async function handleCreateSeason(values: SeasonValues) {
    requireConnection()
    if (!auth.session?.user) return
    await createSeason(values, auth.session.user.id)
    notify('Temporada creada.')
    await reloadData()
  }

  async function handleUpdateSeason(season: Season, values: SeasonValues) {
    requireConnection()
    await updateSeason(season.id, values)
    notify('Temporada actualizada.')
    await reloadData()
  }

  async function handleDeleteSeason(season: Season) {
    requireConnection()
    await deleteSeason(season.id)
    notify('Temporada y todos sus datos asociados eliminados.')
    await reloadData()
  }

  async function handleUpdateProfile(profile: Profile) {
    try {
      requireConnection()
      await updateProfilePermissions(profile)
      notify(`Permisos de ${profile.display_name} actualizados.`)
      await reloadData()
    } catch (error) {
      setOperationError(errorText(error))
    }
  }

  async function handleUpdateDisplayName(displayName: string) {
    requireConnection()
    await updateOwnDisplayName(displayName)
    notify('Nombre actualizado.')
    await reloadData()
  }

  async function handleAttendance(date: string, playerIds: string[], attendedPlayerIds: string[]) {
    requireConnection()
    await saveTrainingAttendance(date, playerIds, attendedPlayerIds)
    notify('Asistencia guardada correctamente.')
    await reloadData()
  }

  async function handleMembership(season: Season, player: Profile, active: boolean) {
    try {
      requireConnection()
      const existing = activeMembershipFor(data.memberships, season.id, player.id)
      await setSeasonMembership(season, player, active, existing)
      notify(`${player.display_name} ${active ? 'forma parte de' : 'ha salido de'} ${season.name}.`)
      await reloadData()
    } catch (error) {
      setOperationError(errorText(error))
    }
  }

  async function handleSignOut() {
    navigate('home', true)
    await auth.signOut()
  }

  if (auth.loading) return <LoadingScreen />
  if (!auth.session) return <LoginScreen errorMessage={auth.errorMessage} onLogin={auth.signInWithGoogle} />
  if (!data.profile || data.loadedUserId !== auth.session.user.id) {
    if (data.errorMessage && !data.loading) {
      return <DataLoadErrorScreen errorMessage={data.errorMessage} online={online} onRetry={() => void data.reload()} onSignOut={handleSignOut} />
    }
    return <LoadingScreen />
  }
  if (data.profile.is_archived) return <DisabledScreen name={data.profile.display_name} onSignOut={handleSignOut} />
  if (!data.profile.is_approved) return <PendingScreen name={data.profile.display_name} onSignOut={handleSignOut} />

  const userId = auth.session.user.id
  const personalResults = data.results.filter((result) => result.player_id === userId)
  const canManage = canManageSport(data.profile)
  const canViewTeam = canViewTeamData(data.profile)
  const errorMessage = operationError || data.errorMessage || auth.errorMessage

  return (
    <AppLayout
      email={auth.session.user.email ?? ''}
      errorMessage={errorMessage}
      message={message}
      profile={data.profile}
      online={online}
      view={view}
      onNavigate={navigate}
      onSignOut={handleSignOut}
      onUpdateDisplayName={handleUpdateDisplayName}
      notifications={notifications.notifications}
      notificationReadIds={notifications.readIds}
      notificationUnreadCount={notifications.unreadCount}
      onNotificationRead={notifications.markRead}
      onNotificationOpen={(notification) => navigate({
        view: notification.view,
        date: notification.targetDate,
        announcementId: notification.kind === 'announcement' ? notification.targetId : undefined,
      })}
      onNotificationsReadAll={notifications.markAllRead}
    >
      {data.loadedView !== view ? (
        data.errorMessage && !data.loading
          ? <SectionError message={online ? data.errorMessage : 'No hay conexión a Internet.'} onRetry={() => void data.reload()} />
          : <SectionLoading />
      ) : <ViewErrorBoundary key={`${view}:${navigation.date ?? ''}:${navigation.announcementId ?? ''}`}><Suspense fallback={<SectionLoading />}>
      {view !== 'competition' && !hasWorkingSeason(data.profile, data.seasons, data.memberships, userId) && (
        <SeasonContextNotice profile={data.profile} onOpenSettings={() => navigate('settings')} view={view} />
      )}
      {view === 'home' && (
        <Dashboard
          memberships={data.memberships}
          attendance={data.attendance}
          trainingSessions={data.trainingSessions}
          profile={data.profile}
          profiles={data.profiles}
          results={canViewTeam ? data.results : personalResults}
          tasks={data.tasks}
          announcements={data.announcements}
          matches={data.matches}
          userId={userId}
          season={data.seasons.find((season) => season.start_date <= todayIso() && season.end_date >= todayIso())}
          onGoToTasks={canAccessTasks(data.profile) ? () => navigate('tasks') : undefined}
          onSaveResult={handleSaveResult}
          onOpenMatch={(match) => navigate({ view: 'matches', date: match.match_date })}
          onOpenAnnouncement={(announcement) => navigate({ view: 'tasks', date: announcement.announcement_date, announcementId: announcement.id })}
          onLoadSeasonSummary={isPlayer(data.profile) ? fetchPlayerSeasonSummary : undefined}
        />
      )}
      {view === 'statistics' && canViewTeam && (
        <StatisticsView
          attendance={data.attendance}
          memberships={data.memberships}
          profiles={data.profiles}
          results={data.results}
          seasons={data.seasons}
          sessions={data.trainingSessions}
          tasks={data.tasks}
          loadingRange={data.loadingRange}
          onLoadMonth={data.loadStatisticsMonth}
        />
      )}
      {view === 'attendance' && canManage && (
        <AttendanceView
          attendance={data.attendance}
          memberships={data.memberships}
          profiles={data.profiles}
          seasons={data.seasons}
          sessions={data.trainingSessions}
          loadingRange={data.loadingRange}
          onLoadDate={data.loadAttendanceDate}
          onSave={handleAttendance}
        />
      )}
      {view === 'tasks' && canAccessTasks(data.profile) && (
        <TasksView
          canManage={canManage}
          memberships={data.memberships}
          profiles={data.profiles}
          results={personalResults}
          seasons={data.seasons}
          tasks={data.tasks}
          announcements={data.announcements}
          teamResults={canManage ? data.results : undefined}
          userId={userId}
          loadingRange={data.loadingRange}
          onCreate={handleCreateTask}
          onDelete={handleDeleteTask}
          onUpdate={handleUpdateTask}
          onLoadRange={data.loadTaskRange}
          onSaveResult={handleSaveResult}
          onReorder={handleReorderTasks}
          onStatusChange={handleTaskStatus}
          onSaveAnnouncement={handleSaveAnnouncement}
          onDeleteAnnouncement={handleDeleteAnnouncement}
          onAnnouncementStatusChange={handleAnnouncementStatus}
          focusedDate={navigation.date}
          focusedAnnouncementId={navigation.announcementId}
        />
      )}
      {view === 'matches' && (
        <MatchesView
          availability={data.matchAvailability}
          canEditPlayerAvailability={canManage}
          canManage={canManage}
          canUnlockLineup={canManage}
          canViewAvailability={canViewTeam}
          isPlayer={isPlayer(data.profile)}
          lineups={data.matchLineups}
          matches={data.matches}
          memberships={data.memberships}
          profiles={data.profiles}
          seasons={data.seasons}
          userId={userId}
          onDelete={handleDeleteMatch}
          onLoadMonth={data.loadMatchMonth}
          onSaveAvailability={handleMatchAvailability}
          onSavePlayerAvailability={handlePlayerMatchAvailability}
          onSaveLineup={handleMatchLineup}
          onUnlockLineup={handleUnlockMatchLineup}
          onSaveMatch={handleSaveMatch}
          focusedDate={navigation.date}
          canViewReport={canViewTeam}
          onLoadCallupReport={fetchSeasonCallupReport}
          onLoadPlayerSeasonSummary={fetchPlayerSeasonSummary}
        />
      )}
      {view === 'competition' && (
        <CompetitionView
          errorMessage={competition.errorMessage}
          fixtures={competition.fixtures}
          isOwner={data.profile.is_owner}
          loading={competition.loading}
          playerStats={competition.playerStats}
          seasons={competition.seasons}
          standings={competition.standings}
          syncing={competition.syncing}
          onSeasonChange={competition.loadSeason}
          onSync={competition.synchronize}
        />
      )}
      {view === 'settings' && data.profile.is_owner && (
        <SettingsView
          currentUserId={userId}
          memberships={data.memberships}
          profiles={data.profiles}
          seasons={data.seasons}
          onCreateSeason={handleCreateSeason}
          onDeleteSeason={handleDeleteSeason}
          onToggleMembership={handleMembership}
          onUpdateProfile={handleUpdateProfile}
          onUpdateSeason={handleUpdateSeason}
        />
      )}
      </Suspense></ViewErrorBoundary>}
    </AppLayout>
  )
}

export default App

function hasWorkingSeason(profile: Profile, seasons: Season[], memberships: SeasonPlayer[], userId: string) {
  const today = todayIso()
  const activeSeasons = seasons.filter((season) => season.start_date <= today && season.end_date >= today)
  if (canViewTeamData(profile)) return activeSeasons.length > 0
  return activeSeasons.some((season) => memberships.some((membership) => (
    membership.season_id === season.id
    && membership.player_id === userId
    && membershipCoversDate(membership, today)
  )))
}

function canAccessView(profile: Profile, view: ViewName) {
  if (view === 'settings') return profile.is_owner
  if (view === 'attendance') return canManageSport(profile)
  if (view === 'statistics') return canViewTeamData(profile)
  if (view === 'tasks') return canAccessTasks(profile)
  return true
}

function SeasonContextNotice({ profile, view, onOpenSettings }: { profile: Profile; view: ViewName; onOpenSettings: () => void }) {
  const title = profile.is_owner
    ? 'No hay ninguna temporada activa'
    : profile.is_coach
      ? 'No hay una temporada activa para planificar'
      : profile.is_viewer
        ? 'No hay ninguna temporada activa'
      : 'No tienes una temporada activa asignada'
  const text = profile.is_owner
    ? 'Crea una temporada o revisa sus fechas para volver a trabajar con tareas y partidos.'
    : profile.is_coach
      ? 'El owner debe crear una temporada o corregir sus fechas antes de continuar con la planificación.'
      : profile.is_viewer
        ? 'El cuerpo técnico debe crear una temporada o corregir sus fechas para poder consultar la información del equipo.'
      : 'Consulta con el cuerpo técnico para que revise la temporada y tu inscripción.'
  return (
    <div className="season-context-notice" role="status">
      <span><Icon name="warning" size={18} /></span>
      <div><strong>{title}</strong><p>{text}</p></div>
      {profile.is_owner && view !== 'settings' && <button className="secondary-button compact" onClick={onOpenSettings}>Revisar temporadas</button>}
    </div>
  )
}

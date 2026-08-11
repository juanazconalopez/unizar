import { lazy, Suspense, useState } from 'react'
import { AppLayout } from './components/layout/AppLayout'
import { Icon } from './components/Icon'
import { SectionError, SectionLoading, ViewErrorBoundary } from './components/AsyncViewState'
import { DataLoadErrorScreen, DisabledScreen, LoadingScreen, LoginScreen, PendingScreen } from './features/auth/AuthScreens'
import { Dashboard } from './features/dashboard/Dashboard'
import { useAuth } from './hooks/useAuth'
import { useCompetitionData } from './hooks/useCompetitionData'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { useTrainingData } from './hooks/useTrainingData'
import { errorText } from './lib/errors'
import { todayIso } from './lib/dates'
import { activeMembershipFor, membershipCoversDate } from './lib/selectors'
import {
  createSeason,
  deleteSeason,
  saveTrainingAttendance,
  setSeasonMembership,
  updateSeason,
  updateProfilePermissions,
} from './services/trainingService'
import { createTrainingTask, deleteTrainingTask, saveTaskResult, updateTrainingTask, updateTaskStatus } from './services/tasksService'
import { createMatch, deleteMatch, saveMatchAvailability, saveMatchLineup, updateMatch } from './services/matchesService'
import type {
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
  const [view, setView] = useState<ViewName>('home')
  const [message, setMessage] = useState('')
  const [operationError, setOperationError] = useState('')
  const auth = useAuth()
  const online = useOnlineStatus()
  const data = useTrainingData(auth.session, view)
  const competition = useCompetitionData(view === 'competition' && Boolean(auth.session), Boolean(data.profile?.is_owner))

  function requireConnection() {
    if (navigator.onLine) return
    const error = new Error('Sin conexión. Recupera Internet antes de guardar cambios.')
    setOperationError(error.message)
    throw error
  }

  function navigate(nextView: ViewName) {
    preloadView(nextView)
    setOperationError('')
    setView(nextView)
  }

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
    await data.reload()
  }

  async function handleCreateTask(values: TaskValues) {
    requireConnection()
    if (!auth.session?.user) return
    await createTrainingTask(values, auth.session.user.id)
    notify(values.status === 'published' ? 'Tarea creada y publicada.' : 'Borrador guardado.')
    await data.reload()
  }

  async function handleTaskStatus(taskId: string, status: TaskStatus) {
    try {
      requireConnection()
      await updateTaskStatus(taskId, status)
      notify(status === 'published' ? 'Tarea publicada.' : 'Estado de la tarea actualizado.')
      await data.reload()
    } catch (error) {
      setOperationError(errorText(error))
    }
  }

  async function handleUpdateTask(task: TrainingTask, values: TaskValues) {
    try {
      requireConnection()
      await updateTrainingTask(task.id, values)
      notify('Tarea actualizada.')
      await data.reload()
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
      await data.reload()
    } catch (error) {
      setOperationError(errorText(error))
      throw error
    }
  }

  async function handleSaveMatch(match: Match | undefined, values: MatchValues) {
    requireConnection()
    if (!auth.session?.user) return
    if (match) await updateMatch(match.id, values)
    else await createMatch(values, auth.session.user.id)
    notify(match ? 'Partido actualizado.' : 'Partido creado.')
    await data.reload()
  }

  async function handleDeleteMatch(match: Match) {
    requireConnection()
    await deleteMatch(match.id); notify('Partido eliminado.'); await data.reload()
  }

  async function handleMatchAvailability(match: Match, status: AvailabilityStatus, comment: string) {
    requireConnection()
    await saveMatchAvailability(match.id, userId, status, comment); notify('Disponibilidad guardada.'); await data.reload()
  }

  async function handleMatchLineup(match: Match, entries: Omit<MatchLineup, 'match_id' | 'updated_at'>[], published: boolean) {
    requireConnection()
    await saveMatchLineup(match, entries, published); notify(published ? 'Convocatoria publicada.' : 'Convocatoria guardada.'); await data.reload()
  }

  async function handleCreateSeason(values: SeasonValues) {
    requireConnection()
    if (!auth.session?.user) return
    await createSeason(values, auth.session.user.id)
    notify('Temporada creada.')
    await data.reload()
  }

  async function handleUpdateSeason(season: Season, values: SeasonValues) {
    requireConnection()
    await updateSeason(season.id, values)
    notify('Temporada actualizada.')
    await data.reload()
  }

  async function handleDeleteSeason(season: Season) {
    requireConnection()
    await deleteSeason(season.id)
    notify('Temporada y todos sus datos asociados eliminados.')
    await data.reload()
  }

  async function handleUpdateProfile(profile: Profile) {
    try {
      requireConnection()
      await updateProfilePermissions(profile)
      notify(`Permisos de ${profile.display_name} actualizados.`)
      await data.reload()
    } catch (error) {
      setOperationError(errorText(error))
    }
  }

  async function handleAttendance(date: string, playerIds: string[], attendedPlayerIds: string[]) {
    requireConnection()
    await saveTrainingAttendance(date, playerIds, attendedPlayerIds)
    notify('Asistencia guardada correctamente.')
    await data.reload()
  }

  async function handleMembership(season: Season, player: Profile, active: boolean) {
    try {
      requireConnection()
      const existing = activeMembershipFor(data.memberships, season.id, player.id)
      await setSeasonMembership(season, player, active, existing)
      notify(`${player.display_name} ${active ? 'forma parte de' : 'ha salido de'} ${season.name}.`)
      await data.reload()
    } catch (error) {
      setOperationError(errorText(error))
    }
  }

  async function handleSignOut() {
    setView('home')
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
  const canManageTasks = data.profile.is_owner || data.profile.is_collaborator
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
    >
      {data.loadedView !== view ? (
        data.errorMessage && !data.loading
          ? <SectionError message={online ? data.errorMessage : 'No hay conexión a Internet.'} onRetry={() => void data.reload()} />
          : <SectionLoading />
      ) : <ViewErrorBoundary key={view}><Suspense fallback={<SectionLoading />}>
      {view !== 'competition' && !hasWorkingSeason(data.profile, data.seasons, data.memberships, userId) && (
        <SeasonContextNotice profile={data.profile} onOpenSettings={() => navigate('settings')} view={view} />
      )}
      {view === 'home' && (
        <Dashboard
          memberships={data.memberships}
          attendance={data.attendance}
          profile={data.profile}
          results={personalResults}
          tasks={data.tasks}
          userId={userId}
          onGoToTasks={() => navigate('tasks')}
          onSaveResult={handleSaveResult}
        />
      )}
      {view === 'statistics' && data.profile.is_owner && (
        <StatisticsView
          attendance={data.attendance}
          memberships={data.memberships}
          profiles={data.profiles}
          results={data.results}
          sessions={data.trainingSessions}
          tasks={data.tasks}
          loadingRange={data.loadingRange}
          onLoadMonth={data.loadStatisticsMonth}
        />
      )}
      {view === 'attendance' && data.profile.is_owner && (
        <AttendanceView
          attendance={data.attendance}
          memberships={data.memberships}
          profiles={data.profiles}
          sessions={data.trainingSessions}
          loadingRange={data.loadingRange}
          onLoadDate={data.loadAttendanceDate}
          onSave={handleAttendance}
        />
      )}
      {view === 'tasks' && (
        <TasksView
          canManage={canManageTasks}
          isOwner={data.profile.is_owner}
          memberships={data.memberships}
          profiles={data.profiles}
          results={personalResults}
          seasons={data.seasons}
          tasks={data.tasks}
          teamResults={canManageTasks ? data.results : undefined}
          userId={userId}
          loadingRange={data.loadingRange}
          onCreate={handleCreateTask}
          onDelete={handleDeleteTask}
          onUpdate={handleUpdateTask}
          onLoadRange={data.loadTaskRange}
          onSaveResult={handleSaveResult}
          onStatusChange={handleTaskStatus}
        />
      )}
      {view === 'matches' && (
        <MatchesView
          availability={data.matchAvailability}
          isOwner={data.profile.is_owner}
          lineups={data.matchLineups}
          matches={data.matches}
          memberships={data.memberships}
          profiles={data.profiles}
          seasons={data.seasons}
          userId={userId}
          onDelete={handleDeleteMatch}
          onLoadMonth={data.loadMatchMonth}
          onSaveAvailability={handleMatchAvailability}
          onSaveLineup={handleMatchLineup}
          onSaveMatch={handleSaveMatch}
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
  if (profile.is_owner || profile.is_collaborator) return activeSeasons.length > 0
  return activeSeasons.some((season) => memberships.some((membership) => (
    membership.season_id === season.id
    && membership.player_id === userId
    && membershipCoversDate(membership, today)
  )))
}

function SeasonContextNotice({ profile, view, onOpenSettings }: { profile: Profile; view: ViewName; onOpenSettings: () => void }) {
  const title = profile.is_owner
    ? 'No hay ninguna temporada activa'
    : profile.is_collaborator
      ? 'No hay una temporada activa para planificar'
      : 'No tienes una temporada activa asignada'
  const text = profile.is_owner
    ? 'Crea una temporada o revisa sus fechas para volver a trabajar con tareas y partidos.'
    : profile.is_collaborator
      ? 'El owner debe crear una temporada o corregir sus fechas antes de continuar con la planificación.'
      : 'Consulta con el cuerpo técnico para que revise la temporada y tu inscripción.'
  return (
    <div className="season-context-notice" role="status">
      <span><Icon name="warning" size={18} /></span>
      <div><strong>{title}</strong><p>{text}</p></div>
      {profile.is_owner && view !== 'settings' && <button className="secondary-button compact" onClick={onOpenSettings}>Revisar temporadas</button>}
    </div>
  )
}

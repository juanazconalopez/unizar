import { useState } from 'react'
import { AppLayout } from './components/layout/AppLayout'
import { DisabledScreen, LoadingScreen, LoginScreen, PendingScreen } from './features/auth/AuthScreens'
import { AttendanceView } from './features/attendance/AttendanceView'
import { Dashboard } from './features/dashboard/Dashboard'
import { SettingsView } from './features/settings/SettingsView'
import { StatisticsView } from './features/statistics/StatisticsView'
import { TasksView } from './features/tasks/TasksView'
import { MatchesView } from './features/matches/MatchesView'
import { useAuth } from './hooks/useAuth'
import { useTrainingData } from './hooks/useTrainingData'
import { errorText } from './lib/errors'
import { activeMembershipFor } from './lib/selectors'
import {
  createSeason,
  saveTrainingAttendance,
  setSeasonMembership,
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
  SeasonValues,
  TaskStatus,
  TaskValues,
  TrainingTask,
  ViewName,
} from './types'
import './App.css'

function App() {
  const [view, setView] = useState<ViewName>('home')
  const [message, setMessage] = useState('')
  const [operationError, setOperationError] = useState('')
  const auth = useAuth()
  const data = useTrainingData(auth.session)

  function notify(text: string) {
    setMessage(text)
    setOperationError('')
    window.setTimeout(() => setMessage(''), 3500)
  }

  async function handleSaveResult(task: TrainingTask, values: ResultValues) {
    if (!auth.session?.user) return
    const exists = data.results.some(
      (result) => result.task_id === task.id && result.player_id === auth.session?.user.id,
    )
    await saveTaskResult(task, values, auth.session.user.id, exists)
    notify(exists ? 'Resultado actualizado.' : 'Entrenamiento completado. ¡Buen trabajo!')
    await data.reload()
  }

  async function handleCreateTask(values: TaskValues) {
    if (!auth.session?.user) return
    await createTrainingTask(values, auth.session.user.id)
    notify(values.status === 'published' ? 'Tarea creada y publicada.' : 'Borrador guardado.')
    await data.reload()
  }

  async function handleTaskStatus(taskId: string, status: TaskStatus) {
    try {
      await updateTaskStatus(taskId, status)
      notify(status === 'published' ? 'Tarea publicada.' : 'Estado de la tarea actualizado.')
      await data.reload()
    } catch (error) {
      setOperationError(errorText(error))
    }
  }

  async function handleUpdateTask(task: TrainingTask, values: TaskValues) {
    try {
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
      await deleteTrainingTask(task.id)
      notify('Tarea y respuestas eliminadas.')
      await data.reload()
    } catch (error) {
      setOperationError(errorText(error))
      throw error
    }
  }

  async function handleSaveMatch(match: Match | undefined, values: MatchValues) {
    if (!auth.session?.user) return
    if (match) await updateMatch(match.id, values)
    else await createMatch(values, auth.session.user.id)
    notify(match ? 'Partido actualizado.' : 'Partido creado.')
    await data.reload()
  }

  async function handleDeleteMatch(match: Match) {
    await deleteMatch(match.id); notify('Partido eliminado.'); await data.reload()
  }

  async function handleMatchAvailability(match: Match, status: AvailabilityStatus, comment: string) {
    await saveMatchAvailability(match.id, userId, status, comment); notify('Disponibilidad guardada.'); await data.reload()
  }

  async function handleMatchLineup(match: Match, entries: Omit<MatchLineup, 'match_id' | 'updated_at'>[], published: boolean) {
    await saveMatchLineup(match, entries, published); notify(published ? 'Convocatoria publicada.' : 'Convocatoria guardada.'); await data.reload()
  }

  async function handleCreateSeason(values: SeasonValues) {
    if (!auth.session?.user) return
    await createSeason(values, auth.session.user.id)
    notify('Temporada creada.')
    await data.reload()
  }

  async function handleUpdateProfile(profile: Profile) {
    try {
      await updateProfilePermissions(profile)
      notify(`Permisos de ${profile.display_name} actualizados.`)
      await data.reload()
    } catch (error) {
      setOperationError(errorText(error))
    }
  }

  async function handleAttendance(date: string, playerIds: string[], attendedPlayerIds: string[]) {
    if (!auth.session?.user) return
    await saveTrainingAttendance(date, playerIds, attendedPlayerIds, auth.session.user.id)
    notify('Asistencia guardada correctamente.')
    await data.reload()
  }

  async function handleMembership(season: Season, player: Profile, active: boolean) {
    try {
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
  if (!data.profile || data.loading && !data.profile) return <LoadingScreen />
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
      view={view}
      onNavigate={setView}
      onSignOut={handleSignOut}
    >
      {view === 'home' && (
        <Dashboard
          memberships={data.memberships}
          attendance={data.attendance}
          profile={data.profile}
          results={personalResults}
          tasks={data.tasks}
          userId={userId}
          onGoToTasks={() => setView('tasks')}
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
        />
      )}
      {view === 'attendance' && data.profile.is_owner && (
        <AttendanceView
          attendance={data.attendance}
          profiles={data.profiles}
          sessions={data.trainingSessions}
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
          onCreate={handleCreateTask}
          onDelete={handleDeleteTask}
          onUpdate={handleUpdateTask}
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
          onSaveAvailability={handleMatchAvailability}
          onSaveLineup={handleMatchLineup}
          onSaveMatch={handleSaveMatch}
        />
      )}
      {view === 'settings' && data.profile.is_owner && (
        <SettingsView
          currentUserId={userId}
          memberships={data.memberships}
          profiles={data.profiles}
          seasons={data.seasons}
          onCreateSeason={handleCreateSeason}
          onToggleMembership={handleMembership}
          onUpdateProfile={handleUpdateProfile}
        />
      )}
    </AppLayout>
  )
}

export default App

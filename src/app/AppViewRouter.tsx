import { Suspense, useState } from 'react'
import { SectionError, SectionLoading, ViewErrorBoundary } from '../components/AsyncViewState'
import { Dashboard } from '../features/dashboard/Dashboard'
import type { useCompetitionData } from '../hooks/useCompetitionData'
import type { useTrainingData } from '../hooks/useTrainingData'
import { todayIso } from '../lib/dates'
import type { NavigationTarget } from '../lib/navigation'
import { canAccessTasks, hasPermission, isPlayer, PERMISSIONS } from '../lib/permissions'
import type { PermissionKey } from '../lib/permissions'
import { fetchPlayerSeasonSummary, fetchSeasonAttendanceReport, fetchSeasonCallupReport } from '../services/matchesService'
import { fetchCalendarTrainingPlans } from '../services/trainingPlansService'
import { fetchMyPendingSurveys, fetchSurveyCalendarResults, fetchVisibleSurveyClosures } from '../services/surveysService'
import type { Profile, ViewName } from '../types'
import type { AppActions } from './actions/appActions'
import { hasWorkingSeason } from './appAccess'
import { SeasonContextNotice } from './SeasonContextNotice'
import { AttendanceView, CalendarView, CompetitionView, LibraryView, MatchesView, PlayerCalendarView, SettingsView, StatisticsView, SurveyResponseView, SurveysView, TasksView, TrainingPlansView } from './viewModules'
import { SurveyCalendarResultsDialog } from '../features/surveys/SurveyCalendarResultsDialog'

type TrainingController = ReturnType<typeof useTrainingData>
type CompetitionController = ReturnType<typeof useCompetitionData>

export function AppViewRouter({
  actions,
  canManage,
  canViewTeam,
  competition,
  data,
  navigation,
  navigate,
  notify,
  online,
  profile,
  permissionKeys,
  userId,
}: {
  actions: AppActions
  canManage: boolean
  canViewTeam: boolean
  competition: CompetitionController
  data: TrainingController
  navigation: NavigationTarget
  navigate: (target: ViewName | NavigationTarget) => void
  notify: (message: string) => void
  online: boolean
  profile: Profile
  permissionKeys: PermissionKey[]
  userId: string
}) {
  const view = navigation.view
  const [surveyResultId, setSurveyResultId] = useState<string>()
  const personalResults = data.results.filter((result) => result.player_id === userId)
  const can = (permission: PermissionKey) => hasPermission(profile, permission, permissionKeys)

  if (data.loadedView !== view) {
    return data.errorMessage && !data.loading
      ? <SectionError message={online ? data.errorMessage : 'No hay conexión a Internet.'} onRetry={() => void data.reload()} />
      : <SectionLoading />
  }

  return <ViewErrorBoundary key={`${view}:${navigation.date ?? ''}:${navigation.announcementId ?? ''}:${navigation.trainingPlanId ?? ''}:${navigation.settingsSection ?? ''}`}>
    <Suspense fallback={<SectionLoading />}>
      {view !== 'competition' && view !== 'library' && !hasWorkingSeason(profile, data.seasons, data.memberships, userId, permissionKeys) && (
        <SeasonContextNotice profile={profile} onOpenSettings={() => navigate('settings')} view={view} />
      )}
      {view === 'home' && <Dashboard
        announcements={data.announcements}
        attendance={data.attendance}
        matches={data.matches}
        memberships={data.memberships}
        profile={profile}
        profiles={data.profiles}
        results={canViewTeam ? data.results : personalResults}
        season={data.seasons.find((season) => season.start_date <= todayIso() && season.end_date >= todayIso())}
        tasks={data.tasks}
        todayBirthdays={data.todayBirthdays}
        trainingSessions={data.trainingSessions}
        userId={userId}
        onGoToTasks={canAccessTasks(profile, permissionKeys) ? () => navigate('calendar') : undefined}
        onLoadSeasonSummary={isPlayer(profile) ? fetchPlayerSeasonSummary : undefined}
        onLoadPendingSurveys={can(PERMISSIONS.surveys.respondOwn) ? fetchMyPendingSurveys : undefined}
        onOpenAnnouncement={(announcement) => navigate({ view: canManage || isPlayer(profile) ? 'calendar' : 'home', date: announcement.announcement_date, announcementId: announcement.id })}
        onOpenMatch={(match) => navigate({ view: canManage || isPlayer(profile) ? 'calendar' : 'matches', date: match.match_date })}
        onSaveResult={can(PERMISSIONS.tasks.submitOwn) ? actions.tasks.saveResult : undefined}
      />}
      {view === 'statistics' && can(PERMISSIONS.statistics.view) && <StatisticsView
        attendance={data.attendance}
        birthdays={data.seasonBirthdays}
        loadingRange={data.loadingRange}
        memberships={data.memberships}
        profiles={data.profiles}
        provisionalAttendance={data.provisionalAttendance}
        provisionalPlayers={data.provisionalPlayers}
        results={data.results}
        seasons={data.seasons}
        sessions={data.trainingSessions}
        tasks={data.tasks}
        canViewAttendance={can(PERMISSIONS.statistics.attendance)}
        canViewTasks={can(PERMISSIONS.statistics.tasks)}
        onLoadMonth={data.loadStatisticsMonth}
        onLoadSeasonReport={fetchSeasonAttendanceReport}
      />}
      {view === 'attendance' && can(PERMISSIONS.attendance.view) && <AttendanceView
        attendance={data.attendance}
        loadingRange={data.loadingRange}
        memberships={data.memberships}
        profiles={data.profiles}
        provisionalAttendance={data.provisionalAttendance}
        provisionalPlayers={data.provisionalPlayers}
        seasons={data.seasons}
        sessions={data.trainingSessions}
        canRecord={can(PERMISSIONS.attendance.record)}
        canManageGuests={can(PERMISSIONS.attendance.guests)}
        onLoadDate={data.loadAttendanceDate}
        onSave={actions.club.saveAttendance}
      />}
      {view === 'training' && can(PERMISSIONS.training.view) && <TrainingPlansView focusedPlanId={navigation.trainingPlanId} focusedPlanMode={navigation.trainingPlanMode} seasons={data.seasons} userId={userId} onNotify={notify} permissions={{
        create: can(PERMISSIONS.training.create), edit: can(PERMISSIONS.training.edit), delete: can(PERMISSIONS.training.delete), publish: can(PERMISSIONS.training.publish),
        viewExercises: can(PERMISSIONS.exercises.view), createExercises: can(PERMISSIONS.exercises.create), editExercises: can(PERMISSIONS.exercises.edit), deleteExercises: can(PERMISSIONS.exercises.delete),
      }} />}
      {view === 'calendar' && can(PERMISSIONS.calendar.manage) && <CalendarView
        permissions={{
          taskCreate: can(PERMISSIONS.tasks.create), taskEdit: can(PERMISSIONS.tasks.edit), taskDelete: can(PERMISSIONS.tasks.delete), taskPublish: can(PERMISSIONS.tasks.publish), taskReorder: can(PERMISSIONS.tasks.reorder), taskResults: can(PERMISSIONS.tasks.results),
          announcementCreate: can(PERMISSIONS.announcements.create), announcementEdit: can(PERMISSIONS.announcements.edit), announcementDelete: can(PERMISSIONS.announcements.delete), announcementPublish: can(PERMISSIONS.announcements.publish),
          matchCreate: can(PERMISSIONS.matches.create), matchEdit: can(PERMISSIONS.matches.edit), matchDelete: can(PERMISSIONS.matches.delete), availabilityEdit: can(PERMISSIONS.matches.editAvailability),
          lineupEdit: can(PERMISSIONS.matches.editLineup), lineupPublish: can(PERMISSIONS.matches.publishLineup), lineupUnlock: can(PERMISSIONS.matches.unlockLineup), report: can(PERMISSIONS.matches.report),
        }}
        announcements={data.announcements}
        availability={data.matchAvailability}
        birthdays={data.seasonBirthdays}
        focusedAnnouncementId={navigation.announcementId}
        focusedDate={navigation.date}
        lineups={data.matchLineups}
        matches={data.matches}
        memberships={data.memberships}
        profiles={data.profiles}
        results={data.results}
        seasons={data.seasons}
        seasonCompetitions={data.seasonCompetitions}
        tasks={data.tasks}
        onAnnouncementStatusChange={actions.announcements.changeStatus}
        onCreateTask={actions.tasks.create}
        onDeleteAnnouncement={actions.announcements.delete}
        onDeleteMatch={actions.matches.delete}
        onDeleteTask={actions.tasks.delete}
        onLoadCallupReport={fetchSeasonCallupReport}
        onLoadMatchMonth={data.loadMatchMonth}
        onLoadPlayerSeasonSummary={fetchPlayerSeasonSummary}
        onLoadTrainingPlans={fetchCalendarTrainingPlans}
        onLoadTaskRange={data.loadTaskRange}
        onOpenTrainingPlan={(trainingPlanId) => navigate({ view: 'training', trainingPlanId })}
        onEditTrainingPlan={can(PERMISSIONS.training.edit) ? (trainingPlanId) => navigate({ view: 'training', trainingPlanId, trainingPlanMode: 'edit' }) : undefined}
        onLoadSurveyClosures={fetchVisibleSurveyClosures}
        onOpenSurveyResults={setSurveyResultId}
        onReorderTasks={actions.tasks.reorder}
        onSaveAnnouncement={actions.announcements.save}
        onSaveLineup={actions.matches.saveLineup}
        onSaveMatch={actions.matches.save}
        onSavePlayerAvailability={actions.matches.savePlayerAvailability}
        onTaskStatusChange={actions.tasks.changeStatus}
        onUnlockLineup={actions.matches.unlockLineup}
        onUpdateTask={actions.tasks.update}
      />}
      {view === 'calendar' && !can(PERMISSIONS.calendar.manage) && can(PERMISSIONS.calendar.personal) && <PlayerCalendarView
        announcements={data.announcements}
        availability={data.matchAvailability}
        birthdays={data.calendarBirthdays}
        focusedAnnouncementId={navigation.announcementId}
        focusedDate={navigation.date}
        lineups={data.matchLineups}
        matches={data.matches}
        memberships={data.memberships}
        profiles={data.profiles}
        results={personalResults}
        tasks={data.tasks}
        userId={userId}
        onLoadMatchMonth={data.loadMatchMonth}
        onLoadTaskRange={data.loadTaskRange}
        onSaveAvailability={can(PERMISSIONS.matches.ownAvailability) ? actions.matches.saveAvailability : undefined}
        onSaveResult={can(PERMISSIONS.tasks.submitOwn) ? actions.tasks.saveResult : undefined}
        onLoadSurveyClosures={fetchVisibleSurveyClosures}
        onOpenSurveyResults={setSurveyResultId}
      />}
      {view === 'tasks' && canAccessTasks(profile) && <TasksView
        announcements={data.announcements}
        canManage={canManage}
        focusedAnnouncementId={navigation.announcementId}
        focusedDate={navigation.date}
        loadingRange={data.loadingRange}
        memberships={data.memberships}
        profiles={data.profiles}
        results={personalResults}
        seasons={data.seasons}
        tasks={data.tasks}
        teamResults={canManage ? data.results : undefined}
        userId={userId}
        onAnnouncementStatusChange={actions.announcements.changeStatus}
        onCreate={actions.tasks.create}
        onDelete={actions.tasks.delete}
        onDeleteAnnouncement={actions.announcements.delete}
        onLoadRange={data.loadTaskRange}
        onReorder={actions.tasks.reorder}
        onSaveAnnouncement={actions.announcements.save}
        onSaveResult={actions.tasks.saveResult}
        onStatusChange={actions.tasks.changeStatus}
        onUpdate={actions.tasks.update}
      />}
      {view === 'matches' && <MatchesView
        availability={data.matchAvailability}
        canEditPlayerAvailability={can(PERMISSIONS.matches.editAvailability)}
        canManage={can(PERMISSIONS.matches.edit)}
        canUnlockLineup={can(PERMISSIONS.matches.unlockLineup)}
        canViewAvailability={can(PERMISSIONS.matches.teamAvailability)}
        canViewReport={can(PERMISSIONS.matches.report)}
        focusedDate={navigation.date}
        isPlayer={isPlayer(profile) && can(PERMISSIONS.matches.ownAvailability)}
        lineups={data.matchLineups}
        matches={data.matches}
        memberships={data.memberships}
        profiles={data.profiles}
        seasons={data.seasons}
        seasonCompetitions={data.seasonCompetitions}
        userId={userId}
        onDelete={actions.matches.delete}
        onLoadCallupReport={fetchSeasonCallupReport}
        onLoadMonth={data.loadMatchMonth}
        onLoadPlayerSeasonSummary={fetchPlayerSeasonSummary}
        onSaveAvailability={actions.matches.saveAvailability}
        onSaveLineup={actions.matches.saveLineup}
        onSaveMatch={actions.matches.save}
        onSavePlayerAvailability={actions.matches.savePlayerAvailability}
        onUnlockLineup={actions.matches.unlockLineup}
      />}
      {view === 'competition' && <CompetitionView
        errorMessage={competition.errorMessage}
        fixtures={competition.fixtures}
        isOwner={hasPermission(profile, PERMISSIONS.competition.sync, permissionKeys)}
        loading={competition.loading}
        playerStats={competition.playerStats}
        seasons={competition.seasons}
        standings={competition.standings}
        syncing={competition.syncing}
        onSeasonChange={competition.loadSeason}
        onSync={competition.synchronize}
      />}
      {view === 'library' && <LibraryView items={data.libraryItems} />}
      {view === 'surveys' && can(PERMISSIONS.surveys.manage) && <SurveysView initialSurveyId={navigation.surveyId} isOwner={profile.is_owner} seasons={data.seasons} />}
      {view === 'survey' && navigation.surveyId && can(PERMISSIONS.surveys.respondOwn) && <SurveyResponseView surveyId={navigation.surveyId} onDone={() => { notify('Encuesta enviada. ¡Gracias por tu respuesta!'); navigate('home') }} />}
      {view === 'settings' && hasPermission(profile, PERMISSIONS.settings.view, permissionKeys) && <SettingsView
        currentUserId={userId}
        memberships={data.memberships}
        profilePrivateDetails={data.profilePrivateDetails}
        profiles={data.profiles}
        provisionalAttendance={data.provisionalAttendance}
        provisionalPlayers={data.provisionalPlayers}
        seasons={data.seasons}
        seasonCompetitions={data.seasonCompetitions}
        section={navigation.settingsSection}
        librarySettings={data.librarySettings}
        permissionDefinitions={data.permissionConfiguration.definitions}
        rolePermissions={data.permissionConfiguration.grants}
        onCreateSeason={actions.club.createSeason}
        onCreateSeasonCompetition={actions.club.createSeasonCompetition}
        onDeleteSeason={actions.club.deleteSeason}
        onDeleteSeasonCompetition={actions.club.deleteSeasonCompetition}
        onArchiveProfile={actions.club.archiveProfile}
        onLoadProfilePhoto={actions.club.loadProfilePhoto}
        onLinkProvisionalPlayers={actions.club.linkProvisionalPlayers}
        onToggleMembership={actions.club.toggleMembership}
        onUpdateProfile={actions.club.updateProfile}
        onUpdateProfileDetails={actions.club.updateManagedProfile}
        onUpdateSeason={actions.club.updateSeason}
        onSaveLibraryFolder={actions.library.saveFolder}
        onSyncLibrary={actions.library.sync}
        onSaveRolePermissions={actions.club.saveRolePermissions}
        onSetDefaultSeasonCompetition={actions.club.setDefaultSeasonCompetition}
        onResetRolePermissions={actions.club.resetRolePermissions}
        onUpdateSeasonCompetition={actions.club.updateSeasonCompetition}
      />}
      {view === 'settings' && !hasPermission(profile, PERMISSIONS.settings.view, permissionKeys) && <SectionError message="Solo el owner puede acceder a los ajustes." onRetry={() => navigate('home')} />}
      {surveyResultId && <SurveyCalendarResultsDialog onClose={() => setSurveyResultId(undefined)} onLoad={fetchSurveyCalendarResults} surveyId={surveyResultId} />}
    </Suspense>
  </ViewErrorBoundary>
}

import { Suspense } from 'react'
import { SectionError, SectionLoading, ViewErrorBoundary } from '../components/AsyncViewState'
import { Dashboard } from '../features/dashboard/Dashboard'
import type { useCompetitionData } from '../hooks/useCompetitionData'
import type { useTrainingData } from '../hooks/useTrainingData'
import { todayIso } from '../lib/dates'
import type { NavigationTarget } from '../lib/navigation'
import { canAccessTasks, isPlayer } from '../lib/permissions'
import { fetchPlayerSeasonSummary, fetchSeasonAttendanceReport, fetchSeasonCallupReport } from '../services/matchesService'
import { fetchPublishedTrainingPlans } from '../services/trainingPlansService'
import type { Profile, ViewName } from '../types'
import type { AppActions } from './actions/appActions'
import { hasWorkingSeason } from './appAccess'
import { SeasonContextNotice } from './SeasonContextNotice'
import { AttendanceView, CalendarView, CompetitionView, MatchesView, PlayerCalendarView, SettingsView, StatisticsView, TasksView, TrainingPlansView } from './viewModules'

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
  userId: string
}) {
  const view = navigation.view
  const personalResults = data.results.filter((result) => result.player_id === userId)

  if (data.loadedView !== view) {
    return data.errorMessage && !data.loading
      ? <SectionError message={online ? data.errorMessage : 'No hay conexión a Internet.'} onRetry={() => void data.reload()} />
      : <SectionLoading />
  }

  return <ViewErrorBoundary key={`${view}:${navigation.date ?? ''}:${navigation.announcementId ?? ''}:${navigation.trainingPlanId ?? ''}`}>
    <Suspense fallback={<SectionLoading />}>
      {view !== 'competition' && !hasWorkingSeason(profile, data.seasons, data.memberships, userId) && (
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
        onGoToTasks={canAccessTasks(profile) ? () => navigate('calendar') : undefined}
        onLoadSeasonSummary={isPlayer(profile) ? fetchPlayerSeasonSummary : undefined}
        onOpenAnnouncement={(announcement) => navigate({ view: canManage || isPlayer(profile) ? 'calendar' : 'home', date: announcement.announcement_date, announcementId: announcement.id })}
        onOpenMatch={(match) => navigate({ view: canManage || isPlayer(profile) ? 'calendar' : 'matches', date: match.match_date })}
        onSaveResult={actions.tasks.saveResult}
      />}
      {view === 'statistics' && canViewTeam && <StatisticsView
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
        onLoadMonth={data.loadStatisticsMonth}
        onLoadSeasonReport={fetchSeasonAttendanceReport}
      />}
      {view === 'attendance' && canManage && <AttendanceView
        attendance={data.attendance}
        loadingRange={data.loadingRange}
        memberships={data.memberships}
        profiles={data.profiles}
        provisionalAttendance={data.provisionalAttendance}
        provisionalPlayers={data.provisionalPlayers}
        seasons={data.seasons}
        sessions={data.trainingSessions}
        onLoadDate={data.loadAttendanceDate}
        onSave={actions.club.saveAttendance}
      />}
      {view === 'training' && canManage && <TrainingPlansView focusedPlanId={navigation.trainingPlanId} seasons={data.seasons} userId={userId} onNotify={notify} />}
      {view === 'calendar' && canManage && <CalendarView
        announcements={data.announcements}
        availability={data.matchAvailability}
        focusedAnnouncementId={navigation.announcementId}
        focusedDate={navigation.date}
        lineups={data.matchLineups}
        matches={data.matches}
        memberships={data.memberships}
        profiles={data.profiles}
        results={data.results}
        seasons={data.seasons}
        tasks={data.tasks}
        onAnnouncementStatusChange={actions.announcements.changeStatus}
        onCreateTask={actions.tasks.create}
        onDeleteAnnouncement={actions.announcements.delete}
        onDeleteMatch={actions.matches.delete}
        onDeleteTask={actions.tasks.delete}
        onLoadCallupReport={fetchSeasonCallupReport}
        onLoadMatchMonth={data.loadMatchMonth}
        onLoadPlayerSeasonSummary={fetchPlayerSeasonSummary}
        onLoadPublishedTrainingPlans={fetchPublishedTrainingPlans}
        onLoadTaskRange={data.loadTaskRange}
        onOpenTrainingPlan={(trainingPlanId) => navigate({ view: 'training', trainingPlanId })}
        onReorderTasks={actions.tasks.reorder}
        onSaveAnnouncement={actions.announcements.save}
        onSaveLineup={actions.matches.saveLineup}
        onSaveMatch={actions.matches.save}
        onSavePlayerAvailability={actions.matches.savePlayerAvailability}
        onTaskStatusChange={actions.tasks.changeStatus}
        onUnlockLineup={actions.matches.unlockLineup}
        onUpdateTask={actions.tasks.update}
      />}
      {view === 'calendar' && !canManage && isPlayer(profile) && <PlayerCalendarView
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
        onSaveAvailability={actions.matches.saveAvailability}
        onSaveResult={actions.tasks.saveResult}
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
        canEditPlayerAvailability={canManage}
        canManage={canManage}
        canUnlockLineup={canManage}
        canViewAvailability={canViewTeam}
        canViewReport={canManage}
        focusedDate={navigation.date}
        isPlayer={isPlayer(profile)}
        lineups={data.matchLineups}
        matches={data.matches}
        memberships={data.memberships}
        profiles={data.profiles}
        seasons={data.seasons}
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
        isOwner={profile.is_owner}
        loading={competition.loading}
        playerStats={competition.playerStats}
        seasons={competition.seasons}
        standings={competition.standings}
        syncing={competition.syncing}
        onSeasonChange={competition.loadSeason}
        onSync={competition.synchronize}
      />}
      {view === 'settings' && profile.is_owner && <SettingsView
        currentUserId={userId}
        memberships={data.memberships}
        profilePrivateDetails={data.profilePrivateDetails}
        profiles={data.profiles}
        provisionalAttendance={data.provisionalAttendance}
        provisionalPlayers={data.provisionalPlayers}
        seasons={data.seasons}
        onCreateSeason={actions.club.createSeason}
        onDeleteSeason={actions.club.deleteSeason}
        onArchiveProfile={actions.club.archiveProfile}
        onLoadProfilePhoto={actions.club.loadProfilePhoto}
        onLinkProvisionalPlayer={actions.club.linkProvisionalPlayer}
        onToggleMembership={actions.club.toggleMembership}
        onUpdateProfile={actions.club.updateProfile}
        onUpdateProfileDetails={actions.club.updateManagedProfile}
        onUpdateSeason={actions.club.updateSeason}
      />}
    </Suspense>
  </ViewErrorBoundary>
}

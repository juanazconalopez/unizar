import { useEffect } from 'react'
import { AppViewRouter } from './app/AppViewRouter'
import { createAnnouncementActions } from './app/actions/announcementActions'
import type { AppActions } from './app/actions/appActions'
import { createClubActions } from './app/actions/clubActions'
import { createMatchActions } from './app/actions/matchActions'
import { createTaskActions } from './app/actions/taskActions'
import { createLibraryActions } from './app/actions/libraryActions'
import { canAccessView } from './app/appAccess'
import { AppLayout } from './components/layout/AppLayout'
import { DataLoadErrorScreen, DisabledScreen, LoadingScreen, LoginScreen, PendingScreen } from './features/auth/AuthScreens'
import { useAppNavigation } from './hooks/useAppNavigation'
import { useAuth } from './hooks/useAuth'
import { useCompetitionData } from './hooks/useCompetitionData'
import { useNotifications } from './hooks/useNotifications'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { useOperationFeedback } from './hooks/useOperationFeedback'
import { useTrainingData } from './hooks/useTrainingData'
import { canManageSport, canViewTeamData, isPlayer } from './lib/permissions'
import './App.css'

function App() {
  const feedback = useOperationFeedback()
  const { navigation, view, navigate, replaceNavigation } = useAppNavigation(feedback.clearError)
  const auth = useAuth()
  const online = useOnlineStatus()
  const data = useTrainingData(auth.session, view)
  const notifications = useNotifications(data.profile, auth.session?.user.id, data.ownProfileDetails)
  const competition = useCompetitionData(view === 'competition' && Boolean(auth.session), Boolean(data.profile?.is_owner))
  const userId = auth.session?.user.id

  async function reloadData() {
    await Promise.all([data.reload(), notifications.reload()])
  }

  const actionContext = {
    userId,
    reloadData,
    notify: feedback.notify,
    reportError: feedback.reportError,
    requireConnection: feedback.requireConnection,
  }
  const actions: AppActions = {
    announcements: createAnnouncementActions(actionContext),
    club: createClubActions(actionContext, data.memberships),
    matches: createMatchActions(actionContext),
    tasks: createTaskActions(actionContext, data.results),
    library: createLibraryActions(actionContext),
  }

  useEffect(() => {
    if (!data.profile || canAccessView(data.profile, view)) return
    const timer = window.setTimeout(() => {
      const target = (canManageSport(data.profile!) || isPlayer(data.profile!)) && (view === 'tasks' || view === 'matches')
        ? { ...navigation, view: 'calendar' as const }
        : { view: 'home' as const }
      replaceNavigation(target)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [data.profile, navigation, replaceNavigation, view])

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

  const profile = data.profile
  const canManage = canManageSport(profile)
  const canViewTeam = canViewTeamData(profile)
  const errorMessage = feedback.operationError || data.errorMessage || auth.errorMessage

  return <AppLayout
    email={auth.session.user.email ?? ''}
    errorMessage={errorMessage}
    message={feedback.message}
    notificationReadIds={notifications.readIds}
    notificationUnreadCount={notifications.unreadCount}
    notifications={notifications.notifications}
    online={online}
    profile={profile}
    profileDetails={data.ownProfileDetails}
    settingsSection={navigation.settingsSection}
    view={view}
    onNavigate={navigate}
    onNotificationOpen={(notification) => navigate({
      view: (canManage || isPlayer(profile)) && (notification.view === 'tasks' || notification.view === 'matches') ? 'calendar' : notification.view,
      date: notification.targetDate,
      announcementId: notification.kind === 'announcement' ? notification.targetId : undefined,
    })}
    onNotificationRead={notifications.markRead}
    onNotificationsReadAll={notifications.markAllRead}
    onSignOut={handleSignOut}
    onLoadProfilePhoto={actions.club.loadProfilePhoto}
    onUpdateProfileDetails={(values, photoChange) => actions.club.updateOwnProfileDetails(profile, values, photoChange)}
  >
    <AppViewRouter
      actions={actions}
      canManage={canManage}
      canViewTeam={canViewTeam}
      competition={competition}
      data={data}
      navigation={navigation}
      navigate={navigate}
      notify={feedback.notify}
      online={online}
      profile={profile}
      userId={auth.session.user.id}
    />
  </AppLayout>
}

export default App

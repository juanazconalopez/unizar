import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Profile, ProfileDetailsValues, ProfilePrivateDetails, ViewName } from '../../types'
import { Icon } from '../Icon'
import { Avatar } from '../ui/Avatar'
import { ClubBrand } from '../ui/ClubBrand'
import { Modal } from '../ui/Modal'
import { useInstallApp } from '../../hooks/useInstallApp'
import { NotificationCenter } from '../../features/notifications/NotificationCenter'
import { SectionLoading, ViewErrorBoundary } from '../AsyncViewState'
import type { AppNotification } from '../../features/notifications/notifications'
import type { PermissionKey } from '../../lib/permissions'
import type { NavigationTarget } from '../../lib/navigation'
import { AppNavigation } from './AppNavigation'
import { navigationEntries } from './navigationEntries'
import { MobileProfileMenu, NotificationButton } from './MobileProfileMenu'

const ProfileDetailsDialog = lazy(() => import('../../features/profile/ProfileDetailsDialog').then(({ ProfileDetailsDialog }) => ({ default: ProfileDetailsDialog })))


export function AppLayout({
  profile,
  permissionKeys,
  profileDetails,
  licenseSummary,
  email,
  view,
  settingsSection,
  message,
  errorMessage,
  online = true,
  onNavigate,
  onSignOut,
  onLoadProfilePhoto,
  onUpdateProfileDetails,
  notifications = [],
  notificationReadIds = new Set<string>(),
  notificationUnreadCount = 0,
  onNotificationRead,
  onNotificationOpen,
  onNotificationsReadAll,
  children,
}: {
  profile: Profile
  permissionKeys?: PermissionKey[]
  licenseSummary?: string
  profileDetails?: ProfilePrivateDetails | null
  email: string
  view: ViewName
  settingsSection?: 'team' | 'seasons' | 'library' | 'permissions'
  message: string
  errorMessage: string
  online?: boolean
  onNavigate: (view: ViewName | NavigationTarget) => void
  onSignOut: () => void
  onLoadProfilePhoto?: (path: string) => Promise<string>
  onUpdateProfileDetails?: (values: ProfileDetailsValues) => Promise<void>
  notifications?: AppNotification[]
  notificationReadIds?: Set<string>
  notificationUnreadCount?: number
  onNotificationRead?: (notification: AppNotification) => void
  onNotificationOpen?: (notification: AppNotification) => void
  onNotificationsReadAll?: () => void
  children: ReactNode
}) {
  const contentRef = useRef<HTMLElement>(null)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [iosInstructionsOpen, setIosInstructionsOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileDetailsOpen, setProfileDetailsOpen] = useState(false)
  const [highlightMissingProfileDetails, setHighlightMissingProfileDetails] = useState(false)
  const installApp = useInstallApp()
  const showInstallAction = installApp.canInstall || installApp.needsIosInstructions
  const canEditProfile = profile.is_approved && profile.is_active && !profile.is_archived && Boolean(onUpdateProfileDetails)
  const navigation = useMemo(() => navigationEntries(profile, permissionKeys), [profile, permissionKeys])

  const role = profileRoles(profile).join(' · ') || 'Miembro'

  function navigate(nextView: ViewName | NavigationTarget) {
    setProfileMenuOpen(false)
    onNavigate(nextView)
  }

  function requestInstall() {
    setProfileMenuOpen(false)
    if (installApp.needsIosInstructions && !installApp.canInstall) setIosInstructionsOpen(true)
    else void installApp.install()
  }

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 })
  }, [view])


  return (
    <div className={`app-shell${online ? '' : ' offline'}`}>
      <aside className="sidebar">
        <ClubBrand onClick={() => navigate('home')} />
        <AppNavigation items={navigation} settingsSection={settingsSection} view={view} onNavigate={navigate} />
        {showInstallAction && (
          <button className="sidebar-install" onClick={requestInstall} type="button">
            <Icon name="download" size={17} />Instalar aplicación
          </button>
        )}
        <NotificationButton count={notificationUnreadCount} onClick={() => setNotificationsOpen(true)} />
        <div className="sidebar-profile">
          {canEditProfile ? <button aria-label="Editar mis datos" className="sidebar-profile-edit" onClick={() => { setHighlightMissingProfileDetails(false); setProfileDetailsOpen(true) }} type="button">
            <Avatar name={profile.display_name} />
            <span><strong>{profile.display_name}</strong><small>{role}</small></span>
          </button> : <div className="sidebar-profile-summary"><Avatar name={profile.display_name} /><span><strong>{profile.display_name}</strong><small>{role}</small></span></div>}
          <button aria-label="Cerrar sesión" className="icon-button" onClick={onSignOut} title="Cerrar sesión">
            <Icon name="logout" size={18} />
          </button>
        </div>
      </aside>

      <main className="content" ref={contentRef}>
        <header className="mobile-header">
          <ClubBrand compact onClick={() => navigate('home')} />
          <MobileProfileMenu
            name={profile.display_name}
            email={email}
            role={role}
            open={profileMenuOpen}
            canEditProfile={canEditProfile}
            showInstallAction={showInstallAction}
            notificationUnreadCount={notificationUnreadCount}
            onOpenChange={setProfileMenuOpen}
            onOpenNotifications={() => setNotificationsOpen(true)}
            onEditProfile={() => { setHighlightMissingProfileDetails(false); setProfileDetailsOpen(true) }}
            onRequestInstall={requestInstall}
            onSignOut={onSignOut}
          />
        </header>
        {message && <div className="toast success"><Icon name="check" size={18} />{message}</div>}
        {errorMessage && <div className="toast error">{errorMessage}</div>}
        {!online && <div aria-live="polite" className="offline-banner"><Icon name="warning" size={17} /><span>Sin conexión. Puedes consultar esta pantalla, pero no guardar cambios.</span></div>}
        {children}
      </main>

      <AppNavigation mobile items={navigation} settingsSection={settingsSection} view={view} onNavigate={navigate} />
      {notificationsOpen && (
        <Modal className="notification-dialog" labelledBy="notification-center-title" onClose={() => setNotificationsOpen(false)}>
          <div className="notification-dialog-close"><button aria-label="Cerrar avisos" className="icon-button" onClick={() => setNotificationsOpen(false)} type="button">×</button></div>
          <NotificationCenter
            notifications={notifications}
            readIds={notificationReadIds}
            onReadAll={() => onNotificationsReadAll?.()}
            onOpen={(notification) => {
              setNotificationsOpen(false)
              if (notification.kind === 'profile' && canEditProfile) {
                setHighlightMissingProfileDetails(true)
                setProfileDetailsOpen(true)
                return
              }
              onNotificationRead?.(notification)
              if (onNotificationOpen) onNotificationOpen(notification)
              else navigate(notification.view)
            }}
          />
        </Modal>
      )}
      {iosInstructionsOpen && (
        <Modal className="install-dialog" labelledBy="install-dialog-title" onClose={() => setIosInstructionsOpen(false)}>
          <div className="task-detail-heading">
            <div><span className="eyebrow">INSTALAR EN IPHONE O IPAD</span><h2 id="install-dialog-title">Añade CDU Rugby a inicio</h2></div>
            <button aria-label="Cerrar" className="icon-button" onClick={() => setIosInstructionsOpen(false)} type="button">×</button>
          </div>
          <ol className="install-steps">
            <li><strong>1</strong><span>Abre esta página con Safari.</span></li>
            <li><strong>2</strong><span>Pulsa el botón <b>Compartir</b> de la barra del navegador.</span></li>
            <li><strong>3</strong><span>Selecciona <b>Añadir a pantalla de inicio</b> y confirma.</span></li>
          </ol>
          <div className="form-actions"><button className="primary-button" onClick={() => setIosInstructionsOpen(false)} type="button">Entendido</button></div>
        </Modal>
      )}
      {profileDetailsOpen && onUpdateProfileDetails && (
        <ViewErrorBoundary><Suspense fallback={<Modal labelledBy="profile-loading-title" onClose={() => setProfileDetailsOpen(false)}><h2 id="profile-loading-title">Datos de perfil</h2><SectionLoading /></Modal>}>
        <ProfileDetailsDialog
          licenseSummary={licenseSummary}
          currentBirthDate={profileDetails?.birth_date ?? ''}
          currentName={profile.display_name}
          currentPhone={profileDetails?.phone ?? ''}
          avatarPath={profile.avatar_path}
          email={profileDetails?.email ?? email}
          highlightMissing={highlightMissingProfileDetails}
          onClose={() => { setProfileDetailsOpen(false); setHighlightMissingProfileDetails(false) }}
          onLoadPhoto={onLoadProfilePhoto}
          onSave={onUpdateProfileDetails}
        />
        </Suspense></ViewErrorBoundary>
      )}
    </div>
  )
}

function profileRoles(profile: Profile) {
  return [
    profile.is_owner ? 'Owner' : '',
    profile.is_player ? 'Jugadora' : '',
    profile.is_coach ? 'Entrenador' : '',
    profile.is_viewer ? 'Dirección' : '',
  ].filter(Boolean)
}

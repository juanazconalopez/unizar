import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Profile, ProfileDetailsValues, ProfilePhotoChange, ProfilePrivateDetails, ViewName } from '../../types'
import { Icon } from '../Icon'
import type { IconName } from '../Icon'
import { Avatar } from '../ui/Avatar'
import { ClubBrand } from '../ui/ClubBrand'
import { Modal } from '../ui/Modal'
import { useInstallApp } from '../../hooks/useInstallApp'
import { NotificationCenter } from '../../features/notifications/NotificationCenter'
import { ProfileDetailsDialog } from '../../features/profile/ProfileDetailsDialog'
import type { AppNotification } from '../../features/notifications/notifications'
import { canManageSport, canViewTeamData, isPlayer } from '../../lib/permissions'

type NavigationItem = { id: ViewName; label: string; icon: IconName }

export function AppLayout({
  profile,
  profileDetails,
  email,
  view,
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
  profileDetails?: ProfilePrivateDetails | null
  email: string
  view: ViewName
  message: string
  errorMessage: string
  online?: boolean
  onNavigate: (view: ViewName) => void
  onSignOut: () => void
  onLoadProfilePhoto?: (path: string) => Promise<string>
  onUpdateProfileDetails?: (values: ProfileDetailsValues, photoChange?: ProfilePhotoChange) => Promise<void>
  notifications?: AppNotification[]
  notificationReadIds?: Set<string>
  notificationUnreadCount?: number
  onNotificationRead?: (notification: AppNotification) => void
  onNotificationOpen?: (notification: AppNotification) => void
  onNotificationsReadAll?: () => void
  children: ReactNode
}) {
  const contentRef = useRef<HTMLElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [iosInstructionsOpen, setIosInstructionsOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileDetailsOpen, setProfileDetailsOpen] = useState(false)
  const [highlightMissingProfileDetails, setHighlightMissingProfileDetails] = useState(false)
  const installApp = useInstallApp()
  const showInstallAction = installApp.canInstall || installApp.needsIosInstructions
  const canManage = canManageSport(profile)
  const canViewTeam = canViewTeamData(profile)
  const canEditProfile = profile.is_approved && profile.is_active && !profile.is_archived && Boolean(onUpdateProfileDetails)
  const navigation: NavigationItem[] = [
    { id: 'home', label: 'Inicio', icon: 'home' },
    ...(canViewTeam ? [
      { id: 'statistics' as const, label: 'Resumen', icon: 'statistics' as const },
    ] : []),
    ...(canManage
      ? [
          { id: 'calendar' as const, label: 'Calendario', icon: 'calendar' as const },
          { id: 'training' as const, label: 'Entrenamientos', icon: 'strategy' as const },
        ]
      : isPlayer(profile)
        ? [{ id: 'calendar' as const, label: 'Calendario', icon: 'calendar' as const }]
        : [{ id: 'matches' as const, label: 'Partidos', icon: 'calendar' as const }]),
    { id: 'competition', label: 'Competición', icon: 'trophy' },
    ...(canManage ? [
      { id: 'attendance' as const, label: 'Asistencia', icon: 'check' as const },
    ] : []),
    ...(profile.is_owner ? [
      { id: 'settings' as const, label: 'Ajustes', icon: 'settings' as const },
    ] : []),
  ]

  const role = profileRoles(profile).join(' · ') || 'Miembro'

  function navigate(nextView: ViewName) {
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

  useEffect(() => {
    if (!profileMenuOpen) return

    function closeOnOutsidePress(event: PointerEvent) {
      if (!profileMenuRef.current?.contains(event.target as Node)) setProfileMenuOpen(false)
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setProfileMenuOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsidePress)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [profileMenuOpen])

  return (
    <div className={`app-shell${online ? '' : ' offline'}`}>
      <aside className="sidebar">
        <ClubBrand onClick={() => navigate('home')} />
        <Navigation items={navigation} view={view} onNavigate={navigate} />
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
          <div className="mobile-profile-actions" ref={profileMenuRef}>
            <NotificationButton count={notificationUnreadCount} onClick={() => setNotificationsOpen(true)} />
            <button
              aria-expanded={profileMenuOpen}
              aria-haspopup="menu"
              aria-label="Abrir menú de usuario"
              className="mobile-avatar-button"
              onClick={() => setProfileMenuOpen((open) => !open)}
              type="button"
            >
              <Avatar name={profile.display_name} />
            </button>
            {profileMenuOpen && (
              <div className="mobile-profile-menu" role="menu">
                <div className="mobile-profile-summary">
                  <Avatar name={profile.display_name} />
                  <div>
                    <strong>{profile.display_name}</strong>
                    <span>{email || 'Cuenta de Google'}</span>
                  </div>
                </div>
                <span className="mobile-role">{role}</span>
                {canEditProfile && (
                  <button className="mobile-profile-edit-button" onClick={() => { setProfileMenuOpen(false); setHighlightMissingProfileDetails(false); setProfileDetailsOpen(true) }} role="menuitem" type="button">
                    Editar mis datos
                  </button>
                )}
                {showInstallAction && (
                  <button className="mobile-install-button" onClick={requestInstall} role="menuitem" type="button">
                    <Icon name="download" size={18} />Instalar aplicación
                  </button>
                )}
                <button
                  className="mobile-signout-button"
                  onClick={() => {
                    setProfileMenuOpen(false)
                    onSignOut()
                  }}
                  role="menuitem"
                  type="button"
                >
                  <Icon name="logout" size={18} />
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </header>
        {message && <div className="toast success"><Icon name="check" size={18} />{message}</div>}
        {errorMessage && <div className="toast error">{errorMessage}</div>}
        {!online && <div aria-live="polite" className="offline-banner"><Icon name="warning" size={17} /><span>Sin conexión. Puedes consultar esta pantalla, pero no guardar cambios.</span></div>}
        {children}
      </main>

      <Navigation mobile items={navigation} view={view} onNavigate={navigate} />
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
        <ProfileDetailsDialog
          currentBirthDate={profileDetails?.birth_date ?? ''}
          currentName={profile.display_name}
          currentPhone={profileDetails?.phone ?? ''}
          avatarPath={profile.avatar_path}
          canEditPhoto={profile.is_player}
          email={profileDetails?.email ?? email}
          highlightMissing={highlightMissingProfileDetails}
          onClose={() => { setProfileDetailsOpen(false); setHighlightMissingProfileDetails(false) }}
          onLoadPhoto={onLoadProfilePhoto}
          onSave={onUpdateProfileDetails}
        />
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

function NotificationButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button aria-label={count ? `Avisos, ${count} sin leer` : 'Avisos'} className="notification-button" onClick={onClick} type="button">
      <Icon name="bell" size={19} />
      {count > 0 && <span>{count > 9 ? '9+' : count}</span>}
    </button>
  )
}

function Navigation({ items, view, mobile = false, onNavigate }: {
  items: NavigationItem[]
  view: ViewName
  mobile?: boolean
  onNavigate: (view: ViewName) => void
}) {
  return (
    <nav aria-label={mobile ? 'Navegación móvil' : 'Navegación principal'} className={mobile ? 'mobile-nav' : undefined}>
      {items.map((item) => (
        <button
          className={mobile ? (view === item.id ? 'active' : '') : (view === item.id ? 'nav-item active' : 'nav-item')}
          key={item.id}
          onClick={() => onNavigate(item.id)}
        >
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Profile, ViewName } from '../../types'
import { Icon } from '../Icon'
import type { IconName } from '../Icon'
import { Avatar } from '../ui/Avatar'
import { ClubBrand } from '../ui/ClubBrand'

type NavigationItem = { id: ViewName; label: string; icon: IconName }

export function AppLayout({
  profile,
  email,
  view,
  message,
  errorMessage,
  onNavigate,
  onSignOut,
  children,
}: {
  profile: Profile
  email: string
  view: ViewName
  message: string
  errorMessage: string
  onNavigate: (view: ViewName) => void
  onSignOut: () => void
  children: ReactNode
}) {
  const contentRef = useRef<HTMLElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const navigation: NavigationItem[] = [
    { id: 'home', label: 'Inicio', icon: 'home' },
    ...(profile.is_owner ? [
      { id: 'statistics' as const, label: 'Resumen', icon: 'statistics' as const },
    ] : []),
    { id: 'tasks', label: 'Tareas', icon: 'tasks' },
    ...(!profile.is_collaborator || profile.is_owner ? [{ id: 'matches' as const, label: 'Partidos', icon: 'calendar' as const }] : []),
    ...(profile.is_owner ? [
      { id: 'attendance' as const, label: 'Asistencia', icon: 'check' as const },
      { id: 'settings' as const, label: 'Ajustes', icon: 'settings' as const },
    ] : []),
  ]

  const role = profile.is_owner ? 'Owner' : profile.is_collaborator ? 'Colaborador' : 'Jugador'

  function navigate(nextView: ViewName) {
    setProfileMenuOpen(false)
    onNavigate(nextView)
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
    <div className="app-shell">
      <aside className="sidebar">
        <ClubBrand onClick={() => navigate('home')} />
        <Navigation items={navigation} view={view} onNavigate={navigate} />
        <div className="sidebar-profile">
          <Avatar name={profile.display_name} />
          <div><strong>{profile.display_name}</strong><span>{role}</span></div>
          <button aria-label="Cerrar sesión" className="icon-button" onClick={onSignOut} title="Cerrar sesión">
            <Icon name="logout" size={18} />
          </button>
        </div>
      </aside>

      <main className="content" ref={contentRef}>
        <header className="mobile-header">
          <ClubBrand compact onClick={() => navigate('home')} />
          <div className="mobile-profile-actions" ref={profileMenuRef}>
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
        {children}
      </main>

      <Navigation mobile items={navigation} view={view} onNavigate={navigate} />
    </div>
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

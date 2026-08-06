import type { ReactNode } from 'react'
import type { Profile, ViewName } from '../../types'
import { Icon } from '../Icon'
import type { IconName } from '../Icon'
import { Avatar } from '../ui/Avatar'
import { ClubBrand } from '../ui/ClubBrand'

type NavigationItem = { id: ViewName; label: string; icon: IconName }

export function AppLayout({
  profile,
  view,
  message,
  errorMessage,
  onNavigate,
  onSignOut,
  children,
}: {
  profile: Profile
  view: ViewName
  message: string
  errorMessage: string
  onNavigate: (view: ViewName) => void
  onSignOut: () => void
  children: ReactNode
}) {
  const navigation: NavigationItem[] = [
    { id: 'home', label: 'Inicio', icon: 'home' },
    { id: 'tasks', label: 'Tareas', icon: 'tasks' },
    ...(profile.is_owner ? [
      { id: 'seasons' as const, label: 'Temporadas', icon: 'calendar' as const },
      { id: 'team' as const, label: 'Equipo', icon: 'users' as const },
    ] : []),
  ]

  const role = profile.is_owner ? 'Owner' : profile.is_collaborator ? 'Colaborador' : 'Jugador'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <ClubBrand onClick={() => onNavigate('home')} />
        <Navigation items={navigation} view={view} onNavigate={onNavigate} />
        <div className="sidebar-profile">
          <Avatar name={profile.display_name} />
          <div><strong>{profile.display_name}</strong><span>{role}</span></div>
          <button aria-label="Cerrar sesión" className="icon-button" onClick={onSignOut} title="Cerrar sesión">
            <Icon name="logout" size={18} />
          </button>
        </div>
      </aside>

      <main className="content">
        <header className="mobile-header">
          <ClubBrand compact onClick={() => onNavigate('home')} />
          <Avatar name={profile.display_name} />
        </header>
        {message && <div className="toast success"><Icon name="check" size={18} />{message}</div>}
        {errorMessage && <div className="toast error">{errorMessage}</div>}
        {children}
      </main>

      <Navigation mobile items={navigation} view={view} onNavigate={onNavigate} />
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

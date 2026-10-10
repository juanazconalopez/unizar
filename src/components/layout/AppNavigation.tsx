import { useEffect, useRef, useState } from 'react'
import { Icon } from '../Icon'
import type { NavigationTarget } from '../../lib/navigation'
import type { ViewName } from '../../types'
import { isNavigationGroup, type NavigationEntry, type NavigationGroup } from './navigationEntries'

export function AppNavigation({ items, settingsSection, view, mobile = false, onNavigate }: {
  items: NavigationEntry[]
  settingsSection?: 'team' | 'seasons' | 'library' | 'permissions'
  view: ViewName
  mobile?: boolean
  onNavigate: (view: ViewName | NavigationTarget) => void
}) {
  const [openGroup, setOpenGroup] = useState<NavigationGroup['id'] | null>(null)
  const navRef = useRef<HTMLElement>(null)
  const selectedSettingsSection = settingsSection ?? 'team'

  useEffect(() => {
    if (!openGroup) return
    function closeOnOutsidePress(event: PointerEvent) {
      if (!navRef.current?.contains(event.target as Node)) setOpenGroup(null)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenGroup(null)
    }
    document.addEventListener('pointerdown', closeOnOutsidePress)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [openGroup])

  return (
    <nav ref={navRef} aria-label={mobile ? 'Navegación móvil' : 'Navegación principal'} className={mobile ? 'mobile-nav' : undefined}>
      {items.map((item) => {
        const grouped = isNavigationGroup(item)
        const active = grouped ? item.children.some((child) => child.id === view) : view === item.id
        const itemClassName = mobile ? (active ? 'active' : '') : (active ? 'nav-item active' : 'nav-item')
        if (!grouped) {
          return <button className={itemClassName} key={item.id} onClick={() => { setOpenGroup(null); onNavigate(item.target ?? item.id) }} type="button">
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </button>
        }
        const expanded = openGroup === item.id
        return <div className={`nav-group${expanded ? ' open' : ''}`} key={item.id}>
          <button
            aria-expanded={expanded}
            aria-haspopup="menu"
            className={itemClassName}
            onClick={() => setOpenGroup((current) => current === item.id ? null : item.id)}
            type="button"
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
            <b aria-hidden="true" className="nav-group-chevron">⌄</b>
          </button>
          {expanded && <div className="nav-submenu" role="menu">
            {item.children.map((child) => (
              <button
                className={view === child.id && (!child.target?.settingsSection || child.target.settingsSection === selectedSettingsSection) ? 'active' : ''}
                key={`${item.id}-${child.label}`}
                onClick={() => { setOpenGroup(null); onNavigate(child.target ?? child.id) }}
                role="menuitem"
                type="button"
              >
                <Icon name={child.icon} size={16} />
                <span>{child.label}</span>
              </button>
            ))}
          </div>}
        </div>
      })}
    </nav>
  )
}

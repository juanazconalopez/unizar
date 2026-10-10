import { useEffect, useRef } from 'react'
import { Icon } from '../Icon'
import { Avatar } from '../ui/Avatar'

export function MobileProfileMenu({ name, email, role, open, canEditProfile, showInstallAction, notificationUnreadCount, onOpenChange, onOpenNotifications, onEditProfile, onRequestInstall, onSignOut }: {
  name: string
  email: string
  role: string
  open: boolean
  canEditProfile: boolean
  showInstallAction: boolean
  notificationUnreadCount: number
  onOpenChange: (open: boolean) => void
  onOpenNotifications: () => void
  onEditProfile: () => void
  onRequestInstall: () => void
  onSignOut: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    function closeOnOutsidePress(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) onOpenChange(false)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePress)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open, onOpenChange])

  return <div className="mobile-profile-actions" ref={menuRef}>
    <NotificationButton count={notificationUnreadCount} onClick={onOpenNotifications} />
    <button aria-expanded={open} aria-haspopup="menu" aria-label="Abrir menú de usuario" className="mobile-avatar-button" onClick={() => onOpenChange(!open)} type="button">
      <Avatar name={name} />
    </button>
    {open && <div className="mobile-profile-menu" role="menu">
      <div className="mobile-profile-summary">
        <Avatar name={name} />
        <div><strong>{name}</strong><span>{email || 'Cuenta de Google'}</span></div>
      </div>
      <span className="mobile-role">{role}</span>
      {canEditProfile && <button className="mobile-profile-edit-button" onClick={() => { onOpenChange(false); onEditProfile() }} role="menuitem" type="button">Editar mis datos</button>}
      {showInstallAction && <button className="mobile-install-button" onClick={onRequestInstall} role="menuitem" type="button"><Icon name="download" size={18} />Instalar aplicación</button>}
      <button className="mobile-signout-button" onClick={() => { onOpenChange(false); onSignOut() }} role="menuitem" type="button"><Icon name="logout" size={18} />Cerrar sesión</button>
    </div>}
  </div>
}

export function NotificationButton({ count, onClick }: { count: number; onClick: () => void }) {
  return <button aria-label={count ? `Avisos, ${count} sin leer` : 'Avisos'} className="notification-button" onClick={onClick} type="button">
    <Icon name="bell" size={19} />
    {count > 0 && <span>{count > 9 ? '9+' : count}</span>}
  </button>
}

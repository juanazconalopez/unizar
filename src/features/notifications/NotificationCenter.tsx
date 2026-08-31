import { formatDate } from '../../lib/dates'
import type { AppNotification } from './notifications'

export function NotificationCenter({ notifications, readIds, onOpen, onReadAll }: {
  notifications: AppNotification[]
  readIds: Set<string>
  onOpen: (notification: AppNotification) => void
  onReadAll: () => void
}) {
  return (
    <section className="notification-center" aria-label="Avisos">
      <header>
        <div><span className="eyebrow">ACTUALIDAD</span><h2 id="notification-center-title">Avisos</h2></div>
        {notifications.some((notification) => !notification.persistent) && <button className="text-button" onClick={onReadAll} type="button">Limpiar avisos</button>}
      </header>
      <div className="notification-list">
        {notifications.map((notification) => (
          <button
            className={readIds.has(notification.id) && !notification.persistent ? `notification-item ${notification.kind}` : `notification-item ${notification.kind} unread`}
            key={notification.id}
            onClick={() => onOpen(notification)}
            type="button"
          >
            <i aria-hidden="true" />
            <span><strong>{notification.title}</strong><small>{notification.text}</small></span>
            <time dateTime={notification.occurredAt}>{formatDate(notification.occurredAt.slice(0, 10), { day: 'numeric', month: 'short' })}</time>
          </button>
        ))}
        {!notifications.length && <p>No hay avisos pendientes. Todo está al día.</p>}
      </div>
    </section>
  )
}

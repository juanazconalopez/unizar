import { useId, useState } from 'react'
import { Icon } from '../../components/Icon'
import { RichContent } from '../../components/RichContent'
import { Modal } from '../../components/ui/Modal'
import { contentImageIds, stripContentImageTokens } from '../../lib/contentImageTokens'
import { formatDate } from '../../lib/dates'
import type { ReactNode } from 'react'
import type { TeamAnnouncement } from '../../types'

export function AnnouncementCard({ announcement, actions, initialOpen = false }: {
  announcement: TeamAnnouncement
  actions?: ReactNode
  initialOpen?: boolean
}) {
  const titleId = useId()
  const [open, setOpen] = useState(initialOpen)
  const descriptionText = stripContentImageTokens(announcement.description)
  const imageCount = contentImageIds(announcement.description).length
  return (
    <article className={`announcement-card${actions ? '' : ' announcement-card-readonly'}`}>
      <button aria-label={`Ver aviso ${announcement.title}`} className="task-card-detail-link" onClick={() => setOpen(true)} type="button" />
      <span className="announcement-card-icon"><Icon name="bell" size={18} /></span>
      <div className="announcement-card-main">
        <span className="eyebrow">AVISO · {formatDate(announcement.announcement_date, { weekday: 'long', day: 'numeric', month: 'short' })}</span>
        <h3>{announcement.title}</h3>
        {descriptionText && <p>{descriptionText}</p>}
        {imageCount > 0 && <span className="content-image-count">📎 {imageCount} {imageCount === 1 ? 'imagen' : 'imágenes'}</span>}
      </div>
      {actions && <div className="announcement-card-side">
        <span className={`announcement-status ${announcement.status}`}>{announcement.status === 'published' ? 'Publicada' : announcement.status === 'draft' ? 'Borrador' : 'Anulada'}</span>
        <div className="task-actions">{actions}</div>
      </div>}
      {open && <Modal labelledBy={titleId} onClose={() => setOpen(false)}>
        <div className="task-detail-heading"><div><span className="eyebrow">AVISO · {formatDate(announcement.announcement_date)}</span><h2 id={titleId}>{announcement.title}</h2></div><button aria-label="Cerrar aviso" className="icon-button" onClick={() => setOpen(false)} type="button">×</button></div>
        <div className="task-detail-description"><RichContent fallback="Este aviso no tiene información adicional." text={announcement.description} /></div>
      </Modal>}
    </article>
  )
}

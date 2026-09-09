import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { ContentImageTextarea } from '../../components/ContentImageTextarea'
import { SeasonContextField } from '../../components/SeasonContextField'
import { Modal } from '../../components/ui/Modal'
import { todayIso } from '../../lib/dates'
import { errorText } from '../../lib/errors'
import { seasonForDate } from '../../lib/selectors'
import type { AnnouncementValues, Season, TaskStatus, TeamAnnouncement } from '../../types'

export function AnnouncementForm({ announcement, initialDate, seasons, canPublish = true, onCancel, onDelete, onSubmit }: {
  announcement?: TeamAnnouncement
  initialDate: string
  seasons: Season[]
  canPublish?: boolean
  onCancel: () => void
  onDelete?: (announcement: TeamAnnouncement) => Promise<void>
  onSubmit: (values: AnnouncementValues) => Promise<void>
}) {
  const titleId = useId()
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')
  const [description, setDescription] = useState(announcement?.description ?? '')
  const selectedSeason = announcement
    ? seasons.find((season) => season.id === announcement.season_id)
    : seasonForDate(seasons, todayIso())

  function close() {
    if (dirty && !window.confirm('Hay cambios sin guardar. ¿Quieres cerrar el formulario?')) return
    onCancel()
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      await onSubmit({
        seasonId: String(form.get('seasonId')),
        date: String(form.get('date')),
        title: String(form.get('title')),
        description: String(form.get('description')),
        status: String(form.get('status')) as TaskStatus,
      })
    } catch (caught) {
      setError(errorText(caught))
      setBusy(false)
    }
  }

  async function remove() {
    if (!announcement || !onDelete || !window.confirm(`¿Eliminar el aviso “${announcement.title}”?`)) return
    setBusy(true)
    setError('')
    try { await onDelete(announcement) } catch (caught) { setError(errorText(caught)); setBusy(false) }
  }

  return (
    <Modal className="panel-form task-form-dialog announcement-form-dialog" disabled={busy} labelledBy={titleId} onClose={close} onFormChange={() => setDirty(true)} onSubmit={submit}>
      <div className="panel-form-heading">
        <div><span className="eyebrow">{announcement ? 'EDITAR AVISO' : 'NUEVO AVISO'}</span><h2 id={titleId}>{announcement ? 'Editar aviso' : 'Crear aviso'}</h2></div>
        <button aria-label="Cerrar" className="icon-button" disabled={busy} onClick={close} type="button">×</button>
      </div>
      <div className="form-grid">
        <label>Título<input autoFocus defaultValue={announcement?.title} name="title" placeholder="Ej. Cambio de horario" required /></label>
        <SeasonContextField creation={!announcement} season={selectedSeason} />
        <label>Fecha<input defaultValue={announcement?.announcement_date ?? initialDate} name="date" required type="date" /></label>
        <label>Estado<select disabled={!canPublish} defaultValue={announcement?.status ?? (canPublish ? 'published' : 'draft')} name="status">{(canPublish || announcement?.status === 'published') && <option value="published">Publicado</option>}<option value="draft">Borrador</option>{announcement && (canPublish || announcement.status === 'cancelled') && <option value="cancelled">Anulado</option>}</select></label>
        <ContentImageTextarea className="full-field task-form-description" label="Descripción" name="description" onChange={(value) => { setDescription(value); setDirty(true) }} placeholder="Información que debe conocer el equipo…" rows={7} value={description} />
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        {announcement && onDelete && <button className="danger-button task-form-delete" disabled={busy} onClick={() => void remove()} type="button">Eliminar aviso</button>}
        <button className="secondary-button" disabled={busy} onClick={close} type="button">Cancelar</button>
        <button className="primary-button" disabled={busy || !selectedSeason}>{busy ? 'Guardando…' : announcement ? 'Guardar cambios' : 'Crear aviso'}</button>
      </div>
    </Modal>
  )
}

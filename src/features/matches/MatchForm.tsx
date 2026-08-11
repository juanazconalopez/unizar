import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from '../../components/ui/Modal'
import { errorText } from '../../lib/errors'
import { todayIso } from '../../lib/dates'
import type { Match, MatchKind, MatchStatus, MatchValues, RugbyFormat, Season } from '../../types'

export function MatchForm({ initialDate, match, seasons, onCancel, onDelete, onSubmit }: {
  initialDate?: string
  match?: Match
  seasons: Season[]
  onCancel: () => void
  onDelete?: (match: Match) => Promise<void>
  onSubmit: (values: MatchValues) => Promise<void>
}) {
  const titleId = useId()
  const structureLocked = Boolean(match?.lineup_published)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  function requestCancel() {
    if (dirty && !window.confirm('Hay cambios sin guardar. ¿Quieres cerrar el formulario?')) return
    onCancel()
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSaving(true); setError('')
    try {
      await onSubmit({
        seasonId: String(form.get('seasonId')), opponent: String(form.get('opponent')),
        matchDate: String(form.get('matchDate')), kickoffTime: String(form.get('kickoffTime')),
        venue: String(form.get('venue')), isHome: form.get('isHome') === 'true', notes: String(form.get('notes')),
        status: String(form.get('status')) as MatchStatus,
        matchKind: String(form.get('matchKind')) as MatchKind,
        rugbyFormat: String(form.get('rugbyFormat')) as RugbyFormat,
      })
    } catch (caught) { setError(errorText(caught)); setSaving(false) }
  }
  async function remove() {
    if (!match || !onDelete || !window.confirm(`¿Eliminar el partido contra ${match.opponent}? Se eliminarán disponibilidad y alineación.`)) return
    setSaving(true)
    try { await onDelete(match) } catch (caught) { setError(errorText(caught)); setSaving(false) }
  }
  return <Modal className="panel-form match-form-dialog" disabled={saving} labelledBy={titleId} onClose={requestCancel} onFormChange={() => setDirty(true)} onSubmit={submit}>
    <div className="panel-form-heading"><div><span className="eyebrow">PARTIDO</span><h2 id={titleId}>{match ? 'Editar partido' : 'Nuevo partido'}</h2></div><button aria-label="Cerrar" className="icon-button" onClick={requestCancel} type="button">×</button></div>
    <div className="form-grid">
      <label>Rival<input autoFocus defaultValue={match?.opponent} name="opponent" required /></label>
      <label>Temporada<select defaultValue={match?.season_id ?? ''} disabled={structureLocked} name="seasonId" required><option disabled value="">Seleccionar…</option>{seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</select>{structureLocked && <input name="seasonId" type="hidden" value={match?.season_id} />}</label>
      <label>Fecha<input defaultValue={match?.match_date ?? initialDate ?? todayIso()} disabled={structureLocked} name="matchDate" required type="date" />{structureLocked && <input name="matchDate" type="hidden" value={match?.match_date} />}</label>
      <label>Hora<input defaultValue={match?.kickoff_time?.slice(0, 5) ?? ''} name="kickoffTime" type="time" /></label>
      <label>Campo o localidad<input defaultValue={match?.venue ?? ''} name="venue" /></label>
      <label>Condición<select defaultValue={String(match?.is_home ?? true)} name="isHome"><option value="true">Local</option><option value="false">Visitante</option></select></label>
      <label>Tipo de partido<select defaultValue={match?.match_kind ?? 'official'} disabled={structureLocked} name="matchKind"><option value="official">Oficial</option><option value="friendly">Amistoso</option></select>{structureLocked && <input name="matchKind" type="hidden" value={match?.match_kind} />}</label>
      <label>Formato<select defaultValue={match?.rugby_format ?? 'xv'} disabled={structureLocked} name="rugbyFormat"><option value="xv">Rugby XV</option><option value="sevens">Rugby Seven</option></select>{structureLocked && <input name="rugbyFormat" type="hidden" value={match?.rugby_format} />}</label>
      <label className="full-field">Notas<textarea defaultValue={match?.notes ?? ''} name="notes" rows={4} /></label>
      <label>Estado<select defaultValue={match?.status ?? 'draft'} name="status"><option value="draft">Borrador</option><option value="published">Publicado</option><option value="cancelled">Cancelado</option><option value="completed">Finalizado</option></select></label>
    </div>
    {structureLocked && <p className="form-hint">La temporada, fecha y formato están bloqueados porque la convocatoria ya se publicó.</p>}
    {error && <p className="form-error">{error}</p>}
    <div className="form-actions">{match && onDelete && <button className="danger-button task-form-delete" onClick={() => void remove()} type="button">Eliminar partido</button>}<button className="secondary-button" onClick={requestCancel} type="button">Cancelar</button><button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Guardar partido'}</button></div>
  </Modal>
}

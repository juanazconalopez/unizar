import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { SeasonContextField } from '../../components/SeasonContextField'
import { Modal } from '../../components/ui/Modal'
import { errorText } from '../../lib/errors'
import { todayIso } from '../../lib/dates'
import { seasonForDate } from '../../lib/selectors'
import { competitionsForSeason } from '../../lib/seasonCompetitions'
import type { Match, MatchKind, MatchStatus, MatchValues, RugbyFormat, Season, SeasonCompetition } from '../../types'

export function MatchForm({ competitions = [], initialDate, match, seasons, onCancel, onDelete, onSubmit }: {
  competitions?: SeasonCompetition[]
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
  const [matchDate, setMatchDate] = useState(match?.match_date ?? initialDate ?? todayIso())
  const [matchKind, setMatchKind] = useState<MatchKind>(match?.match_kind ?? 'official')
  const selectedSeason = match
    ? seasons.find((season) => season.id === match.season_id)
    : seasonForDate(seasons, matchDate)
  const availableCompetitions = competitionsForSeason(competitions, selectedSeason?.id)
  const [competitionId, setCompetitionId] = useState(match?.competition_id ?? availableCompetitions.find((competition) => competition.is_default)?.id ?? '')

  function changeDate(nextDate: string) {
    setMatchDate(nextDate)
    if (match) return
    const nextSeason = seasonForDate(seasons, nextDate)
    const nextCompetitions = competitionsForSeason(competitions, nextSeason?.id)
    if (!nextCompetitions.some((competition) => competition.id === competitionId)) {
      setCompetitionId(nextCompetitions.find((competition) => competition.is_default)?.id ?? '')
    }
  }
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
        competitionId: matchKind === 'official' ? competitionId : '',
        matchDate: String(form.get('matchDate')), kickoffTime: String(form.get('kickoffTime')),
        venue: String(form.get('venue')), callupTime: String(form.get('callupTime')), callupVenue: String(form.get('callupVenue')),
        isHome: form.get('isHome') === 'true', notes: String(form.get('notes')),
        status: String(form.get('status')) as MatchStatus,
        matchKind,
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
      <SeasonContextField creation={!match} season={selectedSeason} />
      <label>Fecha<input disabled={structureLocked} name="matchDate" onChange={(event) => changeDate(event.target.value)} required type="date" value={matchDate} />{structureLocked && <input name="matchDate" type="hidden" value={match?.match_date} />}</label>
      <label>Hora<input defaultValue={match?.kickoff_time?.slice(0, 5) ?? ''} name="kickoffTime" type="time" /></label>
      <label>Campo o localidad<input defaultValue={match?.venue ?? ''} name="venue" /></label>
      <label>Hora de convocatoria<input defaultValue={match?.callup_time?.slice(0, 5) ?? ''} name="callupTime" type="time" /></label>
      <label>Lugar de convocatoria<input defaultValue={match?.callup_venue ?? ''} name="callupVenue" placeholder="Ej. aparcamiento del campus" /></label>
      <label>Condición<select defaultValue={String(match?.is_home ?? true)} name="isHome"><option value="true">Local</option><option value="false">Visitante</option></select></label>
      <label>Tipo de partido<select disabled={structureLocked} name="matchKind" onChange={(event) => setMatchKind(event.target.value as MatchKind)} value={matchKind}><option value="official">Oficial</option><option value="friendly">Amistoso</option></select>{structureLocked && <input name="matchKind" type="hidden" value={match?.match_kind} />}</label>
      {matchKind === 'official' && <label>Competición<select disabled={structureLocked || !availableCompetitions.length} name="competitionId" onChange={(event) => setCompetitionId(event.target.value)} required value={competitionId}><option disabled value="">Selecciona una competición</option>{availableCompetitions.map((competition) => <option key={competition.id} value={competition.id}>{competition.name}{competition.is_default ? ' · Predeterminada' : ''}</option>)}</select>{structureLocked && <input name="competitionId" type="hidden" value={competitionId} />}{!availableCompetitions.length && <small className="field-hint">Crea primero una competición dentro de esta temporada.</small>}</label>}
      <label>Formato<select defaultValue={match?.rugby_format ?? 'xv'} disabled={structureLocked} name="rugbyFormat"><option value="xv">Rugby XV</option><option value="sevens">Rugby Seven</option></select>{structureLocked && <input name="rugbyFormat" type="hidden" value={match?.rugby_format} />}</label>
      <label className="full-field">Notas<textarea defaultValue={match?.notes ?? ''} name="notes" rows={4} /></label>
      <label>Estado<select defaultValue={match?.status ?? 'draft'} name="status"><option value="draft">Borrador</option><option value="published">Publicado</option><option value="cancelled">Cancelado</option><option value="completed">Finalizado</option></select></label>
    </div>
    {structureLocked && <p className="form-hint">La temporada, fecha y formato están bloqueados porque la convocatoria ya se publicó.</p>}
    {error && <p className="form-error">{error}</p>}
    <div className="form-actions">{match && onDelete && <button className="danger-button task-form-delete" onClick={() => void remove()} type="button">Eliminar partido</button>}<button className="secondary-button" onClick={requestCancel} type="button">Cancelar</button><button className="primary-button" disabled={saving || !selectedSeason || (matchKind === 'official' && !competitionId)}>{saving ? 'Guardando…' : 'Guardar partido'}</button></div>
  </Modal>
}

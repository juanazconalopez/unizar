import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { SeasonContextField } from '../../components/SeasonContextField'
import { Modal } from '../../components/ui/Modal'
import { errorText } from '../../lib/errors'
import { todayIso } from '../../lib/dates'
import { seasonForDate } from '../../lib/selectors'
import { competitionsForSeason } from '../../lib/seasonCompetitions'
import type { Match, MatchKind, MatchStatus, MatchValues, RugbyFormat, Season, SeasonCompetition, SeasonTeam } from '../../types'

export function MatchForm({ competitions = [], teams = [], canManageInternal = false, initialDate, match, pairedMatch, seasons, onCancel, onDelete, onSubmit }: {
  competitions?: SeasonCompetition[]
  teams?: SeasonTeam[]
  canManageInternal?: boolean
  pairedMatch?: Match
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
  const availableTeams = teams.filter((team) => team.season_id === selectedSeason?.id && team.is_active)
  const internalTeams = availableTeams.filter((team) => !team.is_mixed)
  const [competitionId, setCompetitionId] = useState(match?.competition_id ?? availableCompetitions.find((competition) => competition.is_default)?.id ?? '')
  const [teamId, setTeamId] = useState(match?.team_id ?? availableTeams.find((team) => team.is_default)?.id ?? '')
  const [opponentTeamId, setOpponentTeamId] = useState(match?.internal_fixture_id ? pairedMatch?.team_id ?? '' : '')
  const [internalMode, setInternalMode] = useState(Boolean(match?.internal_fixture_id))

  function changeDate(nextDate: string) {
    setMatchDate(nextDate)
    if (match) return
    const nextSeason = seasonForDate(seasons, nextDate)
    const nextCompetitions = competitionsForSeason(competitions, nextSeason?.id)
    if (!nextCompetitions.some((competition) => competition.id === competitionId)) {
      setCompetitionId(nextCompetitions.find((competition) => competition.is_default)?.id ?? '')
    }
    const nextTeams = teams.filter((team) => team.season_id === nextSeason?.id && team.is_active && (!internalMode || !team.is_mixed))
    if (!nextTeams.some((team) => team.id === teamId)) setTeamId(nextTeams.find((team) => team.is_default)?.id ?? nextTeams[0]?.id ?? '')
    if (!nextTeams.some((team) => team.id === opponentTeamId)) setOpponentTeamId('')
  }
  function changeInternalMode(next: boolean) {
    setInternalMode(next)
    if (next && !internalTeams.some((team) => team.id === teamId)) setTeamId(internalTeams[0]?.id ?? '')
    if (!next) setOpponentTeamId('')
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
      if (internalMode && (!internalTeams.some((team) => team.id === teamId) || !internalTeams.some((team) => team.id === opponentTeamId) || teamId === opponentTeamId)) throw new Error('Selecciona dos equipos competitivos distintos.')
      await onSubmit({
        seasonId: String(form.get('seasonId')), opponent: String(form.get('opponent')),
        competitionId: matchKind === 'official' ? competitionId : '',
        matchDate: String(form.get('matchDate')), kickoffTime: String(form.get('kickoffTime')),
        venue: String(form.get('venue')), callupTime: String(form.get('callupTime')), callupVenue: String(form.get('callupVenue')),
        isHome: form.get('isHome') === 'true', notes: String(form.get('notes')),
        status: String(form.get('status')) as MatchStatus,
        matchKind,
        rugbyFormat: String(form.get('rugbyFormat')) as RugbyFormat,
        teamId,
        opponentTeamId: internalMode ? opponentTeamId : undefined,
      })
    } catch (caught) { setError(errorText(caught)); setSaving(false) }
  }
  async function remove() {
    if (!match || !onDelete || !window.confirm(`¿Eliminar el partido contra ${match.opponent}? ${match.internal_fixture_id ? 'Se eliminarán ambas fichas y convocatorias.' : 'Se eliminarán disponibilidad y alineación.'}`)) return
    setSaving(true)
    try { await onDelete(match) } catch (caught) { setError(errorText(caught)); setSaving(false) }
  }
  return <Modal className="panel-form match-form-dialog" disabled={saving} labelledBy={titleId} onClose={requestCancel} onFormChange={() => setDirty(true)} onSubmit={submit}>
    <div className="panel-form-heading"><div><span className="eyebrow">PARTIDO</span><h2 id={titleId}>{match ? 'Editar partido' : 'Nuevo partido'}</h2></div><button aria-label="Cerrar" className="icon-button" onClick={requestCancel} type="button">×</button></div>
    <div className="form-grid">
      {internalMode ? <input name="opponent" type="hidden" value={match?.opponent ?? availableTeams.find((team) => team.id === opponentTeamId)?.name ?? ''} /> : <label>Rival<input autoFocus defaultValue={match?.opponent} name="opponent" required /></label>}
      {canManageInternal && !match && matchKind === 'official' && <label className="full-field">Tipo de rival<select aria-label="Tipo de rival" onChange={(event) => changeInternalMode(event.target.value === 'internal')} value={internalMode ? 'internal' : 'external'}><option value="external">Rival externo</option><option value="internal">Otro equipo del CDU</option></select></label>}
      <SeasonContextField creation={!match} season={selectedSeason} />
      <label>Fecha<input disabled={structureLocked} name="matchDate" onChange={(event) => changeDate(event.target.value)} required type="date" value={matchDate} />{structureLocked && <input name="matchDate" type="hidden" value={match?.match_date} />}</label>
      <label>Hora<input defaultValue={match?.kickoff_time?.slice(0, 5) ?? ''} name="kickoffTime" type="time" /></label>
      <label>Campo o localidad<input defaultValue={match?.venue ?? ''} name="venue" /></label>
      <label>Hora de convocatoria<input defaultValue={match?.callup_time?.slice(0, 5) ?? ''} name="callupTime" type="time" /></label>
      <label>Lugar de convocatoria<input defaultValue={match?.callup_venue ?? ''} name="callupVenue" placeholder="Ej. aparcamiento del campus" /></label>
      <label>Condición<select disabled={internalMode} defaultValue={String(match?.is_home ?? true)} name="isHome"><option value="true">Local</option><option value="false">Visitante</option></select></label>
      <label>Tipo de partido<select disabled={structureLocked || internalMode} name="matchKind" onChange={(event) => setMatchKind(event.target.value as MatchKind)} value={matchKind}><option value="official">Oficial</option><option value="friendly">Amistoso</option></select>{structureLocked && <input name="matchKind" type="hidden" value={match?.match_kind} />}</label>
      <label>{internalMode ? 'Equipo local' : matchKind === 'official' ? 'Equipo' : 'Equipo organizador'}<select disabled={structureLocked || Boolean(match?.internal_fixture_id) || !(internalMode ? internalTeams : availableTeams).length} name="teamId" onChange={(event) => { setTeamId(event.target.value); if (event.target.value === opponentTeamId) setOpponentTeamId('') }} value={teamId}><option value="">{matchKind === 'official' ? 'Selecciona un equipo' : 'Sin equipo organizador'}</option>{(internalMode ? internalTeams : availableTeams).map((team) => <option key={team.id} value={team.id}>{team.name}{team.is_mixed ? ' · Mixto' : ''}</option>)}</select>{(structureLocked || Boolean(match?.internal_fixture_id)) && <input name="teamId" type="hidden" value={teamId} />}{matchKind === 'official' && !availableTeams.length && <small className="field-hint">Crea primero un equipo para esta temporada.</small>}</label>
      {internalMode && internalTeams.length < 2 && <p className="field-hint full-field">Crea dos equipos competitivos activos en esta temporada para organizar un derbi.</p>}
      {internalMode && <label>Equipo visitante<select aria-label="Equipo visitante" disabled={Boolean(match?.internal_fixture_id)} onChange={(event) => setOpponentTeamId(event.target.value)} required value={opponentTeamId}><option value="">Selecciona un equipo</option>{internalTeams.filter((team) => team.id !== teamId).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>}
      {matchKind === 'official' && <label>Competición<select disabled={structureLocked || !availableCompetitions.length} name="competitionId" onChange={(event) => setCompetitionId(event.target.value)} required value={competitionId}><option disabled value="">Selecciona una competición</option>{availableCompetitions.map((competition) => <option key={competition.id} value={competition.id}>{competition.name}{competition.is_default ? ' · Predeterminada' : ''}</option>)}</select>{structureLocked && <input name="competitionId" type="hidden" value={competitionId} />}{!availableCompetitions.length && <small className="field-hint">Crea primero una competición dentro de esta temporada.</small>}</label>}
      <label>Formato<select defaultValue={match?.rugby_format ?? 'xv'} disabled={structureLocked} name="rugbyFormat"><option value="xv">Rugby XV</option><option value="sevens">Rugby Seven</option></select>{structureLocked && <input name="rugbyFormat" type="hidden" value={match?.rugby_format} />}</label>
      <label className="full-field">Notas<textarea defaultValue={match?.notes ?? ''} name="notes" rows={4} /></label>
      <label>Estado<select defaultValue={match?.status ?? 'draft'} name="status"><option value="draft">Borrador</option><option value="published">Publicado</option><option value="cancelled">Cancelado</option><option value="completed">Finalizado</option></select></label>
    </div>
    {structureLocked && <p className="form-hint">La temporada, fecha y formato están bloqueados porque la convocatoria ya se publicó.</p>}
    {error && <p className="form-error">{error}</p>}
    <div className="form-actions">{match && onDelete && <button className="danger-button task-form-delete" onClick={() => void remove()} type="button">Eliminar partido</button>}<button className="secondary-button" onClick={requestCancel} type="button">Cancelar</button><button className="primary-button" disabled={saving || !selectedSeason || (matchKind === 'official' && !competitionId) || (internalMode && internalTeams.length < 2)}>{saving ? 'Guardando…' : 'Guardar partido'}</button></div>
  </Modal>
}

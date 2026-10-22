import type { SessionQueryCache } from '../../services/sessionQueryCache'
import { navigationResourceKeys } from '../../services/navigationResources'
import { useCallback, useEffect, useRef, useState } from 'react'
import { SectionError, SectionLoading } from '../../components/AsyncViewState'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/ui/Modal'
import { PageHeader } from '../../components/ui/PageHeader'
import { formatDate, todayInMadridIso } from '../../lib/dates'
import { errorText } from '../../lib/errors'
import { trainingGroupsApi } from '../../services/trainingGroupsService'
import type { Season } from '../../types'
import { fetchGroupState, type GroupState } from './trainingGroupState'
import { generateTrainingGroups, retainTrainingGroupAssignments } from './generateTrainingGroups'
import { TrainingGroupColumns } from './TrainingGroupColumns'
import { TrainingGroupUnassigned } from './TrainingGroupUnassigned'
import { currentTrainingGroupBlock, groupColorLabel, groupShirtLabel, trainingGroupBalance, trainingGroupRenewal } from './trainingGroupSelectors'
import type { TrainingGroupsApi } from './types'

export function TrainingGroupsView({ resources, seasons, userId, canManage, canPublish, onChanged, api = trainingGroupsApi }: {
  resources?: SessionQueryCache; seasons: Season[]; userId: string; canManage: boolean; canPublish: boolean; onChanged?: () => void; api?: TrainingGroupsApi
}) {
  const today = todayInMadridIso()
  const season = seasons.find((item) => item.start_date <= today && item.end_date >= today)
    ?? [...seasons].sort((a, b) => b.start_date.localeCompare(a.start_date))[0]
  return <div className="page training-groups-page">
    <PageHeader eyebrow="EQUIPO" title="Grupos de entrenamiento" subtitle="Dos grupos para entrenar juntas. Un nuevo reparto cada tres semanas." />
    {season ? <TrainingGroupSeason resources={resources} key={`${season.id}:${userId}:${canManage}:${canPublish}`} season={season} userId={userId} canManage={canManage} canPublish={canPublish} api={api} onChanged={onChanged} /> : <p>No hay temporadas disponibles.</p>}
  </div>
}

function TrainingGroupSeason({ resources, season, userId, canManage, canPublish, api, onChanged }: {
  resources?: SessionQueryCache; season: Season; userId: string; canManage: boolean; canPublish: boolean; api: TrainingGroupsApi; onChanged?: () => void
}) {
  const today = todayInMadridIso()
  const resourceKey = navigationResourceKeys.trainingGroups(season.id, canManage)
  const [state, setState] = useState<GroupState | undefined>(() => resources?.peek(resourceKey))
  const [loading, setLoading] = useState(!resources?.peek(resourceKey))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [dirty, setDirty] = useState(false)
  const [confirm, setConfirm] = useState<'publish' | 'discard' | 'regenerate' | null>(null)
  const requestId = useRef(0)
  const block = state?.summary.blocks.find((item) => item.id === state.selectedId)
  const current = state && currentTrainingGroupBlock(state.summary.blocks, today)
  const renewal = current ? trainingGroupRenewal(current, today) : null
  const players = state?.editing ? state.workspace.candidates : state?.workspace.members ?? []
  const balance = trainingGroupBalance(players, state?.assignments ?? [])
  const pending = state?.workspace.candidates.filter((player) => !state.assignments.some((entry) => entry.player_id === player.player_id)) ?? []
  const invalid = state?.editing ? state.assignments.filter((entry) => !players.some((player) => player.player_id === entry.player_id)).length : 0
  const ended = season.end_date < today

  const load = useCallback(async (date?: string, newProposal = false, force = true) => {
    const request = ++requestId.current
    setLoading(!resources?.peek(resourceKey) || date !== undefined || newProposal)
    setError('')
    try {
      const fetcher = () => fetchGroupState(api, season, canManage, date, newProposal)
      const next = await (resources && date === undefined && !newProposal ? resources.load(resourceKey, fetcher, { force }) : fetcher())
      if (request !== requestId.current) return
      setState(next)
      setDirty(newProposal)
    } catch (cause) { if (request === requestId.current) setError(errorText(cause)) }
    finally { if (request === requestId.current) setLoading(false) }
  }, [api, canManage, resourceKey, resources, season])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(undefined, false, false), 0)
    return () => { window.clearTimeout(timer); requestId.current += 1 }
  }, [load])

  // No se reemplaza una revisión en curso al recuperar el foco.
  useEffect(() => {
    const refresh = () => { if (!dirty && !busy && !state?.editing && document.visibilityState === 'visible') void load() }
    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh) }
  }, [busy, dirty, load, state?.editing, state?.selectedId])

  function updateDraft(next: GroupState) {
    // Una respuesta iniciada antes de editar no puede sustituir el borrador.
    requestId.current += 1
    setLoading(false)
    setState(next)
    setDirty(true)
  }

  async function refreshRoster() {
    if (!state) return
    const request = ++requestId.current
    setLoading(true); setError(''); setMessage('')
    try {
      const workspace = await api.workspace(season.id, state.selectedId, state.rosterDate, true)
      if (request !== requestId.current) return
      setState((previous) => previous ? { ...previous, workspace } : previous)
      setMessage('Plantilla actualizada. Se conservan tus cambios y las incorporaciones quedan sin grupo para que decidas.')
    } catch (cause) { if (request === requestId.current) setError(errorText(cause)) }
    finally { if (request === requestId.current) setLoading(false) }
  }

  async function save() {
    if (!state) return
    setBusy(true); setError(''); setMessage('')
    try {
      await api.saveDraft({ seasonId: season.id, startsOn: state.rosterDate, members: state.assignments, blockId: block?.id, expectedVersion: block?.version })
      await load()
      setMessage('Borrador guardado. Las jugadoras siguen viendo el reparto publicado.')
    } catch (cause) { setError(errorText(cause)) }
    finally { setBusy(false) }
  }

  async function applyConfirmation() {
    if (!state) return
    if (confirm === 'regenerate') {
      updateDraft({ ...state, assignments: generateTrainingGroups(state.workspace.candidates, state.workspace.members) })
      setConfirm(null); return
    }
    if (!block) return
    setBusy(true); setError(''); setMessage('')
    try {
      if (confirm === 'publish') await api.publish(block.id, block.version)
      else await api.discardDraft(block.id, block.version)
      await load()
      setMessage(confirm === 'publish' ? 'Grupos publicados. Cada jugadora verá el aviso de su grupo en la campana.' : 'Borrador descartado.')
      onChanged?.()
      setConfirm(null)
    } catch (cause) { setConfirm(null); setError(errorText(cause)) }
    finally { setBusy(false) }
  }

  if (!state && loading) return <SectionLoading />
  if (!state) return <SectionError message={error || 'No se han podido cargar los grupos.'} onRetry={() => void load()} />
  const upcoming = state.summary.blocks.filter((item) => item.status === 'published' && item.starts_on > today).sort((a, b) => a.starts_on.localeCompare(b.starts_on))[0]
  const historical = block?.status === 'published' && ended
  const ownMember = block?.status === 'published' ? state.workspace.members.find((member) => member.player_id === userId) : undefined
  const ownGroupTitle = ownMember && block ? historical
    ? `En este reparto pertenecías al grupo ${groupColorLabel(ownMember.color)}`
    : block.starts_on > today
      ? `Desde el ${formatDate(block.starts_on)} pertenecerás al grupo ${groupColorLabel(ownMember.color)}`
      : state.editing
        ? `Tu grupo publicado es el ${groupColorLabel(ownMember.color)}`
        : `Perteneces al grupo ${groupColorLabel(ownMember.color)}`
    : ''
  return <section className="training-groups-view" aria-busy={loading || busy}>
    {!loading && ownMember && block && <section className={`training-group-personal-banner ${ownMember.color}`} role="status" aria-label="Tu grupo en este reparto">
      <span className="training-group-personal-icon" aria-hidden="true"><Icon name="users" size={23} /></span>
      <div><strong>{ownGroupTitle}</strong><p>{historical ? `Estás consultando el reparto histórico del ${formatDate(block.starts_on)}.` : `Recuerda llevar peto o camiseta ${groupShirtLabel(ownMember.color)} a los entrenamientos.`}</p></div>
    </section>}
    {canManage && <div className={`training-group-renewal${renewal?.overdue && !upcoming ? ' overdue' : ''}`}>
      <div><strong>{renewal?.overdue && !upcoming ? 'Toca rehacer los grupos' : renewal?.soon && !upcoming ? 'Esta semana toca renovar los grupos' : 'Renovación cada tres semanas'}</strong><p>{current ? `Llevamos ${renewal!.weeks} semanas con el reparto actual. Próxima revisión: ${formatDate(renewal!.renewOn)}.` : 'Genera una propuesta y revísala antes de publicarla.'} {upcoming ? `Hay un reparto programado para el ${formatDate(upcoming.starts_on)}.` : renewal?.overdue ? 'El reparto actual se mantiene hasta publicar el siguiente.' : ''}</p></div>
      {!ended && <button className="primary-button" disabled={busy || loading || dirty || state.editing && !!block?.has_draft} onClick={() => void load(undefined, true)}>Generar nuevos grupos</button>}
    </div>}
    {!loading && canManage && !ended && pending.length > 0 && <TrainingGroupUnassigned players={pending} disabled={busy} onAdd={(playerId, color) => {
      const assignments = state.editing ? state.assignments : retainTrainingGroupAssignments(state.workspace.candidates, state.assignments)
      updateDraft({ ...state, editing: true, assignments: [...assignments.filter((entry) => entry.player_id !== playerId), { player_id: playerId, color }] })
      setMessage('')
    }} />}
    <div className="training-group-date-line">
      {(block || state.editing) && (state.editing && block?.status !== 'published'
        ? <label>Fecha de inicio<input type="date" value={state.rosterDate} min={today > season.start_date ? today : season.start_date} max={season.end_date} disabled={busy || loading} onChange={(event) => { if (event.target.value) void load(event.target.value, !block) }} /></label>
        : <p><strong>Fecha de inicio:</strong> <time dateTime={block?.starts_on ?? state.rosterDate}>{formatDate(block?.starts_on ?? state.rosterDate, { day: 'numeric', month: 'short', year: 'numeric' })}</time></p>)}
    </div>
    {error && <p role="alert" className="form-error">{error}</p>}
    {message && <p role="status" className="training-group-message">{message}</p>}
    {loading ? <SectionLoading /> : <>
      {state.editing && <div className="training-group-review"><strong>Borrador · Solo visible para el staff</strong><p>Añade, quita o cambia de grupo a cada jugadora. Guardar y publicar estos ajustes conserva el resto del reparto. Las bajas deportivas pueden mantenerse en su grupo o retirarse manualmente.</p>
        {invalid > 0 && <p>{invalid} {invalid === 1 ? 'asignación ya no cumple los requisitos.' : 'asignaciones ya no cumplen los requisitos.'}</p>}
        <button className="secondary-button" disabled={busy} onClick={() => void refreshRoster()}><Icon name="refresh" size={16} /> Actualizar plantilla</button>
        {invalid > 0 && <button className="text-button" disabled={busy} onClick={() => updateDraft({ ...state, assignments: retainTrainingGroupAssignments(state.workspace.candidates, state.assignments) })}>Retirar jugadoras que ya no cumplen los requisitos</button>}
        <div className="training-group-actions"><button className="secondary-button" disabled={busy} onClick={() => setConfirm('regenerate')}>Volver a repartir</button><button className="primary-button" disabled={busy || !dirty || invalid > 0} onClick={() => void save()}>Guardar borrador</button>
          {block?.has_draft && <button className="text-button" disabled={busy} onClick={() => setConfirm('discard')}>Descartar borrador</button>}
          {canPublish && block?.has_draft && <button className="primary-button" disabled={busy || dirty || invalid > 0} onClick={() => setConfirm('publish')}>Publicar grupos</button>}
          {dirty && <button className="text-button" disabled={busy} onClick={() => void load()}>Cancelar cambios</button>}
        </div>
      </div>}
      {!state.editing && canManage && !ended && !historical && block && <div className="training-group-actions"><button className="secondary-button" onClick={() => updateDraft({ ...state, editing: true, assignments: retainTrainingGroupAssignments(state.workspace.candidates, state.assignments) })}>Revisar reparto</button></div>}
      {(state.assignments.length > 0 || state.editing) && <>
        {state.editing && <div className="training-group-balance"><h2>Equilibrio del reparto</h2><p>{balance.balanced ? 'Reparto equilibrado: diferencia máxima de una jugadora por categoría y en el total.' : 'Hay diferencias de más de una jugadora. Puedes ajustar el reparto antes de publicar.'}</p>
          <table><thead><tr><th>Equipo y posición</th><th>Rojo</th><th>Blanco</th></tr></thead><tbody>{balance.rows.map((row) => <tr key={row.key}><th scope="row">{row.label}</th><td>{row.red}</td><td>{row.white}</td></tr>)}</tbody><tfoot><tr><th>Total</th><td>{balance.red}</td><td>{balance.white}</td></tr></tfoot></table>
          {players.some((player) => player.position_group === 'unassigned') && <p>Las jugadoras sin posición principal se equilibran por separado.</p>}
        </div>}
        <TrainingGroupColumns onRemove={state.editing ? (playerId) => updateDraft({ ...state, assignments: state.assignments.filter((entry) => entry.player_id !== playerId) }) : undefined} players={players} assignments={state.assignments} userId={userId} disabled={busy} onMove={state.editing ? (playerId) => updateDraft({ ...state, assignments: state.assignments.map((entry) => entry.player_id === playerId ? { ...entry, color: entry.color === 'red' ? 'white' : 'red' } : entry) }) : undefined} />
      </>}
      {!state.assignments.length && !state.editing && <p className="training-group-empty">{block?.status === 'published' ? 'No hay jugadoras asignadas en este reparto.' : 'Todavía no hay grupos publicados para esta temporada.'}</p>}
    </>}
    {confirm && <Modal labelledBy="training-groups-confirm" disabled={busy} onClose={() => setConfirm(null)}><h2 id="training-groups-confirm">{confirm === 'publish' ? 'Publicar grupos de entrenamiento' : confirm === 'discard' ? 'Descartar borrador' : 'Generar otro reparto'}</h2>
      <p>{confirm === 'publish' ? `El reparto comenzará el ${formatDate(state.rosterDate)}. Las jugadoras asignadas recibirán un aviso en la campana al entrar o actualizar la aplicación. Las jugadoras sin grupo no se incluirán en el reparto.` : confirm === 'discard' ? 'Se eliminará esta propuesta. El reparto publicado se conserva.' : 'Se sustituirán los ajustes por un nuevo reparto de toda la plantilla elegible, incluidas las jugadoras sin grupo.'}</p>
      {confirm === 'publish' && !balance.balanced && <p role="alert">El reparto tiene diferencias de más de una jugadora. Al confirmar publicarás estos ajustes manuales.</p>}
      <div className="training-group-actions"><button className="secondary-button" disabled={busy} onClick={() => setConfirm(null)}>Cancelar</button><button className="primary-button" disabled={busy} onClick={() => void applyConfirmation()}>{busy ? 'Guardando…' : confirm === 'publish' ? 'Confirmar publicación' : confirm === 'discard' ? 'Descartar' : 'Generar reparto'}</button></div>
    </Modal>}
  </section>
}

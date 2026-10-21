import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { useOperationFeedback } from '../../hooks/useOperationFeedback'
import { formatDate, todayInMadridIso } from '../../lib/dates'
import type { VideoAssignment, VideoPoolKey, WorkGroupsApi, WorkGroupWorkspace } from './types'
import { compareVideoMatches, poolMembers, proposeVideoAssignments } from './videoAssignments'
import { groupStyle, VIDEO_POOLS } from './workGroupConfig'

export function VideoAnalysisBoard({ workspace, seasonId, userId, canManage, api, onChanged, onEditingChange, onOpenMatch }: {
  workspace: WorkGroupWorkspace; seasonId: string; userId: string; canManage: boolean; api: WorkGroupsApi;
  onChanged: () => Promise<void>; onEditingChange: (editing: boolean) => void; onOpenMatch?: (date: string) => void
}) {
  const [draft, setDraft] = useState<VideoAssignment[]>()
  const [filter, setFilter] = useState('')
  const [busy, setBusy] = useState(false)
  const feedback = useOperationFeedback()
  const assignments = draft ?? workspace.assignments
  const derbyId = workspace.initial_derby_id
  const own = workspace.members.find((member) => member.profile_id === userId)
  const ownPool = VIDEO_POOLS.find((pool) => own && pool.groups.includes(own.group_key))
  const matches = [...workspace.matches].sort(compareVideoMatches)
  const pending = matches.filter((match) => !assignments.some((entry) => entry.match_id === match.id))
  const ownNext = ownPool && matches.find((match) => match.match_date >= todayInMadridIso() && workspace.assignments.some((entry) => entry.match_id === match.id && entry.pool_key === ownPool.key))
  function edit(next: VideoAssignment[] | undefined) { setDraft(next); onEditingChange(!!next); feedback.clearError() }
  async function save() {
    if (!draft) return
    setBusy(true); feedback.clearError()
    try {
      feedback.requireConnection()
      await api.saveAssignments(seasonId, workspace.version, draft)
      edit(undefined)
      await onChanged()
      feedback.notify('Asignaciones de vídeo análisis guardadas.')
    } catch (cause) { feedback.reportError(cause) }
    finally { setBusy(false) }
  }
  return <div className="video-analysis-board" aria-busy={busy}>
    {ownPool && <div className="work-personal" style={groupStyle(ownPool.groups[0])}><Icon name="video" size={25} /><div><span>Vídeo análisis · {ownPool.name}</span><strong>{ownNext ? `Próximo: ${formatDate(ownNext.match_date)} · ${ownNext.title}` : 'Tu grupo no tiene próximos partidos asignados.'}</strong></div></div>}
    <div className="video-intro"><div><h2>Mirar el partido también es hacer equipo</h2><p>Cámara, Fichas y Entrenadores analizan juntas. El resto mantiene su grupo de trabajo. El primer derbi queda en manos de Merchan.</p></div><span><Icon name="video" size={30} /></span></div>
    <details className="video-pool-overview"><summary>Grupos responsables y reparto <span>{VIDEO_POOLS.length} grupos de análisis</span></summary><div className="video-pool-grid">{VIDEO_POOLS.map((pool) => {
      const members = poolMembers(pool.key, workspace.members)
      const total = assignments.filter((entry) => entry.pool_key === pool.key && matches.some((match) => match.id === entry.match_id)).length
      return <div className="video-pool-card" key={pool.key} style={groupStyle(pool.groups[0])}><strong>{pool.name}</strong><span>{members.length} integrantes · {total} {total === 1 ? 'partido' : 'partidos'}</span><p>{members.map((member) => member.display_name).sort((a, b) => a.localeCompare(b, 'es')).join(' · ') || 'Sin integrantes'}</p></div>
    })}</div></details>
    <div className="groups-list-heading"><div><h2>Partido a partido</h2><p>{matches.length} partidos · {pending.length ? `${pending.length} pendientes de asignar` : 'Todos con grupo responsable'}</p></div><label className="video-filter">Ver grupo<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">Todos los grupos</option>{ownPool && <option value="own">Mi grupo</option>}<option value="pending">Sin asignar</option>{VIDEO_POOLS.map((pool) => <option value={pool.key} key={pool.key}>{pool.name}</option>)}</select></label></div>
    {canManage && <div className="video-edit-toolbar"><div><strong>{draft ? 'Revisa el reparto antes de guardar' : 'Un reparto que respeta lo acordado'}</strong><p>{draft ? 'Puedes cambiar el grupo de cada partido. Las jugadoras ven las asignaciones guardadas.' : 'La propuesta completa los pendientes; las repeticiones tienen en cuenta cuántas integrantes hay en cada grupo.'}</p></div><div className="video-edit-actions">
      {pending.length > 0 && <button type="button" className="secondary-button" disabled={busy} onClick={() => edit(proposeVideoAssignments(matches, workspace.members, assignments, workspace.initial_derby_id))}><Icon name="spark" size={16} /> Repartir pendientes</button>}
      {!draft ? <button type="button" className="primary-button" disabled={!matches.length} onClick={() => edit(derbyId && matches.some((match) => match.id === derbyId) && !workspace.assignments.some((entry) => entry.match_id === derbyId) ? [...workspace.assignments, { match_id: derbyId, pool_key: 'merchan', locked: true }] : [...workspace.assignments])}>Editar asignaciones</button> : <><button type="button" className="secondary-button" disabled={busy} onClick={() => edit(undefined)}>Cancelar</button><button type="button" className="primary-button" disabled={busy || JSON.stringify(draft) === JSON.stringify(workspace.assignments)} onClick={() => void save()}>{busy ? 'Guardando…' : 'Guardar asignaciones'}</button></>}
    </div></div>}
    {feedback.operationError && <p role="alert" className="form-error">{feedback.operationError}</p>}
    {feedback.message && <p role="status" className="groups-feedback">{feedback.message}</p>}
    <ol className="video-match-list">{matches.filter((match) => {
      const assignment = assignments.find((item) => item.match_id === match.id)
      return !filter || (filter === 'pending' ? !assignment : assignment?.pool_key === (filter === 'own' ? ownPool?.key : filter))
    }).map((match) => {
      const assignment = assignments.find((item) => item.match_id === match.id)
      const pool = VIDEO_POOLS.find((item) => item.key === assignment?.pool_key)
      const fixed = match.id === derbyId
      const past = match.match_date < todayInMadridIso() || match.status === 'completed'
      return <li key={match.id} className={`video-match-row${past ? ' is-past' : ''}`}>
        <time dateTime={match.match_date} className="video-match-date"><strong>{formatDate(match.match_date, { day: '2-digit' })}</strong><span>{formatDate(match.match_date, { month: 'short' })}</span><small>{match.match_date.slice(0, 4)}</small></time>
        <div className="video-match-info"><div className="video-match-meta"><span>{match.competition}</span>{match.internal_fixture_id && <span className="video-derby-tag">Derbi · un único análisis</span>}</div><h3>{match.title}</h3><p>{match.notes?.match(/jornada\s*\d+/i)?.[0] ?? 'Partido'}{match.kickoff_time ? ` · ${match.kickoff_time.slice(0, 5)} h` : ' · Hora por confirmar'}{past ? ' · Anterior' : ''}</p>{onOpenMatch && <button className="text-button" type="button" onClick={() => onOpenMatch(match.match_date)}>Ver partido <Icon name="arrow" size={13} /></button>}</div>
        <div className="video-match-assignment">{draft && !fixed ? <label>Grupo responsable<select disabled={busy} aria-label={`Grupo para ${match.title} del ${match.match_date}`} value={assignment?.pool_key ?? ''} onChange={(event) => {
          const remaining = assignments.filter((item) => item.match_id !== match.id)
          edit(event.target.value ? [...remaining, { match_id: match.id, pool_key: event.target.value as VideoPoolKey }] : remaining)
        }}><option value="">Sin asignar</option>{VIDEO_POOLS.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}</select></label> : <><span className={`video-pool-badge${pool ? '' : ' unassigned'}`} style={pool ? groupStyle(pool.groups[0]) : undefined}><Icon name="users" size={15} />{pool?.name ?? 'Sin asignar'}</span>{fixed && <small>Derbi inicial · asignación fija</small>}</>}</div>
      </li>
    })}</ol>
    {!matches.length && <p className="groups-empty">Los partidos publicados aparecerán aquí con su fecha actual.</p>}
    {matches.length > 0 && !matches.some((match) => !filter || (filter === 'pending' ? pending.some((item) => item.id === match.id) : assignments.some((entry) => entry.match_id === match.id && entry.pool_key === (filter === 'own' ? ownPool?.key : filter)))) && <p className="groups-empty">No hay partidos con este filtro.</p>}
  </div>
}

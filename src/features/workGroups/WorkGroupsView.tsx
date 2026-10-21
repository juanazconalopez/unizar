import { useCallback, useEffect, useRef, useState } from 'react'
import { SectionError, SectionLoading } from '../../components/AsyncViewState'
import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/ui/PageHeader'
import { todayInMadridIso } from '../../lib/dates'
import { useOperationFeedback } from '../../hooks/useOperationFeedback'
import { workGroupsApi } from '../../services/workGroupsService'
import type { Season } from '../../types'
import type { WorkGroupKey, WorkGroupMember, WorkGroupsApi, WorkGroupWorkspace } from './types'
import { groupStyle, WORK_GROUPS } from './workGroupConfig'
import { WorkGroupEditor } from './WorkGroupEditor'
import { VideoAnalysisBoard } from './VideoAnalysisBoard'

export function WorkGroupsView({ seasons, userId, canManage, mode = 'work', api = workGroupsApi, onBack, onOpenMatch }: {
  seasons: Season[]; userId: string; canManage: boolean; mode?: 'work' | 'video'; api?: WorkGroupsApi;
  onBack?: () => void; onOpenMatch?: (date: string) => void
}) {
  const today = todayInMadridIso()
  const season = seasons.find((item) => item.start_date <= today && item.end_date >= today)
    ?? [...seasons].sort((a, b) => b.start_date.localeCompare(a.start_date))[0]
  return <div className="page groups-page">
    {onBack && <button type="button" className="text-button groups-back" onClick={onBack}>‹ Todos los grupos</button>}
    <PageHeader eyebrow="EQUIPO · NOS ORGANIZAMOS" title={mode === 'work' ? 'Grupos de trabajo' : 'Asignación de vídeo análisis'} subtitle={mode === 'work' ? 'Las pequeñas tareas que hacen grande al equipo.' : 'Cada partido tiene su grupo. Las fechas cambian, el compromiso se mantiene.'} />
    {season ? <WorkGroupSeason key={`${season.id}:${userId}:${canManage}:${mode}`} season={season} userId={userId} canManage={canManage} mode={mode} api={api} onOpenMatch={onOpenMatch} /> : <p>No hay temporadas disponibles.</p>}
  </div>
}

function WorkGroupSeason({ season, userId, canManage, mode, api, onOpenMatch }: {
  season: Season; userId: string; canManage: boolean; mode: 'work' | 'video'; api: WorkGroupsApi; onOpenMatch?: (date: string) => void
}) {
  const [workspace, setWorkspace] = useState<WorkGroupWorkspace>()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<WorkGroupKey>()
  const [search, setSearch] = useState('')
  const requestId = useRef(0)
  const feedback = useOperationFeedback()
  const { reportError, clearError } = feedback
  const load = useCallback(async (rethrow = false) => {
    const request = ++requestId.current
    setLoading(true)
    clearError()
    try {
      const next = await api.load(season.id)
      if (request === requestId.current) setWorkspace(next)
    } catch (cause) {
      if (request === requestId.current) reportError(cause)
      if (rethrow) throw cause
    }
    finally { if (request === requestId.current) setLoading(false) }
  }, [api, clearError, reportError, season.id])
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => { window.clearTimeout(timer); requestId.current += 1 }
  }, [load])
  // Mantener las ediciones estables al volver a la ventana o recuperar conexión.
  const [videoEditing, setVideoEditing] = useState(false)
  useEffect(() => {
    const refresh = () => { if (!editing && !videoEditing && !busy && document.visibilityState === 'visible') void load() }
    window.addEventListener('focus', refresh); window.addEventListener('online', refresh)
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh) }
  }, [busy, editing, videoEditing, load])

  async function saveMembers(members: WorkGroupMember[]) {
    if (!workspace) return
    setBusy(true); feedback.clearError()
    try {
      feedback.requireConnection()
      await api.saveMembers(season.id, workspace.version, members)
      setEditing(undefined)
      await load(true)
      feedback.notify('Grupo actualizado. El reparto de vídeo análisis guardado se conserva.')
    } catch (cause) { feedback.reportError(cause) }
    finally { setBusy(false) }
  }
  if (!workspace && loading) return <SectionLoading />
  if (!workspace) return <SectionError message={feedback.operationError || 'No se han podido cargar los grupos.'} onRetry={() => void load()} />
  const own = workspace.members.find((member) => member.profile_id === userId)
  const ownGroup = WORK_GROUPS.find((group) => group.key === own?.group_key)
  const visible = workspace.members.filter((member) => member.display_name.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')))
  return <section aria-busy={busy || loading}>
    <div className="groups-season-line"><span>{season.name}</span><span>{workspace.members.length} integrantes · 9 grupos de trabajo</span></div>
    {feedback.operationError && <p role="alert" className="form-error">{feedback.operationError}</p>}
    {feedback.message && <p role="status" className="groups-feedback">{feedback.message}</p>}
    {mode === 'video' ? <VideoAnalysisBoard workspace={workspace} seasonId={season.id} userId={userId} canManage={canManage} api={api} onChanged={load} onEditingChange={setVideoEditing} onOpenMatch={onOpenMatch} /> : <>
      {ownGroup && <div role="status" className="work-personal" style={groupStyle(ownGroup.key)}><Icon name={ownGroup.icon} size={25} /><div><span>Tu grupo de trabajo</span><strong>{ownGroup.name}</strong></div></div>}
      <div className="groups-list-heading"><div><h2>Un equipo, muchas manos</h2><p>Encuentra a tus compañeras y las responsabilidades de cada grupo.</p></div><label className="groups-search"><Icon name="search" size={18} /><input type="search" aria-label="Buscar integrante" placeholder="Buscar integrante…" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
      <div className="work-groups-grid">{WORK_GROUPS.map((group) => {
        const members = visible.filter((member) => member.group_key === group.key).sort((a, b) => a.display_name.localeCompare(b.display_name, 'es'))
        const count = workspace.members.filter((member) => member.group_key === group.key).length
        return <section key={group.key} className="work-group-card" style={groupStyle(group.key)} aria-label={`Grupo de trabajo ${group.name}`}>
          <header><span className="work-group-icon"><Icon name={group.icon} size={21} /></span><div><h3>{group.name}</h3><span>{count} {count === 1 ? 'integrante' : 'integrantes'}</span></div>{canManage && <button type="button" className="icon-button" aria-label={`Editar ${group.name}`} onClick={() => { feedback.clearError(); setEditing(group.key) }}><Icon name="edit" size={17} /></button>}</header>
          <ul>{members.map((member) => <li key={member.id} className={member.profile_id === userId ? 'is-you' : ''}><span className="work-member-initial" aria-hidden="true">{member.display_name.charAt(0)}</span><span>{member.display_name}{member.profile_id === userId && <b className="work-you">Tú</b>}</span></li>)}</ul>
          {!members.length && <p className="work-group-empty">{search ? 'Sin coincidencias.' : 'Sin integrantes. Todo listo para organizar este grupo.'}</p>}
        </section>
      })}</div>
    </>}
    {editing && <WorkGroupEditor groupKey={editing} workspace={workspace} busy={busy} error={feedback.operationError} onClose={() => setEditing(undefined)} onSave={saveMembers} />}
  </section>
}

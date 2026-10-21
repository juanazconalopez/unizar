import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/ui/Modal'
import type { WorkGroupKey, WorkGroupMember, WorkGroupWorkspace } from './types'
import { WORK_GROUPS } from './workGroupConfig'
import { normalizedMemberName } from './videoAssignments'

export function WorkGroupEditor({ groupKey, workspace, busy, error, onClose, onSave }: {
  groupKey: WorkGroupKey; workspace: WorkGroupWorkspace; busy: boolean; error: string;
  onClose: () => void; onSave: (members: WorkGroupMember[]) => Promise<void>
}) {
  const [members, setMembers] = useState(() => workspace.members.map((member) => ({ ...member })))
  const [profileId, setProfileId] = useState('')
  const [name, setName] = useState('')
  const [localError, setLocalError] = useState('')
  const group = WORK_GROUPS.find((item) => item.key === groupKey)!
  const selected = members.filter((member) => member.group_key === groupKey).sort((a, b) => a.display_name.localeCompare(b.display_name, 'es'))
  const candidates = workspace.candidates.filter((candidate) => !members.some((member) => member.profile_id === candidate.id))
  function add() {
    const candidate = candidates.find((item) => item.id === profileId)
    const displayName = candidate?.display_name ?? name.trim()
    if (!displayName) { setLocalError('Selecciona una persona o escribe su nombre.'); return }
    if (members.some((member) => normalizedMemberName(member.display_name) === normalizedMemberName(displayName))) { setLocalError('Esta persona ya está asignada. Puedes moverla desde su grupo.'); return }
    setMembers([...members, { id: crypto.randomUUID(), group_key: groupKey, profile_id: candidate?.id ?? null, display_name: displayName }])
    setProfileId(''); setName(''); setLocalError('')
  }
  function link(member: WorkGroupMember, id: string) {
    const candidate = workspace.candidates.find((item) => item.id === id)
    if (candidate && members.some((item) => item.id !== member.id && (item.profile_id === id || normalizedMemberName(item.display_name) === normalizedMemberName(candidate.display_name)))) { setLocalError('Esta cuenta ya está asignada a otro integrante.'); return }
    setLocalError('')
    setMembers(members.map((item) => item.id === member.id ? { ...item, profile_id: id || null, display_name: candidate?.display_name ?? item.display_name } : item))
  }
  return <Modal labelledBy="work-group-editor-title" className="work-group-editor" disabled={busy} onClose={onClose}>
    <div className="groups-editor-heading"><div><span className="eyebrow">ORGANIZAR EL EQUIPO</span><h2 id="work-group-editor-title">Editar {group.name}</h2></div><button type="button" className="icon-button" aria-label="Cerrar edición" disabled={busy} onClick={onClose}><Icon name="close" /></button></div>
    <p>Vincula los nombres a sus cuentas, mueve integrantes o retíralos del reparto. Los cambios se aplican al guardar.</p>
    <div className="work-editor-members">{selected.map((member) => <div className="work-editor-member" key={member.id}>
      {member.profile_id ? <strong>{member.display_name}</strong> : <input aria-label={`Nombre de ${member.display_name}`} disabled={busy} value={member.display_name} maxLength={100} onChange={(event) => setMembers(members.map((item) => item.id === member.id ? { ...item, display_name: event.target.value } : item))} />}<button type="button" className="icon-button" disabled={busy} aria-label={`Quitar a ${member.display_name}`} onClick={() => setMembers(members.filter((item) => item.id !== member.id))}><Icon name="close" size={17} /></button>
      <label>Cuenta vinculada<select aria-label={`Cuenta de ${member.display_name}`} disabled={busy} value={member.profile_id ?? ''} onChange={(event) => link(member, event.target.value)}><option value="">Sin cuenta vinculada</option>{member.profile_id && !workspace.candidates.some((candidate) => candidate.id === member.profile_id) && <option value={member.profile_id}>Cuenta fuera de la plantilla actual</option>}{workspace.candidates.filter((candidate) => candidate.id === member.profile_id || !members.some((item) => item.profile_id === candidate.id)).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.display_name}</option>)}</select></label>
      <label>Mover a<select aria-label={`Grupo de ${member.display_name}`} disabled={busy} value={member.group_key} onChange={(event) => setMembers(members.map((item) => item.id === member.id ? { ...item, group_key: event.target.value as WorkGroupKey } : item))}>{WORK_GROUPS.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}</select></label>
    </div>)}</div>
    {!selected.length && <p>Este grupo no tiene integrantes.</p>}
    <fieldset className="work-add-member" disabled={busy}><legend>Añadir integrante</legend><label>Persona del equipo<select value={profileId} onChange={(event) => { setProfileId(event.target.value); setName('') }}><option value="">Seleccionar persona…</option>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.display_name}</option>)}</select></label><label>O añadir un nombre<input value={name} disabled={!!profileId} maxLength={100} placeholder="Nombre y apellidos" onChange={(event) => setName(event.target.value)} /></label><button className="secondary-button" type="button" onClick={add}><Icon name="plus" size={16} /> Añadir al grupo</button></fieldset>
    {(localError || error) && <p role="alert" className="form-error">{localError || error}</p>}
    <div className="groups-editor-actions"><button type="button" className="secondary-button" disabled={busy} onClick={onClose}>Cancelar</button><button type="button" className="primary-button" disabled={busy || JSON.stringify(members) === JSON.stringify(workspace.members)} onClick={() => void onSave(members)}>{busy ? 'Guardando…' : 'Guardar grupo'}</button></div>
  </Modal>
}

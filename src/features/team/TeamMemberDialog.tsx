import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/ui/Modal'
import { ageOnDate, formatDate, todayIso } from '../../lib/dates'
import { errorText } from '../../lib/errors'
import { areDisplayNamesSimilar } from '../../lib/displayNames'
import type { ManagedProfileValues, Profile, ProfilePhotoChange, ProfilePrivateDetails, ProvisionalAttendanceRecord, ProvisionalPlayer } from '../../types'
import { ProfilePhotoField } from '../profile/ProfilePhotoField'
import { profileRoleClass, profileRoles } from './profileRoles'

export function TeamMemberDialog({ person, details, currentUserId, possibleMatches, provisionalPlayers = [], provisionalAttendance = [], onClose, onUpdate, onSave, onArchive, onLoadPhoto, onLinkProvisionalPlayers }: {
  person: Profile
  details?: ProfilePrivateDetails
  currentUserId: string
  possibleMatches: Profile[]
  provisionalPlayers?: ProvisionalPlayer[]
  provisionalAttendance?: ProvisionalAttendanceRecord[]
  onClose: () => void
  onUpdate: (profile: Profile) => Promise<void>
  onSave?: (profile: Profile, values: ManagedProfileValues, photoChange?: ProfilePhotoChange) => Promise<void>
  onArchive?: (profile: Profile) => Promise<void>
  onLoadPhoto?: (path: string) => Promise<string>
  onLinkProvisionalPlayers?: (guests: ProvisionalPlayer[], profile: Profile) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState(person.display_name)
  const [phone, setPhone] = useState(details?.phone ?? '')
  const [birthDate, setBirthDate] = useState(details?.birth_date ?? '')
  const [isActive, setIsActive] = useState(person.is_active)
  const [isPlayer, setIsPlayer] = useState(person.is_player)
  const [isCoach, setIsCoach] = useState(person.is_coach)
  const [isViewer, setIsViewer] = useState(person.is_viewer)
  const [isOwner, setIsOwner] = useState(person.is_owner)
  const [photoChange, setPhotoChange] = useState<ProfilePhotoChange>(undefined)
  const [selectedProvisionalIds, setSelectedProvisionalIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const age = ageOnDate(details?.birth_date, todayIso())
  const titleId = 'team-member-dialog-title'
  const approved = person.is_approved && !person.is_archived
  const permissionChanged = isActive !== person.is_active || isPlayer !== person.is_player || isCoach !== person.is_coach || isViewer !== person.is_viewer || isOwner !== person.is_owner
  const provisionalCandidates = provisionalPlayers.filter((guest) => (
    provisionalAttendance.some((record) => record.provisional_player_id === guest.id)
  )).sort((first, second) => {
    const firstMatch = areDisplayNamesSimilar(first.display_name, person.display_name) ? 0 : 1
    const secondMatch = areDisplayNamesSimilar(second.display_name, person.display_name) ? 0 : 1
    return firstMatch - secondMatch || first.display_name.localeCompare(second.display_name, 'es')
  })
  const selectedProvisionals = provisionalCandidates.filter((guest) => selectedProvisionalIds.includes(guest.id))
  const selectedProvisionalDates = provisionalAttendance
    .filter((record) => selectedProvisionalIds.includes(record.provisional_player_id))
    .flatMap((record) => record.training_sessions?.session_date ? [record.training_sessions.session_date] : [])
    .sort()

  function toggleProvisionalSelection(provisionalPlayerId: string) {
    setSelectedProvisionalIds((current) => current.includes(provisionalPlayerId)
      ? current.filter((id) => id !== provisionalPlayerId)
      : [...current, provisionalPlayerId])
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!onSave) return
    const normalizedName = displayName.trim().replace(/\s+/g, ' ')
    const normalizedPhone = phone.trim()
    if (normalizedName.length < 3 || normalizedName.length > 80 || !/^\S+\s+\S+/.test(normalizedName)) return setFormError('Escribe el nombre y al menos un apellido (entre 3 y 80 caracteres).')
    if (normalizedPhone && (normalizedPhone.length < 6 || normalizedPhone.length > 30)) return setFormError('Escribe un teléfono válido (entre 6 y 30 caracteres).')
    if (birthDate && birthDate > todayIso()) return setFormError('La fecha de nacimiento no puede estar en el futuro.')
    if (!(isPlayer || isCoach || isViewer || isOwner)) return setFormError('Selecciona al menos un rol.')
    if (permissionChanged && !window.confirm(`Se modificarán el estado o los permisos de ${person.display_name}. ¿Guardar estos cambios?`)) return
    setSaving(true)
    setFormError('')
    try {
      const values: ManagedProfileValues = { displayName: normalizedName, phone: normalizedPhone, birthDate, isActive, isPlayer, isCoach, isViewer, isOwner }
      if (photoChange === undefined) await onSave(person, values)
      else await onSave(person, values, photoChange)
      onClose()
    } catch (error) {
      setFormError(errorText(error))
      setSaving(false)
    }
  }

  async function approve() {
    const selectedCount = selectedProvisionals.length
    const attendanceCount = selectedProvisionalDates.length
    if (selectedCount > 0 && !window.confirm(`¿Aprobar como jugadora a ${person.display_name} y vincular ${selectedCount} ${selectedCount === 1 ? 'invitada' : 'invitadas'} (${attendanceCount} ${attendanceCount === 1 ? 'asistencia' : 'asistencias'})?`)) return
    setSaving(true)
    setFormError('')
    try {
      await onUpdate({ ...person, is_approved: true, is_active: true, is_player: true })
      if (selectedCount > 0 && onLinkProvisionalPlayers) await onLinkProvisionalPlayers(selectedProvisionals, person)
      onClose()
    } catch (error) {
      setFormError(errorText(error))
      setSaving(false)
    }
  }

  async function restore() {
    setSaving(true)
    try {
      await onUpdate({ ...person, is_archived: false, is_approved: true, is_active: false })
      onClose()
    } catch (error) {
      setFormError(errorText(error))
      setSaving(false)
    }
  }

  async function archive() {
    if (!onArchive || !window.confirm(`¿Desautorizar a ${person.display_name}? Perderá el acceso, pero se conservarán sus datos históricos.`)) return
    setSaving(true)
    try {
      await onArchive(person)
      onClose()
    } catch (error) {
      setFormError(errorText(error))
      setSaving(false)
    }
  }

  async function linkAttendance() {
    if (selectedProvisionals.length === 0 || !onLinkProvisionalPlayers) return
    const total = selectedProvisionalDates.length
    const selectedCount = selectedProvisionals.length
    if (!window.confirm(`¿Vincular ${selectedCount} ${selectedCount === 1 ? 'invitada' : 'invitadas'} (${total} ${total === 1 ? 'asistencia' : 'asistencias'}) con ${person.display_name}?`)) return
    setSaving(true)
    setFormError('')
    try {
      await onLinkProvisionalPlayers(selectedProvisionals, person)
      onClose()
    } catch (error) {
      setFormError(errorText(error))
      setSaving(false)
    }
  }

  return <Modal className="team-member-dialog" disabled={saving} labelledBy={titleId} onClose={onClose} onSubmit={editing ? submit : undefined}>
    <div className="task-detail-heading">
      <div><span className="eyebrow">DATOS DE PERFIL</span><h2 id={titleId}>{person.display_name}</h2></div>
      <div className="team-member-heading-actions">{approved && onSave && !editing && <button aria-label={`Editar datos de ${person.display_name}`} className="icon-button" onClick={() => setEditing(true)} title={`Editar datos de ${person.display_name}`} type="button"><Icon name="edit" size={17} /></button>}<button aria-label="Cerrar" className="icon-button" onClick={onClose} type="button">×</button></div>
    </div>
    {editing ? <>
      {isPlayer && <ProfilePhotoField avatarPath={person.avatar_path} editable name={displayName || person.display_name} onChange={setPhotoChange} onLoadPhoto={onLoadPhoto} photoChange={photoChange} />}
      <div className="profile-details-fields">
        <label>Nombre y apellidos<input autoFocus maxLength={80} onChange={(event) => setDisplayName(event.target.value)} required value={displayName} /></label>
        <label>Email de Google<input className="readonly-field" readOnly type="email" value={details?.email ?? ''} /></label>
        <label>Teléfono<input inputMode="tel" maxLength={30} onChange={(event) => setPhone(event.target.value)} type="tel" value={phone} /></label>
        <label>Fecha de nacimiento<input max={todayIso()} onChange={(event) => setBirthDate(event.target.value)} type="date" value={birthDate} />{ageOnDate(birthDate, todayIso()) !== null && <small>Edad actual: {ageOnDate(birthDate, todayIso())} años.</small>}</label>
      </div>
      <fieldset className="team-member-permissions"><legend>Estado y roles</legend>
        <Toggle checked={isActive} disabled={person.id === currentUserId} label="Activa" onChange={setIsActive} />
        <Toggle checked={isPlayer} label="Jugadora" onChange={setIsPlayer} />
        <Toggle checked={isCoach} label="Entrenador" onChange={setIsCoach} />
        <Toggle checked={isViewer} label="Dirección" onChange={setIsViewer} />
        <Toggle checked={isOwner} disabled={person.id === currentUserId} label="Owner" onChange={setIsOwner} />
      </fieldset>
      {formError && <p className="form-error" role="alert">{formError}</p>}
      <div className="form-actions"><button className="secondary-button" disabled={saving} onClick={() => setEditing(false)} type="button">Cancelar</button><button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button></div>
      {onArchive && <div className="team-member-danger"><div><strong>Desautorizar persona</strong><p>Perderá el acceso y desaparecerá de los listados activos. Sus datos históricos se conservarán.</p></div><button className="danger-button" disabled={saving || person.id === currentUserId} onClick={() => void archive()} type="button">Desautorizar</button></div>}
    </> : <>
      {person.is_player && <div className="team-member-profile-summary">
        <ProfilePhotoField avatarPath={person.avatar_path} name={person.display_name} onLoadPhoto={onLoadPhoto} />
        <div className="team-member-highlight-details">
          <Detail label="Teléfono">{details?.phone ? <a href={`tel:${details.phone}`}>{details.phone}</a> : <em>Sin teléfono</em>}</Detail>
          <Detail label="Edad">{age === null ? <em>Sin edad</em> : `${age} años`}</Detail>
        </div>
      </div>}
      <div className="team-member-detail-grid">
        <Detail label="Email">{details?.email ? <a href={`mailto:${details.email}`}>{details.email}</a> : <em>Sin email</em>}</Detail>
        {!person.is_player && <Detail label="Teléfono">{details?.phone ? <a href={`tel:${details.phone}`}>{details.phone}</a> : <em>Sin teléfono</em>}</Detail>}
        {!person.is_player && <Detail label="Edad">{age === null ? <em>Sin edad</em> : `${age} años`}</Detail>}
        <Detail label="Fecha de nacimiento">{details?.birth_date ? formatDate(details.birth_date, { day: 'numeric', month: 'long', year: 'numeric' }) : <em>Sin fecha</em>}</Detail>
        <Detail label="En el equipo desde">{formatDate(person.created_at.slice(0, 10), { day: 'numeric', month: 'long', year: 'numeric' })}</Detail>
        <Detail label="Estado"><span className={`member-active-state ${person.is_active ? 'active' : 'inactive'}`}><Icon name={person.is_active ? 'check' : 'close'} size={14} />{person.is_active ? 'Activa' : 'Inactiva'}</span></Detail>
        <Detail label="Roles"><span className="person-role-list">{profileRoles(person).map((role) => <small className={profileRoleClass(role)} key={role}>{role}</small>)}</span></Detail>
        <Detail label="Perfil"><small className={`profile-completion-state ${details?.email && details.phone && details.birth_date ? 'complete' : 'incomplete'}`}>{details?.email && details.phone && details.birth_date ? 'Datos completos' : 'Faltan datos'}</small></Detail>
      </div>
      {onLinkProvisionalPlayers && !person.is_archived && (person.is_player || !person.is_approved) && provisionalCandidates.length > 0 && <section className={`provisional-link-panel${provisionalCandidates.some((guest) => areDisplayNamesSimilar(guest.display_name, person.display_name)) ? ' has-suggestion' : ''}`}>
        <div className="provisional-link-heading"><span className="eyebrow">ASISTENCIAS PENDIENTES</span><strong>Vincular historiales de invitadas</strong><p>Selecciona manualmente todas las identidades que correspondan. Las sugerencias no se vinculan automáticamente.</p></div>
        <fieldset className="provisional-link-options"><legend>Invitadas</legend>
          {provisionalCandidates.map((guest) => {
            const count = provisionalAttendance.filter((record) => record.provisional_player_id === guest.id).length
            const suggested = areDisplayNamesSimilar(guest.display_name, person.display_name)
            return <label key={guest.id}><input checked={selectedProvisionalIds.includes(guest.id)} onChange={() => toggleProvisionalSelection(guest.id)} type="checkbox" /><span>{guest.display_name}</span><small>{count} {count === 1 ? 'asistencia' : 'asistencias'}{suggested ? ' · sugerida' : ''}</small></label>
          })}
        </fieldset>
        {selectedProvisionals.length > 0 && <small className="provisional-link-history">{selectedProvisionalDates.length
          ? `Historial desde ${formatDate(selectedProvisionalDates[0], { day: 'numeric', month: 'short', year: 'numeric' })}${selectedProvisionalDates.length > 1 ? ` hasta ${formatDate(selectedProvisionalDates.at(-1)!, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}.`
          : 'Las invitadas seleccionadas no tienen asistencias pendientes.'}</small>}
        {person.is_player && <button className="secondary-button compact" disabled={saving || selectedProvisionals.length === 0 || selectedProvisionalDates.length === 0} onClick={() => void linkAttendance()} type="button">Vincular asistencias</button>}
      </section>}
      {possibleMatches.length > 0 && <div className="duplicate-profile-warning" role="status"><Icon name="warning" size={18} /><div><strong>Posible cuenta duplicada</strong><p>El nombre se parece a {possibleMatches.map((match) => match.display_name).join(', ')}. Revisa la coincidencia antes de autorizar.</p></div></div>}
      {!person.is_approved && !person.is_archived && <div className="approval-actions"><span>Se habilitará como jugadora activa</span><button className="primary-button" disabled={saving} onClick={() => void approve()} type="button">{saving ? 'Aprobando…' : 'Aprobar como jugadora'}</button></div>}
      {person.is_archived && <div className="approval-actions"><span>Volverá como miembro aprobado, inicialmente inactivo.</span><button className="secondary-button" disabled={saving} onClick={() => void restore()} type="button">{saving ? 'Restaurando…' : 'Restaurar acceso'}</button></div>}
      {formError && <p className="form-error" role="alert">{formError}</p>}
    </>}
  </Modal>
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return <div><span>{label}</span><strong>{children}</strong></div>
}

function Toggle({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return <label className="toggle"><input checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} type="checkbox" /><i /><span>{label}</span></label>
}

import { PlayerLicenseDialog } from './PlayerLicenseDialog'
import { PlayerPositionsDialog } from './PlayerPositionsDialog'
import { positionLabel } from '../../lib/playerPositions'
import type { SavePlayerPositions } from '../../lib/playerPositions'
import type { SavePlayerLicense } from './PlayerLicenseDialog'
import { licenseLabel, membershipLicense } from '../../lib/playerLicenses'
import { membershipCoversDate } from '../../lib/selectors'
import type { SeasonPlayer } from '../../types'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/ui/Modal'
import { ageOnDate, formatDate, todayIso } from '../../lib/dates'
import { errorText } from '../../lib/errors'
import { areDisplayNamesSimilar } from '../../lib/displayNames'
import { isValidInternationalPhone } from '../../lib/phone'
import type { ManagedProfileValues, PlayerAbsence, PlayerAbsencePrivateNote, Profile, ProfilePhotoChange, ProfilePrivateDetails, ProvisionalAttendanceRecord, ProvisionalPlayer, Season, SeasonTeam } from '../../types'
import type { PlayerAbsenceValues } from '../../services/playerAbsencesService'
import { PhoneNumberField } from '../../components/ui/PhoneNumberField'
import { ProfilePhotoField } from '../profile/ProfilePhotoField'
import { PlayerAbsenceDialog } from './PlayerAbsenceDialog'
import { TeamMemberPhotoDialog } from './TeamMemberPhotoDialog'
import { ProvisionalAttendanceLinkDialog } from './ProvisionalAttendanceLinkDialog'
import { ProvisionalAttendanceOptions } from './ProvisionalAttendanceOptions'
import { getCurrentPlayerAbsence } from './playerAbsenceStatus'
import { profileRoleClass, profileRoles } from './profileRoles'

export function TeamMemberDialog({ person, details, showPrivateDetails = true, onSavePositions, memberships = [], teams = [], onSaveLicense, currentUserId, possibleMatches, provisionalPlayers = [], provisionalAttendance = [], activeSeason, absences = [], absenceNotes = [], onClose, onPreviewPlayer, onUpdate, onSave, onSavePhoto, onArchive, onLoadPhoto, onLinkProvisionalPlayers, onSaveAbsence, onDeleteAbsence, onDischargeAbsence }: {
  person: Profile
  showPrivateDetails?: boolean
  onSavePositions?: SavePlayerPositions
  details?: ProfilePrivateDetails
  memberships?: SeasonPlayer[]
  onSaveLicense?: SavePlayerLicense
  teams?: SeasonTeam[]
  currentUserId: string
  possibleMatches: Profile[]
  provisionalPlayers?: ProvisionalPlayer[]
  provisionalAttendance?: ProvisionalAttendanceRecord[]
  absences?: PlayerAbsence[]
  absenceNotes?: PlayerAbsencePrivateNote[]
  activeSeason?: Season
  onClose: () => void
  onPreviewPlayer?: (player: Profile) => void
  onUpdate?: (profile: Profile) => Promise<void>
  onSave?: (profile: Profile, values: ManagedProfileValues, photoChange?: ProfilePhotoChange) => Promise<void>
  onSavePhoto?: (profile: Profile, change: File | null) => Promise<void>
  onArchive?: (profile: Profile) => Promise<void>
  onLoadPhoto?: (path: string) => Promise<string>
  onLinkProvisionalPlayers?: (guests: ProvisionalPlayer[], profile: Profile) => Promise<void>
  onSaveAbsence?: (player: Profile, values: PlayerAbsenceValues, absenceId?: string) => Promise<void>
  onDeleteAbsence?: (absenceId: string) => Promise<void>
  onDischargeAbsence?: (absenceId: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [activeDialog, setActiveDialog] = useState<'profile' | 'photo' | 'absence' | 'attendance' | 'license' | 'positions'>('profile')
  const [absenceToEditId, setAbsenceToEditId] = useState<string | undefined>()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [displayName, setDisplayName] = useState(person.display_name)
  const [phone, setPhone] = useState(details?.phone ?? '')
  const [birthDate, setBirthDate] = useState(details?.birth_date ?? '')
  const [isActive, setIsActive] = useState(person.is_active)
  const [isPlayer, setIsPlayer] = useState(person.is_player)
  const [isCoach, setIsCoach] = useState(person.is_coach)
  const [isViewer, setIsViewer] = useState(person.is_viewer)
  const [isOwner, setIsOwner] = useState(person.is_owner)
  const [selectedProvisionalIds, setSelectedProvisionalIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const today = todayIso()
  const age = ageOnDate(details?.birth_date, today)
  const titleId = 'team-member-dialog-title'
  const approved = person.is_approved && !person.is_archived
  const personAbsences = absences.filter((absence) => absence.player_id === person.id).sort((first, second) => second.starts_on.localeCompare(first.starts_on))
  const privateAbsenceNoteById = new Map(absenceNotes.map((note) => [note.absence_id, note.note.trim()]))
  const currentAbsence = getCurrentPlayerAbsence(absences, person.id, today)
  const permissionChanged = isActive !== person.is_active || isPlayer !== person.is_player || isCoach !== person.is_coach || isViewer !== person.is_viewer || isOwner !== person.is_owner
  const provisionalCandidates = provisionalPlayers.filter((guest) => (
    provisionalAttendance.some((record) => record.provisional_player_id === guest.id)
  )).sort((first, second) => {
    const firstMatch = areDisplayNamesSimilar(first.display_name, person.display_name) ? 0 : 1
    const secondMatch = areDisplayNamesSimilar(second.display_name, person.display_name) ? 0 : 1
    return firstMatch - secondMatch || first.display_name.localeCompare(second.display_name, 'es')
  })
  const canLinkAttendance = Boolean(onLinkProvisionalPlayers && approved && person.is_player && provisionalCandidates.length > 0)
  const canSelectAttendanceOnApproval = Boolean(onLinkProvisionalPlayers && !person.is_approved && !person.is_archived && provisionalCandidates.length > 0)
  const activeMembership = memberships.find((membership) => membership.player_id === person.id && membership.season_id === activeSeason?.id && membershipCoversDate(membership, today))
  const seasonMembership = activeMembership ?? memberships.find((membership) => membership.player_id === person.id && membership.season_id === activeSeason?.id)
  const activeTeam = teams.find((team) => team.id === activeMembership?.season_team_id && team.season_id === activeSeason?.id)
  const canModifyLicense = Boolean(approved && person.is_player && activeSeason && seasonMembership && onSaveLicense)
  const selectedProvisionals = provisionalCandidates.filter((guest) => selectedProvisionalIds.includes(guest.id))
  const selectedProvisionalDates = provisionalAttendance
    .filter((record) => selectedProvisionalIds.includes(record.provisional_player_id))
    .flatMap((record) => record.training_sessions?.session_date ? [record.training_sessions.session_date] : [])
    .sort()

  useEffect(() => {
    if (!menuOpen) return
    function closeOnOutsideClick(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [menuOpen])

  function openDialog(dialog: 'photo' | 'absence' | 'attendance' | 'license' | 'positions', absenceId?: string) {
    setMenuOpen(false)
    setAbsenceToEditId(absenceId)
    setActiveDialog(dialog)
  }

  async function dischargeCurrentAbsence() {
    setMenuOpen(false)
    if (saving || !currentAbsence || !onDischargeAbsence || !window.confirm('¿Dar de alta hoy a ' + person.display_name + '? Podrá volver a estar disponible desde hoy.')) return
    setSaving(true)
    setFormError('')
    try {
      await onDischargeAbsence(currentAbsence.id)
    } catch (cause) {
      setFormError(errorText(cause))
    } finally {
      setSaving(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!onSave) return
    const normalizedName = displayName.trim().replace(/\s+/g, ' ')
    const normalizedPhone = phone.trim()
    if (normalizedName.length < 3 || normalizedName.length > 80 || !/^\S+\s+\S+/.test(normalizedName)) return setFormError('Escribe el nombre y al menos un apellido (entre 3 y 80 caracteres).')
    if (!isValidInternationalPhone(normalizedPhone)) return setFormError('Escribe un teléfono válido para el país seleccionado.')
    if (birthDate && birthDate > todayIso()) return setFormError('La fecha de nacimiento no puede estar en el futuro.')
    if (!(isPlayer || isCoach || isViewer || isOwner)) return setFormError('Selecciona al menos un rol.')
    if (permissionChanged && !window.confirm(`Se modificarán el estado o los permisos de ${person.display_name}. ¿Guardar estos cambios?`)) return
    setSaving(true)
    setFormError('')
    try {
      const values: ManagedProfileValues = { displayName: normalizedName, phone: normalizedPhone, birthDate, isActive, isPlayer, isCoach, isViewer, isOwner }
      await onSave(person, values)
      onClose()
    } catch (error) {
      setFormError(errorText(error))
      setSaving(false)
    }
  }

  async function approve() {
    if (!onUpdate) return
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
    if (!onUpdate) return
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

  if (activeDialog === 'positions' && onSavePositions) return <PlayerPositionsDialog person={person} onClose={() => setActiveDialog('profile')} onSave={onSavePositions} />

  if (activeDialog === 'license' && canModifyLicense && activeSeason && seasonMembership && onSaveLicense) return <PlayerLicenseDialog membership={seasonMembership} onClose={() => setActiveDialog('profile')} onSave={onSaveLicense} person={person} season={activeSeason} />

  if (activeDialog === 'photo' && onSavePhoto) return <TeamMemberPhotoDialog onClose={() => setActiveDialog('profile')} onLoadPhoto={onLoadPhoto} onSave={onSavePhoto} onSaved={onClose} person={person} />

  if (activeDialog === 'absence' && onSaveAbsence) return <PlayerAbsenceDialog absences={personAbsences} editAbsenceId={absenceToEditId} notes={absenceNotes} onClose={() => setActiveDialog('profile')} onDelete={onDeleteAbsence} onDischarge={onDischargeAbsence} onSave={onSaveAbsence} person={person} />

  if (activeDialog === 'attendance' && canLinkAttendance) return <ProvisionalAttendanceLinkDialog attendance={provisionalAttendance} candidates={provisionalCandidates} onClose={() => setActiveDialog('profile')} onLink={onLinkProvisionalPlayers} onLinked={onClose} onSelectionChange={setSelectedProvisionalIds} person={person} selectedIds={selectedProvisionalIds} />

  return <Modal className="team-member-dialog" disabled={saving} labelledBy={titleId} onClose={onClose} onSubmit={editing ? submit : undefined}>
    <div className="task-detail-heading">
      <div><span className="eyebrow">DATOS DE PERFIL</span><div className="team-member-profile-title"><h2 id={titleId}>{person.display_name}</h2>{currentAbsence && <span aria-label="Baja deportiva" className="player-absence-indicator" role="img" title="Baja deportiva"><Icon name="medicalCross" size={20} /></span>}</div></div>
      <div className="team-member-heading-actions" ref={menuRef} onKeyDown={(event) => {
        if (event.key === 'Escape' && menuOpen) { event.stopPropagation(); setMenuOpen(false) }
      }}>
        <button aria-controls="team-member-actions" aria-expanded={menuOpen} aria-label={`Acciones de ${person.display_name}`} aria-haspopup="true" className="icon-button" onClick={() => setMenuOpen((open) => !open)} type="button"><Icon name="more" size={20} /></button>
        {menuOpen && <div className="team-member-actions-menu" id="team-member-actions">
          {approved && onSave && <button onClick={() => { setEditing(true); setMenuOpen(false) }} type="button">Editar datos</button>}
          {person.is_player && currentAbsence && onDischargeAbsence && <button disabled={saving} onClick={() => void dischargeCurrentAbsence()} type="button">Alta deportiva</button>}
          {person.is_player && !currentAbsence && onSaveAbsence && <button onClick={() => openDialog('absence')} type="button">Baja deportiva</button>}
          {canModifyLicense && <button onClick={() => openDialog('license')} type="button">Modificar ficha</button>}
          {approved && person.is_player && onSavePositions && <button onClick={() => openDialog('positions')} type="button">Modificar posiciones</button>}
          {approved && person.is_active && onSavePhoto && <button onClick={() => openDialog('photo')} type="button">Cambiar foto</button>}
          {canLinkAttendance && <button onClick={() => openDialog('attendance')} type="button">Vincular asistencias</button>}
          {approved && person.is_active && person.is_player && onPreviewPlayer && <button onClick={() => { setMenuOpen(false); onPreviewPlayer(person) }} type="button">Vista previa de jugadora</button>}
          <button onClick={onClose} type="button">Cerrar</button>
        </div>}
      </div>
    </div>
    {editing ? <>
      <div className="profile-details-fields">
        <label>Nombre y apellidos<input autoFocus maxLength={80} onChange={(event) => setDisplayName(event.target.value)} required spellCheck value={displayName} /></label>
        <label>Email de Google<input className="readonly-field" readOnly type="email" value={details?.email ?? ''} /></label>
        <div className="profile-phone-field"><label htmlFor="managed-profile-phone">Teléfono</label><PhoneNumberField id="managed-profile-phone" onChange={setPhone} value={phone} /></div>
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
      {approved && <div className="team-member-profile-summary">
        <ProfilePhotoField avatarPath={person.avatar_path} name={person.display_name} onLoadPhoto={onLoadPhoto} />
        {showPrivateDetails && <div className="team-member-highlight-details">
          <Detail label="Teléfono">{details?.phone ? <a href={`tel:${details.phone}`}>{details.phone}</a> : <em>Sin teléfono</em>}</Detail>
          <Detail label="Edad">{age === null ? <em>Sin edad</em> : `${age} años`}</Detail>
        </div>}
      </div>}
      <div className="team-member-detail-grid">
        {showPrivateDetails && <>
        <Detail label="Email">{details?.email ? <a href={`mailto:${details.email}`}>{details.email}</a> : <em>Sin email</em>}</Detail>
        <Detail label="Fecha de nacimiento">{details?.birth_date ? formatDate(details.birth_date, { day: 'numeric', month: 'long', year: 'numeric' }) : <em>Sin fecha</em>}</Detail>
        </>}
        {person.is_player && <>
          <Detail label="Ficha">{seasonMembership ? licenseLabel(membershipLicense(seasonMembership)) : <em>Sin ficha en la temporada activa</em>}</Detail>
          <Detail label="Equipo">{activeTeam?.name ?? <em>Sin equipo en la temporada activa</em>}</Detail>
          <Detail label="Posición principal">{positionLabel(person.primary_position)}</Detail>
          <Detail label="Otras posiciones">{person.playing_positions?.filter((position) => position !== person.primary_position).map(positionLabel).join(', ') || <em>Sin posiciones adicionales</em>}</Detail>
        </>}
        <Detail label="En el equipo desde">{formatDate(person.created_at.slice(0, 10), { day: 'numeric', month: 'long', year: 'numeric' })}</Detail>
        <Detail label="Estado"><span className={`member-active-state ${person.is_active ? 'active' : 'inactive'}`}><Icon name={person.is_active ? 'check' : 'close'} size={14} />{person.is_active ? 'Activa' : 'Inactiva'}</span></Detail>
        <Detail label="Roles"><span className="person-role-list">{profileRoles(person).map((role) => <small className={profileRoleClass(role)} key={role}>{role}</small>)}</span></Detail>
        {showPrivateDetails && <Detail label="Perfil"><small className={`profile-completion-state ${details?.email && details.phone && details.birth_date ? 'complete' : 'incomplete'}`}>{details?.email && details.phone && details.birth_date ? 'Datos completos' : 'Faltan datos'}</small></Detail>}
      </div>
      {personAbsences.length > 0 && <section aria-label="Bajas deportivas" className={`team-member-absence-history ${currentAbsence ? 'is-current' : 'is-inactive'}`}>
        <div className="team-member-absence-heading"><h3>Bajas deportivas</h3>{currentAbsence && onSaveAbsence && <button aria-label="Editar baja deportiva vigente" className="icon-button team-member-absence-edit" onClick={() => openDialog('absence', currentAbsence.id)} title="Editar baja deportiva" type="button"><Icon name="edit" size={15} /></button>}</div>
        {personAbsences.map((absence) => <div className="team-member-absence-item" key={absence.id}>
          <div className="team-member-absence-details">
            <div className="team-member-absence-dates"><span>{formatDate(absence.starts_on, { day: 'numeric', month: 'long', year: 'numeric' })} — {absence.ends_on ? formatDate(absence.ends_on, { day: 'numeric', month: 'long', year: 'numeric' }) : 'Sin fecha prevista'}</span>
              <small className={absence === currentAbsence ? 'current' : ''}>{absence.discharged_on
                ? 'Alta deportiva: ' + formatDate(absence.discharged_on, { day: 'numeric', month: 'short', year: 'numeric' })
                : absence === currentAbsence ? 'Vigente' : absence.starts_on > today ? 'Programada' : 'Finalizada'}</small>
            </div>
            {showPrivateDetails && privateAbsenceNoteById.get(absence.id) && <p className="team-member-absence-note">{privateAbsenceNoteById.get(absence.id)}</p>}
          </div>
        </div>)}
      </section>}
      {possibleMatches.length > 0 && <div className="duplicate-profile-warning" role="status"><Icon name="warning" size={18} /><div><strong>Posible cuenta duplicada</strong><p>El nombre se parece a {possibleMatches.map((match) => match.display_name).join(', ')}. Revisa la coincidencia antes de autorizar.</p></div></div>}
      {canSelectAttendanceOnApproval && <section aria-label="Vincular asistencias al autorizar" className="approval-link-panel">
        <span className="eyebrow">ASISTENCIAS PENDIENTES</span>
        <h3>Vincular historiales de invitadas</h3>
        <p>Selecciona las invitadas que correspondan. Sus asistencias se vincularán al aprobar a la jugadora.</p>
        <ProvisionalAttendanceOptions attendance={provisionalAttendance} candidates={provisionalCandidates} onSelectionChange={setSelectedProvisionalIds} person={person} selectedIds={selectedProvisionalIds} />
      </section>}
      {onUpdate && !person.is_approved && !person.is_archived && <div className="approval-actions"><span>Se habilitará como jugadora activa</span><button className="primary-button" disabled={saving} onClick={() => void approve()} type="button">{saving ? 'Aprobando…' : 'Aprobar como jugadora'}</button></div>}
      {onUpdate && person.is_archived && <div className="approval-actions"><span>Volverá como miembro aprobado, inicialmente inactivo.</span><button className="secondary-button" disabled={saving} onClick={() => void restore()} type="button">{saving ? 'Restaurando…' : 'Restaurar acceso'}</button></div>}
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

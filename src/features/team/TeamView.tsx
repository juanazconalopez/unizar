import { useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '../../components/Icon'
import { Avatar } from '../../components/ui/Avatar'
import { PageHeader } from '../../components/ui/PageHeader'
import { ageOnDate, formatDate, todayIso } from '../../lib/dates'
import { areDisplayNamesSimilar, displayNameContains, normalizeDisplayName } from '../../lib/displayNames'
import type { ManagedProfileValues, Profile, ProfilePhotoChange, ProfilePrivateDetails, ProvisionalAttendanceRecord, ProvisionalPlayer } from '../../types'
import { profileRoles } from './profileRoles'
import { TeamMemberDialog } from './TeamMemberDialog'

export function TeamView({ embedded = false, profiles, profilePrivateDetails = [], provisionalPlayers = [], provisionalAttendance = [], currentUserId, onUpdate, onSave, onArchive, onLoadPhoto, onLinkProvisionalPlayer }: {
  embedded?: boolean
  profiles: Profile[]
  profilePrivateDetails?: ProfilePrivateDetails[]
  provisionalPlayers?: ProvisionalPlayer[]
  provisionalAttendance?: ProvisionalAttendanceRecord[]
  currentUserId: string
  onUpdate: (profile: Profile) => Promise<void>
  onSave?: (profile: Profile, values: ManagedProfileValues, photoChange?: ProfilePhotoChange) => Promise<void>
  onArchive?: (profile: Profile) => Promise<void>
  onLoadPhoto?: (path: string) => Promise<string>
  onLinkProvisionalPlayer?: (guest: ProvisionalPlayer, profile: Profile) => Promise<void>
}) {
  const [showArchived, setShowArchived] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedPerson, setSelectedPerson] = useState<Profile | null>(null)
  const normalizedSearch = normalizeDisplayName(search)
  const matchesSearch = (profile: Profile) => !normalizedSearch || displayNameContains(profile.display_name, normalizedSearch)
  const allPending = profiles.filter((profile) => !profile.is_approved && !profile.is_archived)
  const allApproved = profiles.filter((profile) => profile.is_approved && !profile.is_archived)
  const allArchived = profiles.filter((profile) => profile.is_archived)
  const pending = allPending.filter(matchesSearch)
  const approved = allApproved.filter(matchesSearch)
  const archived = allArchived.filter(matchesSearch)
  const hasSearchMatches = pending.length + approved.length + archived.length > 0
  const selectedDetails = selectedPerson ? profilePrivateDetails.find((item) => item.profile_id === selectedPerson.id) : undefined
  const possibleMatches = selectedPerson && !selectedPerson.is_approved && !selectedPerson.is_archived
    ? profiles.filter((other) => other.id !== selectedPerson.id && areDisplayNamesSimilar(selectedPerson.display_name, other.display_name)).slice(0, 3)
    : []
  const searchControl = searchOpen ? <div className="team-search-field">
    <Icon name="search" size={17} />
    <input aria-label="Buscar por nombre" autoFocus onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => {
      if (event.key !== 'Escape') return
      setSearch('')
      setSearchOpen(false)
    }} placeholder="Buscar por nombre…" type="search" value={search} />
    <button aria-label="Cerrar búsqueda" onClick={() => { setSearch(''); setSearchOpen(false) }} type="button">×</button>
  </div> : <button aria-label="Buscar personas" className="icon-button team-search-toggle" onClick={() => setSearchOpen(true)} title="Buscar personas" type="button"><Icon name="search" size={19} /></button>

  return <div className={embedded ? 'settings-section' : 'page'}>
    {embedded ? <div className="settings-section-heading"><div><span className="eyebrow">ADMINISTRACIÓN</span><h2>Equipo</h2><p>{allApproved.length} miembros aprobados · {allPending.length} solicitudes pendientes</p></div>{searchControl}</div> : <PageHeader action={searchControl} eyebrow="ADMINISTRACIÓN" subtitle={`${allApproved.length} miembros aprobados · ${allPending.length} solicitudes pendientes`} title="Equipo" />}
    {pending.length > 0 && <PeopleSection eyebrow="REQUIERE ATENCIÓN" title="Solicitudes pendientes">{pending.map((person) => <PersonCard details={profilePrivateDetails.find((item) => item.profile_id === person.id)} key={person.id} onOpen={() => setSelectedPerson(person)} person={person} warning={profiles.some((other) => other.id !== person.id && areDisplayNamesSimilar(person.display_name, other.display_name))} />)}</PeopleSection>}
    {approved.length > 0 && <PeopleSection eyebrow="MIEMBROS" title="Personas del equipo">{approved.map((person) => <PersonCard details={profilePrivateDetails.find((item) => item.profile_id === person.id)} key={person.id} onOpen={() => setSelectedPerson(person)} person={person} />)}</PeopleSection>}
    {archived.length > 0 && <section className="archived-users">
      {!normalizedSearch && <button className="text-button" onClick={() => setShowArchived((value) => !value)} type="button">{showArchived ? 'Ocultar' : 'Ver'} usuarios desautorizados ({archived.length})</button>}
      {(showArchived || Boolean(normalizedSearch)) && <div className="people-list">{archived.map((person) => <PersonCard details={profilePrivateDetails.find((item) => item.profile_id === person.id)} key={person.id} onOpen={() => setSelectedPerson(person)} person={person} />)}</div>}
    </section>}
    {normalizedSearch && !hasSearchMatches && <p className="team-search-empty">No hay personas que coincidan con “{search.trim()}”.</p>}
    {selectedPerson && <TeamMemberDialog currentUserId={currentUserId} details={selectedDetails} person={selectedPerson} possibleMatches={possibleMatches} provisionalAttendance={provisionalAttendance} provisionalPlayers={provisionalPlayers} onArchive={onArchive} onClose={() => setSelectedPerson(null)} onLinkProvisionalPlayer={onLinkProvisionalPlayer} onLoadPhoto={onLoadPhoto} onSave={onSave} onUpdate={onUpdate} />}
  </div>
}

function PersonCard({ person, details, warning = false, onOpen }: { person: Profile; details?: ProfilePrivateDetails; warning?: boolean; onOpen: () => void }) {
  const complete = Boolean(details?.email && details.phone && details.birth_date)
  const age = ageOnDate(details?.birth_date, todayIso())
  const roles = profileRoles(person)
  return <button aria-label={`Ver datos de ${person.display_name}`} className={`person-row person-summary-card${person.is_archived ? ' archived-person' : ''}`} onClick={onOpen} type="button">
    <span className="person-identity"><Avatar name={person.display_name} /><span><strong>{person.display_name}</strong><small>Desde {formatDate(person.created_at.slice(0, 10), { month: 'long', year: 'numeric' })}</small></span></span>
    <span className="person-summary-contact"><span><b>Email</b>{details?.email || 'Sin email'}</span><span><b>Teléfono</b>{details?.phone || 'Sin teléfono'}</span><span><b>Edad</b>{age === null ? 'Sin edad' : `${age} años`}</span></span>
    <span className="person-summary-state">
      <span className={`member-active-state ${person.is_active ? 'active' : 'inactive'}`}><Icon name={person.is_active ? 'check' : 'close'} size={14} />{person.is_active ? 'Activa' : 'Inactiva'}</span>
      <span className="person-role-list">{roles.length ? roles.map((role) => <small key={role}>{role}</small>) : <small>Sin rol</small>}</span>
      <small className={`profile-completion-state ${complete ? 'complete' : 'incomplete'}`}>{complete ? 'Datos completos' : 'Faltan datos'}</small>
      {warning && <small className="person-duplicate-compact"><Icon name="warning" size={13} />Posible duplicado</small>}
    </span>
    <Icon name="arrow" size={17} />
  </button>
}

function PeopleSection({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return <section className="section-block"><div className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div></div><div className="people-list">{children}</div></section>
}

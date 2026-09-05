import { useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '../../components/Icon'
import { Avatar } from '../../components/ui/Avatar'
import { PageHeader } from '../../components/ui/PageHeader'
import { ageOnDate, formatDate, todayIso } from '../../lib/dates'
import { areDisplayNamesSimilar, displayNameContains, normalizeDisplayName } from '../../lib/displayNames'
import type { ManagedProfileValues, Profile, ProfilePhotoChange, ProfilePrivateDetails, ProvisionalAttendanceRecord, ProvisionalPlayer } from '../../types'
import { profileRoleClass, profileRoles } from './profileRoles'
import { TeamMemberDialog } from './TeamMemberDialog'

type TeamStatusFilter = 'all' | 'active' | 'inactive' | 'pending' | 'archived'
type TeamRoleFilter = 'player' | 'coach' | 'viewer' | 'owner'

const statusFilterOptions: Array<{ value: TeamStatusFilter; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'active', label: 'Activas' },
  { value: 'inactive', label: 'Inactivas' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'archived', label: 'Desautorizadas' },
]

const roleFilterOptions: Array<{ value: TeamRoleFilter; label: string }> = [
  { value: 'player', label: 'Jugadora' },
  { value: 'coach', label: 'Entrenador' },
  { value: 'viewer', label: 'Dirección' },
  { value: 'owner', label: 'Owner' },
]

const roleProfileKeys: Record<TeamRoleFilter, 'is_player' | 'is_coach' | 'is_viewer' | 'is_owner'> = {
  player: 'is_player',
  coach: 'is_coach',
  viewer: 'is_viewer',
  owner: 'is_owner',
}

export function TeamView({ embedded = false, hideEmbeddedTitle = false, profiles, profilePrivateDetails = [], provisionalPlayers = [], provisionalAttendance = [], currentUserId, onUpdate, onSave, onArchive, onLoadPhoto, onLinkProvisionalPlayers }: {
  embedded?: boolean
  hideEmbeddedTitle?: boolean
  profiles: Profile[]
  profilePrivateDetails?: ProfilePrivateDetails[]
  provisionalPlayers?: ProvisionalPlayer[]
  provisionalAttendance?: ProvisionalAttendanceRecord[]
  currentUserId: string
  onUpdate: (profile: Profile) => Promise<void>
  onSave?: (profile: Profile, values: ManagedProfileValues, photoChange?: ProfilePhotoChange) => Promise<void>
  onArchive?: (profile: Profile) => Promise<void>
  onLoadPhoto?: (path: string) => Promise<string>
  onLinkProvisionalPlayers?: (guests: ProvisionalPlayer[], profile: Profile) => Promise<void>
}) {
  const [showArchived, setShowArchived] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<TeamStatusFilter>('all')
  const [roleFilters, setRoleFilters] = useState<TeamRoleFilter[]>([])
  const [selectedPerson, setSelectedPerson] = useState<Profile | null>(null)
  const normalizedSearch = normalizeDisplayName(search)
  const allPending = profiles.filter((profile) => !profile.is_approved && !profile.is_archived)
  const allApproved = profiles.filter((profile) => profile.is_approved && !profile.is_archived)
  const allArchived = profiles.filter((profile) => profile.is_archived)
  const hasActiveFilters = statusFilter !== 'all' || roleFilters.length > 0
  const hasSearchOrFilters = Boolean(normalizedSearch) || hasActiveFilters
  const matchesFilters = (profile: Profile) => {
    if (normalizedSearch && !displayNameContains(profile.display_name, normalizedSearch)) return false
    const statusMatches = statusFilter === 'all'
      || (statusFilter === 'active' && profile.is_approved && !profile.is_archived && profile.is_active)
      || (statusFilter === 'inactive' && profile.is_approved && !profile.is_archived && !profile.is_active)
      || (statusFilter === 'pending' && !profile.is_approved && !profile.is_archived)
      || (statusFilter === 'archived' && profile.is_archived)
    if (!statusMatches) return false
    return roleFilters.length === 0 || roleFilters.some((role) => profile[roleProfileKeys[role]])
  }
  const pending = allPending.filter(matchesFilters)
  const approved = allApproved.filter(matchesFilters)
  const archived = allArchived.filter(matchesFilters)
  const hasSearchMatches = pending.length + approved.length + archived.length > 0
  const filterResultCount = pending.length + approved.length + archived.length
  const filterCount = (statusFilter === 'all' ? 0 : 1) + roleFilters.length
  const activeApproved = allApproved.filter((profile) => profile.is_active).length
  const inactiveApproved = allApproved.length - activeApproved
  const roleCounts = {
    player: allApproved.filter((profile) => profile.is_player).length,
    coach: allApproved.filter((profile) => profile.is_coach).length,
    viewer: allApproved.filter((profile) => profile.is_viewer).length,
  }
  const teamSummary = <><span className="team-summary-line">{allApproved.length} aprobados · {allPending.length} pendientes · {activeApproved} activas · {inactiveApproved} inactivas</span><span className="team-summary-line">{roleCounts.player} jugadoras · {roleCounts.coach} entrenador · {roleCounts.viewer} dirección</span></>
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
  const filterControl = <details className="team-filter-control">
    <summary aria-label="Filtrar personas"><Icon name="filter" size={17} /><span>Filtrar</span>{filterCount > 0 && <small>{filterCount}</small>}</summary>
    <div className="team-filter-menu">
      <fieldset>
        <legend>Estado</legend>
        {statusFilterOptions.map((option) => <label key={option.value}><input checked={statusFilter === option.value} name="team-status-filter" onChange={() => setStatusFilter(option.value)} type="radio" />{option.label}</label>)}
      </fieldset>
      <fieldset>
        <legend>Rol</legend>
        {roleFilterOptions.map((option) => <label key={option.value}><input checked={roleFilters.includes(option.value)} onChange={() => setRoleFilters((current) => current.includes(option.value) ? current.filter((role) => role !== option.value) : [...current, option.value])} type="checkbox" />{option.label}</label>)}
      </fieldset>
      <button className="text-button" disabled={!hasActiveFilters} onClick={() => { setStatusFilter('all'); setRoleFilters([]) }} type="button">Limpiar filtros</button>
    </div>
  </details>
  const headerActions = <div className="team-heading-actions">{searchControl}{filterControl}</div>

  return <div className={embedded ? 'settings-section' : 'page'}>
    {embedded ? <div className={`settings-section-heading${hideEmbeddedTitle ? ' compact' : ''}`}><div>{!hideEmbeddedTitle && <><span className="eyebrow">ADMINISTRACIÓN</span><h2>Equipo</h2></>}<p>{teamSummary}</p></div>{headerActions}</div> : <PageHeader action={headerActions} eyebrow="ADMINISTRACIÓN" subtitle={teamSummary} title="Equipo" />}
    {hasSearchOrFilters && <p aria-live="polite" className="team-filter-results">{filterResultCount} {filterResultCount === 1 ? 'resultado' : 'resultados'}</p>}
    {pending.length > 0 && <PeopleSection eyebrow="REQUIERE ATENCIÓN" title="Solicitudes pendientes">{pending.map((person) => <PersonCard details={profilePrivateDetails.find((item) => item.profile_id === person.id)} key={person.id} onOpen={() => setSelectedPerson(person)} person={person} warning={profiles.some((other) => other.id !== person.id && areDisplayNamesSimilar(person.display_name, other.display_name))} />)}</PeopleSection>}
    {approved.length > 0 && <PeopleSection eyebrow="MIEMBROS" title="Personas del equipo">{approved.map((person) => <PersonCard details={profilePrivateDetails.find((item) => item.profile_id === person.id)} key={person.id} onOpen={() => setSelectedPerson(person)} person={person} />)}</PeopleSection>}
    {archived.length > 0 && <section className="archived-users">
      {hasActiveFilters && <div className="section-heading"><div><span className="eyebrow">HISTÓRICO</span><h2>Usuarios desautorizados</h2></div></div>}
      {!normalizedSearch && !hasActiveFilters && <button className="text-button" onClick={() => setShowArchived((value) => !value)} type="button">{showArchived ? 'Ocultar' : 'Ver'} usuarios desautorizados ({archived.length})</button>}
      {(showArchived || hasSearchOrFilters) && <div className="people-list">{archived.map((person) => <PersonCard details={profilePrivateDetails.find((item) => item.profile_id === person.id)} key={person.id} onOpen={() => setSelectedPerson(person)} person={person} />)}</div>}
    </section>}
    {hasSearchOrFilters && !hasSearchMatches && <p className="team-search-empty">{normalizedSearch ? `No hay personas que coincidan con “${search.trim()}” dentro de los filtros actuales.` : 'No hay personas que coincidan con los filtros actuales.'}</p>}
    {selectedPerson && <TeamMemberDialog currentUserId={currentUserId} details={selectedDetails} person={selectedPerson} possibleMatches={possibleMatches} provisionalAttendance={provisionalAttendance} provisionalPlayers={provisionalPlayers} onArchive={onArchive} onClose={() => setSelectedPerson(null)} onLinkProvisionalPlayers={onLinkProvisionalPlayers} onLoadPhoto={onLoadPhoto} onSave={onSave} onUpdate={onUpdate} />}
  </div>
}

function PersonCard({ person, details, warning = false, onOpen }: { person: Profile; details?: ProfilePrivateDetails; warning?: boolean; onOpen: () => void }) {
  const complete = Boolean(details?.email && details.phone && details.birth_date)
  const age = ageOnDate(details?.birth_date, todayIso())
  const roles = profileRoles(person)
  const compact = person.is_archived || (person.is_approved && !person.is_active)
  return <button aria-label={`Ver datos de ${person.display_name}`} className={`person-row person-summary-card${person.is_archived ? ' archived-person' : ''}${compact ? ' inactive-person' : ''}${person.is_owner ? ' owner-person' : ''}`} onClick={onOpen} type="button">
    <span className="person-identity"><Avatar name={person.display_name} /><span><strong>{person.display_name}</strong><small>Desde {formatDate(person.created_at.slice(0, 10), { month: 'long', year: 'numeric' })}</small></span></span>
    {!compact && <span className="person-summary-contact"><span><b>Email</b>{details?.email || 'Sin email'}</span><span><b>Teléfono</b>{details?.phone || 'Sin teléfono'}</span><span><b>Edad</b>{age === null ? 'Sin edad' : `${age} años`}</span></span>}
    <span className="person-summary-state">
      <span className={`member-active-state ${person.is_active ? 'active' : 'inactive'}`}><Icon name={person.is_active ? 'check' : 'close'} size={14} />{person.is_active ? 'Activa' : 'Inactiva'}</span>
      <span className="person-role-list">{roles.length ? roles.map((role) => <small className={profileRoleClass(role)} key={role}>{role}</small>) : <small>Sin rol</small>}</span>
      {!compact && <small className={`profile-completion-state ${complete ? 'complete' : 'incomplete'}`}>{complete ? 'Datos completos' : 'Faltan datos'}</small>}
      {warning && <small className="person-duplicate-compact"><Icon name="warning" size={13} />Posible duplicado</small>}
    </span>
    <Icon name="arrow" size={17} />
  </button>
}

function PeopleSection({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return <section className="section-block"><div className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div></div><div className="people-list">{children}</div></section>
}

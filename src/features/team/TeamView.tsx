import { useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '../../components/Icon'
import { Avatar } from '../../components/ui/Avatar'
import { PageHeader } from '../../components/ui/PageHeader'
import { ageOnDate, formatDate, todayIso } from '../../lib/dates'
import { areDisplayNamesSimilar, displayNameContains, normalizeDisplayName } from '../../lib/displayNames'
import type { Profile, ProfilePrivateDetails } from '../../types'

export function TeamView({ embedded = false, profiles, profilePrivateDetails = [], currentUserId, onUpdate }: {
  embedded?: boolean
  profiles: Profile[]
  profilePrivateDetails?: ProfilePrivateDetails[]
  currentUserId: string
  onUpdate: (profile: Profile) => Promise<void>
}) {
  const [showArchived, setShowArchived] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const normalizedSearch = normalizeDisplayName(search)
  const matchesSearch = (profile: Profile) => !normalizedSearch || displayNameContains(profile.display_name, normalizedSearch)
  const allPending = profiles.filter((profile) => !profile.is_approved && !profile.is_archived)
  const allApproved = profiles.filter((profile) => profile.is_approved && !profile.is_archived)
  const allArchived = profiles.filter((profile) => profile.is_archived)
  const pending = allPending.filter(matchesSearch)
  const approved = allApproved.filter(matchesSearch)
  const archived = allArchived.filter(matchesSearch)
  const hasSearchMatches = pending.length + approved.length + archived.length > 0
  const searchControl = searchOpen ? (
    <div className="team-search-field">
      <Icon name="search" size={17} />
      <input
        aria-label="Buscar por nombre"
        autoFocus
        onChange={(event) => setSearch(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return
          setSearch('')
          setSearchOpen(false)
        }}
        placeholder="Buscar por nombre…"
        type="search"
        value={search}
      />
      <button aria-label="Cerrar búsqueda" onClick={() => { setSearch(''); setSearchOpen(false) }} type="button">×</button>
    </div>
  ) : (
    <button aria-label="Buscar personas" className="icon-button team-search-toggle" onClick={() => setSearchOpen(true)} title="Buscar personas" type="button">
      <Icon name="search" size={19} />
    </button>
  )
  return (
    <div className={embedded ? 'settings-section' : 'page'}>
      {embedded ? <div className="settings-section-heading"><div><span className="eyebrow">ADMINISTRACIÓN</span><h2>Equipo</h2><p>{allApproved.length} miembros aprobados · {allPending.length} solicitudes pendientes</p></div>{searchControl}</div> : <PageHeader
        action={searchControl}
        eyebrow="ADMINISTRACIÓN"
        title="Equipo"
        subtitle={`${allApproved.length} miembros aprobados · ${allPending.length} solicitudes pendientes`}
      />}
      {pending.length > 0 && (
        <PeopleSection eyebrow="REQUIERE ATENCIÓN" title="Solicitudes pendientes">
          {pending.map((person) => <ApprovalRequestRow key={person.id} onUpdate={onUpdate} person={person} possibleMatches={profiles.filter((other) => other.id !== person.id && areDisplayNamesSimilar(person.display_name, other.display_name)).slice(0, 3)} />)}
        </PeopleSection>
      )}
      {approved.length > 0 && <PeopleSection eyebrow="MIEMBROS" title="Permisos del equipo">
          {approved.map((person) => <PersonRow currentUserId={currentUserId} details={profilePrivateDetails.find((item) => item.profile_id === person.id)} key={person.id} onUpdate={onUpdate} person={person} />)}
      </PeopleSection>}
      {archived.length > 0 && (
        <section className="archived-users">
          {!normalizedSearch && <button className="text-button" onClick={() => setShowArchived((value) => !value)}>
            {showArchived ? 'Ocultar' : 'Ver'} usuarios desautorizados ({archived.length})
          </button>}
          {(showArchived || Boolean(normalizedSearch)) && (
            <div className="people-list">
              {archived.map((person) => <ArchivedPersonRow key={person.id} onUpdate={onUpdate} person={person} />)}
            </div>
          )}
        </section>
      )}
      {normalizedSearch && !hasSearchMatches && <p className="team-search-empty">No hay personas que coincidan con “{search.trim()}”.</p>}
    </div>
  )
}

function ApprovalRequestRow({ person, possibleMatches, onUpdate }: {
  person: Profile
  possibleMatches: Profile[]
  onUpdate: (profile: Profile) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)

  async function approve() {
    setSaving(true)
    try {
      await onUpdate({ ...person, is_approved: true, is_active: true })
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className={`person-row approval-request${possibleMatches.length ? ' has-possible-match' : ''}`}>
      <div className="person-identity">
        <Avatar name={person.display_name} />
        <div>
          <strong>{person.display_name}</strong>
          <span>Solicitud recibida {formatDate(person.created_at.slice(0, 10), { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>
      </div>
      {possibleMatches.length > 0 && <div className="duplicate-profile-warning" role="status">
        <Icon name="warning" size={18} />
        <div>
          <strong>Posible cuenta duplicada</strong>
          <p>El nombre se parece a {possibleMatches.map((match, index) => <span key={match.id}>{index > 0 ? ', ' : ''}<b>{match.display_name}</b> ({profileState(match)})</span>)}. Revisa la coincidencia antes de autorizar.</p>
        </div>
      </div>}
      <div className="approval-actions">
        <span>Se habilitará como jugadora activa</span>
        <button className="primary-button" disabled={saving} onClick={approve}>
          {saving ? 'Aprobando…' : 'Aprobar como jugadora'}
        </button>
      </div>
    </article>
  )
}

function profileState(profile: Profile) {
  if (profile.is_archived) return 'desautorizada'
  if (!profile.is_approved) return 'otra solicitud pendiente'
  return profile.is_active ? 'miembro activo' : 'miembro inactivo'
}

function PeopleSection({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section className="section-block">
      <div className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div></div>
      <div className="people-list">{children}</div>
    </section>
  )
}

function PersonRow({ person, details, currentUserId, onUpdate }: {
  person: Profile
  details?: ProfilePrivateDetails
  currentUserId: string
  onUpdate: (profile: Profile) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)

  async function change(field: 'is_approved' | 'is_active', value: boolean) {
    setSaving(true)
    try {
      await onUpdate({ ...person, [field]: value })
    } finally {
      setSaving(false)
    }
  }

  async function changeRole(field: 'is_player' | 'is_coach' | 'is_viewer' | 'is_owner', value: boolean) {
    setSaving(true)
    try {
      await onUpdate({ ...person, [field]: value })
    } finally {
      setSaving(false)
    }
  }

  async function archive() {
    if (!window.confirm(`¿Desautorizar a ${person.display_name}? Dejará de acceder y no aparecerá en los listados activos.`)) return
    setSaving(true)
    try {
      await onUpdate({
        ...person,
        is_approved: false,
        is_active: false,
        is_player: false,
        is_coach: false,
        is_viewer: false,
        is_owner: false,
        is_archived: true,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="person-row">
      <div className="person-identity">
        <Avatar name={person.display_name} />
        <div>
          <strong>{person.display_name}{person.id === currentUserId && <small> Tú</small>}</strong>
          <span>Desde {formatDate(person.created_at.slice(0, 10), { month: 'long', year: 'numeric' })}</span>
        </div>
      </div>
      <ProfileContactDetails details={details} />
      <div className="person-controls">
        <div className="permission-toggles">
          <Toggle checked={person.is_approved} disabled={saving || person.id === currentUserId} label="Aprobado" onChange={(value) => change('is_approved', value)} />
          <Toggle checked={person.is_active} disabled={saving} label="Activo" onChange={(value) => change('is_active', value)} />
          <Toggle checked={person.is_player} disabled={saving} label="Jugadora" onChange={(value) => changeRole('is_player', value)} />
          <Toggle checked={person.is_coach} disabled={saving} label="Entrenador" onChange={(value) => changeRole('is_coach', value)} />
          <Toggle checked={person.is_viewer} disabled={saving} label="Dirección" onChange={(value) => changeRole('is_viewer', value)} />
          <Toggle checked={person.is_owner} disabled={saving || person.id === currentUserId} label="Owner" onChange={(value) => changeRole('is_owner', value)} />
        </div>
        <button className="danger-button" disabled={saving || person.id === currentUserId} onClick={archive}>Desautorizar</button>
      </div>
    </article>
  )
}

function ProfileContactDetails({ details }: { details?: ProfilePrivateDetails }) {
  const complete = Boolean(details?.email && details.phone && details.birth_date)
  const age = ageOnDate(details?.birth_date, todayIso())
  return (
    <div className={`person-profile-details${complete ? ' complete' : ' incomplete'}`}>
      <span className="profile-completion-state">{complete ? 'Datos completos' : 'Datos incompletos'}</span>
      <div>
        <span><b>Email</b>{details?.email ? <a href={`mailto:${details.email}`}>{details.email}</a> : <em>Sin email</em>}</span>
        <span><b>Teléfono</b>{details?.phone ? <a href={`tel:${details.phone}`}>{details.phone}</a> : <em>Sin teléfono</em>}</span>
        <span><b>Edad</b>{age === null ? <em>Sin edad</em> : <strong>{age} años</strong>}</span>
        <span><b>Nacimiento</b>{details?.birth_date ? <strong>{formatDate(details.birth_date, { day: 'numeric', month: 'short', year: 'numeric' })}</strong> : <em>Sin fecha</em>}</span>
      </div>
    </div>
  )
}

function ArchivedPersonRow({ person, onUpdate }: {
  person: Profile
  onUpdate: (profile: Profile) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)

  async function restore() {
    setSaving(true)
    try {
      await onUpdate({ ...person, is_archived: false, is_approved: true, is_active: false })
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="person-row archived-person">
      <div className="person-identity"><Avatar name={person.display_name} /><div><strong>{person.display_name}</strong><span>Sin acceso</span></div></div>
      <button className="secondary-button" disabled={saving} onClick={restore}>{saving ? 'Restaurando…' : 'Restaurar acceso'}</button>
    </article>
  )
}

function Toggle({ label, checked, disabled, onChange }: {
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="toggle">
      <span>{label}</span>
      <input checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      <i />
    </label>
  )
}

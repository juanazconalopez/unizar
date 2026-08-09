import { useState } from 'react'
import type { ReactNode } from 'react'
import { Avatar } from '../../components/ui/Avatar'
import { PageHeader } from '../../components/ui/PageHeader'
import { formatDate } from '../../lib/dates'
import type { Profile } from '../../types'

export function TeamView({ embedded = false, profiles, currentUserId, onUpdate }: {
  embedded?: boolean
  profiles: Profile[]
  currentUserId: string
  onUpdate: (profile: Profile) => Promise<void>
}) {
  const [showArchived, setShowArchived] = useState(false)
  const pending = profiles.filter((profile) => !profile.is_approved && !profile.is_archived)
  const approved = profiles.filter((profile) => profile.is_approved && !profile.is_archived)
  const archived = profiles.filter((profile) => profile.is_archived)

  return (
    <div className={embedded ? 'settings-section' : 'page'}>
      {embedded ? <div className="settings-section-heading"><div><span className="eyebrow">ADMINISTRACIÓN</span><h2>Equipo</h2><p>{approved.length} miembros aprobados · {pending.length} solicitudes pendientes</p></div></div> : <PageHeader
        eyebrow="ADMINISTRACIÓN"
        title="Equipo"
        subtitle={`${approved.length} miembros aprobados · ${pending.length} solicitudes pendientes`}
      />}
      {pending.length > 0 && (
        <PeopleSection eyebrow="REQUIERE ATENCIÓN" title="Solicitudes pendientes">
          {pending.map((person) => <ApprovalRequestRow key={person.id} onUpdate={onUpdate} person={person} />)}
        </PeopleSection>
      )}
      <PeopleSection eyebrow="MIEMBROS" title="Permisos del equipo">
        {approved.map((person) => <PersonRow currentUserId={currentUserId} key={person.id} onUpdate={onUpdate} person={person} />)}
      </PeopleSection>
      {archived.length > 0 && (
        <section className="archived-users">
          <button className="text-button" onClick={() => setShowArchived((value) => !value)}>
            {showArchived ? 'Ocultar' : 'Ver'} usuarios desautorizados ({archived.length})
          </button>
          {showArchived && (
            <div className="people-list">
              {archived.map((person) => <ArchivedPersonRow key={person.id} onUpdate={onUpdate} person={person} />)}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function ApprovalRequestRow({ person, onUpdate }: {
  person: Profile
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
    <article className="person-row approval-request">
      <div className="person-identity">
        <Avatar name={person.display_name} />
        <div>
          <strong>{person.display_name}</strong>
          <span>Solicitud recibida {formatDate(person.created_at.slice(0, 10), { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>
      </div>
      <div className="approval-actions">
        <span>Se habilitará como jugadora activa</span>
        <button className="primary-button" disabled={saving} onClick={approve}>
          {saving ? 'Aprobando…' : 'Aprobar como jugadora'}
        </button>
      </div>
    </article>
  )
}

function PeopleSection({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section className="section-block">
      <div className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div></div>
      <div className="people-list">{children}</div>
    </section>
  )
}

function PersonRow({ person, currentUserId, onUpdate }: {
  person: Profile
  currentUserId: string
  onUpdate: (profile: Profile) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)

  async function change(field: 'is_approved' | 'is_active' | 'is_collaborator' | 'is_owner', value: boolean) {
    setSaving(true)
    try {
      await onUpdate({
        ...person,
        [field]: value,
        ...(field === 'is_owner' && value ? { is_collaborator: true } : {}),
      })
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
        is_collaborator: false,
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
      <div className="person-controls">
        <div className="permission-toggles">
          <Toggle checked={person.is_approved} disabled={saving || person.id === currentUserId} label="Aprobado" onChange={(value) => change('is_approved', value)} />
          <Toggle checked={person.is_active} disabled={saving} label="Activo" onChange={(value) => change('is_active', value)} />
          <Toggle checked={person.is_collaborator} disabled={saving || person.is_owner} label="Colaborador" onChange={(value) => change('is_collaborator', value)} />
          <Toggle checked={person.is_owner} disabled={saving || person.id === currentUserId} label="Owner" onChange={(value) => change('is_owner', value)} />
        </div>
        <button className="danger-button" disabled={saving || person.id === currentUserId} onClick={archive}>Desautorizar</button>
      </div>
    </article>
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

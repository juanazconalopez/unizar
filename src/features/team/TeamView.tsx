import { useState } from 'react'
import type { ReactNode } from 'react'
import { Avatar } from '../../components/ui/Avatar'
import { PageHeader } from '../../components/ui/PageHeader'
import { formatDate } from '../../lib/dates'
import type { Profile } from '../../types'

export function TeamView({ profiles, currentUserId, onUpdate }: {
  profiles: Profile[]
  currentUserId: string
  onUpdate: (profile: Profile) => Promise<void>
}) {
  const pending = profiles.filter((profile) => !profile.is_approved)
  const approved = profiles.filter((profile) => profile.is_approved)

  return (
    <div className="page">
      <PageHeader
        eyebrow="ADMINISTRACIÓN"
        title="Equipo"
        subtitle={`${approved.length} miembros aprobados · ${pending.length} solicitudes pendientes`}
      />
      {pending.length > 0 && (
        <PeopleSection eyebrow="REQUIERE ATENCIÓN" title="Solicitudes pendientes">
          {pending.map((person) => <PersonRow currentUserId={currentUserId} key={person.id} onUpdate={onUpdate} person={person} />)}
        </PeopleSection>
      )}
      <PeopleSection eyebrow="MIEMBROS" title="Permisos del equipo">
        {approved.map((person) => <PersonRow currentUserId={currentUserId} key={person.id} onUpdate={onUpdate} person={person} />)}
      </PeopleSection>
    </div>
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

  return (
    <article className="person-row">
      <div className="person-identity">
        <Avatar name={person.display_name} />
        <div>
          <strong>{person.display_name}{person.id === currentUserId && <small> Tú</small>}</strong>
          <span>Desde {formatDate(person.created_at.slice(0, 10), { month: 'long', year: 'numeric' })}</span>
        </div>
      </div>
      <div className="permission-toggles">
        <Toggle checked={person.is_approved} disabled={saving || person.id === currentUserId} label="Aprobado" onChange={(value) => change('is_approved', value)} />
        <Toggle checked={person.is_active} disabled={saving} label="Activo" onChange={(value) => change('is_active', value)} />
        <Toggle checked={person.is_collaborator} disabled={saving || person.is_owner} label="Colaborador" onChange={(value) => change('is_collaborator', value)} />
        <Toggle checked={person.is_owner} disabled={saving || person.id === currentUserId} label="Owner" onChange={(value) => change('is_owner', value)} />
      </div>
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

import { useMemo, useState } from 'react'
import type { ConfigurableRole, PermissionDefinition, PermissionKey, RolePermission } from '../../lib/permissions'
import { errorText } from '../../lib/errors'

const ROLES: Array<{ key: ConfigurableRole; label: string }> = [
  { key: 'coach', label: 'Entrenador' },
  { key: 'viewer', label: 'Dirección' },
  { key: 'player', label: 'Jugadora' },
]

export function PermissionsSettingsView({ definitions, grants, onReset, onSave }: {
  definitions: PermissionDefinition[]
  grants: RolePermission[]
  onReset: (role: ConfigurableRole) => Promise<void>
  onSave: (role: ConfigurableRole, permissions: PermissionKey[]) => Promise<void>
}) {
  const [role, setRole] = useState<ConfigurableRole>('coach')
  const [drafts, setDrafts] = useState<Partial<Record<ConfigurableRole, Set<PermissionKey>>>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const configured = useMemo(() => new Set(grants.filter((grant) => grant.role === role).map((grant) => grant.permission_key)), [grants, role])
  const selected = drafts[role] ?? configured
  const sections = useMemo(() => {
    const grouped = new Map<string, { label: string; definitions: PermissionDefinition[] }>()
    for (const definition of definitions) {
      const section = grouped.get(definition.section_key) ?? { label: definition.section_label, definitions: [] }
      section.definitions.push(definition)
      grouped.set(definition.section_key, section)
    }
    return [...grouped.entries()]
  }, [definitions])

  function update(next: Set<PermissionKey>) {
    setDrafts((current) => ({ ...current, [role]: next }))
  }

  function toggle(definition: PermissionDefinition, enabled: boolean) {
    const next = new Set(selected)
    if (enabled) {
      next.add(definition.key)
      let parent = definition.parent_key
      while (parent) {
        next.add(parent)
        parent = definitions.find((item) => item.key === parent)?.parent_key ?? null
      }
    } else {
      next.delete(definition.key)
      const descendants = new Set<PermissionKey>([definition.key])
      let changed = true
      while (changed) {
        changed = false
        for (const item of definitions) {
          if (item.parent_key && descendants.has(item.parent_key) && !descendants.has(item.key)) {
            descendants.add(item.key)
            changed = true
          }
        }
      }
      for (const key of descendants) next.delete(key)
    }
    update(next)
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      await onSave(role, [...selected])
      setDrafts((current) => ({ ...current, [role]: undefined }))
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      setSaving(false)
    }
  }

  async function reset() {
    if (!window.confirm(`¿Restaurar los permisos predeterminados de ${ROLES.find((item) => item.key === role)?.label}?`)) return
    setSaving(true)
    setError('')
    try {
      await onReset(role)
      setDrafts((current) => ({ ...current, [role]: undefined }))
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      setSaving(false)
    }
  }

  if (!definitions.length) return <div className="empty-state"><h3>Catálogo de permisos no disponible</h3><p>Ejecuta la migración de permisos en Supabase y vuelve a cargar esta sección.</p></div>

  const dirty = drafts[role] !== undefined
  return <section className="settings-section permissions-settings">
    <div className="settings-section-heading">
      <div><span className="eyebrow">CONTROL DE ACCESO</span><h2>Permisos por rol</h2><p>Los roles se acumulan. El owner conserva siempre acceso completo.</p></div>
      <div className="permissions-save-actions">
        <button className="secondary-button" disabled={saving} onClick={() => void reset()} type="button">Restaurar valores</button>
        <button className="primary-button" disabled={!dirty || saving} onClick={() => void save()} type="button">{saving ? 'Guardando…' : 'Guardar permisos'}</button>
      </div>
    </div>
    <div className="permissions-role-tabs" role="tablist" aria-label="Rol configurado">
      {ROLES.map((item) => <button aria-selected={role === item.key} className={role === item.key ? 'active' : ''} key={item.key} onClick={() => setRole(item.key)} role="tab" type="button">{item.label}</button>)}
      <button aria-disabled="true" className="locked" role="tab" type="button">Owner · acceso completo</button>
    </div>
    {error && <p className="form-error">{error}</p>}
    <div className="permission-section-list">
      {sections.map(([sectionKey, section]) => <details className="permission-section-card" key={sectionKey} open>
        <summary><strong>{section.label}</strong><span>{section.definitions.filter((item) => selected.has(item.key)).length}/{section.definitions.length}</span></summary>
        <div className="permission-tree">
          {section.definitions.map((definition) => {
            const parentEnabled = !definition.parent_key || selected.has(definition.parent_key)
            const disabled = !definition.configurable || definition.owner_only || !parentEnabled
            return <label className={`permission-row${definition.parent_key ? ' child' : ''}${disabled ? ' disabled' : ''}`} key={definition.key}>
              <span><strong>{definition.label}</strong>{definition.description && <small>{definition.description}</small>}</span>
              <input checked={selected.has(definition.key)} disabled={disabled} onChange={(event) => toggle(definition, event.target.checked)} type="checkbox" />
            </label>
          })}
        </div>
      </details>)}
    </div>
  </section>
}

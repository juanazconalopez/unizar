import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import type { PermissionDefinition } from '../../lib/permissions'
import { PERMISSIONS } from '../../lib/permissions'
import { PermissionsSettingsView } from './PermissionsSettingsView'

const definitions: PermissionDefinition[] = [
  { key: PERMISSIONS.tasks.team, section_key: 'tasks', section_label: 'Tareas', label: 'Ver tareas del equipo', description: '', action: 'view', parent_key: null, sort_order: 1, configurable: true, owner_only: false },
  { key: PERMISSIONS.tasks.edit, section_key: 'tasks', section_label: 'Tareas', label: 'Editar', description: '', action: 'edit', parent_key: PERMISSIONS.tasks.team, sort_order: 2, configurable: true, owner_only: false },
  { key: PERMISSIONS.tasks.publish, section_key: 'tasks', section_label: 'Tareas', label: 'Publicar', description: '', action: 'publish', parent_key: PERMISSIONS.tasks.edit, sort_order: 3, configurable: true, owner_only: false },
]

describe('PermissionsSettingsView', () => {
  test('disables child actions until their view permission is enabled', async () => {
    const user = userEvent.setup()
    render(<PermissionsSettingsView definitions={definitions} grants={[]} onReset={vi.fn()} onSave={vi.fn()} />)
    expect(screen.getByRole('checkbox', { name: 'Editar' })).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: 'Ver tareas del equipo' }))
    expect(screen.getByRole('checkbox', { name: 'Editar' })).toBeEnabled()
    expect(screen.getByRole('checkbox', { name: 'Publicar' })).toBeDisabled()
  })

  test('removes every descendant when its parent is disabled', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<PermissionsSettingsView definitions={definitions} grants={definitions.map((definition) => ({ role: 'coach' as const, permission_key: definition.key }))} onReset={vi.fn()} onSave={onSave} />)
    await user.click(screen.getByRole('checkbox', { name: 'Ver tareas del equipo' }))
    await user.click(screen.getByRole('button', { name: 'Guardar permisos' }))
    expect(onSave).toHaveBeenCalledWith('coach', [])
  })

  test('keeps owner visible but immutable', () => {
    render(<PermissionsSettingsView definitions={definitions} grants={[]} onReset={vi.fn()} onSave={vi.fn()} />)
    expect(within(screen.getByRole('tablist')).getByText('Owner · acceso completo')).toHaveAttribute('aria-disabled', 'true')
  })
})

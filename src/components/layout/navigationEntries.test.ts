import { expect, test } from 'vitest'
import { makeProfile } from '../../test/fixtures'
import { canAccessView } from '../../app/appAccess'
import { canManageWorkGroups, PERMISSIONS } from '../../lib/permissions'
import { isNavigationGroup, navigationEntries } from './navigationEntries'

test('el owner abre la pantalla puente desde Gestión y la jugadora despliega las tres secciones', () => {
  const owner = navigationEntries(makeProfile({ is_owner: true }))
  const management = owner.find((entry) => entry.id === 'management')!
  expect(isNavigationGroup(management) && management.children.some((entry) => entry.id === 'groups')).toBe(true)
  const groups = navigationEntries(makeProfile()).find((entry) => entry.id === 'groups')!
  expect(isNavigationGroup(groups) && groups.children.map((entry) => entry.id)).toEqual(['training-groups','work-groups','video-analysis'])
})

test('los permisos retirados ocultan enlaces y rutas y Dirección nunca edita grupos', () => {
  const player = makeProfile()
  expect(navigationEntries(player, []).some((entry) => entry.id === 'groups')).toBe(false)
  for (const view of ['groups','work-groups','video-analysis'] as const) {
    expect(canAccessView(player, view)).toBe(true)
    expect(canAccessView(player, view, [])).toBe(false)
  }
  const viewer = makeProfile({ is_player: false, is_viewer: true })
  expect(canManageWorkGroups(viewer, 'members', [PERMISSIONS.workGroups.view, PERMISSIONS.workGroups.manage])).toBe(false)
  expect(canManageWorkGroups(viewer, 'video', [PERMISSIONS.videoAnalysis.view, PERMISSIONS.videoAnalysis.manage])).toBe(false)
  expect(canManageWorkGroups(makeProfile({ is_owner: true, is_active: false }), 'members')).toBe(false)
})

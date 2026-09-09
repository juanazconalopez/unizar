import { beforeEach, describe, expect, test, vi } from 'vitest'
import { PERMISSIONS } from '../lib/permissions'
import { fetchMyPermissions, resetRolePermissions, saveRolePermissions } from './permissionsService'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

describe('permissionsService', () => {
  beforeEach(() => mocks.rpc.mockReset())

  test('loads the effective permission keys', async () => {
    mocks.rpc.mockResolvedValue({ data: [PERMISSIONS.tasks.team], error: null })
    await expect(fetchMyPermissions()).resolves.toEqual([PERMISSIONS.tasks.team])
    expect(mocks.rpc).toHaveBeenCalledWith('get_my_permissions')
  })

  test('saves and restores one configurable role atomically', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    await saveRolePermissions('coach', [PERMISSIONS.training.view])
    await resetRolePermissions('coach')
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'set_role_permissions', {
      checked_role: 'coach', checked_permissions: [PERMISSIONS.training.view],
    })
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'reset_role_permissions', { checked_role: 'coach' })
  })

  test('propagates permission RPC failures', async () => {
    const error = new Error('denied')
    mocks.rpc.mockResolvedValue({ data: null, error })
    await expect(fetchMyPermissions()).rejects.toBe(error)
  })
})

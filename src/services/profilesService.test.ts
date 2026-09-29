import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), upload: vi.fn(), remove: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))
vi.mock('./profilePhotoService', () => ({ uploadProfilePhoto: mocks.upload, deleteProfilePhoto: mocks.remove }))

import { makeProfile } from '../test/fixtures'
import { updateManagedProfilePhoto, updateManagedProfile, updateOwnProfileDetails } from './profilesService'

describe('profile persistence', () => {
  beforeEach(() => vi.clearAllMocks())

  test('updates the authenticated profile details through the restricted function', async () => {
    mocks.rpc.mockResolvedValue({ data: undefined, error: null })
    await expect(updateOwnProfileDetails(makeProfile(), { displayName: 'María López', phone: '+34 600 123 123', birthDate: '1997-05-12' })).resolves.toBeUndefined()
    expect(mocks.rpc).toHaveBeenCalledWith('update_own_profile', {
      new_display_name: 'María López', new_phone: '+34 600 123 123', new_birth_date: '1997-05-12', new_avatar_path: null,
    })
  })

  test('keeps an existing photo when the player edits personal details', async () => {
    mocks.rpc.mockResolvedValue({ data: undefined, error: null })
    const profile = makeProfile({ avatar_path: 'player-1/current.jpg' })
    await updateOwnProfileDetails(profile, { displayName: 'Ana Martín', phone: '', birthDate: '' })
    expect(mocks.rpc).toHaveBeenCalledWith('update_own_profile', expect.objectContaining({ new_avatar_path: 'player-1/current.jpg' }))
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.remove).not.toHaveBeenCalled()
  })

  test('updates only the managed photo and removes the old file after saving', async () => {
    mocks.rpc.mockResolvedValue({ data: undefined, error: null })
    mocks.upload.mockResolvedValue('player-2/new-photo.jpg')
    mocks.remove.mockResolvedValue(undefined)
    const profile = makeProfile({ id: 'player-2', avatar_path: 'player-2/old-photo.jpg' })
    const file = new File(['photo'], 'photo.png', { type: 'image/png' })
    await updateManagedProfilePhoto(profile, file)
    expect(mocks.rpc).toHaveBeenCalledWith('set_managed_player_photo', {
      checked_profile_id: 'player-2', new_avatar_path: 'player-2/new-photo.jpg',
    })
    expect(mocks.remove).toHaveBeenCalledWith('player-2/old-photo.jpg')
  })

  test('removes a newly uploaded photo if the owner save is rejected', async () => {
    mocks.rpc.mockResolvedValue({ data: undefined, error: new Error('Sin permisos') })
    mocks.upload.mockResolvedValue('player-2/new-photo.jpg')
    mocks.remove.mockResolvedValue(undefined)
    const profile = makeProfile({ id: 'player-2', avatar_path: 'player-2/old-photo.jpg' })
    const file = new File(['photo'], 'photo.png', { type: 'image/png' })
    await expect(updateManagedProfilePhoto(profile, file)).rejects.toThrow('Sin permisos')
    expect(mocks.remove).toHaveBeenCalledWith('player-2/new-photo.jpg')
    expect(mocks.remove).not.toHaveBeenCalledWith('player-2/old-photo.jpg')
  })

  test('lets the owner update another profile without sending an email', async () => {
    mocks.rpc.mockResolvedValue({ data: undefined, error: null })
    const profile = makeProfile({ id: 'player-2' })
    await expect(updateManagedProfile(profile, {
      displayName: 'Lucía Pérez', phone: '+34 611 222 333', birthDate: '1999-10-02',
      isActive: true, isPlayer: true, isCoach: false, isViewer: false, isOwner: false,
    })).resolves.toBeUndefined()
    expect(mocks.rpc).toHaveBeenCalledWith('update_managed_profile', {
      checked_profile_id: 'player-2',
      new_display_name: 'Lucía Pérez',
      new_phone: '+34 611 222 333',
      new_birth_date: '1999-10-02',
      new_is_active: true,
      new_is_player: true,
      new_is_coach: false,
      new_is_viewer: false,
      new_is_owner: false,
      new_avatar_path: null,
    })
    expect(mocks.rpc.mock.calls[0][1]).not.toHaveProperty('email')
  })

  test('preserves a photo when a person stops being a player', async () => {
    mocks.rpc.mockResolvedValue({ data: undefined, error: null })
    const profile = makeProfile({ id: 'coach-1', avatar_path: 'coach-1/current.jpg' })
    await updateManagedProfile(profile, {
      displayName: 'Andrea López', phone: '', birthDate: '', isActive: true,
      isPlayer: false, isCoach: true, isViewer: false, isOwner: false,
    })
    expect(mocks.rpc).toHaveBeenCalledWith('update_managed_profile', expect.objectContaining({ new_avatar_path: 'coach-1/current.jpg' }))
    expect(mocks.remove).not.toHaveBeenCalled()
  })

  test('saves a non-player photo through the owner-only RPC', async () => {
    mocks.rpc.mockResolvedValue({ data: undefined, error: null })
    mocks.upload.mockResolvedValue('coach-1/new-photo.jpg')
    const profile = makeProfile({ id: 'coach-1', is_player: false, is_coach: true })
    const file = new File(['photo'], 'perfil.png', { type: 'image/png' })
    await updateManagedProfilePhoto(profile, file)
    expect(mocks.upload).toHaveBeenCalledWith('coach-1', file)
    expect(mocks.rpc).toHaveBeenCalledWith('set_managed_player_photo', {
      checked_profile_id: 'coach-1', new_avatar_path: 'coach-1/new-photo.jpg',
    })
  })

  test('uploads a replacement before saving and removes the obsolete player photo afterwards', async () => {
    mocks.rpc.mockResolvedValue({ data: undefined, error: null })
    mocks.upload.mockResolvedValue('player-2/new-photo.jpg')
    mocks.remove.mockResolvedValue(undefined)
    const profile = makeProfile({ id: 'player-2', avatar_path: 'player-2/old-photo.jpg' })
    const file = new File(['photo'], 'photo.png', { type: 'image/png' })

    await updateManagedProfile(profile, {
      displayName: 'Lucía Pérez', phone: '', birthDate: '', isActive: true,
      isPlayer: true, isCoach: false, isViewer: false, isOwner: false,
    }, file)

    expect(mocks.upload).toHaveBeenCalledWith('player-2', file)
    expect(mocks.rpc).toHaveBeenCalledWith('update_managed_profile', expect.objectContaining({ new_avatar_path: 'player-2/new-photo.jpg' }))
    expect(mocks.remove).toHaveBeenCalledWith('player-2/old-photo.jpg')
  })
})

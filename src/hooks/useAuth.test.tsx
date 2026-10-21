import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const photoCache = vi.hoisted(() => ({ setUser: vi.fn(), clear: vi.fn() }))
vi.mock('../services/profilePhotoService', () => ({ setProfilePhotoCacheUser: photoCache.setUser, clearProfilePhotoCache: photoCache.clear }))
const privateCaches = vi.hoisted(() => ({ birthdays: vi.fn(), images: vi.fn() }))
vi.mock('../services/birthdayService', () => ({ setBirthdayCacheUser: privateCaches.birthdays }))
vi.mock('../services/contentImagesService', () => ({ setContentImageCacheUser: privateCaches.images }))

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
      signInWithOAuth: mocks.signInWithOAuth,
      signOut: mocks.signOut,
    },
  },
}))

import { useAuth } from './useAuth'

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    photoCache.clear.mockResolvedValue(undefined)
    mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: mocks.unsubscribe } } })
  })

  test('clears private photo bytes when the user signs out', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'owner-1' } } }, error: null })
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(photoCache.setUser).toHaveBeenCalledWith('owner-1')

    act(() => mocks.onAuthStateChange.mock.calls[0][0]('SIGNED_OUT', null))
    expect(photoCache.clear).toHaveBeenCalled()
    expect(privateCaches.birthdays).toHaveBeenLastCalledWith(null)
    expect(privateCaches.images).toHaveBeenLastCalledWith(null)
    expect(result.current.session).toBeNull()
  })

  test('finishes loading and exposes a network failure from session recovery', async () => {
    mocks.getSession.mockRejectedValue(new Error('No se ha podido recuperar la sesión.'))

    const { result } = renderHook(() => useAuth())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.session).toBeNull()
    expect(result.current.errorMessage).toBe('No se ha podido recuperar la sesión.')
  })

  test('isolates caches on account changes and ignores session recovery that finishes after signout', async () => {
    let finishRecovery!: (value: unknown) => void
    mocks.getSession.mockReturnValue(new Promise((resolve) => { finishRecovery = resolve }))
    const { result } = renderHook(() => useAuth())
    act(() => mocks.onAuthStateChange.mock.calls[0][0]('SIGNED_IN', { user: { id: 'player-2' } }))
    expect(privateCaches.birthdays).toHaveBeenLastCalledWith('player-2')
    expect(privateCaches.images).toHaveBeenLastCalledWith('player-2')
    act(() => mocks.onAuthStateChange.mock.calls[0][0]('SIGNED_OUT', null))
    await act(async () => finishRecovery({ data: { session: { user: { id: 'owner-1' } } }, error: null }))
    expect(result.current.session).toBeNull()
    expect(privateCaches.images).toHaveBeenLastCalledWith(null)
    expect(photoCache.setUser).not.toHaveBeenCalledWith('owner-1')
  })

  test('exposes login and logout rejections instead of leaving an unhandled promise', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null })
    mocks.signInWithOAuth.mockRejectedValue(new DOMException('Sin espacio para guardar la sesión', 'QuotaExceededError'))
    mocks.signOut.mockRejectedValue(new Error('No se ha podido cerrar la sesión'))
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.signInWithGoogle())
    expect(result.current.errorMessage).toBe('Sin espacio para guardar la sesión')
    await act(() => result.current.signOut())
    expect(result.current.errorMessage).toBe('No se ha podido cerrar la sesión')
  })
})

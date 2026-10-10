import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const photoCache = vi.hoisted(() => ({ setUser: vi.fn(), clear: vi.fn() }))
vi.mock('../services/profilePhotoService', () => ({ setProfilePhotoCacheUser: photoCache.setUser, clearProfilePhotoCache: photoCache.clear }))

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
    expect(result.current.session).toBeNull()
  })

  test('finishes loading and exposes a network failure from session recovery', async () => {
    mocks.getSession.mockRejectedValue(new Error('No se ha podido recuperar la sesión.'))

    const { result } = renderHook(() => useAuth())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.session).toBeNull()
    expect(result.current.errorMessage).toBe('No se ha podido recuperar la sesión.')
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

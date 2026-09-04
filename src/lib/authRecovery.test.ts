import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  refreshSession: vi.fn(),
}))

vi.mock('./supabase', () => ({
  supabase: { auth: { refreshSession: mocks.refreshSession } },
}))

import { JWT_FUTURE_RETRY_DELAY_MS, isJwtIssuedAtFutureError, withAuthRecovery } from './authRecovery'

describe('auth recovery', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mocks.refreshSession.mockResolvedValue({ error: null })
  })

  test('recognises the PostgREST future-JWT error', () => {
    expect(isJwtIssuedAtFutureError({ code: 'PGRST303', message: 'JWT issued at future' })).toBe(true)
    expect(isJwtIssuedAtFutureError(new Error('JWTIssuedAtFuture'))).toBe(true)
    expect(isJwtIssuedAtFutureError(new Error('JWT signature is invalid'))).toBe(false)
  })

  test('refreshes once and retries only future-JWT failures', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce({ code: 'PGRST303', message: 'JWT issued at future' })
      .mockResolvedValueOnce('loaded')

    const resultPromise = withAuthRecovery(operation)
    await vi.advanceTimersByTimeAsync(0)
    expect(mocks.refreshSession).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(JWT_FUTURE_RETRY_DELAY_MS)
    await expect(resultPromise).resolves.toBe('loaded')
    expect(operation).toHaveBeenCalledTimes(2)
  })

  test('does not retry unrelated errors', async () => {
    const failure = new Error('No hay conexión')
    const operation = vi.fn().mockRejectedValue(failure)

    await expect(withAuthRecovery(operation)).rejects.toBe(failure)
    expect(operation).toHaveBeenCalledTimes(1)
    expect(mocks.refreshSession).not.toHaveBeenCalled()
  })
})

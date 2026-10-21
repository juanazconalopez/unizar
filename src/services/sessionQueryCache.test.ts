import { afterEach, expect, test, vi } from 'vitest'
import { SessionQueryCache } from './sessionQueryCache'

afterEach(() => vi.useRealTimers())

test('deduplicates a pending request and expires successful results', async () => {
  vi.useFakeTimers()
  const cache = new SessionQueryCache()
  const fetcher = vi.fn().mockResolvedValue(['dato'])
  const first = cache.load('key', fetcher)
  expect(cache.load('key', fetcher)).toBe(first)
  await first
  await cache.load('key', fetcher)
  expect(fetcher).toHaveBeenCalledOnce()
  vi.advanceTimersByTime(60_000)
  await cache.load('key', fetcher)
  expect(fetcher).toHaveBeenCalledTimes(2)
})

test('failed and invalidated requests cannot poison a later cached result', async () => {
  const cache = new SessionQueryCache()
  const fetcher = vi.fn().mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValue('actualizado')
  await expect(cache.load('key', fetcher)).rejects.toThrow('Sin conexión')
  expect(await cache.load('key', fetcher)).toBe('actualizado')
  let fail!: (reason: Error) => void
  cache.clear()
  const old = cache.load('key', () => new Promise((_resolve, reject) => { fail = reject }))
  await Promise.resolve()
  cache.clear()
  const current = cache.load('key', fetcher)
  fail(new Error('Petición anterior'))
  await expect(old).rejects.toThrow('Petición anterior')
  await current
  expect(cache.load('key', fetcher)).toBe(current)
})

test('does not cache a resolved PostgREST error, allowing JWT recovery and retries', async () => {
  const cache = new SessionQueryCache()
  const fetcher = vi.fn().mockResolvedValueOnce({ data: null, error: { message: 'JWT issued at future' } })
    .mockResolvedValue({ data: ['actual'], error: null })
  await cache.load('key', fetcher)
  expect(await cache.load('key', fetcher)).toEqual({ data: ['actual'], error: null })
  expect(fetcher).toHaveBeenCalledTimes(2)
})

import { afterEach, describe, expect, test, vi } from 'vitest'
import { getLatestAppVersion, isNewerAppVersion } from './appVersion'

afterEach(() => vi.unstubAllGlobals())

describe('application versions', () => {
  test.each([
    ['1.0.3', '1.0.1', true],
    ['1.0.10', '1.0.9', true],
    ['1.10.0', '1.9.9', true],
    ['2.0.0', '1.99.99', true],
    ['1.0.3', '1.0.3', false],
    ['1.0.2', '1.0.3', false],
    ['01.0.3', '1.0.1', false],
    ['invalid', '1.0.1', false],
  ])('compares published %s with running %s', (latest, current, expected) => {
    expect(isNewerAppVersion(latest, current)).toBe(expected)
  })

  test('requests the published version without reusing cached metadata', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{"version":"1.0.3"}'))
    vi.stubGlobal('fetch', fetch)
    const signal = new AbortController().signal
    expect(await getLatestAppVersion(signal)).toBe('1.0.3')
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/^\/version\.json\?check=\d+$/), { cache: 'no-store', signal })
  })

  test.each(['null', '{}', '{"version":3}', '{"version":"1.2"}', '<html>old app</html>'])('rejects malformed metadata: %s', async (body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)))
    await expect(getLatestAppVersion(new AbortController().signal)).rejects.toThrow()
  })

  test('rejects a failed server response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })))
    await expect(getLatestAppVersion(new AbortController().signal)).rejects.toThrow('No se pudo comprobar')
  })
})

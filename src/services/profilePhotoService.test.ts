import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const storage = vi.hoisted(() => ({ download: vi.fn(), remove: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { storage: { from: () => storage } } }))

import { clearProfilePhotoCache, deleteProfilePhoto, loadProfilePhotoDataUrl, loadProfilePhotoUrl, setProfilePhotoCacheUser } from './profilePhotoService'

const photo = new Blob(['foto privada'], { type: 'image/jpeg' })

beforeEach(() => {
  vi.clearAllMocks()
  storage.download.mockResolvedValue({ data: photo, error: null })
  storage.remove.mockResolvedValue({ error: null })
  URL.createObjectURL = vi.fn(() => 'blob:foto')
  URL.revokeObjectURL = vi.fn()
})

afterEach(async () => {
  await clearProfilePhotoCache()
})

describe('private profile photo cache', () => {
  test('shares one download between simultaneous profile and lineup loads', async () => {
    setProfilePhotoCacheUser('owner-1')
    const [url, dataUrl, repeatedUrl] = await Promise.all([
      loadProfilePhotoUrl('member-1/photo.jpg'),
      loadProfilePhotoDataUrl('member-1/photo.jpg'),
      loadProfilePhotoUrl('member-1/photo.jpg'),
    ])

    expect(url).toBe('blob:foto')
    expect(repeatedUrl).toBe(url)
    expect(dataUrl).toMatch(/^data:image\/jpeg;base64,/)
    expect(storage.download).toHaveBeenCalledTimes(1)
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
  })

  test('reuses the browser cache after a module reload and separates accounts', async () => {
    const buckets = new Map<string, Map<string, Response>>()
    class CachedResponse {
      headers: Headers
      private readonly value: Blob
      constructor(value: Blob, init?: ResponseInit) {
        this.value = value
        this.headers = new Headers(init?.headers)
      }
      async blob() { return this.value }
      clone() { return new CachedResponse(this.value, { headers: this.headers }) }
    }
    vi.stubGlobal('Response', CachedResponse)
    vi.stubGlobal('caches', {
      open: async (name: string) => {
        let items = buckets.get(name)
        if (!items) { items = new Map(); buckets.set(name, items) }
        return {
          match: async (request: Request) => items.get(request.url)?.clone(),
          put: async (request: Request, response: Response) => { items.set(request.url, response.clone()) },
          delete: async (request: Request) => items.delete(request.url),
          keys: async () => [...items.keys()].map((url) => new Request(url)),
        }
      },
      keys: async () => [...buckets.keys()],
      delete: async (name: string) => buckets.delete(name),
    })

    setProfilePhotoCacheUser('owner-1')
    await loadProfilePhotoUrl('member-1/photo.jpg')
    expect(buckets.get('unizar-profile-photos-v1-owner-1')?.size).toBe(1)
    vi.resetModules()
    const reloaded = await import('./profilePhotoService')
    reloaded.setProfilePhotoCacheUser('owner-1')
    await reloaded.loadProfilePhotoUrl('member-1/photo.jpg')
    expect(storage.download).toHaveBeenCalledTimes(1)

    reloaded.setProfilePhotoCacheUser('owner-2')
    await reloaded.loadProfilePhotoUrl('member-1/photo.jpg')
    expect(storage.download).toHaveBeenCalledTimes(2)
    await reloaded.deleteProfilePhoto('member-1/photo.jpg')
    await reloaded.loadProfilePhotoUrl('member-1/photo.jpg')
    expect(storage.download).toHaveBeenCalledTimes(3)
    await reloaded.clearProfilePhotoCache()
    expect([...buckets.keys()].filter((name) => name.startsWith('unizar-profile-photos-v1-'))).toHaveLength(0)
    vi.unstubAllGlobals()
  })

  test('invalidates a deleted photo so the next view downloads it again', async () => {
    setProfilePhotoCacheUser('owner-1')
    await loadProfilePhotoUrl('member-1/photo.jpg')
    await deleteProfilePhoto('member-1/photo.jpg')
    await loadProfilePhotoUrl('member-1/photo.jpg')

    expect(storage.download).toHaveBeenCalledTimes(2)
    expect(storage.remove).toHaveBeenCalledWith(['member-1/photo.jpg'])
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:foto')
  })
})

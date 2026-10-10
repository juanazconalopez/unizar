import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { contentImageToken } from '../lib/contentImageTokens'

const mocks = vi.hoisted(() => ({
  single: vi.fn(), in: vi.fn(), insert: vi.fn(), rpc: vi.fn(),
  upload: vi.fn(), download: vi.fn(), remove: vi.fn(),
}))
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ single: mocks.single }), in: mocks.in }), insert: mocks.insert }),
    rpc: mocks.rpc,
    storage: { from: () => ({ upload: mocks.upload, download: mocks.download, remove: mocks.remove }) },
  },
}))

import { clearContentImageCache, cleanupContentImages, discardStagedContentImage, ensureContentImages, isStagedContentImageVolatile, loadContentImageBlob, stageContentImage } from './contentImagesService'

const imageId = '00000000-0000-4000-8000-000000000001'
const image = { id: imageId, storage_path: `owner/${imageId}.webp`, width: 120, height: 80 }
const blob = new Blob(['image'], { type: 'image/webp' })
let cache: { match: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn>; keys: ReturnType<typeof vi.fn> }
let cacheStorage: { open: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.single.mockResolvedValue({ data: image, error: null })
  mocks.in.mockResolvedValue({ data: [], error: null })
  mocks.insert.mockResolvedValue({ error: null })
  mocks.rpc.mockResolvedValue({ data: [], error: null })
  mocks.download.mockResolvedValue({ data: blob, error: null })
  mocks.upload.mockResolvedValue({ error: null })
  mocks.remove.mockResolvedValue({ error: null })
  cache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), delete: vi.fn().mockResolvedValue(true), keys: vi.fn().mockResolvedValue([]) }
  cacheStorage = { open: vi.fn().mockResolvedValue(cache), delete: vi.fn().mockResolvedValue(true) }
  vi.stubGlobal('caches', cacheStorage)
})

afterEach(async () => {
  await clearContentImageCache()
  vi.unstubAllGlobals()
})

function mockImagePreparation() {
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL() { return 'blob:preview' }
    static revokeObjectURL() {}
  })
  vi.stubGlobal('Image', class {
    naturalWidth = 120
    naturalHeight = 80
    onload: (() => void) | null = null
    set src(_value: string) { queueMicrotask(() => this.onload?.()) }
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(blob))
}

describe('optional content image cache', () => {
  test.each(['open', 'match', 'put', 'keys'] as const)('downloads and displays images even when cache %s fails', async (operation) => {
    const method = operation === 'open' ? cacheStorage.open : cache[operation]
    method.mockRejectedValue(new DOMException('Sin almacenamiento', 'QuotaExceededError'))
    await expect(loadContentImageBlob(imageId)).resolves.toBe(blob)
    expect(mocks.download).toHaveBeenCalledWith(image.storage_path)
  })

  test('downloads an image again if the cached response cannot be read', async () => {
    cache.match.mockResolvedValue({ blob: vi.fn().mockRejectedValue(new Error('Datos de caché eliminados')), headers: new Headers() })
    await expect(loadContentImageBlob(imageId)).resolves.toBe(blob)
  })

  test('pastes, previews and uploads staged images from memory when cache writes fail', async () => {
    mockImagePreparation()
    cache.put.mockRejectedValue(new DOMException('Sin espacio', 'QuotaExceededError'))
    cache.delete.mockRejectedValue(new DOMException('Bloqueado', 'SecurityError'))
    const id = await stageContentImage(new File(['source'], 'source.png', { type: 'image/png' }))
    expect(isStagedContentImageVolatile(id)).toBe(true)
    await expect(loadContentImageBlob(id)).resolves.toBe(blob)
    await expect(ensureContentImages([contentImageToken(id)], 'owner')).resolves.toEqual([id])
    expect(mocks.upload).toHaveBeenCalledWith(`owner/${id}.webp`, blob, expect.any(Object))
    expect(mocks.remove).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalledWith('cleanup_content_images', expect.anything())
    expect(isStagedContentImageVolatile(id)).toBe(false)
  })

  test('continues cleaning remote images and signing out when cache deletion fails', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ storage_path: image.storage_path }], error: null })
    cache.delete.mockRejectedValue(new DOMException('Bloqueado', 'SecurityError'))
    cacheStorage.delete.mockRejectedValue(new DOMException('Bloqueado', 'SecurityError'))
    await expect(cleanupContentImages([imageId])).resolves.toBeUndefined()
    expect(mocks.remove).toHaveBeenCalledWith([image.storage_path])
    await expect(discardStagedContentImage(imageId)).resolves.toBeUndefined()
    await expect(clearContentImageCache()).resolves.toBeUndefined()
  })

  test('continues when Cache Storage is unavailable', async () => {
    vi.stubGlobal('caches', undefined)
    await expect(loadContentImageBlob(imageId)).resolves.toBe(blob)
  })

  test('continues when merely accessing Cache Storage throws a SecurityError', async () => {
    Object.defineProperty(globalThis, 'caches', {
      configurable: true,
      get() { throw new DOMException('Bloqueado', 'SecurityError') },
    })
    await expect(loadContentImageBlob(imageId)).resolves.toBe(blob)
    await expect(clearContentImageCache()).resolves.toBeUndefined()
  })

  test('still reports a real download failure', async () => {
    cacheStorage.open.mockRejectedValue(new DOMException('Sin espacio', 'QuotaExceededError'))
    mocks.download.mockResolvedValue({ data: null, error: new Error('No hay conexión') })
    await expect(loadContentImageBlob(imageId)).rejects.toThrow('No hay conexión')
  })
})

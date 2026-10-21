import { describe, expect, test, vi } from 'vitest'
const from = vi.hoisted(() => vi.fn())
vi.mock('../lib/supabase', () => ({ supabase: { from } }))
import { fetchLibraryItems, parseDriveFolder } from './libraryService'

describe('libraryService', () => {
  test('extracts a folder id and optional resource key from a Drive URL', () => {
    expect(parseDriveFolder('https://drive.google.com/drive/folders/folder_ABC-123?resourcekey=resource-1')).toEqual({
      id: 'folder_ABC-123',
      resourceKey: 'resource-1',
    })
    expect(parseDriveFolder('https://drive.google.com/drive/folders/1n7BHojWWPNiwVpAa-LTmJfMpQz-vqn2y?usp=drive_link')?.id)
      .toBe('1n7BHojWWPNiwVpAa-LTmJfMpQz-vqn2y')
  })

  test('accepts a raw folder id and rejects arbitrary text', () => {
    expect(parseDriveFolder('1n7BHojWWPNiwVpAa-LTmJfMpQz-vqn2y')).toEqual({ id: '1n7BHojWWPNiwVpAa-LTmJfMpQz-vqn2y', resourceKey: null })
    expect(parseDriveFolder('https://example.com/not-drive')).toBeNull()
    expect(parseDriveFolder('')).toBeNull()
  })

  test('loads the entire Drive catalog beyond the API limit with a unique order', async () => {
    const items = Array.from({ length: 1201 }, (_, id) => ({ drive_file_id: String(id), name: 'Documento' }))
    const order = vi.fn()
    const range = vi.fn()
    const select = vi.fn()
    const builder = { order, range, select }
    select.mockReturnValue(builder)
    order.mockReturnValue(builder)
    range.mockImplementation((start: number, end: number) => Promise.resolve({ data: items.slice(start, end + 1), error: null }))
    from.mockReturnValue(builder)
    expect(await fetchLibraryItems()).toEqual(items)
    expect(range.mock.calls).toEqual([[0, 499], [500, 999], [1000, 1499]])
    expect(order).toHaveBeenCalledWith('drive_file_id')
  })
})

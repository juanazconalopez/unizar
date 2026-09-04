import { describe, expect, test } from 'vitest'
import { parseDriveFolder } from './libraryService'

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
})

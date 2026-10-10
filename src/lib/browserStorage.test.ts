import { afterEach, describe, expect, test, vi } from 'vitest'
import { readLocalStorage, removeLocalStorageByPrefix, removeLocalStorageItem, writeLocalStorage } from './browserStorage'

afterEach(() => vi.unstubAllGlobals())

describe('optional browser storage', () => {
  test('continues when storage access is blocked or unavailable', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(readLocalStorage('draft')).toBeNull()
    expect(writeLocalStorage('draft', 'text')).toBe(false)
    expect(() => removeLocalStorageItem('draft')).not.toThrow()
    expect(() => removeLocalStorageByPrefix('unizar:')).not.toThrow()
  })

  test('handles a SecurityError when merely accessing localStorage', () => {
    vi.stubGlobal('localStorage', undefined)
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() { throw new DOMException('Bloqueado', 'SecurityError') },
    })
    expect(readLocalStorage('draft')).toBeNull()
    expect(writeLocalStorage('draft', 'text')).toBe(false)
    expect(() => removeLocalStorageItem('draft')).not.toThrow()
    expect(() => removeLocalStorageByPrefix('unizar:')).not.toThrow()
  })

  test('handles quota errors without removing the session or other data', () => {
    localStorage.setItem('session', 'keep-session')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Sin espacio', 'QuotaExceededError') })
    expect(writeLocalStorage('draft', 'text')).toBe(false)
    expect(readLocalStorage('session')).toBe('keep-session')
  })

  test('invalidates only the requested prefix', () => {
    localStorage.setItem('unizar:birthdays:today', 'cached')
    localStorage.setItem('session', 'keep-session')
    localStorage.setItem('unizar:training-plan-draft:owner', 'keep-draft')
    removeLocalStorageByPrefix('unizar:birthdays:')
    expect(readLocalStorage('unizar:birthdays:today')).toBeNull()
    expect(readLocalStorage('session')).toBe('keep-session')
    expect(readLocalStorage('unizar:training-plan-draft:owner')).toBe('keep-draft')
  })
})

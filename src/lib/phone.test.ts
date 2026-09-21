import { describe, expect, test } from 'vitest'
import { formatPhoneForExport, formatPhoneInput, isValidInternationalPhone, phoneCountry, phoneNationalNumber } from './phone'

describe('phone helpers', () => {
  test('uses Spain and its prefix by default, then stores an E.164 number', () => {
    expect(phoneCountry('')).toBe('ES')
    expect(formatPhoneInput('600123123', 'ES')).toEqual({ country: 'ES', formatted: '600 12 31 23', value: '+34600123123' })
  })

  test('validates a number according to its selected country', () => {
    expect(isValidInternationalPhone('+34600123123')).toBe(true)
    expect(isValidInternationalPhone('+34600123')).toBe(false)
    expect(isValidInternationalPhone('+33612345678')).toBe(true)
  })

  test('keeps only foreign prefixes in the player export', () => {
    expect(phoneNationalNumber('+34 600 123 123')).toBe('600 12 31 23')
    expect(formatPhoneForExport('+34600123123')).toBe('600 12 31 23')
    expect(formatPhoneForExport('+33612345678')).toBe('+33 6 12 34 56 78')
  })
})

import { describe, expect, test } from 'vitest'
import { errorText } from './errors'

describe('errorText', () => {
  test('extracts messages from Error instances and Supabase error objects', () => {
    expect(errorText(new Error('Error de aplicación'))).toBe('Error de aplicación')
    expect(errorText({ message: 'Error devuelto por Supabase', code: 'P0001' }))
      .toBe('Error devuelto por Supabase')
  })

  test('keeps a safe fallback for unknown values', () => {
    expect(errorText(null)).toBe('Ha ocurrido un error inesperado.')
  })
})

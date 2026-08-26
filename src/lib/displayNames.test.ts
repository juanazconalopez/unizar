import { describe, expect, test } from 'vitest'
import { areDisplayNamesSimilar, displayNameContains, normalizeDisplayName } from './displayNames'

describe('display names', () => {
  test('normalizes accents, case, punctuation and repeated spaces', () => {
    expect(normalizeDisplayName('  MARÍA-Luisa   López ')).toBe('maria luisa lopez')
    expect(displayNameContains('María Luisa López', 'luisa lo')).toBe(true)
  })

  test('detects identical and globally very similar names', () => {
    expect(areDisplayNamesSimilar('María López', 'Maria Lopez')).toBe(true)
    expect(areDisplayNamesSimilar('María López', 'Maria Lopex')).toBe(true)
  })

  test('does not warn merely because a name and part of a surname coincide', () => {
    expect(areDisplayNamesSimilar('Ana Martín', 'Ana Martínez')).toBe(false)
    expect(areDisplayNamesSimilar('María López', 'María López García')).toBe(false)
  })
})

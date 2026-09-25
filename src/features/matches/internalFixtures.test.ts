import { describe, expect, test } from 'vitest'
import type { Match } from '../../types'
import { visibleFixtureMatches } from './internalFixtures'

describe('visibleFixtureMatches', () => {
  test('shows one card for a linked derby and keeps an away side visible to its coach', () => {
    const home = { id: 'home', internal_fixture_id: 'fixture', is_home: true } as Match
    const away = { id: 'away', internal_fixture_id: 'fixture', is_home: false } as Match
    const external = { id: 'external', internal_fixture_id: null } as Match
    expect(visibleFixtureMatches([away, home, external])).toEqual([home, external])
    expect(visibleFixtureMatches([away])).toEqual([away])
  })
})

import { describe, expect, test } from 'vitest'
import type { Match } from '../../types'
import { matchTitle } from './matchPresentation'

describe('matchTitle', () => {
  test('uses the assigned team name for both sides of an internal fixture', () => {
    const home = { opponent: 'Unizar B', is_home: true, season_teams: { name: 'Unizar A' } } as Match
    const away = { opponent: 'Unizar A', is_home: false, season_teams: { name: 'Unizar B' } } as Match
    expect(matchTitle(home)).toBe('Unizar A vs Unizar B')
    expect(matchTitle(away)).toBe('Unizar A vs Unizar B')
  })
})

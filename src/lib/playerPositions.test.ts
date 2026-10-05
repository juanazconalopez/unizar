import { describe, expect, test } from 'vitest'
import { makeProfile } from '../test/fixtures'
import { groupPlayersByPosition, playingPositions, validPlayerPositions } from './playerPositions'

describe('player positions', () => {
  test('counts versatile players once by their primary position and keeps unassigned players visible', () => {
    const players = [
      makeProfile({ id: 'versatile', primary_position: 'prop', playing_positions: ['prop', 'centre'] }),
      makeProfile({ id: 'line', primary_position: 'scrum_half', playing_positions: ['scrum_half'] }),
      makeProfile({ id: 'unknown' }),
    ]
    const groups = groupPlayersByPosition(players)
    expect(groups.map(({ players }) => players.map((player) => player.id))).toEqual([['versatile'], ['line'], ['unknown']])
  })
  test('classifies second and back rows as forwards and all half backs as backs', () => {
    const groups = groupPlayersByPosition(playingPositions.map((position) => makeProfile({ id: position.value, primary_position: position.value })))
    expect(groups.map((group) => group.players.length)).toEqual([4, 5, 0])
  })
  test('requires a unique selection with its principal included, or an entirely empty selection', () => {
    expect(validPlayerPositions({ positions: [], primaryPosition: null })).toBe(true)
    expect(validPlayerPositions({ positions: ['prop', 'wing'], primaryPosition: 'wing' })).toBe(true)
    expect(validPlayerPositions({ positions: ['prop'], primaryPosition: null })).toBe(false)
    expect(validPlayerPositions({ positions: [], primaryPosition: 'prop' })).toBe(false)
    expect(validPlayerPositions({ positions: ['prop'], primaryPosition: 'wing' })).toBe(false)
    expect(validPlayerPositions({ positions: ['prop', 'prop'], primaryPosition: 'prop' })).toBe(false)
  })
})

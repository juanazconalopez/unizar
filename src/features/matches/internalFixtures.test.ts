import { describe, expect, test } from 'vitest'
import type { Match, MatchAvailability, MatchLineup } from '../../types'
import { fixtureAvailability, lineupReservations, reservedLineupPlayerIds, visibleFixtureMatches } from './internalFixtures'
import { makeMatch } from '../../test/fixtures'

describe('reservedLineupPlayerIds', () => {
  const home = makeMatch({ id: 'home', internal_fixture_id: 'derby' })
  const away = makeMatch({ id: 'away', internal_fixture_id: 'derby', is_home: false })
  const entry = (matchId: string, playerId: string, slot = 1): MatchLineup => ({
    match_id: matchId, player_id: playerId, slot_number: slot, sort_order: slot,
    role: slot <= 15 ? 'starter' : 'substitute', position: null, updated_at: home.updated_at,
  })

  test('reserva titulares y suplentes de un borrador guardado en el otro equipo, en ambos sentidos', () => {
    const lineups = [entry(home.id, 'home-starter'), entry(home.id, 'home-sub', 16), entry(away.id, 'away-starter')]
    expect(reservedLineupPlayerIds(away, [home, away], lineups)).toEqual(['home-starter', 'home-sub'])
    expect(reservedLineupPlayerIds(home, [home, away], lineups)).toEqual(['away-starter'])
  })

  test('libera a una jugadora al retirarla del otro equipo y guardar', () => {
    const lineups = [entry(home.id, 'player')]
    expect(reservedLineupPlayerIds(away, [home, away], lineups)).toEqual(['player'])
    expect(reservedLineupPlayerIds(away, [home, away], [])).toEqual([])
  })

  test('conserva reservas de otros partidos del día sin duplicados e ignora otras fechas', () => {
    const other = makeMatch({ id: 'other' })
    const tomorrow = makeMatch({ id: 'tomorrow', match_date: '2026-12-31' })
    const lineups = [entry(home.id, 'player'), entry(other.id, 'player'), entry(other.id, 'other-player'), entry(tomorrow.id, 'tomorrow-player')]
    expect(reservedLineupPlayerIds(away, [home, away, other, tomorrow], lineups)).toEqual(['player', 'other-player'])
  })

  test('reserva sábado/domingo, muestra la referencia externa y libera cancelados o borrados', () => {
    const saturday = { ...home, match_date: '2026-10-17' }
    const sunday = makeMatch({ id: 'external', match_date: '2026-10-18', team_id: 'b', season_teams: { id: 'b', name: 'Unizar B', is_mixed: false, is_default: false } })
    const next = makeMatch({ id: 'next', match_date: '2026-10-24' })
    const cancelled = makeMatch({ id: 'cancelled', match_date: sunday.match_date, status: 'cancelled' })
    const otherSeason = { ...sunday, id: 'other-season', season_id: 'other' }
    const entries = [entry(sunday.id, 'reserved', 16), entry(next.id, 'next'), entry(cancelled.id, 'cancelled'), entry(otherSeason.id, 'other')]
    expect(lineupReservations(saturday, [saturday, sunday, next, cancelled, otherSeason], entries)).toEqual([
      { player_id: 'reserved', match_id: sunday.id, team_name: 'Unizar B', match_date: sunday.match_date, is_derby: false },
      { player_id: 'other', match_id: otherSeason.id, team_name: 'Unizar B', match_date: sunday.match_date, is_derby: false },
    ])
    expect(reservedLineupPlayerIds(saturday, [saturday, next, cancelled], entries)).toEqual([])
  })
})

describe('visibleFixtureMatches', () => {
  test('shows one card for a linked derby and keeps an away side visible to its coach', () => {
    const home = { id: 'home', internal_fixture_id: 'fixture', is_home: true } as Match
    const away = { id: 'away', internal_fixture_id: 'fixture', is_home: false } as Match
    const external = { id: 'external', internal_fixture_id: null } as Match
    expect(visibleFixtureMatches([away, home, external])).toEqual([home, external])
    expect(visibleFixtureMatches([away])).toEqual([away])
  })
})

describe('fixtureAvailability', () => {
  const home = makeMatch({ id: 'home', internal_fixture_id: 'derby', is_home: true })
  const away = makeMatch({ id: 'away', internal_fixture_id: 'derby', is_home: false })
  const response: MatchAvailability = { match_id: home.id, player_id: 'player-1', status: 'available', comment: null, updated_at: '2026-10-01T10:00:00Z' }

  test('una respuesta en A sirve para preparar B, sin copiar filas guardadas', () => {
    expect(fixtureAvailability(away, [home, away], [response])).toEqual([{ ...response, match_id: away.id }])
    expect(response.match_id).toBe(home.id)
  })
  test('la última respuesta prevalece, incluso si retira disponibilidad desde la otra ficha', () => {
    const withdrawal = { ...response, match_id: away.id, status: 'unavailable' as const, updated_at: '2026-10-01T12:00:00+01:00' }
    for (const match of [home, away]) {
      expect(fixtureAvailability(match, [home, away], [response, withdrawal])).toEqual([{ ...withdrawal, match_id: match.id }])
    }
  })
  test('un empate se resuelve igual en ambas fichas y sin depender del orden de carga', () => {
    const other = { ...response, match_id: away.id, status: 'doubt' as const }
    expect(fixtureAvailability(home, [home, away], [response, other])[0].status).toBe('doubt')
    expect(fixtureAvailability(away, [home, away], [other, response])[0].status).toBe('doubt')
  })
  test('no mezcla otros partidos, temporadas o fechas ni partidos externos sin derbi', () => {
    const external = makeMatch({ id: 'external' })
    const wrongSeason = { ...away, id: 'wrong-season', season_id: 'other' }
    const wrongDate = { ...away, id: 'wrong-date', match_date: '2026-11-01' }
    const responses = [external, wrongSeason, wrongDate].map((match) => ({ ...response, match_id: match.id }))
    expect(fixtureAvailability(home, [home, away, external, wrongSeason, wrongDate], responses)).toEqual([])
    expect(fixtureAvailability(external, [home, away, external], [response])).toEqual([])
  })
})

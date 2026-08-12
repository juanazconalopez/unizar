import { describe, expect, test } from 'vitest'
import {
  addMatchStatistics,
  discoverCalendarUrl,
  inferSeason,
  parseFixtures,
  parseStandings,
} from './parser'
import type { PlayerStatistic } from './parser'

describe('MatchReady competition parser', () => {
  test('discovers the federation iframe and parses fixtures safely', () => {
    const url = discoverCalendarUrl(
      '<iframe src="https://rugbyaragon.matchready.es/es/public/calendar/abc/combined/"></iframe>',
      'https://rugbyaragon.com/senior-femenino-xv/',
    )
    expect(url).toBe('https://rugbyaragon.matchready.es/es/public/calendar/abc/combined/')

    const fixtures = parseFixtures(`
      <div class="row workingDayRow"><div class="portlet-title"><h4>JORNADA 3</h4></div></div>
      <tr class="eventRow">
        <td>08/11/2025 16:00</td>
        <td><font>CDU Rugby</font></td><td></td>
        <td><a href="/es/public/competition/123/match_statistics/"><font>24 - 17</font></a></td>
        <td></td><td><font>Rival Rugby</font></td>
      </tr>
    `)
    expect(fixtures).toEqual([expect.objectContaining({
      sourceMatchId: '123', round: 'JORNADA 3', matchDate: '2025-11-08',
      kickoffTime: '16:00', homeTeam: 'CDU Rugby', awayTeam: 'Rival Rugby',
      homeScore: 24, awayScore: 17, status: 'final',
    })])
    expect(inferSeason(fixtures)).toEqual({
      id: 'matchready-aragon-senior-f-xv-2025-26', name: '2025–26', startsOn: '2025-07-01',
    })
  })

  test('rejects an unknown iframe instead of following an arbitrary source', () => {
    expect(() => discoverCalendarUrl(
      '<iframe src="https://example.com/calendar"></iframe>',
      'https://rugbyaragon.com/senior-femenino-xv/',
    )).toThrow('calendario MatchReady reconocible')
  })

  test('keeps the final separate from the last numbered round and removes bye placeholders', () => {
    const fixtures = parseFixtures(`
      <div class="row workingDayRow"><div class="portlet-title"><h4>JORNADA 14</h4></div></div>
      <tr class="eventRow eventEnded"><td>28/03/2026 13:30</td>
        <td><font>Unizar femenino</font></td><td></td><td><font>43 - 0</font></td><td></td><td><font>Ibero C.R.</font></td></tr>
      <div class="row workingDayRow"><div class="portlet-title"><h4>FINAL</h4></div></div>
      <tr class="eventRow eventEnded"><td>11/04/2026 14:00</td>
        <td><font>Unizar femenino</font></td><td></td><td><font>51 - 0</font></td><td></td><td><font>Fénix C.R.</font></td></tr>
      <tr class="eventRow eventPending"><td>11/04/2026</td>
        <td><font>Descanso</font></td><td></td><td></td><td></td><td><font>Descanso</font></td></tr>
    `)

    expect(fixtures).toEqual([
      expect.objectContaining({ round: 'JORNADA 14', roundOrder: 14, homeTeam: 'Unizar femenino' }),
      expect.objectContaining({ round: 'FINAL', roundOrder: 15, homeTeam: 'Unizar femenino', awayTeam: 'Fénix C.R.' }),
    ])
  })

  test('parses standings and aggregates scoring statistics', () => {
    const standings = parseStandings(`
      <div id="classificationTab"><table><tr>
        ${['1', 'CDU Rugby', '6', '5', '0', '1', '180', '70', '110', '0', '0', '3', '1', '24'].map((value) => `<td>${value}</td>`).join('')}
      </tr></table></div><div id="squareCompetitionTab"></div>
    `)
    expect(standings).toEqual([expect.objectContaining({ team: 'CDU Rugby', played: 6, points: 24 })])

    const fixture = parseFixtures(`
      <div class="row workingDayRow"><div class="portlet-title"><h4>JORNADA 1</h4></div></div><tr class="eventRow"><td>01/09/2025</td>
      <td><font>CDU Rugby</font></td><td></td><td><font>5 - 0</font></td><td></td><td><font>Rival</font></td></tr>
    `)[0]
    const aggregate = new Map<string, PlayerStatistic>()
    addMatchStatistics(`
      <h4>Anotadores</h4><tbody><tr><td>1</td><td>E</td><td>Ana Martín</td></tr></tbody>
      <h4>Anotadores</h4><tbody></tbody>
      <h4>Expulsiones temporales equipo local</h4><tbody><tr><td>Ana Martín</td></tr></tbody>
    `, fixture, aggregate)
    expect([...aggregate.values()]).toEqual([expect.objectContaining({
      player: 'Ana Martín', team: 'CDU Rugby', tries: 1, points: 5, yellow_cards: 1,
    })])
  })
})

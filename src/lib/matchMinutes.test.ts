import { describe, expect, test } from 'vitest'
import { calculateMatchMinutes, type SavedReportEvent } from './matchMinutes'

const lineup = [{ player_id: 'ana', role: 'starter' as const }, { player_id: 'lucia', role: 'substitute' as const }, { player_id: 'ines', role: 'substitute' as const }]
const change = (minute: number, out = 'ana', incoming = 'lucia'): SavedReportEvent => ({ event_type: 'substitution', event_minute: minute, player_id: out, replacement_player_id: incoming, return_minute: null })
const yellow = (minute: number, back: number | null, player = 'ana'): SavedReportEvent => ({ event_type: 'yellow_card', event_minute: minute, player_id: player, replacement_player_id: null, return_minute: back })
const red = (minute: number, player = 'ana'): SavedReportEvent => ({ event_type: 'red_card', event_minute: minute, player_id: player, replacement_player_id: null, return_minute: null })

describe('calculateMatchMinutes', () => {
  test('gives full duration to starters and zero to unused substitutes', () => {
    expect([...calculateMatchMinutes(lineup, 80, [], 'xv')]).toEqual([['ana', 80], ['lucia', 0], ['ines', 0]])
  })
  test('splits time at the substitution minute', () => {
    const minutes = calculateMatchMinutes(lineup, 80, [change(55)], 'xv')
    expect(minutes.get('ana')).toBe(55)
    expect(minutes.get('lucia')).toBe(25)
  })
  test('sums multiple playing intervals and sorts chronologically', () => {
    const minutes = calculateMatchMinutes(lineup, 80, [change(60, 'lucia', 'ana'), change(20)], 'xv')
    expect(minutes.get('ana')).toBe(40)
    expect(minutes.get('lucia')).toBe(40)
  })
  test('preserves the reviewed order of changes at the same minute', () => {
    const minutes = calculateMatchMinutes(lineup, 80, [change(40), change(40, 'lucia', 'ines')], 'xv')
    expect(minutes.get('lucia')).toBe(0)
    expect(minutes.get('ines')).toBe(40)
    expect(() => calculateMatchMinutes(lineup, 80, [change(40, 'lucia', 'ines'), change(40)], 'xv')).toThrow('no está en el campo')
  })
  test('uses the actual yellow return minute, including delayed returns', () => {
    expect(calculateMatchMinutes(lineup, 80, [yellow(20, 33)], 'xv').get('ana')).toBe(67)
    expect(calculateMatchMinutes(lineup, 80, [yellow(20, null)], 'xv').get('ana')).toBe(20)
  })
  test('uses two minutes for sevens and limits the suspension at full time', () => {
    expect(calculateMatchMinutes(lineup, 14, [yellow(4, 6)], 'sevens').get('ana')).toBe(12)
    expect(calculateMatchMinutes(lineup, 14, [yellow(13, 14)], 'sevens').get('ana')).toBe(13)
    expect(() => calculateMatchMinutes(lineup, 14, [yellow(4, 5)], 'sevens')).toThrow('regreso')
    expect(() => calculateMatchMinutes(lineup, 80, [yellow(4, 6)], 'xv')).toThrow('regreso')
  })
  test('can substitute at the actual yellow return minute', () => {
    const minutes = calculateMatchMinutes(lineup, 80, [yellow(20, 30), change(30)], 'xv')
    expect(minutes.get('ana')).toBe(20)
    expect(minutes.get('lucia')).toBe(50)
    expect(() => calculateMatchMinutes(lineup, 80, [yellow(20, 30), change(29)], 'xv')).toThrow('no está en el campo')
  })
  test('stops time at a red card, also after a substitution', () => {
    const minutes = calculateMatchMinutes(lineup, 80, [change(20), red(65, 'lucia')], 'xv')
    expect(minutes.get('ana')).toBe(20)
    expect(minutes.get('lucia')).toBe(45)
  })
  test('a red during a suspension cancels its planned return', () => {
    expect(calculateMatchMinutes(lineup, 80, [yellow(20, 30), red(25)], 'xv').get('ana')).toBe(20)
    expect(calculateMatchMinutes(lineup, 80, [yellow(20, 30), red(20)], 'xv').get('ana')).toBe(20)
  })
  test('a red card to an unused substitute does not add playing minutes', () => {
    expect(calculateMatchMinutes(lineup, 80, [red(30, 'lucia')], 'xv').get('lucia')).toBe(0)
  })
  test.each([
    [change(20, 'lucia', 'ana'), 'no está en el campo'],
    [change(20, 'ana', 'ana'), 'distintas'],
    [change(20, 'ana', 'unknown'), 'convocatoria'],
    [change(20, 'unknown', 'lucia'), 'convocatoria'],
    [change(81), 'minuto'],
    [change(-1), 'minuto'],
    [change(20.5), 'minuto'],
    [yellow(20, 81), 'regreso'],
    [yellow(20, 30, 'lucia'), 'no está en el campo'],
  ])('rejects an inconsistent event: %j', (event, error) => {
    expect(() => calculateMatchMinutes(lineup, 80, [event as SavedReportEvent], 'xv')).toThrow(error as string)
  })
  test('rejects incoming players who are already playing or sent off', () => {
    const expanded = [...lineup, { player_id: 'bea', role: 'starter' as const }]
    expect(() => calculateMatchMinutes(expanded, 80, [change(20, 'ana', 'bea')], 'xv')).toThrow('ya está jugando')
    expect(() => calculateMatchMinutes(lineup, 80, [red(10, 'lucia'), change(20)], 'xv')).toThrow('expulsada')
  })
  test('rejects duplicate reds, invalid durations and incomplete minutes', () => {
    expect(() => calculateMatchMinutes(lineup, 80, [red(10), red(20)], 'xv')).toThrow('ya ha sido expulsada')
    expect(() => calculateMatchMinutes(lineup, 0, [], 'xv')).toThrow('duración')
    expect(() => calculateMatchMinutes(lineup, 80, [change(NaN)], 'xv')).toThrow('minuto')
    expect(() => calculateMatchMinutes(lineup, 80, [yellow(20, NaN)], 'xv')).toThrow('regreso')
  })
})

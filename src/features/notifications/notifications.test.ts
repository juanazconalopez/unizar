import { describe, expect, test } from 'vitest'
import { makeMembership, makeProfile, makeTask } from '../../test/fixtures'
import type { Match } from '../../types'
import { buildNotifications, type NotificationFeedData } from './notifications'

const match = (overrides: Partial<Match> = {}): Match => ({
  id: 'match-1', season_id: 'season-1', opponent: 'Rival Rugby', match_date: '2026-08-12',
  kickoff_time: '12:00:00', venue: 'Campo central', is_home: true, notes: null,
  status: 'published', match_kind: 'official', rugby_format: 'xv', lineup_published: true,
  created_by: 'owner-1', created_at: '2026-08-03T10:00:00.000Z', updated_at: '2026-08-07T10:00:00.000Z',
  seasons: { name: 'Temporada 2026' }, ...overrides,
})

const feed = (overrides: Partial<NotificationFeedData> = {}): NotificationFeedData => ({
  tasks: [makeTask({ created_at: '2026-08-03T10:00:00.000Z' })],
  results: [], memberships: [makeMembership()], matches: [match()], availability: [],
  lineups: [{ match_id: 'match-1', player_id: 'player-1', role: 'starter', position: null, slot_number: 1, sort_order: 1, updated_at: '2026-08-07T10:00:00.000Z' }],
  ...overrides,
})

describe('buildNotifications', () => {
  test('creates the six useful player alerts from current actionable data', () => {
    const notifications = buildNotifications(feed(), makeProfile(), '2026-08-07')
    expect(notifications.map((item) => item.title)).toEqual(expect.arrayContaining([
      'Nueva tarea publicada',
      'Tarea pendiente próxima a finalizar',
      'Nuevo partido publicado',
      'Disponibilidad sin responder',
      'Convocatoria publicada',
      'Cambio relevante en un partido',
    ]))
  })

  test('shows the nearest match when there is no newly published match', () => {
    const notifications = buildNotifications(feed({
      tasks: [], lineups: [], matches: [match({ lineup_published: false, created_at: '2026-07-01T10:00:00.000Z', updated_at: '2026-07-01T10:00:00.000Z' })],
    }), makeProfile(), '2026-08-07')
    expect(notifications.some((item) => item.title === 'Próximo partido')).toBe(true)
    expect(notifications.some((item) => item.title === 'Nuevo partido publicado')).toBe(false)
  })
})

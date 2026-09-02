import { describe, expect, test } from 'vitest'
import { makeAnnouncement, makeMembership, makeProfile, makeProfilePrivateDetails, makeTask } from '../../test/fixtures'
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
  test('keeps a profile reminder until phone and birth date are complete', () => {
    const incomplete = buildNotifications(
      feed({ tasks: [], matches: [], lineups: [] }),
      makeProfile(),
      '2026-08-07',
      makeProfilePrivateDetails({ phone: null, birth_date: null }),
    )
    expect(incomplete).toContainEqual(expect.objectContaining({
      kind: 'profile',
      persistent: true,
      title: 'Completa tus datos de perfil',
      text: 'Falta añadir teléfono y fecha de nacimiento.',
    }))

    const complete = buildNotifications(
      feed({ tasks: [], matches: [], lineups: [] }),
      makeProfile(),
      '2026-08-07',
      makeProfilePrivateDetails(),
    )
    expect(complete.some((item) => item.kind === 'profile')).toBe(false)
  })

  test('does not ask staff-only users to complete player details', () => {
    const notifications = buildNotifications(
      feed({ tasks: [], matches: [], lineups: [] }),
      makeProfile({ is_player: false, is_coach: true }),
      '2026-08-07',
      makeProfilePrivateDetails({ phone: null, birth_date: null }),
    )
    expect(notifications.some((item) => item.kind === 'profile')).toBe(false)
  })

  test('creates player alerts without duplicating published tasks from home and the tasks section', () => {
    const notifications = buildNotifications(feed(), makeProfile(), '2026-08-07')
    expect(notifications.map((item) => item.title)).toEqual(expect.arrayContaining([
      'Nuevo partido publicado',
      'Convocatoria publicada',
      'Cambio relevante en un partido',
    ]))
    expect(notifications.some((item) => item.kind === 'availability')).toBe(false)
    expect(notifications.some((item) => item.kind === 'task')).toBe(false)
    expect(notifications.filter((item) => item.kind === 'match' || item.kind === 'lineup').every((item) => item.view === 'calendar')).toBe(true)
  })

  test('shows the nearest match when there is no newly published match', () => {
    const notifications = buildNotifications(feed({
      tasks: [], lineups: [], matches: [match({ lineup_published: false, created_at: '2026-07-01T10:00:00.000Z', updated_at: '2026-07-01T10:00:00.000Z' })],
    }), makeProfile(), '2026-08-07')
    expect(notifications.some((item) => item.title === 'Próximo partido')).toBe(true)
    expect(notifications.some((item) => item.title === 'Nuevo partido publicado')).toBe(false)
  })

  test('links a newly published team announcement to its exact day', () => {
    const announcement = makeAnnouncement({ announcement_date: '2026-08-11', updated_at: '2026-08-07T10:00:00.000Z' })
    const notifications = buildNotifications(feed({ tasks: [], matches: [], lineups: [], announcements: [announcement] }), makeProfile(), '2026-08-07')
    expect(notifications).toContainEqual(expect.objectContaining({ kind: 'announcement', view: 'calendar', targetDate: '2026-08-11', targetId: announcement.id }))
  })

  test('creates one availability-change notification per match for coaches', () => {
    const notifications = buildNotifications(feed({
      tasks: [],
      lineups: [],
      availability: [
        { match_id: 'match-1', player_id: 'player-1', status: 'available', comment: null, updated_at: '2026-08-06T10:00:00.000Z' },
        { match_id: 'match-1', player_id: 'player-2', status: 'doubt', comment: null, updated_at: '2026-08-07T12:00:00.000Z' },
      ],
    }), makeProfile({ is_player: false, is_coach: true }), '2026-08-07')
    const availabilityChanges = notifications.filter((item) => item.id.startsWith('availability-changed:'))

    expect(availabilityChanges).toHaveLength(1)
    expect(availabilityChanges[0]).toEqual(expect.objectContaining({
      id: 'availability-changed:match-1:2026-08-07T12:00:00.000Z',
      kind: 'availability',
      title: 'Cambios en la disponibilidad',
      targetDate: '2026-08-12',
    }))
  })

  test('does not show team availability changes to regular players', () => {
    const notifications = buildNotifications(feed({
      tasks: [], lineups: [],
      availability: [{ match_id: 'match-1', player_id: 'player-2', status: 'available', comment: null, updated_at: '2026-08-07T12:00:00.000Z' }],
    }), makeProfile(), '2026-08-07')

    expect(notifications.some((item) => item.id.startsWith('availability-changed:'))).toBe(false)
  })

  test('reminds unanswered eligible players on Monday and repeats on Wednesday', () => {
    const saturdayMatch = match({
      match_date: '2026-08-15',
      lineup_published: false,
      created_at: '2026-08-09T10:00:00.000Z',
      updated_at: '2026-08-09T10:00:00.000Z',
    })
    const monday = buildNotifications(feed({ matches: [saturdayMatch], lineups: [] }), makeProfile(), '2026-08-10')
    const wednesday = buildNotifications(feed({ matches: [saturdayMatch], lineups: [] }), makeProfile(), '2026-08-12')

    expect(monday).toContainEqual(expect.objectContaining({
      id: 'availability-missing:match-1:monday:2026-08-10',
      title: 'Disponibilidad sin responder',
    }))
    expect(wednesday).toContainEqual(expect.objectContaining({
      id: 'availability-missing:match-1:wednesday:2026-08-12',
      title: 'Último recordatorio de disponibilidad',
    }))
  })

  test('does not show availability reminders on publication day or other weekdays', () => {
    const saturdayMatch = match({ match_date: '2026-08-15', lineup_published: false })
    const sunday = buildNotifications(feed({ matches: [saturdayMatch], lineups: [] }), makeProfile(), '2026-08-09')
    const tuesday = buildNotifications(feed({ matches: [saturdayMatch], lineups: [] }), makeProfile(), '2026-08-11')

    expect(sunday.some((item) => item.id.startsWith('availability-missing:'))).toBe(false)
    expect(tuesday.some((item) => item.id.startsWith('availability-missing:'))).toBe(false)
  })

  test('does not remind players who answered, are ineligible or have a published lineup', () => {
    const saturdayMatch = match({ match_date: '2026-08-15', lineup_published: false })
    const answered = buildNotifications(feed({
      matches: [saturdayMatch], lineups: [],
      availability: [{ match_id: saturdayMatch.id, player_id: 'player-1', status: 'available', comment: null, updated_at: '2026-08-09T10:00:00.000Z' }],
    }), makeProfile(), '2026-08-10')
    const ineligible = buildNotifications(feed({ matches: [saturdayMatch], memberships: [], lineups: [] }), makeProfile(), '2026-08-10')
    const closed = buildNotifications(feed({ matches: [{ ...saturdayMatch, lineup_published: true }] }), makeProfile(), '2026-08-10')

    expect(answered.some((item) => item.id.startsWith('availability-missing:'))).toBe(false)
    expect(ineligible.some((item) => item.id.startsWith('availability-missing:'))).toBe(false)
    expect(closed.some((item) => item.id.startsWith('availability-missing:'))).toBe(false)
  })
})

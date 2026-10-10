import { describe, expect, test } from 'vitest'
import { makeAnnouncement, makeAttendance, makeMatch, makeMembership, makeProfile, makeResult, makeSeason, makeSession, makeTask } from '../../test/fixtures'
import { selectDashboardSummary, type DashboardData } from './dashboardSelectors'

const today = '2026-10-10'
const week = '2026-10-05'

function data(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    isTeamDashboard: false, today, userId: 'player-1', profiles: [], memberships: [makeMembership()],
    tasks: [], results: [], attendance: [], trainingSessions: [], announcements: [], matches: [], ...overrides,
  }
}

describe('dashboard selectors', () => {
  test('counts only published weekly tasks that overlap the player membership', () => {
    const input = data({
      memberships: [makeMembership({ active_from: '2026-10-09', active_until: '2026-10-11' })],
      tasks: [
        makeTask({ id: 'pending', week_start: week, sort_order: 2 }),
        makeTask({ id: 'done', week_start: week, sort_order: 1 }),
        makeTask({ id: 'draft', week_start: week, status: 'draft' }),
        makeTask({ id: 'previous', week_start: '2026-09-28' }),
        makeTask({ id: 'other-season', week_start: week, season_id: 'season-2' }),
      ],
      results: [
        makeResult({ task_id: 'done' }),
        makeResult({ task_id: 'pending', player_id: 'other-player' }),
        makeResult({ task_id: 'draft' }),
        makeResult({ task_id: 'previous' }),
        makeResult({ task_id: 'other-season' }),
      ],
    })
    const summary = selectDashboardSummary(input)
    expect(summary.weekTasks.map((task) => task.id)).toEqual(['done', 'pending'])
    expect(summary.personal).toMatchObject({ completed: 1, completion: 50 })
    expect(summary.team).toBeNull()
    expect(input.tasks.map((task) => task.id)).toEqual(['pending', 'done', 'draft', 'previous', 'other-season'])
  })

  test('respects historical membership periods and excludes future or other-season attendance', () => {
    const summary = selectDashboardSummary(data({
      season: makeSeason(),
      memberships: [
        makeMembership({ active_from: '2026-10-02', active_until: '2026-10-05' }),
        makeMembership({ id: 'returned', active_from: '2026-10-09', active_until: null }),
      ],
      trainingSessions: [
        makeSession({ id: 'before', session_date: '2026-10-01' }),
        makeSession({ id: 'start', session_date: '2026-10-02' }),
        makeSession({ id: 'end', session_date: '2026-10-05' }),
        makeSession({ id: 'gap', session_date: '2026-10-08' }),
        makeSession({ id: 'today', session_date: today }),
        makeSession({ id: 'future', session_date: '2026-10-11' }),
        makeSession({ id: 'other-season', season_id: 'season-2', session_date: today }),
      ],
      attendance: [
        ...['before', 'start', 'gap', 'future', 'other-season'].map((session_id) => makeAttendance({ session_id })),
        makeAttendance({ session_id: 'today', attended: false }),
        makeAttendance({ session_id: 'end', player_id: 'other-player' }),
      ],
    }))
    expect(summary.personal).toMatchObject({ attendanceTotal: 3, attendedSessions: 1, attendanceRate: 33 })
  })

  test('team progress includes only active players eligible for each task', () => {
    const summary = selectDashboardSummary(data({
      isTeamDashboard: true,
      profiles: [
        makeProfile(),
        makeProfile({ id: 'player-2', is_coach: true }),
        makeProfile({ id: 'inactive', is_active: false }),
        makeProfile({ id: 'pending', is_approved: false }),
        makeProfile({ id: 'archived', is_archived: true }),
        makeProfile({ id: 'coach-only', is_player: false, is_coach: true }),
      ],
      memberships: [
        makeMembership(),
        makeMembership({ player_id: 'player-2', active_until: '2026-10-04' }),
        ...['inactive', 'pending', 'archived', 'coach-only'].map((player_id) => makeMembership({ player_id })),
      ],
      tasks: [makeTask({ id: 'task-1', week_start: week }), makeTask({ id: 'task-2', week_start: week, sort_order: 2 })],
      results: [makeResult({ task_id: 'task-1' }), makeResult({ task_id: 'task-1', player_id: 'inactive' }), makeResult({ task_id: 'task-2', player_id: 'player-2' })],
    }))
    expect(summary.personal).toBeNull()
    expect(summary.team).toMatchObject({ eligiblePlayerCount: 1, activePlayerCount: 1, expectedResults: 2, completion: 50 })
    expect(summary.team?.validResults.map((result) => result.player_id)).toEqual(['player-1'])
    expect(summary.team?.insight.text).toContain('0/1 respuestas')
    expect(summary.ownResultsByTask.get('task-1')?.player_id).toBe('player-1')
  })

  test('an expired membership cannot grant tasks from the following season', () => {
    const summary = selectDashboardSummary(data({
      tasks: [makeTask({ season_id: 'season-2', week_start: week })],
      memberships: [makeMembership({ season_id: 'season-1', active_until: null })],
    }))
    expect(summary.weekTasks).toEqual([])
    expect(summary.personal).toMatchObject({ completed: 0, completion: 0 })
  })

  test('keeps agenda order, publication status and the end of next week', () => {
    const first = makeMatch({ id: 'first', match_date: today })
    const summary = selectDashboardSummary(data({
      matches: [makeMatch({ match_date: '2026-10-11' }), makeMatch({ status: 'draft', match_date: today }), first, makeMatch({ id: 'tie', match_date: today })],
      announcements: [
        makeAnnouncement({ id: 'later', announcement_date: '2026-10-19' }),
        makeAnnouncement({ id: 'end', announcement_date: '2026-10-18' }),
        makeAnnouncement({ id: 'past', announcement_date: '2026-10-09' }),
        makeAnnouncement({ id: 'today', announcement_date: today }),
        makeAnnouncement({ id: 'draft', announcement_date: today, status: 'draft' }),
      ],
    }))
    expect(summary.nextMatch).toBe(first)
    expect(summary.nextAnnouncements.map((announcement) => announcement.id)).toEqual(['today', 'end'])
    expect(summary.attentionCount).toBe(3)
  })
})

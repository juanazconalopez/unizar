import type {
  AttendanceRecord,
  Profile,
  Season,
  SeasonPlayer,
  TaskResult,
  TeamAnnouncement,
  TrainingSession,
  TrainingTask,
} from '../types'

const createdAt = '2026-08-01T10:00:00.000Z'

export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'player-1',
    display_name: 'Ana Martín',
    is_approved: true,
    is_active: true,
    is_coach: false,
    is_owner: false,
    is_player: true,
    is_viewer: false,
    is_archived: false,
    created_at: createdAt,
    ...overrides,
  }
}

export function makeSeason(overrides: Partial<Season> = {}): Season {
  return {
    id: 'season-1',
    name: 'Temporada 2026',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    created_by: 'owner-1',
    created_at: createdAt,
    updated_at: createdAt,
    ...overrides,
  }
}

export function makeMembership(overrides: Partial<SeasonPlayer> = {}): SeasonPlayer {
  return {
    id: 'membership-1',
    season_id: 'season-1',
    player_id: 'player-1',
    active_from: '2026-01-01',
    active_until: null,
    created_at: createdAt,
    ...overrides,
  }
}

export function makeTask(overrides: Partial<TrainingTask> = {}): TrainingTask {
  return {
    id: 'task-1',
    season_id: 'season-1',
    week_start: '2026-08-03',
    title: 'Velocidad y cambios de dirección',
    description: 'Completar seis series.',
    training_type: 'Físico',
    status: 'published',
    created_by: 'owner-1',
    created_at: createdAt,
    seasons: { name: 'Temporada 2026' },
    ...overrides,
  }
}

export function makeAnnouncement(overrides: Partial<TeamAnnouncement> = {}): TeamAnnouncement {
  return {
    id: 'announcement-1', season_id: 'season-1', announcement_date: '2026-08-11',
    title: 'Cambio de horario', description: 'Empezamos media hora antes.', status: 'published',
    created_by: 'owner-1', created_at: createdAt, updated_at: createdAt,
    seasons: { name: 'Temporada 2026' }, ...overrides,
  }
}

export function makeResult(overrides: Partial<TaskResult> = {}): TaskResult {
  return {
    task_id: 'task-1',
    player_id: 'player-1',
    result_text: 'Trabajo completado.',
    fatigue_level: 3,
    performed_on: '2026-08-05',
    completed_at: createdAt,
    updated_at: createdAt,
    ...overrides,
  }
}

export function makeSession(overrides: Partial<TrainingSession> = {}): TrainingSession {
  return {
    id: 'session-1',
    season_id: 'season-1',
    session_date: '2026-08-05',
    created_by: 'owner-1',
    created_at: createdAt,
    updated_at: createdAt,
    ...overrides,
  }
}

export function makeAttendance(overrides: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    session_id: 'session-1',
    player_id: 'player-1',
    attended: true,
    marked_by: 'owner-1',
    updated_at: createdAt,
    training_sessions: { session_date: '2026-08-05' },
    ...overrides,
  }
}

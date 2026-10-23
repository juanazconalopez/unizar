import { isActivePlayer, membershipCoversDate } from '../../lib/selectors'
import { isFridayTrainingDate, trainingResponseClosed } from '../../lib/trainingSchedule'
import type { AttendanceRecord, Profile, SeasonPlayer, TrainingPlan, TrainingSession } from '../../types'

type DemoResponses = Record<string, { attending: boolean; version: number }>

// Simula el trabajo interno de Supabase exclusivamente para demo.local.
export function finalizeDemoSelfManagedAttendance(plans: TrainingPlan[], profiles: Profile[], memberships: SeasonPlayer[], responses: DemoResponses, sessions: TrainingSession[], attendance: AttendanceRecord[], holidays: string[], now = new Date()) {
  const pending = plans.filter((plan) => plan.self_managed && isFridayTrainingDate(plan.session_date)
    && plan.status !== 'cancelled' && !holidays.includes(plan.session_date)
    && trainingResponseClosed(plan, now) && !sessions.some((session) => session.session_date === plan.session_date))
  if (!pending.length) return { sessions, attendance }
  const timestamp = now.toISOString()
  const created = pending.map((plan): TrainingSession => ({
    id: `demo-auto-${plan.id}`, session_date: plan.session_date, season_id: plan.season_id,
    self_managed: true, training_plan_id: plan.id, created_by: plan.created_by, created_at: timestamp, updated_at: timestamp,
  }))
  const records = pending.flatMap((plan, index) => profiles.filter((player) => isActivePlayer(player)
    && memberships.some((membership) => membership.player_id === player.id && membership.season_id === plan.season_id && membershipCoversDate(membership, plan.session_date)))
    .map((player): AttendanceRecord => {
      const response = responses[`${plan.id}:${player.id}`]
      return { session_id: created[index].id, player_id: player.id,
        attended: Boolean(response?.attending && response.version === (plan.schedule_version ?? 1)),
        marked_by: response ? player.id : plan.created_by, updated_at: timestamp, training_sessions: { session_date: plan.session_date } }
    }))
  return { sessions: [...created, ...sessions], attendance: [...attendance, ...records] }
}

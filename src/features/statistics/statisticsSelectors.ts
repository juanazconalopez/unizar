import type { AttendanceRecord } from '../../types'

export function recordDate(record: AttendanceRecord) {
  return record.training_sessions?.session_date
}

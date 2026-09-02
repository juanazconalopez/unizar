import { supabase } from '../lib/supabase'
import type { ProvisionalAttendanceEntry } from '../types'

export async function saveTrainingAttendance(attendanceDate: string, playerIds: string[], attendedPlayerIds: string[], guests: ProvisionalAttendanceEntry[]) {
  const { error } = await supabase.rpc('save_training_attendance', {
    attendance_date: attendanceDate,
    checked_player_ids: playerIds,
    attended_player_ids: attendedPlayerIds,
    guest_entries: guests.map((guest) => guest.id ? { id: guest.id } : { displayName: guest.displayName }),
  })
  if (error) throw error
}

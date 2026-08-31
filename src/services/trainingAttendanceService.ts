import { supabase } from '../lib/supabase'

export async function saveTrainingAttendance(attendanceDate: string, playerIds: string[], attendedPlayerIds: string[]) {
  const { error } = await supabase.rpc('save_training_attendance', {
    attendance_date: attendanceDate,
    checked_player_ids: playerIds,
    attended_player_ids: attendedPlayerIds,
  })
  if (error) throw error
}

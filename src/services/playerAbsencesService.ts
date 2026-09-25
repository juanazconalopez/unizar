import { supabase } from '../lib/supabase'

export type PlayerAbsenceValues = { startsOn: string; endsOn: string; privateNote: string }

export async function savePlayerAbsence(playerId: string, values: PlayerAbsenceValues, absenceId: string | null = null) {
  const { error } = await supabase.rpc('save_player_absence', {
    checked_absence_id: absenceId,
    checked_player_id: playerId,
    checked_starts_on: values.startsOn,
    checked_ends_on: values.endsOn || null,
    checked_private_note: values.privateNote || null,
  })
  if (error) throw error
}

export async function deletePlayerAbsence(absenceId: string) {
  const { error } = await supabase.rpc('delete_player_absence', { checked_absence_id: absenceId })
  if (error) throw error
}

import { addDays } from '../lib/dates'
import { supabase } from '../lib/supabase'
import type { SeasonValues } from '../types'
import { invalidateBirthdayCache } from './birthdayService'

export async function createSeason(values: SeasonValues, userId: string) {
  await validateSeasonChange(values)
  const { error } = await supabase.from('seasons').insert({ ...values, name: values.name.trim(), created_by: userId })
  if (error) throw error
  invalidateBirthdayCache()
}

export async function updateSeason(seasonId: string, values: SeasonValues) {
  await validateSeasonChange(values, seasonId)
  const [tasks, matches, sessions, announcements] = await Promise.all([
    supabase.from('tasks').select('title, week_start').eq('season_id', seasonId).or(`week_start.lt.${values.start_date},week_start.gt.${addDays(values.end_date, -6)}`).limit(1),
    supabase.from('matches').select('opponent, match_date').eq('season_id', seasonId).or(`match_date.lt.${values.start_date},match_date.gt.${values.end_date}`).limit(1),
    supabase.from('training_sessions').select('session_date').eq('season_id', seasonId).or(`session_date.lt.${values.start_date},session_date.gt.${values.end_date}`).limit(1),
    supabase.from('team_announcements').select('title, announcement_date').eq('season_id', seasonId).or(`announcement_date.lt.${values.start_date},announcement_date.gt.${values.end_date}`).limit(1),
  ])
  if (tasks.error) throw tasks.error
  if (matches.error) throw matches.error
  if (sessions.error) throw sessions.error
  if (announcements.error) throw announcements.error
  if (tasks.data?.[0]) throw new Error(`No se pueden aplicar esas fechas porque la tarea “${tasks.data[0].title}” está programada el ${tasks.data[0].week_start}.`)
  if (matches.data?.[0]) throw new Error(`No se pueden aplicar esas fechas porque el partido contra ${matches.data[0].opponent} está programado el ${matches.data[0].match_date}.`)
  if (sessions.data?.[0]) throw new Error(`No se pueden aplicar esas fechas porque hay un entrenamiento de campo registrado el ${sessions.data[0].session_date}.`)
  if (announcements.data?.[0]) throw new Error(`No se pueden aplicar esas fechas porque el aviso “${announcements.data[0].title}” está programado el ${announcements.data[0].announcement_date}.`)
  const { error } = await supabase.from('seasons').update({ name: values.name.trim(), start_date: values.start_date, end_date: values.end_date }).eq('id', seasonId)
  if (error) throw error
  invalidateBirthdayCache()
}

export async function deleteSeason(seasonId: string) {
  const { error } = await supabase.from('seasons').delete().eq('id', seasonId)
  if (error) throw error
  invalidateBirthdayCache()
}

async function validateSeasonChange(values: SeasonValues, excludedSeasonId?: string) {
  if (!values.name.trim()) throw new Error('Escribe un nombre para la temporada.')
  if (!values.start_date || !values.end_date) throw new Error('Indica las fechas de inicio y finalización.')
  if (values.end_date < values.start_date) throw new Error('La fecha de finalización no puede ser anterior a la de inicio.')
  let query = supabase.from('seasons').select('id, name').lte('start_date', values.end_date).gte('end_date', values.start_date).limit(1)
  if (excludedSeasonId) query = query.neq('id', excludedSeasonId)
  const { data, error } = await query
  if (error) throw error
  if (data?.length) throw new Error(`Las fechas se solapan con “${data[0].name}”. Solo puede haber una temporada activa en cada fecha.`)
}

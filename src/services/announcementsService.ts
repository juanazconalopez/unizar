import { supabase } from '../lib/supabase'
import type { AnnouncementValues } from '../types'
import { cleanupContentImages, contentImageIdsForEntity, ensureContentImages } from './contentImagesService'

function announcementRow(values: AnnouncementValues) {
  return {
    season_id: values.seasonId,
    announcement_date: values.date,
    title: values.title.trim(),
    description: values.description.trim() || null,
    status: values.status,
  }
}

export async function createTeamAnnouncement(values: AnnouncementValues, userId: string) {
  const uploadedIds = await ensureContentImages([values.description], userId)
  const { error } = await supabase.from('team_announcements').insert({
    ...announcementRow(values),
    created_by: userId,
  })
  if (error) {
    await cleanupContentImages(uploadedIds)
    throw error
  }
}

export async function updateTeamAnnouncement(id: string, values: AnnouncementValues, userId: string) {
  const previousIds = await contentImageIdsForEntity('announcement', id)
  const uploadedIds = await ensureContentImages([values.description], userId)
  const { error } = await supabase.from('team_announcements').update(announcementRow(values)).eq('id', id)
  if (error) {
    await cleanupContentImages(uploadedIds)
    throw error
  }
  await cleanupContentImages(previousIds)
}

export async function updateTeamAnnouncementStatus(id: string, status: AnnouncementValues['status']) {
  const { error } = await supabase.from('team_announcements').update({ status }).eq('id', id)
  if (error) throw error
}

export async function deleteTeamAnnouncement(id: string) {
  const imageIds = await contentImageIdsForEntity('announcement', id)
  const { error } = await supabase.from('team_announcements').delete().eq('id', id)
  if (error) throw error
  await cleanupContentImages(imageIds)
}

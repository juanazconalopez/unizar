import { supabase } from '../lib/supabase'
import type { Profile, ProfileDetailsValues } from '../types'
import { invalidateBirthdayCache } from './birthdayService'

export async function updateProfilePermissions(profile: Profile) {
  const { error } = await supabase.from('profiles').update({
    is_approved: profile.is_approved,
    is_active: profile.is_active,
    is_player: profile.is_player,
    is_coach: profile.is_coach,
    is_viewer: profile.is_viewer,
    is_owner: profile.is_owner,
    is_archived: profile.is_archived,
    updated_at: new Date().toISOString(),
  }).eq('id', profile.id)
  if (error) throw error
  invalidateBirthdayCache()
}

export async function updateOwnProfileDetails(values: ProfileDetailsValues) {
  const { error } = await supabase.rpc('update_own_profile_details', {
    new_display_name: values.displayName,
    new_phone: values.phone,
    new_birth_date: values.birthDate || null,
  })
  if (error) throw error
  invalidateBirthdayCache()
}

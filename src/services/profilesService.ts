import { supabase } from '../lib/supabase'
import type { ManagedProfileValues, Profile, ProfileDetailsValues, ProfilePhotoChange } from '../types'
import { invalidateBirthdayCache } from './birthdayService'
import { deleteProfilePhoto, uploadProfilePhoto } from './profilePhotoService'

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

export async function updateOwnProfileDetails(profile: Profile, values: ProfileDetailsValues, photoChange?: ProfilePhotoChange) {
  await saveWithPhoto(profile, photoChange, async (avatarPath) => {
    const { error } = await supabase.rpc('update_own_profile', {
      new_display_name: values.displayName,
      new_phone: values.phone,
      new_birth_date: values.birthDate || null,
      new_avatar_path: avatarPath,
    })
    if (error) throw error
  })
  invalidateBirthdayCache()
}

export async function updateManagedProfile(profile: Profile, values: ManagedProfileValues, photoChange?: ProfilePhotoChange) {
  const effectivePhotoChange = values.isPlayer ? photoChange : profile.avatar_path ? null : undefined
  await saveWithPhoto(profile, effectivePhotoChange, async (avatarPath) => {
    const { error } = await supabase.rpc('update_managed_profile', {
      checked_profile_id: profile.id,
      new_display_name: values.displayName,
      new_phone: values.phone,
      new_birth_date: values.birthDate || null,
      new_is_active: values.isActive,
      new_is_player: values.isPlayer,
      new_is_coach: values.isCoach,
      new_is_viewer: values.isViewer,
      new_is_owner: values.isOwner,
      new_avatar_path: values.isPlayer ? avatarPath : null,
    })
    if (error) throw error
  })
  invalidateBirthdayCache()
}

export async function archiveManagedProfile(profileId: string) {
  const { error } = await supabase.rpc('archive_profile_as_owner', { checked_profile_id: profileId })
  if (error) throw error
  invalidateBirthdayCache()
}

async function saveWithPhoto(profile: Profile, photoChange: ProfilePhotoChange, save: (avatarPath: string | null) => Promise<void>) {
  let nextPath = profile.avatar_path
  let uploadedPath: string | null = null
  if (photoChange instanceof File) {
    uploadedPath = await uploadProfilePhoto(profile.id, photoChange)
    nextPath = uploadedPath
  } else if (photoChange === null) {
    nextPath = null
  }

  try {
    await save(nextPath)
  } catch (error) {
    if (uploadedPath) await deleteProfilePhoto(uploadedPath).catch(() => undefined)
    throw error
  }

  if (profile.avatar_path && profile.avatar_path !== nextPath) {
    await deleteProfilePhoto(profile.avatar_path).catch(() => undefined)
  }
}

import type { Profile } from '../../types'

export function profileRoles(profile: Pick<Profile, 'is_player' | 'is_coach' | 'is_viewer' | 'is_owner'>) {
  return [profile.is_player ? 'Jugadora' : '', profile.is_coach ? 'Entrenadora' : '', profile.is_viewer ? 'Dirección' : '', profile.is_owner ? 'Owner' : ''].filter(Boolean)
}

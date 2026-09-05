import type { Profile } from '../../types'

type ProfileRole = 'Jugadora' | 'Entrenador' | 'Dirección' | 'Owner'

const roleClasses: Record<ProfileRole, string> = {
  Jugadora: 'jugadora-role',
  Entrenador: 'entrenador-role',
  Dirección: 'direccion-role',
  Owner: 'owner-role',
}

export function profileRoles(profile: Pick<Profile, 'is_player' | 'is_coach' | 'is_viewer' | 'is_owner'>) {
  return [profile.is_player ? 'Jugadora' : '', profile.is_coach ? 'Entrenador' : '', profile.is_viewer ? 'Dirección' : '', profile.is_owner ? 'Owner' : ''].filter(Boolean) as ProfileRole[]
}

export function profileRoleClass(role: ProfileRole) {
  return roleClasses[role]
}

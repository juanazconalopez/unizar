export const seasonTeamCoachRoles = [
  { value: 'head_coach', label: 'Entrenador principal' },
  { value: 'assistant_coach', label: 'Entrenador asistente' },
  { value: 'defense_coach', label: 'Entrenador de defensa' },
  { value: 'attack_coach', label: 'Entrenador de ataque' },
  { value: 'skills_coach', label: 'Entrenador de habilidades' },
  { value: 'strength_and_conditioning_coach', label: 'Preparador físico' },
] as const

export type SeasonTeamCoachRole = typeof seasonTeamCoachRoles[number]['value']

const roleLabels: Record<SeasonTeamCoachRole, string> = Object.fromEntries(
  seasonTeamCoachRoles.map(({ value, label }) => [value, label]),
) as Record<SeasonTeamCoachRole, string>

export function seasonTeamCoachRoleLabel(role: string): string {
  return roleLabels[role as SeasonTeamCoachRole] ?? roleLabels.assistant_coach
}

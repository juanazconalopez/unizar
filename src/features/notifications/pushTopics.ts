export const PUSH_TOPICS = [
  { key: 'matches', label: 'Partidos nuevos y cambios importantes' },
  { key: 'lineups', label: 'Publicación y cambios de convocatorias' },
  { key: 'announcements', label: 'Avisos del equipo' },
  { key: 'training_groups', label: 'Publicaciones de grupos Rojo/Blanco' },
  { key: 'availability_reminders', label: 'Recordatorios de mi disponibilidad' },
  { key: 'availability_digest', label: 'Resumen de disponibilidad para el staff' },
  { key: 'training_changes', label: 'Cambios y cancelaciones de entrenamientos' },
  { key: 'training_reminders', label: 'Recordatorios para responder a entrenamientos' },
] as const

export type PushTopic = typeof PUSH_TOPICS[number]['key']
export const DEFAULT_PUSH_TOPICS: PushTopic[] = PUSH_TOPICS.map((topic) => topic.key)

export function pushTopicsForRole(isPlayer: boolean, isStaff: boolean) {
  return PUSH_TOPICS.filter((topic) => (
    !['availability_reminders', 'training_reminders', 'training_groups'].includes(topic.key) || isPlayer
  ) && (topic.key !== 'availability_digest' || isStaff))
}

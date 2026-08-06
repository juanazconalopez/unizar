export const TRAINING_TYPES = [
  'Carrera',
  'Fuerza',
  'Técnica',
  'Movilidad',
  'Recuperación',
  'Otro',
] as const

export const FATIGUE_LEVELS = [
  { value: 1, emoji: '😄', label: 'Muy baja' },
  { value: 2, emoji: '🙂', label: 'Baja' },
  { value: 3, emoji: '😐', label: 'Media' },
  { value: 4, emoji: '😓', label: 'Alta' },
  { value: 5, emoji: '🥵', label: 'Muy alta' },
] as const

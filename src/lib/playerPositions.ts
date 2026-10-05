import type { Profile } from '../types'

export const playingPositions = [
  { value: 'prop', label: 'Pilar', group: 'forwards' },
  { value: 'hooker', label: 'Talonadora', group: 'forwards' },
  { value: 'second_row', label: 'Segunda línea', group: 'forwards' },
  { value: 'back_row', label: 'Tercera línea', group: 'forwards' },
  { value: 'scrum_half', label: 'Medio de melé', group: 'backs' },
  { value: 'fly_half', label: 'Apertura', group: 'backs' },
  { value: 'centre', label: 'Centro', group: 'backs' },
  { value: 'wing', label: 'Ala', group: 'backs' },
  { value: 'fullback', label: 'Zaguera', group: 'backs' },
] as const

export type PlayingPosition = typeof playingPositions[number]['value']
export type PlayingGroup = 'forwards' | 'backs' | 'unassigned'
export type PlayerPositionValues = { positions: PlayingPosition[]; primaryPosition: PlayingPosition | null }
export type SavePlayerPositions = (player: Profile, values: PlayerPositionValues) => Promise<void>

export const playingGroups: { value: PlayingGroup; label: string }[] = [
  { value: 'forwards', label: 'Delanteras' },
  { value: 'backs', label: 'Línea' },
  { value: 'unassigned', label: 'Sin posición' },
]

export function positionLabel(value: string | null | undefined) {
  return playingPositions.find((position) => position.value === value)?.label ?? 'Sin posición'
}

export function playerPlayingGroup(player: Pick<Profile, 'primary_position'>): PlayingGroup {
  return playingPositions.find((position) => position.value === player.primary_position)?.group ?? 'unassigned'
}

export function groupPlayersByPosition<T extends Pick<Profile, 'primary_position'>>(players: T[]) {
  return playingGroups.map((group) => ({ ...group, players: players.filter((player) => playerPlayingGroup(player) === group.value) }))
}

export function validPlayerPositions(values: PlayerPositionValues) {
  return new Set(values.positions).size === values.positions.length
    && values.positions.every((value) => playingPositions.some((position) => position.value === value))
    && (values.positions.length === 0 ? values.primaryPosition === null : values.primaryPosition !== null && values.positions.includes(values.primaryPosition))
}

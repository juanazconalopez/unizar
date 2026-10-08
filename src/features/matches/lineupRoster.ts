import type { MatchLineup } from '../../types'

export type LineupRosterRow = { slotNumber: number; entry?: MatchLineup }

/** Conserva los huecos titulares; las suplentes solo aparecen con su dorsal asignado. */
export function lineupRosterRows(entries: MatchLineup[], starters: number): LineupRosterRow[] {
  const bySlot = new Map(entries.map((entry) => [entry.slot_number, entry]))
  return [
    ...Array.from({ length: starters }, (_, index) => ({ slotNumber: index + 1, entry: bySlot.get(index + 1) })),
    ...entries.filter((entry) => entry.slot_number > starters)
      .sort((first, second) => first.slot_number - second.slot_number)
      .map((entry) => ({ slotNumber: entry.slot_number, entry })),
  ]
}

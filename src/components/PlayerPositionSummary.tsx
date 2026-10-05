import { groupPlayersByPosition } from '../lib/playerPositions'
import type { Profile } from '../types'
import '../features/team/playerPositions.css'

export function PlayerPositionSummary({ players }: { players: Pick<Profile, 'primary_position'>[] }) {
  return <div aria-label="Distribución por posición principal" className="playing-position-summary">{groupPlayersByPosition(players).filter((group) => group.value !== 'unassigned' || group.players.length > 0).map((group) => <span key={group.value}>{group.label} <strong>{group.players.length}</strong></span>)}</div>
}

import type { TrainingGroupAssignment, TrainingGroupPlayer } from './types'
import { groupColorLabel } from './trainingGroupSelectors'

export function TrainingGroupColumns({ players, assignments, onMove, userId, disabled }: {
  players: TrainingGroupPlayer[]; assignments: TrainingGroupAssignment[]; onMove?: (playerId: string) => void; userId: string; disabled?: boolean
}) {
  const colors = new Map(assignments.map((entry) => [entry.player_id, entry.color]))
  return <div className="training-group-columns">{(['red', 'white'] as const).map((color) => {
    const members = players.filter((player) => colors.get(player.player_id) === color)
      .sort((a, b) => a.display_name.localeCompare(b.display_name, 'es'))
    return <section className={`training-group-column ${color}`} key={color} aria-label={`Grupo ${groupColorLabel(color)}`}>
      <header><h2>Grupo {groupColorLabel(color)}</h2><span>{members.length} jugadoras</span></header>
      <ul className="training-group-roster">{members.map((player) => <li key={player.player_id} className={player.player_id === userId ? 'own-group-player' : undefined}>
        <span><strong>{player.display_name}{player.player_id === userId ? ' · Tú' : ''}</strong></span>
        {onMove && <button className="text-button" disabled={disabled} aria-label={`Mover a ${player.display_name} al grupo ${groupColorLabel(color === 'red' ? 'white' : 'red')}`} onClick={() => onMove(player.player_id)}>Pasar a {groupColorLabel(color === 'red' ? 'white' : 'red')}</button>}
      </li>)}</ul>
      {!members.length && <p className="training-group-empty">Sin jugadoras asignadas.</p>}
    </section>
  })}</div>
}

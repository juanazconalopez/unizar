import type { TrainingGroupColor, TrainingGroupPlayer } from './types'
import { groupColorLabel } from './trainingGroupSelectors'

export function TrainingGroupUnassigned({ players, disabled, onAdd }: {
  players: TrainingGroupPlayer[]; disabled: boolean; onAdd: (playerId: string, color: TrainingGroupColor) => void
}) {
  return <section className="training-group-unassigned" aria-label="Jugadoras sin grupo">
    <header><h2>Jugadoras sin grupo</h2><span>{players.length} {players.length === 1 ? 'jugadora' : 'jugadoras'}</span></header>
    <p>Todavía no están asignadas a ningún grupo. Puedes añadirlas a Rojo o Blanco y guardar y publicar los cambios. Si generas nuevos grupos, se incluirán automáticamente en el reparto.</p>
    {players.length ? <ul className="training-group-roster">{[...players].sort((a, b) => a.display_name.localeCompare(b.display_name, 'es')).map((player) => <li key={player.player_id}>
      <strong>{player.display_name}</strong><div className="training-group-add-actions">{(['red', 'white'] as const).map((color) => <button type="button" key={color} disabled={disabled} className={`secondary-button training-group-add ${color}`} aria-label={`Añadir a ${player.display_name} al grupo ${groupColorLabel(color)}`} onClick={() => onAdd(player.player_id, color)}>Añadir a {groupColorLabel(color)}</button>)}</div>
    </li>)}</ul> : <p className="training-group-empty">Todas las jugadoras de la plantilla actual tienen grupo.</p>}
    <small>Solo aparecen jugadoras activas y vinculadas: Regional o Nacional con equipo, o Solo entrenamientos.</small>
  </section>
}

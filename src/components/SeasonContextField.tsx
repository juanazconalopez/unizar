import { seasonState } from '../lib/dates'
import type { Season } from '../types'

export function SeasonContextField({ season, creation }: { season?: Season; creation: boolean }) {
  return (
    <div aria-label={creation ? 'Temporada activa' : 'Temporada'} className="season-context-field" role="group">
      <span>{creation ? 'Temporada activa' : 'Temporada'}</span>
      <div>
        <strong>{season?.name ?? 'No hay una temporada activa'}</strong>
        {season && <span className={`season-state ${seasonState(season).toLowerCase()}`}>{seasonState(season)}</span>}
      </div>
      <input name="seasonId" type="hidden" value={season?.id ?? ''} />
    </div>
  )
}

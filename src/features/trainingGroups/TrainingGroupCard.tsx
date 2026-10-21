import { useEffect, useState } from 'react'
import { formatDate, todayInMadridIso } from '../../lib/dates'
import { errorText } from '../../lib/errors'
import { trainingGroupsApi } from '../../services/trainingGroupsService'
import type { TrainingGroupsApi, TrainingGroupSummary } from './types'
import { currentTrainingGroupBlock, trainingGroupRenewal } from './trainingGroupSelectors'

export function TrainingGroupCard({ seasonId, userId, canManage = false, onOpen, api = trainingGroupsApi }: {
  seasonId: string; userId: string; canManage?: boolean; onOpen: () => void; api?: TrainingGroupsApi
}) {
  const [state, setState] = useState<{ scope: string; summary?: TrainingGroupSummary; error?: string }>()
  const [retry, setRetry] = useState(0)
  const scope = `${seasonId}:${userId}:${canManage}`
  useEffect(() => {
    let active = true
    const load = () => api.summary(seasonId).then((summary) => { if (active) setState({ scope, summary }) })
      .catch((error: unknown) => { if (active) setState({ scope, error: errorText(error) }) })
    void load()
    const refresh = () => { if (document.visibilityState === 'visible') void load() }
    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    return () => { active = false; window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh) }
  }, [api, scope, seasonId, retry])
  if (state?.scope !== scope) return null
  if (state.error) return <div className="training-group-card"><span>No se ha podido cargar tu grupo de entrenamiento.</span><button className="text-button" onClick={() => setRetry((value) => value + 1)}>Reintentar</button></div>
  if (!state.summary) return null
  const today = todayInMadridIso()
  const current = currentTrainingGroupBlock(state.summary.blocks, today)
  const upcoming = state.summary.blocks.filter((block) => block.status === 'published' && block.starts_on > today).sort((a, b) => a.starts_on.localeCompare(b.starts_on))[0]
  const renewal = current ? trainingGroupRenewal(current, today) : null
  if (!canManage) return null
  return <section className="training-group-card" aria-label="Renovación de grupos">
    <div><strong>Grupos de entrenamiento</strong><p>{current ? `Llevamos ${renewal!.weeks} semanas con el reparto actual.` : 'Todavía no hay un reparto vigente.'} {upcoming ? `Próximo reparto: ${formatDate(upcoming.starts_on)}.` : renewal?.overdue ? 'Toca rehacer los grupos.' : renewal?.soon ? `Estamos en la tercera semana. Revisa los grupos antes del ${formatDate(renewal.renewOn)}.` : renewal ? `Renovación prevista: ${formatDate(renewal.renewOn)}.` : ''}</p></div>
    <div><button className="secondary-button compact" onClick={onOpen}>Gestionar grupos</button></div>
  </section>
}

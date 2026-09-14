import { useCallback, useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { PlayerCalendarView } from '../calendar/PlayerCalendarView'
import { Dashboard } from '../dashboard/Dashboard'
import { SurveyCalendarResultsDialog } from '../surveys/SurveyCalendarResultsDialog'
import { fetchSurveyCalendarResults } from '../../services/surveysService'
import { fetchPlayerPreview, fetchPlayerPreviewSurveyClosures } from '../../services/playerPreviewService'
import type { PlayerPreviewData } from '../../services/playerPreviewService'

export function PlayerPreviewView({ playerId }: { playerId: string }) {
  const [data, setData] = useState<PlayerPreviewData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [screen, setScreen] = useState<'home' | 'calendar'>('home')
  const [surveyResultId, setSurveyResultId] = useState<string>()
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try { setData(await fetchPlayerPreview(playerId)) } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo cargar la vista previa.') } finally { setLoading(false) }
  }, [playerId])
  useEffect(() => {
    let active = true
    void fetchPlayerPreview(playerId).then((value) => { if (active) setData(value) }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'No se pudo cargar la vista previa.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [playerId])
  if (loading) return <main className="player-preview-shell"><p className="page-loading">Cargando vista previa…</p></main>
  if (error || !data) return <main className="player-preview-shell"><p className="form-error">{error || 'No se encontró la jugadora.'}</p></main>
  return <main className="player-preview-shell">
    <header className="player-preview-banner"><div><span className="eyebrow">SOLO LECTURA</span><strong>Vista previa de {data.player.display_name} como jugadora</strong><small>Los datos se muestran tal como están ahora; no se puede modificar nada desde esta pestaña.</small></div><div><button aria-pressed={screen === 'home'} className="secondary-button compact" onClick={() => setScreen('home')} type="button">Inicio</button><button aria-pressed={screen === 'calendar'} className="secondary-button compact" onClick={() => setScreen('calendar')} type="button">Calendario</button><button className="secondary-button compact" onClick={() => void load()} type="button"><Icon name="refresh" size={16} />Actualizar</button><button className="primary-button compact" onClick={() => window.close()} type="button">Cerrar vista previa</button></div></header>
    {screen === 'home' && <Dashboard announcements={data.announcements} attendance={[]} matches={data.matches} memberships={data.memberships} profile={data.player} profiles={data.profiles} results={data.results} tasks={data.tasks} userId={data.player.id} onGoToTasks={() => setScreen('calendar')} />}
    {screen === 'calendar' && <PlayerCalendarView
      announcements={data.announcements}
      availability={data.availability}
      birthdays={[]}
      holidays={data.holidays}
      lineups={data.lineups}
      matches={data.matches}
      memberships={data.memberships}
      profiles={data.profiles}
      results={data.results}
      tasks={data.tasks}
      userId={data.player.id}
      onLoadMatchMonth={async () => undefined}
      onLoadTaskRange={async () => undefined}
      onLoadSurveyClosures={(from, until) => fetchPlayerPreviewSurveyClosures(data.player.id, from, until)}
      onOpenSurveyResults={setSurveyResultId}
    />}
    {surveyResultId && <SurveyCalendarResultsDialog onClose={() => setSurveyResultId(undefined)} onLoad={fetchSurveyCalendarResults} surveyId={surveyResultId} />}
  </main>
}

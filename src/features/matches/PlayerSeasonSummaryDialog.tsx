import { useEffect, useId, useState } from 'react'
import { Icon } from '../../components/Icon'
import { SectionError, SectionLoading } from '../../components/AsyncViewState'
import { Modal } from '../../components/ui/Modal'
import { formatDate } from '../../lib/dates'
import type { PlayerSeasonMatch, PlayerSeasonSummary, Season } from '../../types'

export function PlayerSeasonSummaryDialog({ playerId, season, initialSummary, onClose, onLoad }: {
  playerId: string
  season: Season
  initialSummary?: PlayerSeasonSummary
  onClose: () => void
  onLoad: (seasonId: string, playerId: string) => Promise<PlayerSeasonSummary>
}) {
  const titleId = useId()
  const [summary, setSummary] = useState<PlayerSeasonSummary | null>(initialSummary ?? null)
  const [loading, setLoading] = useState(!initialSummary)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      setSummary(await onLoad(season.id, playerId))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se ha podido cargar el resumen personal.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    if (initialSummary) return () => { active = false }
    void onLoad(season.id, playerId)
      .then((data) => { if (active) setSummary(data) })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'No se ha podido cargar el resumen personal.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [initialSummary, onLoad, playerId, season.id])

  return (
    <Modal className="player-season-dialog" labelledBy={titleId} onClose={onClose}>
      <div className="task-detail-heading"><div><span className="eyebrow">RESUMEN DE TEMPORADA</span><h2 id={titleId}>{summary?.playerName ?? 'Mi temporada'}</h2><p>{summary?.seasonName ?? season.name}</p></div><button aria-label="Cerrar" className="icon-button" onClick={onClose}>×</button></div>
      {loading ? <SectionLoading /> : error ? <SectionError message={error} onRetry={() => void load()} /> : summary && <PlayerSeasonSummaryContent summary={summary} />}
    </Modal>
  )
}

function PlayerSeasonSummaryContent({ summary }: { summary: PlayerSeasonSummary }) {
  const totalCallups = summary.callups.official + summary.callups.friendly
  return <div className="player-season-summary">
    <div className="player-season-metrics">
      <SummaryMetric label="Convocatorias" note={`${summary.callups.official} oficiales · ${summary.callups.friendly} amistosas`} value={totalCallups.toString()} />
      <SummaryMetric label="Participación" note={`${summary.callups.starter} titular · ${summary.callups.substitute} suplente`} value={`${summary.callups.starter}/${summary.callups.substitute}`} />
      <SummaryMetric label="Disponibilidad" note={`${summary.availability.responded}/${summary.availability.eligibleMatches} respuestas`} value={percentage(summary.availability.percentage)} />
      <SummaryMetric label="Asistencia a campo" note={`${summary.attendance.attended}/${summary.attendance.eligibleSessions} entrenamientos`} value={percentage(summary.attendance.percentage)} />
    </div>
    <section className="season-availability-detail">
      <h3>Disponibilidad</h3>
      <div><AvailabilityItem count={summary.availability.available} label="Disponible" tone="available" /><AvailabilityItem count={summary.availability.doubt} label="En duda" tone="doubt" /><AvailabilityItem count={summary.availability.unavailable} label="No disponible" tone="unavailable" /><AvailabilityItem count={summary.availability.unanswered} label="Sin responder" tone="unanswered" /></div>
    </section>
    <section className="season-match-history">
      <h3>Partidos de la temporada</h3>
      <div>{summary.matches.map((match) => <SeasonMatchRow key={match.matchId} match={match} />)}{!summary.matches.length && <p className="season-history-empty">Todavía no hay partidos publicados en tu periodo de inscripción.</p>}</div>
    </section>
  </div>
}

function SummaryMetric({ label, value, note }: { label: string; value: string; note: string }) {
  return <article><span>{label}</span><strong>{value}</strong><small>{note}</small></article>
}

function AvailabilityItem({ count, label, tone }: { count: number; label: string; tone: string }) {
  return <span className={tone}><b>{count}</b>{label}</span>
}

function SeasonMatchRow({ match }: { match: PlayerSeasonMatch }) {
  return <article>
    <span className="season-match-icon"><Icon name={match.calledUp ? 'check' : 'calendar'} size={16} /></span>
    <div><strong>{match.opponent}</strong><small>{formatDate(match.date, { day: 'numeric', month: 'short', year: 'numeric' })} · {match.kind === 'official' ? 'Oficial' : 'Amistoso'}</small></div>
    <div className="season-match-status"><span>{availabilityLabel(match.availabilityStatus)}</span><b>{match.calledUp ? `${match.lineupRole === 'starter' ? 'Titular' : 'Suplente'}${match.slotNumber ? ` · ${match.slotNumber}` : ''}` : 'Sin convocatoria'}</b></div>
  </article>
}

function percentage(value: number | null) {
  return value === null ? '—' : `${value}%`
}

function availabilityLabel(status: PlayerSeasonMatch['availabilityStatus']) {
  if (status === 'available') return 'Disponible'
  if (status === 'doubt') return 'En duda'
  if (status === 'unavailable') return 'No disponible'
  return 'Sin responder'
}

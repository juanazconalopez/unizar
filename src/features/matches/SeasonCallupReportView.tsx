import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { SectionError, SectionLoading } from '../../components/AsyncViewState'
import { EmptyState } from '../../components/ui/EmptyState'
import { PlayerSeasonSummaryDialog } from './PlayerSeasonSummaryDialog'
import { copyText, downloadText } from '../../lib/fileExport'
import { callupReportTsv, callupReportXml } from '../../lib/matchExports'
import { formatDate } from '../../lib/dates'
import type { PlayerSeasonSummary, Season, SeasonCallupReport } from '../../types'

export function SeasonCallupReportView({ season, onLoad, onLoadPlayer }: {
  season?: Season
  onLoad: (seasonId: string) => Promise<SeasonCallupReport>
  onLoadPlayer?: (seasonId: string, playerId: string) => Promise<PlayerSeasonSummary>
}) {
  const [report, setReport] = useState<SeasonCallupReport | null>(null)
  const [loading, setLoading] = useState(Boolean(season))
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)

  async function load() {
    if (!season) return
    setLoading(true)
    setError('')
    try {
      setReport(await onLoad(season.id))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se ha podido cargar el resumen.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    if (!season) return () => { active = false }
    void onLoad(season.id)
      .then((data) => { if (active) setReport(data) })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'No se ha podido cargar el resumen.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [onLoad, season])

  if (!season) return <EmptyState title="Sin temporada activa" text="El resumen estará disponible cuando haya una temporada activa." />
  if (loading) return <SectionLoading />
  if (error) return <SectionError message={error} onRetry={() => void load()} />
  if (!report) return null
  const orderedPlayers = [...report.players].sort((first, second) => (
    second.officialCallups - first.officialCallups
    || second.friendlyCallups - first.friendlyCallups
    || (second.attendancePercentage ?? -1) - (first.attendancePercentage ?? -1)
    || first.name.localeCompare(second.name, 'es')
  ))

  async function copyReport() {
    try {
      await copyText(callupReportTsv(report!))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se ha podido copiar el resumen.')
    }
  }

  return (
    <section className="callup-report" aria-labelledby="callup-report-title">
      <div className="callup-report-heading">
        <div><span className="eyebrow">TEMPORADA ACTIVA</span><h2 id="callup-report-title">Resumen de convocatorias</h2><p>{report.seasonName} · Datos hasta el {formatDate(report.generatedOn, { day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
        <div className="callup-report-actions">
          <button className="secondary-button" onClick={() => void copyReport()} type="button"><Icon name="copy" size={17} />{copied ? 'Tabla copiada' : 'Copiar tabla'}</button>
          <button className="primary-button" onClick={() => downloadText(`resumen-convocatorias-${report.seasonName}.xml`, callupReportXml(report), 'application/xml')} type="button"><Icon name="download" size={17} />Descargar XML</button>
        </div>
      </div>
      <div className="callup-report-table-wrap">
        <table className="callup-report-table">
          <thead><tr><th>Nombre</th><th>Oficiales <b>{report.totals.officialMatches}</b></th><th>Amistosos <b>{report.totals.friendlyMatches}</b></th><th>Titular</th><th>Suplente</th><th>Disponibilidad</th><th>Asistencia <b>{report.totals.trainingSessions}</b></th></tr></thead>
          <tbody>{orderedPlayers.map((player) => (
            <tr key={player.playerId}>
              <th scope="row">{onLoadPlayer ? <button className="callup-player-link" onClick={() => setSelectedPlayerId(player.playerId)} type="button">{player.name}<Icon name="arrow" size={14} /></button> : player.name}</th>
              <td>{player.officialCallups}</td>
              <td>{player.friendlyCallups}</td>
              <td>{player.starterCallups}</td>
              <td>{player.substituteCallups}</td>
              <td><strong>{player.availabilityResponded}/{player.eligibleMatches}</strong><span>{player.availabilityPercentage === null ? 'Sin datos' : `${player.availabilityPercentage}%`}</span></td>
              <td><strong>{player.attendedSessions}</strong><span>{player.attendancePercentage === null ? 'Sin datos' : `${player.attendancePercentage}%`}</span></td>
            </tr>
          ))}</tbody>
        </table>
        {!report.players.length && <EmptyState title="Sin participantes" text="Todavía no hay jugadoras inscritas en esta temporada." />}
      </div>
      <p className="callup-report-note">La asistencia se calcula sobre los entrenamientos realizados durante el periodo de inscripción de cada jugadora.</p>
      {selectedPlayerId && onLoadPlayer && <PlayerSeasonSummaryDialog key={selectedPlayerId} onClose={() => setSelectedPlayerId(null)} onLoad={onLoadPlayer} playerId={selectedPlayerId} season={season} />}
    </section>
  )
}

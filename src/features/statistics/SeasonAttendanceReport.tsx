import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../../components/Icon'
import { EmptyState } from '../../components/ui/EmptyState'
import { Modal } from '../../components/ui/Modal'
import { formatDate } from '../../lib/dates'
import { displayNameContains, normalizeDisplayName } from '../../lib/displayNames'
import { downloadText } from '../../lib/fileExport'
import { attendanceReportXml } from '../../lib/seasonExports'
import type { Season, SeasonCallupReport } from '../../types'

export function SeasonAttendanceReport({ season, onLoad }: {
  season?: Season
  onLoad: (seasonId: string) => Promise<SeasonCallupReport>
}) {
  const [report, setReport] = useState<SeasonCallupReport | null>(null)
  const [loading, setLoading] = useState(Boolean(season))
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  async function load() {
    if (!season) return
    setLoading(true)
    setError('')
    try {
      setReport(await onLoad(season.id))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se ha podido cargar la asistencia acumulada.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    if (!season) return () => { active = false }
    void onLoad(season.id)
      .then((data) => { if (active) setReport(data) })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'No se ha podido cargar la asistencia acumulada.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [onLoad, season])

  const normalizedSearch = normalizeDisplayName(search)
  const players = useMemo(() => report?.players
    .filter((player) => !normalizedSearch || displayNameContains(player.name, normalizedSearch))
    .sort((first, second) => (
      second.attendedSessions - first.attendedSessions
      || (second.attendancePercentage ?? -1) - (first.attendancePercentage ?? -1)
      || first.name.localeCompare(second.name, 'es')
    )) ?? [], [normalizedSearch, report])
  const average = attendanceAverage(report)

  function exportXml() {
    if (!report) return
    downloadText(
      `asistencia-acumulada-${report.seasonName}.xml`,
      attendanceReportXml(report, new Set(players.map((player) => player.playerId))),
      'application/xml',
    )
  }

  return <>
    <article className="statistics-attendance-card">
      <span>Asistencia acumulada</span>
      <strong>{loading ? '…' : average === null ? '—' : `${average}%`}</strong>
      <small title={error || undefined}>{error
        ? error
        : report
          ? `Media del equipo · ${report.totals.trainingSessions} entrenamientos hasta hoy`
          : season ? 'Sin datos de asistencia' : 'Sin temporada activa'}</small>
      {error
        ? <button className="text-button" onClick={() => void load()} type="button">Reintentar</button>
        : <button className="text-button" disabled={!report || loading} onClick={() => setOpen(true)} type="button">Ver asistencia acumulada <Icon name="arrow" size={14} /></button>}
    </article>

    {open && report && <Modal className="season-attendance-dialog" labelledBy="season-attendance-title" onClose={() => setOpen(false)}>
      <div className="season-attendance-heading">
        <div>
          <span className="eyebrow">TEMPORADA ACTIVA</span>
          <h2 id="season-attendance-title">Asistencia acumulada</h2>
          <p>{report.seasonName} · {report.totals.trainingSessions} entrenamientos hasta el {formatDate(report.generatedOn, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <button aria-label="Cerrar asistencia acumulada" className="modal-close-button" onClick={() => setOpen(false)} type="button">×</button>
      </div>
      <div className="season-attendance-team-average">
        <span>MEDIA DE ASISTENCIA DEL EQUIPO</span>
        <strong>{average === null ? '—' : `${average}%`}</strong>
      </div>
      <div className="season-attendance-toolbar">
        <label>
          Buscar jugadora por nombre
          <span><Icon name="search" size={16} /><input autoFocus onChange={(event) => setSearch(event.target.value)} placeholder="Nombre de la jugadora…" type="search" value={search} /></span>
        </label>
        <div><strong>{players.length} de {report.players.length} jugadoras</strong><button className="secondary-button compact" disabled={!players.length} onClick={exportXml} type="button"><Icon name="download" size={16} />Asistencia XML</button></div>
      </div>
      <div className="season-attendance-table-wrap">
        <table className="season-attendance-table">
          <thead><tr><th>Jugadora</th><th>Asistencias</th><th>Entrenamientos computables</th><th>Porcentaje</th></tr></thead>
          <tbody>{players.map((player) => (
            <tr key={player.playerId}>
              <th scope="row">{player.name}</th>
              <td>{player.attendedSessions}</td>
              <td>{player.eligibleSessions}</td>
              <td><strong>{player.attendancePercentage === null ? '—' : `${player.attendancePercentage}%`}</strong></td>
            </tr>
          ))}</tbody>
        </table>
        {!players.length && <EmptyState title="Sin coincidencias" text={`No hay jugadoras que coincidan con “${search.trim()}”.`} />}
      </div>
      <p className="callup-report-note">Ordenado por número de asistencias. Cada porcentaje usa los entrenamientos celebrados durante el periodo de inscripción de la jugadora.</p>
    </Modal>}
  </>
}

function attendanceAverage(report: SeasonCallupReport | null) {
  const percentages = report?.players
    .map((player) => player.attendancePercentage)
    .filter((percentage): percentage is number => percentage !== null) ?? []
  if (!percentages.length) return null
  return Math.round(percentages.reduce((total, percentage) => total + percentage, 0) / percentages.length)
}

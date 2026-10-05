import { Fragment } from 'react'
import { groupPlayersByPosition } from '../../lib/playerPositions'
import { Icon } from '../../components/Icon'
import { formatDate } from '../../lib/dates'
import type { Season } from '../../types'
import './seasonTeamsReport.css'

type ReportGroup = {
  id: string
  name: string
  description: string
  coaches: { id: string; name: string; role: string }[]
  players: { id: string; name: string; license: string; absent: boolean; primary_position: string | null }[]
}

export function SeasonTeamsReport({ season, generatedOn, groups, teamCount }: {
  season: Season
  generatedOn: string
  groups: ReportGroup[]
  teamCount: number
}) {
  const playerCount = groups.reduce((sum, group) => sum + group.players.length, 0)
  const absenceCount = groups.reduce((sum, group) => sum + group.players.filter((player) => player.absent).length, 0)
  const date = formatDate(generatedOn, { day: 'numeric', month: 'long', year: 'numeric' })

  return <article aria-label="Vista previa del PDF de equipos" className="season-teams-print-report">
    <header className="teams-report-cover">
      <span className="teams-report-brand">CDU RUGBY · FEMENINO</span>
      <h1>Equipos y plantilla</h1>
      <p>{season.name}</p>
      <small>Actualizado el {date}</small>
    </header>
    <div className="teams-report-summary">
      <span><strong>{teamCount}</strong>{teamCount === 1 ? 'equipo' : 'equipos'}</span>
      <span><strong>{playerCount}</strong>{playerCount === 1 ? 'jugadora' : 'jugadoras'}</span>
      {absenceCount > 0 && <span className="teams-report-absence-total"><strong><Icon name="medicalCross" size={20} />{absenceCount}</strong>{absenceCount === 1 ? 'baja deportiva' : 'bajas deportivas'}</span>}
    </div>
    {groups.map((group, index) => <section aria-label={group.name} className="teams-report-group" key={group.id}>
      <header className="teams-report-group-heading">
        <span className="teams-report-number">{String(index + 1).padStart(2, '0')}</span>
        <div><h2>{group.name}</h2><p>{group.description} · {group.players.length} {group.players.length === 1 ? 'jugadora' : 'jugadoras'}</p></div>
      </header>
      {group.coaches.length > 0 && <div className="teams-report-coaches">{group.coaches.map((coach) => <p key={coach.id}><span>{coach.role}</span><strong>{coach.name}</strong></p>)}</div>}
      {!group.coaches.length && group.id !== 'unassigned' && <p className="teams-report-empty">Sin entrenadores asignados.</p>}
      {group.players.length > 0 ? <table>
        <colgroup><col className="teams-report-name-column" /><col className="teams-report-license-column" /><col className="teams-report-status-column" /></colgroup>
        <thead><tr><th scope="col">Jugadora</th><th scope="col">Ficha</th><th scope="col">Estado deportivo</th></tr></thead>
        <tbody>{groupPlayersByPosition(group.players).filter((positionGroup) => positionGroup.players.length > 0).map((positionGroup) => <Fragment key={positionGroup.value}><tr className="teams-report-position-group"><th colSpan={3} scope="colgroup">{positionGroup.label} · {positionGroup.players.length}</th></tr>{positionGroup.players.map((player) => <tr key={player.id}>
          <th scope="row">{player.name}</th><td>{player.license}</td>
          <td>{player.absent ? <span className="teams-report-absence"><Icon name="medicalCross" size={15} />Baja deportiva</span> : '-'}</td>
        </tr>)}</Fragment>)}</tbody>
      </table> : <p className="teams-report-empty">Sin jugadoras asignadas.</p>}
    </section>)}
    {!groups.length && <p className="teams-report-empty">Todavía no hay equipos ni jugadoras vinculadas en esta temporada.</p>}
    <footer className="teams-report-footer">{season.name} · Plantilla a {date}</footer>
  </article>
}

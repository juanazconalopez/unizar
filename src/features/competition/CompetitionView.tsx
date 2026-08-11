import { useMemo, useState } from 'react'
import { Icon } from '../../components/Icon'
import type { CompetitionFixture, CompetitionPlayerStat, CompetitionSeason, CompetitionStanding } from '../../types'
import unizarLogo from '../../assets/teamLogos/matchready-58a5ca6a327da-club.png'
import soriaLogo from '../../assets/teamLogos/matchready-58a5c9d3651ed-club.png'
import iberoLogo from '../../assets/teamLogos/matchready-58a5c9c157139-club.png'
import fenixLogo from '../../assets/teamLogos/matchready-58a5c9abd6c6c-club.png'

type CompetitionTab = 'results' | 'standings' | 'statistics'
type StatisticMetric = 'points' | 'tries' | 'conversions' | 'cards'

export function CompetitionView({ seasons, fixtures, standings, playerStats, errorMessage = '', isOwner = false, loading = false, syncing = false, onSeasonChange, onSync }: {
  seasons: CompetitionSeason[]
  fixtures: CompetitionFixture[]
  standings: CompetitionStanding[]
  playerStats: CompetitionPlayerStat[]
  errorMessage?: string
  isOwner?: boolean
  loading?: boolean
  syncing?: boolean
  onSeasonChange?: (seasonId: string) => Promise<void>
  onSync?: () => Promise<void>
}) {
  const orderedSeasons = useMemo(() => seasons.slice().sort((a, b) => b.startsOn.localeCompare(a.startsOn)), [seasons])
  const [seasonId, setSeasonId] = useState(() => orderedSeasons[0]?.id ?? '')
  const [tab, setTab] = useState<CompetitionTab>('results')
  const [metric, setMetric] = useState<StatisticMetric>('points')
  const [team, setTeam] = useState('Todos')
  const selectedSeasonId = orderedSeasons.some((item) => item.id === seasonId) ? seasonId : orderedSeasons[0]?.id ?? ''
  const season = orderedSeasons.find((item) => item.id === selectedSeasonId)
  const seasonFixtures = fixtures.filter((item) => item.competitionSeasonId === selectedSeasonId)
  const seasonStandings = standings.filter((item) => item.competitionSeasonId === selectedSeasonId).sort((a, b) => a.position - b.position)
  const seasonStats = playerStats.filter((item) => item.competitionSeasonId === selectedSeasonId)
  const teams = ['Todos', ...Array.from(new Set(seasonStats.map((item) => item.team))).sort()]

  if (!season) {
    return (
      <section className="page competition-page">
        <header className="page-header"><div><span className="eyebrow">LIGA AUTONÓMICA ARAGÓN</span><h1>Competición</h1><p>Resultados, clasificación y estadísticas de la liga.</p></div></header>
        {errorMessage && <div className="competition-sync-error" role="alert"><Icon name="warning" size={17} />{errorMessage}</div>}
        <div className="empty-state"><span><Icon name="trophy" /></span><h3>{syncing || loading ? 'Sincronizando competición…' : 'Competición pendiente de sincronización'}</h3><p>{syncing || loading ? 'Estamos consultando la fuente pública de MatchReady.' : 'El histórico aparecerá cuando el owner realice la primera sincronización.'}</p>{isOwner && onSync && !syncing && <button className="primary-button" onClick={() => void onSync().catch(() => undefined)}>Sincronizar ahora</button>}</div>
      </section>
    )
  }

  return (
    <section className="page competition-page">
      <header className="page-header competition-header">
        <div><span className="eyebrow">LIGA AUTONÓMICA ARAGÓN</span><h1>Competición</h1><p>Resultados, clasificación y estadísticas de la liga.</p></div>
        <div className="competition-header-actions">
          <label className="competition-season">Temporada<select disabled={loading} value={selectedSeasonId} onChange={(event) => { const next = event.target.value; setSeasonId(next); setTeam('Todos'); if (onSeasonChange) void onSeasonChange(next).catch(() => undefined) }}>{orderedSeasons.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          {isOwner && onSync && <button className="secondary-button" disabled={syncing} onClick={() => void onSync().catch(() => undefined)}><Icon name="refresh" size={17} />{syncing ? 'Sincronizando…' : 'Sincronizar'}</button>}
        </div>
      </header>

      {errorMessage && <div className="competition-sync-error" role="alert"><Icon name="warning" size={17} />{errorMessage}<span>Se mantienen visibles los últimos datos guardados.</span></div>}

      <nav aria-label="Secciones de competición" className="competition-tabs">
        <button className={tab === 'results' ? 'active' : ''} onClick={() => setTab('results')}>Resultados</button>
        <button className={tab === 'standings' ? 'active' : ''} onClick={() => setTab('standings')}>Clasificación</button>
        <button className={tab === 'statistics' ? 'active' : ''} onClick={() => setTab('statistics')}>Estadísticas</button>
      </nav>

      {tab === 'results' && <Results fixtures={seasonFixtures} />}
      {tab === 'standings' && <Standings standings={seasonStandings} />}
      {tab === 'statistics' && (
        <Statistics
          metric={metric}
          stats={seasonStats}
          team={team}
          teams={teams}
          onMetricChange={setMetric}
          onTeamChange={setTeam}
        />
      )}

      <footer className="competition-source">
        <span>Datos de referencia: {season.sourceLabel}</span>
        {season.updatedAt && <span>Actualizado el {formatDate(season.updatedAt.slice(0, 10))}</span>}
      </footer>
    </section>
  )
}

function Results({ fixtures }: { fixtures: CompetitionFixture[] }) {
  const rounds = useMemo(() => {
    const grouped = new Map<string, CompetitionFixture[]>()
    fixtures.slice().sort((a, b) => a.roundOrder - b.roundOrder || a.matchDate.localeCompare(b.matchDate)).forEach((fixture) => {
      grouped.set(fixture.round, [...(grouped.get(fixture.round) ?? []), fixture])
    })
    return Array.from(grouped.entries())
  }, [fixtures])

  if (!rounds.length) return <div className="empty-state"><span><Icon name="calendar" /></span><h3>Sin resultados</h3><p>No hay partidos publicados para esta temporada.</p></div>

  return <div className="competition-rounds">{rounds.map(([round, matches]) => (
    <section className="competition-round" key={round}>
      <div className="competition-section-heading"><span>{round}</span><small>{matches.length} {matches.length === 1 ? 'partido' : 'partidos'}</small></div>
      <div className="competition-fixtures">{matches.map((fixture) => <FixtureCard fixture={fixture} key={fixture.id} />)}</div>
    </section>
  ))}</div>
}

function FixtureCard({ fixture }: { fixture: CompetitionFixture }) {
  const final = fixture.status === 'final' && fixture.homeScore !== null && fixture.awayScore !== null
  return (
    <article className="competition-fixture-card">
      <div className="competition-match-meta"><span>{formatDate(fixture.matchDate)}</span><span>{fixture.kickoffTime?.slice(0, 5) ?? 'Hora pendiente'}</span></div>
      <div className="competition-scoreboard">
        <Team name={fixture.homeTeam} />
        <div className="competition-score">
          {final ? <strong><span>{fixture.homeScore}</span><i>—</i><span>{fixture.awayScore}</span></strong> : <strong className="pending-score">—</strong>}
          <small>{statusLabel(fixture.status)}</small>
        </div>
        <Team name={fixture.awayTeam} away />
      </div>
    </article>
  )
}

function Team({ name, away = false }: { name: string; away?: boolean }) {
  const logo = teamLogo(name)
  return <div className={`competition-team${away ? ' away' : ''}${isClub(name) ? ' club' : ''}`}><span>{logo ? <img alt={`Escudo de ${name}`} src={logo} /> : initials(name)}</span><strong>{name}</strong></div>
}

function Standings({ standings }: { standings: CompetitionStanding[] }) {
  if (!standings.length) return <div className="empty-state"><span><Icon name="statistics" /></span><h3>Clasificación no disponible</h3><p>Todavía no hay posiciones publicadas.</p></div>
  return (
    <section className="competition-panel">
      <div className="competition-section-heading"><span>Clasificación general</span><small>{standings.length} equipos</small></div>
      <div className="competition-table-scroll">
        <table className="competition-table">
          <thead><tr><th>Pos.</th><th>Equipo</th><th>J</th><th>G</th><th>E</th><th>P</th><th>PF</th><th>PC</th><th>Dif.</th><th>BO</th><th>BD</th><th>Pts.</th></tr></thead>
          <tbody>{standings.map((row) => <tr className={isClub(row.team) ? 'club-row' : ''} key={row.team}><td><b>{row.position}</b></td><td><Team name={row.team} /></td><td>{row.played}</td><td>{row.won}</td><td>{row.drawn}</td><td>{row.lost}</td><td>{row.pointsFor}</td><td>{row.pointsAgainst}</td><td>{signed(row.difference)}</td><td>{row.offensiveBonus}</td><td>{row.defensiveBonus}</td><td><strong>{row.points}</strong></td></tr>)}</tbody>
        </table>
      </div>
      <div className="competition-table-legend">J: jugados · G: ganados · E: empatados · P: perdidos · PF/PC: puntos a favor/en contra · BO/BD: bonus ofensivo/defensivo</div>
    </section>
  )
}

function Statistics({ stats, metric, team, teams, onMetricChange, onTeamChange }: {
  stats: CompetitionPlayerStat[]
  metric: StatisticMetric
  team: string
  teams: string[]
  onMetricChange: (metric: StatisticMetric) => void
  onTeamChange: (team: string) => void
}) {
  const ranked = stats
    .filter((item) => team === 'Todos' || item.team === team)
    .slice()
    .sort((a, b) => metricValue(b, metric) - metricValue(a, metric) || a.player.localeCompare(b.player))
    .filter((item) => metricValue(item, metric) > 0)

  return (
    <section className="competition-panel">
      <div className="competition-stat-controls">
        <div className="competition-metrics" role="group" aria-label="Estadística mostrada">
          {([['points', 'Puntos'], ['tries', 'Ensayos'], ['conversions', 'Transformaciones'], ['cards', 'Tarjetas']] as const).map(([value, label]) => <button className={metric === value ? 'active' : ''} key={value} onClick={() => onMetricChange(value)}>{label}</button>)}
        </div>
        <label>Equipo<select value={team} onChange={(event) => onTeamChange(event.target.value)}>{teams.map((item) => <option key={item}>{item}</option>)}</select></label>
      </div>
      {ranked.length ? <div className="competition-ranking">{ranked.map((item, index) => (
        <article className={isClub(item.team) ? 'club-player' : ''} key={`${item.player}-${item.team}`}>
          <b className="competition-position">{index + 1}</b>
          <div><strong>{item.player}</strong><span>{item.team}</span></div>
          {metric === 'points' && <small>{item.tries} E · {item.conversions} T · {item.penalties} CG</small>}
          <strong className="competition-stat-value">{metricValue(item, metric)}<span>{metric === 'cards' ? '' : metric === 'points' ? ' pts' : ''}</span></strong>
        </article>
      ))}</div> : <div className="empty-state compact"><h3>Sin estadísticas</h3><p>No hay registros para este filtro.</p></div>}
    </section>
  )
}

function metricValue(item: CompetitionPlayerStat, metric: StatisticMetric) {
  if (metric === 'cards') return item.yellowCards + item.redCards
  return item[metric]
}

function isClub(team: string) { return team.toLocaleLowerCase('es').includes('unizar') }
function teamLogo(team: string) {
  const normalized = team.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
  if (normalized.includes('unizar')) return unizarLogo
  if (normalized.includes('fenix')) return fenixLogo
  if (normalized.includes('ibero')) return iberoLogo
  if (normalized.includes('ingenierosdesoria') || normalized.includes('ingdesoria')) return soriaLogo
  return null
}
function initials(team: string) { return team.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase() }
function signed(value: number) { return value > 0 ? `+${value}` : String(value) }
function statusLabel(status: CompetitionFixture['status']) { return status === 'final' ? 'Finalizado' : status === 'postponed' ? 'Aplazado' : 'Pendiente' }
function formatDate(value: string) { return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) }

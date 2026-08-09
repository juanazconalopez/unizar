import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { formatDate, formatWeek, mondayFor, todayIso } from '../../lib/dates'
import type { AvailabilityStatus, Match, MatchAvailability, MatchLineup, MatchValues, Profile, Season, SeasonPlayer } from '../../types'
import { MatchAvailabilityResponse } from './MatchAvailabilityResponse'
import { MatchAvailabilityDialog } from './MatchAvailabilityDialog'
import { MatchForm } from './MatchForm'
import { MatchLineupDialog } from './MatchLineupDialog'
import { MatchPlanningCalendar } from './MatchPlanningCalendar'

export function MatchesView({ availability, isOwner, lineups, matches, memberships, profiles, seasons, userId, onDelete, onSaveAvailability, onSaveLineup, onSaveMatch }: {
  availability: MatchAvailability[]; isOwner: boolean; lineups: MatchLineup[]; matches: Match[]; memberships: SeasonPlayer[]; profiles: Profile[]; seasons: Season[]; userId: string
  onDelete: (match: Match) => Promise<void>; onSaveAvailability: (match: Match, status: AvailabilityStatus, comment: string) => Promise<void>
  onSaveLineup: (match: Match, entries: Omit<MatchLineup, 'match_id' | 'updated_at'>[], published: boolean) => Promise<void>
  onSaveMatch: (match: Match | undefined, values: MatchValues) => Promise<void>
}) {
  const today = todayIso(); const currentWeek = mondayFor(today)
  const [managementView, setManagementView] = useState<'calendar' | 'list'>('calendar')
  const [selectedDate, setSelectedDate] = useState(today)
  const [month, setMonth] = useState(`${today.slice(0, 7)}-01`)
  const [formMatch, setFormMatch] = useState<Match | null | undefined>(undefined)
  const [lineupMatch, setLineupMatch] = useState<{ match: Match; editable: boolean } | null>(null)
  const [availabilityMatch, setAvailabilityMatch] = useState<Match | null>(null)
  const currentWeekRef = useRef<HTMLElement>(null)
  const visibleMatches = isOwner ? matches : matches.filter((match) => match.status !== 'draft')
  const selectedWeek = mondayFor(selectedDate)
  const selectedMatches = orderedMatches(visibleMatches.filter((match) => mondayFor(match.match_date) === selectedWeek))
  const futureMatches = visibleMatches.filter((match) => match.match_date >= currentWeek)
  const weeks = groupMatchesByWeek(futureMatches, currentWeek)

  useEffect(() => {
    if (managementView !== 'list') return
    const frame = window.requestAnimationFrame(() => currentWeekRef.current?.scrollIntoView?.({ block: 'start' }))
    return () => window.cancelAnimationFrame(frame)
  }, [managementView])

  function goToCurrentWeek() { setSelectedDate(today); setMonth(`${today.slice(0, 7)}-01`) }
  function card(match: Match) { return <MatchCard availability={availability.filter((item) => item.match_id === match.id)} isOwner={isOwner} key={match.id} lineup={lineups.filter((entry) => entry.match_id === match.id)} match={match} ownAvailability={availability.find((item) => item.match_id === match.id && item.player_id === userId)} onEdit={() => setFormMatch(match)} onManageLineup={() => setLineupMatch({ match, editable: true })} onSaveAvailability={onSaveAvailability} onViewAvailability={() => setAvailabilityMatch(match)} onViewLineup={() => setLineupMatch({ match, editable: false })} /> }

  return <div className="page"><PageHeader eyebrow="COMPETICIÓN" title="Partidos" subtitle={isOwner ? 'Planifica partidos, disponibilidad y alineaciones.' : 'Indica tu disponibilidad y consulta la convocatoria.'} action={<button className="secondary-button" onClick={() => setManagementView((view) => view === 'calendar' ? 'list' : 'calendar')}><Icon name={managementView === 'calendar' ? 'tasks' : 'calendar'} size={18} />{managementView === 'calendar' ? 'Vista de lista' : 'Vista calendario'}</button>} />
    {managementView === 'calendar' ? <div className="task-calendar-view"><div className="planning-current-action"><button className="secondary-button compact" onClick={goToCurrentWeek}><Icon name="calendar" size={16} />Ir a la semana actual</button></div><MatchPlanningCalendar matches={visibleMatches} month={month} selectedDate={selectedDate} onMonthChange={setMonth} onSelectDate={setSelectedDate} /><section className="selected-planning-week"><div className="task-week-heading"><div><span className="eyebrow">SEMANA SELECCIONADA</span><h2>{formatWeek(selectedWeek)}</h2></div><span>{selectedMatches.length} {selectedMatches.length === 1 ? 'partido' : 'partidos'}</span></div><div className="match-list">{selectedMatches.map(card)}{!selectedMatches.length && <EmptyState title="Semana sin partidos" text="No hay ningún partido programado esta semana." />}</div>{isOwner && <div className="selected-week-actions"><button className="primary-button" onClick={() => setFormMatch(null)}><Icon name="plus" size={18} />Nuevo partido</button></div>}</section></div> : <div className="match-week-list">{weeks.map(({ weekStart, weekMatches }) => <section className="task-week-group" key={weekStart} ref={weekStart === currentWeek ? currentWeekRef : undefined}><div className="task-week-heading"><div><span className="eyebrow">{weekStart === currentWeek ? 'SEMANA ACTUAL' : 'PRÓXIMA'}</span><h2>{formatWeek(weekStart)}</h2></div><span>{weekMatches.length} {weekMatches.length === 1 ? 'partido' : 'partidos'}</span></div><div className="match-list">{weekMatches.map(card)}{!weekMatches.length && <EmptyState title="Semana sin partidos" text="No hay ningún partido programado esta semana." />}</div></section>)}{isOwner && <div className="match-list-create"><button className="primary-button" onClick={() => setFormMatch(null)}><Icon name="plus" size={18} />Nuevo partido</button></div>}</div>}
    {formMatch !== undefined && <MatchForm initialDate={managementView === 'calendar' ? selectedDate : today} match={formMatch ?? undefined} seasons={seasons} onCancel={() => setFormMatch(undefined)} onDelete={formMatch ? async (match) => { await onDelete(match); setFormMatch(undefined) } : undefined} onSubmit={async (values) => { await onSaveMatch(formMatch ?? undefined, values); setSelectedDate(values.matchDate); setMonth(`${values.matchDate.slice(0, 7)}-01`); setFormMatch(undefined) }} />}
    {lineupMatch && <MatchLineupDialog availability={availability.filter((item) => item.match_id === lineupMatch.match.id)} entries={lineups.filter((entry) => entry.match_id === lineupMatch.match.id)} match={lineupMatch.match} memberships={memberships} profiles={profiles} onClose={() => setLineupMatch(null)} onSave={lineupMatch.editable ? async (entries, published) => { await onSaveLineup(lineupMatch.match, entries, published); setLineupMatch(null) } : undefined} />}
    {availabilityMatch && <MatchAvailabilityDialog availability={availability.filter((item) => item.match_id === availabilityMatch.id)} match={availabilityMatch} profiles={profiles} onClose={() => setAvailabilityMatch(null)} />}
  </div>
}

function MatchCard({ availability, isOwner, lineup, match, ownAvailability, onEdit, onManageLineup, onSaveAvailability, onViewAvailability, onViewLineup }: { availability: MatchAvailability[]; isOwner: boolean; lineup: MatchLineup[]; match: Match; ownAvailability?: MatchAvailability; onEdit: () => void; onManageLineup: () => void; onSaveAvailability: (match: Match, status: AvailabilityStatus, comment: string) => Promise<void>; onViewAvailability: () => void; onViewLineup: () => void }) {
  const canViewLineup = match.lineup_published && lineup.length > 0
  return <article className="match-card"><div className="match-card-heading"><div><span className="eyebrow">{match.is_home ? 'LOCAL' : 'VISITANTE'} · {match.match_kind === 'official' ? 'OFICIAL' : 'AMISTOSO'} · {match.rugby_format === 'sevens' ? 'SEVEN' : 'XV'}</span><h2>{match.is_home ? <>CDU Rugby <i>vs</i> {match.opponent}</> : <>{match.opponent} <i>vs</i> CDU Rugby</>}</h2><p>{formatDate(match.match_date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}{match.kickoff_time ? ` · ${match.kickoff_time.slice(0, 5)}` : ''}{match.venue ? ` · ${match.venue}` : ''}</p></div><span className={`match-status ${match.status}`}>{matchStatus(match.status)}</span></div>{match.notes && <p className="match-notes">{match.notes}</p>}
    {isOwner ? <><AvailabilitySummary availability={availability} onView={onViewAvailability} /><div className="match-actions"><button className="secondary-button compact" onClick={onEdit}>Editar partido</button>{canViewLineup && <button className="secondary-button compact" onClick={onViewLineup}>Ver convocatoria</button>}<button className="primary-button compact" onClick={onManageLineup}>Gestionar alineación</button></div></> : <><MatchAvailabilityResponse initial={ownAvailability} match={match} onSave={onSaveAvailability} />{canViewLineup && <div className="match-actions"><button className="secondary-button compact" onClick={onViewLineup}>Ver convocatoria</button></div>}</>}
  </article>
}

function AvailabilitySummary({ availability, onView }: { availability: MatchAvailability[]; onView: () => void }) { const count = (status: AvailabilityStatus) => availability.filter((item) => item.status === status).length; return <div className="availability-summary"><button className="available" onClick={onView}>{count('available')} disponibles</button><button className="doubt" onClick={onView}>{count('doubt')} dudas</button><button className="unavailable" onClick={onView}>{count('unavailable')} no disponibles</button></div> }
function orderedMatches(matches: Match[]) { return [...matches].sort((first, second) => first.match_date.localeCompare(second.match_date) || (first.kickoff_time ?? '').localeCompare(second.kickoff_time ?? '')) }
function groupMatchesByWeek(matches: Match[], currentWeek: string) { const weeks = new Map<string, Match[]>(); weeks.set(currentWeek, []); for (const match of orderedMatches(matches)) { const week = mondayFor(match.match_date); weeks.set(week, [...(weeks.get(week) ?? []), match]) } return [...weeks].sort(([first], [second]) => first.localeCompare(second)).map(([weekStart, weekMatches]) => ({ weekStart, weekMatches })) }
function matchStatus(status: Match['status']) { return status === 'draft' ? 'Borrador' : status === 'published' ? 'Publicado' : status === 'cancelled' ? 'Cancelado' : 'Finalizado' }

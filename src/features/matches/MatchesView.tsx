import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/ui/PageHeader'
import { mondayFor, todayIso } from '../../lib/dates'
import { activePlayers, membershipCoversDate, seasonForDate } from '../../lib/selectors'
import type {
  AvailabilityStatus,
  Match,
  MatchAvailability,
  MatchLineup,
  MatchValues,
  PlayerSeasonSummary,
  Profile,
  Season,
  SeasonPlayer,
  SeasonCallupReport,
} from '../../types'
import { MatchAvailabilityDialog } from './MatchAvailabilityDialog'
import { MatchCalendarView } from './MatchCalendarView'
import { MatchCard } from './MatchCard'
import { MatchForm } from './MatchForm'
import { MatchLineupDialog } from './MatchLineupDialog'
import { MatchListView } from './MatchListView'
import { SeasonCallupReportView } from './SeasonCallupReportView'

type MatchesViewProps = {
  availability: MatchAvailability[]
  canEditPlayerAvailability?: boolean
  canManage: boolean
  canUnlockLineup?: boolean
  canViewAvailability: boolean
  isPlayer: boolean
  lineups: MatchLineup[]
  matches: Match[]
  memberships: SeasonPlayer[]
  profiles: Profile[]
  seasons: Season[]
  userId: string
  focusedDate?: string
  canViewReport?: boolean
  onDelete: (match: Match) => Promise<void>
  onLoadMonth?: (month: string) => Promise<void>
  onSaveAvailability: (match: Match, status: AvailabilityStatus, comment: string) => Promise<void>
  onSavePlayerAvailability?: (match: Match, playerId: string, status: AvailabilityStatus, comment: string) => Promise<void>
  onSaveLineup: (
    match: Match,
    entries: Omit<MatchLineup, 'match_id' | 'updated_at'>[],
    published: boolean,
  ) => Promise<void>
  onSaveMatch: (match: Match | undefined, values: MatchValues) => Promise<void>
  onUnlockLineup?: (match: Match) => Promise<void>
  onLoadCallupReport?: (seasonId: string) => Promise<SeasonCallupReport>
  onLoadPlayerSeasonSummary?: (seasonId: string, playerId: string) => Promise<PlayerSeasonSummary>
}

export function MatchesView({
  availability,
  canEditPlayerAvailability = false,
  canManage,
  canUnlockLineup = false,
  canViewAvailability,
  isPlayer,
  lineups,
  matches,
  memberships,
  profiles,
  seasons,
  userId,
  focusedDate,
  canViewReport = false,
  onDelete,
  onLoadMonth,
  onSaveAvailability,
  onSavePlayerAvailability,
  onSaveLineup,
  onSaveMatch,
  onUnlockLineup,
  onLoadCallupReport,
  onLoadPlayerSeasonSummary,
}: MatchesViewProps) {
  const today = todayIso()
  const currentWeek = mondayFor(today)
  const [managementView, setManagementView] = useState<'calendar' | 'list'>('calendar')
  const [selectedDate, setSelectedDate] = useState(focusedDate ?? today)
  const [month, setMonth] = useState(`${(focusedDate ?? today).slice(0, 7)}-01`)
  const [formMatch, setFormMatch] = useState<Match | null | undefined>(undefined)
  const [lineupMatch, setLineupMatch] = useState<{ match: Match; editable: boolean } | null>(null)
  const [availabilityMatch, setAvailabilityMatch] = useState<Match | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const currentWeekRef = useRef<HTMLElement>(null)
  const visibleMatches = canManage ? matches : matches.filter((match) => match.status !== 'draft')
  const selectedWeek = mondayFor(selectedDate)
  const selectedMatches = orderedMatches(
    visibleMatches.filter((match) => mondayFor(match.match_date) === selectedWeek),
  )
  const futureMatches = visibleMatches.filter((match) => match.match_date >= currentWeek)
  const weeks = groupMatchesByWeek(futureMatches, currentWeek)
  const activeSeason = seasonForDate(seasons, today)

  useEffect(() => {
    if (!focusedDate || !onLoadMonth) return
    void onLoadMonth(`${focusedDate.slice(0, 7)}-01`).catch(() => undefined)
  }, [focusedDate, onLoadMonth])

  useEffect(() => {
    if (managementView !== 'list') return
    const frame = window.requestAnimationFrame(() => {
      currentWeekRef.current?.scrollIntoView?.({ block: 'start' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [managementView])

  function goToCurrentWeek() {
    setSelectedDate(today)
    setMonth(`${today.slice(0, 7)}-01`)
  }

  async function refreshMatchMonth(date: string) {
    if (!onLoadMonth) return
    try {
      await onLoadMonth(`${date.slice(0, 7)}-01`)
    } catch {
      // The operation error is shown by the shared banner.
    }
  }

  function changeMonth(nextMonth: string) {
    setMonth(nextMonth)
    void refreshMatchMonth(nextMonth)
  }

  function renderMatch(match: Match) {
    const eligibleProfiles = activePlayers(profiles).filter((profile) => memberships.some((membership) => (
      membership.player_id === profile.id
      && membership.season_id === match.season_id
      && membershipCoversDate(membership, match.match_date)
    )))
    return (
      <MatchCard
        availability={availability.filter((item) => item.match_id === match.id)}
        eligiblePlayerCount={eligibleProfiles.length}
        canManage={canManage}
        canViewAvailability={canViewAvailability}
        isPlayer={isPlayer}
        key={match.id}
        lineup={lineups.filter((entry) => entry.match_id === match.id)}
        match={match}
        ownAvailability={availability.find(
          (item) => item.match_id === match.id && item.player_id === userId,
        )}
        onEdit={() => setFormMatch(match)}
        onManageLineup={() => setLineupMatch({ match, editable: true })}
        onSaveAvailability={async (...args) => {
          await onSaveAvailability(...args)
          await refreshMatchMonth(match.match_date)
        }}
        onViewAvailability={() => setAvailabilityMatch(match)}
        onViewLineup={() => setLineupMatch({ match, editable: canManage })}
      />
    )
  }

  return (
    <div className="page">
      <PageHeader
        action={(
          <div className="match-view-actions">
            {canViewReport && onLoadCallupReport && <button className={reportOpen ? 'primary-button' : 'secondary-button'} onClick={() => setReportOpen((open) => !open)} type="button"><Icon name="statistics" size={18} />{reportOpen ? 'Volver a partidos' : 'Resumen de convocatorias'}</button>}
            {!reportOpen && <button className="secondary-button" onClick={() => setManagementView((view) => view === 'calendar' ? 'list' : 'calendar')}><Icon name={managementView === 'calendar' ? 'tasks' : 'calendar'} size={18} />{managementView === 'calendar' ? 'Vista de lista' : 'Vista calendario'}</button>}
          </div>
        )}
        eyebrow="COMPETICIÓN"
        subtitle={canManage
          ? 'Planifica partidos, disponibilidad y alineaciones.'
          : isPlayer ? 'Indica tu disponibilidad y consulta la convocatoria.' : 'Consulta partidos, disponibilidad y convocatorias publicadas.'}
        title="Partidos"
      />

      {reportOpen && onLoadCallupReport ? <SeasonCallupReportView key={activeSeason?.id ?? 'no-active-season'} onLoad={onLoadCallupReport} onLoadPlayer={onLoadPlayerSeasonSummary} season={activeSeason} /> : managementView === 'calendar' ? (
        <MatchCalendarView
          canManage={canManage}
          matches={visibleMatches}
          month={month}
          renderMatch={renderMatch}
          selectedDate={selectedDate}
          selectedMatches={selectedMatches}
          selectedWeek={selectedWeek}
          onCreate={() => setFormMatch(null)}
          onGoToCurrentWeek={goToCurrentWeek}
          onMonthChange={changeMonth}
          onSelectDate={setSelectedDate}
        />
      ) : (
        <MatchListView
          currentWeek={currentWeek}
          currentWeekRef={currentWeekRef}
          canManage={canManage}
          renderMatch={renderMatch}
          weeks={weeks}
          onCreate={() => setFormMatch(null)}
        />
      )}

      {!reportOpen && formMatch !== undefined && (
        <MatchForm
          initialDate={managementView === 'calendar' ? selectedDate : today}
          match={formMatch ?? undefined}
          seasons={seasons}
          onCancel={() => setFormMatch(undefined)}
          onDelete={formMatch ? async (match) => {
            await onDelete(match)
            await refreshMatchMonth(match.match_date)
            setFormMatch(undefined)
          } : undefined}
          onSubmit={async (values) => {
            await onSaveMatch(formMatch ?? undefined, values)
            await refreshMatchMonth(values.matchDate)
            setSelectedDate(values.matchDate)
            setMonth(`${values.matchDate.slice(0, 7)}-01`)
            setFormMatch(undefined)
          }}
        />
      )}

      {lineupMatch && (
        <MatchLineupDialog
          availability={availability.filter((item) => item.match_id === lineupMatch.match.id)}
          entries={lineups.filter((entry) => entry.match_id === lineupMatch.match.id)}
          match={lineupMatch.match}
          memberships={memberships}
          profiles={profiles}
          onClose={() => setLineupMatch(null)}
          onUnlock={lineupMatch.editable && canUnlockLineup && onUnlockLineup ? async () => {
            await onUnlockLineup(lineupMatch.match)
            await refreshMatchMonth(lineupMatch.match.match_date)
          } : undefined}
          onSave={lineupMatch.editable ? async (entries, published) => {
            await onSaveLineup(lineupMatch.match, entries, published)
            await refreshMatchMonth(lineupMatch.match.match_date)
            setLineupMatch(null)
          } : undefined}
        />
      )}

      {availabilityMatch && (
        <MatchAvailabilityDialog
          availability={availability.filter((item) => item.match_id === availabilityMatch.id)}
          canEdit={canEditPlayerAvailability}
          eligibleProfiles={activePlayers(profiles).filter((profile) => memberships.some((membership) => (
            membership.player_id === profile.id
            && membership.season_id === availabilityMatch.season_id
            && membershipCoversDate(membership, availabilityMatch.match_date)
          )))}
          match={availabilityMatch}
          profiles={profiles}
          onClose={() => setAvailabilityMatch(null)}
          onSave={onSavePlayerAvailability ? async (playerId, status, comment) => {
            await onSavePlayerAvailability(availabilityMatch, playerId, status, comment)
            await refreshMatchMonth(availabilityMatch.match_date)
          } : undefined}
        />
      )}
    </div>
  )
}

function orderedMatches(matches: Match[]) {
  return [...matches].sort((first, second) => (
    first.match_date.localeCompare(second.match_date)
    || (first.kickoff_time ?? '').localeCompare(second.kickoff_time ?? '')
  ))
}

function groupMatchesByWeek(matches: Match[], currentWeek: string) {
  const weeks = new Map<string, Match[]>()
  weeks.set(currentWeek, [])
  for (const match of orderedMatches(matches)) {
    const week = mondayFor(match.match_date)
    weeks.set(week, [...(weeks.get(week) ?? []), match])
  }
  return [...weeks]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([weekStart, weekMatches]) => ({ weekStart, weekMatches }))
}

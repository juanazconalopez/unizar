import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/ui/PageHeader'
import { mondayFor, todayIso } from '../../lib/dates'
import type {
  AvailabilityStatus,
  Match,
  MatchAvailability,
  MatchLineup,
  MatchValues,
  Profile,
  Season,
  SeasonPlayer,
} from '../../types'
import { MatchAvailabilityDialog } from './MatchAvailabilityDialog'
import { MatchCalendarView } from './MatchCalendarView'
import { MatchCard } from './MatchCard'
import { MatchForm } from './MatchForm'
import { MatchLineupDialog } from './MatchLineupDialog'
import { MatchListView } from './MatchListView'

type MatchesViewProps = {
  availability: MatchAvailability[]
  isOwner: boolean
  lineups: MatchLineup[]
  matches: Match[]
  memberships: SeasonPlayer[]
  profiles: Profile[]
  seasons: Season[]
  userId: string
  onDelete: (match: Match) => Promise<void>
  onLoadMonth?: (month: string) => Promise<void>
  onSaveAvailability: (match: Match, status: AvailabilityStatus, comment: string) => Promise<void>
  onSaveLineup: (
    match: Match,
    entries: Omit<MatchLineup, 'match_id' | 'updated_at'>[],
    published: boolean,
  ) => Promise<void>
  onSaveMatch: (match: Match | undefined, values: MatchValues) => Promise<void>
}

export function MatchesView({
  availability,
  isOwner,
  lineups,
  matches,
  memberships,
  profiles,
  seasons,
  userId,
  onDelete,
  onLoadMonth,
  onSaveAvailability,
  onSaveLineup,
  onSaveMatch,
}: MatchesViewProps) {
  const today = todayIso()
  const currentWeek = mondayFor(today)
  const [managementView, setManagementView] = useState<'calendar' | 'list'>('calendar')
  const [selectedDate, setSelectedDate] = useState(today)
  const [month, setMonth] = useState(`${today.slice(0, 7)}-01`)
  const [formMatch, setFormMatch] = useState<Match | null | undefined>(undefined)
  const [lineupMatch, setLineupMatch] = useState<{ match: Match; editable: boolean } | null>(null)
  const [availabilityMatch, setAvailabilityMatch] = useState<Match | null>(null)
  const currentWeekRef = useRef<HTMLElement>(null)
  const visibleMatches = isOwner ? matches : matches.filter((match) => match.status !== 'draft')
  const selectedWeek = mondayFor(selectedDate)
  const selectedMatches = orderedMatches(
    visibleMatches.filter((match) => mondayFor(match.match_date) === selectedWeek),
  )
  const futureMatches = visibleMatches.filter((match) => match.match_date >= currentWeek)
  const weeks = groupMatchesByWeek(futureMatches, currentWeek)

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
    return (
      <MatchCard
        availability={availability.filter((item) => item.match_id === match.id)}
        isOwner={isOwner}
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
        onViewLineup={() => setLineupMatch({ match, editable: false })}
      />
    )
  }

  return (
    <div className="page">
      <PageHeader
        action={(
          <button
            className="secondary-button"
            onClick={() => setManagementView((view) => view === 'calendar' ? 'list' : 'calendar')}
          >
            <Icon name={managementView === 'calendar' ? 'tasks' : 'calendar'} size={18} />
            {managementView === 'calendar' ? 'Vista de lista' : 'Vista calendario'}
          </button>
        )}
        eyebrow="COMPETICIÓN"
        subtitle={isOwner
          ? 'Planifica partidos, disponibilidad y alineaciones.'
          : 'Indica tu disponibilidad y consulta la convocatoria.'}
        title="Partidos"
      />

      {managementView === 'calendar' ? (
        <MatchCalendarView
          isOwner={isOwner}
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
          isOwner={isOwner}
          renderMatch={renderMatch}
          weeks={weeks}
          onCreate={() => setFormMatch(null)}
        />
      )}

      {formMatch !== undefined && (
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
          match={availabilityMatch}
          profiles={profiles}
          onClose={() => setAvailabilityMatch(null)}
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

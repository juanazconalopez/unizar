import type { SavedReportEvent } from '../../services/matchReportService'
import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/ui/PageHeader'
import { useSeasonHolidayDates } from '../../hooks/useSeasonHolidayDates'
import { mondayFor, todayIso } from '../../lib/dates'
import { activePlayers, membershipCoversDate, seasonForDate } from '../../lib/selectors'
import { compareMatches } from '../../lib/seasonCompetitions'
import type {
  AvailabilityStatus,
  Match,
  MatchAvailability,
  MatchLineup,
  MatchValues,
  PlayerSeasonSummary,
  Profile,
  Season,
  SeasonCompetition,
  SeasonTeam,
  SeasonPlayer,
  SeasonCallupReport,
} from '../../types'
import { MatchAvailabilityDialog } from './MatchAvailabilityDialog'
import { MatchCalendarView } from './MatchCalendarView'
import { MatchCard } from './MatchCard'
import { MatchDetailDialog } from './MatchDetailDialog'
import { MatchForm } from './MatchForm'
import { MatchLineupDialog } from './MatchLineupDialog'
import { InternalFixtureReviewDialog } from './InternalFixtureReviewDialog'
import { visibleFixtureMatches } from './internalFixtures'
import { MatchListView } from './MatchListView'
import { SeasonCallupReportView } from './SeasonCallupReportView'

type MatchesViewProps = {
  availability: MatchAvailability[]
  demo?: boolean
  canEditPlayerAvailability?: boolean
  canManage: boolean
  canUnlockLineup?: boolean
  canViewAvailability: boolean
  isPlayer: boolean
  isOwner?: boolean
  lineups: MatchLineup[]
  matches: Match[]
  memberships: SeasonPlayer[]
  profiles: Profile[]
  seasons: Season[]
  seasonCompetitions?: SeasonCompetition[]
  seasonTeams?: SeasonTeam[]
  userId: string
  focusedDate?: string
  canViewReport?: boolean
  holidays?: string[]
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
  onSaveReport?: (match: Match, file: File, scores: { team: number; opponent: number }, duration: number, events: SavedReportEvent[], reviewed: boolean) => Promise<void>
  onUnlockLineup?: (match: Match) => Promise<void>
  onFinalizeInternal?: (match: Match) => Promise<void>
  onLoadCallupReport?: (seasonId: string) => Promise<SeasonCallupReport>
  onLoadPlayerSeasonSummary?: (seasonId: string, playerId: string) => Promise<PlayerSeasonSummary>
}

export function MatchesView({
  demo = false,
  availability,
  canEditPlayerAvailability = false,
  canManage,
  canUnlockLineup = false,
  canViewAvailability,
  isPlayer,
  isOwner = false,
  lineups,
  matches,
  memberships,
  profiles,
  seasons,
  seasonCompetitions = [],
  seasonTeams = [],
  userId,
  focusedDate,
  canViewReport = false,
  holidays: providedHolidays,
  onDelete,
  onLoadMonth,
  onSaveAvailability,
  onSavePlayerAvailability,
  onSaveLineup,
  onSaveMatch,
  onSaveReport,
  onUnlockLineup,
  onFinalizeInternal,
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
  const [reviewFixtureId, setReviewFixtureId] = useState<string | null>(null)
  const [detailMatch, setDetailMatch] = useState<Match | null>(null)
  const [availabilityMatch, setAvailabilityMatch] = useState<Match | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const holidays = useSeasonHolidayDates(seasons.map((season) => season.id), providedHolidays)
  const currentWeekRef = useRef<HTMLElement>(null)
  const visibleMatches = visibleFixtureMatches(canManage ? matches : matches.filter((match) => match.status !== 'draft'))
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
    const eligiblePlayerCount = activePlayers(profiles).filter((profile) => memberships.some((membership) => (
      membership.player_id === profile.id
      && membership.season_id === match.season_id
      && membershipCoversDate(membership, match.match_date)
    ))).length
    return (
      <MatchCard
        availability={availability.filter((item) => item.match_id === match.id)}
        canEditMatch={canManage}
        canViewAvailability={canViewAvailability}
        eligiblePlayerCount={eligiblePlayerCount}
        isPlayer={isPlayer}
        key={match.id}
        match={match}
        ownAvailability={availability.find(
          (item) => item.match_id === match.id && item.player_id === userId,
        )}
        onOpen={() => setDetailMatch(match)}
        onSaveAvailability={async (...args) => {
          await onSaveAvailability(...args)
          await refreshMatchMonth(match.match_date)
        }}
        onViewAvailability={() => setAvailabilityMatch(match)}
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
          holidays={holidays}
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
          competitions={seasonCompetitions}
          teams={seasonTeams}
          canManageInternal={isOwner}
          pairedMatch={matches.find((item) => item.id !== formMatch?.id && item.internal_fixture_id && item.internal_fixture_id === formMatch?.internal_fixture_id)}
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
          canExport={canManage || canViewReport}
          canPublish={!lineupMatch.match.internal_fixture_id}
          canBorrowFromOtherTeams={isOwner}
          demo={demo}
          entries={lineups.filter((entry) => entry.match_id === lineupMatch.match.id)}
          match={lineupMatch.match}
          memberships={memberships}
          profiles={profiles}
          seasonTeams={seasonTeams}
          reservedPlayerIds={lineups.filter((entry) => entry.match_id !== lineupMatch.match.id && matches.some((item) => item.id === entry.match_id && item.match_date === lineupMatch.match.match_date && (!lineupMatch.match.internal_fixture_id || item.internal_fixture_id !== lineupMatch.match.internal_fixture_id))).map((entry) => entry.player_id)}
          onClose={() => setLineupMatch(null)}
          onUnlock={lineupMatch.editable && canUnlockLineup && onUnlockLineup && (!lineupMatch.match.internal_fixture_id || isOwner) ? async () => {
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

      {detailMatch && <MatchDetailDialog
        canEditMatch={canManage && (!detailMatch.internal_fixture_id || isOwner)}
        canManageLineup={canManage}
        canViewAvailability={canViewAvailability}
        canViewReportPdf={canViewReport}
        isPlayer={isPlayer}
        lineup={lineups.filter((entry) => entry.match_id === detailMatch.id)}
        match={detailMatch}
        ownAvailability={availability.find((item) => item.match_id === detailMatch.id && item.player_id === userId)}
        profiles={profiles}
        onClose={() => setDetailMatch(null)}
        onEdit={() => { setDetailMatch(null); setFormMatch(detailMatch) }}
        onManageLineup={() => { setDetailMatch(null); setLineupMatch({ match: detailMatch, editable: true }) }}
        onReviewInternal={isOwner && detailMatch.internal_fixture_id ? () => { setReviewFixtureId(detailMatch.internal_fixture_id ?? null); setDetailMatch(null) } : undefined}
        onSaveAvailability={async (...args) => {
          await onSaveAvailability(...args)
          await refreshMatchMonth(detailMatch.match_date)
        }}
        onSaveReport={onSaveReport ? async (...args) => { await onSaveReport(...args); setDetailMatch(null); await refreshMatchMonth(detailMatch.match_date) } : undefined}
        onViewAvailability={() => { setDetailMatch(null); setAvailabilityMatch(detailMatch) }}
      />}

      {reviewFixtureId && isOwner && onFinalizeInternal && onUnlockLineup && (() => {
        const fixtureMatches = matches.filter((item) => item.internal_fixture_id === reviewFixtureId).sort((a, b) => Number(b.is_home) - Number(a.is_home))
        if (fixtureMatches.length !== 2) return null
        return <InternalFixtureReviewDialog matches={[fixtureMatches[0], fixtureMatches[1]]} lineups={lineups} profiles={profiles} onClose={() => setReviewFixtureId(null)} onEdit={(match) => { setReviewFixtureId(null); setLineupMatch({ match, editable: true }) }} onSave={onSaveLineup} onFinalize={onFinalizeInternal} onUnlock={onUnlockLineup} />
      })()}

      {availabilityMatch && (
        <MatchAvailabilityDialog
          availability={availability.filter((item) => item.match_id === availabilityMatch.id)}
          canEdit={canEditPlayerAvailability}
          eligibleProfiles={activePlayers(profiles).filter((profile) => memberships.some((membership) => (
            membership.player_id === profile.id
            && membership.season_id === availabilityMatch.season_id
            && membershipCoversDate(membership, availabilityMatch.match_date)
            && (isOwner || membership.season_team_id === availabilityMatch.team_id || seasonTeams.some((team) => team.id === membership.season_team_id && team.is_mixed))
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
  return [...matches].sort(compareMatches)
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

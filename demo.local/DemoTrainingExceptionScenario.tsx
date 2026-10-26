import { useState } from 'react'
import { MatchAvailabilityDialog } from '../src/features/matches/MatchAvailabilityDialog'
import { MatchLineupDialog } from '../src/features/matches/MatchLineupDialog'
import { MatchReportDialog } from '../src/features/matches/MatchReportDialog'
import { fixtureAvailability } from '../src/features/matches/internalFixtures'
import { matchLicenseRestriction, trainingExceptionCandidates } from '../src/lib/playerLicenses'
import type { MatchReportValues, SavedReportEvent } from '../src/lib/matchMinutes'
import type { Match, MatchAvailability, MatchLineup, Profile, SeasonPlayer } from '../src/types'

const stamp = '2026-09-01T10:00:00Z'
const leyreId = 'training-exception-leyre'
const people: Profile[] = ['A', 'B'].flatMap((team) => Array.from({ length: team === 'A' ? 16 : 17 }, (_, index) => {
  const slot = index + 1
  const names: Record<string, string> = { A2: 'Ana Lázaro', A16: 'Matilde Gurrea', B4: 'Izarbe Rodríguez', B6: 'Nerea Andrés', B16: 'Nuria Cabello', B17: 'Leyre Pérez Gimeno' }
  return { id: team === 'B' && slot === 17 ? leyreId : `training-${team}-${slot}`, display_name: names[`${team}${slot}`] ?? `Jugadora ${team} ${slot}`, avatar_path: null, playing_positions: [], primary_position: null, is_approved: true, is_active: true, is_archived: false, is_player: true, is_coach: false, is_owner: false, is_viewer: false, created_at: stamp }
}))
const memberships: SeasonPlayer[] = people.map((person) => ({ id: `membership-${person.id}`, season_id: 'training-season', player_id: person.id, active_from: '2026-09-01', active_until: null, created_at: stamp, license_type: person.id === leyreId ? 'training' : 'regional', season_team_id: person.id === leyreId ? null : person.id.startsWith('training-A') ? 'training-team-A' : 'training-team-B' }))
function makeMatch(side: 'A' | 'B', future = false): Match {
  return { id: future ? 'training-future' : `training-derby-${side}`, season_id: 'training-season', team_id: `training-team-${side}`, internal_fixture_id: future ? null : 'training-derby', opponent: future ? 'Equipo invitado' : `Unizar ${side === 'A' ? 'B' : 'A'}`, match_date: future ? '2026-11-07' : '2026-10-17', kickoff_time: '14:30:00', venue: 'Zaragoza', callup_time: null, callup_venue: null, is_home: side === 'A', notes: null, status: 'published', match_kind: 'official', rugby_format: 'xv', lineup_published: !future, created_by: 'owner', created_at: stamp, updated_at: stamp, seasons: { name: 'Temporada 2026/27' }, season_teams: { id: `training-team-${side}`, name: `Unizar ${side}`, is_mixed: false, is_default: side === 'A' } }
}
const initialMatches = [makeMatch('A'), makeMatch('B'), makeMatch('A', true)]
const initialLineups: MatchLineup[] = ['A', 'B'].flatMap((side) => people.filter((person) => person.id.startsWith(`training-${side}-`)).map((person, index) => ({ match_id: `training-derby-${side}`, player_id: person.id, slot_number: index + 1, sort_order: index + 1, role: index < 15 ? 'starter' : 'substitute', position: null, updated_at: stamp })))

export function DemoTrainingExceptionScenario({ isOwner }: { isOwner: boolean }) {
  const [matches, setMatches] = useState(initialMatches)
  const [lineups, setLineups] = useState(initialLineups)
  const [availability, setAvailability] = useState<MatchAvailability[]>([])
  const [events, setEvents] = useState<Record<string, SavedReportEvent[]>>({})
  const [availabilityId, setAvailabilityId] = useState<string | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [lineupOpen, setLineupOpen] = useState(false)
  const [home, away, future] = matches
  const selected = matches.find((match) => match.id === availabilityId)

  async function addPlayer(playerId: string, reason: string, slotNumber?: number) {
    if (!selected || !trainingExceptionCandidates(selected, memberships, people).some((person) => person.id === playerId)) throw new Error('Selecciona una jugadora de solo entrenamientos vinculada.')
    if (slotNumber && lineups.some((entry) => entry.match_id === selected.id && (entry.slot_number === slotNumber || entry.player_id === playerId))) throw new Error('El dorsal está ocupado o la jugadora ya está convocada.')
    setMatches((current) => current.map((match) => match.id === selected.id ? { ...match, training_exceptions: [{ player_id: playerId }], report_events_reviewed: false } : match))
    setAvailability((current) => [...current.filter((entry) => entry.match_id !== selected.id || entry.player_id !== playerId), { match_id: selected.id, player_id: playerId, status: 'available', comment: reason || null, updated_at: new Date().toISOString() }])
    if (slotNumber) setLineups((current) => [...current, { match_id: selected.id, player_id: playerId, slot_number: slotNumber, sort_order: slotNumber, role: slotNumber <= 15 ? 'starter' : 'substitute', position: null, updated_at: stamp }])
  }
  async function saveReport(homeMatch: Match, awayMatch: Match, homeValues: MatchReportValues, awayValues: MatchReportValues) {
    setEvents((current) => ({ ...current, [homeMatch.id]: homeValues.events, [awayMatch.id]: awayValues.events }))
    setMatches((current) => current.map((match) => {
      const values = match.id === homeMatch.id ? homeValues : match.id === awayMatch.id ? awayValues : null
      return values ? { ...match, team_score: values.scores.team, opponent_score: values.scores.opponent, duration_minutes: values.duration, report_events_reviewed: true, status: 'completed' } : match
    }))
  }

  return <section className="demo-internal-match-card" aria-label="Escenario de solo entrenamientos">
    <span className="eyebrow">ESCENARIO DE PRUEBA</span><h2>Participación excepcional de solo entrenamientos</h2>
    <p>Leyre Pérez Gimeno conserva Solo entrenamientos. El derbi del 17 de octubre empieza con su dorsal 17 pendiente en el B.</p>
    <button className="secondary-button" onClick={() => setAvailabilityId(away.id)} type="button">Disponibilidad del derbi de prueba</button>
    <button className="secondary-button" onClick={() => setAvailabilityId(future.id)} type="button">Disponibilidad del próximo partido de prueba</button>
    <button className="secondary-button" onClick={() => setLineupOpen(true)} type="button">Preparar convocatoria del próximo partido de prueba</button>
    {isOwner && <button className="secondary-button" onClick={() => setReportOpen(true)} type="button">Resultado y minutos del derbi de prueba</button>}
    {selected && <MatchAvailabilityDialog key={selected.id} availability={fixtureAvailability(selected, matches, availability)} canEdit eligibleProfiles={people.filter((person) => !matchLicenseRestriction(selected, memberships, person.id))} match={selected} profiles={people} lineup={lineups.filter((entry) => entry.match_id === selected.id)} trainingProfiles={trainingExceptionCandidates(selected, memberships, people)} pairedMatch={selected.internal_fixture_id ? matches.find((match) => match.id !== selected.id && match.internal_fixture_id === selected.internal_fixture_id) : undefined} onSelectMatch={(match) => setAvailabilityId(match.id)} onAddTrainingPlayer={addPlayer} onClose={() => setAvailabilityId(null)} />}
    {reportOpen && <MatchReportDialog match={home} pairedMatch={away} lineup={lineups.filter((entry) => entry.match_id === home.id)} pairedLineup={lineups.filter((entry) => entry.match_id === away.id)} profiles={people} onClose={() => setReportOpen(false)} onLoadEvents={async (matchId) => events[matchId] ?? []} onSave={async () => undefined} onSaveDerby={saveReport} />}
    {lineupOpen && <MatchLineupDialog demo canBorrowFromOtherTeams={isOwner} availability={availability.filter((entry) => entry.match_id === future.id)} entries={lineups.filter((entry) => entry.match_id === future.id)} match={future} memberships={memberships} profiles={people} onClose={() => setLineupOpen(false)} onSave={async (entries, published) => {
      if (entries.some((entry) => matchLicenseRestriction(future, memberships, entry.player_id))) throw new Error('Revisa la ficha de la jugadora.')
      setLineups((current) => [...current.filter((entry) => entry.match_id !== future.id), ...entries.map((entry) => ({ ...entry, match_id: future.id, updated_at: stamp }))])
      setMatches((current) => current.map((match) => match.id === future.id ? { ...match, lineup_published: published } : match))
      setLineupOpen(false)
    }} />}
  </section>
}

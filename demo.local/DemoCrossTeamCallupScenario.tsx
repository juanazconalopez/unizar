import { useState } from 'react'
import { crossTeamCallupReference, crossTeamCallupRestriction } from '../src/lib/crossTeamCallups'
import { MatchLineupDialog } from '../src/features/matches/MatchLineupDialog'
import type { Match, MatchLineup, Profile, SeasonPlayer, SeasonTeam } from '../src/types'
import { initialProfiles } from './mockData'

const stamp = '2026-09-01T12:00:00Z'
const names = ['Alba Ruiz', 'Berta López', 'Celia Martín', 'Diana Pérez', 'Elena Gil', 'Fátima Sanz', 'Gloria Vidal', 'Helena Mora']
const profiles: Profile[] = names.map((name, index) => ({ ...initialProfiles[3], id: `shared-${index}`, display_name: name, playing_positions: [], primary_position: null }))
const teams: SeasonTeam[] = ['A', 'B'].map((name) => ({ id: `limit-${name}`, season_id: 'limit-season', name: `Unizar ${name}`, color: name === 'A' ? 'purple' : 'green', is_mixed: false, is_default: name === 'A', is_active: true, created_by: 'owner', created_at: stamp, updated_at: stamp }))
const memberships: SeasonPlayer[] = profiles.map((profile) => ({ id: `limit-${profile.id}`, player_id: profile.id, season_id: 'limit-season', season_team_id: 'limit-B', active_from: '2026-09-01', active_until: null, license_type: 'regional', created_at: stamp }))
const match: Match = {
  id: 'limit-B-next', season_id: 'limit-season', team_id: 'limit-B', competition_id: 'limit-league', match_date: '2026-10-18', kickoff_time: '12:00:00', opponent: 'Rival de liga',
  venue: null, callup_time: null, callup_venue: null, is_home: true, notes: null, status: 'published', match_kind: 'official', rugby_format: 'xv', lineup_published: false,
  created_by: 'owner', created_at: stamp, updated_at: stamp, seasons: { name: 'Temporada de ejemplo' }, season_teams: teams[1],
  season_competitions: { id: 'limit-league', name: 'Liga de ejemplo', color: 'purple', is_default: true, restrict_cross_team_callups: true },
}
const previous: Match = { ...match, id: 'limit-A-last', team_id: 'limit-A', match_date: '2026-10-11', season_teams: teams[0], status: 'completed', report_events_reviewed: true, lineup_published: true }
const previousLineup: MatchLineup[] = profiles.map((profile, index) => ({ match_id: previous.id, player_id: profile.id, role: index === 7 ? 'substitute' : 'starter', slot_number: index === 7 ? 16 : index + 1, position: null, sort_order: index + 1, updated_at: stamp }))

export function DemoCrossTeamCallupScenario() {
  const [open, setOpen] = useState(false)
  const [confirmed, setConfirmed] = useState(true)
  const [published, setPublished] = useState(false)
  const [entries, setEntries] = useState<MatchLineup[]>(previousLineup.map((entry, index) => ({ ...entry, match_id: match.id, role: 'starter', slot_number: index + 1 })))
  const current = { ...match, lineup_published: published }
  const reference = crossTeamCallupReference(current, [{ ...previous, report_events_reviewed: confirmed }], previousLineup, true)
  return <section className="panel cross-team-callup-demo">
    <h2>Límite de siete entre equipos</h2>
    <p>Ejemplo: preparar la convocatoria del B después del acta del A, incluidas sus suplentes.</p>
    <label className="cross-team-callup-option"><input checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" />Acta anterior del A confirmada</label>
    <button className="secondary-button" onClick={() => setOpen(true)} type="button">Preparar convocatoria con límite de siete</button>
    {open && <MatchLineupDialog availability={profiles.map((profile) => ({ match_id: match.id, player_id: profile.id, status: 'available', comment: null, updated_at: stamp }))}
      canExport={false} demo demoCallupReference={reference} entries={entries} match={current} memberships={memberships} profiles={profiles} seasonTeams={teams}
      onClose={() => setOpen(false)} onUnlock={async () => { setPublished(false); setOpen(false) }}
      onSave={async (draft, publish) => {
        if (publish) { const error = crossTeamCallupRestriction(reference, draft.map((entry) => entry.player_id)); if (error) throw new Error(error) }
        setEntries(draft.map((entry) => ({ ...entry, match_id: match.id, updated_at: stamp }))); setPublished(publish); setOpen(false)
      }} />}
  </section>
}

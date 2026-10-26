import { useState } from 'react'
import { fixtureAvailability, reservedLineupPlayerIds } from '../src/features/matches/internalFixtures'
import { InternalFixtureReviewDialog } from '../src/features/matches/InternalFixtureReviewDialog'
import { MatchLineupDialog } from '../src/features/matches/MatchLineupDialog'
import { LineupGraphicDialog } from '../src/features/matches/LineupGraphicDialog'
import { MatchDetailDialog } from '../src/features/matches/MatchDetailDialog'
import type { Match, MatchAvailability, MatchLineup, Profile, SeasonPlayer, SeasonTeam } from '../src/types'

type DemoTeam = 'a' | 'b' | 'mixed'
type DemoAvailability = 'available' | 'doubt' | 'unavailable' | 'no-response'
type DemoPlayer = { id: string; name: string; team: DemoTeam; minutes: number; availability: DemoAvailability }
const TEAM_NAMES: Record<DemoTeam, string> = { a: 'Unizar A', b: 'Unizar B', mixed: 'Mixto' }
const PLAYERS: DemoPlayer[] = [
  ['a', 'Aitana Ruiz', 620, 'available'], ['a', 'Nora Martín', 580, 'available'], ['a', 'Irene López', 510, 'available'],
  ['a', 'Claudia Calvo', 470, 'available'], ['a', 'Marta Sanz', 420, 'available'], ['a', 'Paula Gil', 390, 'available'],
  ['a', 'Lucía Torres', 350, 'available'], ['a', 'Elena Pascual', 330, 'available'], ['a', 'Vega Romero', 290, 'available'],
  ['a', 'Inés Navarro', 260, 'available'], ['a', 'Sara Martín', 230, 'available'], ['a', 'Noa Ferrer', 210, 'available'],
  ['a', 'Julia Ríos', 180, 'doubt'], ['a', 'Celia Marín', 145, 'no-response'], ['a', 'Adriana Gil', 90, 'unavailable'],
  ['b', 'Alba Sánchez', 610, 'available'], ['b', 'Marina López', 560, 'available'], ['b', 'Carmen Vera', 530, 'available'],
  ['b', 'Nerea Calvo', 480, 'available'], ['b', 'Ariadna Soler', 440, 'available'], ['b', 'Teresa Gil', 400, 'available'],
  ['b', 'Mónica Rivas', 370, 'available'], ['b', 'Daniela Pardo', 340, 'available'], ['b', 'Eva Martín', 300, 'available'],
  ['b', 'Lara Sanz', 270, 'available'], ['b', 'Ainhoa Pérez', 240, 'available'], ['b', 'Rocío Vidal', 200, 'available'],
  ['b', 'Leire Gómez', 160, 'doubt'], ['b', 'Alicia Mora', 120, 'no-response'], ['b', 'Mara Ortega', 80, 'unavailable'],
  ['mixed', 'Patricia León', 500, 'available'], ['mixed', 'Ane Martín', 315, 'available'], ['mixed', 'Olga Ruiz', 190, 'available'],
  ['mixed', 'Candela Gil', 110, 'doubt'], ['mixed', 'Sofía Roca', 75, 'no-response'], ['mixed', 'Miriam Soler', 40, 'unavailable'],
].map(([team, name, minutes, availability], index) => ({ id: `internal-player-${index + 1}`, team: team as DemoTeam, name: name as string, minutes: minutes as number, availability: availability as DemoAvailability }))


const STAMP = '2026-09-01T10:00:00Z'
const teamIds: Record<DemoTeam, string> = { a: 'demo-team-a', b: 'demo-team-b', mixed: 'demo-team-mixed' }
const teams = (Object.keys(teamIds) as DemoTeam[]).map((side) => ({ id: teamIds[side], season_id: 'demo-season', name: TEAM_NAMES[side], color: side === 'a' ? 'purple' : side === 'b' ? 'green' : 'blue', is_mixed: side === 'mixed', is_default: side === 'a', is_active: true, created_by: 'owner', created_at: STAMP, updated_at: STAMP })) as SeasonTeam[]
const profiles: Profile[] = PLAYERS.map((player) => ({ id: player.id, display_name: player.name, avatar_path: null, playing_positions: [], primary_position: null, is_approved: true, is_active: true, is_archived: false, is_player: true, is_coach: false, is_owner: false, is_viewer: false, created_at: STAMP }))
const memberships: SeasonPlayer[] = PLAYERS.map((player) => ({ id: `membership-${player.id}`, season_id: 'demo-season', player_id: player.id, season_team_id: teamIds[player.team], active_from: '2026-09-01', active_until: null, created_at: STAMP }))

const graphicStaff: Profile[] = [
  { id: 'demo-graphic-coach', display_name: 'Andrea López', avatar_path: null, playing_positions: [], primary_position: null, is_approved: true, is_active: true, is_archived: false, is_player: false, is_coach: true, is_owner: false, is_viewer: false, created_at: STAMP },
  { id: 'demo-graphic-owner', display_name: 'Lucía Martín', avatar_path: null, playing_positions: [], primary_position: null, is_approved: true, is_active: true, is_archived: false, is_player: false, is_coach: false, is_owner: true, is_viewer: false, created_at: STAMP },
]
const graphicProfiles = [...profiles.map((profile, index) => index < 6 ? { ...profile, avatar_path: `demo-photo-${index + 1}` } : profile), ...graphicStaff]
const graphicLineup: MatchLineup[] = [...PLAYERS.filter((player) => player.team === 'a').slice(0, 15), ...PLAYERS.filter((player) => player.team === 'mixed').slice(0, 3)]
  .map((player, index) => ({ match_id: 'demo-derby-a', player_id: player.id, role: index < 15 ? 'starter' : 'substitute', position: null, slot_number: index + 1, sort_order: index + 1, updated_at: STAMP }))
const graphicSevensLineup: MatchLineup[] = graphicLineup.slice(0, 9).map((entry) => ({ ...entry, role: entry.slot_number <= 7 ? 'starter' : 'substitute' }))
const graphicCoaches = graphicStaff.map((profile) => ({ season_team_id: teamIds.a, coach_id: profile.id, role: 'head_coach' as const, created_at: STAMP }))
function demoGraphicPhoto(path: string) {
  const index = Number(path.match(/\d+/)?.[0] ?? 1)
  const shirts = ['#14846d', '#0f6e8a', '#b72d5c', '#197555', '#d1a63c', '#4b729b']
  const shirt = shirts[(index - 1) % shirts.length]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" fill="#ffffff"/><circle cx="80" cy="59" r="31" fill="#d7aa8b"/><path d="M25 160c4-42 27-61 55-61s51 19 55 61" fill="${shirt}"/><path d="M48 34c13-24 47-25 64 0" fill="none" stroke="#46352e" stroke-width="13" stroke-linecap="round"/></svg>`
  return Promise.resolve(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
}
const demoMinutes = new Map(PLAYERS.map((player) => [player.id, player.minutes]))

function demoMatch(side: 'a' | 'b', published: boolean): Match {
  return { id: `demo-derby-${side}`, season_id: 'demo-season', team_id: teamIds[side], internal_fixture_id: 'demo-derby', opponent: TEAM_NAMES[side === 'a' ? 'b' : 'a'], match_date: '2026-10-10', kickoff_time: '12:00:00', venue: 'CDM David Cañada', callup_time: null, callup_venue: null, is_home: side === 'a', notes: null, status: 'published', match_kind: 'official', rugby_format: 'xv', lineup_published: published, created_by: 'owner', created_at: STAMP, updated_at: STAMP, seasons: { name: 'Temporada 2026' }, season_teams: { id: teamIds[side], name: TEAM_NAMES[side], color: side === 'a' ? 'purple' : side === 'b' ? 'green' : 'blue', is_mixed: false, is_default: side === 'a' } }
}

export function DemoInternalMatchScenario({ isOwner }: { isOwner: boolean }) {
  const [open, setOpen] = useState(false)
  const [graphicOpen, setGraphicOpen] = useState<'xv' | 'sevens' | null>(null)
  const [publishedDetailOpen, setPublishedDetailOpen] = useState(false)
  const [editing, setEditing] = useState<'a' | 'b' | null>(null)
  const [lineups, setLineups] = useState<Record<'a' | 'b', MatchLineup[]>>({ a: [], b: [] })
  const [published, setPublished] = useState(false)
  const [forcedAvailable, setForcedAvailable] = useState<string[]>([])
  const matches: [Match, Match] = [demoMatch('a', published), demoMatch('b', published)]
  const entries = [...lineups.a, ...lineups.b]
  const availability: MatchAvailability[] = [matches[0]].flatMap((match) => PLAYERS.map((player) => ({ match_id: match.id, player_id: player.id, status: player.availability === 'available' || forcedAvailable.includes(player.id) ? 'available' : player.availability === 'doubt' ? 'doubt' : 'unavailable', comment: null, updated_at: STAMP })))

  async function save(match: Match, draft: Omit<MatchLineup, 'match_id' | 'updated_at'>[]) {
    const side = match.id === matches[0].id ? 'a' : 'b'
    setLineups((current) => ({ ...current, [side]: draft.map((entry) => ({ ...entry, match_id: match.id, updated_at: STAMP })) }))
  }

  return <section className="demo-internal-match-card" aria-label="Escenario de partido entre equipos del club">
    <div><span className="eyebrow">ESCENARIO DE PRUEBA</span><h2>Derbi Unizar: Unizar A vs Unizar B</h2><p>Partido oficial · Liga Aragonesa · XV · Sábado 10 de octubre, 12:00 · CDM David Cañada</p></div>
    <div className="demo-internal-match-summary"><span>{lineups.a.length} propuestas A</span><span>{lineups.b.length} propuestas B</span><span>{published ? 'Publicadas' : 'Borradores'}</span></div>
    <button className="primary-button" onClick={() => { if (isOwner) setOpen(true); else setEditing('a') }} type="button">Gestionar convocatorias del derbi</button>
    {published && <button className="secondary-button" onClick={() => setPublishedDetailOpen(true)} type="button">Ver convocatorias publicadas</button>}
    <button className="secondary-button" onClick={() => setGraphicOpen('xv')} type="button">Ver ejemplo gráfico XV</button>
    <button className="secondary-button" onClick={() => setGraphicOpen('sevens')} type="button">Ver ejemplo gráfico 7s</button>
    {publishedDetailOpen && <MatchDetailDialog canEditMatch={false} canManageLineup={false} canViewAvailability={false} demo demoCoaches={graphicCoaches} isPlayer={false} lineup={lineups.a} match={matches[0]} pairedLineup={lineups.b} pairedMatch={matches[1]} profiles={graphicProfiles} onClose={() => setPublishedDetailOpen(false)} onEdit={() => undefined} onLoadGraphicPhoto={demoGraphicPhoto} onManageLineup={() => undefined} onViewAvailability={() => undefined} />}
    {graphicOpen && <LineupGraphicDialog demo demoCoaches={graphicCoaches} entries={graphicOpen === 'sevens' ? graphicSevensLineup : graphicLineup} match={{ ...demoMatch('a', true), rugby_format: graphicOpen }} onClose={() => setGraphicOpen(null)} onLoadPhoto={demoGraphicPhoto} profiles={graphicProfiles} />}
    {!published && <div className="demo-internal-exceptions"><h4>Disponibilidad pendiente</h4><p>Como en producción, el staff debe registrar una disponibilidad antes de incorporar a la jugadora.</p>{PLAYERS.filter((player) => player.availability !== 'available' && !forcedAvailable.includes(player.id) && (isOwner || player.team === 'a' || player.team === 'mixed')).map((player) => <div key={player.id}><span>{player.name} · {TEAM_NAMES[player.team]}</span><button className="secondary-button compact" onClick={() => setForcedAvailable((current) => [...current, player.id])} type="button">Forzar disponibilidad</button></div>)}</div>}
    {open && isOwner && <InternalFixtureReviewDialog demo matches={matches} lineups={entries} profiles={profiles} onClose={() => setOpen(false)} onEdit={(match) => { setOpen(false); setEditing(match.id === matches[0].id ? 'a' : 'b') }} onSave={save} onFinalize={async () => { setPublished(true) }} onUnlock={async () => { setPublished(false) }} />}
    {editing && <MatchLineupDialog availability={fixtureAvailability(matches[editing === 'a' ? 0 : 1], matches, availability)} canBorrowFromOtherTeams={isOwner} canExport={false} canPublish={false} demo demoMinutes={demoMinutes} reservedPlayerIds={reservedLineupPlayerIds(matches[editing === 'a' ? 0 : 1], matches, entries)} entries={lineups[editing]} match={matches[editing === 'a' ? 0 : 1]} memberships={memberships} profiles={profiles} seasonTeams={teams} onClose={() => setEditing(null)} onSave={async (draft) => { await save(matches[editing === 'a' ? 0 : 1], draft); setEditing(null); if (isOwner) setOpen(true) }} />}
  </section>
}

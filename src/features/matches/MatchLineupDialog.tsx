import { crossTeamCallupRestriction } from '../../lib/crossTeamCallups'
import type { CrossTeamCallupReference } from '../../lib/crossTeamCallups'
import { useCrossTeamCallupReference } from '../../hooks/useCrossTeamCallupReference'
import { CrossTeamCallupStatus } from './CrossTeamCallupStatus'
import { groupPlayersByPosition } from '../../lib/playerPositions'
import type { SavePlayerPositions } from '../../lib/playerPositions'
import { PlayerPositionSummary } from '../../components/PlayerPositionSummary'
import { TeamMemberDialog } from '../team/TeamMemberDialog'
import { matchLicenseRestriction } from '../../lib/playerLicenses'
import { Fragment, useEffect, useId, useState } from 'react'
import type { DragEvent } from 'react'
import { Icon } from '../../components/Icon'
import { Avatar } from '../../components/ui/Avatar'
import { Modal } from '../../components/ui/Modal'
import { errorText } from '../../lib/errors'
import { copyText, downloadText } from '../../lib/fileExport'
import { lineupPlainText, lineupXml } from '../../lib/matchExports'
import { activePlayers, membershipCoversDate } from '../../lib/selectors'
import type { Match, MatchAvailability, MatchLineup, Profile, Season, SeasonPlayer, SeasonTeam, SeasonTeamCoach } from '../../types'
import { matchLogistics, matchTitle } from './matchPresentation'
import { orderedLineupCandidates } from './lineupCandidates'
import { fetchSeasonPlayerMinutes } from '../../services/matchesService'
import { LineupGraphicDialog } from './LineupGraphicDialog'

export function MatchLineupDialog({ availability, canExport = true, canGraphicExport = false, canPublish = true, canBorrowFromOtherTeams = true, demo = false, demoCoaches, demoMinutes, demoCallupReference, onLoadGraphicPhoto, onSavePositions, activeSeason, entries, match, memberships, profiles, seasonTeams = [], reservedPlayerIds = [], onClose, onSave, onUnlock }: {
  availability: MatchAvailability[]
  canExport?: boolean
  canGraphicExport?: boolean
  canPublish?: boolean
  canBorrowFromOtherTeams?: boolean
  demo?: boolean
  demoCoaches?: SeasonTeamCoach[]
  demoMinutes?: Map<string, number>
  demoCallupReference?: CrossTeamCallupReference
  onLoadGraphicPhoto?: (path: string) => Promise<string>
  onSavePositions?: SavePlayerPositions
  activeSeason?: Season
  entries: MatchLineup[]
  match: Match
  memberships: SeasonPlayer[]
  profiles: Profile[]
  seasonTeams?: SeasonTeam[]
  reservedPlayerIds?: string[]
  onClose: () => void
  onSave?: (entries: Omit<MatchLineup, 'match_id' | 'updated_at'>[], published: boolean) => Promise<void>
  onUnlock?: () => Promise<void>
}) {
  const titleId = useId()
  const [profilePlayerId, setProfilePlayerId] = useState<string | null>(null)
  const [locked, setLocked] = useState(match.lineup_published)
  const editable = Boolean(onSave) && !locked
  const limit = lineupLimit(match)
  const starters = match.rugby_format === 'sevens' ? 7 : 15
  const eligible = activePlayers(profiles).filter((profile) => memberships.some((membership) => (
    membership.player_id === profile.id && membership.season_id === match.season_id && membershipCoversDate(membership, match.match_date)
  )) && !matchLicenseRestriction(match, memberships, profile.id))
  const availableIds = new Set(availability.filter((item) => item.status === 'available').map((item) => item.player_id))
  const [slots, setSlots] = useState<Record<number, string>>(() => Object.fromEntries(
    entries
      .filter((entry) => !editable || availableIds.has(entry.player_id))
      .map((entry) => [entry.slot_number, entry.player_id]),
  ))
  const [published, setPublished] = useState(match.lineup_published)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmMissing, setConfirmMissing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [graphicOpen, setGraphicOpen] = useState(false)
  const [confirmUnlock, setConfirmUnlock] = useState(false)
  const [minutesByPlayer, setMinutesByPlayer] = useState<Map<string, number>>(demoMinutes ?? new Map())
  const selectedIds = new Set(Object.values(slots))
  const callupCheck = useCrossTeamCallupReference(match.id,
    Boolean(onSave || onUnlock) && match.match_kind === 'official' && match.season_competitions?.restrict_cross_team_callups === true,
    demo, demoCallupReference)
  const callupRestriction = callupCheck.reference ? crossTeamCallupRestriction(callupCheck.reference, selectedIds) : null
  const publicationBlocked = callupCheck.loading || Boolean(callupCheck.error || callupRestriction)
  const reservedIds = new Set(reservedPlayerIds)
  const selectable = orderedLineupCandidates(eligible, memberships, seasonTeams, match.season_id, match.team_id)
    .filter((player) => availableIds.has(player.id) && !selectedIds.has(player.id) && !reservedIds.has(player.id) && (canBorrowFromOtherTeams || player.priority < 2 || (match.match_kind === 'friendly' && player.teamName === 'Sin equipo')))
  const selectableTeams = [...new Set(selectable.map((player) => player.teamName))].map((name) => ({ name, players: selectable.filter((player) => player.teamName === name) }))
  const containsBorrowedPlayer = !canBorrowFromOtherTeams && Object.values(slots).some((playerId) => {
    const membership = memberships.find((item) => item.season_id === match.season_id && item.player_id === playerId && membershipCoversDate(item, match.match_date))
    return membership && !(match.match_kind === 'friendly' && !membership.season_team_id) && membership.season_team_id !== match.team_id && !seasonTeams.some((team) => team.id === membership.season_team_id && team.is_mixed)
  })

  useEffect(() => {
    if (demo) return
    let active = true
    void fetchSeasonPlayerMinutes(match.season_id).then((minutes) => { if (active) setMinutesByPlayer(minutes) }).catch(() => undefined)
    return () => { active = false }
  }, [demo, match.season_id])

  function assign(playerId: string, slot: number) {
    setSlots((current) => {
      const sourceKey = Object.keys(current).find((key) => current[Number(key)] === playerId)
      const source = sourceKey ? Number(sourceKey) : null
      if (source === slot || current[slot]) return current
      const next = { ...current }
      if (source !== null) delete next[source]
      next[slot] = playerId
      return next
    })
  }

  function drop(event: DragEvent, slot: number) {
    event.preventDefault()
    const playerId = event.dataTransfer.getData('text/player-id')
    if (playerId && !slots[slot]) assign(playerId, slot)
  }

  async function save(confirmed = false) {
    if (!onSave) return
    const blocked = Object.values(slots).find((playerId) => matchLicenseRestriction(match, memberships, playerId))
    if (blocked) { setError(matchLicenseRestriction(match, memberships, blocked) ?? 'Revisa las fichas de la convocatoria.'); return }
    if (published && publicationBlocked) { setError(callupCheck.error ?? callupRestriction ?? 'Espera a que se compruebe el acta anterior.'); return }
    const missingStarters = Array.from({ length: starters }, (_, index) => index + 1).filter((slot) => !slots[slot])
    if (published && missingStarters.length && !confirmed) { setConfirmMissing(true); return }
    setSaving(true); setError('')
    const lineup = Object.entries(slots).map(([slotValue, player_id]) => {
      const slot_number = Number(slotValue)
      return { player_id, slot_number, role: slot_number <= starters ? 'starter' as const : 'substitute' as const, position: null, sort_order: slot_number }
    }).sort((first, second) => first.slot_number - second.slot_number)
    try { await onSave(lineup, published) } catch (caught) { setError(errorText(caught)); setSaving(false) }
  }

  async function copyLineup() {
    try {
      await copyText(lineupPlainText(match, entries, profiles))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch (caught) {
      setError(errorText(caught))
    }
  }

  async function unlock() {
    if (!onUnlock) return
    setSaving(true); setError('')
    try {
      await onUnlock()
      setLocked(false)
      setPublished(false)
      setConfirmUnlock(false)
      setSaving(false)
    } catch (caught) {
      setError(errorText(caught))
      setConfirmUnlock(false)
      setSaving(false)
    }
  }

  if (graphicOpen) return <LineupGraphicDialog demo={demo} demoCoaches={demoCoaches} entries={entries} match={match} onClose={() => setGraphicOpen(false)} onLoadPhoto={onLoadGraphicPhoto} profiles={profiles} />

  const profilePlayer = profiles.find((player) => player.id === profilePlayerId)
  if (profilePlayer && onSavePositions) return <TeamMemberDialog person={{ ...profilePlayer, avatar_path: null }} showPrivateDetails={false} activeSeason={activeSeason} memberships={memberships} teams={seasonTeams} currentUserId="" possibleMatches={[]} onSavePositions={onSavePositions} onClose={() => setProfilePlayerId(null)} />

  return <Modal className="lineup-dialog" disabled={saving} labelledBy={titleId} onClose={onClose}>
    <div className="task-detail-heading"><div><span className="eyebrow">{editable ? 'GESTIONAR ALINEACIÓN' : 'CONVOCATORIA'}</span><h2 id={titleId}>{matchTitle(match)}</h2><p>{matchLogistics(match)} · {Object.keys(slots).length}/{limit} jugadoras</p></div><button aria-label="Cerrar" className="icon-button" onClick={onClose}>×</button></div>
    {callupCheck.loading && <p className="form-hint">Comprobando el acta anterior del otro equipo…</p>}
    {callupCheck.error && <p className="form-error" role="alert">No se puede publicar: {callupCheck.error} Puedes guardar el borrador.</p>}
    {callupCheck.reference && <CrossTeamCallupStatus reference={callupCheck.reference} playerIds={selectedIds} profiles={profiles} />}
    {editable ? <div className="lineup-board">
      <section className="available-player-pool"><h3>Disponibles</h3><p>{canBorrowFromOtherTeams ? 'Equipo del partido, mixto y después el resto de equipos.' : 'Equipo del partido y mixto. El owner gestiona los préstamos.'}</p><div>{selectableTeams.map((team) => <Fragment key={team.name}><h4 className={`lineup-team-group priority-${team.players[0].priority}`}>{team.name}{team.players[0].priority === 0 ? ' · Prioridad' : team.players[0].priority === 1 ? ' · Mixto' : ''}</h4>{groupPlayersByPosition(team.players).filter((group) => group.players.length > 0).map((group) => <Fragment key={group.value}><h5 className="playing-position-heading">{group.label}{' '}<small>{group.players.length}</small></h5>{group.players.map((player) => <article draggable key={player.id} onDragStart={(event) => event.dataTransfer.setData('text/player-id', player.id)}><Avatar name={player.display_name} /><span>{onSavePositions ? <button aria-label={`Datos de perfil de ${player.display_name}`} className="player-profile-link" onClick={() => setProfilePlayerId(player.id)} type="button">{player.display_name}</button> : <strong>{player.display_name}</strong>}<small>{minutesByPlayer.get(player.id) ?? 0} min esta temporada</small></span><button className="secondary-button compact" onClick={() => { const empty = Array.from({ length: limit }, (_, index) => index + 1).find((slot) => !slots[slot]); if (empty) assign(player.id, empty) }} type="button">Añadir</button></article>)}</Fragment>)}</Fragment>)}{!selectable.length && <span className="lineup-empty">No quedan jugadoras disponibles sin asignar.</span>}</div></section>
      <section className="numbered-lineup"><h3>Alineación</h3><PlayerPositionSummary players={[...selectedIds].map((id) => profiles.find((player) => player.id === id) ?? { primary_position: null })} /><p className="lineup-reorder-help">Arrastra cada jugadora a un dorsal libre. Para cambiarlo después, elige otro dorsal libre; si está ocupado, quita primero a su jugadora.</p><div className="lineup-section-label">Titulares</div>{Array.from({ length: limit }, (_, index) => index + 1).map((slot) => {
        const playerId = slots[slot]
        const player = eligible.find((item) => item.id === playerId) ?? profiles.find((item) => item.id === playerId)
        const availableSlots = Array.from({ length: limit }, (_, option) => option + 1).filter((option) => option === slot || !slots[option])
        return <div className={`lineup-slot ${player ? 'filled' : ''}`} key={slot} onDragOver={(event) => { if (!slots[slot]) event.preventDefault() }} onDrop={(event) => drop(event, slot)}>
          {slot === starters + 1 && <span className="lineup-section-label substitutes">Suplentes</span>}
          <b>{slot}</b>{player ? <>
            <div className="lineup-player-identity" draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/player-id', player.id) }}><Avatar name={player.display_name} />{onSavePositions ? <button aria-label={`Datos de perfil de ${player.display_name}`} className="player-profile-link" onClick={() => setProfilePlayerId(player.id)} type="button">{player.display_name}</button> : <strong>{player.display_name}</strong>}</div>
            <button aria-label={`Quitar a ${player.display_name}`} className="icon-button lineup-remove-button" onClick={() => setSlots((current) => { const next = { ...current }; delete next[slot]; return next })} type="button">×</button>
            <label className="lineup-position-field"><span>Posición / dorsal</span><select aria-label={`Posición de ${player.display_name}`} onChange={(event) => assign(player.id, Number(event.target.value))} value={slot}>{availableSlots.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          </> : <span>Suelta aquí</span>}
        </div>
      })}</section>
    </div> : <><PublishedLineup entries={entries} profiles={profiles} starters={starters} onOpenPlayer={onSavePositions ? setProfilePlayerId : undefined} />{(locked && onUnlock) || canExport || (canGraphicExport && locked) ? <div className="lineup-export-actions">{locked && onUnlock && <button className="danger-button" onClick={() => setConfirmUnlock(true)} type="button">Desbloquear para editar</button>}{canGraphicExport && locked && <button className="secondary-button" onClick={() => setGraphicOpen(true)} type="button">Vista gráfica</button>}{canExport && <><button className="secondary-button" onClick={() => void copyLineup()} type="button"><Icon name="copy" size={17} />{copied ? 'Convocatoria copiada' : 'Copiar convocatoria'}</button><button className="primary-button" onClick={() => downloadText(`convocatoria-${match.match_date}-${match.opponent}.xml`, lineupXml(match, entries, profiles), 'application/xml')} type="button"><Icon name="download" size={17} />Descargar XML</button></>}</div> : null}{error && <p className="form-error">{error}</p>}</>}
    {editable && <>{containsBorrowedPlayer && <p className="form-hint">Esta convocatoria incluye una jugadora prestada de otro equipo. El owner debe guardar los cambios mientras permanezca asignada.</p>}{canPublish && <label className="publish-lineup"><input checked={published} disabled={locked} onChange={(event) => setPublished(event.target.checked)} type="checkbox" />{locked ? 'Convocatoria publicada' : 'Publicar convocatoria para las jugadoras'}</label>}{error && <p className="form-error">{error}</p>}<div className="form-actions"><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={saving || containsBorrowedPlayer || (published && publicationBlocked)} onClick={() => void save()}>{saving ? 'Guardando…' : 'Guardar alineación'}</button></div></>}
    {confirmMissing && <MissingStartersDialog missing={Array.from({ length: starters }, (_, index) => index + 1).filter((slot) => !slots[slot])} onCancel={() => setConfirmMissing(false)} onConfirm={() => { setConfirmMissing(false); void save(true) }} />}
    {confirmUnlock && <UnlockLineupDialog onCancel={() => setConfirmUnlock(false)} onConfirm={() => void unlock()} />}
  </Modal>
}

function UnlockLineupDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const titleId = useId()
  return <Modal className="lineup-confirm-dialog" labelledBy={titleId} onClose={onCancel}>
    <div className="task-detail-heading"><div><span className="eyebrow">DESBLOQUEAR CONVOCATORIA</span><h2 id={titleId}>¿Volver a editar la convocatoria?</h2></div><button aria-label="Cerrar" className="icon-button" onClick={onCancel}>×</button></div>
    <div className="lineup-warning"><IconWarning /><div><strong>La convocatoria dejará de estar publicada</strong><p>Las jugadoras podrán cambiar su disponibilidad y cualquier baja saldrá de la alineación. Cuando termines los cambios tendrás que publicarla de nuevo.</p></div></div>
    <div className="form-actions"><button className="secondary-button" onClick={onCancel}>Mantener bloqueada</button><button className="danger-button" onClick={onConfirm}>Sí, desbloquear</button></div>
  </Modal>
}

function MissingStartersDialog({ missing, onCancel, onConfirm }: { missing: number[]; onCancel: () => void; onConfirm: () => void }) {
  const titleId = useId()
  return <Modal className="lineup-confirm-dialog" labelledBy={titleId} onClose={onCancel}>
    <div className="task-detail-heading"><div><span className="eyebrow">COMPROBAR ALINEACIÓN</span><h2 id={titleId}>Hay titulares sin rellenar</h2></div><button aria-label="Cerrar" className="icon-button" onClick={onCancel}>×</button></div>
    <div className="lineup-warning"><IconWarning /><div><strong>Faltan {missing.length} {missing.length === 1 ? 'titular' : 'titulares'}</strong><p>Dorsales sin asignar: {missing.join(', ')}. Puedes publicar igualmente si el equipo va a jugar con menos jugadoras.</p></div></div>
    <div className="form-actions"><button className="secondary-button" onClick={onCancel}>Revisar alineación</button><button className="primary-button" onClick={onConfirm}>Publicar igualmente</button></div>
  </Modal>
}

function IconWarning() { return <span aria-hidden="true">!</span> }

export function PublishedLineup({ entries, profiles, starters, onOpenPlayer }: { entries: MatchLineup[]; profiles: Profile[]; starters: number; onOpenPlayer?: (playerId: string) => void }) {
  const ordered = [...entries].sort((first, second) => first.slot_number - second.slot_number)
  return <div className="lineup-roster"><PlayerPositionSummary players={[...new Set(entries.map((entry) => entry.player_id))].map((id) => profiles.find((player) => player.id === id) ?? { primary_position: null })} /><RosterSection entries={ordered.filter((entry) => entry.slot_number <= starters)} label="Titulares" profiles={profiles} onOpenPlayer={onOpenPlayer} /><RosterSection entries={ordered.filter((entry) => entry.slot_number > starters)} label="Suplentes" profiles={profiles} onOpenPlayer={onOpenPlayer} /></div>
}

function RosterSection({ entries, label, profiles, onOpenPlayer }: { entries: MatchLineup[]; label: string; profiles: Profile[]; onOpenPlayer?: (playerId: string) => void }) {
  if (!entries.length) return null
  return <section><h3>{label}</h3>{groupPlayersByPosition(entries.map((entry) => ({ ...entry, primary_position: profiles.find((player) => player.id === entry.player_id)?.primary_position ?? null }))).filter((group) => group.players.length > 0).map((group) => <Fragment key={group.value}><h4 className="playing-position-heading">{group.label}{' '}<small>{group.players.length}</small></h4>{group.players.map((entry) => <div key={entry.player_id}><b>{entry.slot_number}</b>{onOpenPlayer ? <button aria-label={`Datos de perfil de ${profiles.find((player) => player.id === entry.player_id)?.display_name ?? 'Jugadora'}`} className="player-profile-link" onClick={() => onOpenPlayer(entry.player_id)} type="button">{profiles.find((player) => player.id === entry.player_id)?.display_name ?? 'Jugadora'}</button> : <span>{profiles.find((profile) => profile.id === entry.player_id)?.display_name ?? 'Jugadora'}</span>}</div>)}</Fragment>)}</section>
}

function lineupLimit(match: Match) {
  if (match.match_kind === 'official') return 23
  return match.rugby_format === 'sevens' ? 7 : 15
}

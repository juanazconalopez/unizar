import { useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { Avatar } from '../../components/ui/Avatar'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { formatDate, todayIso } from '../../lib/dates'
import { errorText } from '../../lib/errors'
import { attendancePlayerIdsForDate, isActivePlayer, membershipCoversDate } from '../../lib/selectors'
import { isPlayer } from '../../lib/permissions'
import type { AttendanceRecord, Profile, ProvisionalAttendanceEntry, ProvisionalAttendanceRecord, ProvisionalPlayer, Season, SeasonPlayer, TrainingSession } from '../../types'
import { GuestPlayerDialog } from './GuestPlayerDialog'

const EMPTY_PROVISIONAL_PLAYERS: ProvisionalPlayer[] = []
const EMPTY_PROVISIONAL_ATTENDANCE: ProvisionalAttendanceRecord[] = []

export function AttendanceView({ profiles, provisionalPlayers = EMPTY_PROVISIONAL_PLAYERS, provisionalAttendance = EMPTY_PROVISIONAL_ATTENDANCE, seasons, sessions, attendance, memberships, loadingRange = false, onLoadDate, onSave }: {
  profiles: Profile[]
  provisionalPlayers?: ProvisionalPlayer[]
  provisionalAttendance?: ProvisionalAttendanceRecord[]
  seasons: Season[]
  sessions: TrainingSession[]
  attendance: AttendanceRecord[]
  memberships: SeasonPlayer[]
  loadingRange?: boolean
  onLoadDate?: (date: string) => Promise<{ attendance: AttendanceRecord[]; provisionalAttendance: ProvisionalAttendanceRecord[] } | undefined>
  onSave: (date: string, playerIds: string[], attendedPlayerIds: string[], guests: ProvisionalAttendanceEntry[]) => Promise<void>
}) {
  const [date, setDate] = useState(todayIso())
  const [selected, setSelected] = useState<Set<string>>(
    () => attendedPlayersForDate(attendance, todayIso()),
  )
  const [saving, setSaving] = useState(false)
  const [guestDialogOpen, setGuestDialogOpen] = useState(false)
  const [guestEdits, setGuestEdits] = useState<Record<string, ProvisionalAttendanceEntry[]>>({})
  const [formError, setFormError] = useState('')
  const [saved, setSaved] = useState(false)
  const dateRequestId = useRef(0)

  const guests = guestEdits[date] ?? guestsForDate(provisionalAttendance, provisionalPlayers, date)

  function setGuests(next: ProvisionalAttendanceEntry[] | ((current: ProvisionalAttendanceEntry[]) => ProvisionalAttendanceEntry[])) {
    setGuestEdits((current) => ({
      ...current,
      [date]: typeof next === 'function' ? next(current[date] ?? guestsForDate(provisionalAttendance, provisionalPlayers, date)) : next,
    }))
  }

  function changeDate(nextDate: string) {
    setDate(nextDate)
    setSelected(attendedPlayersForDate(attendance, nextDate))
    setFormError('')
    setSaved(false)
    if (onLoadDate) {
      const requestId = ++dateRequestId.current
      void onLoadDate(nextDate).then((records) => {
        if (records && dateRequestId.current === requestId) {
          setSelected(attendedPlayersForDate(records.attendance, nextDate))
          setGuestEdits((current) => ({ ...current, [nextDate]: guestsForDate(records.provisionalAttendance, provisionalPlayers, nextDate) }))
        }
      }).catch(() => undefined)
    }
  }

  function togglePlayer(playerId: string) {
    setSaved(false)
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(playerId)) next.delete(playerId)
      else next.add(playerId)
      return next
    })
  }

  async function save() {
    setSaving(true)
    setFormError('')
    try {
      await onSave(date, [...visibleIds], [...visibleSelected], guests)
      setSaved(true)
      if (onLoadDate) {
        try {
          const records = await onLoadDate(date)
          if (records) {
            setSelected(attendedPlayersForDate(records.attendance, date))
            setGuestEdits((current) => ({ ...current, [date]: guestsForDate(records.provisionalAttendance, provisionalPlayers, date) }))
          }
        } catch {
          // The save succeeded; the shared error banner reports the refresh failure.
        }
      }
    } catch (error) {
      setFormError(errorText(error))
    } finally {
      setSaving(false)
    }
  }

  const historicalIds = attendancePlayerIdsForDate(attendance, date)
  const selectedSeason = seasons.find((season) => season.start_date <= date && season.end_date >= date)
  const eligibleIds = new Set(memberships
    .filter((membership) => (
      membership.season_id === selectedSeason?.id
      && membershipCoversDate(membership, date)
    ))
    .map((membership) => membership.player_id))
  const visiblePlayers = profiles.filter((profile) => (
    isPlayer(profile) && ((isActivePlayer(profile) && eligibleIds.has(profile.id)) || historicalIds.has(profile.id))
  ))
  const visibleIds = new Set(visiblePlayers.map((player) => player.id))
  const visibleSelected = new Set([...selected].filter((id) => visibleIds.has(id)))
  const allSelected = visiblePlayers.length > 0 && visiblePlayers.every((player) => visibleSelected.has(player.id))
  const recentDates = sessions.slice(0, 5)

  return (
    <div className="page">
      <PageHeader
        eyebrow="ENTRENAMIENTO DE CAMPO"
        title={date === todayIso() ? 'Asistencia de hoy' : 'Editar asistencia'}
        subtitle="Marca quién ha asistido al entrenamiento. Los cambios se pueden editar después."
      />

      <section className="attendance-toolbar">
        <label>
          Fecha del entrenamiento
          <input disabled={loadingRange} max={todayIso()} onChange={(event) => changeDate(event.target.value)} type="date" value={date} />
        </label>
        {date !== todayIso() && <button className="secondary-button" onClick={() => changeDate(todayIso())}>Volver a hoy</button>}
        <div className="attendance-count"><strong>{visibleSelected.size + guests.length}</strong><span>{guests.length ? `${visibleSelected.size} del equipo · ${guests.length} ${guests.length === 1 ? 'invitada' : 'invitadas'}` : `de ${visiblePlayers.length} asistentes`}</span></div>
      </section>
      {selectedSeason && <p className="attendance-context"><Icon name="calendar" size={15} />Temporada: <strong>{selectedSeason.name}</strong></p>}

      {recentDates.length > 0 && (
        <div className="attendance-dates" aria-label="Fechas recientes">
          <span>Recientes</span>
          {recentDates.map((session) => (
            <button className={date === session.session_date ? 'active' : ''} key={session.id} onClick={() => changeDate(session.session_date)}>
              {formatDate(session.session_date, { day: 'numeric', month: 'short' })}
            </button>
          ))}
        </div>
      )}

      {selectedSeason ? (
        <section className="attendance-panel">
          <div className="attendance-panel-heading">
            <div><span className="eyebrow">JUGADORAS ACTIVAS</span><h2>{formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</h2></div>
            <div className="attendance-heading-actions">
              <button className="secondary-button compact" onClick={() => setGuestDialogOpen(true)} type="button"><Icon name="plus" size={16} />Añadir invitada</button>
              {visiblePlayers.length > 0 && <label className="select-all">
                <input
                  checked={allSelected}
                  onChange={(event) => setSelected(event.target.checked ? new Set(visiblePlayers.map((player) => player.id)) : new Set())}
                  type="checkbox"
                />
                Marcar todas
              </label>}
            </div>
          </div>
          {visiblePlayers.length > 0 && <div className="attendance-list">
            {visiblePlayers.map((player) => {
              const checked = selected.has(player.id)
              return (
                <label className={checked ? 'attendance-player present' : 'attendance-player'} key={player.id}>
                  <span><Avatar name={player.display_name} /><strong>{player.display_name}</strong></span>
                  <input checked={checked} onChange={() => togglePlayer(player.id)} type="checkbox" />
                  <i><Icon name="check" size={20} /></i>
                </label>
              )
            })}
          </div>}
          {guests.length > 0 && <section className="attendance-guests" aria-label={`Invitadas: ${guests.length}`}>
            <div className="attendance-guests-heading"><div><span className="eyebrow">INVITADAS</span><strong>{guests.length} {guests.length === 1 ? 'asistente' : 'asistentes'}</strong></div><small>Se vincularán cuando creen su cuenta.</small></div>
            <div className="attendance-guest-list">{guests.map((guest, index) => <article key={`${guest.id ?? 'new'}-${guest.displayName}-${index}`}>
              <span><Avatar name={guest.displayName} /><span><strong>{guest.displayName}</strong><small>Asistencia provisional</small></span></span>
              <button aria-label={`Quitar a ${guest.displayName}`} className="icon-button" onClick={() => { setSaved(false); setGuests((current) => current.filter((_, itemIndex) => itemIndex !== index)) }} type="button"><Icon name="close" size={16} /></button>
            </article>)}</div>
          </section>}
          {formError && <p className="form-error">{formError}</p>}
          {saved && <p aria-live="polite" className="form-success"><Icon name="check" size={16} />Asistencia guardada para esta fecha.</p>}
          <div className="attendance-save">
            <span>{visiblePlayers.length > 0 && visibleSelected.size === visiblePlayers.length ? '¡Equipo completo!' : `${visiblePlayers.length - visibleSelected.size} sin marcar`}{guests.length > 0 && ` · ${guests.length} ${guests.length === 1 ? 'invitada' : 'invitadas'}`}</span>
            <button className="primary-button" disabled={saving} onClick={save}>
              <Icon name="check" size={18} />{saving ? 'Guardando…' : 'Guardar asistencia'}
            </button>
          </div>
        </section>
      ) : (
        <EmptyState
          title={selectedSeason ? 'No hay jugadoras activas' : 'No hay temporada para esta fecha'}
          text={selectedSeason
            ? 'Añade las jugadoras a esta temporada desde Configuración → Equipo.'
            : 'Crea o ajusta una temporada que incluya esta fecha antes de guardar asistencia.'}
        />
      )}
      {guestDialogOpen && <GuestPlayerDialog
        players={provisionalPlayers}
        unavailableIds={new Set(guests.flatMap((guest) => guest.id ? [guest.id] : []))}
        onAdd={(entry) => { setSaved(false); setGuests((current) => [...current, entry]) }}
        onClose={() => setGuestDialogOpen(false)}
      />}
    </div>
  )
}

function guestsForDate(attendance: ProvisionalAttendanceRecord[], players: ProvisionalPlayer[], date: string): ProvisionalAttendanceEntry[] {
  const names = new Map(players.map((player) => [player.id, player.display_name]))
  return attendance
    .filter((record) => record.training_sessions?.session_date === date)
    .flatMap((record) => {
      const displayName = record.provisional_players?.display_name ?? names.get(record.provisional_player_id)
      return displayName ? [{ id: record.provisional_player_id, displayName }] : []
    })
}

function attendedPlayersForDate(attendance: AttendanceRecord[], date: string) {
  return new Set(
    attendance
      .filter((record) => record.training_sessions?.session_date === date && record.attended)
      .map((record) => record.player_id),
  )
}

import type { TrainingAttendanceBasis } from '../../types'
import { useEffect, useRef, useState } from 'react'
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

export function AttendanceView({ profiles, provisionalPlayers = EMPTY_PROVISIONAL_PLAYERS, provisionalAttendance = EMPTY_PROVISIONAL_ATTENDANCE, seasons, sessions, attendance, memberships, loadingRange = false, canRecord = true, canManageGuests = true, onLoadDate, onLoadBasis, onSave }: {
  profiles: Profile[]
  provisionalPlayers?: ProvisionalPlayer[]
  provisionalAttendance?: ProvisionalAttendanceRecord[]
  seasons: Season[]
  sessions: TrainingSession[]
  attendance: AttendanceRecord[]
  memberships: SeasonPlayer[]
  loadingRange?: boolean
  canRecord?: boolean
  canManageGuests?: boolean
  onLoadBasis?: (date: string) => Promise<TrainingAttendanceBasis>
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
  const editsVersion = useRef(0)
  const hasUnsavedEdits = useRef(false)
  const [basis, setBasis] = useState<TrainingAttendanceBasis | null>(null)
  const [basisLoading, setBasisLoading] = useState(Boolean(onLoadBasis))
  const [basisFailed, setBasisFailed] = useState(false)
  const [basisAttempt, setBasisAttempt] = useState(0)
  const loadDateRef = useRef(onLoadDate)
  useEffect(() => { loadDateRef.current = onLoadDate }, [onLoadDate])
  const provisionalPlayersRef = useRef(provisionalPlayers)
  useEffect(() => { provisionalPlayersRef.current = provisionalPlayers }, [provisionalPlayers])
  useEffect(() => {
    if (!onLoadBasis) return
    let current = true
    const requestId = ++dateRequestId.current
    const editVersion = editsVersion.current
    void Promise.all([onLoadBasis(date), loadDateRef.current?.(date)]).then(([loaded, records]) => {
      if (!current || requestId !== dateRequestId.current) return
      setBasis(loaded)
      if (!hasUnsavedEdits.current && editVersion === editsVersion.current) {
        setSelected(new Set(loaded.recorded ? loaded.attended_player_ids : loaded.responses.filter((item) => item.attending).map((item) => item.player_id)))
        if (records) setGuestEdits((current) => ({ ...current, [date]: guestsForDate(records.provisionalAttendance, provisionalPlayersRef.current, date) }))
      }
      setBasisFailed(false); setFormError('')
    }).catch((cause) => {
      if (current && requestId === dateRequestId.current) { setFormError(errorText(cause)); setBasisFailed(true) }
    }).finally(() => { if (current && requestId === dateRequestId.current) setBasisLoading(false) })
    return () => { current = false }
  }, [date, onLoadBasis, basisAttempt])
  const selfManaged = Boolean(basis?.self_managed || sessions.some((session) => session.session_date === date && session.self_managed))
  const recorded = basis?.recorded ?? sessions.some((session) => session.session_date === date)
  const waitingForAutomatic = selfManaged && !recorded
  const locked = waitingForAutomatic || !canRecord || saving || basisLoading || basisFailed || Boolean(onLoadBasis && !basis)

  useEffect(() => {
    if (!waitingForAutomatic || !onLoadBasis) return
    const timer = window.setInterval(() => setBasisAttempt((current) => current + 1), 60_000)
    return () => window.clearInterval(timer)
  }, [waitingForAutomatic, onLoadBasis])

  const guests = guestEdits[date] ?? guestsForDate(provisionalAttendance, provisionalPlayers, date)

  function setGuests(next: ProvisionalAttendanceEntry[] | ((current: ProvisionalAttendanceEntry[]) => ProvisionalAttendanceEntry[])) {
    editsVersion.current++
    hasUnsavedEdits.current = true
    setGuestEdits((current) => ({
      ...current,
      [date]: typeof next === 'function' ? next(current[date] ?? guestsForDate(provisionalAttendance, provisionalPlayers, date)) : next,
    }))
  }

  function changeDate(nextDate: string) {
    dateRequestId.current++
    hasUnsavedEdits.current = false
    setDate(nextDate)
    setSelected(attendedPlayersForDate(attendance, nextDate))
    setFormError('')
    setSaved(false)
    setBasis(null); setBasisLoading(Boolean(onLoadBasis)); setBasisFailed(false)
    editsVersion.current++
    if (onLoadDate && !onLoadBasis) {
      const requestId = ++dateRequestId.current
      const editVersion = editsVersion.current
      void onLoadDate(nextDate).then((records) => {
        if (records && dateRequestId.current === requestId && editVersion === editsVersion.current) {
          setSelected(attendedPlayersForDate(records.attendance, nextDate))
          setGuestEdits((current) => ({ ...current, [nextDate]: guestsForDate(records.provisionalAttendance, provisionalPlayers, nextDate) }))
        }
      }).catch(() => undefined)
    }
  }

  function togglePlayer(playerId: string) {
    editsVersion.current++
    hasUnsavedEdits.current = true
    setSaved(false)
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(playerId)) next.delete(playerId)
      else next.add(playerId)
      return next
    })
  }

  async function save() {
    if (locked) return
    dateRequestId.current++
    setSaving(true)
    setFormError('')
    try {
      await onSave(date, [...visibleIds], [...visibleSelected], guests)
      dateRequestId.current++
      hasUnsavedEdits.current = false
      setSaved(true)
      setBasis((current) => current ? { ...current, recorded: true, attended_player_ids: [...visibleSelected] } : current)
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
        subtitle={selfManaged ? "Viernes autogestionado: la asistencia se registra automáticamente y se puede corregir después." : "Marca quién ha asistido al entrenamiento. Los cambios se pueden editar después."}
      />

      <section className="attendance-toolbar">
        <label>
          Fecha del entrenamiento
          <input disabled={loadingRange || saving || basisLoading} max={todayIso()} onChange={(event) => changeDate(event.target.value)} type="date" value={date} />
        </label>
        {date !== todayIso() && <button className="secondary-button" disabled={saving} onClick={() => changeDate(todayIso())}>Volver a hoy</button>}
        <div className="attendance-count"><strong>{visibleSelected.size + guests.length}</strong><span>{guests.length ? `${visibleSelected.size} del equipo · ${guests.length} ${guests.length === 1 ? 'invitada' : 'invitadas'}` : `de ${visiblePlayers.length} ${waitingForAutomatic ? "previstas" : "asistentes"}`}</span></div>
      </section>
      {selectedSeason && <p className="attendance-context"><Icon name="calendar" size={15} />Temporada: <strong>{selectedSeason.name}</strong></p>}

      {basisLoading && <p role="status">Cargando respuestas y asistencia guardada…</p>}
      {basis && !basis.recorded && <p className="attendance-context">Base de las respuestas: {basis.responses.filter((item) => item.attending && visibleIds.has(item.player_id)).length} asistirán · {basis.responses.filter((item) => !item.attending && visibleIds.has(item.player_id)).length} rechazan · {visiblePlayers.length - basis.responses.filter((item) => visibleIds.has(item.player_id)).length} sin responder. {!selfManaged && 'Revisa la asistencia real antes de guardar.'}</p>}
      {selfManaged && <p className="attendance-context" role="status">{recorded ? 'Asistencia registrada automáticamente. Se puede corregir la asistencia real y guardar los cambios; el proceso automático conserva las correcciones.' : 'La asistencia se registrará automáticamente al terminar el entrenamiento, salvo festivo o cancelación. Rechazar y no responder contarán como ausencia. Estas previsiones aún no cuentan en las estadísticas.'}</p>}
      {basis?.recorded && !selfManaged && <p className="attendance-context">Asistencia real guardada. Las respuestas de las jugadoras están cerradas.</p>}
      {basisFailed && <button className="secondary-button" type="button" onClick={() => { setBasisLoading(true); setBasisFailed(false); setBasisAttempt((current) => current + 1) }}>Reintentar carga de asistencia</button>}
      {recentDates.length > 0 && (
        <div className="attendance-dates" aria-label="Fechas recientes">
          <span>Recientes</span>
          {recentDates.map((session) => (
            <button disabled={saving} className={date === session.session_date ? 'active' : ''} key={session.id} onClick={() => changeDate(session.session_date)}>
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
              {canManageGuests && !waitingForAutomatic && <button className="secondary-button compact" disabled={locked} onClick={() => setGuestDialogOpen(true)} type="button"><Icon name="plus" size={16} />Añadir invitada</button>}
              {visiblePlayers.length > 0 && !waitingForAutomatic && <label className="select-all">
                <input
                  checked={allSelected}
                  disabled={locked}
                  onChange={(event) => { editsVersion.current++; hasUnsavedEdits.current = true; setSaved(false); setSelected(event.target.checked ? new Set(visiblePlayers.map((player) => player.id)) : new Set()) }}
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
                  <span><Avatar name={player.display_name} /><strong>{player.display_name}</strong>{basis && !basis.recorded && <small>{(() => {
                    const response = basis.responses.find((item) => item.player_id === player.id)
                    return response ? `${response.attending ? 'Asistiré' : 'Rechazar'}${response.comment ? ` · ${response.comment}` : ''}` : 'Sin responder'
                  })()}</small>}</span>
                  <input checked={checked} disabled={locked} onChange={() => togglePlayer(player.id)} type="checkbox" />
                  <i><Icon name="check" size={20} /></i>
                </label>
              )
            })}
          </div>}
          {guests.length > 0 && <section className="attendance-guests" aria-label={`Invitadas: ${guests.length}`}>
            <div className="attendance-guests-heading"><div><span className="eyebrow">INVITADAS</span><strong>{guests.length} {guests.length === 1 ? 'asistente' : 'asistentes'}</strong></div><small>Se vincularán cuando creen su cuenta.</small></div>
            <div className="attendance-guest-list">{guests.map((guest, index) => <article key={`${guest.id ?? 'new'}-${guest.displayName}-${index}`}>
              <span><Avatar name={guest.displayName} /><span><strong>{guest.displayName}</strong><small>Asistencia provisional</small></span></span>
              {canManageGuests && !waitingForAutomatic && <button aria-label={`Quitar a ${guest.displayName}`} className="icon-button" disabled={locked} onClick={() => { setSaved(false); setGuests((current) => current.filter((_, itemIndex) => itemIndex !== index)) }} type="button"><Icon name="close" size={16} /></button>}
            </article>)}</div>
          </section>}
          {formError && <p className="form-error">{formError}</p>}
          {saved && <p aria-live="polite" className="form-success"><Icon name="check" size={16} />Asistencia guardada para esta fecha.</p>}
          {canRecord && !waitingForAutomatic && <div className="attendance-save">
            <span>{visiblePlayers.length > 0 && visibleSelected.size === visiblePlayers.length ? '¡Equipo completo!' : `${visiblePlayers.length - visibleSelected.size} sin marcar`}{guests.length > 0 && ` · ${guests.length} ${guests.length === 1 ? 'invitada' : 'invitadas'}`}</span>
            <button className="primary-button" disabled={locked} onClick={save}>
              <Icon name="check" size={18} />{saving ? 'Guardando…' : 'Guardar asistencia'}
            </button>
          </div>}
        </section>
      ) : (
        <EmptyState
          title={selectedSeason ? 'No hay jugadoras activas' : 'No hay temporada para esta fecha'}
          text={selectedSeason
            ? 'Añade las jugadoras a esta temporada desde Configuración → Equipo.'
            : 'Crea o ajusta una temporada que incluya esta fecha antes de guardar asistencia.'}
        />
      )}
      {canManageGuests && !waitingForAutomatic && guestDialogOpen && <GuestPlayerDialog
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

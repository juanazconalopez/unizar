import { useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { Avatar } from '../../components/ui/Avatar'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { formatDate, todayIso } from '../../lib/dates'
import { errorText } from '../../lib/errors'
import { attendancePlayerIdsForDate, isActivePlayer, membershipCoversDate } from '../../lib/selectors'
import type { AttendanceRecord, Profile, Season, SeasonPlayer, TrainingSession } from '../../types'

export function AttendanceView({ profiles, seasons, sessions, attendance, memberships, loadingRange = false, onLoadDate, onSave }: {
  profiles: Profile[]
  seasons: Season[]
  sessions: TrainingSession[]
  attendance: AttendanceRecord[]
  memberships: SeasonPlayer[]
  loadingRange?: boolean
  onLoadDate?: (date: string) => Promise<AttendanceRecord[] | undefined>
  onSave: (date: string, playerIds: string[], attendedPlayerIds: string[]) => Promise<void>
}) {
  const [date, setDate] = useState(todayIso())
  const [selected, setSelected] = useState<Set<string>>(
    () => attendedPlayersForDate(attendance, todayIso()),
  )
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [saved, setSaved] = useState(false)
  const dateRequestId = useRef(0)

  function changeDate(nextDate: string) {
    setDate(nextDate)
    setSelected(attendedPlayersForDate(attendance, nextDate))
    setFormError('')
    setSaved(false)
    if (onLoadDate) {
      const requestId = ++dateRequestId.current
      void onLoadDate(nextDate).then((records) => {
        if (records && dateRequestId.current === requestId) {
          setSelected(attendedPlayersForDate(records, nextDate))
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
      await onSave(date, [...visibleIds], [...visibleSelected])
      setSaved(true)
      if (onLoadDate) {
        try {
          const records = await onLoadDate(date)
          if (records) setSelected(attendedPlayersForDate(records, date))
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
    !profile.is_owner && ((isActivePlayer(profile) && eligibleIds.has(profile.id)) || historicalIds.has(profile.id))
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
        <div className="attendance-count"><strong>{visibleSelected.size}</strong><span>de {visiblePlayers.length}<br />asistentes</span></div>
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

      {visiblePlayers.length ? (
        <section className="attendance-panel">
          <div className="attendance-panel-heading">
            <div><span className="eyebrow">JUGADORAS ACTIVAS</span><h2>{formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</h2></div>
            <label className="select-all">
              <input
                checked={allSelected}
                onChange={(event) => setSelected(event.target.checked ? new Set(visiblePlayers.map((player) => player.id)) : new Set())}
                type="checkbox"
              />
              Marcar todas
            </label>
          </div>
          <div className="attendance-list">
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
          </div>
          {formError && <p className="form-error">{formError}</p>}
          {saved && <p aria-live="polite" className="form-success"><Icon name="check" size={16} />Asistencia guardada para esta fecha.</p>}
          <div className="attendance-save">
            <span>{visibleSelected.size === visiblePlayers.length ? '¡Equipo completo!' : `${visiblePlayers.length - visibleSelected.size} sin marcar`}</span>
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
    </div>
  )
}

function attendedPlayersForDate(attendance: AttendanceRecord[], date: string) {
  return new Set(
    attendance
      .filter((record) => record.training_sessions?.session_date === date && record.attended)
      .map((record) => record.player_id),
  )
}

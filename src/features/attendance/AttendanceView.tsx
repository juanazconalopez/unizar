import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { Avatar } from '../../components/ui/Avatar'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { formatDate, todayIso } from '../../lib/dates'
import { errorText } from '../../lib/errors'
import type { AttendanceRecord, Profile, TrainingSession } from '../../types'

export function AttendanceView({ profiles, sessions, attendance, onSave }: {
  profiles: Profile[]
  sessions: TrainingSession[]
  attendance: AttendanceRecord[]
  onSave: (date: string, attendedPlayerIds: string[]) => Promise<void>
}) {
  const activePlayers = profiles.filter(
    (profile) => profile.is_approved && profile.is_active && !profile.is_archived,
  )
  const [date, setDate] = useState(todayIso())
  const [selected, setSelected] = useState<Set<string>>(
    () => attendedPlayersForDate(attendance, todayIso()),
  )
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  function changeDate(nextDate: string) {
    setDate(nextDate)
    setSelected(attendedPlayersForDate(attendance, nextDate))
    setFormError('')
  }

  function togglePlayer(playerId: string) {
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
      await onSave(date, [...selected])
    } catch (error) {
      setFormError(errorText(error))
    } finally {
      setSaving(false)
    }
  }

  const allSelected = activePlayers.length > 0 && activePlayers.every((player) => selected.has(player.id))
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
          <input max={todayIso()} onChange={(event) => changeDate(event.target.value)} type="date" value={date} />
        </label>
        {date !== todayIso() && <button className="secondary-button" onClick={() => changeDate(todayIso())}>Volver a hoy</button>}
        <div className="attendance-count"><strong>{selected.size}</strong><span>de {activePlayers.length}<br />asistentes</span></div>
      </section>

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

      {activePlayers.length ? (
        <section className="attendance-panel">
          <div className="attendance-panel-heading">
            <div><span className="eyebrow">JUGADORAS ACTIVAS</span><h2>{formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</h2></div>
            <label className="select-all">
              <input
                checked={allSelected}
                onChange={(event) => setSelected(event.target.checked ? new Set(activePlayers.map((player) => player.id)) : new Set())}
                type="checkbox"
              />
              Marcar todas
            </label>
          </div>
          <div className="attendance-list">
            {activePlayers.map((player) => {
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
          <div className="attendance-save">
            <span>{selected.size === activePlayers.length ? '¡Equipo completo!' : `${activePlayers.length - selected.size} sin marcar`}</span>
            <button className="primary-button" disabled={saving} onClick={save}>
              <Icon name="check" size={18} />{saving ? 'Guardando…' : 'Guardar asistencia'}
            </button>
          </div>
        </section>
      ) : <EmptyState title="No hay jugadoras activas" text="Activa y aprueba jugadoras desde la vista Equipo." />}
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

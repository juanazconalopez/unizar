import { useId, useRef, useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { errorText } from '../../lib/errors'
import { readMatchReportPdf, type SavedReportEvent } from '../../services/matchReportService'
import type { Match, MatchLineup, Profile } from '../../types'

type DraftEvent = Omit<SavedReportEvent, 'event_minute'> & { event_minute: number | ''; key: string; source: string }

export function MatchReportDialog({ match, lineup, profiles, onClose, onSave }: {
  match: Match
  lineup: MatchLineup[]
  profiles: Profile[]
  onClose: () => void
  onSave: (file: File, scores: { team: number; opponent: number }, duration: number, events: SavedReportEvent[], reviewed: boolean) => Promise<void>
}) {
  const titleId = useId()
  const [file, setFile] = useState<File | null>(null)
  const [teamScore, setTeamScore] = useState(match.team_score?.toString() ?? '')
  const [opponentScore, setOpponentScore] = useState(match.opponent_score?.toString() ?? '')
  const [duration, setDuration] = useState(String(match.match_report_path ? (match.duration_minutes ?? 80) : (match.rugby_format === 'sevens' ? 14 : 80)))
  const [events, setEvents] = useState<DraftEvent[]>([])
  const [reviewed, setReviewed] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [reading, setReading] = useState(false)
  const readSequence = useRef(0)
  const canReview = match.match_kind === 'official' && lineup.length > 0
  const players = [...lineup].sort((a, b) => (a.slot_number ?? 99) - (b.slot_number ?? 99))
  const playerLabel = (entry: MatchLineup) => `#${entry.slot_number ?? '—'} ${profiles.find((profile) => profile.id === entry.player_id)?.display_name ?? 'Jugadora'}`

  async function selectFile(selected: File | undefined) {
    if (!selected) return
    if ((selected.type !== 'application/pdf' && !selected.name.toLowerCase().endsWith('.pdf')) || selected.size === 0 || selected.size > 10 * 1024 * 1024) {
      setFile(null)
      setMessage('Selecciona un PDF válido de hasta 10 MB.')
      return
    }
    const sequence = ++readSequence.current
    setReading(true)
    setFile(selected)
    setReviewed(false)
    setEvents([])
    setMessage('Leyendo el acta…')
    try {
      const parsed = await readMatchReportPdf(selected)
      if (sequence !== readSequence.current) return
      if (parsed.homeScore !== null && parsed.awayScore !== null) {
        setTeamScore(String(match.is_home ? parsed.homeScore : parsed.awayScore))
        setOpponentScore(String(match.is_home ? parsed.awayScore : parsed.homeScore))
      }
      const sideEvents = match.is_home ? parsed.events.home : parsed.events.away
      setEvents(sideEvents.map((event) => ({
        key: crypto.randomUUID(),
        source: `Dorsal ${event.dorsal}${event.replacementDorsal ? ` → ${event.replacementDorsal}` : ''}`,
        event_type: event.type, event_minute: event.minute,
        player_id: lineup.find((entry) => entry.slot_number === event.dorsal)?.player_id ?? '',
        replacement_player_id: event.replacementDorsal ? lineup.find((entry) => entry.slot_number === event.replacementDorsal)?.player_id ?? '' : null,
      })))
      const expectedOpponent = match.opponent.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
      const reportedOpponent = (match.is_home ? parsed.awayTeam : parsed.homeTeam)?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
      const warnings = [
        parsed.recognized ? '' : 'No se ha reconocido el formato del acta. Completa el resultado manualmente.',
        parsed.date && parsed.date !== match.match_date ? `La fecha del PDF (${parsed.date}) no coincide con la del partido. Comprueba que sea el acta correcta.` : '',
        reportedOpponent && expectedOpponent && !reportedOpponent.includes(expectedOpponent) && !expectedOpponent.includes(reportedOpponent) ? `El rival del PDF (${match.is_home ? parsed.awayTeam : parsed.homeTeam}) no coincide con el partido.` : '',
        sideEvents.some((event) => !lineup.some((entry) => entry.slot_number === event.dorsal) || (event.replacementDorsal && !lineup.some((entry) => entry.slot_number === event.replacementDorsal))) ? 'Hay dorsales sin correspondencia en la convocatoria. Asígnales una jugadora antes de confirmar los eventos.' : '',
      ].filter(Boolean)
      setMessage(warnings.join(' ') || `Acta leída: ${sideEvents.length} cambios o tarjetas del equipo. Revisa los datos antes de guardar.`)
    } catch (error) {
      if (sequence !== readSequence.current) return
      setMessage(`No se pudo extraer el texto: ${errorText(error)}. Puedes introducir el resultado y los eventos manualmente.`)
    } finally { if (sequence === readSequence.current) setReading(false) }
  }

  function updateEvent(key: string, changes: Partial<DraftEvent>) {
    setEvents((current) => current.map((event) => event.key === key ? { ...event, ...changes } : event))
  }

  async function save() {
    if (reading) return
    if (!file) { setMessage('Selecciona el PDF del acta.'); return }
    const team = Number(teamScore); const opponent = Number(opponentScore); const minutes = Number(duration)
    if (!/^\d{1,3}$/.test(teamScore) || !/^\d{1,3}$/.test(opponentScore) || team > 250 || opponent > 250) { setMessage('Revisa el resultado de ambos equipos.'); return }
    if (!/^\d{1,3}$/.test(duration) || minutes < 1 || minutes > 240) { setMessage('Revisa la duración del partido.'); return }
    if (reviewed && events.some((event) => !event.player_id || (event.event_type === 'substitution' && (!event.replacement_player_id || event.player_id === event.replacement_player_id)) || event.event_minute === '' || event.event_minute < 0 || event.event_minute > minutes)) { setMessage('Completa las jugadoras y los minutos de cada evento.'); return }
    setBusy(true)
    try {
      await onSave(file, { team, opponent }, minutes, events.map(({ event_type, event_minute, player_id, replacement_player_id }) => ({ event_type, event_minute: Number(event_minute), player_id, replacement_player_id })), reviewed)
      onClose()
    } catch (error) { setMessage(errorText(error)) } finally { setBusy(false) }
  }

  return <Modal className="match-report-dialog" disabled={busy} labelledBy={titleId} onClose={onClose}>
    <div className="task-detail-heading"><div><span className="eyebrow">ACTA DEL PARTIDO</span><h2 id={titleId}>Subir acta</h2></div><button aria-label="Cerrar" className="icon-button" disabled={busy} onClick={onClose} type="button">×</button></div>
    <p>Sube el PDF y comprueba el resultado y los eventos extraídos. Puedes corregirlos si el formato del acta ha cambiado.</p>
    {match.internal_fixture_id && <p>En un derbi, sube el acta desde el detalle de cada equipo para revisar sus propios cambios y tarjetas.</p>}
    <div className="form-field"><label htmlFor="match-report-file">Acta en PDF</label><input accept="application/pdf,.pdf" id="match-report-file" onChange={(event) => void selectFile(event.target.files?.[0])} type="file" /></div>
    <div className="match-report-scores">
      <div className="form-field"><label htmlFor="match-report-team-score">Puntos del equipo</label><input id="match-report-team-score" max="250" min="0" onChange={(event) => setTeamScore(event.target.value)} type="number" value={teamScore} /></div>
      <div className="form-field"><label htmlFor="match-report-opponent-score">Puntos del rival</label><input id="match-report-opponent-score" max="250" min="0" onChange={(event) => setOpponentScore(event.target.value)} type="number" value={opponentScore} /></div>
      <div className="form-field"><label htmlFor="match-report-duration">Duración (minutos)</label><input id="match-report-duration" max="240" min="1" onChange={(event) => setDuration(event.target.value)} type="number" value={duration} /></div>
    </div>
    {message && <p aria-live="polite" className="match-report-message">{message}</p>}
    {canReview && <section className="match-report-events"><div className="match-detail-section-heading"><h3>Cambios y tarjetas del equipo</h3><button className="secondary-button compact" onClick={() => setEvents((current) => [...current, { key: crypto.randomUUID(), source: 'Añadido manualmente', event_type: 'substitution', event_minute: 0, player_id: '', replacement_player_id: '' }])} type="button">Añadir evento</button></div>
      {events.length === 0 && <p>Sin eventos detectados. Si los hubo, añádelos antes de confirmar.</p>}
      {events.map((event) => <div className="match-report-event" key={event.key}>
        <select aria-label="Tipo de evento" onChange={(input) => updateEvent(event.key, { event_type: input.target.value as DraftEvent['event_type'], replacement_player_id: input.target.value === 'substitution' ? '' : null })} value={event.event_type}><option value="substitution">Cambio</option><option value="yellow_card">Tarjeta amarilla</option><option value="red_card">Tarjeta roja</option></select>
        <select aria-label={`Jugadora, ${event.source}`} onChange={(input) => updateEvent(event.key, { player_id: input.target.value })} value={event.player_id}><option value="">Jugadora que sale / recibe tarjeta</option>{players.map((entry) => <option key={entry.player_id} value={entry.player_id}>{playerLabel(entry)}</option>)}</select>
        {event.event_type === 'substitution' && <select aria-label={`Jugadora que entra, ${event.source}`} onChange={(input) => updateEvent(event.key, { replacement_player_id: input.target.value })} value={event.replacement_player_id ?? ''}><option value="">Jugadora que entra</option>{players.map((entry) => <option key={entry.player_id} value={entry.player_id}>{playerLabel(entry)}</option>)}</select>}
        <input aria-label={`Minuto, ${event.source}`} max={duration || 240} min="0" onChange={(input) => updateEvent(event.key, { event_minute: input.target.value === '' ? '' : Number(input.target.value) })} type="number" value={event.event_minute} />
        <button aria-label={`Quitar evento ${event.source}`} className="secondary-button compact" onClick={() => setEvents((current) => current.filter((item) => item.key !== event.key))} type="button">Quitar</button>
      </div>)}
      <label className="match-report-review"><input checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} type="checkbox" /> He revisado todos los cambios y tarjetas del equipo; registrar minutos de juego</label>
    </section>}
    {canReview && !reviewed && <p>Si guardas sin confirmar los eventos, se conservará el PDF y el resultado, pero no se registrarán cambios, tarjetas ni minutos de juego.</p>}
    {!canReview && match.match_kind === 'official' && <p>Para registrar minutos, prepara primero la convocatoria y vuelve a subir el acta.</p>}
    <div className="match-detail-actions"><button className="secondary-button" disabled={busy} onClick={onClose} type="button">Cancelar</button><button className="primary-button" disabled={busy || reading} onClick={() => void save()} type="button">{busy ? 'Guardando…' : 'Guardar acta'}</button></div>
  </Modal>
}

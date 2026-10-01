import { useEffect, useId, useRef, useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { errorText } from '../../lib/errors'
import { calculateMatchMinutes, yellowCardSuspension } from '../../lib/matchMinutes'
import { loadMatchReportEvents, readMatchReportPdf, type MatchReportValues, type SavedReportEvent } from '../../services/matchReportService'
import type { Match, MatchLineup, Profile } from '../../types'

type DraftEvent = Omit<SavedReportEvent, 'event_minute' | 'return_minute'> & { event_minute: number | ''; return_minute: number | '' | null; key: string; source: string }

export function MatchReportDialog({ match, lineup, profiles, onClose, onSave, onLoadEvents = loadMatchReportEvents }: {
  match: Match
  lineup: MatchLineup[]
  profiles: Profile[]
  onClose: () => void
  onSave: (values: MatchReportValues) => Promise<void>
  onLoadEvents?: (matchId: string) => Promise<SavedReportEvent[]>
}) {
  const titleId = useId()
  const hasSavedResult = match.team_score != null
  const needsLoading = hasSavedResult && match.match_kind === 'official'
  const [teamScore, setTeamScore] = useState(match.team_score?.toString() ?? '')
  const [opponentScore, setOpponentScore] = useState(match.opponent_score?.toString() ?? '')
  const [duration, setDuration] = useState(String(hasSavedResult ? (match.duration_minutes ?? 80) : (match.rugby_format === 'sevens' ? 14 : 80)))
  const [events, setEvents] = useState<DraftEvent[]>([])
  const [reviewed, setReviewed] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [reading, setReading] = useState(false)
  const [loading, setLoading] = useState(needsLoading)
  const [loadError, setLoadError] = useState('')
  const [retry, setRetry] = useState(0)
  const readSequence = useRef(0)
  const canReview = match.match_kind === 'official' && lineup.length > 0 && match.lineup_published
  const officialWithoutLineup = match.match_kind === 'official' && !canReview
  const players = [...lineup].sort((a, b) => (a.slot_number ?? 99) - (b.slot_number ?? 99))
  const playerLabel = (entry: MatchLineup) => `#${entry.slot_number ?? '—'} ${profiles.find((profile) => profile.id === entry.player_id)?.display_name ?? 'Jugadora'}`
  const disabled = busy || reading || loading || !!loadError

  useEffect(() => {
    let current = true
    if (needsLoading) {
      void onLoadEvents(match.id).then((saved) => {
        if (current) setEvents(saved.map((event) => ({ ...event, key: crypto.randomUUID(), source: 'Guardado' })))
      }).catch((error) => { if (current) setLoadError(errorText(error)) })
        .finally(() => { if (current) setLoading(false) })
    }
    return () => { current = false; readSequence.current += 1 }
  }, [match.id, needsLoading, onLoadEvents, retry])

  let preview = new Map<string, number>()
  let validationError = ''
  const savedEvents: SavedReportEvent[] = events.map(({ event_type, event_minute, player_id, replacement_player_id, return_minute }) => ({
    event_type, event_minute: event_minute === '' ? NaN : event_minute, player_id, replacement_player_id,
    return_minute: return_minute === '' ? NaN : return_minute,
  }))
  if (canReview && !loading && !loadError) {
    try { preview = calculateMatchMinutes(lineup, Number(duration), savedEvents, match.rugby_format) }
    catch (error) { validationError = errorText(error) }
  }
  const validScores = /^\d{1,3}$/.test(teamScore) && /^\d{1,3}$/.test(opponentScore) && Number(teamScore) <= 250 && Number(opponentScore) <= 250
  const validDuration = /^\d{1,3}$/.test(duration) && Number(duration) >= 1 && Number(duration) <= 240
  const canSave = !disabled && !officialWithoutLineup && validScores && validDuration && !validationError && reviewed

  async function selectFile(selected: File | undefined) {
    const sequence = ++readSequence.current
    setReading(false)
    setReviewed(false)
    if (!selected) return
    if ((selected.type !== 'application/pdf' && !selected.name.toLowerCase().endsWith('.pdf')) || selected.size === 0 || selected.size > 10 * 1024 * 1024) {
      setMessage('Selecciona un PDF válido de hasta 10 MB.')
      return
    }
    setReading(true)
    setMessage('Leyendo el acta en este navegador…')
    try {
      const parsed = await readMatchReportPdf(selected)
      if (sequence !== readSequence.current) return
      if (parsed.homeScore !== null && parsed.awayScore !== null) {
        setTeamScore(String(match.is_home ? parsed.homeScore : parsed.awayScore))
        setOpponentScore(String(match.is_home ? parsed.awayScore : parsed.homeScore))
      }
      const sideEvents = match.is_home ? parsed.events.home : parsed.events.away
      setEvents(sideEvents.map((event) => ({
        key: crypto.randomUUID(), source: `Dorsal ${event.dorsal}${event.replacementDorsal ? ` → ${event.replacementDorsal}` : ''}`,
        event_type: event.type, event_minute: event.minute,
        player_id: lineup.find((entry) => entry.slot_number === event.dorsal)?.player_id ?? '',
        replacement_player_id: event.replacementDorsal ? lineup.find((entry) => entry.slot_number === event.replacementDorsal)?.player_id ?? '' : null,
        return_minute: event.type === 'yellow_card' ? Math.min(Number(duration), event.minute + yellowCardSuspension(match.rugby_format)) : null,
      })))
      const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
      const expectedOpponent = normalize(match.opponent)
      const reportedOpponent = normalize((match.is_home ? parsed.awayTeam : parsed.homeTeam) ?? '')
      const warnings = [
        parsed.recognized ? '' : 'No se ha reconocido el formato del acta. Completa los datos manualmente.',
        parsed.date && parsed.date !== match.match_date ? `La fecha del PDF (${parsed.date}) no coincide con la del partido. Comprueba que sea el acta correcta.` : '',
        reportedOpponent && expectedOpponent && !reportedOpponent.includes(expectedOpponent) && !expectedOpponent.includes(reportedOpponent) ? 'El rival del PDF no coincide con el partido.' : '',
        sideEvents.some((event) => !lineup.some((entry) => entry.slot_number === event.dorsal) || (event.replacementDorsal && !lineup.some((entry) => entry.slot_number === event.replacementDorsal))) ? 'Hay dorsales sin correspondencia. Asígnales una jugadora antes de guardar.' : '',
      ].filter(Boolean)
      setMessage([...warnings, `${sideEvents.length} cambios o tarjetas detectados. Comprueba que no falte ninguno y revisa el regreso tras las amarillas.`].join(' '))
    } catch (error) {
      if (sequence === readSequence.current) setMessage(`No se pudo leer el PDF: ${errorText(error)}. Puedes introducir los datos manualmente.`)
    } finally { if (sequence === readSequence.current) setReading(false) }
  }

  function updateEvent(key: string, changes: Partial<DraftEvent>) {
    setReviewed(false)
    setEvents((current) => current.map((event) => event.key === key ? { ...event, ...changes } : event))
  }

  async function save() {
    if (!canSave || busy) return
    setBusy(true)
    try {
      await onSave({ scores: { team: Number(teamScore), opponent: Number(opponentScore) }, duration: Number(duration), events: canReview ? savedEvents : [] })
      onClose()
    } catch (error) { setMessage(errorText(error)) } finally { setBusy(false) }
  }

  return <Modal className="match-report-dialog" disabled={busy} labelledBy={titleId} onClose={onClose}>
    <div className="task-detail-heading"><div><span className="eyebrow">PARTIDO FINALIZADO</span><h2 id={titleId}>Resultado y minutos</h2></div><button aria-label="Cerrar" className="icon-button" disabled={busy} onClick={onClose} type="button">×</button></div>
    <p>Introduce el resultado, los cambios y las tarjetas. Los datos solo se guardarán cuando los revises y pulses Guardar.</p>
    {match.internal_fixture_id && <p>En un derbi, cada equipo registra sus propios cambios y tarjetas.</p>}
    {loading && <p role="status">Cargando los eventos guardados…</p>}
    {loadError && <p className="form-error">No se pudieron cargar los eventos: {loadError}. <button className="secondary-button compact" onClick={() => { setLoadError(''); setLoading(true); setRetry((value) => value + 1) }} type="button">Reintentar</button></p>}
    <fieldset className="match-report-fields" disabled={disabled}>
      <div className="form-field"><label htmlFor="match-report-file">Importar acta PDF (opcional)</label><input accept="application/pdf,.pdf" id="match-report-file" onChange={(event) => void selectFile(event.target.files?.[0])} type="file" /><small>El PDF se procesa en este navegador; no se envía ni se almacena. Al importar se sustituyen los eventos del formulario.</small></div>
      <div className="match-report-scores">
        <div className="form-field"><label htmlFor="match-report-team-score">Puntos del equipo</label><input id="match-report-team-score" max="250" min="0" onChange={(event) => { setReviewed(false); setTeamScore(event.target.value) }} type="number" value={teamScore} /></div>
        <div className="form-field"><label htmlFor="match-report-opponent-score">Puntos del rival</label><input id="match-report-opponent-score" max="250" min="0" onChange={(event) => { setReviewed(false); setOpponentScore(event.target.value) }} type="number" value={opponentScore} /></div>
        <div className="form-field"><label htmlFor="match-report-duration">Duración (minutos)</label><input id="match-report-duration" max="240" min="1" onChange={(event) => { setReviewed(false); setDuration(event.target.value) }} type="number" value={duration} /></div>
      </div>
      {canReview && <section className="match-report-events"><div className="match-detail-section-heading"><h3>Cambios y tarjetas del equipo</h3><button className="secondary-button compact" onClick={() => { setReviewed(false); setEvents((current) => [...current, { key: crypto.randomUUID(), source: 'Añadido manualmente', event_type: 'substitution', event_minute: '', player_id: '', replacement_player_id: '', return_minute: null }]) }} type="button">Añadir evento</button></div>
        <p>Usa otro cambio si una jugadora vuelve a entrar. En las amarillas, comprueba el minuto real de regreso ({yellowCardSuspension(match.rugby_format)} minutos de suspensión).</p>
        {events.length === 0 && <p>No hay eventos añadidos. Confirma que no hubo cambios ni tarjetas antes de guardar.</p>}
        {events.map((event, index) => <div className="match-report-event" key={event.key}>
          <span className="match-report-event-number">Evento {index + 1}</span>
          <select aria-label={`Tipo de evento ${index + 1}`} onChange={(input) => updateEvent(event.key, { event_type: input.target.value as DraftEvent['event_type'], replacement_player_id: input.target.value === 'substitution' ? '' : null, return_minute: input.target.value === 'yellow_card' && event.event_minute !== '' ? Math.min(Number(duration), event.event_minute + yellowCardSuspension(match.rugby_format)) : input.target.value === 'yellow_card' ? '' : null })} value={event.event_type}><option value="substitution">Cambio</option><option value="yellow_card">Tarjeta amarilla</option><option value="red_card">Tarjeta roja</option></select>
          <select aria-label={`Jugadora del evento ${index + 1}`} onChange={(input) => updateEvent(event.key, { player_id: input.target.value })} value={event.player_id}><option value="">Jugadora que sale / recibe tarjeta</option>{players.map((entry) => <option key={entry.player_id} value={entry.player_id}>{playerLabel(entry)}</option>)}</select>
          {event.event_type === 'substitution' && <select aria-label={`Jugadora que entra en el evento ${index + 1}`} onChange={(input) => updateEvent(event.key, { replacement_player_id: input.target.value })} value={event.replacement_player_id ?? ''}><option value="">Jugadora que entra</option>{players.map((entry) => <option key={entry.player_id} value={entry.player_id}>{playerLabel(entry)}</option>)}</select>}
          <label>Minuto<input aria-label={`Minuto del evento ${index + 1}`} max={duration || 240} min="0" onChange={(input) => {
            const minute = input.target.value === '' ? '' : Number(input.target.value)
            updateEvent(event.key, { event_minute: minute, ...(event.event_type === 'yellow_card' && event.return_minute !== null ? { return_minute: minute === '' ? '' : Math.min(Number(duration), minute + yellowCardSuspension(match.rugby_format)) } : {}) })
          }} type="number" value={event.event_minute} /></label>
          {event.event_type === 'yellow_card' && <>
            {event.return_minute !== null && <label>Regreso<input aria-label={`Minuto de regreso del evento ${index + 1}`} max={duration || 240} min="0" onChange={(input) => updateEvent(event.key, { return_minute: input.target.value === '' ? '' : Number(input.target.value) })} type="number" value={event.return_minute} /></label>}
            <label className="match-report-no-return"><input checked={event.return_minute === null} onChange={(input) => updateEvent(event.key, { return_minute: input.target.checked ? null : event.event_minute === '' ? '' : Math.min(Number(duration), event.event_minute + yellowCardSuspension(match.rugby_format)) })} type="checkbox" /> No regresó al campo</label>
          </>}
          <button aria-label={`Quitar evento ${index + 1}`} className="secondary-button compact" onClick={() => { setReviewed(false); setEvents((current) => current.filter((item) => item.key !== event.key)) }} type="button">Quitar</button>
        </div>)}
        {!loading && !loadError && (validationError ? <p className="form-error" role="alert">{validationError}</p> : <section className="match-report-minutes" aria-label="Vista previa de minutos"><h3>Minutos por jugadora</h3><dl>{players.map((entry) => <div key={entry.player_id}><dt>{playerLabel(entry)}</dt><dd>{preview.get(entry.player_id) ?? 0} min</dd></div>)}</dl></section>)}
      </section>}
      {officialWithoutLineup && <p className="form-error">Publica primero la convocatoria para registrar los minutos del partido.</p>}
      {!officialWithoutLineup && <label className="match-report-review"><input checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} type="checkbox" /> Confirmo que el partido ha terminado y he revisado el resultado{canReview ? ', todos los cambios, las tarjetas y los minutos de juego' : ''}.</label>}
    </fieldset>
    {message && <p aria-live="polite" className="match-report-message">{message}</p>}
    <div className="match-detail-actions"><button className="secondary-button" disabled={busy} onClick={onClose} type="button">Cancelar</button><button className="primary-button" disabled={!canSave} onClick={() => void save()} type="button">{busy ? 'Guardando…' : 'Guardar'}</button></div>
  </Modal>
}

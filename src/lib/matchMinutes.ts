import type { MatchLineup, RugbyFormat } from '../types'

export type SavedReportEvent = {
  event_type: 'substitution' | 'yellow_card' | 'red_card'
  event_minute: number
  player_id: string
  replacement_player_id: string | null
  return_minute: number | null
}

export type MatchReportValues = {
  scores: { team: number; opponent: number }
  duration: number
  events: SavedReportEvent[]
}

export function yellowCardSuspension(format: RugbyFormat) {
  return format === 'sevens' ? 2 : 10
}

type PlayerState = { enteredAt: number | null; minutes: number; suspended: boolean; returnsAt: number | null; sentOff: boolean }

// Los cambios pueden abrir varios tramos para una misma jugadora. El regreso
// de una amarilla es el minuto revisado por el entrenador, no una suma fija.
export function calculateMatchMinutes(lineup: Pick<MatchLineup, 'player_id' | 'role'>[], duration: number, events: SavedReportEvent[], format: RugbyFormat) {
  if (!Number.isInteger(duration) || duration < 1 || duration > 240) throw new Error('Revisa la duración del partido.')
  if (events.length > 300) throw new Error('Revisa el número de eventos del partido.')
  const states = new Map<string, PlayerState>(lineup.map((entry) => [entry.player_id, {
    enteredAt: entry.role === 'starter' ? 0 : null, minutes: 0, suspended: false, returnsAt: null, sentOff: false,
  }]))

  function resumeUntil(minute: number) {
    for (const state of states.values()) {
      if (state.suspended && state.returnsAt !== null && state.returnsAt <= minute && !state.sentOff) {
        state.enteredAt = state.returnsAt
        state.suspended = false
        state.returnsAt = null
      }
    }
  }

  function leave(state: PlayerState, minute: number) {
    if (state.enteredAt !== null) state.minutes += minute - state.enteredAt
    state.enteredAt = null
  }

  const chronological = events.map((event, index) => ({ event, index })).sort((a, b) => a.event.event_minute - b.event.event_minute || a.index - b.index)
  for (const { event, index } of chronological) {
    const fail: (message: string) => never = (message) => { throw new Error(`Evento ${index + 1}: ${message}`) }
    if (!Number.isInteger(event.event_minute) || event.event_minute < 0 || event.event_minute > duration) fail('indica un minuto entre 0 y la duración del partido.')
    const state = states.get(event.player_id)
    if (!state) fail('selecciona una jugadora de la convocatoria.')
    if (event.event_type !== 'yellow_card' && event.return_minute !== null) fail('solo las amarillas tienen minuto de regreso.')
    resumeUntil(event.event_minute)
    if (event.event_type === 'substitution') {
      const incoming = event.replacement_player_id ? states.get(event.replacement_player_id) : undefined
      if (!incoming || event.player_id === event.replacement_player_id) fail('selecciona dos jugadoras distintas de la convocatoria.')
      if (state.enteredAt === null) fail('la jugadora que sale no está en el campo.')
      if (incoming.enteredAt !== null || incoming.suspended || incoming.sentOff) fail('la jugadora que entra ya está jugando, está suspendida o ha sido expulsada.')
      leave(state, event.event_minute)
      incoming.enteredAt = event.event_minute
    } else {
      if (event.replacement_player_id !== null) fail('las tarjetas no incluyen una jugadora que entra.')
      if (state.sentOff) fail('la jugadora ya ha sido expulsada.')
      if (event.event_type === 'yellow_card') {
        if (state.enteredAt === null) fail('la jugadora que recibe la amarilla no está en el campo.')
        if (event.return_minute !== null && (!Number.isInteger(event.return_minute) || event.return_minute < Math.min(duration, event.event_minute + yellowCardSuspension(format)) || event.return_minute > duration)) fail('revisa el regreso tras la amarilla; debe respetar la suspensión y la duración del partido.')
        leave(state, event.event_minute)
        state.suspended = true
        state.returnsAt = event.return_minute
      } else if (event.event_type === 'red_card') {
        leave(state, event.event_minute)
        state.sentOff = true
        state.suspended = false
        state.returnsAt = null
      } else fail('selecciona un tipo de evento válido.')
    }
  }
  resumeUntil(duration)
  for (const state of states.values()) leave(state, duration)
  return new Map([...states].map(([playerId, state]) => [playerId, state.minutes]))
}

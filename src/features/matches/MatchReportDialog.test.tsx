import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { makeMatch, makeProfile } from '../../test/fixtures'
import type { MatchLineup } from '../../types'
import { MatchReportDialog } from './MatchReportDialog'
import { loadMatchReportEvents, readMatchReportPdf } from '../../services/matchReportService'
import type { ParsedMatchReport } from '../../lib/matchReportParser'

vi.mock('../../services/matchReportService', () => ({ readMatchReportPdf: vi.fn(), loadMatchReportEvents: vi.fn() }))
const match = makeMatch({ opponent: 'Ingenieros de Soria', is_home: true, match_kind: 'official', rugby_format: 'xv', lineup_published: true })
const lineup = [
  { match_id: match.id, player_id: 'player-1', role: 'starter', slot_number: 1, sort_order: 1 },
  { match_id: match.id, player_id: 'player-2', role: 'substitute', slot_number: 16, sort_order: 16 },
] as MatchLineup[]
const profiles = [makeProfile({ display_name: 'Ana' }), makeProfile({ id: 'player-2', display_name: 'Lucía' })]
const parsed: ParsedMatchReport = { date: null, homeTeam: 'Unizar femenino', awayTeam: 'Ingenieros de Soria', homeScore: 46, awayScore: 7, recognized: true, events: { home: [{ type: 'substitution', dorsal: 1, replacementDorsal: 16, minute: 40 }], away: [] } }
const pdf = () => new File(['pdf'], 'acta.pdf', { type: 'application/pdf' })
const fillScores = () => {
  fireEvent.change(screen.getByLabelText('Puntos del equipo'), { target: { value: '46' } })
  fireEvent.change(screen.getByLabelText('Puntos del rival'), { target: { value: '7' } })
}
const addChange = (index: number, minute: number, out: string, incoming: string) => {
  fireEvent.click(screen.getByRole('button', { name: 'Añadir evento' }))
  fireEvent.change(screen.getByLabelText(`Jugadora del evento ${index}`), { target: { value: out } })
  fireEvent.change(screen.getByLabelText(`Jugadora que entra en el evento ${index}`), { target: { value: incoming } })
  fireEvent.change(screen.getByLabelText(`Minuto del evento ${index}`), { target: { value: String(minute) } })
}
const confirm = () => fireEvent.click(screen.getByLabelText(/Confirmo que el partido ha terminado/))

describe('MatchReportDialog', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(readMatchReportPdf).mockResolvedValue(parsed); vi.mocked(loadMatchReportEvents).mockResolvedValue([]) })
  test('imports into a local draft and saves only data after explicit review', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<MatchReportDialog match={match} lineup={lineup} profiles={profiles} onClose={vi.fn()} onSave={onSave} />)
    fireEvent.change(screen.getByLabelText('Importar acta PDF (opcional)'), { target: { files: [pdf()] } })
    await waitFor(() => expect(screen.getByLabelText('Puntos del equipo')).toHaveValue(46))
    expect(screen.getByLabelText('Jugadora del evento 1')).toHaveValue('player-1')
    expect(screen.getByLabelText('Jugadora que entra en el evento 1')).toHaveValue('player-2')
    expect(within(screen.getByRole('region', { name: 'Vista previa de minutos' })).getAllByText('40 min')).toHaveLength(2)
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()
    confirm()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledExactlyOnceWith({ scores: { team: 46, opponent: 7 }, duration: 80, events: [{ event_type: 'substitution', event_minute: 40, player_id: 'player-1', replacement_player_id: 'player-2', return_minute: null }] }))
  })
  test('records manual changes and reentries without selecting a PDF', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<MatchReportDialog match={match} lineup={lineup} profiles={profiles} onClose={vi.fn()} onSave={onSave} />)
    fillScores(); addChange(1, 20, 'player-1', 'player-2'); addChange(2, 60, 'player-2', 'player-1')
    expect(screen.getAllByText('40 min')).toHaveLength(2)
    confirm(); fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ events: expect.arrayContaining([expect.objectContaining({ event_minute: 60, player_id: 'player-2', replacement_player_id: 'player-1' })]) })))
    expect(readMatchReportPdf).not.toHaveBeenCalled()
  })
  test('requires reviewing again after changing previously confirmed data', () => {
    render(<MatchReportDialog match={match} lineup={lineup} profiles={profiles} onClose={vi.fn()} onSave={vi.fn()} />)
    fillScores(); confirm()
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled()
    fireEvent.change(screen.getByLabelText('Duración (minutos)'), { target: { value: '70' } })
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()
    expect(screen.getByLabelText(/Confirmo que/)).not.toBeChecked()
  })
  test('blocks inconsistent substitutions and missing minute values', () => {
    const onSave = vi.fn()
    render(<MatchReportDialog match={match} lineup={lineup} profiles={profiles} onClose={vi.fn()} onSave={onSave} />)
    fillScores(); addChange(1, 20, 'player-2', 'player-1'); confirm()
    expect(screen.getByRole('alert')).toHaveTextContent('no está en el campo')
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Minuto del evento 1'), { target: { value: '' } })
    expect(screen.getByRole('alert')).toHaveTextContent('indica un minuto')
    expect(onSave).not.toHaveBeenCalled()
  })
  test('proposes the seven suspension and lets the coach correct the return or record no return', () => {
    render(<MatchReportDialog match={{ ...match, rugby_format: 'sevens' }} lineup={lineup} profiles={profiles} onClose={vi.fn()} onSave={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Añadir evento' }))
    fireEvent.change(screen.getByLabelText('Tipo de evento 1'), { target: { value: 'yellow_card' } })
    fireEvent.change(screen.getByLabelText('Jugadora del evento 1'), { target: { value: 'player-1' } })
    fireEvent.change(screen.getByLabelText('Minuto del evento 1'), { target: { value: '4' } })
    expect(screen.getByLabelText('Minuto de regreso del evento 1')).toHaveValue(6)
    expect(screen.getByText('12 min')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Minuto de regreso del evento 1'), { target: { value: '7' } })
    expect(screen.getByText('11 min')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('No regresó al campo'))
    expect(screen.getByText('4 min')).toBeInTheDocument()
  })
  test('reloads saved events before allowing corrections, without another PDF', async () => {
    vi.mocked(loadMatchReportEvents).mockResolvedValue([{ event_type: 'substitution', event_minute: 55, player_id: 'player-1', replacement_player_id: 'player-2', return_minute: null }])
    render(<MatchReportDialog match={{ ...match, team_score: 46, opponent_score: 7, duration_minutes: 80, report_events_reviewed: true }} lineup={lineup} profiles={profiles} onClose={vi.fn()} onSave={vi.fn()} />)
    await waitFor(() => expect(screen.getByLabelText('Minuto del evento 1')).toHaveValue(55))
    expect(screen.getByText('55 min')).toBeInTheDocument()
    expect(screen.getByText('25 min')).toBeInTheDocument()
    expect(loadMatchReportEvents).toHaveBeenCalledWith(match.id)
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()
  })
  test('prevents overwriting saved events when their load fails', async () => {
    vi.mocked(loadMatchReportEvents).mockRejectedValue(new Error('Sin conexión'))
    render(<MatchReportDialog match={{ ...match, team_score: 46, opponent_score: 7 }} lineup={lineup} profiles={profiles} onClose={vi.fn()} onSave={vi.fn()} />)
    await screen.findByRole('button', { name: 'Reintentar' })
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()
    expect(screen.getByLabelText('Puntos del equipo')).toBeDisabled()
  })
  test('retains manual data if the optional PDF cannot be read', async () => {
    vi.mocked(readMatchReportPdf).mockRejectedValue(new Error('PDF escaneado'))
    render(<MatchReportDialog match={match} lineup={lineup} profiles={profiles} onClose={vi.fn()} onSave={vi.fn()} />)
    fillScores(); addChange(1, 55, 'player-1', 'player-2')
    fireEvent.change(screen.getByLabelText('Importar acta PDF (opcional)'), { target: { files: [pdf()] } })
    await screen.findByText(/No se pudo leer el PDF/)
    expect(screen.getByLabelText('Minuto del evento 1')).toHaveValue(55)
    confirm(); expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled()
  })
  test('requires a published official lineup but permits a friendly result without minutes', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const props = { lineup, profiles, onClose: vi.fn(), onSave }
    const { rerender } = render(<MatchReportDialog {...props} match={{ ...match, lineup_published: false }} />)
    expect(screen.getByText(/Publica primero la convocatoria/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()
    rerender(<MatchReportDialog {...props} match={{ ...match, match_kind: 'friendly' }} />)
    fillScores(); confirm(); fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ scores: { team: 46, opponent: 7 }, duration: 80, events: [] }))
  })
  test('cancelling an imported draft never persists any data', async () => {
    const onSave = vi.fn(); const onClose = vi.fn()
    render(<MatchReportDialog match={match} lineup={lineup} profiles={profiles} onClose={onClose} onSave={onSave} />)
    fireEvent.change(screen.getByLabelText('Importar acta PDF (opcional)'), { target: { files: [pdf()] } })
    await waitFor(() => expect(screen.getByLabelText('Puntos del equipo')).toHaveValue(46))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(onSave).not.toHaveBeenCalled()
  })
})

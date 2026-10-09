import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { makeMatch, makeMembership, makeProfile } from '../../test/fixtures'
import { fetchMatchLineupReservations } from '../../services/derbyReservationsService'
import type { MatchLineupReservation } from '../../lib/matchParticipation'
import { MatchLineupDialog } from './MatchLineupDialog'

vi.mock('../../services/derbyReservationsService', () => ({ fetchMatchLineupReservations: vi.fn() }))
vi.mock('../../services/matchesService', () => ({ fetchSeasonPlayerMinutes: vi.fn().mockResolvedValue(new Map()) }))
const fetchReservations = vi.mocked(fetchMatchLineupReservations)
const player = makeProfile()
const reservation: MatchLineupReservation = { player_id: player.id, match_id: 'other', team_name: 'Unizar B', match_date: '2026-09-20', is_derby: true }
const props = {
  availability: [{ match_id: 'match-1', player_id: player.id, status: 'available' as const, comment: null, updated_at: player.created_at }],
  entries: [], match: makeMatch({ internal_fixture_id: 'derby', lineup_published: false }), memberships: [makeMembership()],
  profiles: [player], onClose: vi.fn(), onSave: vi.fn(),
}

describe('MatchLineupDialog: reservas protegidas del derbi', () => {
  beforeEach(() => { fetchReservations.mockReset() })

  test('no muestra candidatas ni permite guardar hasta consultar el borrador ajeno', async () => {
    let resolve!: (ids: MatchLineupReservation[]) => void
    fetchReservations.mockReturnValue(new Promise((done) => { resolve = done }))
    render(<MatchLineupDialog {...props} canBorrowFromOtherTeams={false} />)
    expect(screen.getByText(/Comprobando las jugadoras reservadas/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Añadir' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar alineación' })).toBeDisabled()
    await act(async () => resolve([reservation]))
    expect(screen.queryByText(player.display_name)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar alineación' })).toBeEnabled()
  })

  test('si falla la consulta no deja el filtro abierto como si no existieran reservas', async () => {
    fetchReservations.mockRejectedValue(new Error('Sin conexión'))
    render(<MatchLineupDialog {...props} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión')
    expect(screen.queryByRole('button', { name: 'Añadir' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar alineación' })).toBeDisabled()
  })

  test('al volver a abrir obtiene las reservas nuevas y libera las jugadoras retiradas', async () => {
    fetchReservations.mockResolvedValueOnce([reservation]).mockResolvedValueOnce([])
    const view = render(<MatchLineupDialog {...props} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar alineación' })).toBeEnabled())
    expect(screen.queryByRole('button', { name: 'Añadir' })).not.toBeInTheDocument()
    view.unmount()
    render(<MatchLineupDialog {...props} />)
    expect(await screen.findByRole('button', { name: 'Añadir' })).toBeInTheDocument()
    expect(fetchReservations).toHaveBeenCalledTimes(2)
  })

  test('la convocatoria publicada se consulta sin cargar reservas del borrador', () => {
    render(<MatchLineupDialog {...props} match={{ ...props.match, lineup_published: true }} />)
    expect(fetchReservations).not.toHaveBeenCalled()
  })

  test('en partidos separados conserva la jugadora visible y marca la reserva sin permitir añadir o arrastrar', async () => {
    fetchReservations.mockResolvedValue([{ ...reservation, is_derby: false }])
    const view = render(<MatchLineupDialog {...props} match={{ ...props.match, internal_fixture_id: null }} />)
    const add = await screen.findByRole('button', { name: 'Añadir' })
    expect(add).toBeDisabled()
    expect(screen.getByText(/Convocada en otro partido/)).toHaveTextContent('Unizar B')
    expect(add.closest('article')).toHaveAttribute('draggable', 'false')
    expect(screen.getByText(player.display_name)).toBeInTheDocument()
    fireEvent.drop(screen.getByRole('dialog').querySelector('.lineup-slot')!, { dataTransfer: { getData: () => player.id } })
    expect(screen.queryByRole('combobox', { name: `Posición de ${player.display_name}` })).not.toBeInTheDocument()
    view.unmount()
    fetchReservations.mockResolvedValue([])
    render(<MatchLineupDialog {...props} match={{ ...props.match, internal_fixture_id: null }} />)
    expect(await screen.findByRole('button', { name: 'Añadir' })).toBeEnabled()
  })

  test('conserva una coincidencia anterior para poder retirarla y bloquea su guardado', async () => {
    fetchReservations.mockResolvedValue([{ ...reservation, is_derby: false }])
    render(<MatchLineupDialog {...props} match={{ ...props.match, internal_fixture_id: null }}
      entries={[{ match_id: props.match.id, player_id: player.id, slot_number: 16, sort_order: 16, role: 'substitute', position: null, updated_at: player.created_at }]} />)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Retíralas'))
    expect(screen.getByRole('button', { name: 'Guardar alineación' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: `Quitar a ${player.display_name}` }))
    expect(screen.getByRole('button', { name: 'Guardar alineación' })).toBeEnabled()
  })

  test('la RPC actualizada libera una reserva antigua que sigue en la caché local', async () => {
    fetchReservations.mockResolvedValue([])
    render(<MatchLineupDialog {...props} match={{ ...props.match, internal_fixture_id: null }}
      reservations={[{ ...reservation, is_derby: false }]} />)
    expect(await screen.findByRole('button', { name: 'Añadir' })).toBeEnabled()
    expect(screen.queryByText(/Convocada en otro partido/)).not.toBeInTheDocument()
  })
})

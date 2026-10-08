import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { makeMatch, makeMembership, makeProfile } from '../../test/fixtures'
import { fetchDerbyReservedPlayers } from '../../services/derbyReservationsService'
import { MatchLineupDialog } from './MatchLineupDialog'

vi.mock('../../services/derbyReservationsService', () => ({ fetchDerbyReservedPlayers: vi.fn() }))
vi.mock('../../services/matchesService', () => ({ fetchSeasonPlayerMinutes: vi.fn().mockResolvedValue(new Map()) }))
const fetchReservations = vi.mocked(fetchDerbyReservedPlayers)
const player = makeProfile()
const props = {
  availability: [{ match_id: 'match-1', player_id: player.id, status: 'available' as const, comment: null, updated_at: player.created_at }],
  entries: [], match: makeMatch({ internal_fixture_id: 'derby', lineup_published: false }), memberships: [makeMembership()],
  profiles: [player], onClose: vi.fn(), onSave: vi.fn(),
}

describe('MatchLineupDialog: reservas protegidas del derbi', () => {
  beforeEach(() => { fetchReservations.mockReset() })

  test('no muestra candidatas ni permite guardar hasta consultar el borrador ajeno', async () => {
    let resolve!: (ids: string[]) => void
    fetchReservations.mockReturnValue(new Promise((done) => { resolve = done }))
    render(<MatchLineupDialog {...props} canBorrowFromOtherTeams={false} />)
    expect(screen.getByText(/Comprobando las jugadoras reservadas/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Añadir' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar alineación' })).toBeDisabled()
    await act(async () => resolve([player.id]))
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
    fetchReservations.mockResolvedValueOnce([player.id]).mockResolvedValueOnce([])
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
})

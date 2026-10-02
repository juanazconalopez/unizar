import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { makeMembership, makeProfile, makeSeason } from '../../test/fixtures'
import { PlayerLicenseDialog } from './PlayerLicenseDialog'

const season = makeSeason()
const person = makeProfile()

describe('modificar ficha de la temporada activa', () => {
  it('guarda solo el tipo de ficha y vuelve al perfil al terminar', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const close = vi.fn()
    render(<PlayerLicenseDialog membership={makeMembership({ license_type: 'regional', season_team_id: 'team-1' })} onClose={close} onSave={save} person={person} season={season} />)
    expect(screen.getByLabelText('Temporada activa')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Temporada activa')).toHaveValue(season.name)
    expect(screen.getAllByRole('combobox')).toHaveLength(1)
    expect(screen.getByLabelText('Tipo de ficha')).toHaveValue('regional')
    expect(screen.getByRole('option', { name: 'Solo entrenamientos' })).toHaveValue('training')
    fireEvent.change(screen.getByLabelText('Tipo de ficha'), { target: { value: 'training' } })
    expect(save).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(save).toHaveBeenCalledWith(season, person, 'training'))
    await waitFor(() => expect(close).toHaveBeenCalledOnce())
  })
  it('cancelar vuelve al perfil sin guardar el borrador', () => {
    const save = vi.fn()
    const close = vi.fn()
    render(<PlayerLicenseDialog membership={makeMembership({ license_type: 'national', national_starts: 6 })} onClose={close} onSave={save} person={person} season={season} />)
    expect(screen.getByText(/No puede jugar partidos regionales/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Tipo de ficha'), { target: { value: 'regional' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(close).toHaveBeenCalledOnce()
    expect(save).not.toHaveBeenCalled()
  })
  it('espera a completar el guardado antes de volver y bloquea acciones mientras tanto', async () => {
    let resolveSave!: () => void
    const close = vi.fn()
    render(<PlayerLicenseDialog membership={makeMembership({ license_type: 'none' })} onClose={close} onSave={() => new Promise<void>((resolve) => { resolveSave = resolve })} person={person} season={season} />)
    fireEvent.change(screen.getByLabelText('Tipo de ficha'), { target: { value: 'regional' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(close).not.toHaveBeenCalled()
    resolveSave()
    await waitFor(() => expect(close).toHaveBeenCalledOnce())
  })
  it('muestra el error sin cerrar ni dar el cambio por guardado', async () => {
    const close = vi.fn()
    render(<PlayerLicenseDialog membership={makeMembership({ license_type: 'none' })} onClose={close} onSave={vi.fn().mockRejectedValue(new Error('Sin conexión'))} person={person} season={season} />)
    fireEvent.change(screen.getByLabelText('Tipo de ficha'), { target: { value: 'regional' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión')
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled()
    expect(close).not.toHaveBeenCalled()
  })
})

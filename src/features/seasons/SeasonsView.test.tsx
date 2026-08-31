import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { todayIso } from '../../lib/dates'
import { makeMembership, makeProfile, makeProfilePrivateDetails, makeSeason } from '../../test/fixtures'
import { SeasonsView } from './SeasonsView'

const fileMocks = vi.hoisted(() => ({ downloadText: vi.fn() }))
vi.mock('../../lib/fileExport', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../lib/fileExport')>(),
  downloadText: fileMocks.downloadText,
}))

describe('SeasonsView', () => {
  test('manages only eligible participants', async () => {
    const user = userEvent.setup()
    const season = makeSeason()
    const active = makeProfile()
    const available = makeProfile({ id: 'player-2', display_name: 'María López' })
    const inactive = makeProfile({ id: 'inactive', display_name: 'Elena García', is_active: false })
    const archived = makeProfile({ id: 'archived', display_name: 'Archivada', is_archived: true })
    const onToggleMembership = vi.fn().mockResolvedValue(undefined)
    render(
      <SeasonsView
        seasons={[season]}
        profiles={[active, available, inactive, archived]}
        memberships={[makeMembership()]}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onUpdate={vi.fn()}
        onToggleMembership={onToggleMembership}
      />,
    )

    expect(screen.getByRole('button', { name: 'Exportar jugadoras activas XML' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Gestionar participantes' }))
    const card = screen.getByText('Temporada 2026').closest('article')!
    expect(within(card).getByRole('checkbox', { name: /Ana Martín/ })).toBeChecked()
    expect(within(card).getByRole('checkbox', { name: /Elena García/ })).toBeDisabled()
    expect(within(card).queryByText('Archivada')).not.toBeInTheDocument()

    await user.click(within(card).getByRole('checkbox', { name: /María López/ }))
    expect(onToggleMembership).toHaveBeenCalledWith(season, available, true)
  })

  test('shows the player export only inside the active season card', () => {
    render(<SeasonsView
      seasons={[
        makeSeason(),
        makeSeason({ id: 'past-season', name: 'Temporada pasada', start_date: '2025-01-01', end_date: '2025-12-31' }),
      ]}
      profiles={[makeProfile()]}
      memberships={[makeMembership()]}
      onCreate={vi.fn()}
      onDelete={vi.fn()}
      onUpdate={vi.fn()}
      onToggleMembership={vi.fn()}
    />)

    expect(within(screen.getByText('Temporada 2026').closest('article')!).getByRole('button', { name: 'Exportar jugadoras activas XML' })).toBeInTheDocument()
    expect(within(screen.getByText('Temporada pasada').closest('article')!).queryByRole('button', { name: /Exportar jugadoras/ })).not.toBeInTheDocument()
  })

  test('exports contact details, age and birth date for active season players', async () => {
    const user = userEvent.setup()
    const birthDate = `${Number(todayIso().slice(0, 4)) - 20}-01-01`
    render(<SeasonsView
      seasons={[makeSeason()]}
      profiles={[makeProfile()]}
      profilePrivateDetails={[makeProfilePrivateDetails({ birth_date: birthDate })]}
      memberships={[makeMembership()]}
      onCreate={vi.fn()}
      onDelete={vi.fn()}
      onUpdate={vi.fn()}
      onToggleMembership={vi.fn()}
    />)

    await user.click(screen.getByRole('button', { name: 'Exportar jugadoras activas XML' }))
    expect(fileMocks.downloadText).toHaveBeenCalledWith(
      'jugadoras-activas-Temporada 2026.xml',
      expect.stringContaining(`email="ana@example.com" telefono="+34 600 000 000" edad="20" fecha-nacimiento="${birthDate}"`),
      'application/xml',
    )
  })

  test('creates a season from the form', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(<SeasonsView seasons={[]} profiles={[]} memberships={[]} onCreate={onCreate} onDelete={vi.fn()} onUpdate={vi.fn()} onToggleMembership={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Nueva temporada' }))
    await user.type(screen.getByLabelText('Nombre'), 'Temporada 2027')
    await user.type(screen.getByLabelText('Fecha de inicio'), '2027-01-01')
    await user.type(screen.getByLabelText('Fecha de finalización'), '2027-12-31')
    await user.click(screen.getByRole('button', { name: 'Crear temporada' }))

    expect(onCreate).toHaveBeenCalledWith({ name: 'Temporada 2027', start_date: '2027-01-01', end_date: '2027-12-31' })
  })

  test('edits a season and warns about cascading data before deleting it', async () => {
    const user = userEvent.setup()
    const season = makeSeason()
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    const onDelete = vi.fn().mockResolvedValue(undefined)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<SeasonsView seasons={[season]} profiles={[]} memberships={[makeMembership()]} onCreate={vi.fn()} onDelete={onDelete} onUpdate={onUpdate} onToggleMembership={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Editar' }))
    expect(screen.getByRole('heading', { name: 'Editar temporada' })).toBeInTheDocument()
    await user.clear(screen.getByLabelText('Nombre'))
    await user.type(screen.getByLabelText('Nombre'), 'Temporada corregida')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(onUpdate).toHaveBeenCalledWith(season, expect.objectContaining({ name: 'Temporada corregida' }))

    await user.click(screen.getByRole('button', { name: 'Editar' }))
    await user.click(screen.getByRole('button', { name: 'Eliminar temporada' }))
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('entrenamientos de campo y asistencias'))
    expect(onDelete).toHaveBeenCalledWith(season)
  })
})

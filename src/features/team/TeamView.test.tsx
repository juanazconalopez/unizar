import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { makeProfile, makeProfilePrivateDetails } from '../../test/fixtures'
import { TeamView } from './TeamView'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('TeamView', () => {
  test('keeps the owner list compact and opens the complete read-only profile', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-08-31T12:00:00'))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<TeamView currentUserId="owner-1" onUpdate={vi.fn()} profiles={[makeProfile()]} profilePrivateDetails={[makeProfilePrivateDetails()]} />)

    const card = screen.getByRole('button', { name: 'Ver datos de Ana Martín' })
    expect(card).toHaveTextContent('ana@example.com')
    expect(card).toHaveTextContent('+34 600 000 000')
    expect(card).toHaveTextContent('28 años')
    expect(card).toHaveTextContent('Activa')
    expect(card).toHaveTextContent('Jugadora')
    expect(card).toHaveTextContent('Datos completos')
    expect(within(card).queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Desautorizar' })).not.toBeInTheDocument()

    await user.click(card)
    const dialog = screen.getByRole('dialog', { name: 'Ana Martín' })
    expect(within(dialog).getByRole('link', { name: 'ana@example.com' })).toHaveAttribute('href', 'mailto:ana@example.com')
    expect(within(dialog).getByText('15 de abril de 1998')).toBeInTheDocument()
    expect(within(dialog).queryByRole('checkbox')).not.toBeInTheDocument()
  })

  test('edits details and permissions only after opening the detail pencil', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const profile = makeProfile()
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<TeamView currentUserId="owner-1" onSave={onSave} onUpdate={vi.fn()} profiles={[profile]} profilePrivateDetails={[makeProfilePrivateDetails()]} />)

    await user.click(screen.getByRole('button', { name: 'Ver datos de Ana Martín' }))
    await user.click(screen.getByRole('button', { name: 'Editar datos de Ana Martín' }))
    const dialog = screen.getByRole('dialog', { name: 'Ana Martín' })
    const name = within(dialog).getByLabelText('Nombre y apellidos')
    await user.clear(name)
    await user.type(name, 'Ana Martín López')
    await user.click(within(dialog).getByRole('checkbox', { name: 'Entrenadora' }))
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }))

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('estado o los permisos'))
    expect(onSave).toHaveBeenCalledWith(profile, {
      displayName: 'Ana Martín López', phone: '+34 600 000 000', birthDate: '1998-04-15',
      isActive: true, isPlayer: true, isCoach: true, isViewer: false, isOwner: false,
    })
  })

  test('opens an accent-insensitive name search and filters every account state', async () => {
    const user = userEvent.setup()
    render(<TeamView currentUserId="owner-1" onUpdate={vi.fn()} profiles={[
      makeProfile({ id: 'maria', display_name: 'María López' }),
      makeProfile({ id: 'clara', display_name: 'Clara Pérez' }),
      makeProfile({ id: 'archived', display_name: 'María Luisa', is_approved: false, is_active: false, is_archived: true }),
    ]} />)
    await user.click(screen.getByRole('button', { name: 'Buscar personas' }))
    const search = screen.getByRole('searchbox', { name: 'Buscar por nombre' })
    await user.type(search, 'maria')
    expect(screen.getByText('María López')).toBeInTheDocument()
    expect(screen.getByText('María Luisa')).toBeInTheDocument()
    expect(screen.queryByText('Clara Pérez')).not.toBeInTheDocument()
    await user.clear(search)
    await user.type(search, 'sin coincidencias')
    expect(screen.getByText('No hay personas que coincidan con “sin coincidencias”.')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('searchbox', { name: 'Buscar por nombre' })).not.toBeInTheDocument()
  })

  test('moves duplicate review and approval into the pending profile detail', async () => {
    const user = userEvent.setup()
    const registered = makeProfile({ id: 'registered', display_name: 'María López' })
    const pending = makeProfile({ id: 'pending', display_name: 'Maria Lopex', is_approved: false, is_active: false })
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    render(<TeamView currentUserId="owner-1" onUpdate={onUpdate} profiles={[registered, pending]} />)

    expect(screen.getByRole('button', { name: 'Ver datos de Maria Lopex' })).toHaveTextContent('Posible duplicado')
    await user.click(screen.getByRole('button', { name: 'Ver datos de Maria Lopex' }))
    expect(screen.getByText('Posible cuenta duplicada')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Aprobar como jugadora' }))
    expect(onUpdate).toHaveBeenCalledWith({ ...pending, is_approved: true, is_active: true, is_player: true })
  })

  test('keeps restore and deauthorization inside their profile details', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const member = makeProfile({ id: 'member', display_name: 'María López' })
    const archived = makeProfile({ id: 'archived', display_name: 'Paula Romero', is_approved: false, is_active: false, is_archived: true })
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    const onArchive = vi.fn().mockResolvedValue(undefined)
    render(<TeamView currentUserId="owner-1" onArchive={onArchive} onSave={vi.fn()} onUpdate={onUpdate} profiles={[member, archived]} />)

    await user.click(screen.getByRole('button', { name: 'Ver datos de María López' }))
    expect(screen.queryByRole('button', { name: 'Desautorizar' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Editar datos de María López' }))
    await user.click(screen.getByRole('button', { name: 'Desautorizar' }))
    expect(onArchive).toHaveBeenCalledWith(member)

    await user.click(screen.getByRole('button', { name: 'Ver usuarios desautorizados (1)' }))
    await user.click(screen.getByRole('button', { name: 'Ver datos de Paula Romero' }))
    await user.click(screen.getByRole('button', { name: 'Restaurar acceso' }))
    expect(onUpdate).toHaveBeenCalledWith({ ...archived, is_archived: false, is_approved: true, is_active: false })
  })
})

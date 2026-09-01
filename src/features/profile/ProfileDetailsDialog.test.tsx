import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { ProfileDetailsDialog } from './ProfileDetailsDialog'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('ProfileDetailsDialog', () => {
  test('shows the Google email as read-only and saves all editable details', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(<ProfileDetailsDialog currentName="Ana Martín" email="ana@example.com" onClose={onClose} onSave={onSave} />)
    const dialog = screen.getByRole('dialog', { name: 'Datos de perfil' })
    const name = within(dialog).getByLabelText('Nombre y apellidos')
    const email = within(dialog).getByLabelText('Email de Google')

    expect(email).toHaveValue('ana@example.com')
    expect(email).toHaveAttribute('readonly')
    await user.clear(name)
    await user.type(name, '  maría   lópez pérez  ')
    await user.type(within(dialog).getByLabelText('Teléfono'), '+34 600 123 123')
    await user.type(within(dialog).getByLabelText('Fecha de nacimiento'), '1997-05-12')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar datos' }))

    expect(onSave).toHaveBeenCalledWith({
      displayName: 'maría lópez pérez',
      phone: '+34 600 123 123',
      birthDate: '1997-05-12',
    })
    expect(onClose).toHaveBeenCalledOnce()
  })

  test('requires at least a name and a surname', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ProfileDetailsDialog currentName="Ana Martín" email="ana@example.com" onClose={vi.fn()} onSave={onSave} />)
    const dialog = screen.getByRole('dialog', { name: 'Datos de perfil' })
    const input = within(dialog).getByLabelText('Nombre y apellidos')

    await user.clear(input)
    await user.type(input, 'P')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar datos' }))

    expect(within(dialog).getByRole('alert')).toHaveTextContent('nombre y al menos un apellido')
    expect(onSave).not.toHaveBeenCalled()
  })

  test('supports the owner administration copy without changing the form fields', () => {
    render(<ProfileDetailsDialog
      currentName="Ana Martín"
      email="ana@example.com"
      eyebrow="ADMINISTRACIÓN DEL EQUIPO"
      helpText="El email procede de Google y no se puede modificar."
      title="Editar datos de Ana Martín"
      onClose={vi.fn()}
      onSave={vi.fn()}
    />)

    const dialog = screen.getByRole('dialog', { name: 'Editar datos de Ana Martín' })
    expect(within(dialog).getByText('ADMINISTRACIÓN DEL EQUIPO')).toBeInTheDocument()
    expect(within(dialog).getByText('El email procede de Google y no se puede modificar.')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Email de Google')).toHaveAttribute('readonly')
  })

  test('highlights only details that are still missing', () => {
    render(
      <ProfileDetailsDialog
        currentName="Ana Martín"
        currentPhone="+34 600 000 000"
        email="ana@example.com"
        highlightMissing
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    )

    expect(screen.getByLabelText(/^Teléfono/).closest('label')).not.toHaveClass('profile-field-missing')
    expect(screen.getByLabelText(/^Fecha de nacimiento/).closest('label')).toHaveClass('profile-field-missing')
    expect(screen.getByText('Falta completar este dato.')).toBeInTheDocument()
  })

  test('shows the current age for a completed birth date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-31T12:00:00'))
    render(
      <ProfileDetailsDialog
        currentBirthDate="2000-09-01"
        currentName="Ana Martín"
        email="ana@example.com"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    )

    expect(screen.getByText('Edad actual: 25 años.')).toBeInTheDocument()
  })

  test('keeps a selected player photo pending until all profile data is saved', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<ProfileDetailsDialog canEditPhoto currentName="Ana Martín" email="ana@example.com" onClose={vi.fn()} onSave={onSave} />)
    const file = new File(['photo'], 'ana.png', { type: 'image/png' })

    await user.upload(screen.getByLabelText('Seleccionar fotografía'), file)
    expect(await screen.findByAltText('Fotografía de Ana Martín')).toHaveAttribute('src', expect.stringContaining('data:image/png;base64,'))
    await user.click(screen.getByRole('button', { name: 'Guardar datos' }))

    expect(onSave).toHaveBeenCalledWith({ displayName: 'Ana Martín', phone: '', birthDate: '' }, file)
  })
})

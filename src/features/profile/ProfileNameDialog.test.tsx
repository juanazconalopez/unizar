import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { ProfileNameDialog } from './ProfileNameDialog'

describe('ProfileNameDialog', () => {
  test('saves a normalized name and surname', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(<ProfileNameDialog currentName="Ana Martín" onClose={onClose} onSave={onSave} />)
    const dialog = screen.getByRole('dialog', { name: 'Editar mi nombre' })
    const input = within(dialog).getByLabelText('Nombre y apellidos')

    await user.clear(input)
    await user.type(input, '  maría   lópez pérez  ')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar nombre' }))

    expect(onSave).toHaveBeenCalledWith('maría lópez pérez')
    expect(onClose).toHaveBeenCalledOnce()
  })

  test('requires at least a name and a surname', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ProfileNameDialog currentName="Ana Martín" onClose={vi.fn()} onSave={onSave} />)
    const dialog = screen.getByRole('dialog', { name: 'Editar mi nombre' })
    const input = within(dialog).getByLabelText('Nombre y apellidos')

    await user.clear(input)
    await user.type(input, 'P')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar nombre' }))

    expect(within(dialog).getByRole('alert')).toHaveTextContent('nombre y al menos un apellido')
    expect(onSave).not.toHaveBeenCalled()
  })
})

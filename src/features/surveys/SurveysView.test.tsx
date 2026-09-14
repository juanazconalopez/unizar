import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { SurveysView } from './SurveysView'

describe('SurveysView draft editor', () => {
  test('starts every new question as a single-choice question and permits unlimited options', async () => {
    const user = userEvent.setup()
    render(<SurveysView demo isOwner />)

    await user.click(screen.getByRole('button', { name: 'Crear encuesta' }))
    expect(screen.getByLabelText('Tipo')).toHaveValue('single')
    expect(screen.getByLabelText('Visibilidad')).toHaveValue('Privada')

    await user.click(screen.getByRole('button', { name: '+ Añadir opción' }))
    expect(screen.getAllByLabelText(/Opción \d+ de pregunta 1/)).toHaveLength(3)
    await user.click(screen.getByRole('button', { name: 'Quitar opción 3 de pregunta 1' }))
    expect(screen.getAllByLabelText(/Opción \d+ de pregunta 1/)).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: '+ Añadir pregunta' }))
    expect(screen.getAllByLabelText('Tipo')[1]).toHaveValue('single')
  })

  test('can publish directly from the draft editor', async () => {
    const user = userEvent.setup()
    render(<SurveysView demo isOwner />)

    await user.click(screen.getByRole('button', { name: 'Crear encuesta' }))
    await user.type(screen.getByLabelText('Título'), 'Valoración del viaje')
    await user.type(screen.getByLabelText('Pregunta 1'), '¿Cómo fue el viaje?')
    await user.click(screen.getByRole('button', { name: 'Publicar encuesta' }))

    expect(within(screen.getByRole('button', { name: /valoración del viaje/i })).getByText('Activa')).toBeInTheDocument()
  })

  test('keeps the optional description when publishing and shows it in the survey summary', async () => {
    const user = userEvent.setup()
    render(<SurveysView demo isOwner />)

    await user.click(screen.getByRole('button', { name: 'Crear encuesta' }))
    await user.type(screen.getByLabelText('Título'), 'Encuesta de recuperación')
    await user.type(screen.getByLabelText('Descripción / finalidad'), 'Queremos adaptar la carga de la próxima semana a vuestra recuperación.')
    await user.type(screen.getByLabelText('Pregunta 1'), '¿Cómo te encuentras tras el partido?')
    await user.click(screen.getByRole('button', { name: 'Publicar encuesta' }))

    const card = screen.getByRole('button', { name: /encuesta de recuperación/i })
    expect(within(card).getByText('Queremos adaptar la carga de la próxima semana a vuestra recuperación.')).toBeInTheDocument()
    await user.click(card)
    expect(within(screen.getByRole('dialog')).getByText('Queremos adaptar la carga de la próxima semana a vuestra recuperación.')).toBeInTheDocument()
  })

  test('does not expose private surveys or the private visibility to staff', async () => {
    const user = userEvent.setup()
    render(<SurveysView demo isOwner={false} />)

    expect(screen.queryByText('Seguimiento preventivo')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Crear encuesta' }))
    expect(screen.getByLabelText('Visibilidad')).toHaveValue('Gestión')
    expect(screen.queryByRole('option', { name: 'Privada' })).not.toBeInTheDocument()
  })

  test('opens results in a modal and shows the no-response state for a filtered player', async () => {
    const user = userEvent.setup()
    render(<SurveysView demo isOwner />)

    await user.click(screen.getByRole('button', { name: /valoración del inicio de temporada/i }))
    expect(screen.getByRole('dialog', { name: /encuesta 1/i })).toBeInTheDocument()
    await user.type(screen.getByPlaceholderText('Buscar jugadora de la temporada…'), 'Lucía')
    expect(screen.getByText((_, element) => element?.textContent === 'Lucía Moreno no ha respondido a la encuesta.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Guardar PDF' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Quitar filtro de jugadora' }))
    expect(screen.getByDisplayValue('')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar PDF' })).toBeInTheDocument()
  })

  test('opens the same editor from a draft result modal', async () => {
    const user = userEvent.setup()
    render(<SurveysView demo isOwner />)

    await user.click(screen.getByRole('button', { name: /seguimiento preventivo/i }))
    await user.click(screen.getByRole('button', { name: 'Editar encuesta' }))
    expect(screen.getByRole('dialog', { name: 'Editar encuesta' })).toBeInTheDocument()
  })
})

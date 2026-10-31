import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { SurveysView } from './SurveysView'
import { SessionQueryCache } from '../../services/sessionQueryCache'
import { navigationResourceKeys } from '../../services/navigationResources'
import * as surveysService from '../../services/surveysService'
import { makeSeason } from '../../test/fixtures'
import { todayIso } from '../../lib/dates'

afterEach(() => vi.restoreAllMocks())

describe('SurveysView draft editor', () => {
  test('a delayed list refresh cannot hide a newly saved survey', async () => {
    const resources = new SessionQueryCache(0)
    const season = makeSeason({ start_date: '2020-01-01', end_date: '2099-12-31' })
    const saved: surveysService.ManagedSurvey = { id: 'new', seasonId: season.id, title: 'Encuesta recién guardada', description: null, startsOn: todayIso(), endsOn: todayIso(), visibility: 'private', status: 'draft', responses: 0, recipients: 0 }
    await resources.load(navigationResourceKeys.surveys, () => Promise.resolve([]))
    let finishRefresh!: (surveys: surveysService.ManagedSurvey[]) => void
    vi.spyOn(surveysService, 'fetchManageSurveys').mockImplementationOnce(() => new Promise((resolve) => { finishRefresh = resolve })).mockResolvedValue([saved])
    vi.spyOn(surveysService, 'saveSurveyDraft').mockResolvedValue(saved.id)
    const user = userEvent.setup()
    render(<SurveysView resources={resources} isOwner seasons={[season]} />)
    expect(screen.queryByText('Cargando encuestas…')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Crear encuesta' }))
    await user.type(screen.getByLabelText('Título'), saved.title)
    await user.type(screen.getByLabelText('Pregunta 1'), '¿Cómo estás?')
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    expect(await screen.findByRole('button', { name: new RegExp(saved.title) })).toBeInTheDocument()
    await act(async () => { finishRefresh([]) })
    expect(screen.getByRole('button', { name: new RegExp(saved.title) })).toBeInTheDocument()
  })

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

  test('reorders whole questions in both directions and preserves their order when reopening a demo draft', async () => {
    const user = userEvent.setup()
    render(<SurveysView demo isOwner />)
    await user.click(screen.getByRole('button', { name: 'Crear encuesta' }))
    await user.type(screen.getByLabelText('Título'), 'Encuesta ordenada')
    expect(screen.getByRole('button', { name: 'Subir pregunta 1' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Bajar pregunta 1' })).toBeDisabled()
    await user.type(screen.getByLabelText('Pregunta 1'), 'Primera pregunta')
    await user.type(screen.getByLabelText('Opción 1 de pregunta 1'), 'Primera opción')
    await user.type(screen.getByLabelText('Opción 2 de pregunta 1'), 'Segunda opción')
    await user.click(screen.getByRole('button', { name: '+ Añadir pregunta' }))
    await user.selectOptions(screen.getAllByLabelText('Tipo')[1], 'long')
    await user.type(screen.getByLabelText('Pregunta 2'), 'Segunda pregunta')
    await user.click(screen.getByRole('button', { name: '+ Añadir pregunta' }))
    await user.type(screen.getByLabelText('Pregunta 3'), 'Tercera pregunta')

    await user.click(screen.getByRole('button', { name: 'Subir pregunta 2' }))
    expect(screen.getByLabelText('Pregunta 1')).toHaveValue('Segunda pregunta')
    expect(screen.getAllByLabelText('Tipo')[0]).toHaveValue('long')
    expect(screen.getByLabelText('Pregunta 2')).toHaveValue('Primera pregunta')
    expect(screen.getByLabelText('Opción 1 de pregunta 2')).toHaveValue('Primera opción')
    expect(screen.getByLabelText('Opción 2 de pregunta 2')).toHaveValue('Segunda opción')
    await user.click(screen.getByRole('button', { name: 'Bajar pregunta 2' }))
    expect(screen.getByLabelText('Pregunta 3')).toHaveValue('Primera pregunta')
    expect(screen.getByRole('button', { name: 'Bajar pregunta 3' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    await user.click(screen.getByRole('button', { name: /Encuesta ordenada/i }))
    await user.click(screen.getByRole('button', { name: 'Editar encuesta' }))
    expect(screen.getByLabelText('Pregunta 1')).toHaveValue('Segunda pregunta')
    expect(screen.getByLabelText('Pregunta 2')).toHaveValue('Tercera pregunta')
    expect(screen.getByLabelText('Pregunta 3')).toHaveValue('Primera pregunta')
    expect(screen.getByLabelText('Opción 1 de pregunta 3')).toHaveValue('Primera opción')
  })

  test.each(['Guardar borrador', 'Publicar encuesta'])('sends questions in their chosen order when using %s', async (action) => {
    const user = userEvent.setup()
    const season = makeSeason({ start_date: '2020-01-01', end_date: '2099-12-31' })
    vi.spyOn(surveysService, 'fetchManageSurveys').mockResolvedValue([])
    const saveDraft = vi.spyOn(surveysService, 'saveSurveyDraft').mockResolvedValue('ordered-survey')
    const publish = vi.spyOn(surveysService, 'publishSurvey').mockResolvedValue(undefined)
    render(<SurveysView isOwner seasons={[season]} />)
    await user.click(screen.getByRole('button', { name: 'Crear encuesta' }))
    await user.type(screen.getByLabelText('Título'), 'Encuesta ordenada')
    await user.selectOptions(screen.getByLabelText('Tipo'), 'long')
    await user.type(screen.getByLabelText('Pregunta 1'), 'Primera pregunta')
    await user.click(screen.getByRole('button', { name: '+ Añadir pregunta' }))
    await user.type(screen.getByLabelText('Pregunta 2'), 'Segunda pregunta')
    await user.type(screen.getByLabelText('Opción 1 de pregunta 2'), 'Sí')
    await user.type(screen.getByLabelText('Opción 2 de pregunta 2'), 'No')
    await user.click(screen.getByRole('button', { name: 'Subir pregunta 2' }))
    await user.click(screen.getByRole('button', { name: action }))
    expect(saveDraft).toHaveBeenCalledWith(expect.objectContaining({ questions: [
      { prompt: 'Segunda pregunta', type: 'single', required: true, options: [{ label: 'Sí' }, { label: 'No' }] },
      { prompt: 'Primera pregunta', type: 'long', required: true, options: [{ label: '' }, { label: '' }] },
    ] }))
    if (action === 'Publicar encuesta') expect(publish).toHaveBeenCalledWith('ordered-survey')
    else expect(publish).not.toHaveBeenCalled()
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

import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const imageId = '123e4567-e89b-42d3-a456-426614174000'
const mocks = vi.hoisted(() => ({ discard: vi.fn(), stage: vi.fn(), volatile: vi.fn() }))

vi.mock('../services/contentImagesService', () => ({
  discardStagedContentImage: mocks.discard,
  stageContentImage: mocks.stage,
  isStagedContentImageVolatile: mocks.volatile,
}))
vi.mock('./ContentImage', () => ({ ContentImage: ({ id }: { id: string }) => <span>Vista {id}</span> }))

import { ContentImageTextarea } from './ContentImageTextarea'

function ControlledTextarea({ initialValue = 'Indicaciones' }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue)
  return <ContentImageTextarea label="Descripción" onChange={setValue} value={value} />
}

describe('ContentImageTextarea', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.stage.mockResolvedValue(imageId)
    mocks.volatile.mockReturnValue(false)
  })

  it('intercepta una imagen pegada y añade una referencia interna', async () => {
    render(<ControlledTextarea />)
    const editor = screen.getByRole('textbox', { name: 'Descripción' }) as HTMLDivElement
    const file = new File(['image'], 'captura.png', { type: 'image/png' })

    fireEvent.paste(editor, {
      clipboardData: {
        items: [{ kind: 'file', type: 'image/png', getAsFile: () => file }],
      },
    })

    await waitFor(() => {
      expect(mocks.stage).toHaveBeenCalledWith(file)
      expect(editor).toHaveTextContent(`[[imagen:${imageId}]]`)
    })
    expect(screen.getByText(`Vista ${imageId}`)).toBeInTheDocument()
    expect(screen.getByText('Imagen preparada. Se subirá al guardar.')).toBeInTheDocument()
  })

  it('permite pegar sin caché y avisa de que hay que guardar antes de recargar', async () => {
    mocks.volatile.mockReturnValue(true)
    render(<ControlledTextarea />)
    fireEvent.paste(screen.getByRole('textbox', { name: 'Descripción' }), {
      clipboardData: { items: [{ kind: 'file', type: 'image/png', getAsFile: () => new File(['image'], 'captura.png', { type: 'image/png' }) }] },
    })
    expect(await screen.findByText(/Guarda antes de cerrar o recargar/)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Descripción' })).toHaveTextContent(`[[imagen:${imageId}]]`)
  })

  it('quita la referencia y descarta la imagen local pendiente', async () => {
    render(<ControlledTextarea />)
    const editor = screen.getByRole('textbox', { name: 'Descripción' })
    const file = new File(['image'], 'captura.png', { type: 'image/png' })
    fireEvent.paste(editor, { clipboardData: { items: [{ kind: 'file', type: 'image/png', getAsFile: () => file }] } })
    await screen.findByRole('button', { name: 'Quitar imagen 1' })

    fireEvent.click(screen.getByRole('button', { name: 'Quitar imagen 1' }))

    expect(editor).toHaveTextContent('Indicaciones')
    expect(mocks.discard).toHaveBeenCalledWith(imageId)
  })

  it('inserta en la selección original después de preparar la imagen con el editor bloqueado', async () => {
    let finish!: (id: string) => void
    mocks.stage.mockImplementationOnce(() => new Promise<string>((resolve) => { finish = resolve }))
    render(<ControlledTextarea initialValue="<strong>Antes</strong><em>Después</em>" />)
    const editor = screen.getByRole('textbox', { name: 'Descripción' })
    const range = document.createRange()
    range.setStartAfter(editor.firstChild!)
    range.collapse(true)
    window.getSelection()!.removeAllRanges()
    window.getSelection()!.addRange(range)
    const file = new File(['image'], 'captura.png', { type: 'image/png' })

    fireEvent.paste(editor, { clipboardData: { items: [{ kind: 'file', type: 'image/png', getAsFile: () => file }] } })
    expect(editor).toHaveAttribute('contenteditable', 'false')
    window.getSelection()!.removeAllRanges()
    finish(imageId)

    await screen.findByRole('button', { name: 'Quitar imagen 1' })
    expect(editor.innerHTML).toBe(`<strong>Antes</strong>\n[[imagen:${imageId}]]\n<em>Después</em>`)
    expect(editor).toHaveAttribute('contenteditable', 'true')
  })

  it('permite pegar imágenes sin mostrar el selector de archivos', () => {
    render(<ContentImageTextarea label="Objetivos" onChange={vi.fn()} showFilePicker={false} value="" />)

    expect(screen.getByText(/Formato rápido: negrita/)).toBeInTheDocument()
    expect(screen.queryByText('Añadir imagen')).not.toBeInTheDocument()
  })

})

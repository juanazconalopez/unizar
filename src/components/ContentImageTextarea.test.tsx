import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const imageId = '123e4567-e89b-42d3-a456-426614174000'
const mocks = vi.hoisted(() => ({ discard: vi.fn(), stage: vi.fn() }))

vi.mock('../services/contentImagesService', () => ({
  discardStagedContentImage: mocks.discard,
  stageContentImage: mocks.stage,
}))
vi.mock('./ContentImage', () => ({ ContentImage: ({ id }: { id: string }) => <span>Vista {id}</span> }))

import { ContentImageTextarea } from './ContentImageTextarea'

function ControlledTextarea() {
  const [value, setValue] = useState('Indicaciones')
  return <ContentImageTextarea label="Descripción" onChange={setValue} value={value} />
}

describe('ContentImageTextarea', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.stage.mockResolvedValue(imageId)
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

  it('permite pegar imágenes sin mostrar el selector de archivos', () => {
    render(<ContentImageTextarea label="Objetivos" onChange={vi.fn()} showFilePicker={false} value="" />)

    expect(screen.getByText(/Formato rápido: negrita/)).toBeInTheDocument()
    expect(screen.queryByText('Añadir imagen')).not.toBeInTheDocument()
  })

})

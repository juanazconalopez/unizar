import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { RichContent } from './RichContent'

describe('rich content', () => {
  test('renders ordinary paragraphs and line breaks immediately', () => {
    const { container } = render(<RichContent text={'Primera línea.\nSegunda línea.\n\nOtro párrafo.'} />)
    expect(screen.getByText('Otro párrafo.')).toBeInTheDocument()
    expect(container.querySelectorAll('p')).toHaveLength(2)
    expect(container.querySelectorAll('br')).toHaveLength(1)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  test('keeps Markdown, underlining, entities and safe links when the parser loads', async () => {
    const { container } = render(<RichContent text={'## Indicaciones\n\n**Fuerza** y <u>control</u> &amp; descanso.\n\n- Primera serie\n- Segunda serie\n\n[Vídeo](https://example.test/video)'} />)
    expect(await screen.findByRole('heading', { name: 'Indicaciones' })).toBeInTheDocument()
    expect(container.querySelector('strong')).toHaveTextContent('Fuerza')
    expect(container.querySelector('u')).toHaveTextContent('control')
    expect(container.querySelectorAll('li')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'Vídeo' })).toHaveAttribute('rel', 'noopener noreferrer')
    expect(container).toHaveTextContent('& descanso.')
  })

  test('sanitizes scripts, event handlers, embedded pages and unsafe URLs', async () => {
    const { container } = render(<RichContent text={'<p>Texto seguro</p><script>alert(1)</script><iframe src="https://example.test"></iframe><img src=x onerror="alert(1)"><a href="javascript:alert(1)">Enlace</a>'} />)
    await screen.findByText('Texto seguro')
    expect(container.querySelector('script, iframe, img, [onerror]')).toBeNull()
    expect(screen.getByText('Enlace').closest('a')).not.toHaveAttribute('href', expect.stringContaining('javascript:'))
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, test, vi } from 'vitest'
import { Modal } from './Modal'

function ModalHarness() {
  const [open, setOpen] = useState(true)
  return <>
    <main className="content" data-testid="content" style={{ overflow: 'auto' }}>Pantalla general</main>
    {open && <Modal labelledBy="test-modal-title" onClose={() => setOpen(false)}>
      <h2 id="test-modal-title">Modal de prueba</h2>
      <button onClick={() => setOpen(false)} type="button">Cerrar prueba</button>
    </Modal>}
  </>
}

describe('Modal', () => {
  test('preserves the field focused before the initial animation frame', () => {
    let initialFocus: FrameRequestCallback | undefined
    const frame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      initialFocus = callback
      return 1
    })
    const view = render(<Modal labelledBy="test-modal-title" onClose={() => undefined}>
      <h2 id="test-modal-title">Modal de prueba</h2>
      <button type="button">Cerrar</button>
      <label>Teléfono<input type="tel" /></label>
    </Modal>)
    const phone = screen.getByLabelText('Teléfono')
    phone.focus()
    initialFocus?.(0)
    expect(phone).toHaveFocus()
    view.unmount()
    frame.mockRestore()
  })

  test('locks and restores the application scroll container', async () => {
    const user = userEvent.setup()
    render(<ModalHarness />)
    const content = screen.getByTestId('content')
    expect(content).toHaveStyle({ overflow: 'hidden' })
    await user.click(screen.getByRole('button', { name: 'Cerrar prueba' }))
    expect(content).toHaveStyle({ overflow: 'auto' })
  })
})

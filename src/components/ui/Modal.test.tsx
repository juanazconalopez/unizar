import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, test } from 'vitest'
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
  test('locks and restores the application scroll container', async () => {
    const user = userEvent.setup()
    render(<ModalHarness />)
    const content = screen.getByTestId('content')
    expect(content).toHaveStyle({ overflow: 'hidden' })
    await user.click(screen.getByRole('button', { name: 'Cerrar prueba' }))
    expect(content).toHaveStyle({ overflow: 'auto' })
  })
})

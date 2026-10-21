import { Suspense, useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { preloadableView } from './preloadableView'

function Form({ title }: { title: string }) {
  const [value, setValue] = useState('')
  return <label>{title}<input value={value} onChange={(event) => setValue(event.target.value)} /></label>
}

test('a prepared view renders synchronously without needing Suspense', async () => {
  const prepared = preloadableView(async () => ({ default: Form }))
  await prepared.preload()
  render(<prepared.View title="Nombre" />)
  expect(screen.getByRole('textbox', { name: 'Nombre' })).toBeVisible()
})

test('finishing an initially deferred load does not remount a form on the next parent update', async () => {
  let resolve!: (module: { default: typeof Form }) => void
  const deferred = preloadableView(() => new Promise<{ default: typeof Form }>((done) => { resolve = done }))
  const { rerender } = render(<Suspense fallback="Cargando"><deferred.View title="Nombre" /></Suspense>)
  expect(screen.getByText('Cargando')).toBeVisible()
  await act(async () => { resolve({ default: Form }) })
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Borrador' } })
  rerender(<Suspense fallback="Cargando"><deferred.View title="Nuevo título" /></Suspense>)
  expect(screen.getByRole('textbox', { name: 'Nuevo título' })).toHaveValue('Borrador')
})

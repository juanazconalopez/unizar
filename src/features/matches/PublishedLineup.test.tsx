import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { makeProfile } from '../../test/fixtures'
import type { MatchLineup } from '../../types'
import { PublishedLineup } from './MatchLineupDialog'

const entry = (playerId: string, slot: number): MatchLineup => ({
  match_id: 'match', player_id: playerId, slot_number: slot, sort_order: slot,
  role: slot <= 15 ? 'starter' : 'substitute', position: null, updated_at: '2026-10-01T12:00:00Z',
})

describe('PublishedLineup', () => {
  test('ordena por dorsal, muestra los huecos titulares y conserva el resumen sin grupos dentro del listado', () => {
    const profiles = [
      makeProfile({ id: 'forward', display_name: 'Ana Martín', primary_position: 'prop' }),
      makeProfile({ id: 'back', display_name: 'Beatriz López', primary_position: 'wing' }),
      makeProfile({ id: 'sub', display_name: 'Clara Ruiz', primary_position: 'centre' }),
    ]
    render(<PublishedLineup entries={[entry('sub', 21), entry('back', 5), entry('forward', 9)]} profiles={profiles} starters={15} />)
    const starters = screen.getByRole('heading', { name: 'Titulares' }).closest('section')!
    const rows = [...starters.querySelectorAll('[data-slot-number]')]
    expect(rows.map((row) => row.querySelector('b')?.textContent)).toEqual(Array.from({ length: 15 }, (_, index) => `${index + 1}`))
    expect(rows[4]).toHaveTextContent('5Beatriz López')
    expect(rows[5].querySelector('span')).toBeEmptyDOMElement()
    expect(rows[8]).toHaveTextContent('9Ana Martín')
    expect(within(starters).getAllByRole('heading')).toHaveLength(1)
    expect(screen.queryByRole('heading', { name: /Delanteras|Línea|Sin posición/ })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Distribución por posición principal')).toHaveTextContent('Delanteras 1Línea 2')
    const substitutes = screen.getByRole('heading', { name: 'Suplentes' }).closest('section')!
    expect(substitutes.querySelectorAll('[data-slot-number]')).toHaveLength(1)
    expect(substitutes).toHaveTextContent('21Clara Ruiz')
  })

  test('una convocatoria vacía conserva quince titulares sin nombres y no inventa suplentes', () => {
    render(<PublishedLineup entries={[]} profiles={[]} starters={15} />)
    const starters = screen.getByRole('heading', { name: 'Titulares' }).closest('section')!
    expect(starters.querySelectorAll('[data-slot-number]')).toHaveLength(15)
    for (const name of starters.querySelectorAll('span')) expect(name).toBeEmptyDOMElement()
    expect(screen.queryByRole('heading', { name: 'Suplentes' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Distribución por posición principal')).toHaveTextContent('Delanteras 0Línea 0')
  })

  test('en seven muestra siete titulares y solo las suplentes asignadas con sus dorsales', () => {
    render(<PublishedLineup entries={[entry('sub', 9)]} profiles={[makeProfile({ id: 'sub' })]} starters={7} />)
    const starters = screen.getByRole('heading', { name: 'Titulares' }).closest('section')!
    expect(starters.querySelectorAll('[data-slot-number]')).toHaveLength(7)
    const substitutes = screen.getByRole('heading', { name: 'Suplentes' }).closest('section')!
    expect(substitutes.querySelectorAll('[data-slot-number]')).toHaveLength(1)
    expect(substitutes).toHaveTextContent('9Ana Martín')
  })

  test('solo los dorsales asignados abren datos de perfil', () => {
    const onOpenPlayer = vi.fn()
    render(<PublishedLineup entries={[entry('player-1', 6)]} profiles={[makeProfile()]} starters={15} onOpenPlayer={onOpenPlayer} />)
    expect(screen.getAllByRole('button')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Datos de perfil de Ana Martín' }))
    expect(onOpenPlayer).toHaveBeenCalledWith('player-1')
  })
})

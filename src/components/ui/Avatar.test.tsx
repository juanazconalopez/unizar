import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { Avatar } from './Avatar'

describe('Avatar', () => {
  test('creates at most two uppercase initials', () => {
    const { rerender } = render(<Avatar name="lucía martín pérez" />)
    expect(screen.getByText('LM')).toBeInTheDocument()

    rerender(<Avatar name="Andrea" />)
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  test('owns the alignment styles used in every context', () => {
    render(<Avatar name="Lucía Martín" />)
    const avatar = screen.getByText('LM')

    expect(avatar).toHaveClass('avatar')
    expect(avatar).toHaveStyle({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0px',
      lineHeight: '1',
      textAlign: 'center',
    })
  })
})

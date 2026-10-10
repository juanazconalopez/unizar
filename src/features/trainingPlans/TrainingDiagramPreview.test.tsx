import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import type { TacticsBoardData, TacticsElementType } from '../../types'
import { TrainingDiagramPreview } from './TrainingDiagramPreview'

test('reads historical diagrams without a canvas and preserves element transforms and labels', () => {
  const types: TacticsElementType[] = ['player', 'opponent', 'cone', 'ball', 'shield', 'run', 'pass', 'defense', 'zone', 'text']
  const data: TacticsBoardData = {
    version: 1, template: '22',
    elements: types.map((type, index) => ({ id: `element-${index}`, type, x: 100 + index * 20, y: 150, rotation: 30, scaleX: 2, scaleY: 0.5, label: type === 'text' ? '<script>texto</script>' : `${index + 1}` })),
  }
  const { container } = render(<TrainingDiagramPreview data={data} label="Esquema guardado" />)

  expect(screen.getByRole('img', { name: 'Esquema guardado' })).toBeInTheDocument()
  expect(container.querySelector('svg')).toHaveAttribute('viewBox', '0 0 900 520')
  expect(container.querySelector('g')).toHaveAttribute('transform', 'translate(100 150) rotate(30) scale(2 0.5)')
  expect(screen.getByText('ZONA DE 22')).toBeInTheDocument()
  expect(screen.getByText('<script>texto</script>')).toBeInTheDocument()
  expect(container.querySelectorAll('circle')).toHaveLength(2)
  expect(container.querySelector('ellipse')).toBeInTheDocument()
  expect(container.querySelector('line[stroke-dasharray="12 8"]')).toBeInTheDocument()
  expect(container.querySelector('line[stroke-dasharray="4 6"]')).toBeInTheDocument()
  expect(container.querySelector('canvas')).not.toBeInTheDocument()
  expect(container.querySelector('script')).not.toBeInTheDocument()
})

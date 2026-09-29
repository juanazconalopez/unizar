import { describe, expect, test } from 'vitest'
import { cropGeometry, initialPhotoCrop } from './profilePhotoCrop'

describe('profile photo crop', () => {
  test('starts portrait photos near the top with room to zoom in on the face', () => {
    const crop = initialPhotoCrop(800, 1200)
    const rectangle = cropGeometry(crop)
    expect(crop.zoom).toBe(1.5)
    expect(rectangle.sourceY).toBeLessThan(120)
    expect(rectangle.sourceSize).toBeCloseTo(533.33, 1)
  })

  test('keeps the selected square within the source after dragging or changing zoom', () => {
    const rectangle = cropGeometry({ width: 800, height: 1200, zoom: 3, offsetX: 10000, offsetY: -10000 })
    expect(rectangle.sourceX).toBeGreaterThanOrEqual(0)
    expect(rectangle.sourceY).toBeGreaterThanOrEqual(0)
    expect(rectangle.sourceX + rectangle.sourceSize).toBeLessThanOrEqual(800)
    expect(rectangle.sourceY + rectangle.sourceSize).toBeLessThanOrEqual(1200)
  })
})

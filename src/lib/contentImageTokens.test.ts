import { describe, expect, it } from 'vitest'
import { contentImageIds, contentImageToken, contentParts, removeContentImageToken, stripContentImageTokens } from './contentImageTokens'

const firstId = '123e4567-e89b-42d3-a456-426614174000'
const secondId = '123e4567-e89b-42d3-a456-426614174001'

describe('referencias internas de imágenes', () => {
  it('extrae identificadores únicos en el orden del texto', () => {
    const text = `Inicio ${contentImageToken(firstId)} medio ${contentImageToken(secondId)} ${contentImageToken(firstId)}`
    expect(contentImageIds(text)).toEqual([firstId, secondId])
  })

  it('separa texto e imágenes para el renderizado', () => {
    expect(contentParts(`Antes ${contentImageToken(firstId)} después`)).toEqual([
      { type: 'text', value: 'Antes ' },
      { type: 'image', id: firstId },
      { type: 'text', value: ' después' },
    ])
  })

  it('oculta las referencias en resúmenes y permite quitar una imagen', () => {
    const text = `Antes\n${contentImageToken(firstId)}\nDespués`
    expect(stripContentImageTokens(text)).toBe('Antes\n\nDespués')
    expect(removeContentImageToken(text, firstId)).toBe('Antes\n\nDespués')
  })
})


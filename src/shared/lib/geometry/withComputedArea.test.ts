import { describe, expect, it } from 'vitest'
import { withComputedArea } from './withComputedArea'

describe('withComputedArea', () => {
  it('пересчитывает areaMm2 из geometry и сохраняет остальные поля', () => {
    const piece = {
      id: 'piece-1',
      name: 'Кусок',
      geometry: { kind: 'rect' as const, width: 10, height: 10 },
      areaMm2: 999, // заведомо устаревшее значение
    }

    const result = withComputedArea(piece)

    expect(result.areaMm2).toBe(100)
    expect(result.id).toBe('piece-1')
    expect(result.name).toBe('Кусок')
    expect(result.geometry).toBe(piece.geometry)
  })
})

import { describe, expect, it } from 'vitest'
import { computeArea } from './computeArea'

describe('computeArea', () => {
  it('прямоугольник: ширина × высота', () => {
    expect(computeArea({ kind: 'rect', width: 300, height: 200 })).toBe(60_000)
  })

  it('многоугольник: формула шнурков для квадрата', () => {
    const geometry = {
      kind: 'polygon' as const,
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
    }
    expect(computeArea(geometry)).toBe(10_000)
  })

  it('многоугольник: невыпуклая L-образная фигура', () => {
    const geometry = {
      kind: 'polygon' as const,
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 50 },
        { x: 50, y: 50 },
        { x: 50, y: 100 },
        { x: 0, y: 100 },
      ],
    }
    // квадрат 100×100 минус вырезанный угол 50×50
    expect(computeArea(geometry)).toBe(10_000 - 2_500)
  })

  it('вырожденный многоугольник (все точки совпадают) — площадь 0', () => {
    const geometry = {
      kind: 'polygon' as const,
      vertices: [
        { x: 5, y: 5 },
        { x: 5, y: 5 },
        { x: 5, y: 5 },
      ],
    }
    expect(computeArea(geometry)).toBe(0)
  })
})

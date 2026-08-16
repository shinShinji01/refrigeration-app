import { describe, expect, it } from 'vitest'
import { hasSelfIntersection } from './hasSelfIntersection'

describe('hasSelfIntersection', () => {
  it('треугольник — никогда не самопересекается', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 100 },
    ]
    expect(hasSelfIntersection(points)).toBe(false)
  })

  it('простой квадрат — нет пересечений', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ]
    expect(hasSelfIntersection(points)).toBe(false)
  })

  it('невыпуклая L-образная фигура — нет пересечений', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 50, y: 50 },
      { x: 50, y: 100 },
      { x: 0, y: 100 },
    ]
    expect(hasSelfIntersection(points)).toBe(false)
  })

  it('контур-бабочка (диагонали четырёхугольника пересекаются) — true', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
    ]
    expect(hasSelfIntersection(points)).toBe(true)
  })

  it('соседние стороны, разделяющие общую вершину, не считаются пересечением', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
      { x: 0, y: 50 },
    ]
    expect(hasSelfIntersection(points)).toBe(false)
  })
})

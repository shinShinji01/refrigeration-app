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

  it('несмежная сторона касается коллинеарной стороны концом (T-образное касание) — true', () => {
    // Сторона (P0,P1) = (0,0)-(40,0) и сторона (P4,P5) = (80,0)-(40,0)
    // лежат на одной прямой y=0 и соприкасаются концом в точке (40,0).
    // Эти стороны не смежные (между ними есть P2, P3), поэтому проверяются
    // через segmentsIntersect. Все четыре ориентации коллинеарны (o1..o4 = 0),
    // так что результат определяется веткой `onSegment`, а не общим пересечением.
    const points = [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 60 },
      { x: 80, y: 60 },
      { x: 80, y: 0 },
      { x: 40, y: 0 },
    ]
    expect(hasSelfIntersection(points)).toBe(true)
  })
})

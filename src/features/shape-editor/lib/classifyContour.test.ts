import { describe, expect, it } from 'vitest'
import { classifyContour } from './classifyContour'

describe('classifyContour', () => {
  it('4 точки, оси совпадают (по часовой) — rect', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: 200 },
      { x: 0, y: 200 },
    ]
    expect(classifyContour(points)).toEqual({ kind: 'rect', width: 300, height: 200 })
  })

  it('4 точки, оси совпадают, обход против часовой и с другого угла — тоже rect', () => {
    const points = [
      { x: 300, y: 200 },
      { x: 0, y: 200 },
      { x: 0, y: 0 },
      { x: 300, y: 0 },
    ]
    expect(classifyContour(points)).toEqual({ kind: 'rect', width: 300, height: 200 })
  })

  it('4 точки, не по осям (ромб) — polygon', () => {
    const points = [
      { x: 50, y: 0 },
      { x: 100, y: 50 },
      { x: 50, y: 100 },
      { x: 0, y: 50 },
    ]
    expect(classifyContour(points)).toEqual({ kind: 'polygon', vertices: points })
  })

  it('3 точки — polygon', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 100 },
    ]
    expect(classifyContour(points)).toEqual({ kind: 'polygon', vertices: points })
  })

  it('5 точек — polygon', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 50, y: 150 },
      { x: 0, y: 100 },
    ]
    expect(classifyContour(points)).toEqual({ kind: 'polygon', vertices: points })
  })

  it('4 точки с нулевой шириной (вырожденный прямоугольник) — polygon', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 100 },
      { x: 0, y: 100 },
    ]
    expect(classifyContour(points)).toEqual({ kind: 'polygon', vertices: points })
  })
})

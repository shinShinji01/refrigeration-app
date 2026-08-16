import { describe, expect, it } from 'vitest'
import { boundsOfPoints, DEFAULT_BOUNDS } from './boundsOfPoints'

describe('boundsOfPoints', () => {
  it('пустой массив — DEFAULT_BOUNDS', () => {
    expect(boundsOfPoints([])).toEqual(DEFAULT_BOUNDS)
  })

  it('одна точка — границы схлопнуты в эту точку', () => {
    expect(boundsOfPoints([{ x: 10, y: 20 }])).toEqual({ minX: 10, minY: 20, maxX: 10, maxY: 20 })
  })

  it('несколько точек — минимум/максимум по каждой оси', () => {
    const points = [
      { x: 0, y: 50 },
      { x: 100, y: 0 },
      { x: 30, y: 200 },
    ]
    expect(boundsOfPoints(points)).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 200 })
  })
})

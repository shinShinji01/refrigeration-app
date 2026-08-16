import { describe, expect, it } from 'vitest'
import { fitScale } from './fitScale'

describe('fitScale', () => {
  it('квадратные границы 100×100 — viewBox с 15% отступом, центрированный', () => {
    const result = fitScale({ minX: 0, minY: 0, maxX: 100, maxY: 100 })
    expect(result).toEqual({ x: -15, y: -15, width: 130, height: 130 })
  })

  it('прямоугольные границы — viewBox квадратный по большей стороне', () => {
    const result = fitScale({ minX: 0, minY: 0, maxX: 300, maxY: 200 })
    // большая сторона 300, +30% отступ = 390, центр по обеим осям — центр bounds
    expect(result.width).toBe(390)
    expect(result.height).toBe(390)
    expect(result.x).toBeCloseTo(150 - 195)
    expect(result.y).toBeCloseTo(100 - 195)
  })

  it('большие границы (метры) — тот же алгоритм, без переполнения', () => {
    const result = fitScale({ minX: 0, minY: 0, maxX: 3000, maxY: 2000 })
    expect(result.width).toBe(3900)
    expect(result.height).toBe(3900)
  })

  it('границы не по центру начала координат — центрируется корректно', () => {
    const result = fitScale({ minX: 100, minY: 100, maxX: 200, maxY: 200 })
    expect(result).toEqual({ x: 100 - 15, y: 100 - 15, width: 130, height: 130 })
  })

  it('вырожденные границы (одна точка) — не схлопывается меньше минимума маркера вершины', () => {
    const result = fitScale({ minX: 5, minY: 0, maxX: 5, maxY: 0 })
    // content зажат в 20мм (MIN_CONTENT_SIZE_MM), +30% отступ = 26мм
    expect(result).toEqual({ x: 5 - 13, y: 0 - 13, width: 26, height: 26 })
  })

  it('очень маленькие, но не вырожденные границы — тоже зажимаются в минимум', () => {
    const result = fitScale({ minX: 0, minY: 0, maxX: 2, maxY: 2 })
    expect(result.width).toBe(26)
    expect(result.height).toBe(26)
  })
})

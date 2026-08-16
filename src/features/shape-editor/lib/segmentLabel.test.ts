import { describe, expect, it } from 'vitest'
import { segmentLabel } from './segmentLabel'

describe('segmentLabel', () => {
  it('горизонтальный отрезок слева направо — угол 0, midpoint по центру', () => {
    const result = segmentLabel({ x: 0, y: 0 }, { x: 100, y: 0 }, 0)
    expect(result).toEqual({ labelPosition: { x: 50, y: 0 }, angleDeg: 0, lengthMm: 100 })
  })

  it('тот же отрезок справа налево — угол нормализуется обратно к 0, не 180', () => {
    const result = segmentLabel({ x: 100, y: 0 }, { x: 0, y: 0 }, 0)
    expect(result).toEqual({ labelPosition: { x: 50, y: 0 }, angleDeg: 0, lengthMm: 100 })
  })

  it('вертикальный отрезок — угол 90, midpoint по центру', () => {
    const result = segmentLabel({ x: 0, y: 0 }, { x: 0, y: 100 }, 0)
    expect(result).toEqual({ labelPosition: { x: 0, y: 50 }, angleDeg: 90, lengthMm: 100 })
  })

  it('диагональ 3-4-5 (в сотнях мм) — длина и угол по формуле', () => {
    const result = segmentLabel({ x: 0, y: 0 }, { x: 300, y: 400 }, 0)
    expect(result!.lengthMm).toBe(500)
    expect(result!.angleDeg).toBeCloseTo(53.13, 1)
    expect(result!.labelPosition).toEqual({ x: 150, y: 200 })
  })

  it('наклонная сторона, направленная «справа налево и вверх» — угол в диапазоне [-90, 90]', () => {
    const result = segmentLabel({ x: 100, y: 100 }, { x: 0, y: 0 }, 0)
    expect(result!.angleDeg).toBeCloseTo(45, 1)
    expect(result!.angleDeg).toBeGreaterThanOrEqual(-90)
    expect(result!.angleDeg).toBeLessThanOrEqual(90)
  })

  it('ненулевой отступ — смещает labelPosition по нормали к отрезку', () => {
    const result = segmentLabel({ x: 0, y: 0 }, { x: 100, y: 0 }, 10)
    expect(result).toEqual({ labelPosition: { x: 50, y: 10 }, angleDeg: 0, lengthMm: 100 })
  })

  it('вырожденный отрезок (совпадающие точки) — null', () => {
    expect(segmentLabel({ x: 5, y: 5 }, { x: 5, y: 5 }, 0)).toBeNull()
  })
})

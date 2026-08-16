import { describe, expect, it } from 'vitest'
import { snapToGrid, GRID_STEP_MM } from './snapToGrid'

describe('snapToGrid', () => {
  it('шаг сетки — 5мм', () => {
    expect(GRID_STEP_MM).toBe(5)
  })

  it('округляет к ближайшему узлу сетки по обеим осям', () => {
    expect(snapToGrid({ x: 12, y: 3 })).toEqual({ x: 10, y: 5 })
  })

  it('уже выровненная по сетке точка не меняется', () => {
    expect(snapToGrid({ x: 25, y: 100 })).toEqual({ x: 25, y: 100 })
  })

  it('граница ровно посередине между двумя узлами округляется вверх', () => {
    // 2.5 — ровно посередине между 0 и 5
    expect(snapToGrid({ x: 2.5, y: 7.5 })).toEqual({ x: 5, y: 10 })
  })

  it('отрицательные координаты снапаются симметрично', () => {
    expect(snapToGrid({ x: -12, y: -3 })).toEqual({ x: -10, y: -5 })
  })
})

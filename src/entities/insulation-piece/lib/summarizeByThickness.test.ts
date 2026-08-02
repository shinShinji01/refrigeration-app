import { describe, expect, it } from 'vitest'
import { summarizeByThickness } from './summarizeByThickness'
import type { InsulationPieceWithQuantity } from '../model/types'

const piece = (areaMm2: number, thicknessMm: number, quantity: number): InsulationPieceWithQuantity =>
  ({ areaMm2, thicknessMm, quantity }) as InsulationPieceWithQuantity

describe('summarizeByThickness', () => {
  it('суммирует площадь с учётом количества и переводит в м²', () => {
    // 1 000 000 мм² × 2 = 2 000 000 мм² = 2 м²
    const result = summarizeByThickness([piece(1_000_000, 13, 2)])
    expect(result).toEqual([{ thicknessMm: 13, areaM2: 2 }])
  })

  it('группирует по толщине и сортирует по возрастанию', () => {
    const result = summarizeByThickness([
      piece(500_000, 13, 1),
      piece(500_000, 6, 1),
      piece(500_000, 13, 1),
    ])
    expect(result).toEqual([
      { thicknessMm: 6, areaM2: 0.5 },
      { thicknessMm: 13, areaM2: 1 },
    ])
  })

  it('пустой список — пустой результат', () => {
    expect(summarizeByThickness([])).toEqual([])
  })
})

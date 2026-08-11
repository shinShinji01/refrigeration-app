import { describe, expect, it } from 'vitest'
import { groupByThickness } from './groupByThickness'
import type { InsulationPieceWithQuantity } from '../model/types'

const piece = (linkId: string, thicknessMm: number): InsulationPieceWithQuantity =>
  ({ linkId, thicknessMm }) as InsulationPieceWithQuantity

describe('groupByThickness', () => {
  it('группирует куски по толщине, сохраняя порядок внутри группы', () => {
    const result = groupByThickness([piece('a', 13), piece('b', 6), piece('c', 13)])
    expect(result).toEqual([
      { thicknessMm: 6, pieces: [piece('b', 6)] },
      { thicknessMm: 13, pieces: [piece('a', 13), piece('c', 13)] },
    ])
  })

  it('сортирует секции по возрастанию толщины', () => {
    const result = groupByThickness([piece('a', 40), piece('b', 6), piece('c', 20)])
    expect(result.map((section) => section.thicknessMm)).toEqual([6, 20, 40])
  })

  it('пустой список — пустой результат', () => {
    expect(groupByThickness([])).toEqual([])
  })
})

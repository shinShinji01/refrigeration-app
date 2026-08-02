import type { InsulationPieceWithQuantity } from '../model/types'

export interface ThicknessSummary {
  thicknessMm: number
  areaM2: number
}

const MM2_PER_M2 = 1_000_000

// Статистика в подвале группы (docs/spec.md → "сколько и какая по толщине
// теплоизоляция была использована на эту группу в квадратных метрах") —
// состав группы по толщине, площадь с учётом количества каждого куска.
export const summarizeByThickness = (pieces: InsulationPieceWithQuantity[]): ThicknessSummary[] => {
  const totalsByThickness = new Map<number, number>()

  for (const piece of pieces) {
    const totalAreaMm2 = piece.areaMm2 * piece.quantity
    totalsByThickness.set(piece.thicknessMm, (totalsByThickness.get(piece.thicknessMm) ?? 0) + totalAreaMm2)
  }

  return [...totalsByThickness.entries()]
    .map(([thicknessMm, areaMm2]) => ({ thicknessMm, areaM2: areaMm2 / MM2_PER_M2 }))
    .sort((a, b) => a.thicknessMm - b.thicknessMm)
}

import type { InsulationPieceWithQuantity } from '../model/types'

export interface ThicknessGroup {
  thicknessMm: number
  pieces: InsulationPieceWithQuantity[]
}

// Сквозной вид "по толщине" (widgets/insulation-group-list/ui/
// InsulationThicknessList) — куски всего набора, сгруппированные по толщине
// независимо от групп теплоизоляции, для удобства физической нарезки одной
// пачкой (docs/superpowers/specs/2026-08-10-insulation-view-controls-design.md).
export const groupByThickness = (pieces: InsulationPieceWithQuantity[]): ThicknessGroup[] => {
  const byThickness = new Map<number, InsulationPieceWithQuantity[]>()

  for (const piece of pieces) {
    const group = byThickness.get(piece.thicknessMm)
    if (group) {
      group.push(piece)
    } else {
      byThickness.set(piece.thicknessMm, [piece])
    }
  }

  return [...byThickness.entries()]
    .map(([thicknessMm, groupedPieces]) => ({ thicknessMm, pieces: groupedPieces }))
    .sort((a, b) => a.thicknessMm - b.thicknessMm)
}

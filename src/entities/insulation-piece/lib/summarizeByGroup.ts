import type { InsulationGroupId } from '@/entities/insulation-group'

export interface GroupPieceArea {
  groupId: InsulationGroupId
  areaMm2: number
  quantity: number
}

export interface GroupAreaSummary {
  groupId: InsulationGroupId
  areaM2: number
}

const MM2_PER_M2 = 1_000_000

// Общая статистика набора по группам (docs/spec.md → "какая группа
// использовала наиболее большую площадь") — площадь с учётом количества
// каждого куска, без фильтрации по готовности (весь состав набора).
export const summarizeByGroup = (pieces: GroupPieceArea[]): GroupAreaSummary[] => {
  const totalsByGroup = new Map<InsulationGroupId, number>()

  for (const piece of pieces) {
    const totalAreaMm2 = piece.areaMm2 * piece.quantity
    totalsByGroup.set(piece.groupId, (totalsByGroup.get(piece.groupId) ?? 0) + totalAreaMm2)
  }

  return [...totalsByGroup.entries()].map(([groupId, areaMm2]) => ({
    groupId,
    areaM2: areaMm2 / MM2_PER_M2,
  }))
}

import type { BaseRecord } from '@/shared/api'
import type { Geometry } from '@/shared/lib/geometry'
import type { InsulationGroupId } from '@/entities/insulation-group'

export type InsulationPieceId = string & { readonly __brand: 'InsulationPieceId' }

export interface InsulationPiece extends BaseRecord {
  id: InsulationPieceId
  name: string
  drawingNumbers: string[]
  geometry: Geometry
  // Производное поле, денормализовано. Пересчёт — только через
  // shared/lib/geometry/withComputedArea(), больше нигде (docs/decisions.md №6).
  areaMm2: number
  thicknessMm: number
  hasAdhesive: boolean
  isArchived: boolean
}

// Кусок в составе конкретной группы (group_pieces) — с количеством и порядком
// показа. linkId — id join-записи; в docs/data-model.md это же значение служит
// ключом в donePieces сессии нарезки (Record<groupPieceId, number | true> —
// число нарезано или true для legacy полной нарезки). groupId —
// та же join-запись, но нужен для сквозного вида "по толщине"
// (widgets/insulation-group-list/ui/InsulationThicknessList), где кусок
// показывается вне своей группы и нужна ненавязчивая метка, откуда он.
export type InsulationPieceWithQuantity = InsulationPiece & {
  quantity: number
  order: number
  linkId: string
  groupId: InsulationGroupId
}

import type { BaseRecord } from '@/shared/api'
import type { UnitId } from '@/entities/refrigeration-unit'
import type { InsulationSetId } from '@/entities/insulation-set'
import type { UserId } from '@/entities/user'

export type CuttingSessionId = string & { readonly __brand: 'CuttingSessionId' }

export type CuttingSessionStatus = 'in_progress' | 'completed'

// Прогресс нарезки для конкретной (unit, set, unitNo) — см. docs/data-model.md
// → "cutting_sessions". Ключ в donePieces — id записи group_pieces (то же
// значение, что уже используется как InsulationPieceWithQuantity.linkId).
export interface CuttingSession extends BaseRecord {
  id: CuttingSessionId
  unit: UnitId
  set: InsulationSetId
  unitNo: number
  donePieces: Record<string, number | true>
  status: CuttingSessionStatus
  user: UserId
}

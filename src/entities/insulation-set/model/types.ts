import type { BaseRecord, IsoDateString } from '@/shared/api'
import type { UnitId } from '@/entities/refrigeration-unit'

export type InsulationSetId = string & { readonly __brand: 'InsulationSetId' }

// Версия набора изоляции для установки. Версионирование — только здесь, состав
// узлов установки не версионируется (docs/decisions.md №3).
export interface InsulationSet extends BaseRecord {
  id: InsulationSetId
  unit: UnitId
  name: string | null
  effectiveFrom: IsoDateString
  isArchived: boolean
}

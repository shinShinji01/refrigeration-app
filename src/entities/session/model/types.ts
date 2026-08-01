import type { BaseRecord } from '@/shared/api'
import type { UnitId } from '@/entities/refrigeration-unit'
import type { InsulationSetId } from '@/entities/insulation-set'
import type { UserId } from '@/entities/user'

export type CuttingSessionId = string & { readonly __brand: 'CuttingSessionId' }
export type StockSessionId = string & { readonly __brand: 'StockSessionId' }

export type SessionStatus = 'in_progress' | 'completed'

// Ключ — id записи group_pieces (не id куска: один и тот же кусок может
// входить в разные группы и резаться независимо). См. docs/data-model.md.
export type DonePieces = Record<string, true>

export interface CuttingSession extends BaseRecord {
  id: CuttingSessionId
  unit: UnitId
  set: InsulationSetId
  unitNo: number | null
  donePieces: DonePieces
  status: SessionStatus
  user: UserId
}

export type PartCounts = Record<string, number>

export interface StockSession extends BaseRecord {
  id: StockSessionId
  unit: UnitId
  unitNo: number | null
  partCounts: PartCounts
  status: SessionStatus
  user: UserId
}
